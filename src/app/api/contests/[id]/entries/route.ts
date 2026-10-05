import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, readJson, sanitizeText } from '@/lib/api-helpers'
import { contestPhase } from '@/lib/contests'

export const runtime = 'nodejs'

// POST /api/contests/:id/entries — join the contest (gated by phase + cap)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const contestId = parseInt(id, 10)
    if (Number.isNaN(contestId)) return fail('Invalid contest id')

    const contest = await db.contest.findUnique({ where: { id: contestId } })
    if (!contest) return fail('Contest not found', 404)
    if (contestPhase(contest) !== 'active') {
      return fail('This contest is not accepting entries right now', 409)
    }

    const body = await readJson<{ caption?: string; imageUrl?: string }>(req)
    const caption = sanitizeText(body.caption, 300)
    const imageUrl = sanitizeText(body.imageUrl, 500)
    if (!caption || !imageUrl) return fail('Entries need a caption and a photo')
    if (!imageUrl.startsWith('/uploads/')) return fail('Invalid image URL')

    const existingCount = await db.contestEntry.count({
      where: { contestId, userId: user.id },
    })
    if (existingCount >= contest.maxEntriesPerUser) {
      return fail(`You already used your ${contest.maxEntriesPerUser} allowed entr${contest.maxEntriesPerUser > 1 ? 'ies' : 'y'}`, 409)
    }

    const entry = await db.contestEntry.create({
      data: { contestId, userId: user.id, caption, imageUrl },
      include: {
        user: {
          select: {
            id: true, username: true, firstName: true,
            avatarUrl: true, isVerified: true,
          },
        },
      },
    })
    return Response.json({
      ok: true,
      entry: { ...entry, votedByMe: false },
    })
  })
}
