'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Ban, Bookmark, Check, Flag, Heart, HeartCrack, Loader2, MessageCircle, MoreHorizontal, Repeat2, Search, Send, Share2, Tag, Trash2, Trophy, UserPlus, X,
} from 'lucide-react'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AceAvatar, MediaImg, UploadButton, timeAgo } from '@/components/ace/media'
import { StoriesBar, CreateStoryDialog, StoryViewer } from '@/components/ace/stories'
import type { CommentDTO, PostDTO, StoryGroupDTO, UserBrief } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/client-store'

// ---------------- tag picker (friends & followers) ----------------

interface MutualUser extends UserBrief {
  following: boolean
}

const MAX_TAGS = 10

export function TagPickerDialog({
  open,
  onOpenChange,
  selected,
  onToggle,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  selected: MutualUser[]
  onToggle: (u: MutualUser) => void
}) {
  const [users, setUsers] = useState<MutualUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      // loading flips inside the debounced callback — no sync setState in
      // the effect body (react-hooks/set-state-in-effect)
      setLoading(true)
      fetch(`/api/users/mutuals?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (d.ok) setUsers(d.users) })
        .catch(() => null)
        .finally(() => setLoading(false))
    }, 180) // debounce while typing
    return () => clearTimeout(t)
  }, [open, q])

  const selectedIds = useMemo(() => new Set(selected.map((u) => u.id)), [selected])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-400" /> Tag friends &amp; followers
          </DialogTitle>
          <DialogDescription>
            Pick up to {MAX_TAGS} people — they get a notification when the post goes live.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people you follow or your followers…"
            className="pl-9"
          />
        </div>
        <div className="max-h-72 min-h-32 flex-1 space-y-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-amber-400" /></div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matching friends or followers.
            </p>
          ) : (
            users.map((u) => {
              const isSel = selectedIds.has(u.id)
              const disabled = !isSel && selected.length >= MAX_TAGS
              return (
                <button
                  key={u.id}
                  onClick={() => onToggle(u)}
                  disabled={disabled}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition',
                    isSel ? 'border-amber-400/40 bg-amber-400/10' : 'hover:bg-accent/60',
                    disabled && 'opacity-40'
                  )}
                >
                  <AceAvatar user={u} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {u.firstName ?? u.username}
                      {u.isVerified && <span className="ml-1 text-amber-400">✓</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{u.username}{u.following ? ' · following' : ' · follows you'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full border',
                      isSel ? 'border-amber-400 bg-amber-400 text-black' : 'border-border text-transparent'
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              )
            })
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {selected.length}/{MAX_TAGS} selected
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- composer ----------------

function Composer({ onPosted }: { onPosted: () => void }) {
  const [text, setText] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [tagged, setTagged] = useState<MutualUser[]>([])
  const [tagOpen, setTagOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggleTag = (u: MutualUser) => {
    setTagged((list) =>
      list.some((x) => x.id === u.id)
        ? list.filter((x) => x.id !== u.id)
        : list.length >= MAX_TAGS ? list : [...list, u]
    )
  }

  const submit = async () => {
    if (!text.trim() && !mediaUrl) return
    setBusy(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
          mediaUrl,
          taggedUserIds: tagged.map((u) => u.id),
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setText('')
        setMediaUrl(null)
        setTagged([])
        sonner.success(data.post.tagged.length
          ? `Posted — tagged ${data.post.tagged.length} friend${data.post.tagged.length === 1 ? '' : 's'} ⚡`
          : 'Posted — compressed to WebP and live ⚡')
        onPosted()
      } else {
        sonner.error(data.error ?? 'Failed to post')
      }
    } catch {
      sonner.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-b border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex gap-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's your next move? ♠ ♥ ♦ ♣"
          className="min-h-20 flex-1 resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
          maxLength={2000}
        />
        {mediaUrl && (
          <div className="relative shrink-0">
            <MediaImg src={mediaUrl} alt="Attachment preview" className="h-20 w-20 rounded-xl object-cover" />
            <button
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white"
              onClick={() => setMediaUrl(null)}
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        )}
      </div>
      {tagged.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tagging:</span>
          {tagged.map((u) => (
            <span
              key={u.id}
              className="flex items-center gap-1 rounded-full bg-amber-400/10 py-0.5 pl-2 pr-1 text-xs font-medium text-amber-400"
            >
              @{u.username}
              <button
                onClick={() => toggleTag(u)}
                aria-label={`Remove tag ${u.username}`}
                className="rounded-full p-0.5 hover:bg-amber-400/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UploadButton
            preset="posts"
            label="Photo"
            onUploaded={(img) => setMediaUrl(img.url)}
            onError={(m) => sonner.error(m)}
          />
          <Button
            variant="secondary" size="sm"
            className="rounded-full"
            onClick={() => setTagOpen(true)}
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Tag friends{tagged.length ? ` (${tagged.length})` : ''}
          </Button>
        </div>
        <Button
          onClick={submit}
          disabled={busy || (!text.trim() && !mediaUrl)}
          className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500"
        >
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          Post
        </Button>
      </div>
      <TagPickerDialog open={tagOpen} onOpenChange={setTagOpen} selected={tagged} onToggle={toggleTag} />
    </div>
  )
}

// ---------------- comments ----------------

function CommentsDialog({
  post,
  open,
  onOpenChange,
  onCountChange,
}: {
  post: PostDTO | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onCountChange?: (delta: number) => void
}) {
  const [comments, setComments] = useState<CommentDTO[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!post) return
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setComments(data.comments)
    } catch {
      /* offline */
    }
  }, [post])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const submit = async () => {
    if (!post || !text.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setComments((c) => [...c, data.comment])
        setText('')
        onCountChange?.(1)
      } else sonner.error(data.error ?? 'Failed to comment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 flex-1 space-y-4 overflow-y-auto pr-1">
          {comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comments yet — break the silence.
            </p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <AceAvatar user={c.user} className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{c.user.firstName ?? c.user.username}</span>{' '}
                  {c.user.isVerified && <span className="text-amber-400">✓</span>}
                </p>
                <p className="break-words text-sm text-foreground/90">{c.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(c.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            maxLength={1000}
          />
          <Button onClick={submit} disabled={busy || !text.trim()} size="icon" className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500" aria-label="Send comment">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- share / reshare ----------------

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const done = document.execCommand('copy')
    document.body.removeChild(ta)
    return done
  } catch {
    return false
  }
}

async function copyWithFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return legacyCopy(text)
  }
}

async function sharePost(post: PostDTO) {
  const url = `${window.location.origin}/?post=${post.id}`
  const title = `${post.user.firstName ?? post.user.username} on ACE`
  const text = post.body?.slice(0, 120) ?? 'Check out this post on ACE'
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text, url })
      return
    }
    if (await copyWithFallback(url)) {
      sonner.success('Post link copied — go share the pot ♠')
    } else {
      sonner.error('Could not copy the link')
    }
  } catch (err) {
    // AbortError = user closed the share sheet; everything else falls back
    if (err instanceof DOMException && err.name === 'AbortError') return
    if (await copyWithFallback(url)) {
      sonner.success('Post link copied')
    } else {
      sonner.error('Could not copy the link')
    }
  }
}

function ReshareDialog({
  post,
  open,
  onOpenChange,
  onReshared,
}: {
  post: PostDTO
  open: boolean
  onOpenChange: (v: boolean) => void
  onReshared: () => void
}) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const me = useAppStore((s) => s.me)

  const submit = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/repost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success('Reshared to your feed 🔁')
        setComment('')
        onOpenChange(false)
        onReshared()
      } else {
        sonner.error(data.error ?? 'Could not reshare')
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
            <Repeat2 className="h-4 w-4 text-amber-400" /> Reshare to your feed
          </DialogTitle>
          <DialogDescription>
            @{post.user.username}&apos;s post will appear in your feed with your take on top.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border bg-accent/30 p-3 text-sm">
          <p className="font-semibold">
            {post.user.firstName ?? post.user.username}
            {post.user.isVerified && <span className="ml-1 text-amber-400">✓</span>}
          </p>
          <p className="mt-1 line-clamp-3 text-muted-foreground">{post.body ?? '📷 Photo post'}</p>
        </div>
        {me && (
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`Add your comment, ${me.firstName ?? me.username}… (optional)`}
            className="min-h-20 resize-none"
            maxLength={500}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500"
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Repeat2 className="mr-1 h-4 w-4" />}
            Reshare
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- post card ----------------

function PostCard({
  post,
  onDelete,
  onOpenProfile,
  onReshared,
  highlight,
}: {
  post: PostDTO
  onDelete: (id: number) => void
  onOpenProfile: (username: string) => void
  onReshared: () => void
  highlight?: boolean
}) {
  const me = useAppStore((s) => s.me)
  const [liked, setLiked] = useState(post.likedByMe)
  const [likes, setLikes] = useState(post.likesCount)
  const [disliked, setDisliked] = useState(post.dislikedByMe)
  const [dislikes, setDislikes] = useState(post.dislikesCount)
  const [reshared, setReshared] = useState(post.resharedByMe)
  const [reshares, setReshares] = useState(post.resharesCount)
  const [commentsCount, setCommentsCount] = useState(post.commentsCount)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [reshareOpen, setReshareOpen] = useState(false)
  const [voted, setVoted] = useState(post.votedByMe)
  const [votes, setVotes] = useState(post.votesCount)
  const [burst, setBurst] = useState(0) // like-particle burst id
  const [reportOpen, setReportOpen] = useState(false)
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByMe ?? false)
  const isMine = me?.id === post.user.id

  const toggleBookmark = async () => {
    const nextBookmarked = !bookmarked
    setBookmarked(nextBookmarked)
    try {
      const res = await fetch(`/api/posts/${post.id}/bookmark`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setBookmarked(data.bookmarked)
        if (data.bookmarked) sonner.success('Saved to Bookmarks 🔖')
        else sonner.info('Removed from Bookmarks')
      } else {
        setBookmarked(bookmarked)
      }
    } catch {
      setBookmarked(bookmarked)
    }
  }

  const toggleLike = async () => {
    // optimistic — heart and broken heart are mutually exclusive
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikes((n) => n + (nextLiked ? 1 : -1))
    if (nextLiked) setBurst((b) => b + 1) // micro-interaction: heart burst
    if (nextLiked && disliked) {
      setDisliked(false)
      setDislikes((n) => Math.max(0, n - 1))
    }
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setLiked(data.liked)
        setLikes(data.likesCount)
        if (typeof data.disliked === 'boolean') setDisliked(data.disliked)
        if (typeof data.dislikesCount === 'number') setDislikes(data.dislikesCount)
      }
    } catch {
      /* keep optimistic */
    }
  }

  const toggleDislike = async () => {
    const nextDisliked = !disliked
    setDisliked(nextDisliked)
    setDislikes((n) => n + (nextDisliked ? 1 : -1))
    if (nextDisliked && liked) {
      setLiked(false)
      setLikes((n) => Math.max(0, n - 1))
    }
    try {
      const res = await fetch(`/api/posts/${post.id}/dislike`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setDisliked(data.disliked)
        setDislikes(data.dislikesCount)
        if (typeof data.liked === 'boolean') setLiked(data.liked)
        if (typeof data.likesCount === 'number') setLikes(data.likesCount)
      }
    } catch {
      /* keep optimistic */
    }
  }

  const toggleVote = async () => {
    setVoted(!voted)
    setVotes((n) => n + (voted ? -1 : 1))
    try {
      const res = await fetch(`/api/entries/${post.id}/vote`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setVoted(data.voted)
        setVotes(data.votesCount)
      } else {
        setVoted(voted)
        setVotes(votes)
        sonner.error(data.error ?? 'Vote failed')
      }
    } catch {
      setVoted(voted)
    }
  }

  const onResharedLocal = () => {
    setReshared(true)
    setReshares((n) => n + 1)
    onReshared() // reload page 1 so the fresh repost shows at the top
  }

  const original = post.originalPost

  return (
    <article
      data-post-id={post.id}
      className={cn(
        'border-b border-border bg-card/60 backdrop-blur transition-all duration-500',
        highlight && 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-background'
      )}
    >
      {/* reshare banner when this post is someone's repost */}
      {original && (
        <p className="flex items-center gap-1.5 px-4 pt-3 text-xs text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          {me?.id === post.user.id ? 'You' : post.user.firstName ?? post.user.username} reshared
        </p>
      )}

      <div className="flex items-center gap-3 p-4 pb-2">
        <button onClick={() => onOpenProfile(post.user.username)} className="shrink-0">
          <AceAvatar user={post.user} />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => onOpenProfile(post.user.username)} className="flex items-center gap-1 text-sm font-semibold hover:underline">
            {post.user.firstName ?? post.user.username}
            {post.user.isVerified && <span className="text-amber-400">✓</span>}
            {post.user.isPro && <span className="rounded bg-amber-400/15 px-1 text-[10px] font-bold text-amber-400">PRO</span>}
          </button>
          <p className="text-xs text-muted-foreground">@{post.user.username} · {timeAgo(post.createdAt)}</p>
        </div>
        {post.contest && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-400">
            <Trophy className="h-3 w-3" /> {post.contest.title}
          </span>
        )}
        {(me && (isMine || me.isAdmin)) && (
          <Button
            variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
            aria-label="Delete post"
            onClick={async () => {
              const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
              if (res.ok) { sonner.success('Post deleted'); onDelete(post.id) }
              else sonner.error('Failed to delete')
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {/* other people's posts: report / block menu (Task 23) */}
        {me && !isMine && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
                aria-label="Post options"
                data-testid={`post-menu-${post.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem
                onClick={() => setReportOpen(true)}
                data-testid={`report-post-${post.id}`}
              >
                <Flag className="mr-2 h-4 w-4 text-amber-400" /> Report post
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const res = await fetch('/api/block', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: post.user.id }),
                    })
                    const data = await res.json()
                    if (data.ok) {
                      sonner.success(`Blocked @${post.user.username} — their posts and DMs are now hidden`)
                      onDelete(post.id)
                    } else {
                      sonner.error(data.error ?? 'Could not block')
                    }
                  } catch {
                    sonner.error('Could not block — network error')
                  }
                }}
                className="text-destructive focus:text-destructive"
                data-testid={`block-user-${post.user.id}`}
              >
                <Ban className="mr-2 h-4 w-4" /> Block @{post.user.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {post.body && (
        <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] leading-relaxed">{post.body}</p>
      )}

      {/* tagged friends & followers */}
      {post.tagged.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
          <span className="text-xs text-muted-foreground">with</span>
          {post.tagged.map((u) => (
            <button
              key={u.id}
              onClick={() => onOpenProfile(u.username)}
              className="rounded-full bg-sky-400/10 px-2 py-0.5 text-xs font-medium text-sky-400 transition hover:bg-sky-400/20"
            >
              @{u.username}
            </button>
          ))}
        </div>
      )}

      {/* embedded original for reposts */}
      {original && (
        <div className="mx-4 mb-3 overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2.5 p-3 pb-2">
            <button onClick={() => onOpenProfile(original.user.username)} className="shrink-0">
              <AceAvatar user={original.user} className="h-8 w-8" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {original.user.firstName ?? original.user.username}
                {original.user.isVerified && <span className="ml-1 text-amber-400">✓</span>}
              </p>
              <p className="text-xs text-muted-foreground">@{original.user.username} · {timeAgo(original.createdAt)}</p>
            </div>
          </div>
          {original.body && (
            <p className="whitespace-pre-wrap break-words px-3 pb-2.5 text-sm leading-relaxed">{original.body}</p>
          )}
          {original.mediaUrl && (
            <MediaImg src={original.mediaUrl} alt="Original post media" className="max-h-96 w-full object-cover" />
          )}
        </div>
      )}

      {!original && post.mediaUrl && (
        <MediaImg src={post.mediaUrl} alt="Post media" className="max-h-[520px] w-full object-cover" />
      )}

      <div className="flex items-center gap-1 p-2">
        {/* heart = like, broken heart = dislike right beside it */}
        <Button
          variant="ghost" size="sm"
          className={cn('relative rounded-full', liked && 'text-rose-500')}
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          {/* micro-interaction: heart particles burst on like */}
          <AnimatePresence>
            {burst > 0 && (
              <motion.span
                key={burst}
                className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ opacity: 0 }}
                aria-hidden
              >
                {BURST_ANGLES.map((deg, i) => (
                  <motion.span
                    key={`${burst}-${i}`}
                    className="absolute text-rose-500"
                    style={{ left: 0, top: 0 }}
                    initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                    animate={{
                      x: Math.cos((deg * Math.PI) / 180) * 26,
                      y: Math.sin((deg * Math.PI) / 180) * 26,
                      scale: [0.4, 1.1, 0.5],
                      opacity: 0,
                      rotate: (i % 2 ? 1 : -1) * 40,
                    }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                  >
                    <Heart className="h-3 w-3 fill-current" />
                  </motion.span>
                ))}
              </motion.span>
            )}
          </AnimatePresence>
          <motion.span
            key={`heart-${liked}`}
            initial={liked ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="mr-1.5 inline-flex"
          >
            <Heart className={cn('h-4.5 w-4.5', liked && 'fill-current')} />
          </motion.span>
          {likes}
        </Button>
        <Button
          variant="ghost" size="sm"
          className={cn('rounded-full', disliked && 'text-sky-500')}
          onClick={toggleDislike}
          aria-pressed={disliked}
          aria-label={disliked ? 'Remove broken heart' : 'Broken heart — dislike'}
        >
          <HeartCrack className={cn('mr-1.5 h-4.5 w-4.5', disliked && 'fill-current')} />
          {dislikes}
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setCommentsOpen(true)}>
          <MessageCircle className="mr-1.5 h-4 w-4" />
          {commentsCount}
        </Button>
        <Button
          variant="ghost" size="sm"
          className={cn('rounded-full', reshared && 'text-emerald-400')}
          onClick={() => setReshareOpen(true)}
          aria-label="Reshare to your feed"
        >
          <Repeat2 className="mr-1.5 h-4 w-4" />
          {reshares}
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void sharePost(post)} aria-label="Share post">
          <Share2 className="mr-1.5 h-4 w-4" />
          Share
        </Button>
        <Button
          variant="ghost" size="sm"
          className={cn('rounded-full', bookmarked && 'text-amber-400')}
          onClick={toggleBookmark}
          aria-label={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
        >
          <Bookmark className={cn('mr-1.5 h-4 w-4', bookmarked && 'fill-current')} />
          {bookmarked ? 'Saved' : 'Save'}
        </Button>
        {post.contest && (
          <Button variant="ghost" size="sm" className={cn('ml-auto rounded-full', voted ? 'text-amber-400' : 'text-muted-foreground')} onClick={toggleVote}>
            ▲ {votes} votes
          </Button>
        )}
      </div>

      <CommentsDialog post={post} open={commentsOpen} onOpenChange={setCommentsOpen} onCountChange={(d) => setCommentsCount((c) => c + d)} />
      <ReshareDialog post={post} open={reshareOpen} onOpenChange={setReshareOpen} onReshared={onResharedLocal} />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        targetId={post.id}
        label={`@${post.user.username}'s post`}
      />
    </article>
  )
}

