/* =====================================================================
   ACE — Enhanced Service Worker (Node.js edition)
   ---------------------------------------------------------------------
   Port of public/sw.js from the PHP app, adapted for Next.js.

   Strategies:
   - App shell + static assets : stale-while-revalidate
   - Navigations               : network-first (4s timeout) -> cache ->
                                 offline.html
   - Uploaded media (/uploads) : cache-first with LRU trim (120 entries)
   - API calls (/api)          : network-only + offline JSON fallback
   ===================================================================== */

const VERSION = 'v4'
const SHELL_CACHE = `ace-shell-${VERSION}`
const STATIC_CACHE = `ace-static-${VERSION}`
const MEDIA_CACHE = `ace-media-${VERSION}`
const OFFLINE_URL = '/offline.html'

// Precache the minimal app shell
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

const MEDIA_LRU_LIMIT = 120

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
      // Take over immediately so offline works on second visit
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, STATIC_CACHE, MEDIA_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

// ---------------- LRU trim for the media cache ----------------
async function trimMediaCache() {
  const cache = await caches.open(MEDIA_CACHE)
  const keys = await cache.keys()
  if (keys.length <= MEDIA_LRU_LIMIT) return
  // Response headers carry an insertion timestamp for ordering
  const sorted = await Promise.all(
    keys.map(async (req) => {
      const res = await cache.match(req)
      const t = Number(res?.headers?.get('x-ace-cached-at') ?? 0)
      return { req, t }
    })
  )
  sorted.sort((a, b) => a.t - b.t)
  const excess = sorted.slice(0, sorted.length - MEDIA_LRU_LIMIT)
  await Promise.all(excess.map(({ req }) => cache.delete(req)))
}

function withTimestamp(response) {
  const headers = new Headers(response)
  headers.set('x-ace-cached-at', String(Date.now()))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// ---------------- fetch strategies ----------------
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)
  if (cached) {
    network.catch(() => null)
    return cached
  }
  const fresh = await network
  if (fresh) return fresh
  return new Response('Offline', { status: 503, statusText: 'Offline' })
}

async function cacheFirstMedia(request) {
  const cache = await caches.open(MEDIA_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    // 206 (streamed/range) responses must never go into the Cache API
    if (response && response.status === 200 && (response.ok || response.type === 'opaque')) {
      await cache.put(request, withTimestamp(response.clone()))
      // fire-and-forget LRU trim
      trimMediaCache().catch(() => null)
    }
    return response
  } catch (err) {
    return new Response('', { status: 504 })
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const preflight = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      ),
    ])
    if (preflight && preflight.ok) {
      cache.put(request, preflight.clone())
    }
    return preflight
  } catch {
    const cached = (await cache.match(request)) || (await cache.match('/'))
    if (cached) return cached
    return (
      (await caches.match(OFFLINE_URL)) ||
      new Response('<h1>Offline</h1>', {
        headers: { 'Content-Type': 'text/html' },
      })
    )
  }
}

function offlineJson() {
  return new Response(
    JSON.stringify({ ok: false, error: 'You are offline', offline: true }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // cross-origin: passthrough

  // 1. API — network-only, JSON offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(offlineJson))
    return
  }

  // 2. Uploaded media — cache-first with LRU
  if (url.pathname.startsWith('/uploads/')) {
    // Range requests (video streaming) bypass the SW so the browser's
    // native media stack handles seeking + partial content correctly.
    if (request.headers.has('range')) return
    event.respondWith(cacheFirstMedia(request))
    return
  }

  // 3. Next.js build assets + icons — stale-while-revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // 4. Navigations — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  // 5. Everything else same-origin — SWR on the shell cache
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE))
})

// Allow the page to trigger an immediate skipWaiting on upgrade
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
