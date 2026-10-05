'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Ban, BadgeCheck, Banknote, Coins, FileText, Flag, Gavel, Loader2, Megaphone,
  MessageSquare, RotateCcw, ShieldCheck, Trophy, Users,
} from 'lucide-react'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AceAvatar, MediaImg, formatCoins, timeAgo } from '@/components/ace/media'
import { useAppStore } from '@/lib/client-store'
import { cn } from '@/lib/utils'

interface AdminStats {
  users: number
  posts: number
  activeContests: number
  completedContests: number
  orders: number
  messages: number
  removedPosts: number
  coinsInCirculation: number
}

interface AdminData {
  stats: AdminStats
  recentUsers: {
    id: number; username: string; firstName: string | null
    avatarUrl: string | null; isVerified: boolean; isBanned: boolean; createdAt: string
  }[]
  recentPosts: {
    id: number; body: string | null; mediaUrl: string | null
    status: string; createdAt: string
    user: { username: string; firstName: string | null; avatarUrl: string | null }
  }[]
  topEntries: {
    id: number; caption: string; votesCount: number
    user: { username: string; firstName: string | null; avatarUrl: string | null }
    contest: { title: string }
  }[]
}

interface WithdrawalRow {
  id: number
  amountCoins: number
  amountNaira?: number | null
  method: string
  destination: string
  status: string
  transferRef?: string | null
  createdAt: string
  user: { username: string; firstName: string | null; payoutAccountName?: string | null }
}

// Task 23 — user-submitted moderation reports
interface ReportRow {
  id: number
  targetType: 'post' | 'user' | 'message'
  targetId: number
  reason: string
  details: string | null
  status: string
  createdAt: string
  reporter: { id: number; username: string; firstName: string | null; avatarUrl: string | null }
  post?: {
    id: number
    body: string | null
    mediaUrl: string | null
    status: string
    user: { username: string; firstName: string | null }
  } | null
  user?: { id: number; username: string; firstName: string | null; isBanned: boolean } | null
}

