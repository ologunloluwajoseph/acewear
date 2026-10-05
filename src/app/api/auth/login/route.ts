import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSessionToken,
  publicUser,
  rateLimit,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { fail, readJson, sanitizeText } from '@/lib/api-helpers'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'

  // Bruteforce guard: 10 attempts / minute / IP (PHP had the same guard)
  if (!rateLimit(`login:${ip}`, 10, 60_000)) {
    return fail('Too many login attempts — try again in a minute', 429)
  }

  const body = await readJson<{ identifier?: string; password?: string }>(req)
  const identifier = sanitizeText(body.identifier, 255).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  if (!identifier || !password) {
    return fail('Username/email and password are required')
  }

  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  })

  // Constant-shape response to avoid user enumeration
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail('Invalid credentials', 401)
  }
  if (user.isBanned) {
    return fail('This account has been suspended', 403)
  }

  const token = createSessionToken(user.id, user.tokenVersion)
  const response = NextResponse.json({
    ok: true,
    token, // Bearer fallback for contexts that block cookies (iframe preview)
    user: publicUser(user), // full user so the client logs in without a second fetch
  })
  setSessionCookie(response, token)
  return response
}
