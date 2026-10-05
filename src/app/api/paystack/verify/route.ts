import { NextRequest } from 'next/server'
import { handle, ok, fail, readJson } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import {
  PAYSTACK_ENABLED,
  activateProFromPayment,
  verifyTransaction,
} from '@/lib/paystack'

export const runtime = 'nodejs'

// POST /api/paystack/verify — confirm a checkout and switch PRO on.
// Live mode: the reference is verified against the Paystack API
// (status + amount) before activation. Demo mode: the pending Payment
// created by /initialize is activated directly.
export const POST = (req: NextRequest) =>
  handle(req, async (user) => {
    const body = await readJson<{ reference?: string }>(req)
    const reference = String(body.reference ?? '').trim()
    if (!reference) return fail('Missing payment reference')

    const payment = await db.payment.findUnique({ where: { reference } })
    if (!payment || payment.userId !== user.id) {
      return fail('Payment not found', 404)
    }
    if (payment.status === 'success') {
      return ok({ plan: payment.plan, already: true })
    }

    if (PAYSTACK_ENABLED && payment.provider === 'paystack') {
      const tx = await verifyTransaction(reference)
      if (!tx.success) {
        return fail('Payment has not been confirmed yet — try again in a moment', 402)
      }
      if (typeof tx.amountKobo === 'number' && tx.amountKobo < payment.amountKobo) {
        await db.payment.update({
          where: { reference },
          data: { status: 'failed' },
        })
        return fail('Payment amount did not match the plan price', 402)
      }
    }

    const result = await activateProFromPayment(reference)
    if (!result.ok) return fail('Could not activate PRO — contact support', 500)

    return ok({ plan: result.plan ?? payment.plan, already: Boolean(result.already) })
  })
