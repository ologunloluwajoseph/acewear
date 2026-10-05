import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, sanitizeText } from '@/lib/api-helpers'
import { VERIFY_TOKEN_TTL_MS, createRawToken, hashToken } from '@/lib/secure-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =====================================================================
// GET  /api/auth/send-verification — my verification status (+ link in
//                                    dev-mode delivery, same as reset)
// POST /api/auth/send-verification — create a fresh verify token
// =====================================================================

export async function GET(req: NextRequest) {
  return handle(req, async (me) => {
    const user = await db.user.findUnique({
      where: { id: me.id },
      select: { email: true, emailVerified: true },
    })
    return ok({ email: user?.email, emailVerified: user?.emailVerified ?? false })
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (me) => {
    const user = await db.user.findUnique({
      where: { id: me.id },
      select: { email: true, emailVerified: true },
    })
    if (!user) return fail('Account not found', 404)
    if (user.emailVerified) return ok({ alreadyVerified: true, message: 'Email is already verified.' })

    const raw = createRawToken()
    await db.emailVerificationToken.create({
      data: {
        userId: me.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    })
    const origin = new URL(req.url).origin
    const verifyUrl = `${origin}/verify-email?token=${raw}`

    const res = NextResponse.json({
      ok: true,
      message: 'Verification link created — valid for 24 hours.',
      verifyUrl, // dev-mode delivery until an SMTP provider is wired
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  })
}

