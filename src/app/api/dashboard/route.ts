import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const DAY_MS = 86_400_000

// GET /api/dashboard — personal analytics powering the animated dashboard:
// totals, 14-day daily series (bar), hourly activity histogram,
// coin-spend breakdown (pie), trust gauge + top posts.
export const GET = (req: NextRequest) =>
  handle(req, async (user) => {
    const since = new Date(Date.now() - 13 * DAY_MS)
    since.setHours(0, 0, 0, 0)

    const [
      agg,
      postCount,
      followers,
      following,
      wins,
      activeStories,
      recentPosts,
      likesReceived,
      commentsReceived,
      myComments,
      myLikes,
      myMessages,
      orders,
      withdrawals,
      topPosts,
    ] = await Promise.all([
      db.post.aggregate({
        where: { userId: user.id, status: 'active' },
        _sum: { likesCount: true, commentsCount: true, votesCount: true },
      }),
      db.post.count({ where: { userId: user.id, status: 'active' } }),
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
      db.contest.count({ where: { winnerUserId: user.id } }),
      db.story.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
      db.post.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.like.findMany({
        where: { post: { userId: user.id }, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.comment.findMany({
        where: { post: { userId: user.id }, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.comment.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.like.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.message.findMany({
        where: { senderId: user.id, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.order.findMany({
        where: { userId: user.id, status: 'completed' },
        select: { priceCoins: true, product: { select: { category: true } } },
      }),
      db.withdrawal.findMany({
        where: { userId: user.id },
        select: { amountCoins: true, status: true },
      }),
      db.post.findMany({
        where: { userId: user.id, status: 'active' },
        orderBy: [{ likesCount: 'desc' }, { commentsCount: 'desc' }],
        take: 3,
        select: { id: true, body: true, mediaUrl: true, likesCount: true, commentsCount: true },
      }),
    ])

    // ---- 14-day daily series (posts / likes received / comments received) ----
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)
    const daily: { day: string; label: string; posts: number; likes: number; comments: number }[] = []
    const buckets = new Map<string, { posts: number; likes: number; comments: number }>()
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * DAY_MS)
      buckets.set(dayKey(d), { posts: 0, likes: 0, comments: 0 })
      daily.push({
        day: dayKey(d),
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        posts: 0, likes: 0, comments: 0,
      })
    }
    const byKey = (d: Date) => buckets.get(dayKey(d))
    recentPosts.forEach((p) => { const b = byKey(p.createdAt); if (b) b.posts++ })
    likesReceived.forEach((l) => { const b = byKey(l.createdAt); if (b) b.likes++ })
    commentsReceived.forEach((c) => { const b = byKey(c.createdAt); if (b) b.comments++ })
    for (const d of daily) Object.assign(d, buckets.get(d.day))

    // ---- hourly activity histogram (my actions, 00–23) ----
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, count: 0 }))
    const bump = (d: Date) => { hours[d.getHours()].count++ }
    recentPosts.forEach((r) => bump(r.createdAt))
    myComments.forEach((r) => bump(r.createdAt))
    myLikes.forEach((r) => bump(r.createdAt))
    myMessages.forEach((r) => bump(r.createdAt))

    // ---- coin spend breakdown (pie) ----
    const spendByCategory = new Map<string, number>()
    for (const o of orders) {
      const cat = o.product.category
      spendByCategory.set(cat, (spendByCategory.get(cat) ?? 0) + o.priceCoins)
    }
    const paidOut = withdrawals.filter((w) => w.status === 'paid').reduce((s, w) => s + w.amountCoins, 0)
    if (paidOut > 0) spendByCategory.set('cash_out', (spendByCategory.get('cash_out') ?? 0) + paidOut)
    const coinBreakdown = [...spendByCategory.entries()].map(([name, value]) => ({
      name,
      value,
    }))

    const pendingCoins = withdrawals.filter((w) => w.status === 'pending').reduce((s, w) => s + w.amountCoins, 0)

    return ok({
      totals: {
        coins: user.aceCoins,
        trustScore: user.trustScore,
        streak: user.streakCount,
        followers,
        following,
        posts: postCount,
        likesReceived: agg._sum.likesCount ?? 0,
        commentsReceived: agg._sum.commentsCount ?? 0,
        votesReceived: agg._sum.votesCount ?? 0,
        wins,
        activeStories,
      },
      daily,
      hourly: hours,
      coinBreakdown,
      withdrawals: { paidOut, pendingCoins, count: withdrawals.length },
      topPosts: topPosts.map((p) => ({ ...p, excerpt: (p.body ?? '').slice(0, 80) })),
    })
  })
