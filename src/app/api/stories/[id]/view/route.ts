import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api-helpers'

export const runtime = 'nodejs'

// POST /api/stories/:id/view — record a story view (unique per user)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const storyId = parseInt(id, 10)
    if (Number.isNaN(storyId)) return fail('Invalid story id')

    const story = await db.story.findUnique({
      where: { id: storyId },
      select: { id: true, userId: true, expiresAt: true },
    })
    if (!story || story.expiresAt < new Date()) return fail('Story not found', 404)

    const created = await db.storyView
      .create({ data: { storyId, userId: user.id } })
      .catch(() => null) // already viewed -> unique constraint

    if (created) {
      await db.story.update({
        where: { id: storyId },
        data: { viewsCount: { increment: 1 } },
      })
    }
    return ok({ viewed: true })
  })
}
