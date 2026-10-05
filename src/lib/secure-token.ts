import { createHash, randomBytes } from 'crypto'

// =====================================================================
// Single-use account-recovery tokens (password reset / email verify).
// Raw token (32 url-safe bytes) only ever exists inside the link the
// user receives; the DB stores sha256(raw) so a DB leak cannot be
// replayed against the endpoint. Tokens expire and burn on use.
// =====================================================================

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function createRawToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}
