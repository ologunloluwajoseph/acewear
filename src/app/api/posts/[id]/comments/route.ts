import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const postId = parseInt(id, 10)
  if (Number.isNaN(postId)) return fail('Invalid post id')

  const comments = await db.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true,
          avatarUrl: true, isVerified: true,
        },
      },
    },
  })
  return NextResponse.json({ ok: true, comments })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(req, async (user) => {
    const { id } = await params
    const postId = parseInt(id, 10)
    if (Number.isNaN(postId)) return fail('Invalid post id')

    const { body } = await readJson<{ body?: string }>(req)
    const text = sanitizeText(body, 1000)
    if (!text) return fail('Comment cannot be empty')

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, status: true },
    })
    if (!post || post.status !== 'active') return fail('Post not found', 404)

    const comment = await db.comment.create({
      data: { postId, userId: user.id, body: text },
      include: {
        user: {
          select: {
            id: true, username: true, firstName: true,
            avatarUrl: true, isVerified: true,
          },
        },
      },
    })
    await db.post.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    })
    await notify({
      userId: post.userId,
      actorId: user.id,
      type: 'comment',
      text: `${user.firstName ?? user.username} commented on your post`,
      targetType: 'post',
      targetId: postId,
    })
    return ok({ comment })
  })
}
