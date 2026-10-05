import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fail, readJson, sanitizeText } from '@/lib/api-helpers'
import { RESET_TOKEN_TTL_MS, createRawToken, hashToken } from '@/lib/secure-token'

export const runtime = 'nodejs'

// =====================================================================
// POST /api/auth/forgot-password { email }
// Creates a single-use reset token and returns the reset link.
// There is no mail provider wired in this deployment yet, so the link
// is returned in the response (dev-mode delivery) and the UI shows it
// with a copy button. Swap this for an email send when SMTP arrives.
// Enumeration-safe-ish: unknown emails get a generic ok too, just
// without a link.
// =====================================================================

export async function POST(req: NextRequest) {
  const body = await readJson<{ email?: string }>(req)
  const email = sanitizeText(body.email, 255).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail('Please provide a valid email address')
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, username: true },
  })

  let resetUrl: string | null = null
  if (user && !user.username.startsWith('banned_')) {
    const raw = createRawToken()
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })
    const origin = new URL(req.url).origin
    resetUrl = `${origin}/reset-password?token=${raw}`
  }

  const payload: Record<string, unknown> = {
    ok: true,
    message: resetUrl
      ? 'Reset link created — it is valid for 1 hour.'
      : 'If that email is registered, a reset link was created.',
  }
  if (resetUrl) payload.resetUrl = resetUrl

  const res = NextResponse.json(payload)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
