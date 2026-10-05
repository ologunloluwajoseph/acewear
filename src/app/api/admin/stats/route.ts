import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleAdmin, ok } from '@/lib/api-helpers'
import { syncContestStatuses } from '@/lib/contests'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/stats — dashboard metrics (AdminController::index port)
export async function GET(req: NextRequest) {
  return handleAdmin(req, async () => {
    await syncContestStatuses()

    const [
      users,
      posts,
      activeContests,
      completedContests,
      orders,
      messages,
      removedPosts,
      coinsInCirculation,
    ] = await Promise.all([
      db.user.count(),
      db.post.count({ where: { status: 'active' } }),
      db.contest.count({ where: { status: { in: ['active', 'voting'] } } }),
      db.contest.count({ where: { status: 'completed' } }),
      db.order.count(),
      db.message.count(),
      db.post.count({ where: { status: 'removed' } }),
      db.user.aggregate({ _sum: { aceCoins: true } }),
    ])

    const [recentUsers, recentPosts, topEntries] = await Promise.all([
      db.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true, username: true, firstName: true,
          avatarUrl: true, isVerified: true, isBanned: true, createdAt: true,
        },
      }),
      db.post.findMany({
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { username: true, firstName: true, avatarUrl: true } },
        },
      }),
      db.contestEntry.findMany({
        orderBy: { votesCount: 'desc' },
        take: 5,
        include: {
          user: { select: { username: true, firstName: true, avatarUrl: true } },
          contest: { select: { title: true } },
        },
      }),
    ])

    return ok({
      stats: {
        users,
        posts,
        activeContests,
        completedContests,
        orders,
        messages,
        removedPosts,
        coinsInCirculation: coinsInCirculation._sum.aceCoins ?? 0,
      },
      recentUsers,
      recentPosts,
      topEntries,
    })
  })
}
