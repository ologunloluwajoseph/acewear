'use client'

// =====================================================================
// Shop — the ACE marketplace (Task 16).
// Three official stores: AceWears, AceLaptops, AcePhones. Every product
// is a real item; clicking it (or "Buy") sends the user to the vendor's
// website. The vendor links arrive later — until then the buttons say
// "link coming soon" so the layout is already final.
// The coin-powered perks (boosts / badges / frames) moved to the
// Premium page's PRO Perks Store.
// =====================================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast as sonner } from 'sonner'
import { ExternalLink, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { SHOPS, type AceShop, type ShopProduct } from '@/lib/shops'
import { formatNaira } from '@/lib/premium-plans'
import { cn } from '@/lib/utils'

function openStore(shop: AceShop) {
  if (shop.url) {
    window.open(shop.url, '_blank', 'noopener,noreferrer')
  } else {
    sonner.info(`${shop.name} store link coming soon — the vendor site will be connected here.`)
  }
}

function ProductDialog({
  shop, product, open, onOpenChange,
}: {
  shop: AceShop
  product: ShopProduct | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  if (!product) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{product.name}</DialogTitle>
          <DialogDescription>
            {shop.name} · {shop.tagline}
          </DialogDescription>
        </DialogHeader>
        <img
          src={product.image}
          alt={product.name}
          className="aspect-square w-full rounded-xl object-cover"
        />
        <p className="text-sm text-muted-foreground">{product.blurb}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl font-black tabular-nums text-gradient-gold">
            {formatNaira(product.priceNaira)}
          </span>
          {product.tag && (
            <Badge className="border-0 bg-amber-400/15 text-amber-400">{product.tag}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Nationwide delivery</span>
          <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Authentic &amp; guaranteed</span>
        </div>
        <Button
          onClick={() => openStore(shop)}
          data-testid="shop-product-buy"
          className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-black hover:from-amber-300 hover:to-amber-500"
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Buy at {shop.name}
        </Button>
        {!shop.url && (
          <p className="-mt-1 text-center text-[11px] text-muted-foreground">
            {shop.name} website link coming soon.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ShopView() {
  const [selected, setSelected] = useState<{ shop: AceShop; product: ShopProduct } | null>(null)

  return (
    <div className="space-y-6 p-4 pb-8" data-testid="shop-page">
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Shop</h1>
          <p className="text-sm text-muted-foreground">
            Real products from the official ACE stores — tap anything and buy it on the vendor&apos;s site.
          </p>
        </div>
      </div>

      {/* stores */}
      {SHOPS.map((shop) => (
        <section
          key={shop.id}
          aria-label={shop.name}
          data-testid={`shop-section-${shop.id}`}
          className="overflow-hidden rounded-3xl border border-border"
        >
          {/* store banner */}
          <div className={cn('relative bg-gradient-to-br p-5 text-white', shop.gradient)}>
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl backdrop-blur">
                {shop.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black" data-testid={`shop-name-${shop.id}`}>{shop.name}</h2>
                <p className={cn('text-xs font-semibold', shop.accent)}>{shop.tagline}</p>
              </div>
              <Button
                size="sm"
                onClick={() => openStore(shop)}
                data-testid={`shop-visit-${shop.id}`}
                className="shrink-0 rounded-full bg-white/15 font-semibold text-white backdrop-blur hover:bg-white/25"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Visit store
              </Button>
            </div>
            <p className="mt-2.5 max-w-md text-xs leading-relaxed text-white/70">
              {shop.description}
            </p>
          </div>

          {/* products */}
          <div className="grid grid-cols-2 gap-3 bg-card/40 p-3 sm:grid-cols-4">
            {shop.products.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                data-testid={`shop-product-${shop.id}-${p.id}`}
                onClick={() => setSelected({ shop, product: p })}
                className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-amber-400/40"
              >
                <div className="relative">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  {p.tag && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                      {p.tag}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-sm font-bold tabular-nums text-amber-400">
                      {formatNaira(p.priceNaira)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground transition group-hover:text-foreground">
                      Buy <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      ))}

      <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Looking for boosts, badges and frames? Those are premium perks now — find them in
        <b className="text-foreground"> Premium → PRO Perks Store</b>.
      </p>

      <ProductDialog
        shop={selected?.shop as AceShop}
        product={selected?.product ?? null}
        open={selected !== null}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  )
}
