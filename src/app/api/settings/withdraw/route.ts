import { NextRequest } from 'next/server'
import { handle, ok, fail, readJson } from '@/lib/api-helpers'
import { rateLimit } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  PAYSTACK_ENABLED,
  createTransferRecipient,
  initTransfer,
  randomRef,
} from '@/lib/paystack'
import { COINS_TO_NAIRA } from '@/lib/premium-plans'

export const runtime = 'nodejs'

const MIN_WITHDRAW_COINS = 500

// POST /api/settings/withdraw — request a coin -> cash payout.
// Atomic: balance check + deduction + request row all happen inside one
// interactive transaction, so double-clicks can never overdraw.
//
// Payout execution (Task 16, Paystack):
//  - bank payouts with live keys   -> transfer recipient created/cached,
//                                     a real Paystack transfer is fired,
//                                     status = processing (+ transfer ref)
//  - bank payouts in demo mode     -> simulated TRF_demo_ reference,
//                                     auto-settles to paid after ~8s
//  - other methods (paypal, crypto, mobile money) -> status = pending,
//                                     settled manually by an admin
export const POST = (req: NextRequest) =>
  handle(req, async (user) => {
    if (!rateLimit(`wd:${user.id}`, 5, 60_000)) {
      return fail('Too many requests — try again in a minute', 429)
    }

    const body = await readJson<{ amountCoins?: number }>(req)
    const amount = Math.floor(Number(body.amountCoins))
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_COINS) {
      return fail(`Minimum withdrawal is ${MIN_WITHDRAW_COINS} coins`)
    }

    const account = await db.user.findUnique({
      where: { id: user.id },
      select: {
        aceCoins: true,
        payoutMethod: true,
        payoutAccountName: true,
        payoutDetails: true,
        payoutBankCode: true,
        payoutBankName: true,
        paystackRecipientCode: true,
      },
    })
    if (!account) return fail('Account not found', 404)
    if (!account.payoutMethod || !account.payoutAccountName || !account.payoutDetails) {
      return fail('Save your payment account details before withdrawing', 428)
    }
    if (!account.aceCoins || account.aceCoins < amount) {
      return fail(`Insufficient balance — you have ${account.aceCoins ?? 0} coins`)
    }

    const bankLabel = account.payoutBankName ? ` • ${account.payoutBankName}` : ''
    const destination = `${account.payoutMethod}${bankLabel} • ${account.payoutAccountName} • ${account.payoutDetails}`
    const amountNaira = amount * COINS_TO_NAIRA

    const withdrawal = await db
      .$transaction(async (tx) => {
        const fresh = await tx.user.findUnique({
          where: { id: user.id },
          select: { aceCoins: true },
        })
        if (!fresh || fresh.aceCoins < amount) {
          throw new Error('INSUFFICIENT')
        }
        await tx.user.update({
          where: { id: user.id },
          data: { aceCoins: { decrement: amount } },
        })
        return tx.withdrawal.create({
          data: {
            userId: user.id,
            amountCoins: amount,
            amountNaira,
            method: account.payoutMethod!,
            destination,
            status: 'pending',
          },
        })
      })
      .catch((e: Error) => {
        if (e.message === 'INSUFFICIENT') return null
        throw e
      })

    if (!withdrawal) {
      return fail('Insufficient balance — coins may have changed, refresh and retry')
    }

    // ---------- Paystack execution for bank payouts ----------
    let transferNote = ''
    if (withdrawal.method === 'bank') {
      if (PAYSTACK_ENABLED && account.payoutBankCode) {
        let recipient = account.paystackRecipientCode
        if (!recipient) {
          recipient = await createTransferRecipient({
            name: account.payoutAccountName!,
            accountNumber: account.payoutDetails!,
            bankCode: account.payoutBankCode,
          })
          if (recipient) {
            await db.user.update({
              where: { id: user.id },
              data: { paystackRecipientCode: recipient },
            })
          }
        }
        if (recipient) {
          const reference = randomRef(`ACE-WD${withdrawal.id}`.toUpperCase())
          const sent = await initTransfer({
            amountNaira,
            recipient,
            reference,
            reason: `ACE coin withdrawal #${withdrawal.id}`,
          })
          if (sent.ok) {
            await db.withdrawal.update({
              where: { id: withdrawal.id },
              data: { status: 'processing', transferRef: reference },
            })
            transferNote = 'Paystack transfer initiated'
          } else {
            transferNote = sent.message ?? 'Transfer queued for review'
          }
        } else {
          transferNote = 'Recipient setup failed — payout queued for review'
        }
      } else {
        // demo mode — simulated instant handoff
        const reference = randomRef(`TRF_demo_wd${withdrawal.id}`)
        await db.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: 'processing', transferRef: reference },
        })
        transferNote = 'Sandbox transfer initiated (demo mode)'
      }
    }

    return ok({
      withdrawal: {
        id: withdrawal.id,
        amountCoins: withdrawal.amountCoins,
        amountNaira,
        method: withdrawal.method,
        status: transferNote.startsWith('Paystack') || transferNote.startsWith('Sandbox')
          ? 'processing'
          : withdrawal.status,
        transferNote,
        createdAt: withdrawal.createdAt,
      },
      remainingCoins: (account.aceCoins ?? 0) - amount,
    })
  })