// heart-burst particle directions (8 points around the button)
const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

// ---------------- report dialog (Task 23) ----------------

const REPORT_REASONS = [
  { key: 'spam', label: 'Spam or scam' },
  { key: 'abuse', label: 'Abuse or harassment' },
  { key: 'nsfw', label: 'Adult content' },
  { key: 'scam', label: 'Impersonation' },
  { key: 'other', label: 'Something else' },
] as const

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  label,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  targetType: 'post' | 'user' | 'message'
  targetId: number
  label: string
}) {
  const [reason, setReason] = useState<string>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, details }),
      })
      const data = await res.json()
      if (data.ok) {
        sonner.success('Report sent to the pit bosses — thank you 🛡️')
        setDetails('')
        onOpenChange(false)
      } else {
        sonner.error(data.error ?? 'Could not send report')
      }
    } catch {
      sonner.error('Could not send report — network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-amber-400" /> Report {label}
          </DialogTitle>
          <DialogDescription>
            The moderators (pit bosses) review every report. Your name stays private.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5" role="radiogroup" aria-label="Report reason">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.key}
              role="radio"
              aria-checked={reason === r.key}
              onClick={() => setReason(r.key)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition',
                reason === r.key
                  ? 'border-amber-400/60 bg-amber-400/10 font-semibold'
                  : 'border-border hover:bg-accent/60'
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border',
                  reason === r.key ? 'border-amber-400 bg-amber-400' : 'border-muted-foreground/50'
                )}
              >
                {reason === r.key && <Check className="h-3 w-3 text-black" />}
              </span>
              {r.label}
            </button>
          ))}
        </div>
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Extra details for the moderators (optional)"
          maxLength={500}
          className="min-h-16 resize-none"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            data-testid="report-submit"
            className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500"
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Flag className="mr-1 h-4 w-4" />}
            Send report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- feed ----------------

