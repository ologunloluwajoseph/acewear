import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fail } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/users/:username — public profile + posts + relationship
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const viewer = await getSessionUser(req)

  const profile = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      firstName: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      isVerified: true,
      isPro: true,
      isAdmin: true,
      trustScore: true,
      streakCount: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
          contestsWon: true,
        },
      },
    },
  })
  if (!profile) return fail('User not found', 404)

  const posts = await db.post.findMany({
    where: { userId: profile.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
    take: 12,
    include: {
      _count: { select: { comments: true, likes: true } },
    },
  })

  let following = false
  let followedBy = false
  let blockedByMe = false
  let blocksMe = false
  if (viewer && viewer.id !== profile.id) {
    const [fw, fb, blk, blkMe] = await Promise.all([
      db.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewer.id,
            followingId: profile.id,
          },
        },
      }),
      db.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: profile.id,
            followingId: viewer.id,
          },
        },
      }),
      db.block.findUnique({
        where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: profile.id } },
        select: { id: true },
      }),
      db.block.findUnique({
        where: { blockerId_blockedId: { blockerId: profile.id, blockedId: viewer.id } },
        select: { id: true },
      }),
    ])
    following = Boolean(fw)
    followedBy = Boolean(fb)
    blockedByMe = Boolean(blk)
    blocksMe = Boolean(blkMe)
  }

  return NextResponse.json({
    ok: true,
    profile: {
      ...profile,
      following,
      followedBy,
      blockedByMe,
      blocksMe,
    },
    posts,
  })
}
