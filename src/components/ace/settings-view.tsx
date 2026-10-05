'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast as sonner } from 'sonner'
import {
  BadgeCheck, Banknote, FileText, KeyRound, Loader2, MailCheck, Save, ShieldCheck, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/client-store'
import { setToken } from '@/lib/session-token'
import { cn } from '@/lib/utils'

// =====================================================================
// Settings — Account (password + 60-day name change), Payouts & withdrawals,
// Privacy toggles, Legal (Terms & Conditions + Privacy Policy).
// initialTab lets the menu quick-links (Account details / Payment account /
// Terms & Privacy) deep-link straight to the right section.
// =====================================================================

const MIN_WITHDRAW = 500
const DAY_MS = 86_400_000

interface SettingsPayload {
  username: string
  email: string
  firstName: string | null
  nameChangedAt: string | null
  createdAt: string
  privateProfile: boolean
  showOnlineStatus: boolean
  messagesFromAnyone: boolean
  showReadReceipts: boolean
  searchableByEmail: boolean
  payoutMethod: string | null
  payoutAccountName: string | null
  payoutDetails: string | null
  payoutUpdatedAt: string | null
  payoutBankCode?: string | null
  payoutBankName?: string | null
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
}

interface BankInfo {
  name: string
  code: string
}

const METHOD_LABEL: Record<string, string> = {
  bank: 'Bank transfer — Paystack',
  paypal: 'PayPal',
  crypto: 'Crypto wallet',
  mobile_money: 'Mobile money',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-400/15 text-amber-400',
  processing: 'bg-sky-400/15 text-sky-400',
  paid: 'bg-emerald-400/15 text-emerald-400',
  rejected: 'bg-rose-400/15 text-rose-400',
}

export function SettingsView({ initialTab = 'account' }: { initialTab?: 'account' | 'payouts' | 'privacy' | 'legal' }) {
  const refreshMe = useAppStore((s) => s.refreshMe)
  const [data, setData] = useState<SettingsPayload | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(initialTab)

  // menu quick-links change the requested tab while this view stays mounted
  useEffect(() => { setTab(initialTab) }, [initialTab])

  const load = () =>
    fetch('/api/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d.settings)
          setWithdrawals(d.withdrawals ?? [])
        } else sonner.error(d.error ?? 'Could not load settings')
      })
      .catch(() => sonner.error('Could not load settings'))
      .finally(() => setLoading(false))

  useEffect(() => { void load() }, [])

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-black">Settings</h1>
        <p className="text-sm text-muted-foreground">
          @{data.username} · joined {new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof initialTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
        </TabsList>

        <AccountTab data={data} onSaved={() => { void load(); void refreshMe() }} />
        <PayoutsTab data={data} withdrawals={withdrawals} onSaved={() => void load()} />
        <PrivacyTab data={data} onSaved={() => void load()} />
        <LegalTab />
      </Tabs>
    </div>
  )
}

/* ---------------- Account: password + 60-day name change ---------------- */

