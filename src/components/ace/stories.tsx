'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { AceAvatar, MediaImg, UploadButton, timeAgo } from '@/components/ace/media'
import type { StoryGroupDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

const COLORS = ['#f0b429', '#f43f5e', '#8b5cf6', '#10b981', '#06b6d4']

// ---------------- stories bar ----------------

export function StoriesBar({
  groups,
  myName,
  myAvatar,
  onCreateClick,
  onOpen,
}: {
  groups: StoryGroupDTO[]
  myName: string
  myAvatar?: string | null
  onCreateClick: () => void
  onOpen: (groupIndex: number) => void
}) {
  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 pt-3">
      {/* your story */}
      <button className="flex w-16 shrink-0 flex-col items-center gap-1.5" onClick={onCreateClick}>
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-amber-400/70 bg-card">
            <AceAvatar user={{ username: myName }} className="h-12 w-12" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black ring-2 ring-background">
            <Plus className="h-4 w-4" />
          </span>
        </div>
        <span className="w-16 truncate text-center text-xs text-muted-foreground">Your story</span>
      </button>

      {groups.map((g, i) => (
        <button
          key={g.user.id}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          onClick={() => onOpen(i)}
        >
          <div className={cn('rounded-full p-[3px]', g.allViewed ? 'bg-muted' : 'story-ring')}>
            <div className="rounded-full bg-background p-[2px]">
              <AceAvatar user={g.user} className="h-14 w-14" />
            </div>
          </div>
          <span className="w-16 truncate text-center text-xs">{g.user.firstName ?? g.user.username}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------- create story dialog ----------------

export function CreateStoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setMediaUrl(null)
    setBody('')
    setError(null)
  }

  const create = async () => {
    if (!mediaUrl && !body.trim()) {
      setError('Add a photo or write something')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl,
          body: mediaUrl ? '' : body, // text stories use color background
          backgroundColor: color,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) setError(data.error ?? 'Failed to create story')
      else {
        reset()
        onOpenChange(false)
        onCreated()
      }
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New story — visible for 24h</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {mediaUrl ? (
            <div className="relative overflow-hidden rounded-xl">
              <MediaImg src={mediaUrl} alt="Story preview" className="max-h-72 w-full object-cover" />
              <Button variant="secondary" size="icon" className="absolute right-2 top-2 h-8 w-8 rounded-full" onClick={() => setMediaUrl(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <UploadButton
                preset="stories"
                label="Add photo (→ WebP)"
                onUploaded={(img) => {
                  setMediaUrl(img.url)
                  setError(null)
                }}
                onError={setError}
                className="w-full"
              />
              <div className="space-y-2">
                <Label htmlFor="story-text">…or a text story</Label>
                <Input
                  id="story-text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Feeling lucky today 🃏"
                  maxLength={300}
                />
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`color ${c}`}
                      className={cn('h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-card', color === c ? 'ring-foreground' : 'ring-transparent')}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy} className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Share story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- fullscreen story viewer ----------------

export function StoryViewer({
  groups,
  startGroup,
  onClose,
}: {
  groups: StoryGroupDTO[]
  startGroup: number
  onClose: () => void
}) {
  const [gi, setGi] = useState(startGroup)
  const [si, setSi] = useState(0)
  const [progress, setProgress] = useState(0)
  const raf = useRef<number | null>(null)
  const viewedRef = useRef(new Set<number>())

  const group = groups[gi]
  const story = group?.stories[si]

  const markViewed = useCallback(async (storyId: number) => {
    if (viewedRef.current.has(storyId)) return
    viewedRef.current.add(storyId)
    try {
      await fetch(`/api/stories/${storyId}/view`, { method: 'POST' })
    } catch {
      /* offline ok */
    }
  }, [])

  const advance = useCallback(() => {
    setProgress(0)
    if (!group) return
    if (si + 1 < group.stories.length) {
      setSi(si + 1)
    } else if (gi + 1 < groups.length) {
      setGi(gi + 1)
      setSi(0)
    } else {
      onClose()
    }
  }, [group, si, gi, groups.length, onClose])

  const goBack = () => {
    setProgress(0)
    if (si > 0) setSi(si - 1)
    else if (gi > 0) {
      setGi(gi - 1)
      setSi(0)
    }
  }

  // auto-advance + progress
  useEffect(() => {
    if (!story) return
    void markViewed(story.id)
    const start = performance.now()
    const DURATION = 6000
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION)
      setProgress(p)
      if (p >= 1) advance()
      else raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [gi, si, story?.id])

  // 24h remaining countdown
  const hoursLeft = story
    ? Math.max(0, Math.ceil((new Date(story.expiresAt).getTime() - Date.now()) / 3600000))
    : 0

  if (!group || !story) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-label="Story viewer"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 z-10 rounded-full text-white hover:bg-white/10"
        onClick={onClose}
        aria-label="Close stories"
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="relative flex h-full w-full max-w-md flex-col justify-center">
        {/* progress bars */}
        <div className="absolute left-3 right-3 top-4 flex gap-1">
          {group.stories.map((s, idx) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-100"
                style={{ width: idx < si ? '100%' : idx === si ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="absolute left-3 right-3 top-8 flex items-center gap-2.5 pt-2">
          <AceAvatar user={group.user} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {group.user.firstName ?? group.user.username}
              {group.user.isVerified ? ' ✓' : ''}
            </p>
            <p className="text-xs text-white/60">{timeAgo(story.createdAt)} · {hoursLeft}h left</p>
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs text-white/60">
            <Eye className="h-3.5 w-3.5" /> {story.viewsCount}
          </span>
        </div>

        {/* content */}
        <div className="relative mx-3 select-none overflow-hidden rounded-2xl">
          {story.mediaUrl ? (
            <MediaImg
              src={story.mediaUrl}
              alt="Story"
              className="max-h-[75vh] w-full object-contain"
            />
          ) : (
            <div
              className="flex aspect-[9/16] items-center justify-center p-8 text-center text-3xl font-bold text-white"
              style={{ backgroundColor: story.backgroundColor }}
            >
              {story.body}
            </div>
          )}
        </div>

        {/* tap zones */}
        <button aria-label="Previous story" className="absolute bottom-0 left-0 top-16 w-1/3 cursor-default" onClick={goBack} />
        <button aria-label="Next story" className="absolute bottom-0 right-0 top-16 w-2/3 cursor-default" onClick={advance} />
      </div>
    </motion.div>
  )
}

export function useStoryState(initial: StoryGroupDTO[] = []) {
  const [groups, setGroups] = useState(initial)
  return { groups, setGroups }
}

export { AnimatePresence as StoryPresence }
