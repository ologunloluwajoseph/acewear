import { NextRequest } from 'next/server'
import { handle, ok, fail, readJson } from '@/lib/api-helpers'
import { PAYSTACK_ENABLED, resolveBankAccount } from '@/lib/paystack'

export const runtime = 'nodejs'

// POST /api/paystack/resolve-account — verify a bank account number and
// return the holder's name (Paystack /bank/resolve). In demo mode a
// clearly-labeled placeholder name is returned so the payout flow stays
// fully testable without live keys.
export const POST = (req: NextRequest) =>
  handle(req, async (user) => {
    const body = await readJson<{ accountNumber?: string; bankCode?: string }>(req)
    const accountNumber = String(body.accountNumber ?? '').trim()
    const bankCode = String(body.bankCode ?? '').trim()

    if (!/^\d{10}$/.test(accountNumber)) {
      return fail('Enter the 10-digit account number')
    }
    if (!bankCode) return fail('Choose a bank first')

    const { accountName, live } = await resolveBankAccount(accountNumber, bankCode)
    if (live && accountName) {
      return ok({ accountName, verified: true, mode: 'paystack' })
    }
    if (live && !accountName) {
      return fail('Account could not be verified — check the number and bank', 422)
    }
    // demo mode
    return ok({
      accountName: `Verified account ••${accountNumber.slice(-4)}`,
      verified: true,
      mode: 'demo',
    })
  })
