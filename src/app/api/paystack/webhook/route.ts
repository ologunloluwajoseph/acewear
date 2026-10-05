import { NextRequest, NextResponse } from 'next/server'
import { activateProFromPayment, verifyWebhookSignature } from '@/lib/paystack'

export const runtime = 'nodejs'

// POST /api/paystack/webhook — Paystack event receiver.
// The raw body is HMAC-SHA512 signed by Paystack (x-paystack-signature)
// using the secret key; the signature must verify before anything is
// processed. charge.success activates PRO idempotently (the same
// reference may also arrive through the verify callback).
export async function POST(req: NextRequest) {
  const raw = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const event = JSON.parse(raw) as {
      event?: string
      data?: { reference?: string }
    }

    if (event.event === 'charge.success' && event.data?.reference) {
      await activateProFromPayment(event.data.reference)
    }
  } catch {
    // never fail the webhook — Paystack retries non-200s, but a bad body
    // will never become valid, so acknowledge it and move on
  }

  return NextResponse.json({ ok: true })
}
