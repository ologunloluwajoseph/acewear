'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Clapperboard, Eye, Heart, Loader2, Pause, Plus, Trash2, Volume2, VolumeX,
} from 'lucide-react'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AceAvatar, MediaImg, UploadButton, timeAgo } from '@/components/ace/media'
import type { ReelDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/client-store'

// ---------------------------------------------------------------------------
// Infinite loop pagination: pages keep loading as you scroll; when the API
// runs out of pages the feed wraps around to the top — an endless loop —
// until MAX_CYCLES repeats, after which a friendly end card appears.
// ---------------------------------------------------------------------------
const PAGE_SIZE = 4
const MAX_CYCLES = 12

interface ReelItem extends ReelDTO {
  uid: string // unique per feed instance (allows looped duplicates)
}

// ---------------- create reel dialog ----------------

function CreateReelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video')
  const [caption, setCaption] = useState('')
  const [sound, setSound] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setMediaUrl(null)
    setCaption('')
    setSound('')
  }

  const submit = async () => {
    if (!mediaUrl) return
    setBusy(true)
    try {
      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          mediaUrl,
          mediaType,
          soundLabel: sound || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success('Reel published 🎬')
        reset()
        onOpenChange(false)
        onCreated()
      } else {
        sonner.error(data.error ?? 'Failed to publish reel')
      }
    } catch {
      sonner.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-amber-400" /> New reel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {mediaUrl ? (
            <div className="relative mx-auto w-40 overflow-hidden rounded-2xl border border-border">
              {mediaType === 'video' ? (
                <video src={mediaUrl} muted loop autoPlay playsInline className="aspect-[9/16] w-full object-cover" />
              ) : (
                <MediaImg src={mediaUrl} alt="Reel preview" className="aspect-[9/16] w-full object-cover" />
              )}
              <button
                onClick={() => setMediaUrl(null)}
                aria-label="Remove media"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <UploadButton
                preset="reels"
                accept="video/mp4,video/webm,video/quicktime,image/*"
                label="Pick video or photo"
                busyLabel="Uploading…"
                className="bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500"
                onUploaded={(img) => {
                  setMediaUrl(img.url)
                  setMediaType(img.mediaType === 'image' ? 'image' : 'video')
                }}
                onError={(m) => sonner.error(m)}
              />
            </div>
          )}
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption… hit the jackpot with a good one"
            className="min-h-20 resize-none"
            maxLength={300}
          />
          <Input
            value={sound}
            onChange={(e) => setSound(e.target.value)}
            placeholder="Sound credit (optional) — e.g. Ace Beats × High Stakes"
            maxLength={80}
          />
          <Button
            onClick={submit}
            disabled={busy || !mediaUrl}
            className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500"
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Publish reel
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            MP4 or WebM up to 60 MB, portrait 9:16 looks best. Photos get auto-compressed to WebP.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- single reel ----------------

