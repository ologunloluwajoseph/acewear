'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeEvent } from '@/lib/events'
import { sseUrl } from '@/lib/session-token'

// =====================================================================
// Deliverable 2 (Node.js edition): JS SSE listener
// ---------------------------------------------------------------------
// Client-side counterpart of /api/realtime/stream. Mirrors the PHP
// app's realtime.js policy:
//   - EventSource connects with cookies (same-origin)
//   - auto-reconnect with capped exponential backoff
//   - 3-strike fallback to /api/realtime/poll (badge sync every 5s)
//   - poll fallback recovers to SSE automatically once reachable
// =====================================================================

export function useRealtime(
  onEvent: (event: RealtimeEvent) => void,
  enabled: boolean = true
): { connected: boolean; mode: 'sse' | 'poll' | 'off' } {
  const handlerRef = useRef(onEvent)
  useEffect(() => {
    handlerRef.current = onEvent
  })

  const [connected, setConnected] = useState(false)
  const [liveMode, setLiveMode] = useState<'sse' | 'poll' | 'off'>('off')
  // derive "off" from enabled — avoids sync setState inside the effect
  const mode: 'sse' | 'poll' | 'off' = enabled ? liveMode : 'off'

  useEffect(() => {
    if (!enabled) return

    let es: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let failures = 0
    let disposed = false

    const startPolling = () => {
      if (pollTimer || disposed) return
      setLiveMode('poll')
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch('/api/realtime/poll', { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            handlerRef.current({
              type: 'unread',
              payload: {
                unreadNotifications: data.unreadNotifications,
                unreadMessages: data.unreadMessages,
              },
            })
          }
        } catch {
          /* still offline */
        }
      }, 5000)
    }

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
    }

    const connect = () => {
      if (disposed) return
      try {
        // ?token= fallback: EventSource cannot send Authorization headers,
        // and cookieless contexts (blocked third-party cookies) need it
        es = new EventSource(sseUrl('/api/realtime/stream'))
      } catch {
        startPolling()
        return
      }

      es.onopen = () => {
        failures = 0
        stopPolling()
        setConnected(true)
        setLiveMode('sse')
      }

      es.onmessage = (ev: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(ev.data) as RealtimeEvent
          handlerRef.current(parsed)
        } catch {
          /* ignore malformed frame */
        }
      }

      es.onerror = () => {
        setConnected(false)
        es?.close()
        es = null
        failures += 1
        if (failures >= 3) {
          // 3 strikes -> fall back to polling (like PHP realtime.js)
          startPolling()
          // probe every 30s to recover the SSE stream when possible
          reconnectTimer = setTimeout(connect, 30_000)
        } else {
          reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** failures, 15_000))
        }
      }
    }

    connect()

    return () => {
      disposed = true
      es?.close()
      stopPolling()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      setConnected(false)
    }
  }, [enabled])

  return { connected, mode }
}

// Convenience helper used by components
export async function triggerTyping(toUserId: number, draft?: string) {
  try {
    await fetch(`/api/messages/${toUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // draft === undefined -> classic typing ping;
      // string (incl. '') -> Premium live-draft broadcast ('' clears the ghost)
      body: draft === undefined ? undefined : JSON.stringify({ draft }),
    })
  } catch {
    /* best effort */
  }
}
