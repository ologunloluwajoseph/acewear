'use client'

// =====================================================================
// Search — global people + posts search (Task 23).
//   GET /api/search?q=...   users (username/first name) + posts (body)
// Block-aware + banned-filtered server-side; debounced client-side.
// Tapping a person opens their profile, tapping a post deep-links it.
// =====================================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Hash, Heart, Loader2, MessageCircle, Search as SearchIcon, UserPlus, X } from 'lucide-react'
import { toast as sonner } from 'sonner'
import { AceAvatar } from '@/components/ace/media'
import { useAppStore, type AceView } from '@/lib/client-store'
import type { SessionUser } from '@/lib/auth'

interface SearchUser {
  id: number
  username: string
  firstName: string | null
  avatarUrl: string | null
  bio: string | null
  isVerified: boolean
  isPro: boolean
}

interface SearchPost {
  id: number
  body: string | null
  mediaUrl: string | null
  mediaType: string
  likesCount: number
  commentsCount: number
  createdAt: string
  user: SearchUser
}

type Tab = 'people' | 'posts'

export function SearchView({ onOpenProfile }: { onOpenProfile: (username: string) => void }) {
  const setView = useAppStore((s) => s.setView)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('people')
  const [users, setUsers] = useState<SearchUser[]>([])
  const [posts, setPosts] = useState<SearchPost[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  // autofocus once mounted
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const query = q.trim()
    if (!query) return // cleared — render-side derives empty lists, no setState needed
    const mine = ++seq.current
    const t = setTimeout(() => {
      if (seq.current !== mine) return
      // loading flips inside the debounced callback — no sync setState in
      // the effect body (react-hooks/set-state-in-effect)
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (seq.current !== mine) return // a newer query already resolved
          if (d.ok) {
            setUsers(d.users ?? [])
            setPosts(d.posts ?? [])
          } else {
            sonner.error(d.error ?? 'Search failed')
          }
        })
        .catch(() => null)
        .finally(() => {
          if (seq.current === mine) setLoading(false)
        })
    }, 220) // debounce while typing
    return () => clearTimeout(t)
  }, [q])

  const hasQuery = q.trim().length > 0
  // stale results from a previous query never leak into a cleared box
  const shownUsers = hasQuery ? users : []
  const shownPosts = hasQuery ? posts : []
  const resultsLabel =
    tab === 'people'
      ? `${users.length} ${users.length === 1 ? 'player' : 'players'}`
      : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`

  return (
    <div className="space-y-4 p-4 pb-8" data-testid="search-page">
      {/* search bar */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 80))}
          onKeyDown={(e) => e.key === 'Escape' && setQ('')}
          placeholder="Search players, posts, #hashtags…"
          aria-label="Search ACE"
          data-testid="search-input"
          className="h-12 w-full rounded-full border border-border bg-card/60 pl-12 pr-11 text-sm outline-none backdrop-blur transition focus:border-amber-400/50"
        />
        {hasQuery && (
          <button
            onClick={() => { setQ(''); setUsers([]); setPosts([]); setLoading(false) }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* tabs */}
      {hasQuery && (
        <div className="flex gap-2" role="tablist" aria-label="Search result type">
          {(
            [
              { key: 'people', label: 'People', icon: <UserPlus className="h-3.5 w-3.5" /> },
              { key: 'posts', label: 'Posts', icon: <Hash className="h-3.5 w-3.5" /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]
          ).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
          {!loading && (
            <span className="ml-auto self-center text-[11px] font-semibold text-muted-foreground">
              {resultsLabel}
            </span>
          )}
        </div>
      )}

      {/* results */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      )}

  // Trending data when search query is empty
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<SearchUser[]>([])
  const [hotPosts, setHotPosts] = useState<SearchPost[]>([])
  const [loadingTrending, setLoadingTrending] = useState(false)

  useEffect(() => {
    if (hasQuery) return
    setLoadingTrending(true)
    fetch('/api/trending', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setTrendingTags(d.trendingTags ?? [])
          setSuggestedUsers(d.suggestedUsers ?? [])
          setHotPosts(d.hotPosts ?? [])
        }
      })
      .catch(() => null)
      .finally(() => setLoadingTrending(false))
  }, [hasQuery])

  return (
    <div className="space-y-4 p-4 pb-8" data-testid="search-page">
      {/* search bar */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 80))}
          onKeyDown={(e) => e.key === 'Escape' && setQ('')}
          placeholder="Search players, posts, #hashtags…"
          aria-label="Search ACE"
          data-testid="search-input"
          className="h-12 w-full rounded-full border border-border bg-card/60 pl-12 pr-11 text-sm outline-none backdrop-blur transition focus:border-amber-400/50"
        />
        {hasQuery && (
          <button
            onClick={() => { setQ(''); setUsers([]); setPosts([]); setLoading(false) }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* tabs */}
      {hasQuery && (
        <div className="flex gap-2" role="tablist" aria-label="Search result type">
          {(
            [
              { key: 'people', label: 'People', icon: <UserPlus className="h-3.5 w-3.5" /> },
              { key: 'posts', label: 'Posts', icon: <Hash className="h-3.5 w-3.5" /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]
          ).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
          {!loading && (
            <span className="ml-auto self-center text-[11px] font-semibold text-muted-foreground">
              {resultsLabel}
            </span>
          )}
        </div>
      )}

      {/* results */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      )}

      {!loading && !hasQuery && (
        <div className="space-y-6 pt-2">
          {/* Trending Hashtags */}
          <div className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <span className="text-amber-400">🔥</span> Trending Topics
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {trendingTags.length > 0 ? (
                trendingTags.map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setQ(t.tag)}
                    className="flex items-center gap-1.5 rounded-full bg-accent/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-400/20 hover:text-amber-400"
                  >
                    <Hash className="h-3 w-3 text-amber-400" />
                    <span>{t.tag.replace('#', '')}</span>
                    <span className="text-[10px] text-muted-foreground">({t.count})</span>
                  </button>
                ))
              ) : (
                ['#casino', '#poker', '#crypto', '#win', '#vibes', '#lifestyle', '#acepro'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQ(tag)}
                    className="flex items-center gap-1.5 rounded-full bg-accent/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-400/20 hover:text-amber-400"
                  >
                    <Hash className="h-3 w-3 text-amber-400" />
                    <span>{tag.replace('#', '')}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Suggested Creators */}
          {suggestedUsers.length > 0 && (
            <div className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <span className="text-amber-400">✨</span> Suggested Players
              </h3>
              <div className="mt-3 space-y-2">
                {suggestedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl p-2 transition hover:bg-accent/40"
                  >
                    <button
                      onClick={() => onOpenProfile(u.username)}
                      className="flex items-center gap-3 text-left"
                    >
                      <AceAvatar user={u as unknown as SessionUser} className="h-10 w-10" />
                      <div>
                        <p className="flex items-center gap-1 text-sm font-bold">
                          {u.firstName ?? u.username}
                          {u.isVerified && <BadgeCheckMini />}
                          {u.isPro && (
                            <span className="rounded bg-amber-400/15 px-1 text-[9px] font-bold text-amber-400">
                              PRO
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => onOpenProfile(u.username)}
                      className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-400 hover:bg-amber-400/20"
                    >
                      View Profile
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && hasQuery && tab === 'people' && (
        <div className="space-y-2">
          {shownUsers.map((u, i) => (
            <motion.button
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onOpenProfile(u.username)}
              data-testid={`search-user-${u.username}`}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/50 p-3 text-left backdrop-blur transition hover:border-amber-400/40"
            >
              <AceAvatar user={u as unknown as SessionUser} className="h-11 w-11" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  {u.firstName ?? u.username}
                  {u.isVerified && <BadgeCheckMini />}
                  {u.isPro && <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black text-amber-400">PRO</span>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{u.username}
                  {u.bio ? ` · ${u.bio}` : ''}
                </span>
              </span>
            </motion.button>
          ))}
          {shownUsers.length === 0 && <EmptyRow label="No players matched." />}
        </div>
      )}

      {!loading && hasQuery && tab === 'posts' && (
        <div className="space-y-2">
          {shownPosts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <button
                onClick={() => {
                  setView('feed')
                  // deep-link highlight via the feed's ?post= handler
                  const url = new URL(window.location.href)
                  url.searchParams.set('post', String(p.id))
                  window.history.replaceState(null, '', url.toString())
                  window.dispatchEvent(new PopStateEvent('popstate'))
                }}
                data-testid={`search-post-${p.id}`}
                className="w-full rounded-2xl border border-border bg-card/50 p-3 text-left backdrop-blur transition hover:border-amber-400/40"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <AceAvatar user={p.user as unknown as SessionUser} className="h-5 w-5" />
                  @{p.user.username}
                  <span aria-hidden>·</span>
                  <time>{new Date(p.createdAt).toLocaleDateString()}</time>
                </span>
                {p.body && <span className="mt-1.5 line-clamp-3 block text-sm">{p.body}</span>}
                {p.mediaUrl && p.mediaType === 'image' && (
                  <img
                    src={p.mediaUrl}
                    alt=""
                    loading="lazy"
                    className="mt-2 max-h-48 w-full rounded-xl object-cover"
                  />
                )}
                <span className="mt-2 flex items-center gap-4 text-[11px] font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {p.likesCount}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {p.commentsCount}</span>
                </span>
              </button>
            </motion.div>
          ))}
          {shownPosts.length === 0 && <EmptyRow label="No posts matched." />}
        </div>
      )}

      {/* subtle escape hatch */}
      {hasQuery && (
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Looking for something else?{' '}
          <Link href="/" className="underline underline-offset-2" onClick={() => setView('feed')}>
            back to the feed
          </Link>
        </p>
      )}
    </div>
  )
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  )
}

function BadgeCheckMini() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-sky-500" aria-label="Verified">
      <path d="M12 1.5 14.8 4l3.7-.4 1.2 3.5 3 2.2-1.3 3.5 1.3 3.5-3 2.2-1.2 3.5-3.7-.4L12 24l-2.8-2.5-3.7.4-1.2-3.5-3-2.2L2.6 12 1.3 8.5l3-2.2L5.5 2.8l3.7.4L12 1.5z" />
      <path d="m10.6 15.7-2.8-2.8 1.4-1.4 1.4 1.4 4-4 1.4 1.4-5.4 5.4z" fill="#fff" />
    </svg>
  )
}
