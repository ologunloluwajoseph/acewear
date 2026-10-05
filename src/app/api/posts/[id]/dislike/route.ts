import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api-helpers'

export const runtime = 'nodejs'

// POST /api/posts/:id/dislike — broken-heart reaction (mutually exclusive with like)
// Deliberately does NOT notify the author — dislikes are private feedback.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const postId = parseInt(id, 10)
    if (Number.isNaN(postId)) return fail('Invalid post id')

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    })
    if (!post || post.status !== 'active') return fail('Post not found', 404)

    const existing = await db.dislike.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    })

    if (existing) {
      await db.dislike.delete({ where: { id: existing.id } })
      const dislikesCount = await db.post.update({
        where: { id: postId },
        data: { dislikesCount: { decrement: 1 } },
        select: { dislikesCount: true },
      })
      return ok({ disliked: false, dislikesCount: dislikesCount.dislikesCount })
    }

    await db.dislike.create({ data: { postId, userId: user.id } })

    // A broken heart replaces the heart
    const removedLike = await db.like.deleteMany({ where: { postId, userId: user.id } })
    const updated = await db.post.update({
      where: { id: postId },
      data: {
        dislikesCount: { increment: 1 },
        ...(removedLike.count > 0 ? { likesCount: { decrement: removedLike.count } } : {}),
      },
      select: { likesCount: true, dislikesCount: true },
    })
    return ok({
      disliked: true,
      dislikesCount: updated.dislikesCount,
      liked: false,
      likesCount: updated.likesCount,
    })
  })
}
