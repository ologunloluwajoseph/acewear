'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BadgeCheck, Loader2, MailCheck, XCircle } from 'lucide-react'

// =====================================================================
// /verify-email — lands from a verification link (?token=<raw>).
// Verifies automatically once on mount, then shows the outcome.
// =====================================================================

type Status = 'working' | 'verified' | 'failed'

export function VerifyEmailClient() {
  const token = useSearchParams().get('token') ?? ''
  const [status, setStatus] = useState<Status>('working')
  const [message, setMessage] = useState('')
  const burned = useRef(false)

  useEffect(() => {
    if (burned.current) return
    burned.current = true
    if (!token) return // render derives the failed state — no sync setState
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setStatus('verified')
          setMessage(d.message ?? 'Email verified.')
        } else {
          setStatus('failed')
          setMessage(d.error ?? 'Verification failed — the link may have expired.')
        }
      })
      .catch(() => {
        setStatus('failed')
        setMessage('Network error — try opening the link again.')
      })
  }, [token])

  // a missing token is derived at render time (no setState-in-effect)
  const view: Status = !token ? 'failed' : status
  const shown = !token && !message ? 'No verification token in the link.' : message

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/60 p-8 text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="mb-4 flex justify-center">
          {view === 'working' && <Loader2 className="h-12 w-12 animate-spin text-amber-400" />}
          {view === 'verified' && <BadgeCheck className="h-12 w-12 text-emerald-400" />}
          {view === 'failed' && <XCircle className="h-12 w-12 text-destructive" />}
        </div>
        <h1 className="text-xl font-black">
          {view === 'working' && 'Checking your link…'}
          {view === 'verified' && 'Email verified!'}
          {view === 'failed' && 'Verification problem'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{shown || 'One moment.'}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-6 text-sm font-bold text-black transition hover:from-amber-300 hover:to-amber-500"
        >
          <MailCheck className="mr-2 h-4 w-4" /> Open ACE
        </Link>
      </div>
    </div>
  )
}
