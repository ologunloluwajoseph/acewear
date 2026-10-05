'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Coins, Eye, Heart, RefreshCw, Sparkles, TrendingUp, Trophy, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/client-store'
import { cn } from '@/lib/utils'

// =====================================================================
// Personal Dashboard — animated analytics (Deliverable: charts that move)
//   * Area chart  : engagement over the last 14 days
//   * Bar chart   : posts per day
//   * Histogram   : my activity by hour of day (00–23)
//   * Pie chart   : coin spend breakdown
//   * Radial gauge: trust score
// Every card counts up, every chart animates in (recharts native easing).
// =====================================================================

interface DashboardData {
  totals: {
    coins: number; trustScore: number; streak: number
    followers: number; following: number; posts: number
    likesReceived: number; commentsReceived: number; votesReceived: number
    wins: number; activeStories: number
  }
  daily: { day: string; label: string; posts: number; likes: number; comments: number }[]
  hourly: { hour: string; count: number }[]
  coinBreakdown: { name: string; value: number }[]
  withdrawals: { paidOut: number; pendingCoins: number; count: number }
  topPosts: { id: number; excerpt: string; likesCount: number; commentsCount: number }[]
}

const CATEGORY_LABEL: Record<string, string> = {
  boost: 'Boosts',
  badge: 'Badges',
  coins: 'Coin packs',
  cosmetic: 'Cosmetics',
  cash_out: 'Cash withdrawals',
}

