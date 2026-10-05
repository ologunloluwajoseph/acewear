import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fail, handle, readJson, sanitizeText } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORY_LIFETIME_HOURS = 24

// GET /api/stories — active (non-expired) stories grouped by user
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  const stories = await db.story.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true,
          avatarUrl: true, isVerified: true,
        },
      },
      views: user
        ? { where: { userId: user.id }, select: { id: true } }
        : false,
    },
    take: 200,
  })

  type Group = {
    user: { id: number; username: string; firstName: string | null; avatarUrl: string | null; isVerified: boolean }
    stories: {
      id: number; mediaUrl: string | null; body: string | null
      backgroundColor: string; viewsCount: number
      viewedByMe: boolean; createdAt: Date; expiresAt: Date
    }[]
    allViewed: boolean
  }

  const groups = new Map<number, Group>()
  for (const s of stories) {
    let g = groups.get(s.user.id)
    if (!g) {
      g = { user: s.user, stories: [], allViewed: true }
      groups.set(s.user.id, g)
    }
    const viewedByMe = user ? (s.views as { id: number }[]).length > 0 : false
    if (!viewedByMe) g.allViewed = false
    g.stories.push({
      id: s.id,
      mediaUrl: s.mediaUrl,
      body: s.body,
      backgroundColor: s.backgroundColor,
      viewsCount: s.viewsCount,
      viewedByMe,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })
  }

  return NextResponse.json({
    ok: true,
    groups: Array.from(groups.values()),
  })
}

// POST /api/stories — create story (photo via WebP pipeline or colored text)
export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const body = await readJson<{
      mediaUrl?: string
      body?: string
      backgroundColor?: string
    }>(req)

    const mediaUrl = sanitizeText(body.mediaUrl, 500)
    const text = sanitizeText(body.body, 300)
    if (!mediaUrl && !text) return fail('Story needs an image or text')

    const story = await db.story.create({
      data: {
        userId: user.id,
        mediaUrl: mediaUrl && mediaUrl.startsWith('/uploads/') ? mediaUrl : null,
        body: text || null,
        backgroundColor: /^#[0-9a-fA-F]{6}$/.test(String(body.backgroundColor))
          ? String(body.backgroundColor)
          : '#f0b429',
        expiresAt: new Date(Date.now() + STORY_LIFETIME_HOURS * 3600 * 1000),
      },
    })
    return Response.json({ ok: true, story })
  })
}
