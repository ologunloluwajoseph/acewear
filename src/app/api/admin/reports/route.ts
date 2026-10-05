import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handleAdmin, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =====================================================================
// GET  /api/admin/reports        — moderation queue (open first)
// POST /api/admin/reports        — { reportId, action, reason? }
//   action: 'dismiss' | 'resolve' | 'remove_post'
// =====================================================================

const TARGET_SELECT = {
  id: true,
  username: true,
  firstName: true,
  avatarUrl: true,
  isBanned: true,
} as const

export async function GET(req: NextRequest) {
  return handleAdmin(req, async () => {
    const status = new URL(req.url).searchParams.get('status') ?? 'open'
    const reports = await db.report.findMany({
      where: status === 'all' ? {} : { status },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
        reporter: { select: TARGET_SELECT },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 60,
    })

    // hydrate a small preview of each reported target
    const enriched = await Promise.all(
      reports.map(async (r) => {
        if (r.targetType === 'post') {
          const post = await db.post.findUnique({
            where: { id: r.targetId },
            select: {
              id: true,
              body: true,
              mediaUrl: true,
              status: true,
              userId: true,
              user: { select: TARGET_SELECT },
            },
          })
          return { ...r, post }
        }
        if (r.targetType === 'user') {
          const user = await db.user.findUnique({
            where: { id: r.targetId },
            select: TARGET_SELECT,
          })
          return { ...r, user }
        }
        return { ...r }
      })
    )

    return ok({ reports: enriched })
  })
}

export async function POST(req: NextRequest) {
  return handleAdmin(req, async (admin) => {
    const body = await readJson<{ reportId?: number; action?: string; reason?: string }>(req)
    const reportId = Number(body.reportId)
    if (!Number.isInteger(reportId)) return fail('Invalid report id')

    const report = await db.report.findUnique({ where: { id: reportId } })
    if (!report) return fail('Report not found', 404)

    const action = String(body.action ?? '')
    const reason = sanitizeText(body.reason, 200) || 'Removed by a moderator'

    if (action === 'dismiss') {
      await db.report.update({
        where: { id: reportId },
        data: { status: 'dismissed', resolvedAt: new Date(), resolution: 'No action taken' },
      })
      return ok({ status: 'dismissed' })
    }

    if (action === 'remove_post' && report.targetType === 'post') {
      await db.post.update({
        where: { id: report.targetId },
        data: { status: 'removed', removalReason: reason },
      })
      await db.report.update({
        where: { id: reportId },
        data: { status: 'resolved', resolvedAt: new Date(), resolution: `Post removed — ${reason}` },
      })
      await notify({
        userId: (await db.post.findUnique({ where: { id: report.targetId }, select: { userId: true } }))?.userId ?? 0,
        actorId: admin.id,
        type: 'system',
        text: 'One of your posts was removed after a moderator review.',
      })
      return ok({ status: 'resolved' })
    }

    if (action === 'resolve') {
      await db.report.update({
        where: { id: reportId },
        data: { status: 'resolved', resolvedAt: new Date(), resolution: 'Reviewed by moderator' },
      })
      return ok({ status: 'resolved' })
    }

    return fail('Unknown action')
  })
}
