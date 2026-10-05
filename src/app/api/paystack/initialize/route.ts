import { NextRequest } from 'next/server'
import { handle, ok, fail, readJson } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { PAYSTACK_ENABLED, paystackPublicKey, randomRef } from '@/lib/paystack'
import { findPlan } from '@/lib/premium-plans'

export const runtime = 'nodejs'

// POST /api/paystack/initialize — start a PRO checkout.
// Creates a pending Payment row and returns everything the inline popup
// needs (public key, email, amount in kobo, reference). When no Paystack
// keys are configured the reference is a demo one and the client shows
// the built-in sandbox checkout instead of the live popup.
export const POST = (req: NextRequest) =>
  handle(req, async (user) => {
    const body = await readJson<{ plan?: string }>(req)
    const plan = findPlan(String(body.plan ?? ''))
    if (!plan) return fail('Unknown plan')

    if (user.isPro) {
      return fail('You are already a PRO member — the crown stays on ♦', 409)
    }

    const reference = randomRef(`ACE-${plan.id}`.toUpperCase())
    const amountKobo = plan.priceNaira * 100

    await db.payment.create({
      data: {
        userId: user.id,
        plan: plan.id,
        amountKobo,
        reference,
        provider: PAYSTACK_ENABLED ? 'paystack' : 'demo',
        status: 'pending',
      },
    })

    if (PAYSTACK_ENABLED && paystackPublicKey()) {
      return ok({
        mode: 'paystack',
        reference,
        amountKobo,
        plan: plan.id,
        email: user.email,
        publicKey: paystackPublicKey(),
      })
    }

    return ok({
      mode: 'demo',
      reference,
      amountKobo,
      plan: plan.id,
      email: user.email,
    })
  })
