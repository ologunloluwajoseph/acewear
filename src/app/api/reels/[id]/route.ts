import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, fail } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Soft-remove a reel (author or admin only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const reelId = Number(id)
    if (!Number.isInteger(reelId)) return fail('Invalid reel id')

    const reel = await db.reel.findUnique({ where: { id: reelId } })
    if (!reel) return fail('Reel not found', 404)
    if (reel.userId !== user.id && !user.isAdmin) return fail('Not allowed', 403)

    await db.reel.update({
      where: { id: reelId },
      data: { status: 'removed' },
    })
    return ok({ deleted: true })
  })
}
