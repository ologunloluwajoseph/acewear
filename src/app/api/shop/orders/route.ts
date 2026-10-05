import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { fail, handle, ok, readJson } from '@/lib/api-helpers'
import { notify } from '@/lib/notify'

export const runtime = 'nodejs'

// POST /api/shop/orders — purchase with ACE coins (atomic transaction)
export async function POST(req: NextRequest) {
  return handle(req, async (user) => {
    const { productId } = await readJson<{ productId?: number }>(req)
    const pid = Number(productId)
    if (!Number.isInteger(pid)) return fail('Invalid product')

    try {
      const result = await db.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: pid } })
        if (!product) throw new Error('Product not found')
        if (product.stock === 0) throw new Error('This item is out of stock')

        const fresh = await tx.user.findUnique({
          where: { id: user.id },
          select: { aceCoins: true },
        })
        if (!fresh || fresh.aceCoins < product.priceCoins) {
          throw new Error('Not enough ACE coins for this purchase')
        }

        await tx.user.update({
          where: { id: user.id },
          data: { aceCoins: { decrement: product.priceCoins } },
        })

        const order = await tx.order.create({
          data: {
            userId: user.id,
            productId: product.id,
            priceCoins: product.priceCoins,
            status: 'completed',
          },
        })

        if (product.stock > 0) {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: 1 } },
          })
        }

        return { order, product }
      })

      await notify({
        userId: user.id,
        type: 'purchase',
        text: `Purchase confirmed: ${result.product.name} (−${result.product.priceCoins} coins). You can now leave a verified review!`,
        targetType: 'product',
        targetId: result.product.id,
      })

      return ok({
        order: result.order,
        coinsLeft: (await db.user.findUnique({
          where: { id: user.id },
          select: { aceCoins: true },
        }))!.aceCoins,
      })
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Purchase failed', 409)
    }
  })
}

// GET /api/shop/orders — my purchase history (used for review gating)
export async function GET(req: NextRequest) {
  return handle(req, async (user) => {
    const orders = await db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, image: true } },
      },
      take: 50,
    })
    return ok({ orders })
  })
}