export function AdminView() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [announce, setAnnounce] = useState('')
  const [busy, setBusy] = useState(false)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) setData(json)
      else sonner.error(json.error ?? 'Admin access required')
      const wRes = await fetch('/api/admin/withdrawals', { cache: 'no-store' })
      const wJson = await wRes.json()
      if (wRes.ok && wJson.ok) setWithdrawals(wJson.withdrawals)
      const rRes = await fetch('/api/admin/reports', { cache: 'no-store' })
      const rJson = await rRes.json()
      if (rRes.ok && rJson.ok) setReports(rJson.reports)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const act = async (action: string, targetId?: number, extra?: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, ...extra }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        sonner.success(`Done: ${json.action ?? action}`)
        void load()
      } else sonner.error(json.error ?? 'Action failed')
    } finally { setBusy(false) }
  }

  const processWithdrawal = async (id: number, action: 'paid' | 'rejected') => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        sonner.success(action === 'paid' ? 'Payout marked as paid ♦' : `Rejected — ${json.refunded?.toLocaleString?.() ?? ''} coins refunded`)
        void load()
      } else sonner.error(json.error ?? 'Action failed')
    } finally { setBusy(false) }
  }

  const resolveReport = async (reportId: number, action: 'dismiss' | 'resolve' | 'remove_post') => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, action }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        sonner.success(action === 'remove_post' ? 'Post removed + report resolved' : `Report ${json.status}`)
        void load()
      } else sonner.error(json.error ?? 'Action failed')
    } finally { setBusy(false) }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>
  }
  if (!data) {
    return <div className="py-20 text-center text-muted-foreground">Admin access required.</div>
  }

  const statCards: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: 'Users', value: String(data.stats.users), icon: <Users className="h-4 w-4" /> },
    { label: 'Active posts', value: String(data.stats.posts), icon: <FileText className="h-4 w-4" /> },
    { label: 'Live contests', value: String(data.stats.activeContests), icon: <Trophy className="h-4 w-4" /> },
    { label: 'Orders', value: String(data.stats.orders), icon: <Coins className="h-4 w-4" /> },
    { label: 'Messages', value: String(data.stats.messages), icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Coins circulating', value: formatCoins(data.stats.coinsInCirculation), icon: <Coins className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Admin panel 🛠</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.icon} {c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            The moderation queue — everything players flag lands here first. Open reports stay at
            the top until dismissed or resolved.
          </p>
          {reports.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Queue is clear — the floor is quiet.
            </p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3" data-testid={`admin-report-${r.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      'border-transparent',
                      r.status === 'open' && 'bg-amber-400/15 text-amber-400',
                      r.status === 'resolved' && 'bg-emerald-400/15 text-emerald-400',
                      r.status === 'dismissed' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {r.status}
                  </Badge>
                  <span className="text-sm font-semibold capitalize">
                    {r.reason} · {r.targetType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    by @{r.reporter.username} · {timeAgo(r.createdAt)}
                  </span>
                </div>
                {r.targetType === 'post' && r.post && (
                  <p className="mt-2 truncate rounded-lg bg-accent/40 px-2.5 py-1.5 text-sm text-muted-foreground">
                    “{r.post.body ?? '(media post)'}” — {r.post.user.firstName ?? r.post.user.username}
                    {r.post.status === 'removed' && ' (already removed)'}
                  </p>
                )}
                {r.targetType === 'user' && r.user && (
                  <p className="mt-2 rounded-lg bg-accent/40 px-2.5 py-1.5 text-sm text-muted-foreground">
                    @{r.user.username}{r.user.isBanned ? ' (banned)' : ''}
                  </p>
                )}
                {r.details && <p className="mt-1.5 text-xs italic text-muted-foreground">“{r.details}”</p>}
                {r.status === 'open' && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {r.targetType === 'post' && (
                      <Button
                        variant="secondary" size="sm" className="rounded-full" disabled={busy}
                        onClick={() => void resolveReport(r.id, 'remove_post')}
                      >
                        <Gavel className="mr-1 h-3.5 w-3.5" /> Remove post
                      </Button>
                    )}
                    <Button
                      variant="secondary" size="sm" className="rounded-full" disabled={busy}
                      onClick={() => void resolveReport(r.id, 'resolve')}
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-400" /> Resolve
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="rounded-full" disabled={busy}
                      onClick={() => void resolveReport(r.id, 'dismiss')}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="moderation" className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">Latest posts ({data.stats.removedPosts} removed all-time). Top voted entries: {data.topEntries[0] ? `${data.topEntries[0].votesCount} votes in “${data.topEntries[0].contest.title}”` : '—'}.</p>
          {data.recentPosts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              {p.mediaUrl ? (
                <MediaImg src={p.mediaUrl} alt="Post" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg">📝</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-medium">
                  <AceAvatar user={p.user} className="h-5 w-5" />
                  {p.user.firstName ?? p.user.username}
                  <span className="font-normal text-muted-foreground">· {timeAgo(p.createdAt)}</span>
                </p>
                <p className="truncate text-sm text-muted-foreground">{p.body ?? '(media post)'}</p>
              </div>
              <Button variant="secondary" size="sm" className="shrink-0 rounded-full" disabled={busy} onClick={() => act('remove_post', p.id)}>
                <Gavel className="mr-1 h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="users" className="mt-3 space-y-2">
          {data.recentUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <AceAvatar user={u} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-medium">
                  {u.firstName ?? u.username}
                  {u.isVerified && <BadgeCheck className="h-4 w-4 text-amber-400" />}
                  {u.isBanned && <Badge className="border-0 bg-red-400/10 text-[10px] text-red-400">banned</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">@{u.username} · joined {timeAgo(u.createdAt)}</p>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full" disabled={busy} onClick={() => act('verify_user', u.id)} aria-label="Toggle verified">
                <BadgeCheck className="h-4 w-4 text-amber-400" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full text-red-400" disabled={busy} onClick={() => act(u.isBanned ? 'unban_user' : 'ban_user', u.id)} aria-label="Toggle ban">
                <Ban className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="payouts" className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Coin withdrawal requests. Bank payouts run through Paystack — live transfers settle
            themselves via webhook; everything else is settled here (rejecting refunds the coins).
          </p>
          {withdrawals.length === 0 ? (
            <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No withdrawal requests yet.</p>
          ) : (
            withdrawals.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {w.user.firstName ?? w.user.username}
                    <span className="font-normal text-muted-foreground"> · {w.amountCoins.toLocaleString()} coins ≈ ₦{(w.amountNaira ?? w.amountCoins).toLocaleString()}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{w.destination}</p>
                  {w.transferRef && (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">ref: {w.transferRef}</p>
                  )}
                </div>
                <Badge
                  className={cn(
                    'border-transparent',
                    w.status === 'pending' && 'bg-amber-400/15 text-amber-400',
                    w.status === 'processing' && 'bg-sky-400/15 text-sky-400',
                    w.status === 'paid' && 'bg-emerald-400/15 text-emerald-400',
                    w.status === 'rejected' && 'bg-rose-400/15 text-rose-400'
                  )}
                >
                  {w.status}
                </Badge>
                {w.status !== 'paid' && w.status !== 'rejected' && (
                  <>
                    <Button variant="secondary" size="sm" className="rounded-full" disabled={busy} onClick={() => void processWithdrawal(w.id, 'paid')}>
                      <Banknote className="mr-1 h-3.5 w-3.5" /> Mark paid
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-full text-red-400" disabled={busy} onClick={() => void processWithdrawal(w.id, 'rejected')}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="broadcast" className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Send a system notification to every active user (delivered instantly over SSE).
          </p>
          <Textarea value={announce} onChange={(e) => setAnnounce(e.target.value)} placeholder="🎉 Double coin weekend starts now — all boosts 50% off!" maxLength={255} />
          <Button
            className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500"
            disabled={busy || !announce.trim()}
            onClick={() => { void act('announce', undefined, { text: announce }); setAnnounce('') }}
          >
            <Megaphone className="mr-1 h-4 w-4" /> Broadcast
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-muted-foreground">
            <RotateCcw className="h-4 w-4 shrink-0" />
            Contest lifecycle runs lazily on read: active → voting → completed (winner crowned + notified automatically).
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
