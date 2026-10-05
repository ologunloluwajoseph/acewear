import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, fail } from '@/lib/api-helpers'
import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Count a view (best-effort dedupe: one increment per user+reel per server session). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req)
  const { id } = await params
  const reelId = Number(id)
  if (!Number.isInteger(reelId)) return fail('Invalid reel id')

  if (user) {
    const store = globalThis as { __reelViews?: Set<string> }
    store.__reelViews ??= new Set<string>()
    const viewKey = `${user.id}:${reelId}`
    if (store.__reelViews.has(viewKey)) return ok({ counted: false })
    store.__reelViews.add(viewKey)
  }

  const reel = await db.reel.update({
    where: { id: reelId },
    data: { viewsCount: { increment: 1 } },
    select: { viewsCount: true },
  }).catch(() => null)

  return ok({ counted: true, viewsCount: reel?.viewsCount ?? null })
}
