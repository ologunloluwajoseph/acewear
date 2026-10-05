'use client'

// =====================================================================
// Premium page — ACE PRO plans, Paystack checkout, live trial countdown
// and the PRO Perks Store (moved here from the old Shop page).
//
// Checkout runs on Paystack:
//   • live/test keys configured  -> the official Paystack inline popup
//     opens, and the reference is verified server-side on success.
//   • no keys (sandbox)          -> the built-in sandbox checkout dialog
//     completes the identical flow locally so every feature stays
//     testable. Drop keys into .env and the popup takes over.
// =====================================================================

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast as sonner } from 'sonner'
import {
  BadgeCheck, Check, Crown, Gem, Loader2, Lock, MessageSquareText, Palette, Rocket, ShieldCheck, Sparkles, TrendingUp, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/lib/client-store'
import { cn } from '@/lib/utils'
import { TRIAL_MS, canUsePremium, premiumTier, trialEndsAt } from '@/lib/theme'
import { PRO_PLANS, formatNaira, type ProPlan } from '@/lib/premium-plans'
import { PerksStore } from '@/components/ace/perks-store'

// --- ticking clock (only while a countdown is on screen) ---------------
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last >= 40) {
        setNow(Date.now())
        last = t
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return now
}

function Tile({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-3 md:px-3',
        accent
          ? 'border-amber-400/60 bg-gradient-to-b from-amber-400/20 to-amber-400/5 shadow-[0_0_24px_-6px_rgba(251,191,36,0.45)]'
          : 'border-amber-400/25 bg-gradient-to-b from-amber-400/10 to-transparent'
      )}
    >
      <span
        data-testid={`premium-tile-${label.toLowerCase()}`}
        className={cn(
          'text-2xl font-black leading-none tabular-nums md:text-3xl',
          accent ? 'text-amber-200' : 'text-amber-300'
        )}
      >
        {value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

const FEATURES: { icon: React.ReactNode; title: string; body: string; soon?: boolean }[] = [
  {
    icon: <MessageSquareText className="h-5 w-5" />,
    title: 'Live typing in chat',
    body: 'Your drafts appear faintly at the other side while you type — like a mind-reading party trick.',
  },
  {
    icon: <Palette className="h-5 w-5" />,
    title: 'Transparent glass theme',
    body: 'The black & white PRO glass mode with a tip of purple. Flashy without saying a word.',
  },
  {
    icon: <Gem className="h-5 w-5" />,
    title: 'PRO crown on your profile',
    body: 'The ✦ crown next to your name on posts, comments and contests.',
    soon: true,
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: 'Profile boost',
    body: 'Pinned spot on the discover page and 2× contest entry visibility.',
    soon: true,
  },
  {
    icon: <Wallet className="h-5 w-5" />,
    title: 'Coin payouts via Paystack',
    body: 'Cash out coins straight to your Nigerian bank account — verified in seconds, no platform cut.',
  },
  {
    icon: <Rocket className="h-5 w-5" />,
    title: 'Early access drops',
    body: 'New games, themes and features land in your hands first.',
    soon: true,
  },
]

// --- Paystack inline loader (live mode only) ---------------------------

interface PaystackPop {
  setup(input: {
    key: string
    email: string
    amount: number // kobo
    ref: string
    onClose?: () => void
    callback: (response: { reference: string }) => void
  }): { openIframe(): void }
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: PaystackPop['setup']
    }
  }
}

