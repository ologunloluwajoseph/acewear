import { NextRequest } from 'next/server'
import { handle, ok, fail } from '@/lib/api-helpers'
import { listNigerianBanks, PAYSTACK_ENABLED } from '@/lib/paystack'

export const runtime = 'nodejs'

// GET /api/paystack/banks — Nigerian banks for the payout form picker.
export const GET = (req: NextRequest) =>
  handle(req, async () => {
    try {
      const { banks, live } = await listNigerianBanks()
      return ok({ banks, mode: PAYSTACK_ENABLED ? 'paystack' : 'demo', live })
    } catch {
      return fail('Could not load banks', 502)
    }
  })
