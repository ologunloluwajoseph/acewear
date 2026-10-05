import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clampInt, fail, handle, ok, readJson, sanitizeText } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shop/reviews?productId=1 — verified reviews for a product
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const productId = clampInt(url.searchParams.get('productId'), 1, Number.MAX_SAFE_INTEGER, 0)
  if (!productId) return fail('productId is required')

  const reviews = await db.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true,
          avatarUrl: true, isVerified: true,
        },
      },
    },
    take: 50,
  })
  return NextResponse.json({ ok: true, reviews })
}

// POST /api/shop/reviews — GATED: requires a completed order (social proof)
export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const body = await readJson<{
      productId?: number
      rating?: number
      body?: string
    }>(req)

    const productId = Number(body.productId)
    const rating = clampInt(body.rating, 1, 5, 0)
    const text = sanitizeText(body.body, 1000)

    if (!Number.isInteger(productId)) return fail('Invalid product')
    if (!rating) return fail('Please select a rating from 1 to 5 stars')
    if (!text) return fail('Please write a few words about the product')

    // --- The gate: verified purchase required -----------------------
    const completedOrder = await db.order.findFirst({
      where: { userId: user.id, productId, status: 'completed' },
    })
    if (!completedOrder) {
      return fail(
        'Reviews are gated: buy this product first to post a verified review',
        403,
        { gated: true }
      )
    }
    // -----------------------------------------------------------------

    const duplicate = await db.review.findUnique({
      where: { productId_userId: { productId, userId: user.id } },
    })
    if (duplicate) {
      return fail('You already reviewed this product', 409)
    }

    const review = await db.review.create({
      data: { productId, userId: user.id, rating, body: text, verified: true },
      include: {
        user: {
          select: {
            id: true, username: true, firstName: true,
            avatarUrl: true, isVerified: true,
          },
        },
      },
    })

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    })

    // Thank the buyer via notification
    await notify({
      userId: user.id,
      type: 'review',
      text: `Your verified review for ${product?.name ?? 'the product'} is live. Thanks!`,
      targetType: 'product',
      targetId: productId,
    })

    return ok({ review })
  })
}
