import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shop/products — catalog with aggregate rating
export async function GET() {
  const products = await db.product.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      reviews: { select: { rating: true } },
      _count: { select: { reviews: true, orders: true } },
    },
  })
  return NextResponse.json({
    ok: true,
    products: products.map((p) => {
      const ratings = p.reviews.map((r) => r.rating)
      const avg = ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        priceCoins: p.priceCoins,
        image: p.image,
        category: p.category,
        stock: p.stock,
        rating: avg ? Math.round(avg * 10) / 10 : null,
        reviewsCount: p._count.reviews,
        soldCount: p._count.orders,
      }
    }),
  })
}
