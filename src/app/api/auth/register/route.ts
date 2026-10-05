import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSessionToken,
  hashPassword,
  publicUser,
  setSessionCookie,
} from '@/lib/auth'
import { fail, readJson, sanitizeText } from '@/lib/api-helpers'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await readJson<{
    username?: string
    email?: string
    password?: string
    firstName?: string
  }>(req)

  const username = sanitizeText(body.username, 30).toLowerCase()
  const email = sanitizeText(body.email, 255).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return fail('Username must be 3-30 chars (letters, numbers, underscore)')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail('Please provide a valid email address')
  }
  if (password.length < 8) {
    return fail('Password must be at least 8 characters')
  }

  const existing = await db.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  })
  if (existing) {
    return fail(
      existing.username === username
        ? 'Username already taken'
        : 'Email already registered',
      409
    )
  }

  const user = await db.user.create({
    data: {
      username,
      email,
      passwordHash: hashPassword(password),
      firstName: sanitizeText(body.firstName, 60) || null,
      bio: 'New around here — dealing myself in.',
      aceCoins: 250,
    },
  })

  const token = createSessionToken(user.id, user.tokenVersion)
  const response = NextResponse.json({
    ok: true,
    token, // Bearer fallback for contexts that block cookies (iframe preview)
    user: publicUser(user), // full user so the client signs up without a second fetch
  })
  setSessionCookie(response, token)
  return response
}
