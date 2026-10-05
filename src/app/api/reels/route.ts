import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { clampInt, fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 4

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  const url = new URL(req.url)
  const cursor = clampInt(url.searchParams.get('cursor'), 0, Number.MAX_SAFE_INTEGER, 0)
  const limit = clampInt(url.searchParams.get('limit'), 1, 10, PAGE_SIZE)

  const reels = await db.reel.findMany({
    where: { status: 'active' },
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true,
          avatarUrl: true, isVerified: true, isPro: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  let likedIds: number[] = []
  if (user && reels.length) {
    const likes = await db.reelLike.findMany({
      where: { userId: user.id, reelId: { in: reels.map((r) => r.id) } },
      select: { reelId: true },
    })
    likedIds = likes.map((l) => l.reelId)
  }

  return NextResponse.json({
    ok: true,
    reels: reels.map((r) => ({
      id: r.id,
      caption: r.caption,
      mediaUrl: r.mediaUrl,
      mediaType: r.mediaType,
      posterUrl: r.posterUrl,
      soundLabel: r.soundLabel,
      viewsCount: r.viewsCount,
      likesCount: r.likesCount,
      createdAt: r.createdAt,
      user: r.user,
      likedByMe: likedIds.includes(r.id),
    })),
    nextCursor: reels.length === limit ? reels[reels.length - 1].id : null,
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const body = await readJson<{
      caption?: string
      mediaUrl?: string
      mediaType?: string
      soundLabel?: string
    }>(req)

    const caption = sanitizeText(body.caption, 300)
    const mediaUrl = sanitizeText(body.mediaUrl, 500)
    const mediaType = body.mediaType === 'image' ? 'image' : 'video'
    const soundLabel = sanitizeText(body.soundLabel, 80) || null

    if (!mediaUrl) return fail('A video or image is required')
    if (!mediaUrl.startsWith('/uploads/reels/')) return fail('Invalid media URL')

    const reel = await db.reel.create({
      data: {
        userId: user.id,
        caption: caption || null,
        mediaUrl,
        mediaType,
        soundLabel,
      },
      include: {
        user: {
          select: {
            id: true, username: true, firstName: true,
            avatarUrl: true, isVerified: true, isPro: true,
          },
        },
      },
    })

    // Social proof: tell followers about the new reel
    const followers = await db.follow.findMany({
      where: { followingId: user.id },
      select: { followerId: true },
      take: 25,
    })
    await Promise.all(
      followers.map((f) =>
        notify({
          userId: f.followerId,
          actorId: user.id,
          type: 'system',
          text: `${user.firstName ?? user.username} posted a new reel`,
          targetType: 'reel',
          targetId: reel.id,
        })
      )
    )

    return ok({
      reel: {
        ...reel,
        viewsCount: 0,
        likedByMe: false,
      },
    })
  })
}
