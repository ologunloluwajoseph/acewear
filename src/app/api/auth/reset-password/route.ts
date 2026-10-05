import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fail, readJson, sanitizeText } from '@/lib/api-helpers'
import { hashPassword } from '@/lib/auth'
import { hashToken } from '@/lib/secure-token'

export const runtime = 'nodejs'

// =====================================================================
// POST /api/auth/reset-password { token, password }
// Burns the single-use token, sets the new password and bumps
// tokenVersion so every existing session (other devices) dies.
// =====================================================================

export async function POST(req: NextRequest) {
  const body = await readJson<{ token?: string; password?: string }>(req)
  const raw = sanitizeText(body.token, 200)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!raw) return fail('Reset token missing')
  if (password.length < 8) return fail('Password must be at least 8 characters')

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return fail('This reset link is invalid or has expired', 410)
  }

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(password), tokenVersion: { increment: 1 } },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  const res = NextResponse.json({ ok: true, message: 'Password updated — sign in with your new password.' })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
