import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, clampInt } from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =====================================================================
// Block list — shadow blocking between two accounts.
//   POST   /api/block { userId }    -> block someone
//   DELETE /api/block?userId=N      -> unblock
//   GET    /api/block               -> my blocked list (settings UI)
// Effects (enforced in feed / search / messages / profile):
//   - posts of either party are hidden from the other
//   - DMs between the two are refused in both directions
// =====================================================================

async function resolveTarget(userIdParam: string | null, meId: number) {
  const userId = clampInt(userIdParam, 1, Number.MAX_SAFE_INTEGER, 0)
  if (!userId) return { error: 'Invalid user id' as const }
  if (userId === meId) return { error: 'You cannot block yourself' as const }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, firstName: true },
  })
  if (!user) return { error: 'User not found' as const }
  return { user }
}

export async function POST(req: NextRequest) {
  return handle(req, async (me) => {
    const userIdParam = new URL(req.url).searchParams.get('userId')
    const body = await req.json().catch(() => ({}) as Record<string, unknown>)
    const target = await resolveTarget(
      userIdParam ?? String((body as { userId?: number }).userId ?? ''),
      me.id
    )
    if ('error' in target) return fail(target.error)
    if (target.user.username === 'demo') {
      // keep the shared demo account reachable for everyone
      return fail('The demo account cannot be blocked')
    }

    await db.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: target.user.id } },
      create: { blockerId: me.id, blockedId: target.user.id },
      update: {},
    })
    return ok({ blocked: true, user: target.user })
  })
}

export async function DELETE(req: NextRequest) {
  return handle(req, async (me) => {
    // accept the id as ?userId= or as a JSON body (the UI sends a body)
    const body = await req.json().catch(() => ({}) as Record<string, unknown>)
    const userIdParam =
      new URL(req.url).searchParams.get('userId') ?? String((body as { userId?: number }).userId ?? '')
    const userId = clampInt(userIdParam, 1, Number.MAX_SAFE_INTEGER, 0)
    if (!userId) return fail('Invalid user id')
    await db.block.deleteMany({ where: { blockerId: me.id, blockedId: userId } })
    return ok({ blocked: false })
  })
}

export async function GET(req: NextRequest) {
  return handle(req, async (me) => {
    const blocks = await db.block.findMany({
      where: { blockerId: me.id },
      select: {
        blocked: {
          select: { id: true, username: true, firstName: true, avatarUrl: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok({ blocks })
  })
}
