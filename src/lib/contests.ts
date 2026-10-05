import { db } from '@/lib/db'
import { notify } from '@/lib/notify'

// =====================================================================
// Contest lifecycle — Node.js edition of app/Helpers/ContestHelper.php
// Lazy status sweep (runs on every contest list/detail read):
//   active  --endsAt passed-->      voting
//   voting  --votingEndsAt passed--> completed (winner awarded + notified)
// =====================================================================

export async function syncContestStatuses(): Promise<void> {
  const now = new Date()

  // 1. active -> voting
  await db.contest.updateMany({
    where: { status: 'active', endsAt: { lte: now } },
    data: { status: 'voting' },
  })

  // 2. voting -> completed (+ crown the winner)
  const expired = await db.contest.findMany({
    where: { status: 'voting', votingEndsAt: { lte: now } },
    include: {
      entries: { orderBy: [{ votesCount: 'desc' }, { createdAt: 'asc' }], take: 1 },
    },
  })

  for (const contest of expired) {
    const top = contest.entries[0]
    await db.contest.update({
      where: { id: contest.id },
      data: { status: 'completed', winnerUserId: top?.userId ?? null },
    })
    if (top) {
      await notify({
        userId: top.userId,
        type: 'contest_win',
        text: `You won "${contest.title}"! Prize: ${contest.prize ?? 'glory'}`,
        targetType: 'contest',
        targetId: contest.id,
      })
    }
  }
}

export function contestPhase(c: {
  status: string
  startsAt: Date
  endsAt: Date
  votingEndsAt: Date
}): 'upcoming' | 'active' | 'voting' | 'completed' {
  const now = Date.now()
  if (c.status === 'completed') return 'completed'
  if (c.status === 'upcoming' || c.startsAt.getTime() > now) return 'upcoming'
  if (c.status === 'voting' || (c.endsAt.getTime() <= now && c.votingEndsAt.getTime() > now))
    return 'voting'
  if (c.votingEndsAt.getTime() <= now) return 'completed'
  return 'active'
}
