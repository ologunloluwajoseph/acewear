'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AceAvatar, MediaImg, timeAgo } from '@/components/ace/media'
import type { PostDTO } from '@/lib/types'
import { toast as sonner } from 'sonner'
import { useAppStore } from '@/lib/client-store'
import { cn } from '@/lib/utils'

export function BookmarksView({ onOpenProfile }: { onOpenProfile: (username: string) => void }) {
  const [posts, setPosts] = useState<PostDTO[]>([])
  const [loading, setLoading] = useState(true)
  const setView = useAppStore((s) => s.setView)

  const loadBookmarks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bookmarks', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setPosts(data.posts)
      } else {
        sonner.error(data.error ?? 'Failed to load bookmarks')
      }
    } catch {
      sonner.error('Network error loading bookmarks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBookmarks()
  }, [loadBookmarks])

  const removeBookmark = async (postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    try {
      const res = await fetch(`/api/posts/${postId}/bookmark`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.info('Removed from bookmarks')
      } else {
        void loadBookmarks()
      }
    } catch {
      void loadBookmarks()
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
            <Bookmark className="h-5 w-5 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Saved &amp; Bookmarks</h1>
            <p className="text-xs text-muted-foreground">Posts you saved for quick access</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadBookmarks()}
          className="rounded-full text-xs font-medium"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="mt-3 text-sm font-medium">Loading your saved collection…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
            <Bookmark className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold">No Bookmarks Yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Tap the bookmark icon on any post in your feed to save it here for offline reading or quick reference.
          </p>
          <Button
            onClick={() => setView('feed')}
            className="mt-6 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Explore Feed
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-400/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => onOpenProfile(post.user.username)} className="shrink-0">
                    <AceAvatar user={post.user} className="h-10 w-10" />
                  </button>
                  <div>
                    <button
                      onClick={() => onOpenProfile(post.user.username)}
                      className="flex items-center gap-1 text-sm font-semibold hover:underline"
                    >
                      {post.user.firstName ?? post.user.username}
                      {post.user.isVerified && <span className="text-amber-400">✓</span>}
                      {post.user.isPro && (
                        <span className="rounded bg-amber-400/15 px-1 text-[10px] font-bold text-amber-400">
                          PRO
                        </span>
                      )}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      @{post.user.username} · {timeAgo(post.createdAt)}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeBookmark(post.id)}
                  className="rounded-full text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Remove bookmark"
                >
                  <Bookmark className="mr-1 h-4 w-4 fill-current text-amber-400" />
                  Remove
                </Button>
              </div>

              {post.body && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                  {post.body}
                </p>
              )}

              {post.mediaUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border border-border">
                  <MediaImg
                    src={post.mediaUrl}
                    alt="Saved post media"
                    className="max-h-80 w-full object-cover"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
