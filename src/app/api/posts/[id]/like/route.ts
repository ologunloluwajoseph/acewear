import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'

// POST /api/posts/:id/like — heart reaction (mutually exclusive with dislike)
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
      select: { id: true, userId: true, status: true },
    })
    if (!post || post.status !== 'active') return fail('Post not found', 404)

    const existing = await db.like.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    })

    if (existing) {
      await db.like.delete({ where: { id: existing.id } })
      const likesCount = await db.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      })
      return ok({ liked: false, likesCount: likesCount.likesCount })
    }

    await db.like.create({ data: { postId, userId: user.id } })

    // A heart replaces a broken heart — you can't feel both at once
    const removedDislike = await db.dislike.deleteMany({ where: { postId, userId: user.id } })
    const updated = await db.post.update({
      where: { id: postId },
      data: {
        likesCount: { increment: 1 },
        ...(removedDislike.count > 0 ? { dislikesCount: { decrement: removedDislike.count } } : {}),
      },
      select: { likesCount: true, dislikesCount: true },
    })
    await notify({
      userId: post.userId,
      actorId: user.id,
      type: 'like',
      text: `${user.firstName ?? user.username} liked your post`,
      targetType: 'post',
      targetId: postId,
    })
    return ok({
      liked: true,
      likesCount: updated.likesCount,
      disliked: false,
      dislikesCount: updated.dislikesCount,
    })
  })
}
