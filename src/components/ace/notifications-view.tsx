'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCheck, Heart, Loader2, MessageCircle, Trophy, UserPlus, Megaphone, ShoppingBag, Star, Filter } from 'lucide-react'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { AceAvatar, timeAgo } from '@/components/ace/media'
import type { NotificationDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore, type AceView } from '@/lib/client-store'

const ICONS: Record<string, React.ReactNode> = {
  like: <Heart className="h-4 w-4 text-rose-400" />,
  comment: <MessageCircle className="h-4 w-4 text-sky-400" />,
  follow: <UserPlus className="h-4 w-4 text-emerald-400" />,
  vote: <Star className="h-4 w-4 text-amber-400" />,
  contest_win: <Trophy className="h-4 w-4 text-amber-400" />,
  system: <Megaphone className="h-4 w-4 text-fuchsia-400" />,
  message: <MessageCircle className="h-4 w-4 text-teal-400" />,
  purchase: <ShoppingBag className="h-4 w-4 text-emerald-400" />,
  review: <Star className="h-4 w-4 text-amber-400" />,
}

type FilterTab = 'all' | 'likes' | 'comments' | 'follows' | 'system'

export function NotificationsView() {
  const setUnread = useAppStore((s) => s.setUnread)
  const setView = useAppStore((s) => s.setView)
  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setNotifications(data.notifications)
        setUnread({ unreadNotifications: data.unreadCount })
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false)
    }
  }, [setUnread])

  useEffect(() => {
    void load()
  }, [load])

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => null)
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })))
    setUnread({ unreadNotifications: 0 })
    sonner.success('All caught up ✓')
  }

  const handleNotificationClick = (n: NotificationDTO) => {
    // If not read, mark as read locally
    if (!n.isRead) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)))
    }

    if (n.targetType === 'post' && n.targetId) {
      setView('feed')
      const url = new URL(window.location.href)
      url.searchParams.set('post', String(n.targetId))
      window.history.replaceState(null, '', url.toString())
      window.dispatchEvent(new PopStateEvent('popstate'))
    } else if (n.type === 'follow' && n.actor) {
      setView('feed')
    } else if (n.type === 'message') {
      setView('messages')
    } else if (n.type === 'contest_win') {
      setView('contests')
    } else if (n.type === 'purchase') {
      setView('shop')
    }
  }

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications
    if (filter === 'likes') return notifications.filter((n) => n.type === 'like' || n.type === 'vote')
    if (filter === 'comments') return notifications.filter((n) => n.type === 'comment')
    if (filter === 'follows') return notifications.filter((n) => n.type === 'follow')
    if (filter === 'system') return notifications.filter((n) => ['system', 'contest_win', 'purchase', 'review'].includes(n.type))
    return notifications
  }, [notifications, filter])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'likes', label: 'Likes & Votes' },
    { key: 'comments', label: 'Comments' },
    { key: 'follows', label: 'Follows' },
    { key: 'system', label: 'System' },
  ]

  return (
    <div className="space-y-4 p-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Notifications 🔔</h2>
        <Button variant="ghost" size="sm" className="rounded-full text-xs font-semibold" onClick={markAllRead}>
          <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/60 pb-3" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={filter === t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-bold transition',
              filter === t.key
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                : 'bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Bell className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3 text-sm font-medium">No notifications in this tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 backdrop-blur transition hover:bg-accent/60',
                  n.isRead ? 'bg-card/40 border border-border/40' : 'bg-amber-400/[0.08] border border-amber-400/30'
                )}
              >
                {n.actor ? (
                  <AceAvatar user={n.actor} className="h-10 w-10 shrink-0" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10">
                    {ICONS[n.type] ?? <Bell className="h-5 w-5 text-amber-400" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-foreground">{n.text}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {ICONS[n.type]}
                    <span className="capitalize">{n.type.replace('_', ' ')}</span> · {timeAgo(n.createdAt)}
                  </p>
                </div>
                {!n.isRead && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
