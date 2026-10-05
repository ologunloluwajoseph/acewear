import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, clampInt } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =====================================================================
// GET /api/search?q=... — global search across people and posts.
// Block-aware on both directions (a block hides content both ways),
// banned authors are excluded, results are newest-first and capped.
// =====================================================================

const USER_SELECT = {
  id: true,
  username: true,
  firstName: true,
  avatarUrl: true,
  bio: true,
  isVerified: true,
  isPro: true,
} as const

export async function GET(req: NextRequest) {
  return handle(req, async (me) => {
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
    if (q.length < 1) return ok({ users: [], posts: [] })

    // users I blocked + users who blocked me — content hidden both ways
    const blocks = await db.block.findMany({
      where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] },
      select: { blockerId: true, blockedId: true },
    })
    const hiddenIds = new Set<number>([me.id])
    for (const b of blocks) {
      hiddenIds.add(b.blockerId)
      hiddenIds.add(b.blockedId)
    }

    const [users, posts] = await Promise.all([
      db.user.findMany({
        where: {
          AND: [
            { id: { notIn: [...hiddenIds] } },
            { isBanned: false },
            {
              OR: [
                { username: { contains: q } },
                { firstName: { contains: q } },
              ],
            },
          ],
        },
        select: USER_SELECT,
        orderBy: { username: 'asc' },
        take: clampInt(8, 1, 20, 8),
      }),
      db.post.findMany({
        where: {
          status: 'active',
          body: { contains: q },
          userId: { notIn: [...hiddenIds] },
          user: { isBanned: false },
        },
        select: {
          id: true,
          body: true,
          mediaUrl: true,
          mediaType: true,
          likesCount: true,
          commentsCount: true,
          createdAt: true,
          user: { select: USER_SELECT },
        },
        orderBy: { createdAt: 'desc' },
        take: clampInt(10, 1, 20, 10),
      }),
    ])
    return ok({ users, posts })
  })
}
