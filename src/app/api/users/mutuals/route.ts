import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clampInt, sanitizeText } from '@/lib/api-helpers'
import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/users/mutuals?q= — people you follow or who follow you.
// Powers the "Tag friends" picker on the composer.
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const q = sanitizeText(url.searchParams.get('q'), 40)
  const limit = clampInt(url.searchParams.get('limit'), 1, 50, 30)

  const [following, followers] = await Promise.all([
    db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    db.follow.findMany({ where: { followingId: user.id }, select: { followerId: true } }),
  ])

  const ids = [...new Set([
    ...following.map((f) => f.followingId),
    ...followers.map((f) => f.followerId),
  ])]
  if (!ids.length) return NextResponse.json({ ok: true, users: [] })

  const users = await db.user.findMany({
    where: {
      id: { in: ids },
      isBanned: false,
      ...(q
        ? {
            OR: [
              { username: { contains: q } },
              { firstName: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true, username: true, firstName: true,
      avatarUrl: true, isVerified: true, isPro: true,
    },
    orderBy: { username: 'asc' },
    take: limit,
  })

  const followingSet = new Set(following.map((f) => f.followingId))
  return NextResponse.json({
    ok: true,
    users: users
      .map((u) => ({ ...u, following: followingSet.has(u.id) }))
      .sort((a, b) => Number(b.following) - Number(a.following)),
  })
}
