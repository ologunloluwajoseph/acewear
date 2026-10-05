import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =====================================================================
// POST /api/report — flag a post / user / message for the moderators.
// One report per reporter per target (re-reporting refreshes reason).
// =====================================================================

const REASONS = ['spam', 'abuse', 'nsfw', 'scam', 'other'] as const

export async function POST(req: NextRequest) {
  return handle(req, async (me) => {
    const body = await readJson<{
      targetType?: string
      targetId?: number
      reason?: string
      details?: string
    }>(req)

    const targetType = String(body.targetType ?? '')
    const targetId = Number(body.targetId)
    const reason = String(body.reason ?? '')

    if (!['post', 'user', 'message'].includes(targetType)) {
      return fail('Invalid report target')
    }
    if (!Number.isInteger(targetId) || targetId < 1) {
      return fail('Invalid report target id')
    }
    if (!REASONS.includes(reason as (typeof REASONS)[number])) {
      return fail('Invalid report reason')
    }
    if (targetType === 'post') {
      const post = await db.post.findUnique({ where: { id: targetId }, select: { id: true } })
      if (!post) return fail('Post not found', 404)
    }
    if (targetType === 'user') {
      if (targetId === me.id) return fail('You cannot report yourself')
      const user = await db.user.findUnique({ where: { id: targetId }, select: { id: true } })
      if (!user) return fail('User not found', 404)
    }

    const details = sanitizeText(body.details, 500) || null

    const report = await db.report.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId: me.id,
          targetType,
          targetId,
        },
      },
      create: { reporterId: me.id, targetType, targetId, reason, details },
      update: { reason, details, status: 'open', resolvedAt: null, resolution: null },
      select: { id: true },
    })

    return ok({ report })
  })
}
