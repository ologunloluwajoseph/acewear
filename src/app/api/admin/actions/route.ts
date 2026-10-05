import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handleAdmin, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'

// POST /api/admin/actions — moderation verbs
// { action: 'remove_post' | 'restore_post' | 'ban_user' | 'unban_user'
//   | 'verify_user' | 'announce', targetId, reason?, text? }
export async function POST(req: NextRequest) {
  return handleAdmin(req, async (admin) => {
    const body = await readJson<{
      action?: string
      targetId?: number
      reason?: string
      text?: string
    }>(req)

    const targetId = Number(body.targetId)

    switch (body.action) {
      case 'remove_post': {
        if (!Number.isInteger(targetId)) return fail('Invalid target')
        const post = await db.post.findUnique({ where: { id: targetId } })
        if (!post) return fail('Post not found', 404)
        await db.post.update({
          where: { id: targetId },
          data: {
            status: 'removed',
            removalReason: sanitizeText(body.reason, 200) || 'Removed by moderator',
          },
        })
        await notify({
          userId: post.userId,
          actorId: admin.id,
          type: 'system',
          text: 'One of your posts was removed by a moderator.',
        })
        return ok({ action: 'removed' })
      }

      case 'restore_post': {
        if (!Number.isInteger(targetId)) return fail('Invalid target')
        await db.post.update({
          where: { id: targetId },
          data: { status: 'active', removalReason: null },
        })
        return ok({ action: 'restored' })
      }

      case 'ban_user':
      case 'unban_user': {
        if (!Number.isInteger(targetId)) return fail('Invalid target')
        if (targetId === admin.id) return fail('You cannot ban yourself')
        const banned = body.action === 'ban_user'
        // Sessions are stateless signed cookies — the user simply fails
        // auth checks on next request because isBanned short-circuits them.
        await db.user.update({
          where: { id: targetId },
          data: { isBanned: banned },
        })
        return ok({ action: banned ? 'banned' : 'unbanned' })
      }

      case 'verify_user': {
        if (!Number.isInteger(targetId)) return fail('Invalid target')
        const target = await db.user.findUnique({ where: { id: targetId } })
        if (!target) return fail('User not found', 404)
        await db.user.update({
          where: { id: targetId },
          data: { isVerified: !target.isVerified },
        })
        await notify({
          userId: targetId,
          actorId: admin.id,
          type: 'system',
          text: target.isVerified
            ? 'Your verified badge was removed.'
            : 'You are now verified. Welcome to the ACE verified club!',
        })
        return ok({ action: target.isVerified ? 'unverified' : 'verified' })
      }

      case 'announce': {
        const text = sanitizeText(body.text, 255)
        if (!text) return fail('Announcement text required')
        const users = await db.user.findMany({
          where: { isBanned: false },
          select: { id: true },
          take: 500,
        })
        await Promise.all(
          users.map((u) =>
            notify({ userId: u.id, actorId: admin.id, type: 'system', text })
          )
        )
        return ok({ action: 'announced', delivered: users.length })
      }

      default:
        return fail('Unknown action')
    }
  })
}
