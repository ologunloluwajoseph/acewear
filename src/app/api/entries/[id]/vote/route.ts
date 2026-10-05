import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'

// POST /api/entries/:id/vote — toggle vote (1 vote per user per entry)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const entryId = parseInt(id, 10)
    if (Number.isNaN(entryId)) return fail('Invalid entry id')

    const entry = await db.contestEntry.findUnique({
      where: { id: entryId },
      include: { contest: { select: { status: true, votingEndsAt: true } } },
    })
    if (!entry) return fail('Entry not found', 404)
    if (entry.contest.status === 'completed') {
      return fail('Voting has ended for this contest', 409)
    }

    const existing = await db.contestVote.findUnique({
      where: { entryId_userId: { entryId, userId: user.id } },
    })

    if (existing) {
      await db.contestVote.delete({ where: { id: existing.id } })
      const updated = await db.contestEntry.update({
        where: { id: entryId },
        data: { votesCount: { decrement: 1 } },
        select: { votesCount: true },
      })
      return ok({ voted: false, votesCount: updated.votesCount })
    }

    await db.contestVote.create({ data: { entryId, userId: user.id } })
    const updated = await db.contestEntry.update({
      where: { id: entryId },
      data: { votesCount: { increment: 1 } },
      select: { votesCount: true },
    })
    await notify({
      userId: entry.userId,
      actorId: user.id,
      type: 'vote',
      text: `${user.firstName ?? user.username} voted for your entry in "${entry.contest.title ?? 'a contest'}"`,
      targetType: 'entry',
      targetId: entryId,
    })
    return ok({ voted: true, votesCount: updated.votesCount })
  })
}
