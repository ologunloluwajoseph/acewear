import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { clampInt, fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { publishToUser } from '@/lib/events'
import { notify } from '@/lib/notify'
import { canUsePremium } from '@/lib/theme'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/messages/:userId — full thread with that user + mark read
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handle(req, async (user) => {
    const { userId: uid } = await params
    const otherId = parseInt(uid, 10)
    if (Number.isNaN(otherId)) return fail('Invalid user id')

    const other = await db.user.findUnique({
      where: { id: otherId },
      select: {
        id: true, username: true, firstName: true,
        avatarUrl: true, isVerified: true,
      },
    })
    if (!other) return fail('User not found', 404)

    const [a, b] = [user.id, otherId].sort((x, y) => x - y)
    let conversation = await db.conversation.findUnique({
      where: { user1Id_user2Id: { user1Id: a, user2Id: b } },
    })

    const messages = conversation
      ? await db.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          take: 200,
        })
      : []

    // Mark their messages as read + tell them over SSE ("seen" receipt)
    if (conversation && messages.some((m) => !m.isRead && m.senderId !== user.id)) {
      await db.message.updateMany({
        where: {
          conversationId: conversation.id,
          isRead: false,
          NOT: { senderId: user.id },
        },
        data: { isRead: true },
      })
      publishToUser(otherId, {
        type: 'read',
        payload: { conversationId: conversation.id, readerId: user.id },
      })
    }

    return ok({ other, conversationId: conversation?.id ?? null, messages })
  })
}

// POST /api/messages/:userId — send a message (delivered over SSE instantly)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handle(req, async (user) => {
    const { userId: uid } = await params
    const otherId = parseInt(uid, 10)
    if (Number.isNaN(otherId) || otherId === user.id) return fail('Invalid recipient')

    const { body } = await readJson<{ body?: string }>(req)
    const text = sanitizeText(body, 2000)
    if (!text) return fail('Message cannot be empty')

    const other = await db.user.findUnique({
      where: { id: otherId },
      select: { id: true, username: true },
    })
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
    const conversation = await db.conversation.upsert({
      where: { user1Id_user2Id: { user1Id: a, user2Id: b } },
      update: { lastMessageAt: new Date() },
      create: { user1Id: a, user2Id: b },
    })

    const message = await db.message.create({
      data: { conversationId: conversation.id, senderId: user.id, body: text },
    })

    const payload = {
      type: 'message' as const,
      payload: {
        id: message.id,
        conversationId: conversation.id,
        senderId: user.id,
        senderUsername: user.username,
        senderFirstName: user.firstName,
        senderAvatar: user.avatarUrl,
        recipientId: otherId,
        body: message.body,
        createdAt: message.createdAt,
      },
    }

    // Push to recipient AND echo to sender's other devices
    publishToUser(otherId, payload)
    publishToUser(user.id, payload)

    // One notification per burst (dedupe: only if none unread in last minute)
    const recent = await db.notification.findFirst({
      where: {
        userId: otherId,
        actorId: user.id,
        type: 'message',
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    })
    if (!recent) {
      await notify({
        userId: otherId,
        actorId: user.id,
        type: 'message',
        text: `${user.firstName ?? user.username} sent you a message`,
        targetType: 'user',
        targetId: user.id,
      })
    }

    return ok({ message })
  })
}

// PUT /api/messages/:userId — typing indicator broadcast
// Body is optional: { draft: string } upgrades the ping into the Premium
// "live typing" stream — the in-progress text is relayed to the recipient
// over SSE so it appears faintly in their thread while being typed.
// Drafts are ephemeral by design: they never touch the database.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handle(req, async (user) => {
    const { userId: uid } = await params
    const otherId = parseInt(uid, 10)
    if (Number.isNaN(otherId)) return fail('Invalid recipient')

    const { draft } = await readJson<{ draft?: unknown }>(req)
    const hasDraft = typeof draft === 'string'
    const preview = hasDraft ? (draft as string).slice(0, 500) : ''

    // Premium gate: PRO, admin, or users inside their 3-day free trial
    if (hasDraft && !canUsePremium(user)) {
      return fail('Live typing is a Premium feature', 403)
    }

    // Classic "● ● ●" indicator (skipped on the empty-draft clear signal)
    if (!hasDraft || preview !== '') {
      publishToUser(otherId, {
        type: 'typing',
        payload: {
          fromUserId: user.id,
          fromUsername: user.username,
          fromFirstName: user.firstName,
        },
      })
    }

    if (hasDraft) {
      publishToUser(otherId, {
        type: 'live_typing',
        payload: {
          fromUserId: user.id,
          fromFirstName: user.firstName,
          draft: preview, // '' = clear the ghost bubble on the peer
        },
      })
    }

    return ok({ typed: true, live: hasDraft })
  })
}
