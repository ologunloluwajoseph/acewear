'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react'

// =====================================================================
// /reset-password — lands from a "forgot password" link:
//   ?token=<raw>  -> shows a new-password form (POST /api/auth/reset-password)
//   no token      -> explain the flow + back to sign in
// The token is single-use and burns on success; sessions on other
// devices are invalidated server-side via tokenVersion bump.
// =====================================================================

export function ResetPasswordClient() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (data.ok) setDone(true)
      else setError(data.error ?? 'Reset failed — the link may have expired')
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/60 p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-xl font-black">New password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a fresh one — at least 8 characters.
          </p>
        </div>

        {!token ? (
          <div className="text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              This page needs a reset link. Request one from the sign-in screen
              (&ldquo;Forgot password?&rdquo;) and open the link it gives you.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-6 text-sm font-bold text-black transition hover:from-amber-300 hover:to-amber-500"
            >
              Back to sign in
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-3 text-sm font-semibold">Password updated!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              All other sessions were signed out. Head back and sign in with your new password.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-6 text-sm font-bold text-black transition hover:from-amber-300 hover:to-amber-500"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm outline-none focus:border-amber-400/60"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm outline-none focus:border-amber-400/60"
            />
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-sm font-bold text-black transition hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