// Task 23 — email verification status + dev-mode link delivery
function EmailVerificationCard({ email }: { email: string }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/auth/send-verification', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setVerified(Boolean(d.emailVerified)) })
      .catch(() => setVerified(false))
  }, [])

  const send = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' })
      const d = await res.json()
      if (d.ok && d.alreadyVerified) {
        setVerified(true)
        sonner.success('Email is already verified')
      } else if (d.ok) {
        setLink(d.verifyUrl ?? null)
        sonner.success('Verification link created')
      } else {
        sonner.error(d.error ?? 'Could not create verification link')
      }
    } catch {
      sonner.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailCheck className="h-4 w-4 text-amber-400" /> Email verification
          {verified === true && (
            <Badge className="border-transparent bg-emerald-400/15 text-emerald-400">verified</Badge>
          )}
          {verified === false && (
            <Badge className="border-transparent bg-amber-400/15 text-amber-400">unverified</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {email} — verified accounts recover their password faster and look trustworthy
          on the floor.
        </CardDescription>
      </CardHeader>
      {verified === false && (
        <CardContent className="space-y-3">
          {link && (
            <div className="space-y-2 rounded-xl bg-muted/60 p-3">
              <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">{link}</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary" size="sm" className="rounded-full"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }
                    catch { window.prompt('Copy your verification link:', link) }
                  }}
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </Button>
                <a
                  href={link}
                  className="inline-flex h-8 items-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-4 text-xs font-bold text-black transition hover:from-amber-300 hover:to-amber-500"
                >
                  Verify now
                </a>
              </div>
            </div>
          )}
          <Button onClick={send} disabled={busy} data-testid="send-verification" className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
            Send verification link
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

function AccountTab({ data, onSaved }: { data: SettingsPayload; onSaved: () => void }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const [name, setName] = useState(data.firstName ?? '')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(data.nameChangedAt)

  const cooldown = useMemo(() => {
    if (!nameChangedAt) return null
    const nextAllowed = new Date(new Date(nameChangedAt).getTime() + 60 * DAY_MS)
    const remaining = nextAllowed.getTime() - Date.now()
    if (remaining <= 0) return null
    return { nextAllowed, days: Math.ceil(remaining / DAY_MS) }
  }, [nameChangedAt])

  const changePassword = async () => {
    if (!currentPw || !newPw) return sonner.error('Fill in both password fields')
    if (newPw.length < 8) return sonner.error('New password must be at least 8 characters')
    if (newPw !== confirmPw) return sonner.error('New passwords do not match')
    setPwBusy(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'password', currentPassword: currentPw, newPassword: newPw }),
      })
      const d = await res.json()
      if (!d.ok) sonner.error(d.error ?? 'Could not change password')
      else {
        if (d.token) setToken(d.token) // fresh token — old sessions were invalidated
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
        sonner.success('Password changed — other devices were signed out')
        onSaved()
      }
    } catch { sonner.error('Network error') } finally { setPwBusy(false) }
  }

  const changeName = async () => {
    if (cooldown) return sonner.error(`Name locked for ${cooldown.days} more day${cooldown.days === 1 ? '' : 's'}`)
    if (!name.trim()) return sonner.error('Name cannot be empty')
    setNameBusy(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'name', firstName: name }),
      })
      const d = await res.json()
      if (!d.ok) sonner.error(d.error ?? 'Could not change name')
      else {
        setNameChangedAt(d.nameChangedAt)
        sonner.success('Display name updated')
        onSaved()
      }
    } catch { sonner.error('Network error') } finally { setNameBusy(false) }
  }

  return (
    <>
      <TabsContent value="account" className="mt-4 space-y-4">
        {/* password */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-amber-400" /> Change password</CardTitle>
              <CardDescription>Changing your password signs out every other device instantly.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="cur-pw">Current password</Label>
                <Input id="cur-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">New password</Label>
                <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf-pw">Confirm new</Label>
                <Input id="conf-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="md:col-span-3">
                <Button onClick={changePassword} disabled={pwBusy} className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black">
                  {pwBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Update password
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* email verification (Task 23) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <EmailVerificationCard email={data.email} />
        </motion.div>

        {/* name with 60-day lock */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BadgeCheck className="h-4 w-4 text-emerald-400" /> Display name</CardTitle>
              <CardDescription>
                For safety, names can only be changed once every <b>60 days</b>.
                {cooldown
                  ? ` Locked — available again ${cooldown.nextAllowed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${cooldown.days} day${cooldown.days === 1 ? '' : 's'}).`
                  : ' You can change it now.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="disp-name">Name shown on your profile</Label>
                <Input id="disp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={Boolean(cooldown)} />
              </div>
              <Button onClick={changeName} disabled={nameBusy || Boolean(cooldown)} className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black disabled:opacity-50">
                {nameBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save name
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </TabsContent>
    </>
  )
}

/* ---------------- Payouts: account details + withdrawals ---------------- */

function PayoutsTab({
  data, withdrawals, onSaved,
}: { data: SettingsPayload; withdrawals: WithdrawalRow[]; onSaved: () => void }) {
  const [method, setMethod] = useState(data.payoutMethod ?? 'bank')
  const [accountName, setAccountName] = useState(data.payoutAccountName ?? '')
  const [details, setDetails] = useState(data.payoutDetails ?? '')
  const [banks, setBanks] = useState<BankInfo[]>([])
  const [bankCode, setBankCode] = useState(data.payoutBankCode ?? '')
  const [paystackMode, setPaystackMode] = useState<'paystack' | 'demo' | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(Boolean(data.payoutMethod && data.payoutAccountName))
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [amount, setAmount] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const refreshMe = useAppStore((s) => s.refreshMe)
  const coins = useAppStore((s) => s.me?.aceCoins ?? 0)

  // Nigerian banks for the Paystack bank picker
  useEffect(() => {
    if (method !== 'bank' || banks.length > 0) return
    fetch('/api/paystack/banks', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setBanks(d.banks)
          setPaystackMode(d.mode)
        }
      })
      .catch(() => null)
  }, [method, banks.length])

  const isBank = method === 'bank'
  const payoutSaved = Boolean(data.payoutMethod && data.payoutAccountName && data.payoutDetails)

  // Verify the account number with Paystack (demo mode returns a labeled
  // placeholder so the flow still completes end-to-end in the sandbox).
  const verifyAccount = async () => {
    if (!bankCode) return sonner.error('Choose a bank first')
    if (!/^\d{10}$/.test(details.trim())) {
      return sonner.error('Enter the 10-digit NUBAN account number')
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/paystack/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: details.trim(), bankCode }),
      })
      const d = await res.json()
      if (d.ok) {
        setAccountName(d.accountName)
        setVerified(true)
        sonner.success(
          d.mode === 'demo'
            ? 'Account checked (sandbox mode — plug in Paystack keys for live names)'
            : `Verified: ${d.accountName}`
        )
      } else sonner.error(d.error ?? 'Verification failed')
    } catch { sonner.error('Network error') } finally { setVerifying(false) }
  }

  const savePayout = async () => {
    if (!accountName.trim() || details.trim().length < 4) {
      return sonner.error('Account name and details are required')
    }
    if (isBank && !bankCode) return sonner.error('Choose the bank for the transfer')
    setPayoutBusy(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payout',
          payout: {
            method,
            accountName,
            details,
            bankCode: isBank ? bankCode : undefined,
            bankName: isBank ? banks.find((b) => b.code === bankCode)?.name : undefined,
          },
        }),
      })
      const d = await res.json()
      if (!d.ok) sonner.error(d.error ?? 'Could not save payout details')
      else { sonner.success('Payment account saved — payouts run through Paystack'); onSaved() }
    } catch { sonner.error('Network error') } finally { setPayoutBusy(false) }
  }

  const withdraw = async () => {
    const amt = Math.floor(Number(amount))
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAW) {
      return sonner.error(`Minimum withdrawal is ${MIN_WITHDRAW} coins`)
    }
    if (!payoutSaved) return sonner.error('Save your payment account details first')
    setWithdrawBusy(true)
    try {
      const res = await fetch('/api/settings/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCoins: amt }),
      })
      const d = await res.json()
      if (!d.ok) sonner.error(d.error ?? 'Withdrawal failed')
      else {
        sonner.success(
          `${amt.toLocaleString()} coins (₦${amt.toLocaleString()}) — ${d.withdrawal.transferNote || 'request recorded, status pending'}`
        )
        setAmount('')
        onSaved()
        void refreshMe() // sync coin balance everywhere (header, dashboard)
      }
    } catch { sonner.error('Network error') } finally { setWithdrawBusy(false) }
  }

  return (
    <TabsContent value="payouts" className="mt-4 space-y-4">
      {/* payment account */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-amber-400" /> Payment account details</CardTitle>
            <CardDescription>
              Where your converted coins get paid out. Bank payouts are executed by
              {' '}<b className="text-foreground">Paystack</b> — only you can see these details.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="payout-method">Method</Label>
              <select
                id="payout-method"
                value={method}
                onChange={(e) => { setMethod(e.target.value); setVerified(false) }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {isBank && (
              <div className="space-y-1.5">
                <Label htmlFor="payout-bank">Bank</Label>
                <select
                  id="payout-bank"
                  data-testid="payout-bank"
                  value={bankCode}
                  onChange={(e) => { setBankCode(e.target.value); setVerified(false) }}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">{banks.length ? 'Select bank…' : 'Loading banks…'}</option>
                  {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="payout-name">Account holder name</Label>
              <Input id="payout-name" value={accountName} onChange={(e) => { setAccountName(e.target.value); setVerified(false) }} placeholder={isBank ? 'Auto-filled when verified' : 'e.g. John Okoye'} />
            </div>

            <div className={isBank ? 'space-y-1.5 md:col-span-2' : 'space-y-1.5 md:col-span-2'}>
              <Label htmlFor="payout-details">
                {isBank ? 'Account number (10-digit NUBAN)' : 'Account number / IBAN / wallet / phone'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="payout-details" value={details}
                  onChange={(e) => { setDetails(e.target.value); setVerified(false) }}
                  inputMode={isBank ? 'numeric' : undefined}
                  placeholder={isBank ? '0123456789' : 'Payout destination'}
                />
                {isBank && (
                  <Button
                    type="button" variant="outline" onClick={verifyAccount} disabled={verifying}
                    data-testid="payout-verify"
                    className="shrink-0 rounded-full border-emerald-400/50 font-semibold text-emerald-500 hover:bg-emerald-400/10"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />} Verify
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:col-span-4">
              <Button onClick={savePayout} disabled={payoutBusy} data-testid="payout-save" className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black">
                {payoutBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save details
              </Button>
              {payoutSaved && (
                <Badge className="border-transparent bg-emerald-400/15 text-emerald-400">
                  <ShieldCheck className="mr-1 h-3 w-3" /> saved
                </Badge>
              )}
              {isBank && verified && (
                <Badge data-testid="payout-verified-badge" className="border-transparent bg-emerald-400/15 text-emerald-400">
                  <BadgeCheck className="mr-1 h-3 w-3" /> account verified
                </Badge>
              )}
              <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
                {paystackMode === 'demo' ? 'Paystack · sandbox mode (no keys yet)' : paystackMode === 'paystack' ? 'Secured by Paystack' : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* withdraw */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4 text-emerald-400" /> Withdraw coins</CardTitle>
            <CardDescription>
              Balance: <b>{coins.toLocaleString()}</b> coins · minimum {MIN_WITHDRAW} coins ·
              {' '}<b className="text-foreground">₦1 per coin</b> — paid straight to your bank via Paystack.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="wd-amount">Amount (coins) — you receive ₦{formatNairaPreview(amount)}</Label>
              <Input
                id="wd-amount" type="number" min={MIN_WITHDRAW} step={100}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={String(Math.max(MIN_WITHDRAW, Math.min(coins, 1000)))}
                disabled={!payoutSaved}
              />
            </div>
            <Button onClick={withdraw} disabled={withdrawBusy || !payoutSaved} data-testid="withdraw-button" className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 font-bold text-black disabled:opacity-50">
              {withdrawBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />} Cash out via Paystack
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* history */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Withdrawal history</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
            ) : (
              <div className="space-y-2">
                {withdrawals.map((w, i) => (
                  <motion.div
                    key={w.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-border/60 p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={cn('border-transparent', STATUS_STYLE[w.status] ?? '')}>{w.status}</Badge>
                      <span className="font-bold tabular-nums">{w.amountCoins.toLocaleString()} coins</span>
                      <span className="text-muted-foreground">≈ ₦{(w.amountNaira ?? w.amountCoins).toLocaleString()}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {w.transferRef && (
                      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">ref: {w.transferRef}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  )
}

function formatNairaPreview(amount: string): string {
  const n = Math.floor(Number(amount))
  return Number.isFinite(n) && n > 0 ? n.toLocaleString() : '—'
}

/* ---------------- Privacy toggles ---------------- */

const PRIVACY_ITEMS: { key: keyof SettingsPayload; label: string; description: string }[] = [
  { key: 'privateProfile', label: 'Private profile', description: 'Only followers can see your posts and stories' },
  { key: 'showOnlineStatus', label: 'Show online status', description: 'Let others see when you are active' },
  { key: 'messagesFromAnyone', label: 'Messages from anyone', description: 'Off = only people you follow can start a chat' },
  { key: 'showReadReceipts', label: 'Read receipts', description: 'Show others when you have read their messages' },
  { key: 'searchableByEmail', label: 'Searchable by email', description: 'Allow people who have your email to find you' },
]

function PrivacyTab({ data, onSaved }: { data: SettingsPayload; onSaved: () => void }) {
  const [state, setState] = useState<Record<string, boolean>>({
    privateProfile: data.privateProfile,
    showOnlineStatus: data.showOnlineStatus,
    messagesFromAnyone: data.messagesFromAnyone,
    showReadReceipts: data.showReadReceipts,
    searchableByEmail: data.searchableByEmail,
  })
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = async (key: string, value: boolean) => {
    setState((s) => ({ ...s, [key]: value })) // optimistic
    setBusy(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'privacy', privacy: { [key]: value } }),
      })
      const d = await res.json()
      if (!d.ok) { sonner.error(d.error ?? 'Could not save'); setState((s) => ({ ...s, [key]: !value })) }
      else sonner.success('Privacy setting saved')
    } catch {
      sonner.error('Network error')
      setState((s) => ({ ...s, [key]: !value }))
    } finally { setBusy(null) }
  }

  return (
    <TabsContent value="privacy" className="mt-4 space-y-3">
      {PRIVACY_ITEMS.map((item, i) => (
        <motion.div key={item.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={Boolean(state[item.key])}
                onCheckedChange={(v) => toggle(item.key, v)}
                disabled={busy === item.key}
                aria-label={item.label}
              />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </TabsContent>
  )
}

/* ---------------- Legal: Terms & Conditions + Privacy Policy ---------------- */

function LegalTab() {
  return (
    <TabsContent value="legal" className="mt-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-amber-400" /> Terms &amp; Conditions</CardTitle>
            <CardDescription>Last updated: September 2026 · ACE Social Platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p><b className="text-foreground">1. Eligibility.</b> You must be at least 13 years old to use ACE. By creating an account you confirm that the information you provide is accurate and that you will keep it current.</p>
            <p><b className="text-foreground">2. Your content.</b> You keep ownership of everything you post. You grant ACE a worldwide, royalty-free licence to host, store and display your content solely to operate the service. You are responsible for the media you upload and confirm you hold the necessary rights.</p>
            <p><b className="text-foreground">3. Community rules.</b> No harassment, hate speech, nudity, impersonation, scams or illegal content. Posts and accounts violating these rules may be removed by moderators, with or without notice.</p>
            <p><b className="text-foreground">4. Contests.</b> Contest entries must be your own work. Vote manipulation (bots, vote-buying, multi-accounts) voids entries and may result in suspension. Winners are crowned automatically when voting closes and prizes are credited by the contest creator.</p>
            <p><b className="text-foreground">5. Coins &amp; payouts.</b> ACE coins are a virtual balance with no cash value until converted through an approved withdrawal. Minimum withdrawal is 500 coins; the indicative rate is 10,000 coins = $10. Withdrawal requests are reviewed and paid to the payment account saved in your settings. Fraudulent activity voids pending payouts.</p>
            <p><b className="text-foreground">6. Name changes.</b> Display names can be changed once every 60 days to protect followers from impersonation.</p>
            <p><b className="text-foreground">7. Termination.</b> You may stop using ACE at any time. We may suspend accounts that break these terms or the law.</p>
            <p><b className="text-foreground">8. Liability.</b> The service is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law, ACE is not liable for indirect or consequential damages arising from your use of the platform.</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Privacy Policy</CardTitle>
            <CardDescription>What we collect, why, and the controls you have.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p><b className="text-foreground">Data we store.</b> Your username, email, password (hashed with scrypt — we never see your plain password), profile details, posts, stories, messages, and activity needed to run feeds and notifications.</p>
            <p><b className="text-foreground">Payment details.</b> Payout account details are visible only to you and the payout processor. They are never shown on public profiles or shared with other users.</p>
            <p><b className="text-foreground">Your privacy controls.</b> Settings → Privacy lets you make your profile private, hide your online status, restrict who can message you, disable read receipts, and hide your profile from email lookups. Changes apply immediately.</p>
            <p><b className="text-foreground">Cookies.</b> We use a single signed, httpOnly session cookie (and a local storage fallback) to keep you logged in. No advertising or third-party tracking cookies are used.</p>
            <p><b className="text-foreground">Deletion.</b> Deleting a post, story or your account removes the underlying data. Some copies may persist in encrypted backups for up to 30 days.</p>
            <p><b className="text-foreground">Contact.</b> Questions about privacy? Reach the team through in-app support or the admin contact published on the About page.</p>
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  )
}
