import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

// =====================================================================
// SSE fallback: /api/realtime/poll
// The client use-realtime hook falls back here after 3 failed SSE
// attempts (same 3-strike policy as the PHP realtime.js). Returns the
// authoritative unread counters so badges stay correct offline.
// =====================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) {
    return Response.json(
      { ok: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const [unreadNotifications, unreadMessages] = await Promise.all([
    db.notification.count({ where: { userId: user.id, isRead: false } }),
    db.message.count({
      where: {
        isRead: false,
        NOT: { senderId: user.id },
        conversation: { OR: [{ user1Id: user.id }, { user2Id: user.id }] },
      },
    }),
  ])

  return Response.json({ ok: true, unreadNotifications, unreadMessages })
}
