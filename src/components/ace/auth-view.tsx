'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, Mail, Spade } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { setToken } from '@/lib/session-token'
import { useAppStore } from '@/lib/client-store'
import type { SessionUser } from '@/lib/auth'

export function AuthView({
  onAuthenticated,
}: {
  onAuthenticated: (user: SessionUser) => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (
    url: string,
    payload: Record<string, string>,
    fallbackError: string
  ) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? fallbackError)
      } else {
        // Persist Bearer fallback before anything else can fire /api/ calls
        if (data.token) setToken(data.token)
        // Log in with the user object from THIS response — no dependent
        // session fetch that could bounce back to the auth screen in
        // cookie/storage-restricted preview browsers.
        if (data.user) onAuthenticated(data.user)
        else void useAppStore.getState().refreshMe()
        router.refresh()
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setBusy(false)
    }
  }

  const [loginId, setLoginId] = useState('demo')
  const [loginPw, setLoginPw] = useState('password123')
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPw, setRegPw] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg shadow-amber-900/40">
            <Spade className="h-10 w-10 text-black" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-gradient-gold">ACE</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where every face is a wild card.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-6 shadow-2xl"
        >
          <Tabs
            defaultValue="login"
            onValueChange={() => setError(null)}
          >
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit(
                    '/api/auth/login',
                    { identifier: loginId.trim(), password: loginPw },
                    'Login failed'
                  )
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="identifier">Username or email</Label>
                  <Input
                    id="identifier"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="demo"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" disabled={busy} className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign in
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  data-testid="forgot-password-link"
                  className="mx-auto block text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
                <p className="rounded-xl bg-muted/60 p-3 text-center text-xs text-muted-foreground">
                  Demo accounts — <b className="text-foreground">demo / password123</b> (full PRO
                  ♦ + 25,000 coins) · <b className="text-foreground">admin / admin123</b>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit(
                    '/api/auth/register',
                    {
                      username: regUsername.trim().toLowerCase(),
                      email: regEmail.trim().toLowerCase(),
                      password: regPw,
                    },
                    'Registration failed'
                  )
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input
                    id="reg-username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="wild_card_01"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    3–30 characters — letters, numbers and underscores only.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password (8+ chars)</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={regPw}
                    onChange={(e) => setRegPw(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" disabled={busy} className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign up
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Next.js 16 · Node.js runtime · SSE realtime · PWA-ready
        </p>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  )
}

// =====================================================================
// Forgot password (Task 23) — creates a single-use reset token and, in
// this deployment (no SMTP yet), hands the reset link straight back so
// the user can copy it. Same dev-mode delivery as verify-email.
// =====================================================================

function ForgotPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const request = async () => {
    setBusy(true)
    setErr(null)
    setLink(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setLink(data.resetUrl ?? null)
        if (!data.resetUrl) setErr(data.message ?? 'No reset link was returned.')
      } else {
        setErr(data.error ?? 'Request failed')
      }
    } catch {
      setErr('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy your reset link:', link)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setLink(null); setErr(null); setCopied(false) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-400" /> Reset your password
          </DialogTitle>
          <DialogDescription>
            Enter the email on your account and we&apos;ll create a one-hour reset link.
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <Button
              onClick={request}
              disabled={busy || !email.trim()}
              data-testid="forgot-password-send"
              className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Create reset link
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              No mail provider is wired in this build yet — the link appears here instead of
              your inbox.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-emerald-400">Reset link ready — valid for 1 hour.</p>
            <p className="break-all rounded-xl bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {link}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 rounded-full" onClick={copy}>
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
              <a
                href={link}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-sm font-bold text-black transition hover:from-amber-300 hover:to-amber-500"
              >
                Open reset page
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