// Infinite loop pagination: pages load as you scroll; when the API runs out
// the feed wraps back to the top (endless loop) until MAX_CYCLES repeats.
const PAGE_SIZE = 10
const MAX_CYCLES = 6

interface FeedItem extends PostDTO {
  uid: string // unique per feed instance (allows looped duplicates)
}

export function FeedView({ onOpenProfile }: { onOpenProfile: (username: string) => void }) {
  const me = useAppStore((s) => s.me)
  const feedRefreshKey = useAppStore((s) => s.feedRefreshKey)
  const [posts, setPosts] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [ended, setEnded] = useState(false)
  const [deepHighlight, setDeepHighlight] = useState<number | null>(null)
  const [storyGroups, setStoryGroups] = useState<StoryGroupDTO[]>([])
  const [storyOpen, setStoryOpen] = useState<number | null>(null)
  const [createStoryOpen, setCreateStoryOpen] = useState(false)

  const cursorRef = useRef<{ cursor: number | null; cycle: number }>({ cursor: null, cycle: 0 })
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const { cursor, cycle } = cursorRef.current
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (cursor) qs.set('cursor', String(cursor))
      const res = await fetch(`/api/posts?${qs}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        const fresh: FeedItem[] = data.posts.map((p: PostDTO, i: number) => ({
          ...p,
          uid: `${p.id}c${cycle}i${i}`,
        }))
        setPosts((prev) => [...prev, ...fresh])
        if (data.nextCursor) {
          cursorRef.current.cursor = data.nextCursor
        } else if (cycle + 1 < MAX_CYCLES) {
          // loop back to the newest post — the table never closes ♾
          cursorRef.current.cursor = null
          cursorRef.current.cycle = cycle + 1
        } else {
          setEnded(true)
        }
      }
    } catch {
      sonner.error('Could not load feed — you may be offline')
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
      setLoading(false)
    }
  }, [])

  const resetFeed = useCallback(() => {
    cursorRef.current = { cursor: null, cycle: 0 }
    setEnded(false)
    setPosts([])
    setLoading(true)
    void loadMore()
  }, [loadMore])

  const loadStories = useCallback(async () => {
    try {
      const res = await fetch('/api/stories', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setStoryGroups(data.groups)
    } catch { /* offline */ }
  }, [])

  useEffect(() => {
    void loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedRefreshKey])

  // Shared links land here as /?post=123: pull that post to the top of
  // the feed (with its picture) and flash an amber highlight so the
  // recipient actually sees the shared post, not just the feed top.
  useEffect(() => {
    if (loading) return
    const raw = new URLSearchParams(window.location.search).get('post')
    const id = parseInt(raw ?? '', 10)
    if (!Number.isInteger(id) || id <= 0) return
    window.history.replaceState(null, '', window.location.pathname)
    // Media above the target (stories/composer/post images) keeps growing
    // the layout while it loads, which would otherwise push the shared post
    // out of view — re-center a few times, then drop the highlight.
    // setTimeout rather than rAF: timers fire even without frame output.
    const flash = (attempt: number) => {
      const el = document.querySelector(`[data-post-id="${id}"]`)
      if (el) el.scrollIntoView({ block: 'center' })
      setDeepHighlight(id)
      if (attempt < 7) setTimeout(() => flash(attempt + 1), 500)
      else setTimeout(() => setDeepHighlight(null), 1800)
    }
    if (posts.some((p) => p.id === id)) {
      setTimeout(() => flash(0), 50)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/posts/${id}`, { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled && data.ok && data.post) {
          setPosts((prev) =>
            prev.some((p) => p.id === id) ? prev : [{ ...data.post, uid: `deep${id}` }, ...prev]
          )
          setTimeout(() => flash(0), 80)
        }
      } catch { /* offline */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    void loadStories()
    const t = setInterval(loadStories, 60_000) // stories expire with time
    return () => clearInterval(t)
  }, [loadStories])

  // infinite scroll — sentinel just below the viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || loading || ended) return
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && void loadMore(),
      { rootMargin: '600px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [posts.length, loading, ended, loadMore])

  // ---- pull-to-refresh (mobile, Task 23) -------------------------------
  // When the feed is at the very top, dragging down past the threshold
  // reloads page 1 with a springy indicator. Horizontal drags (stories
  // pager) never trigger it.
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const ptr = useRef({ startY: 0, active: false, horiz: false })
  const PTR_THRESHOLD = 90

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) return
      const t = e.touches[0]
      ptr.current = { startY: t.clientY, active: true, horiz: false }
    }
    const onMove = (e: TouchEvent) => {
      if (!ptr.current.active || refreshing) return
      const t = e.touches[0]
      const dy = t.clientY - ptr.current.startY
      const dx = Math.abs(t.clientX - (ptr.current.lastX ?? t.clientX))
      if (Math.abs(dy) > 12 && dx > Math.abs(dy)) ptr.current.horiz = true
      ptr.current.lastX = t.clientX
      if (ptr.current.horiz || dy <= 0) {
        if (pull) setPull(0)
        return
      }
      // rubber-band resistance
      setPull(Math.min(140, dy * 0.55))
    }
    const onEnd = () => {
      ptr.current.active = false
      setPull((p) => {
        if (p >= PTR_THRESHOLD) {
          setRefreshing(true)
          resetFeed()
          setTimeout(() => setRefreshing(false), 700)
        }
        return 0
      })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [pull, refreshing, resetFeed])

  return (
    <div>
      {/* pull-to-refresh indicator (touch devices only) */}
      <div
        className="pointer-events-none sticky top-0 z-30 flex justify-center transition-opacity"
        style={{
          opacity: pull > 8 || refreshing ? 1 : 0,
          transform: `translateY(${refreshing ? 10 : Math.min(46, pull * 0.4)}px)`,
        }}
        aria-hidden
      >
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/90 shadow-lg backdrop-blur',
            pull >= PTR_THRESHOLD || refreshing ? 'text-amber-400' : 'text-muted-foreground'
          )}
        >
          <Loader2
            className={cn('h-4.5 w-4.5', (refreshing || pull >= PTR_THRESHOLD) && 'animate-spin')}
          />
        </span>
      </div>

      <StoriesBar
        groups={storyGroups}
        myName={me?.username ?? 'you'}
        myAvatar={me?.avatarUrl}
        onCreateClick={() => setCreateStoryOpen(true)}
        onOpen={(i) => setStoryOpen(i)}
      />
      <Composer onPosted={resetFeed} />

      {loading ? (
        // first-paint skeletons — mirror the post card shape (Task 23)
        <div aria-label="Loading feed" data-testid="feed-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse border-b border-border bg-card/40 p-4" style={{ animationDelay: `${i * 120}ms` }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-accent" />
                  <div className="h-2.5 w-20 rounded bg-accent/70" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full rounded bg-accent/80" />
                <div className="h-3 w-4/5 rounded bg-accent/60" />
              </div>
              <div className="mt-3 h-44 w-full rounded-xl bg-accent/50" />
              <div className="mt-3 flex gap-4">
                <div className="h-6 w-14 rounded-full bg-accent" />
                <div className="h-6 w-14 rounded-full bg-accent" />
                <div className="h-6 w-14 rounded-full bg-accent" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-4xl">🃏</p>
          <p className="mt-3">The table is empty. Post something!</p>
        </div>
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.uid}
            post={p}
            onDelete={(id) => setPosts((list) => list.filter((x) => x.id !== id))}
            onOpenProfile={onOpenProfile}
            onReshared={resetFeed}
            highlight={deepHighlight === p.id}
          />
        ))
      )}

      {/* infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-px w-full" />
      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      )}
      {ended && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-3xl">🎰</p>
          <p className="text-sm text-muted-foreground">You&apos;ve reached the bottom of the shoe.</p>
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Deal me in from the top
          </Button>
        </div>
      )}

      {storyOpen !== null && (
        <StoryViewer
          groups={storyGroups}
          startGroup={storyOpen}
          onClose={() => { setStoryOpen(null); void loadStories() }}
        />
      )}
      <CreateStoryDialog open={createStoryOpen} onOpenChange={setCreateStoryOpen} onCreated={() => { void loadStories() }} />
    </div>
  )
}
