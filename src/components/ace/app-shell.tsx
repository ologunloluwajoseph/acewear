'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { toast as sonner } from 'sonner'
import {
  Bell, Bookmark, Clapperboard, Coins, Crown, FileText, Home, LayoutDashboard, LifeBuoy, LogOut, Menu, MessageCircle,
  Palette, Search, Settings, Shield, ShoppingBag, Trophy, User as UserIcon, UserCog, Wallet, Wifi, WifiOff, X,
} from 'lucide-react'
import type { RealtimeEvent } from '@/lib/events'
import { useAppStore, type AceView } from '@/lib/client-store'
import { useRealtime } from '@/hooks/use-realtime'
import { clearToken } from '@/lib/session-token'
import { applyBrightness, applyTheme, canUsePremium, getStoredBrightness, getStoredTheme, premiumTier, type ThemeId } from '@/lib/theme'
import { AceAvatar } from '@/components/ace/media'
import { FeedView } from '@/components/ace/feed-view'
import { ReelsView } from '@/components/ace/reels-view'
import { SearchView } from '@/components/ace/search-view'
import { ContestsView } from '@/components/ace/contests-view'
import { ShopView } from '@/components/ace/shop-view'
import { MessagesView } from '@/components/ace/messages-view'
import { NotificationsView } from '@/components/ace/notifications-view'
import { BookmarksView } from '@/components/ace/bookmarks-view'
import { ProfileView, UserProfileDialog } from '@/components/ace/profile-view'
import { AdminView } from '@/components/ace/admin-view'
import { DashboardView } from '@/components/ace/dashboard-view'
import { SettingsView } from '@/components/ace/settings-view'
import { PremiumView } from '@/components/ace/premium-view'
import { ThemesView } from '@/components/ace/themes-view'
import type { RealtimeMessagePayload } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// One unified menu — the desktop sidebar renders all of it; on mobile the
// five primary tabs live in the sticky bottom bar and the hamburger drawer
// holds the secondary destinations.
const MENU: { key: AceView; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { key: 'feed', label: 'Feed', icon: <Home className="h-5 w-5" /> },
  { key: 'reels', label: 'Reels', icon: <Clapperboard className="h-5 w-5" /> },
  { key: 'search', label: 'Search', icon: <Search className="h-5 w-5" /> },
  { key: 'contests', label: 'Contests', icon: <Trophy className="h-5 w-5" /> },
  { key: 'shop', label: 'Shop', icon: <ShoppingBag className="h-5 w-5" /> },
  { key: 'messages', label: 'Chat', icon: <MessageCircle className="h-5 w-5" /> },
  { key: 'notifications', label: 'Alerts', icon: <Bell className="h-5 w-5" /> },
  { key: 'bookmarks', label: 'Saved', icon: <Bookmark className="h-5 w-5" /> },
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { key: 'profile', label: 'Profile', icon: <UserIcon className="h-5 w-5" /> },
  { key: 'premium', label: 'Premium', icon: <Crown className="h-5 w-5 text-amber-400" /> },
  { key: 'themes', label: 'Themes', icon: <Palette className="h-5 w-5" /> },
  { key: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  { key: 'admin', label: 'Admin', icon: <Shield className="h-5 w-5" />, adminOnly: true },
]

// Sticky mobile bottom bar (thumb-reach primary tabs)
const BOTTOM_KEYS: AceView[] = ['feed', 'reels', 'contests', 'shop', 'messages', 'notifications']

export type SettingsTab = 'account' | 'payouts' | 'privacy' | 'legal'

// ---------------- help & support dialog ----------------

function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-amber-400" /> Help &amp; Support
          </DialogTitle>
          <DialogDescription>We deal with every issue — pick a channel.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-border p-3">
            <p className="font-semibold">Support</p>
            <p className="mt-0.5 text-muted-foreground">
              Email <span className="font-mono text-foreground">support@ace.social</span> — replies within 24h.
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="font-semibold">Payout questions</p>
            <p className="mt-0.5 text-muted-foreground">
              Withdrawals are reviewed in order. Check status under Payment account → withdrawal history.
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="font-semibold">Safety &amp; reporting</p>
            <p className="mt-0.5 text-muted-foreground">
              Report any post or account violating our rules — moderators act within hours. See Terms &amp; Privacy for the full policy.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AppShell() {
  const me = useAppStore((s) => s.me)
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const setMe = useAppStore((s) => s.setMe)
  const unreadNotifications = useAppStore((s) => s.unreadNotifications)
  const unreadMessages = useAppStore((s) => s.unreadMessages)
  const setUnread = useAppStore((s) => s.setUnread)
  const refreshMe = useAppStore((s) => s.refreshMe)
  const bumpFeedRefresh = useAppStore((s) => s.bumpFeedRefresh)
  const pushToast = useAppStore((s) => s.pushToast)
  const toasts = useAppStore((s) => s.toasts)
  const dismissToast = useAppStore((s) => s.dismissToast)
  const emitRealtime = useAppStore((s) => s.emitRealtime)
  const [profileDialog, setProfileDialog] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('account')
  const [helpOpen, setHelpOpen] = useState(false)
  // SSR-safe lazy init: getStoredTheme falls back to 'dark' on the server,
  // and the client's first render reads the persisted choice directly —
  // no setState-in-effect mount dance needed.
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme())
  const router = useRouter()

  // Apply the theme to the document (external system) + repaint the
  // per-theme brightness veil on every theme switch. An unentitled stored
  // 'premium' (PRO expired while it was saved) is coerced via render-time
  // derivation instead of a setState-in-effect correction dance.
  const activeTheme: ThemeId =
    theme === 'premium' && me && !canUsePremium(me) ? 'dark' : theme

  useEffect(() => {
    applyTheme(activeTheme)
    applyBrightness(activeTheme, getStoredBrightness(activeTheme))
  }, [activeTheme, me])

  const openProfile = (username: string) => setProfileDialog(username)

  const selectView = (key: AceView) => {
    setView(key)
    setMenuOpen(false)
  }

  const selectTheme = (t: ThemeId) => {
    if (t === 'premium' && !canUsePremium(me)) {
      sonner.error('Transparent mode is for Premium members — upgrade to PRO in the Shop ✦')
      return
    }
    setTheme(t)
  }

  const openSettingsTab = (tab: SettingsTab) => {
    setSettingsTab(tab)
    setView('settings')
    setMenuOpen(false)
  }

  const quickLinks: { label: string; icon: React.ReactNode; action: () => void }[] = [
    { label: 'Account details', icon: <UserCog className="h-4.5 w-4.5" />, action: () => openSettingsTab('account') },
    { label: 'Payment account', icon: <Wallet className="h-4.5 w-4.5" />, action: () => openSettingsTab('payouts') },
    { label: 'Terms & Privacy', icon: <FileText className="h-4.5 w-4.5" />, action: () => openSettingsTab('legal') },
    { label: 'Help & Support', icon: <LifeBuoy className="h-4.5 w-4.5" />, action: () => { setHelpOpen(true); setMenuOpen(false) } },
  ]

  const logout = async () => {
    setMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    clearToken()
    setMe(null)
    router.refresh()
  }

  // ---- Deliverable 2: connect the SSE listener (JS side) ----
  const { connected } = useRealtime((event: RealtimeEvent) => {
    // 1. fan out to subscribed views (messages, etc.)
    emitRealtime(event)

    // 2. global badge + toast handling
    switch (event.type) {
      case 'notification': {
        const n = event.payload as { text: string; type: string } | null
        const unreadCount = (event as { unreadCount?: number }).unreadCount
        if (typeof unreadCount === 'number') setUnread({ unreadNotifications: unreadCount })
        if (n) {
          pushToast({ title: 'New activity', body: n.text })
          if (view === 'notifications') bumpFeedRefresh()
        }
        break
      }
      case 'message': {
        const m = event.payload as RealtimeMessagePayload | null
        if (m && m.senderId !== me?.id) {
          setUnread({ unreadMessages: useAppStore.getState().unreadMessages + 1 })
        }
        break
      }
      case 'unread': {
        const p = event.payload as { unreadNotifications: number; unreadMessages: number }
        setUnread(p)
        break
      }
      case 'read': {
        if (me) setUnread({ unreadMessages: Math.max(0, useAppStore.getState().unreadMessages) })
        break
      }
      default:
        break
    }
  }, Boolean(me))

  // seed unread counters + coins on mount
  useEffect(() => {
    void refreshMe()
    fetch('/api/realtime/poll', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setUnread({ unreadNotifications: d.unreadNotifications, unreadMessages: d.unreadMessages })
      })
      .catch(() => null)
  }, [refreshMe, setUnread])

  // hamburger drawer: escape to close + body scroll lock
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  // auto-close the drawer when the viewport grows into desktop layout
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => mq.matches && setMenuOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (!me) return null

  const items = MENU.filter((n) => !n.adminOnly || me.isAdmin)
  // chip on the Premium menu entry: PRO for members, TRIAL while the
  // 3-day free trial is burning, PRO as the upsell once it expires
  const premiumChip = premiumTier(me) === 'member' ? 'PRO' : premiumTier(me) === 'trial' ? 'TRIAL' : 'PRO'
  const drawerItems = items.filter((n) => !BOTTOM_KEYS.includes(n.key))
  const bottomItems = BOTTOM_KEYS
    .map((k) => items.find((n) => n.key === k))
    .filter((n): n is (typeof MENU)[number] => Boolean(n))
  const badgeFor = (key: AceView) =>
    key === 'notifications' ? unreadNotifications : key === 'messages' ? unreadMessages : 0

  const liveTag = connected
    ? <><Wifi className="h-3 w-3 text-emerald-400" /> live</>
    : <><WifiOff className="h-3 w-3 text-red-400" /> reconnecting…</>

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl">
      {/* ---------- desktop menu bar ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-card/40 p-4 pb-20 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-lg font-black text-black">A</div>
          <span className="text-xl font-black"><span className="text-gradient-gold">ACE</span></span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {items.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              aria-current={view === n.key ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition',
                view === n.key ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              {n.icon}
              {n.label}
              {n.key === 'premium' && (
                <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {premiumChip}
                </span>
              )}
              {badgeFor(n.key) > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
                  {badgeFor(n.key)}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* account / payments / legal quick links */}
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">More</p>
          <div className="space-y-0.5">
            {quickLinks.map((l) => (
              <button
                key={l.label}
                onClick={l.action}
                className="flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
              >
                {l.icon}
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border p-3">
          <div className="flex items-center gap-2">
            <AceAvatar user={me} className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{me.firstName ?? me.username}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">{liveTag}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- main column ---------- */}
      <main className="flex min-h-dvh w-full flex-col border-x border-border pb-16">
        {/* mobile top bar: logo + live dot + hamburger only */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <span className="text-xl font-black"><span className="text-gradient-gold">ACE</span></span>
          <div className="flex items-center gap-3">
            <span
              className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')}
              title={connected ? 'Realtime connected' : 'Reconnecting…'}
              aria-hidden="true"
            />
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {view === 'feed' && <FeedView onOpenProfile={openProfile} />}
              {view === 'reels' && <ReelsView onOpenProfile={openProfile} />}
              {view === 'search' && <SearchView onOpenProfile={openProfile} />}
              {view === 'contests' && <ContestsView />}
              {view === 'shop' && <ShopView />}
              {view === 'messages' && <MessagesView />}
              {view === 'notifications' && <NotificationsView />}
              {view === 'bookmarks' && <BookmarksView onOpenProfile={openProfile} />}
              {view === 'profile' && <ProfileView onOpenProfile={openProfile} />}
              {view === 'dashboard' && <DashboardView />}
              {view === 'settings' && <SettingsView initialTab={settingsTab} />}
              {view === 'premium' && <PremiumView />}
              {view === 'themes' && <ThemesView key={activeTheme} theme={activeTheme} onSelectTheme={selectTheme} />}
              {view === 'admin' && (me.isAdmin ? <AdminView /> : <p className="py-20 text-center text-muted-foreground">Admin access required.</p>)}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ---------- mobile hamburger drawer ---------- */}
      <AnimatePresence>
        {menuOpen && (
          <div key="mobile-menu" className="fixed inset-0 z-[60] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-border bg-card shadow-2xl"
              style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-lg font-black"><span className="text-gradient-gold">ACE</span></span>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* user card */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-4">
                <AceAvatar user={me} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{me.firstName ?? me.username}</p>
                  <p className="truncate text-xs text-muted-foreground">@{me.username}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                    <Coins className="h-3 w-3" /> {me.aceCoins.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">{liveTag}</span>
                </div>
              </div>

              {/* secondary destinations — primary tabs live in the bottom bar */}
              <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="More menu">
                {drawerItems.map((n) => (
                  <button
                    key={n.key}
                    onClick={() => selectView(n.key)}
                    aria-current={view === n.key ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition',
                      view === n.key ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    {n.icon}
                    {n.label}
                    {n.key === 'premium' && (
                      <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        {premiumChip}
                      </span>
                    )}
                    {badgeFor(n.key) > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
                        {badgeFor(n.key) > 99 ? '99+' : badgeFor(n.key)}
                      </span>
                    )}
                  </button>
                ))}

                {/* account / payments / legal quick links */}
                <div className="pt-4">
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">More</p>
                  <div className="space-y-0.5">
                    {quickLinks.map((l) => (
                      <button
                        key={l.label}
                        onClick={l.action}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                      >
                        {l.icon}
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </nav>

              <div className="border-t border-border p-3">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-5 w-5" /> Log out
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ---------- sticky bottom nav (primary tabs, all viewports) ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Bottom navigation"
      >
        <div className="mx-auto flex max-w-md md:max-w-xl">
          {bottomItems.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition',
                view === n.key ? 'text-amber-400' : 'text-muted-foreground'
              )}
              aria-label={n.label}
              aria-current={view === n.key ? 'page' : undefined}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              {n.icon}
              {n.label}
              {badgeFor(n.key) > 0 && (
                <span className="absolute right-1/2 top-1 flex h-4 min-w-4 translate-x-4 items-center justify-center rounded-full bg-amber-400 px-0.5 text-[9px] font-bold text-black">
                  {badgeFor(n.key) > 99 ? '99+' : badgeFor(n.key)}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ---------- realtime toast stack ---------- */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] mx-auto flex max-w-md flex-col gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">🔔</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
              </div>
              <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <UserProfileDialog username={profileDialog} open={profileDialog !== null} onOpenChange={(v) => !v && setProfileDialog(null)} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
