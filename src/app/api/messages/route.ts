import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { publishToUser } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/messages — conversation list w/ counterpart + last message
export async function GET(req: NextRequest) {
  return handle(req, async (user) => {
    const conversations = await db.conversation.findMany({
      where: { OR: [{ user1Id: user.id }, { user2Id: user.id }] },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        user1: { select: { id: true, username: true, firstName: true, avatarUrl: true, isVerified: true } },
        user2: { select: { id: true, username: true, firstName: true, avatarUrl: true, isVerified: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: {
            messages: {
              where: { isRead: false, NOT: { senderId: user.id } },
            },
          },
        },
      },
      take: 50,
    })

    return ok({
      conversations: conversations.map((c) => {
        const other = c.user1Id === user.id ? c.user2 : c.user1
        const last = c.messages[0]
        return {
          id: c.id,
          other,
          lastMessage: last
            ? { body: last.body, senderId: last.senderId, createdAt: last.createdAt, isRead: last.isRead }
            : null,
          unreadCount: c._count.messages,
        }
      }),
    })
  })
}

// POST /api/messages — start/get a conversation with { userId }
export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const { userId } = await readJson<{ userId?: number }>(req)
    const otherId = Number(userId)
    if (!Number.isInteger(otherId) || otherId === user.id) {
      return fail('Invalid conversation target')
    }
    const other = await db.user.findUnique({ where: { id: otherId } })
    if (!other) return fail('User not found', 404)

    // Task 23: blocks cut DMs in both directions
    const block = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: otherId },
          { blockerId: otherId, blockedId: user.id },
        ],
      },
      select: { id: true },
    })
    if (block) return fail('Messaging is unavailable between these accounts', 403)

    const [a, b] = [user.id, otherId].sort((x, y) => x - y)
    let conversation = await db.conversation.findUnique({
      where: { user1Id_user2Id: { user1Id: a, user2Id: b } },
    })
    if (!conversation) {
      conversation = await db.conversation.create({
        data: { user1Id: a, user2Id: b },
      })
    }
    return ok({ conversationId: conversation.id })
  })
}
