'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Crown, Loader2, Send } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AceAvatar, timeAgo } from '@/components/ace/media'
import { triggerTyping } from '@/hooks/use-realtime'
import { canUsePremium } from '@/lib/theme'
import type { ConversationDTO, MessageDTO, RealtimeMessagePayload, UserBrief } from '@/lib/types'
import { useAppStore } from '@/lib/client-store'
import { cn } from '@/lib/utils'

export function MessagesView() {
  const me = useAppStore((s) => s.me)
  const openChatUserId = useAppStore((s) => s.openChatUserId)
  const setOpenChatUserId = useAppStore((s) => s.setOpenChatUserId)

  const [conversations, setConversations] = useState<ConversationDTO[]>([])
  const [activeUser, setActiveUser] = useState<UserBrief | null>(null)
  const [messages, setMessages] = useState<MessageDTO[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTypingSent = useRef(0)

  // --- Premium live typing: ghost preview of the in-progress draft ---
  const [peerLive, setPeerLive] = useState<{ text: string; name: string } | null>(null)
  const peerLiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLiveSent = useRef(0)
  const lastLiveText = useRef('')
  const liveTrailing = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeUserRef = useRef<UserBrief | null>(null)
  const premium = canUsePremium(me)

  useEffect(() => { activeUserRef.current = activeUser }, [activeUser])

  // Clear trailing timer + tell the peer to drop our ghost ('' signal)
  const stopLiveBroadcast = useCallback((clearPeer = true) => {
    if (liveTrailing.current) { clearTimeout(liveTrailing.current); liveTrailing.current = null }
    if (clearPeer) setPeerLive(null)
    const u = activeUserRef.current
    if (u && lastLiveText.current) {
      lastLiveSent.current = Date.now()
      lastLiveText.current = ''
      void triggerTyping(u.id, '')
    }
  }, [])

  // Throttled (leading + trailing) Premium broadcast of the draft.
  // Recipient id is captured per call so a trailing timer scheduled for
  // chat A can never leak the draft into chat B after switching.
  const broadcastLiveDraft = useCallback((draft: string) => {
    const u = activeUserRef.current
    if (!premium || !u) return
    if (draft === lastLiveText.current) return
    const wait = lastLiveSent.current + 700 - Date.now()
    if (wait <= 0) {
      lastLiveSent.current = Date.now()
      lastLiveText.current = draft
      void triggerTyping(u.id, draft)
    } else {
      if (liveTrailing.current) clearTimeout(liveTrailing.current)
      liveTrailing.current = setTimeout(() => {
        lastLiveSent.current = Date.now()
        lastLiveText.current = draft
        void triggerTyping(u.id, draft)
      }, wait)
    }
  }, [premium])

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setConversations(data.conversations)
    } catch { /* offline */ } finally { setLoading(false) }
  }, [])

  const loadThread = useCallback(async (userId: number) => {
    stopLiveBroadcast()
    try {
      const res = await fetch(`/api/messages/${userId}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setActiveUser(data.other)
        setMessages(data.messages)
        setTypingUser(null)
      }
    } catch { /* offline */ }
  }, [stopLiveBroadcast])

  useEffect(() => { void loadConversations() }, [loadConversations])

  // open chat triggered globally (e.g. from profile "Message" button)
  useEffect(() => {
    if (openChatUserId) {
      void loadThread(openChatUserId)
      setOpenChatUserId(null)
    }
  }, [openChatUserId, loadThread, setOpenChatUserId])

  // realtime incoming messages/typing/reads via the store registry
  const addRealtimeListener = useAppStore((s) => s.addRealtimeListener)
  useEffect(() => {
    const listener = (e: { type: string; payload?: unknown }) => {
      if (e.type === 'message') {
        const msg = e.payload as RealtimeMessagePayload
        const partnerId = msg.senderId === me?.id ? msg.recipientId : msg.senderId
        if (activeUser?.id === partnerId) {
          setMessages((list) =>
            list.some((m) => m.id === msg.id) ? list : [...list, {
              id: msg.id, conversationId: msg.conversationId,
              senderId: msg.senderId, body: msg.body, isRead: false,
              createdAt: msg.createdAt,
            }]
          )
          setTypingUser(null)
          setPeerLive(null)
        } else if (msg.senderId !== me?.id) {
          sonner.message(`💬 ${msg.senderFirstName ?? msg.senderUsername}: ${msg.body.slice(0, 60)}`)
        }
        void loadConversations()
      }
      if (
        e.type === 'typing' && activeUser &&
        (e.payload as { fromUserId: number }).fromUserId === activeUser.id &&
        (e.payload as { fromUserId: number }).fromUserId !== me?.id
      ) {
        setTypingUser((e.payload as { fromFirstName: string | null }).fromFirstName ?? 'them')
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTypingUser(null), 3000)
      }
      if (e.type === 'live_typing' && activeUser) {
        const p = e.payload as { fromUserId: number; fromFirstName: string | null; draft: string }
        if (p.fromUserId !== me?.id && p.fromUserId === activeUser.id) {
          if (peerLiveTimer.current) clearTimeout(peerLiveTimer.current)
          if (!p.draft) {
            setPeerLive(null)
          } else {
            setPeerLive({ text: p.draft, name: p.fromFirstName ?? 'They' })
            peerLiveTimer.current = setTimeout(() => setPeerLive(null), 4000)
          }
        }
      }
      if (e.type === 'read' && activeUser) {
        setMessages((list) => list.map((m) => (m.senderId === me?.id ? { ...m, isRead: true } : m)))
      }
    }
    return addRealtimeListener(listener)
  }, [activeUser, me?.id, addRealtimeListener, loadConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUser, peerLive])

  // Leaving the Messages view entirely: best-effort clear of our ghost
  useEffect(() => {
    return () => {
      if (liveTrailing.current) clearTimeout(liveTrailing.current)
      if (peerLiveTimer.current) clearTimeout(peerLiveTimer.current)
      const u = activeUserRef.current
      if (u && lastLiveText.current) void triggerTyping(u.id, '')
    }
  }, [])

  const send = async () => {
    if (!activeUser || !text.trim()) return
    setSending(true)
    const body = text
    setText('')
    // End the live ghost on the peer's side immediately
    if (liveTrailing.current) { clearTimeout(liveTrailing.current); liveTrailing.current = null }
    if (premium && lastLiveText.current) void triggerTyping(activeUser.id, '')
    lastLiveText.current = ''
    try {
      const res = await fetch(`/api/messages/${activeUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setMessages((list) => (list.some((m) => m.id === data.message.id) ? list : [...list, data.message]))
        void loadConversations()
      } else sonner.error(data.error ?? 'Failed to send')
    } catch { sonner.error('Failed to send — offline?') } finally { setSending(false) }
  }

  const onType = () => {
    if (!activeUser) return
    const now = Date.now()
    if (now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now
      void triggerTyping(activeUser.id)
    }
  }

  // ---------------- thread pane ----------------
  if (activeUser) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-card/70 p-3 backdrop-blur">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => { stopLiveBroadcast(); setActiveUser(null); void loadConversations() }} aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <AceAvatar user={activeUser} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {activeUser.firstName ?? activeUser.username}
              {activeUser.isVerified ? ' ✓' : ''}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {typingUser ? `${typingUser} is typing…` : `@${activeUser.username}`}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Say hi 👋</p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === me?.id
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                  mine
                    ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-black'
                    : 'bg-muted'
                )}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cn('mt-0.5 text-[10px]', mine ? 'text-black/60' : 'text-muted-foreground')}>
                    {timeAgo(m.createdAt)}{mine ? (m.isRead ? ' · seen' : ' · sent') : ''}
                  </p>
                </div>
              </div>
            )
          })}
          {/* Peer's live draft (Premium): faint ghost while it is being typed */}
          {peerLive && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
              data-testid="live-ghost-peer"
            >
              <div className="max-w-[75%] rounded-2xl border border-dashed border-emerald-500/40 bg-muted/40 px-3.5 py-2">
                <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm italic text-foreground/55">{peerLive.text}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  {peerLive.name} is typing live
                </p>
              </div>
            </motion.div>
          )}
          {/* My own live draft (Premium): faint preview of what I am typing */}
          {premium && text.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
              data-testid="live-ghost-self"
            >
              <div className="max-w-[75%] rounded-2xl border border-dashed border-amber-500/50 bg-amber-400/10 px-3.5 py-2">
                <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm italic text-foreground/55">{text}</p>
                <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </span>
                  live · {activeUser?.firstName ?? activeUser?.username ?? 'them'} sees this as you type
                </p>
              </div>
            </motion.div>
          )}
          {typingUser && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">● ● ●</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border bg-card/70 backdrop-blur">
          {!premium && (
            <div className="px-3 pt-2">
              <button
                type="button"
                onClick={() => sonner.info('✨ Live typing is a Premium feature — upgrade to PRO to watch messages appear as they are typed.')}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition hover:text-amber-500"
              >
                <Crown className="h-3 w-3 text-amber-400" />
                Live typing is a Premium feature
              </button>
            </div>
          )}
          <div className="flex gap-2 p-3">
            <Input
              value={text}
              onChange={(e) => {
                const v = e.target.value
                setText(v)
                onType()
                broadcastLiveDraft(v)
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Type a message…"
              maxLength={2000}
            />
            <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500" aria-label="Send message">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------- conversation list ----------------
  return (
    <div className="space-y-1 p-3">
      <h2 className="px-1 pb-2 text-xl font-bold">Messages 💬</h2>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>
      ) : conversations.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-4xl">🃏</p>
          <p className="mt-3 text-sm">No conversations yet. Open a profile and hit “Message”.</p>
        </div>
      ) : (
        conversations.map((c) => (
          <button
            key={c.id}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-accent"
            onClick={() => void loadThread(c.other.id)}
          >
            <div className="relative">
              <AceAvatar user={c.other} />
              {c.unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
                  {c.unreadCount}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-semibold">
                {c.other.firstName ?? c.other.username}
                {c.other.isVerified ? ' ✓' : ''}
                {c.lastMessage && <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">{timeAgo(c.lastMessage.createdAt)}</span>}
              </p>
              <p className={cn('truncate text-sm', c.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {c.lastMessage
                  ? `${c.lastMessage.senderId === me?.id ? 'You: ' : ''}${c.lastMessage.body}`
                  : 'No messages yet'}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  )
}