function loadPaystack(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.PaystackPop) return resolve(true)
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.PaystackPop)))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://js.paystack.co/v1/inline.js'
    s.async = true
    s.onload = () => resolve(Boolean(window.PaystackPop))
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export function PremiumView() {
  const me = useAppStore((s) => s.me)
  const refreshMe = useAppStore((s) => s.refreshMe)
  const tier = premiumTier(me)
  const endsAt = trialEndsAt(me)
  const now = useNow(tier === 'trial')

  const [checkout, setCheckout] = useState<{
    plan: ProPlan
    mode: 'paystack' | 'demo'
    reference: string
    amountKobo: number
    email: string
  } | null>(null)
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const popupBusy = useRef(false)

  const remaining = tier === 'trial' && endsAt ? Math.max(0, endsAt.getTime() - now) : 0
  const days = Math.floor(remaining / 86_400_000)
  const hours = Math.floor(remaining / 3_600_000) % 24
  const minutes = Math.floor(remaining / 60_000) % 60
  const seconds = Math.floor(remaining / 1000) % 60
  const ms = remaining % 1000
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const trialProgress = endsAt ? 1 - Math.min(1, remaining / TRIAL_MS) : 1

  const finishPayment = async (reference: string) => {
    const res = await fetch('/api/paystack/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    })
    const data = await res.json()
    if (res.ok && data.ok) {
      setPaid(true)
      await refreshMe()
      sonner.success('Welcome to ACE PRO ♦ — every premium feature is on.')
      return true
    }
    sonner.error(data.error ?? 'Payment could not be confirmed')
    return false
  }

  const upgrade = async (plan: ProPlan) => {
    if (tier === 'member') {
      sonner.success('You are already a PRO member — the crown stays on ♦')
      return
    }
    if (popupBusy.current) return
    popupBusy.current = true
    setPaid(false)
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        sonner.error(data.error ?? 'Could not start checkout')
        return
      }
      setCheckout({
        plan,
        mode: data.mode,
        reference: data.reference,
        amountKobo: data.amountKobo,
        email: data.email,
      })

      if (data.mode === 'paystack') {
        const ok = await loadPaystack()
        if (!ok || !window.PaystackPop) {
          sonner.error('Could not reach Paystack — check your connection and retry')
          setCheckout(null)
          return
        }
        const pop = window.PaystackPop.setup({
          key: data.publicKey,
          email: data.email,
          amount: data.amountKobo,
          ref: data.reference,
          callback: (response: { reference: string }) => {
            void finishPayment(response.reference)
          },
          onClose: () => {
            sonner.info('Checkout closed — your plan is waiting whenever you are.')
          },
        })
        pop.openIframe()
        setCheckout(null) // popup handles UI; nothing to render inline
      }
    } finally {
      popupBusy.current = false
    }
  }

  const paySandbox = async () => {
    if (!checkout) return
    setPaying(true)
    try {
      // simulate the gateway round-trip the live popup performs
      await new Promise((r) => setTimeout(r, 1200))
      await finishPayment(checkout.reference)
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      {/* ---------- hero ---------- */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 via-card to-card p-6 text-center">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-amber-400/10 blur-2xl" />
        <motion.div
          initial={{ scale: 0.7, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg shadow-amber-500/30"
        >
          <Crown className="h-8 w-8 text-black" />
        </motion.div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          <span className="text-gradient-gold">ACE PRO</span>
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          The full casino-floor experience — every premium feature, no limits, all tables open.
        </p>
      </div>

      {/* ---------- trial countdown / status ---------- */}
      {tier === 'trial' && (
        <section
          data-testid="premium-trial-card"
          className="rounded-3xl border border-amber-400/40 bg-card p-5 shadow-[0_0_40px_-18px_rgba(251,191,36,0.55)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-300">
              <Sparkles className="h-4 w-4" />
              Free trial — every premium feature unlocked
            </p>
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">
              day {Math.min(3, Math.floor(trialProgress * 3) + 1)} of 3
            </span>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-1.5 md:gap-2.5">
            <Tile value={pad(days)} label="Days" />
            <Tile value={pad(hours)} label="Hours" />
            <Tile value={pad(minutes)} label="Minutes" />
            <Tile value={pad(seconds)} label="Seconds" />
            <Tile value={pad(ms, 3)} label="Millis" accent />
          </div>

          {/* trial burn-down bar */}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-500"
              style={{ width: `${Math.max(2, Math.min(100, trialProgress * 100))}%` }}
            />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The clock started the moment your account was created and keeps running even when you
            log out — when it hits zero, PRO features lock until you upgrade. Live typing and the
            Transparent theme are yours right now.
          </p>
        </section>
      )}

      {tier === 'member' && (
        <section
          data-testid="premium-member-card"
          className="flex items-center gap-4 rounded-3xl border border-emerald-400/30 bg-emerald-400/5 p-5"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15">
            <BadgeCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-300">
              {me?.isAdmin && !me?.isPro
                ? 'Admin — all premium features unlocked'
                : me?.proPlan === 'lifetime'
                  ? 'You are a PRO member — lifetime crown'
                  : `You are a PRO member${me?.proPlan ? ` — ${me.proPlan} plan` : ''}`}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Live typing, the Transparent theme, the Perks Store and every future PRO drop are
              yours. No countdown, no clock — the crown stays on.
            </p>
          </div>
        </section>
      )}

      {tier === 'free' && (
        <section data-testid="premium-expired-card" className="rounded-3xl border border-border bg-card p-5">
          <p className="text-sm font-bold">Your free 3-day trial has ended</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Live typing in chat and the Transparent theme are locked again. Pick a plan below to
            switch the crown back on — your account is exactly as you left it.
          </p>
          <Button
            onClick={() => void upgrade(PRO_PLANS[1])}
            className="mt-4 w-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 font-bold text-black hover:from-amber-200 hover:to-amber-400"
          >
            <Crown className="mr-2 h-4 w-4" /> Upgrade to PRO
          </Button>
        </section>
      )}

      {/* ---------- features ---------- */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          What the crown unlocks
        </h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const unlocked = !f.soon && tier !== 'free'
            return (
              <div
                key={f.title}
                className={cn(
                  'rounded-2xl border p-3.5 transition',
                  unlocked ? 'border-amber-400/35 bg-amber-400/5' : 'border-border bg-background/40'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', unlocked ? 'bg-amber-400/15 text-amber-300' : 'bg-muted text-muted-foreground')}>
                    {f.icon}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      unlocked ? 'bg-amber-400/15 text-amber-300' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {unlocked ? (tier === 'trial' ? 'FREE NOW' : 'UNLOCKED') : 'SOON'}
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-semibold">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------- plans (Paystack checkout) ---------- */}
      <section className="rounded-3xl border border-border bg-card p-5" data-testid="premium-plans">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Plans</h2>
          <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
            <ShieldCheck className="h-3 w-3" /> Paystack secured
          </span>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {PRO_PLANS.map((p) => (
            <div
              key={p.id}
              className={cn(
                'relative flex flex-col rounded-2xl border p-4',
                p.best ? 'border-amber-400/60 bg-gradient-to-b from-amber-400/10 to-transparent' : 'border-border'
              )}
            >
              {p.best && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2.5 py-0.5 text-[10px] font-black text-black">
                  BEST VALUE
                </span>
              )}
              <p className="text-sm font-bold">{p.name}</p>
              <p className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums text-gradient-gold">{formatNaira(p.priceNaira)}</span>
                <span className="text-xs text-muted-foreground">{p.per}</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{p.note}</p>
              <Button
                size="sm"
                disabled={tier === 'member'}
                onClick={() => void upgrade(p)}
                data-testid={`plan-upgrade-${p.id}`}
                className={cn(
                  'mt-3 w-full rounded-full font-bold',
                  p.best
                    ? 'bg-gradient-to-r from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400'
                    : 'bg-secondary text-secondary-foreground'
                )}
              >
                {tier === 'member' ? 'Active' : 'Upgrade'}
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" />
          Checkout is processed by Paystack (cards, bank transfer, USSD). Your trial covers
          everything marked FREE NOW — no card required.
        </p>
      </section>

      {/* ---------- perks store (moved from the Shop) ---------- */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <PerksStore />
      </section>

      {/* ---------- sandbox checkout dialog (no Paystack keys yet) ---------- */}
      <Dialog
        open={checkout !== null && checkout.mode === 'demo'}
        onOpenChange={(v) => !v && setCheckout(null)}
      >
        <DialogContent className="sm:max-w-sm" data-testid="sandbox-checkout">
          {checkout && !paid && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Paystack Secure Checkout
                </DialogTitle>
                <DialogDescription>
                  Sandbox mode — add your PAYSTACK keys to .env and this button opens the live
                  Paystack popup instead.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-muted-foreground">ACE PRO — {checkout.plan.name}</span>
                  <span className="font-black text-gradient-gold">{formatNaira(checkout.plan.priceNaira)}</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-email">Email for the receipt</Label>
                  <Input id="checkout-email" value={checkout.email} readOnly />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Ref <span className="font-mono">{checkout.reference}</span> · cards, bank
                  transfer and USSD are supported on live Paystack.
                </p>
                <Button
                  onClick={() => void paySandbox()}
                  disabled={paying}
                  data-testid="sandbox-pay-button"
                  className="w-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 font-bold text-black"
                >
                  {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Pay {formatNaira(checkout.plan.priceNaira)}
                </Button>
              </div>
            </>
          )}
          {checkout && paid && (
            <div className="flex flex-col items-center gap-3 py-6 text-center" data-testid="sandbox-checkout-success">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15"
              >
                <Check className="h-7 w-7 text-emerald-400" />
              </motion.div>
              <p className="text-lg font-black">Payment successful ♦</p>
              <p className="text-sm text-muted-foreground">
                {formatNaira(checkout.plan.priceNaira)} paid — your PRO crown is on. Enjoy every
                premium feature!
              </p>
              <Button onClick={() => setCheckout(null)} className="rounded-full bg-gradient-to-r from-amber-300 to-amber-500 font-bold text-black">
                Back to Premium
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
