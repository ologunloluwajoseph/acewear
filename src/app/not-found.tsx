import Link from 'next/link'

export const metadata = { title: '404 — ACE' }

// =====================================================================
// Branded 404 — "this card is not in the deck". Glass card + ace suits,
// consistent with the 3D glass button system (globals.css).
// =====================================================================

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card/60 p-8 text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* floating suits */}
        <span aria-hidden className="pointer-events-none absolute -left-4 -top-6 text-6xl opacity-15 blur-[1px]">♠</span>
        <span aria-hidden className="pointer-events-none absolute -right-3 top-10 text-5xl opacity-15 blur-[1px]">♥</span>
        <span aria-hidden className="pointer-events-none absolute bottom-8 -left-2 text-5xl opacity-15 blur-[1px]">♦</span>
        <span aria-hidden className="pointer-events-none absolute -bottom-6 right-6 text-6xl opacity-15 blur-[1px]">♣</span>

        <p className="bg-gradient-to-br from-amber-300 to-amber-600 bg-clip-text text-7xl font-black tabular-nums text-transparent">
          404
        </p>
        <h1 className="mt-2 text-xl font-black">This card isn&apos;t in the deck</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          The page you were dealing for has been folded, moved, or never existed. Even the aces
          couldn&apos;t find it — and they look everywhere.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-6 text-sm font-bold text-black transition hover:from-amber-300 hover:to-amber-500"
        >
          Back to the table
        </Link>
      </div>
    </div>
  )
}