const PIE_COLORS = ['#fbbf24', '#34d399', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c']

// ---- smooth count-up hook (eases out, 900ms) ----
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!Number.isFinite(target)) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function StatCard({
  icon, label, value, suffix, accent, delay,
}: {
  icon: React.ReactNode; label: string; value: number; suffix?: string; accent: string; delay: number
}) {
  const animated = useCountUp(value)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
    >
      <Card className="border-border/80 bg-card/70">
        <CardContent className="flex items-center gap-3 p-4">
          <motion.div
            initial={{ rotate: -12, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: delay + 0.15, type: 'spring', stiffness: 260, damping: 14 }}
            className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', accent)}
          >
            {icon}
          </motion.div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-black tabular-nums">
              {animated.toLocaleString()}{suffix}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

const tooltipStyle = {
  backgroundColor: 'rgba(15,15,20,0.95)',
  border: '1px solid rgba(251,191,36,0.25)',
  borderRadius: 12,
  color: '#e5e7eb',
  fontSize: 12,
} as const

export function DashboardView() {
  const me = useAppStore((s) => s.me)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // loading starts true from useState init; manual reloads keep the old
    // data visible while the new one streams in (no sync setState here)
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.ok) setData(d)
        else setError(d.error ?? 'Could not load dashboard')
      })
      .catch(() => !cancelled && setError('Could not load dashboard'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [reloadKey])

  const pieData = useMemo(
    () =>
      (data?.coinBreakdown ?? []).map((d) => ({
        ...d,
        name: CATEGORY_LABEL[d.name] ?? d.name,
      })),
    [data]
  )

  if (loading && !data) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        {error ?? 'No data'}
        <div className="mt-4">
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  const t = data.totals

  return (
    <div className="space-y-4 p-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Sparkles className="h-6 w-6 text-amber-400" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Welcome back, {me?.firstName ?? me?.username} — here is your ACE pulse.</p>
        </div>
        <Button variant="ghost" size="sm" aria-label="Refresh dashboard" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* animated stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard delay={0} icon={<Coins className="h-5 w-5 text-black" />} accent="bg-gradient-to-br from-amber-300 to-amber-500" label="ACE coins" value={t.coins} />
        <StatCard delay={0.08} icon={<Users className="h-5 w-5 text-black" />} accent="bg-gradient-to-br from-sky-300 to-sky-500" label="Followers" value={t.followers} />
        <StatCard delay={0.16} icon={<Heart className="h-5 w-5 text-black" />} accent="bg-gradient-to-br from-rose-300 to-rose-500" label="Likes received" value={t.likesReceived} />
        <StatCard delay={0.24} icon={<ShieldIcon />} accent="bg-gradient-to-br from-emerald-300 to-emerald-500" label="Trust score" value={t.trustScore} />
      </div>

      {/* engagement area + trust gauge */}
      <div className="grid gap-3 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card className="border-border/80 bg-card/70">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-amber-400" /> Engagement — last 14 days
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gLikes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gComments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="likes" name="Likes" stroke="#fbbf24" strokeWidth={2} fill="url(#gLikes)" animationDuration={1100} />
                  <Area type="monotone" dataKey="comments" name="Comments" stroke="#38bdf8" strokeWidth={2} fill="url(#gComments)" animationDuration={1400} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
          <Card className="h-full border-border/80 bg-card/70">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Trust score</CardTitle>
            </CardHeader>
            <CardContent className="relative h-64">
              <ResponsiveContainer width="100%" height="85%">
                <RadialBarChart
                  innerRadius="72%"
                  outerRadius="100%"
                  data={[{ name: 'trust', value: Math.min(100, t.trustScore), fill: '#34d399' }]}
                  startAngle={210}
                  endAngle={-30}
                >
                  <RadialBar dataKey="value" background={{ fill: 'rgba(148,163,184,0.15)' }} cornerRadius={12} animationDuration={1500} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-6">
                <span className="text-3xl font-black tabular-nums">
                  <CountUpText value={t.trustScore} duration={1500} />
                </span>
                <span className="text-xs text-muted-foreground">{t.streak} day streak</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* posts bar + coin pie */}
      <div className="grid gap-3 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
          <Card className="border-border/80 bg-card/70">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Posts per day</CardTitle>
            </CardHeader>
            <CardContent className="h-60 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(251,191,36,0.08)' }} />
                  <Bar dataKey="posts" name="Posts" fill="#fbbf24" radius={[6, 6, 0, 0]} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
          <Card className="h-full border-border/80 bg-card/70">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Where your coins go</CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              {pieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No spend yet — buy something in the shop!
                </div>
              ) : (
                <div className="flex h-full items-center">
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={4}
                        cornerRadius={6}
                        animationDuration={1200}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex-1 space-y-2 text-xs">
                    {pieData.map((d, i) => (
                      <li key={d.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="ml-auto font-bold tabular-nums">{d.value.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* activity histogram */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}>
        <Card className="border-border/80 bg-card/70">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-sky-400" /> Activity histogram — actions by hour of day
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourly} margin={{ top: 4, right: 8, left: -22, bottom: 0 }} barCategoryGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 9 }} interval={2} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(56,189,248,0.08)' }} />
                <Bar dataKey="count" name="Actions" fill="#38bdf8" radius={[3, 3, 0, 0]} animationDuration={1300} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* top posts + withdrawals summary */}
      <div className="grid gap-3 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="border-border/80 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top posts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.topPosts.length === 0 && (
                <p className="text-sm text-muted-foreground">Post something to see your top performers here.</p>
              )}
              {data.topPosts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.75 + i * 0.1 }}
                  className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/15 text-xs font-black text-amber-400">
                    #{i + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm">{p.excerpt || '(media post)'}</p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Heart className="h-3.5 w-3.5 text-rose-400" /> {p.likesCount}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.commentsCount} 💬</span>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.78 }}>
          <Card className="border-border/80 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-400" /> Payouts & wins
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <motion.div whileHover={{ scale: 1.04 }} className="rounded-2xl border border-border/60 p-3">
                <p className="text-xl font-black tabular-nums">{t.wins}</p>
                <p className="text-[11px] text-muted-foreground">Contest wins</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} className="rounded-2xl border border-border/60 p-3">
                <p className="text-xl font-black tabular-nums">{data.withdrawals.paidOut.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">Coins cashed out</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} className="rounded-2xl border border-border/60 p-3">
                <p className="text-xl font-black tabular-nums">{data.withdrawals.pendingCoins.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">Pending withdrawal</p>
              </motion.div>
              <p className="col-span-3 text-xs text-muted-foreground">
                Request payouts from <b>Settings → Payouts</b> (min 500 coins).
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

function ShieldIcon() {
  return <Sparkles className="h-5 w-5 text-black" aria-hidden="true" />
}

/** Child component so the count-up hook respects the Rules of Hooks. */
function CountUpText({ value, duration = 900 }: { value: number; duration?: number }) {
  const animated = useCountUp(value, duration)
  return <>{animated.toLocaleString()}</>
}
