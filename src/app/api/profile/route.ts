import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'

export const runtime = 'nodejs'

// PATCH /api/profile — update own profile (bio, names, media)
export async function PATCH(req: NextRequest) {
  return handle(req, async (user) => {
    const body = await readJson<{
      firstName?: string
      bio?: string
      avatarUrl?: string
      coverUrl?: string
    }>(req)

    const data: Record<string, string | null> = {}
    if (body.firstName !== undefined)
      data.firstName = sanitizeText(body.firstName, 60) || null
    if (body.bio !== undefined) data.bio = sanitizeText(body.bio, 300) || null
    if (body.avatarUrl && body.avatarUrl.startsWith('/uploads/'))
      data.avatarUrl = body.avatarUrl
    if (body.coverUrl && body.coverUrl.startsWith('/uploads/'))
      data.coverUrl = body.coverUrl

    const updated = await db.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true, username: true, firstName: true, bio: true,
        avatarUrl: true, coverUrl: true, isVerified: true, isPro: true,
      },
    })
    return ok({ user: updated })
  })
}
