import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ ok: true, user: null })
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
  return NextResponse.json({
    ok: true,
    user,
    unreadNotifications,
    unreadMessages,
  })
}
