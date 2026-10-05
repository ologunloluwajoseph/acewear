import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { clampInt, fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10
const MAX_TAGS = 10

const userBriefSelect = {
  id: true, username: true, firstName: true,
  avatarUrl: true, isVerified: true, isPro: true,
} as const

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  const url = new URL(req.url)
  const cursor = clampInt(url.searchParams.get('cursor'), 0, Number.MAX_SAFE_INTEGER, 0)
  const limit = clampInt(url.searchParams.get('limit'), 1, 30, PAGE_SIZE)

  // Task 23: shadow-blocking — hide posts from users I blocked and from
  // users who blocked me (block cuts content in both directions).
  let blockedIds: number[] = []
  if (user) {
    const blocks = await db.block.findMany({
      where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
      select: { blockerId: true, blockedId: true },
    })
    blockedIds = [...new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]))]
      .filter((id) => id !== user.id)
  }

  const posts = await db.post.findMany({
    where: { status: 'active', ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}) },
    include: {
      user: { select: userBriefSelect },
      contest: { select: { id: true, title: true, slug: true } },
      originalPost: {
        include: { user: { select: userBriefSelect } },
      },
      tags: { select: { user: { select: userBriefSelect } } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  let likedIds: number[] = []
  let dislikedIds: number[] = []
  let votedIds: number[] = []
  let resharedIds: number[] = []
  if (user && posts.length) {
    const ids = posts.map((p) => p.id)
    const [likes, dislikes, votes, reshares] = await Promise.all([
      db.like.findMany({ where: { userId: user.id, postId: { in: ids } }, select: { postId: true } }),
      db.dislike.findMany({ where: { userId: user.id, postId: { in: ids } }, select: { postId: true } }),
      db.vote.findMany({ where: { userId: user.id, postId: { in: ids } }, select: { postId: true } }),
      db.post.findMany({
        where: { userId: user.id, originalPostId: { in: ids } },
        select: { originalPostId: true },
      }),
    ])
    likedIds = likes.map((l) => l.postId)
    dislikedIds = dislikes.map((l) => l.postId)
    votedIds = votes.map((v) => v.postId)
    resharedIds = reshares.map((r) => r.originalPostId).filter((v): v is number => v !== null)
  }

  return NextResponse.json({
    ok: true,
    posts: posts.map((p) => ({
      id: p.id,
      body: p.body,
      mediaUrl: p.mediaUrl,
      mediaType: p.mediaType,
      category: p.category,
      likesCount: p.likesCount,
      dislikesCount: p.dislikesCount,
      resharesCount: p.resharesCount,
      commentsCount: p._count.comments,
      votesCount: p.votesCount,
      createdAt: p.createdAt,
      user: p.user,
      contest: p.contest,
      likedByMe: likedIds.includes(p.id),
      dislikedByMe: dislikedIds.includes(p.id),
      resharedByMe: resharedIds.includes(p.id),
      votedByMe: votedIds.includes(p.id),
      tagged: p.tags.map((t) => t.user),
      originalPost:
        p.originalPost && p.originalPost.status === 'active'
          ? {
              id: p.originalPost.id,
              body: p.originalPost.body,
              mediaUrl: p.originalPost.mediaUrl,
              mediaType: p.originalPost.mediaType,
              createdAt: p.originalPost.createdAt,
              user: p.originalPost.user,
            }
          : null,
    })),
    nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const body = await readJson<{
      body?: string
      mediaUrl?: string
      category?: string
      taggedUserIds?: number[]
    }>(req)

    const text = sanitizeText(body.body, 2000)
    const mediaUrl = sanitizeText(body.mediaUrl, 500)

    if (!text && !mediaUrl) return fail('Post needs text or an image')
    if (mediaUrl && !mediaUrl.startsWith('/uploads/')) {
      return fail('Invalid media URL')
    }

    // ---- validate tagged friends/followers (max 10, no self, must exist) ----
    const rawTagIds = Array.isArray(body.taggedUserIds) ? body.taggedUserIds : []
    const tagIds = [...new Set(
      rawTagIds
        .map((v) => Math.floor(Number(v)))
        .filter((v) => Number.isInteger(v) && v > 0 && v !== user.id)
    )].slice(0, MAX_TAGS)

    let validTagIds: number[] = []
    if (tagIds.length) {
      const found = await db.user.findMany({
        where: { id: { in: tagIds } },
        select: { id: true },
      })
      validTagIds = found.map((u) => u.id)
    }

    const post = await db.post.create({
      data: {
        userId: user.id,
        body: text || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaUrl ? 'image' : 'text',
        category: sanitizeText(body.category, 20) || 'other',
        tags: { create: validTagIds.map((userId) => ({ userId })) },
      },
      include: {
        user: { select: userBriefSelect },
        tags: { select: { user: { select: userBriefSelect } } },
      },
    })

    // Notify tagged friends — "you were tagged in a post"
    await Promise.all(
      validTagIds.map((taggedId) =>
        notify({
          userId: taggedId,
          actorId: user.id,
          type: 'system',
          text: `${user.firstName ?? user.username} tagged you in a post`,
          targetType: 'post',
          targetId: post.id,
        })
      )
    )

    // Social proof: notify followers that the user posted
    const followers = await db.follow.findMany({
      where: { followingId: user.id },
      select: { followerId: true },
      take: 25,
    })
    await Promise.all(
      followers
        .filter((f) => !validTagIds.includes(f.followerId)) // tagged users already notified
        .map((f) =>
          notify({
            userId: f.followerId,
            actorId: user.id,
            type: 'system',
            text: `${user.firstName ?? user.username} shared a new post`,
            targetType: 'post',
            targetId: post.id,
          })
        )
    )

    return ok({
      post: {
        ...post,
        dislikesCount: 0,
        resharesCount: 0,
        commentsCount: 0,
        likedByMe: false,
        dislikedByMe: false,
        resharedByMe: false,
        votedByMe: false,
        originalPost: null,
        tagged: post.tags.map((t) => t.user),
      },
    })
  })
}
