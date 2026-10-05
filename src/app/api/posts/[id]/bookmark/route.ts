import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

// POST /api/posts/[id]/bookmark — toggle bookmark (save/unsave)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const postId = parseInt((await params).id)
  if (isNaN(postId)) return NextResponse.json({ ok: false, error: 'Invalid post id' }, { status: 400 })

  const post = await db.post.findFirst({ where: { id: postId, status: 'active' } })
  if (!post) return NextResponse.json({ ok: false, error: 'Post not found' }, { status: 404 })

  const existing = await db.bookmark.findUnique({
    where: { postId_userId: { postId, userId: me.id } },
  })

  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } })
    return NextResponse.json({ ok: true, bookmarked: false })
  } else {
    await db.bookmark.create({ data: { postId, userId: me.id } })
    return NextResponse.json({ ok: true, bookmarked: true })
  }
}
