import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fail } from '@/lib/api-helpers'
import { contestPhase, syncContestStatuses } from '@/lib/contests'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/contests/:id — detail incl. ranked entries
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await syncContestStatuses()
  const { id } = await params
  const contestId = parseInt(id, 10)
  if (Number.isNaN(contestId)) return fail('Invalid contest id')

  const user = await getSessionUser(req)
  const contest = await db.contest.findUnique({
    where: { id: contestId },
    include: {
      winner: {
        select: { id: true, username: true, firstName: true, avatarUrl: true },
      },
    },
  })
  if (!contest) return fail('Contest not found', 404)

  const entries = await db.contestEntry.findMany({
    where: { contestId },
    orderBy: [{ votesCount: 'desc' }, { createdAt: 'asc' }],
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true,
          avatarUrl: true, isVerified: true,
        },
      },
    },
  })

  const myVotes = user
    ? await db.contestVote.findMany({
        where: { userId: user.id, entry: { contestId } },
        select: { entryId: true },
      })
    : []

  return NextResponse.json({
    ok: true,
    contest: {
      ...contest,
      phase: contestPhase(contest),
    },
    entries: entries.map((e) => ({
      id: e.id,
      caption: e.caption,
      imageUrl: e.imageUrl,
      votesCount: e.votesCount,
      createdAt: e.createdAt,
      user: e.user,
      votedByMe: myVotes.some((v) => v.entryId === e.id),
    })),
  })
}
