import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, readJson } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'

// POST /api/follow — toggle follow { userId }
export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const { userId } = await readJson<{ userId?: number }>(req)
    const targetId = Number(userId)
    if (!Number.isInteger(targetId) || targetId === user.id) {
      return fail('Invalid follow target')
    }
    const target = await db.user.findUnique({ where: { id: targetId } })
    if (!target) return fail('User not found', 404)

    const existing = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: user.id, followingId: targetId } },
    })

    if (existing) {
      await db.follow.delete({ where: { id: existing.id } })
      return ok({ following: false })
    }

    await db.follow.create({
      data: { followerId: user.id, followingId: targetId },
    })
    await notify({
      userId: targetId,
      actorId: user.id,
      type: 'follow',
      text: `${user.firstName ?? user.username} started following you`,
      targetType: 'user',
      targetId: user.id,
    })
    return ok({ following: true })
  })
}
