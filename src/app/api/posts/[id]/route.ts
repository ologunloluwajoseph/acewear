import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const userBriefSelect = {
  id: true, username: true, firstName: true,
  avatarUrl: true, isVerified: true, isPro: true,
} as const

// GET /api/posts/:id — single post, same shape as feed items.
// Powers the deep-link landing: when someone opens a shared link
// (/?post=123) the feed pulls this post to the top and highlights it.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id: raw } = await params
    const id = parseInt(raw, 10)
    if (Number.isNaN(id)) return fail('Invalid post id')

    const p = await db.post.findFirst({
      where: { id, status: 'active' },
      include: {
        user: { select: userBriefSelect },
        contest: { select: { id: true, title: true, slug: true } },
        originalPost: {
          include: { user: { select: userBriefSelect } },
        },
        tags: { select: { user: { select: userBriefSelect } } },
        _count: { select: { comments: true } },
      },
    })
    if (!p) return fail('Post not found', 404)

    const [liked, disliked, voted, reshared] = await Promise.all([
      db.like.findUnique({ where: { postId_userId: { postId: id, userId: user.id } } }),
      db.dislike.findUnique({ where: { postId_userId: { postId: id, userId: user.id } } }),
      db.vote.findUnique({ where: { postId_userId: { postId: id, userId: user.id } } }),
      db.post.findFirst({
        where: { userId: user.id, originalPostId: id },
        select: { id: true },
      }),
    ])

    return ok({
      post: {
        id: p.id,
        body: p.body,
        mediaUrl: p.mediaUrl,
        mediaType: p.mediaType,
        category: p.category,
        likesCount: p.likesCount,
        dislikesCount: p.dislikesCount,
        resharesCount: p.resharesCount,
        commentsCount: p._count.comments,
        votesCount: p.votesCount,
        createdAt: p.createdAt,
        user: p.user,
        contest: p.contest,
        likedByMe: !!liked,
        dislikedByMe: !!disliked,
        resharedByMe: !!reshared,
        votedByMe: !!voted,
        tagged: p.tags.map((t) => t.user),
        originalPost:
          p.originalPost && p.originalPost.status === 'active'
            ? {
                id: p.originalPost.id,
                body: p.originalPost.body,
                mediaUrl: p.originalPost.mediaUrl,
                mediaType: p.originalPost.mediaType,
                createdAt: p.originalPost.createdAt,
                user: p.originalPost.user,
              }
            : null,
      },
    })
  })
}

// DELETE /api/posts/:id — hard delete for owner, soft-remove for admin
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const postId = parseInt(id, 10)
    if (Number.isNaN(postId)) return fail('Invalid post id')

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    })
    if (!post) return fail('Post not found', 404)

    if (post.userId === user.id) {
      await db.post.delete({ where: { id: postId } })
      return ok({ deleted: true })
    }
    if (user.isAdmin) {
      await db.post.update({
        where: { id: postId },
        data: { status: 'removed', removalReason: 'Removed by moderator' },
      })
      return ok({ removed: true })
    }
    return fail('You can only delete your own posts', 403)
  })
}
