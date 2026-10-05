// =====================================================================
// Paystack integration (server-only) — Task 16
// ---------------------------------------------------------------------
// Powers two money flows:
//   1. PRO checkout       -> transaction verify + webhook activation
//   2. Coin payouts       -> bank resolve, transfer recipients, transfers
//
// Mode: when PAYSTACK_SECRET_KEY is configured every call hits the live
// Paystack API (works with sk_test_… keys out of the box). Without a key
// the platform runs in DEMO mode: the exact same flows execute locally
// with simulated references so the whole experience stays testable.
// Plug real keys into .env and the same code paths go live — no changes.
// =====================================================================

import crypto from 'crypto'
import { db } from '@/lib/db'

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? ''
export const PAYSTACK_ENABLED = /^sk_(test|live)_/.test(SECRET_KEY)

const API = 'https://api.paystack.co'

export function paystackPublicKey(): string {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? ''
}

interface PaystackEnvelope<T> {
  status: boolean
  message: string
  data: T
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<PaystackEnvelope<T>> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  return (await res.json()) as PaystackEnvelope<T>
}

// ---------- banks ----------

export interface BankInfo {
  name: string
  code: string
}

/** Offline fallback (Paystack NG codes) used when the API is unreachable. */
export const NGN_BANKS_FALLBACK: BankInfo[] = [
  { name: 'Access Bank', code: '044' },
  { name: 'ALAT by Wema', code: '035A' },
  { name: 'Citibank Nigeria', code: '023' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'FCMB Bank', code: '214' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Microfinance Bank', code: '50211' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'OPay Digital Services', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Providus Bank', code: '052' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Standard Chartered', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
]

export async function listNigerianBanks(): Promise<{
  banks: BankInfo[]
  live: boolean
}> {
  if (!PAYSTACK_ENABLED) return { banks: NGN_BANKS_FALLBACK, live: false }
  try {
    const data = await call<{ name: string; code: string }[]>(
      'GET',
      '/bank?currency=NGN&type=nip_bank&perPage=200'
    )
    if (data.status && Array.isArray(data.data) && data.data.length > 0) {
      return {
        banks: data.data
          .map((b) => ({ name: b.name, code: b.code }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        live: true,
      }
    }
  } catch {
    /* fall through to offline list */
  }
  return { banks: NGN_BANKS_FALLBACK, live: false }
}

// ---------- account resolution (payout form "verify" button) ----------

export async function resolveBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ accountName: string | null; live: boolean }> {
  if (!PAYSTACK_ENABLED) return { accountName: null, live: false }
  try {
    const data = await call<{ account_name: string }>(
      'GET',
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
    )
    if (data.status && data.data?.account_name) {
      return { accountName: data.data.account_name, live: true }
    }
  } catch {
    /* invalid account / network — caller handles null */
  }
  return { accountName: null, live: false }
}

// ---------- transfer recipients + transfers (payout execution) ----------

export async function createTransferRecipient(input: {
  name: string
  accountNumber: string
  bankCode: string
}): Promise<string | null> {
  if (!PAYSTACK_ENABLED) return null
  try {
    const data = await call<{ recipient_code: string }>('POST', '/transferrecipient', {
      type: 'nuban',
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: 'NGN',
    })
    if (data.status && data.data?.recipient_code) return data.data.recipient_code
  } catch {
    /* caller falls back to pending */
  }
  return null
}

export async function initTransfer(input: {
  amountNaira: number
  recipient: string
  reference: string
  reason?: string
}): Promise<{ ok: boolean; message?: string }> {
  if (!PAYSTACK_ENABLED) return { ok: false, message: 'Paystack not configured' }
  try {
    const data = await call<{ transfer_code: string; status: string }>('POST', '/transfer', {
      source: 'balance',
      amount: Math.round(input.amountNaira * 100), // kobo
      recipient: input.recipient,
      reference: input.reference,
      reason: input.reason ?? 'ACE coin payout',
      currency: 'NGN',
    })
    if (data.status) return { ok: true }
    return { ok: false, message: data.message }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'transfer failed' }
  }
}

// ---------- transaction verification (PRO checkout) ----------

export interface VerifiedTransaction {
  success: boolean
  amountKobo?: number
  currency?: string
}

export async function verifyTransaction(
  reference: string
): Promise<VerifiedTransaction> {
  if (!PAYSTACK_ENABLED) return { success: false }
  try {
    const data = await call<{ status: string; amount: number; currency: string }>(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`
    )
    if (data.status && data.data?.status === 'success') {
      return {
        success: true,
        amountKobo: data.data.amount,
        currency: data.data.currency,
      }
    }
  } catch {
    /* not successful yet */
  }
  return { success: false }
}

// ---------- webhook signature ----------

/** Paystack signs webhook bodies with HMAC-SHA512 of the raw body using the secret key. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!PAYSTACK_ENABLED || !signature) return false
  const expected = crypto.createHmac('sha512', SECRET_KEY).update(rawBody).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ---------- PRO activation (shared by verify route + webhook) ----------

const PLAN_DAYS: Record<string, number | undefined> = {
  monthly: 30,
  yearly: 365,
  lifetime: undefined,
}

/**
 * Mark a Payment as paid and switch the buyer onto PRO.
 * Idempotent: an already-successful reference is a no-op.
 */
export async function activateProFromPayment(
  reference: string
): Promise<{ ok: boolean; already?: boolean; plan?: string; userId?: number }> {
  const payment = await db.payment.findUnique({ where: { reference } })
  if (!payment) return { ok: false }
  if (payment.status === 'success') {
    return { ok: true, already: true, plan: payment.plan, userId: payment.userId }
  }

  const days = PLAN_DAYS[payment.plan]
  const proUntil = days ? new Date(Date.now() + days * 86_400_000) : null

  await db.$transaction([
    db.payment.update({
      where: { reference },
      data: { status: 'success', paidAt: new Date() },
    }),
    db.user.update({
      where: { id: payment.userId },
      data: { isPro: true, proPlan: payment.plan, proUntil },
    }),
    db.notification.create({
      data: {
        userId: payment.userId,
        type: 'system',
        text: `Welcome to ACE PRO ♦ — ${payment.plan} plan activated. The crown is on.`,
        link: null,
      },
    }),
  ])

  return { ok: true, plan: payment.plan, userId: payment.userId }
}

// ---------- demo-mode transfer finalizer ----------

/**
 * In demo mode simulated bank transfers settle themselves: any
 * 'processing' withdrawal carrying a TRF_demo_ reference that is older
 * than 8 seconds is flipped to 'paid' the next time the user loads their
 * history (mirrors what the Paystack transfer.success webhook does live).
 */
export async function finalizeDemoTransfers(userId: number): Promise<void> {
  if (PAYSTACK_ENABLED) return
  const cutoff = new Date(Date.now() - 8_000)
  await db.withdrawal.updateMany({
    where: {
      userId,
      status: 'processing',
      transferRef: { startsWith: 'TRF_demo_' },
      createdAt: { lt: cutoff },
    },
    data: { status: 'paid', processedAt: new Date() },
  })
}

export function randomRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`
}
