'use client'

import { create } from 'zustand'
import type { SessionUser } from '@/lib/auth'

export type AceView =
  | 'feed'
  | 'reels'
  | 'search'
  | 'contests'
  | 'shop'
  | 'messages'
  | 'notifications'
  | 'bookmarks'
  | 'profile'
  | 'dashboard'
  | 'settings'
  | 'premium'
  | 'themes'
  | 'admin'

export interface MessageToast {
  id: number
  title: string
  body: string
  avatarUrl?: string | null
}

interface AceState {
  me: SessionUser | null
  setMe: (u: SessionUser | null) => void
  refreshMe: () => Promise<void>

  view: AceView
  setView: (v: AceView) => void

  // Realtime counters (driven by SSE events)
  unreadNotifications: number
  unreadMessages: number
  setUnread: (n: { unreadNotifications?: number; unreadMessages?: number }) => void

  // Global chat trigger: when set, Messages view opens this user
  openChatUserId: number | null
  setOpenChatUserId: (id: number | null) => void

  // Live connection state
  live: boolean
  setLive: (v: boolean) => void

  // Toast queue for realtime events
  toasts: MessageToast[]
  pushToast: (t: Omit<MessageToast, 'id'>) => void
  dismissToast: (id: number) => void

  // Feed refresh trigger (SSE-driven)
  feedRefreshKey: number
  bumpFeedRefresh: () => void

  // Realtime listener registry — views subscribe to raw SSE events
  realtimeListeners: Set<(e: { type: string; payload?: unknown }) => void>
  emitRealtime: (e: { type: string; payload?: unknown }) => void
  addRealtimeListener: (fn: (e: { type: string; payload?: unknown }) => void) => () => void
}

export const useAppStore = create<AceState>((set, get) => ({
  me: null,
  setMe: (u) => set({ me: u }),
  refreshMe: async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await res.json()
      set({ me: data.user ?? null })
    } catch {
      /* offline — keep current state */
    }
  },

  view: 'feed',
  setView: (v) => set({ view: v }),

  unreadNotifications: 0,
  unreadMessages: 0,
  setUnread: (n) =>
    set((s) => ({
      unreadNotifications: n.unreadNotifications ?? s.unreadNotifications,
      unreadMessages: n.unreadMessages ?? s.unreadMessages,
    })),

  openChatUserId: null,
  setOpenChatUserId: (id) => set({ openChatUserId: id }),

  live: false,
  setLive: (v) => set({ live: v }),

  toasts: [],
  pushToast: (t) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, 5000)
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  feedRefreshKey: 0,
  bumpFeedRefresh: () =>
    set((s) => ({ feedRefreshKey: s.feedRefreshKey + 1 })),

  realtimeListeners: new Set(),
  emitRealtime: (e) => {
    get().realtimeListeners.forEach((fn) => {
      try {
        fn(e)
      } catch {
        /* listener error must not break the loop */
      }
    })
  },
  addRealtimeListener: (fn) => {
    const listeners = get().realtimeListeners
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}))
