'use client'

import { useEffect } from 'react'
import { RefreshCw, Spade } from 'lucide-react'

// =====================================================================
// Route-level error boundary — glass card, ace suits, a "reshuffle"
// (retry) button. next/error.tsx conventions: receives error + reset.
// =====================================================================

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ace-error-boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card/60 p-8 text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <span aria-hidden className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-15 blur-[1px]">♦</span>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-black">
          <Spade className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-black">The dealer dropped the deck</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Something went wrong while dealing this view. Reshuffling usually fixes it — your
          chips are safe.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-6 text-sm font-bold text-black transition hover:from-amber-300 hover:to-amber-500 active:translate-y-px"
        >
          <RefreshCw className="h-4 w-4" /> Reshuffle
        </button>
      </div>
    </div>
  )
}
