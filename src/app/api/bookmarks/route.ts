import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

// GET /api/bookmarks — return the current user's saved posts
export async function GET(req: NextRequest) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const bookmarks = await db.bookmark.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      post: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              avatarUrl: true,
              isVerified: true,
              isPro: true,
            },
          },
          likes: { where: { userId: me.id }, select: { id: true } },
          dislikes: { where: { userId: me.id }, select: { id: true } },
          tags: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  avatarUrl: true,
                  isVerified: true,
                  isPro: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const posts = bookmarks
    .filter((b) => b.post.status === 'active')
    .map((b) => ({
      ...b.post,
      likedByMe: b.post.likes.length > 0,
      dislikedByMe: b.post.dislikes.length > 0,
      resharedByMe: false,
      votedByMe: false,
      bookmarkedByMe: true,
      tagged: b.post.tags.map((t) => t.user),
      originalPost: null,
    }))

  return NextResponse.json({ ok: true, posts })
}
