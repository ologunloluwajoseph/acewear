import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, readJson } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/notifications — list + unread badge count
export async function GET(req: NextRequest) {
  return handle(req, async (user) => {
    const url = new URL(req.url)
    const onlyUnread = url.searchParams.get('unread') === '1'

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id, ...(onlyUnread ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          actor: {
            select: {
              id: true, username: true, firstName: true,
              avatarUrl: true, isVerified: true,
            },
          },
        },
      }),
      db.notification.count({ where: { userId: user.id, isRead: false } }),
    ])

    return ok({ notifications, unreadCount })
  })
}

// POST /api/notifications — mark { id? } or all as read
export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const { id, all } = await readJson<{ id?: number; all?: boolean }>(req)

    if (all || !id) {
      await db.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      })
    } else {
      await db.notification.updateMany({
        where: { id: Number(id), userId: user.id },
        data: { isRead: true },
      })
    }

    const unreadCount = await db.notification.count({
      where: { userId: user.id, isRead: false },
    })
    return ok({ unreadCount })
  })
}
