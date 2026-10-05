import { NextRequest } from 'next/server'
import { handleAdmin, ok, fail, readJson } from '@/lib/api-helpers'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const SELECT = {
  id: true,
  amountCoins: true,
  amountNaira: true,
  method: true,
  destination: true,
  status: true,
  transferRef: true,
  createdAt: true,
  processedAt: true,
  user: {
    select: { id: true, username: true, firstName: true, payoutAccountName: true },
  },
}

// GET /api/admin/withdrawals — payout queue for the admin dashboard.
export const GET = (req: NextRequest) =>
  handleAdmin(req, async () => {
    const withdrawals = await db.withdrawal.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 60,
      select: SELECT,
    })
    return ok({ withdrawals })
  })

// POST /api/admin/withdrawals — process a payout request.
// action 'paid' marks the withdrawal settled (Paystack transfers settle
// themselves via webhook; demo transfers auto-settle on the user side).
// action 'rejected' refunds the coins back to the user's balance.
export const POST = (req: NextRequest) =>
  handleAdmin(req, async () => {
    const body = await readJson<{ id?: number; action?: string; note?: string }>(req)
    const id = Number(body.id)
    const action = String(body.action ?? '')
    if (!Number.isFinite(id)) return fail('Missing withdrawal id')
    if (action !== 'paid' && action !== 'rejected') return fail('Unknown action')

    const withdrawal = await db.withdrawal.findUnique({ where: { id } })
    if (!withdrawal) return fail('Withdrawal not found', 404)
    if (withdrawal.status === 'paid' || withdrawal.status === 'rejected') {
      return fail('This withdrawal was already processed', 409)
    }

    if (action === 'rejected') {
      await db.$transaction([
        db.withdrawal.update({
          where: { id },
          data: {
            status: 'rejected',
            processedAt: new Date(),
            note: body.note ?? 'Rejected by admin — coins refunded',
          },
        }),
        db.user.update({
          where: { id: withdrawal.userId },
          data: { aceCoins: { increment: withdrawal.amountCoins } },
        }),
      ])
      return ok({ status: 'rejected', refunded: withdrawal.amountCoins })
    }

    await db.withdrawal.update({
      where: { id },
      data: {
        status: 'paid',
        processedAt: new Date(),
        note: body.note ?? 'Settled via Paystack',
      },
    })
    return ok({ status: 'paid' })
  })
