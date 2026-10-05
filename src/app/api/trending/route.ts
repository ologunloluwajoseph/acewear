import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

// GET /api/trending — trending hashtags extracted from recent posts + suggested users
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req)

  // Get recent active posts from the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentPosts = await db.post.findMany({
    where: {
      status: 'active',
      createdAt: { gte: sevenDaysAgo },
      body: { not: null },
    },
    select: { body: true, likesCount: true },
    orderBy: { likesCount: 'desc' },
    take: 200,
  })

  // Extract and rank hashtags
  const hashtagCounts = new Map<string, number>()
  for (const post of recentPosts) {
    if (!post.body) continue
    const tags = post.body.match(/#[\w]+/g) ?? []
    for (const tag of tags) {
      const lower = tag.toLowerCase()
      hashtagCounts.set(lower, (hashtagCounts.get(lower) ?? 0) + 1 + post.likesCount * 0.1)
    }
  }

  const trendingTags = [...hashtagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, score]) => ({ tag, count: Math.round(score) }))

  // Suggested users to follow (popular, not yet followed by me, not banned)
  const myFollowingIds = me
    ? (
        await db.follow.findMany({
          where: { followerId: me.id },
          select: { followingId: true },
        })
      ).map((f) => f.followingId)
    : []

  const excludeIds = [...myFollowingIds, ...(me ? [me.id] : [])]

  const suggestedUsers = await db.user.findMany({
    where: {
      isBanned: false,
      id: { notIn: excludeIds.length > 0 ? excludeIds : [-1] },
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      avatarUrl: true,
      isVerified: true,
      isPro: true,
      bio: true,
      _count: { select: { followers: true, posts: true } },
    },
    orderBy: [
      { isVerified: 'desc' },
      { isPro: 'desc' },
    ],
    take: 8,
  })

  // Hot posts (most liked in the last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const hotPosts = await db.post.findMany({
    where: {
      status: 'active',
      createdAt: { gte: oneDayAgo },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          avatarUrl: true,
          isVerified: true,
          isPro: true,
        },
      },
    },
    orderBy: { likesCount: 'desc' },
    take: 6,
  })

  return NextResponse.json({
    ok: true,
    trendingTags,
    suggestedUsers,
    hotPosts: hotPosts.map((p) => ({
      id: p.id,
      body: p.body,
      mediaUrl: p.mediaUrl,
      mediaType: p.mediaType,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      createdAt: p.createdAt,
      user: p.user,
    })),
  })
}
