import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, fail } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const reelId = Number(id)
    if (!Number.isInteger(reelId)) return fail('Invalid reel id')

    const reel = await db.reel.findUnique({ where: { id: reelId } })
    if (!reel || reel.status !== 'active') return fail('Reel not found', 404)

    const existing = await db.reelLike.findUnique({
      where: { reelId_userId: { reelId, userId: user.id } },
    })

    if (existing) {
      await db.reelLike.delete({ where: { id: existing.id } })
      const likesCount = Math.max(0, reel.likesCount - 1)
      await db.reel.update({ where: { id: reelId }, data: { likesCount } })
      return ok({ liked: false, likesCount })
    }

    await db.reelLike.create({ data: { reelId, userId: user.id } })
    const likesCount = reel.likesCount + 1
    await db.reel.update({ where: { id: reelId }, data: { likesCount } })

    if (reel.userId !== user.id) {
      await notify({
        userId: reel.userId,
        actorId: user.id,
        type: 'like',
        text: `${user.firstName ?? user.username} liked your reel`,
        targetType: 'reel',
        targetId: reelId,
      })
    }

    return ok({ liked: true, likesCount })
  })
}
