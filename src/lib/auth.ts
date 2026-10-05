import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// =====================================================================
// Authentication (Node.js edition of AuthController + sessions table)
// ---------------------------------------------------------------------
// - Passwords: scrypt (N=16384) with per-user random salt, timing-safe
//   comparison — replaces PHP password_hash/password_verify (bcrypt).
// - Sessions: stateless HMAC-SHA256 signed tokens delivered via (1) an
//   httpOnly SameSite=None; Secure; Partitioned cookie AND (2) a Bearer
//   token fallback. The Partitioned (CHIPS) cookie keeps the session alive
//   inside cross-site iframe previews where Lax cookies are dropped; the
//   Bearer fallback covers browsers that block third-party cookies entirely
//   (both replace the `sessions` DB table + PHPSESSID).
// =====================================================================

const SESSION_COOKIE = 'ace_session'
// JS-written backup cookie (non-httpOnly). Some preview webviews strip
// Set-Cookie headers or block localStorage; a document.cookie token gives
// those clients one more way to keep the session across navigations.
const CLIENT_TOKEN_COOKIE = 'ace_client_token'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const SECRET =
  process.env.AUTH_SECRET ?? 'ace-dev-secret-change-me-in-production-2026'

export type SessionUser = {
  id: number
  username: string
  email: string
  firstName: string | null
  bio: string | null
  avatarUrl: string | null
  coverUrl: string | null
  isAdmin: boolean
  isVerified: boolean
  isPro: boolean
  proPlan?: string | null
  proUntil?: Date | string | null
  aceCoins: number
  trustScore: number
  streakCount: number
  createdAt: Date
}

// ---------- password hashing ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split('$')
    if (scheme !== 'scrypt' || !salt || !hash) return false
    const candidate = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    })
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length &&
      crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

// ---------- signed session tokens ----------

interface TokenPayload {
  uid: number
  exp: number
  tv?: number // tokenVersion — bumped on password change to kill old sessions
}

export function createSessionToken(
  userId: number,
  tokenVersion = 0
): string {
  const payload: TokenPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    tv: tokenVersion,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(body)
    .digest('base64url')
  return `${body}.${sig}`
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(body)
      .digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString()
    ) as TokenPayload
    if (!payload.uid || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/**
 * Shape a full Prisma user row into the public SessionUser payload
 * (identical to what GET /api/auth/me returns) so login/register can
 * hand the client the complete user object in one round-trip.
 */
export function publicUser(user: {
  id: number
  username: string
  email: string
  firstName: string | null
  bio: string | null
  avatarUrl: string | null
  coverUrl: string | null
  isAdmin: boolean
  isVerified: boolean
  isPro: boolean
  proPlan?: string | null
  proUntil?: Date | string | null
  aceCoins: number
  trustScore: number
  streakCount: number
  createdAt: Date
}): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    isAdmin: user.isAdmin,
    isVerified: user.isVerified,
    isPro: user.isPro,
    proPlan: user.proPlan ?? null,
    proUntil: user.proUntil ?? null,
    aceCoins: user.aceCoins,
    trustScore: user.trustScore,
    streakCount: user.streakCount,
    createdAt: user.createdAt,
  }
}

// ---------- request helpers ----------

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // SameSite=None + Secure + Partitioned (CHIPS): survives cross-site
    // iframe embedding (preview panes). Browsers ignore unknown/unsupported
    // attributes, and localhost is treated as trustworthy so `secure` is
    // also accepted in local dev.
    sameSite: 'none',
    secure: true,
    partitioned: true,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    partitioned: true,
    path: '/',
    maxAge: 0,
  })
}

/**
 * Resolve the authenticated user from the request, or null.
 * Credential sources, in order: session cookie -> Authorization: Bearer
 * header (fetch fallback) -> ?token= query param (EventSource cannot send
 * headers). Only one HMAC-verified session token shape is accepted, so all
 * three paths share the same signing secret and TTL.
 */
export async function getSessionUser(
  req: NextRequest
): Promise<SessionUser | null> {
  const bearer = req.headers.get('authorization')
  const token =
    req.cookies.get(SESSION_COOKIE)?.value ??
    req.cookies.get(CLIENT_TOKEN_COOKIE)?.value ??
    (bearer && /^bearer /i.test(bearer) ? bearer.slice(7).trim() : undefined) ??
    req.nextUrl?.searchParams?.get('token') ??
    undefined
  if (!token) return null
  const payload = verifySessionToken(token)
  if (!payload) return null
  const user = await db.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      isAdmin: true,
      isVerified: true,
      isPro: true,
      proPlan: true,
      proUntil: true,
      isBanned: true,
      aceCoins: true,
      trustScore: true,
      streakCount: true,
      createdAt: true,
      tokenVersion: true,
    },
  })
  if (!user || user.isBanned) return null
  // Password-change invalidation: tokens issued before the bump are rejected
  if ((payload.tv ?? 0) !== user.tokenVersion) return null
  const { isBanned: _banned, tokenVersion: _tv, ...safe } = user
  return safe
}

/** Throwing variant for protected routes. */
export async function requireUser(req: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(req)
  if (!user) throw new AuthError()
  return user
}

/** Throwing variant that additionally demands admin rights. */
export async function requireAdmin(req: NextRequest): Promise<SessionUser> {
  const user = await requireUser(req)
  if (!user.isAdmin) throw new ForbiddenError()
  return user
}

export class AuthError extends Error {}
export class ForbiddenError extends Error {}

// ---------- naive in-memory rate limiter (login bruteforce guard) ----------

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count += 1
  return b.count <= limit
}
