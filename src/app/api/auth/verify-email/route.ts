import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fail, sanitizeText } from '@/lib/api-helpers'
import { hashToken } from '@/lib/secure-token'

export const runtime = 'nodejs'

// =====================================================================
// POST /api/auth/verify-email { token } — burn a verification token and
// flip User.emailVerified. Used by /verify-email page on landing.
// =====================================================================

export async function POST(req: NextRequest) {
  const body = await readJsonSafe(req)
  const raw = sanitizeText(body.token, 200)
  if (!raw) return fail('Verification token missing')

  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return fail('This verification link is invalid or has expired', 410)
  }

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  const res = NextResponse.json({ ok: true, message: 'Email verified — welcome to the deck!' })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

async function readJsonSafe(req: NextRequest): Promise<{ token?: string }> {
  try {
    return (await req.json()) as { token?: string }
  } catch {
    return {}
  }
}
