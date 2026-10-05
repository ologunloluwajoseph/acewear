import { EventEmitter } from 'events'

// =====================================================================
// SSE Realtime Event Bus (in-process pub/sub)
// ---------------------------------------------------------------------
// Node.js edition of the PHP SSE controllers (NotificationController::stream
// / MessageController::stream). Controllers publish user-scoped events on
// this bus; /api/realtime/stream subscribes each connected EventSource to
// its own user channel and forwards frames as `data: {...}\n\n`.
// Stored on globalThis so Next.js dev-mode module reloads reuse one bus.
// =====================================================================

export interface RealtimeEvent {
  type:
    | 'connected'
    | 'notification'
    | 'message'
    | 'typing'
    | 'live_typing'
    | 'read'
    | 'unread'
    | 'heartbeat'
  payload?: unknown
  [key: string]: unknown
}

const globalForBus = globalThis as unknown as {
  aceBus: EventEmitter | undefined
}

export const bus: EventEmitter =
  globalForBus.aceBus ?? (() => {
    const b = new EventEmitter()
    b.setMaxListeners(0) // unlimited SSE clients
    return b
  })()

globalForBus.aceBus = bus

const userChannel = (userId: number) => `ace:user:${userId}`

/** Publish an event to exactly one user's SSE channel. */
export function publishToUser(userId: number, event: RealtimeEvent) {
  bus.emit(userChannel(userId), JSON.stringify(event))
}

/** Subscribe a handler to one user's SSE channel; returns unsubscribe fn. */
export function subscribeToUser(
  userId: number,
  handler: (raw: string) => void
): () => void {
  const channel = userChannel(userId)
  bus.on(channel, handler)
  return () => bus.off(channel, handler)
}
