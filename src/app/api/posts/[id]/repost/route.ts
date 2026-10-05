import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'

const userBriefSelect = {
  id: true, username: true, firstName: true,
  avatarUrl: true, isVerified: true, isPro: true,
} as const

// POST /api/posts/:id/repost — share someone else's post to your own feed,
// with an optional comment. Creates a new Post referencing the original.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const postId = parseInt(id, 10)
    if (Number.isNaN(postId)) return fail('Invalid post id')

    const body = await readJson<{ comment?: string }>(req)
    const comment = sanitizeText(body.comment, 500)

    const original = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, status: true, originalPostId: true },
    })
    if (!original || original.status !== 'active') return fail('Post not found', 404)
    if (original.originalPostId) return fail('Repost the original post instead')
    if (!comment && original.userId === user.id) {
      return fail('Add a comment when sharing your own post')
    }

    const [repost] = await db.$transaction([
      db.post.create({
        data: {
          userId: user.id,
          body: comment || null,
          mediaType: 'text',
          category: 'other',
          originalPostId: original.id,
        },
        include: {
          user: { select: userBriefSelect },
          tags: { select: { user: { select: userBriefSelect } } },
          originalPost: { include: { user: { select: userBriefSelect } } },
        },
      }),
      db.post.update({
        where: { id: original.id },
        data: { resharesCount: { increment: 1 } },
      }),
    ])

    await notify({
      userId: original.userId,
      actorId: user.id,
      type: 'system',
      text: `${user.firstName ?? user.username} reshared your post`,
      targetType: 'post',
      targetId: original.id,
    })

    return ok({
      post: {
        ...repost,
        dislikesCount: 0,
        resharesCount: 0,
        commentsCount: 0,
        likedByMe: false,
        dislikedByMe: false,
        resharedByMe: false,
        votedByMe: false,
        tagged: [],
        originalPost:
          repost.originalPost && repost.originalPost.status === 'active'
            ? {
                id: repost.originalPost.id,
                body: repost.originalPost.body,
                mediaUrl: repost.originalPost.mediaUrl,
                mediaType: repost.originalPost.mediaType,
                createdAt: repost.originalPost.createdAt,
                user: repost.originalPost.user,
              }
            : null,
      },
    })
  })
}
