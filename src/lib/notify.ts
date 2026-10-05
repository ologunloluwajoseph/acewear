import { db } from '@/lib/db'
import { publishToUser } from '@/lib/events'

// =====================================================================
// Notification service — Node.js edition of NotificationController
// Creates the DB row, then pushes it over SSE in the same tick so the
// client badge updates in real time (no polling, no page refresh).
// =====================================================================

type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'vote'
  | 'message'
  | 'system'
  | 'contest_win'
  | 'purchase'
  | 'review'

export async function notify(opts: {
  userId: number
  actorId?: number | null
  type: NotificationType
  text: string
  targetType?: string
  targetId?: number
  link?: string
}) {
  // Never notify yourself (matches social convention of the PHP app)
  if (opts.actorId && opts.actorId === opts.userId) return null

  const notification = await db.notification.create({
    data: {
      userId: opts.userId,
      actorId: opts.actorId ?? null,
      type: opts.type,
      text: opts.text.slice(0, 255),
      targetType: opts.targetType,
      targetId: opts.targetId,
      link: opts.link,
    },
    include: {
      actor: {
        select: { id: true, username: true, firstName: true, avatarUrl: true, isVerified: true },
      },
    },
  })

  const unreadCount = await db.notification.count({
    where: { userId: opts.userId, isRead: false },
  })

  publishToUser(opts.userId, {
    type: 'notification',
    payload: notification,
    unreadCount,
  })

  return notification
}
