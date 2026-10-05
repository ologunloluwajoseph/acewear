import { NextRequest, NextResponse } from 'next/server'
import { ForbiddenError, SessionUser, getSessionUser } from '@/lib/auth'

export function ok<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init)
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status })
}

/**
 * Wrap an authenticated route handler with uniform auth + error mapping.
 * Usage:
 *   export const GET = (req: NextRequest) =>
 *     handle(req, async (user) => ok({ data: user.username }))
 */
export async function handle(
  req: NextRequest,
  fn: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await getSessionUser(req)
    if (!user) return fail('Authentication required', 401)
    return await fn(user)
  } catch (e) {
    if (e instanceof ForbiddenError) return fail('Admin access required', 403)
    console.error('[api]', e)
    return fail('Internal server error', 500)
  }
}

/** Wrap an admin-only route handler. */
export async function handleAdmin(
  req: NextRequest,
  fn: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return handle(req, async (user) => {
    if (!user.isAdmin) return fail('Admin access required', 403)
    return fn(user)
  })
}

export async function readJson<T = Record<string, unknown>>(
  req: NextRequest
): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    return {} as T
  }
}

export function sanitizeText(input: unknown, maxLen = 5000): string {
  if (typeof input !== 'string') return ''
  return input.replace(/\u0000/g, '').trim().slice(0, maxLen)
}

export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n =
    typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
