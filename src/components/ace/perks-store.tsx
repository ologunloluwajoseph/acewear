'use client'

// =====================================================================
// PRO Perks Store — the coin-powered boosts / badges / frames that used
// to live on the Shop page. Perks are a premium feature, so the store
// now lives on the Premium page. Verified reviews still gate on real
// coin purchases (Order rows), exactly as before.
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Coins, Loader2, ShoppingCart, Star } from 'lucide-react'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AceAvatar, MediaImg, formatCoins, timeAgo } from '@/components/ace/media'
import type { ProductDTO, ReviewDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/client-store'

export function Stars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
      ))}
    </span>
  )
}

function PerkDialog({
  product, open, onOpenChange, onPurchased,
}: {
  product: ProductDTO | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onPurchased: () => void
}) {
  const me = useAppStore((s) => s.me)
  const refreshMe = useAppStore((s) => s.refreshMe)
  const [reviews, setReviews] = useState<ReviewDTO[]>([])
  const [myOrders, setMyOrders] = useState<number[]>([]) // productIds purchased
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [buying, setBuying] = useState(false)

  const load = useCallback(async () => {
    if (!product) return
    try {
      const [revRes, ordRes] = await Promise.all([
        fetch(`/api/shop/reviews?productId=${product.id}`, { cache: 'no-store' }),
        fetch('/api/shop/orders', { cache: 'no-store' }),
      ])
      const revData = await revRes.json()
      if (revData.ok) setReviews(revData.reviews)
      const ordData = await ordRes.json()
      if (ordData.ok) setMyOrders(ordData.orders.map((o: { product: { id: number } }) => o.product.id))
    } catch { /* offline */ }
  }, [product])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const hasPurchased = product ? myOrders.includes(product.id) : false
  const alreadyReviewed = product ? reviews.some((r) => r.user.id === me?.id) : false

  const buy = async () => {
    if (!product) return
    setBuying(true)
    try {
      const res = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success(`Purchased! ${data.coinsLeft} coins left. You can now leave a verified review.`)
        void refreshMe()
        onPurchased()
        void load()
      } else sonner.error(data.error ?? 'Purchase failed')
    } finally { setBuying(false) }
  }

  const submitReview = async () => {
    if (!product) return
    setBusy(true)
    try {
      const res = await fetch('/api/shop/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, rating, body }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success('Verified review published ✓')
        setBody(''); setRating(5)
        void load()
      } else sonner.error(data.error ?? 'Review failed')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {product && (
          <>
            <DialogHeader><DialogTitle>{product.name}</DialogTitle></DialogHeader>
            {product.image && (
              <MediaImg src={product.image} alt={product.name} className="aspect-square w-full rounded-xl object-cover" />
            )}
            <p className="text-sm text-muted-foreground">{product.description}</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 font-bold text-amber-400">
                <Coins className="h-4 w-4" /> {formatCoins(product.priceCoins)}
              </span>
              {product.rating !== null && <Stars rating={product.rating} />}
              <span className="text-xs text-muted-foreground">{product.soldCount} sold{product.stock > 0 ? ` · ${product.stock} left` : ''}</span>
            </div>

            {me ? (
              hasPurchased ? (
                alreadyReviewed ? (
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-400">
                    <BadgeCheck className="h-4 w-4" /> You own this — thanks for your verified review!
                  </p>
                ) : (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <Label>Leave a verified review</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button key={i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
                          <Star className={cn('h-6 w-6', i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                        </button>
                      ))}
                    </div>
                    <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="How was it? (verified purchase required)" maxLength={1000} />
                    <Button onClick={submitReview} disabled={busy || !body.trim()} className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500">
                      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-1 h-4 w-4" />} Publish review
                    </Button>
                  </div>
                )
              ) : (
                <Button onClick={buy} disabled={buying} className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500">
                  {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  Buy for {formatCoins(product.priceCoins)} coins
                </Button>
              )
            ) : null}

            <div className="space-y-3">
              <p className="text-sm font-semibold">Reviews ({reviews.length})</p>
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <AceAvatar user={r.user} className="h-7 w-7" />
                    <span className="text-sm font-medium">{r.user.firstName ?? r.user.username}</span>
                    <Badge className="gap-0.5 border-0 bg-emerald-400/10 text-[10px] text-emerald-400">
                      <BadgeCheck className="h-3 w-3" /> verified
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  </div>
                  <div className="mt-2"><Stars rating={r.rating} size="h-3.5 w-3.5" /></div>
                  <p className="mt-1.5 text-sm text-foreground/90">{r.body}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function PerksStore() {
  const me = useAppStore((s) => s.me)
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProductDTO | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/products', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setProducts(data.products)
    } catch { sonner.error('Could not load the perks store') } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div data-testid="perks-store">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">PRO Perks Store</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Boosts, badges and frames — spend coins, review only what you really own.
          </p>
        </div>
        {me && (
          <Badge className="shrink-0 gap-1 border-0 bg-amber-400/10 text-sm text-amber-400">
            <Coins className="h-4 w-4" /> {formatCoins(me.aceCoins)}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-amber-400" /></div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <button
              key={p.id}
              data-testid={`perk-product-${p.id}`}
              className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-amber-400/40"
              onClick={() => setSelected(p)}
            >
              {p.image ? (
                <MediaImg src={p.image} alt={p.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted text-4xl">🎁</div>
              )}
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-sm font-bold text-amber-400">
                    <Coins className="h-3.5 w-3.5" /> {formatCoins(p.priceCoins)}
                  </span>
                  {p.rating !== null && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {p.rating} ({p.reviewsCount})
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <PerkDialog product={selected} open={selected !== null} onOpenChange={(v) => !v && setSelected(null)} onPurchased={load} />
    </div>
  )
}
