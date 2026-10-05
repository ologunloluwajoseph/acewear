import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fail, handleAdmin, readJson, sanitizeText } from '@/lib/api-helpers'
import { contestPhase, syncContestStatuses } from '@/lib/contests'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/contests — list with lazy lifecycle sync
export async function GET(req: NextRequest) {
  await syncContestStatuses()
  const user = await getSessionUser(req)

  const contests = await db.contest.findMany({
    orderBy: [{ status: 'asc' }, { endsAt: 'desc' }],
    include: {
      entries: { select: { votesCount: true, userId: true } },
      winner: { select: { id: true, username: true, firstName: true, avatarUrl: true } },
      _count: { select: { entries: true } },
    },
    take: 50,
  })

  const myEntryContestIds = user
    ? (
        await db.contestEntry.findMany({
          where: { userId: user.id },
          select: { contestId: true },
        })
      ).map((e) => e.contestId)
    : []

  return NextResponse.json({
    ok: true,
    contests: contests.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      category: c.category,
      coverUrl: c.coverUrl,
      prize: c.prize,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      votingEndsAt: c.votingEndsAt,
      tier: c.tier,
      entriesCount: c._count.entries,
      totalVotes: c.entries.reduce((sum, e) => sum + e.votesCount, 0),
      winner: c.winner,
      joinedByMe: myEntryContestIds.includes(c.id),
      phase: contestPhase(c),
    })),
  })
}

// POST /api/contests — admin creates a contest
export async function POST(req: NextRequest) {
  return handleAdmin(req, async (admin) => {
    const body = await readJson<{
      title?: string
      description?: string
      prize?: string
      category?: string
      coverUrl?: string
      durationHours?: number
      votingHours?: number
    }>(req)

    const title = sanitizeText(body.title, 120)
    if (!title) return fail('Contest needs a title')

    const durationHours = Math.min(24 * 30, Math.max(1, Number(body.durationHours) || 72))
    const votingHours = Math.min(24 * 7, Math.max(1, Number(body.votingHours) || 24))
    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + durationHours * 3600 * 1000)

    const slugBase = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'contest'
    const slug = `${slugBase}-${Date.now().toString(36)}`

    const contest = await db.contest.create({
      data: {
        title,
        slug,
        description: sanitizeText(body.description, 2000) || null,
        prize: sanitizeText(body.prize, 120) || null,
        category: sanitizeText(body.category, 20) || 'other',
        coverUrl: sanitizeText(body.coverUrl, 500) || null,
        startsAt,
        endsAt,
        votingEndsAt: new Date(endsAt.getTime() + votingHours * 3600 * 1000),
        status: 'active',
        createdById: admin.id,
      },
    })
    return Response.json({ ok: true, contest })
  })
}