function ReelCard({
  reel,
  active,
  muted,
  onToggleMute,
  onOpenProfile,
  onDeleted,
}: {
  reel: ReelItem
  active: boolean
  muted: boolean
  onToggleMute: () => void
  onOpenProfile: (username: string) => void
  onDeleted: (uid: string) => void
}) {
  const me = useAppStore((s) => s.me)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [liked, setLiked] = useState(reel.likedByMe)
  const [likes, setLikes] = useState(reel.likesCount)
  const [views, setViews] = useState(reel.viewsCount)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null)
  const tapRef = useRef<{ time: number; timer: ReturnType<typeof setTimeout> | null }>({ time: 0, timer: null })
  const viewedRef = useRef(false)

  // play/pause + mute + view counting driven by active state
  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
    if (!active) {
      v?.pause()
      if (v) v.currentTime = 0
      setPaused(false)
      setProgress(0)
      return
    }
    if (v) {
      v.muted = muted
      if (!paused) v.play().catch(() => null)
    }
    if (!viewedRef.current) {
      viewedRef.current = true
      fetch(`/api/reels/${reel.id}/view`, { method: 'POST' }).catch(() => null)
      setViews((n) => n + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, muted])

  const fireBurst = useCallback((x?: number, y?: number) => {
    setBurst({ x: x ?? 50, y: y ?? 50, id: Date.now() })
    setTimeout(() => setBurst(null), 800)
  }, [])

  const toggleLike = useCallback(async (force?: boolean) => {
    if (force && liked) {
      fireBurst()
      return
    }
    const next = force ? true : !liked
    setLiked(next)
    setLikes((n) => n + (next ? 1 : -1))
    try {
      const res = await fetch(`/api/reels/${reel.id}/like`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setLiked(data.liked)
        setLikes(data.likesCount)
      }
    } catch {
      /* keep optimistic */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, reel.id, fireBurst])

  // single tap = play/pause, double tap = like (with burst)
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const now = Date.now()
    const state = tapRef.current
    if (now - state.time < 300) {
      if (state.timer) clearTimeout(state.timer)
      state.time = 0
      void toggleLike(true)
      fireBurst(x, y)
    } else {
      state.time = now
      state.timer = setTimeout(() => {
        // single tap — toggle playback
        const v = videoRef.current
        if (v) {
          if (v.paused) { v.play().catch(() => null); setPaused(false) }
          else { v.pause(); setPaused(true) }
        }
      }, 300)
    }
  }

  const deleteReel = async () => {
    const res = await fetch(`/api/reels/${reel.id}`, { method: 'DELETE' })
    if (res.ok) {
      sonner.success('Reel removed')
      onDeleted(reel.uid)
    } else {
      sonner.error('Failed to remove reel')
    }
  }

  const canDelete = me && (me.id === reel.user.id || me.isAdmin)

  return (
    <div className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {/* media */}
      {reel.mediaType === 'video' ? (
        <video
          ref={videoRef}
          src={reel.mediaUrl}
          poster={reel.posterUrl ?? undefined}
          loop
          muted={muted}
          playsInline
          preload={active ? 'auto' : 'metadata'}
          disablePictureInPicture
          onTimeUpdate={(e) => {
            const v = e.currentTarget
            if (v.duration) setProgress((v.currentTime / v.duration) * 100)
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className={cn('absolute inset-0', active && 'ace-kenburns')}>
          <MediaImg src={reel.mediaUrl} alt={reel.caption ?? 'Reel'} className="h-full w-full object-cover" />
        </div>
      )}

      {/* readability gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

      {/* tap surface */}
      <div className="absolute inset-0" onClick={handleTap}>
        <AnimatePresence>
          {burst && (
            <motion.div
              key={burst.id}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1.15 }}
              exit={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute"
              style={{ left: `${burst.x}%`, top: `${burst.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <Heart className="h-24 w-24 fill-rose-500 text-rose-500 drop-shadow-[0_0_18px_rgba(244,63,94,0.7)]" />
            </motion.div>
          )}
        </AnimatePresence>
        {paused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/45 p-5 backdrop-blur-sm">
              <Pause className="h-10 w-10 text-white/90" />
            </div>
          </div>
        )}
      </div>

      {/* top meta */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
        <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
          Reels
        </span>
        <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur-sm">
          <Eye className="h-3.5 w-3.5" /> {views.toLocaleString()}
        </span>
      </div>

      {/* right action rail */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4">
        <button
          onClick={() => void toggleLike()}
          aria-label={liked ? 'Unlike reel' : 'Like reel'}
          className={cn('flex flex-col items-center gap-1 text-white transition active:scale-90', liked && 'text-rose-500')}
        >
          <Heart className={cn('h-8 w-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]', liked && 'fill-current')} />
          <span className="text-xs font-bold drop-shadow">{likes.toLocaleString()}</span>
        </button>
        <button
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition active:scale-90"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        {canDelete && (
          <button
            onClick={deleteReel}
            aria-label="Delete reel"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition hover:text-rose-400 active:scale-90"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-6 pr-20">
        <div className="flex items-center gap-2.5">
          <button onClick={() => onOpenProfile(reel.user.username)} className="shrink-0">
            <AceAvatar user={reel.user} className="h-10 w-10 ring-2 ring-amber-400/70" />
          </button>
          <button onClick={() => onOpenProfile(reel.user.username)} className="flex items-center gap-1 text-sm font-bold text-white drop-shadow hover:underline">
            {reel.user.firstName ?? reel.user.username}
            {reel.user.isVerified && <span className="text-amber-400">✓</span>}
          </button>
          <span className="text-[11px] text-white/60">{timeAgo(reel.createdAt)}</span>
        </div>
        {reel.caption && (
          <p className="mt-2 line-clamp-3 text-sm leading-snug text-white/95 drop-shadow">{reel.caption}</p>
        )}
        {reel.soundLabel && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-white/80">
            <span className="animate-pulse">♫</span>
            <span className="truncate">{reel.soundLabel}</span>
          </p>
        )}
      </div>

      {/* video progress */}
      {reel.mediaType === 'video' && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
          <div className="h-full bg-amber-400 transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

// ---------------- reels feed ----------------

export function ReelsView({ onOpenProfile }: { onOpenProfile: (username: string) => void }) {
  const [items, setItems] = useState<ReelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [chromeHeight, setChromeHeight] = useState(0)
  const [ended, setEnded] = useState(false)

  const cursorRef = useRef<{ cursor: number | null; cycle: number }>({ cursor: null, cycle: 0 })
  const loadingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Measure the actual chrome (mobile top bar + bottom nav) so reels fill
  // the viewport exactly — snap maths stay pixel-perfect on every device.
  useEffect(() => {
    const calc = () => {
      const header = document.querySelector('header')
      const bottom = document.querySelector('nav[aria-label="Bottom navigation"]')
      const desktopPad = window.innerWidth >= 768 ? 28 : 0 // frame margins on desktop
      const h = (header?.getBoundingClientRect().height ?? 0) + (bottom?.getBoundingClientRect().height ?? 0) + desktopPad
      setChromeHeight(h)
    }
    calc()
    const t = setTimeout(calc, 400) // after fonts/layout settle
    window.addEventListener('resize', calc)
    return () => { clearTimeout(t); window.removeEventListener('resize', calc) }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const { cursor, cycle } = cursorRef.current
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (cursor) qs.set('cursor', String(cursor))
      const res = await fetch(`/api/reels?${qs}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        const fresh: ReelItem[] = data.reels.map((r: ReelDTO, i: number) => ({
          ...r,
          uid: `${r.id}c${cycle}i${i}`,
        }))
        setItems((prev) => [...prev, ...fresh])
        if (data.nextCursor) {
          cursorRef.current.cursor = data.nextCursor
        } else if (cycle + 1 < MAX_CYCLES) {
          // loop the feed back to the top — infinity ♾
          cursorRef.current.cursor = null
          cursorRef.current.cycle = cycle + 1
        } else {
          setEnded(true)
        }
      }
    } catch {
      /* offline */
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
      setLoading(false)
    }
  }, [cursorRef])

  useEffect(() => {
    void loadMore()
  }, [loadMore])

  // infinite scroll sentinel (inside the snap container)
  useEffect(() => {
    const root = containerRef.current
    if (!root || loading) return
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && void loadMore(),
      { root, rootMargin: '0px 0px 25% 0px' }
    )
    const el = root.querySelector('[data-reels-sentinel]')
    if (el) io.observe(el)
    return () => io.disconnect()
  }, [items.length, loading, loadMore, ended])

  // track the active (mostly visible) reel
  useEffect(() => {
    const root = containerRef.current
    if (!root || items.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const uid = (entry.target as HTMLElement).dataset.uid
            if (uid) setActiveId(uid)
          }
        }
      },
      { root, threshold: [0.6] }
    )
    for (const el of cardRefs.current.values()) io.observe(el)
    return () => io.disconnect()
  }, [items.length])

  // keyboard navigation (desktop)
  const scrollBy = useCallback((dir: 1 | -1) => {
    const root = containerRef.current
    if (!root) return
    const idx = items.findIndex((r) => r.uid === activeId)
    const next = Math.min(items.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + dir))
    const el = cardRefs.current.get(items[next]?.uid)
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [items, activeId])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); scrollBy(1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); scrollBy(-1) }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [scrollBy])

  const onDeleted = (uid: string) => setItems((list) => list.filter((r) => r.uid !== uid))

  const containerHeight = useMemo(
    () => (chromeHeight > 0 ? { height: `calc(100dvh - ${chromeHeight}px)` } : { height: '100dvh' }),
    [chromeHeight]
  )

  return (
    <div className="relative">
      {/* create FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        aria-label="Create reel"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/25 transition hover:scale-105 active:scale-95 md:bottom-6"
      >
        <Plus className="h-6 w-6" />
      </button>

      <div
        ref={containerRef}
        tabIndex={0}
        className="ace-no-scrollbar overflow-y-scroll snap-y snap-mandatory overscroll-contain md:mx-auto md:mt-4 md:w-[420px] md:rounded-3xl md:border md:border-border md:shadow-2xl"
        style={containerHeight}
        aria-label="Reels feed"
      >
        {loading ? (
          // first-paint skeleton — mimics one reel card (Task 23)
          <div aria-label="Loading reels" data-testid="reels-skeleton" className="h-full w-full animate-pulse bg-black/40">
            <div className="flex h-full flex-col justify-end p-5">
              <div className="flex items-center gap-3 pb-4">
                <div className="h-10 w-10 rounded-full bg-white/20" />
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded bg-white/20" />
                  <div className="h-2.5 w-20 rounded bg-white/10" />
                </div>
              </div>
              <div className="h-3 w-3/4 rounded bg-white/15" />
              <div className="mt-4 flex items-center gap-4 pb-2">
                <div className="h-8 w-8 rounded-full bg-white/15" />
                <div className="h-8 w-8 rounded-full bg-white/15" />
              </div>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-black/40 text-center">
            <Clapperboard className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No reels yet — roll the dice and post the first one!</p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black"
            >
              <Plus className="mr-1 h-4 w-4" /> Create reel
            </Button>
          </div>
        ) : (
          <>
            {items.map((reel) => (
              <div
                key={reel.uid}
                data-uid={reel.uid}
                ref={(el) => {
                  if (el) cardRefs.current.set(reel.uid, el)
                  else cardRefs.current.delete(reel.uid)
                }}
                className="h-full w-full snap-start snap-always"
              >
                <ReelCard
                  reel={reel}
                  active={activeId === reel.uid}
                  muted={muted}
                  onToggleMute={() => setMuted((m) => !m)}
                  onOpenProfile={onOpenProfile}
                  onDeleted={onDeleted}
                />
              </div>
            ))}
            {/* sentinel for infinite loading */}
            <div data-reels-sentinel className="h-px w-full" />
            {loadingMore && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
                <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
              </div>
            )}
            {ended && (
              <div className="flex h-full w-full snap-start snap-always flex-col items-center justify-center gap-3 bg-black/60 text-center">
                <p className="text-3xl">🎰</p>
                <p className="text-sm text-muted-foreground">You&apos;ve seen every reel on the floor.</p>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Back to the top
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CreateReelDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          cursorRef.current.cursor = null
          cursorRef.current.cycle = 0
          setEnded(false)
          setItems([])
          setLoading(true)
          setActiveId(null)
          void loadMore()
        }}
      />
    </div>
  )
}
