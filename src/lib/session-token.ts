'use client'

// =====================================================================
// Client-side session token fallback.
// ---------------------------------------------------------------------
// The primary credential is the httpOnly Partitioned cookie. This module
// adds a Bearer-token fallback for contexts where browsers block
// third-party cookies entirely (e.g. Safari ITP inside the preview
// iframe): login/register return the signed token, it is kept in
// localStorage, and a one-time fetch interceptor attaches it to every
// same-origin /api/ request.
//
// Storage-tiered persistence (fixes "sign in does nothing" in locked-down
// preview webviews): localStorage -> sessionStorage -> JS cookie ->
// in-memory. If every persistent tier is blocked the token still lives
// for the current page session, so signing in ALWAYS visibly works.
// =====================================================================

const TOKEN_KEY = 'ace_session_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

let memoryToken: string | null = null

function writeCookie(token: string) {
  try {
    document.cookie = `ace_client_token=${encodeURIComponent(
      token
    )}; path=/; max-age=${COOKIE_MAX_AGE}; secure; samesite=none`
  } catch {
    /* cookies blocked — other tiers still apply */
  }
}

function eraseCookie() {
  try {
    document.cookie = `ace_client_token=; path=/; max-age=0; secure; samesite=none`
  } catch {
    /* noop */
  }
}

export function getToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) return stored
  } catch {
    /* localStorage blocked */
  }
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY)
    if (stored) return stored
  } catch {
    /* sessionStorage blocked */
  }
  if (memoryToken) return memoryToken
  try {
    const match = document.cookie.match(/(?:^|;\s*)ace_client_token=([^;]*)/)
    if (match?.[1]) return decodeURIComponent(match[1])
  } catch {
    /* cookies inaccessible */
  }
  return null
}

export function setToken(token: string) {
  memoryToken = token // always — survives even fully-blocked storage
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* storage blocked */
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* storage blocked */
  }
  writeCookie(token)
}

export function clearToken() {
  memoryToken = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* noop */
  }
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* noop */
  }
  eraseCookie()
}

/** Append the token as a query param (EventSource cannot send headers). */
export function sseUrl(path: string): string {
  const token = getToken()
  if (!token) return path
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

let installed = false

/** Patch window.fetch once so /api/ requests carry the Bearer token. */
export function installFetchInterceptor() {
  if (installed || typeof window === 'undefined') return
  if (typeof window.fetch !== 'function') return
  installed = true

  const original = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.pathname
            : new URL(input.url).pathname

      if (url.startsWith('/api/')) {
        const token = getToken()
        if (token) {
          const headers = new Headers(
            init?.headers ??
              (input instanceof Request ? input.headers : undefined)
          )
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`)
          }
          return original(input, { ...init, headers })
        }
      }
    } catch {
      /* fall through to unmodified fetch */
    }
    return original(input, init)
  }
}
