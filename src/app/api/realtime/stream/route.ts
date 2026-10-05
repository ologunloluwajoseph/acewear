import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { subscribeToUser } from '@/lib/events'

// =====================================================================
// Deliverable 2 (Node.js edition): SSE Realtime Notifications Stream
// ---------------------------------------------------------------------
// GET /api/realtime/stream — one persistent Server-Sent Events channel
// per authenticated user. Replaces NotificationController::stream +
// MessageController::stream from the PHP app.
//
// Features kept from the PHP implementation:
//   - heartbeats every 25s (defeats proxy idle timeouts)
//   - clean teardown on client disconnect (req.signal abort)
//   - per-user channels (no cross-user leakage)
//   - JSON frames: { type, payload, ...meta }
// =====================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 25_000

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) {
    return new Response('Authentication required', { status: 401 })
  }

  const encoder = new TextEncoder()
  const channel = `ace:user:${user.id}`

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let active = true

      const send = (raw: string) => {
        if (!active) return
        try {
          controller.enqueue(encoder.encode(`data: ${raw}\n\n`))
        } catch {
          active = false
        }
      }

      // Initial hello — client treats this as "connected"
      send(JSON.stringify({ type: 'connected', userId: user.id }))

      // Subscribe to this user's channel on the global event bus
      const unsubscribe = subscribeToUser(user.id, (raw: string) => send(raw))

      // Heartbeat as SSE comment line (keeps intermediaries happy,
      // lets EventSource detect dead connections)
      const heartbeat = setInterval(() => {
        if (!active) return
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`))
        } catch {
          active = false
        }
      }, HEARTBEAT_MS)

      // Hard rotation like the PHP stream (240s) — clients auto-reconnect
      const rotate = setTimeout(() => {
        cleanup()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }, 240_000)

      const cleanup = () => {
        if (!active) return
        active = false
        clearInterval(heartbeat)
        clearTimeout(rotate)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
