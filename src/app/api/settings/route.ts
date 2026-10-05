import { NextRequest, NextResponse } from 'next/server'
import { handle, ok, fail, readJson, sanitizeText } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { finalizeDemoTransfers } from '@/lib/paystack'
import {
  createSessionToken,
  rateLimit,
  setSessionCookie,
  verifyPassword,
  hashPassword,
} from '@/lib/auth'

export const runtime = 'nodejs'

const NAME_CHANGE_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000 // 60 days

// GET /api/settings — everything the settings view needs in one call
export const GET = (req: NextRequest) =>
  handle(req, async (user) => {
    // demo-mode simulated bank transfers settle on read (mirrors the live
    // Paystack transfer.success webhook)
    await finalizeDemoTransfers(user.id)
    const [withdrawals, fresh] = await Promise.all([
      db.withdrawal.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.user.findUnique({
        where: { id: user.id },
        select: {
          email: true,
          firstName: true,
          nameChangedAt: true,
          privateProfile: true,
          showOnlineStatus: true,
          messagesFromAnyone: true,
          showReadReceipts: true,
          searchableByEmail: true,
          payoutMethod: true,
          payoutAccountName: true,
          payoutDetails: true,
          payoutUpdatedAt: true,
          payoutBankCode: true,
          payoutBankName: true,
          createdAt: true,
        },
      }),
    ])
    return ok({ settings: { ...user, ...fresh }, withdrawals })
  })

// PUT /api/settings — action-dispatcher: { action: 'password' | 'name' | 'privacy' | 'payout', ...payload }
export const PUT = (req: NextRequest) =>
  handle(req, async (user) => {
    const body = await readJson<{
      action?: string
      currentPassword?: string
      newPassword?: string
      firstName?: string
      privacy?: Record<string, boolean>
      payout?: {
        method?: string
        accountName?: string
        details?: string
        bankCode?: string
        bankName?: string
      }
    }>(req)

    // ---------- change password ----------
    if (body.action === 'password') {
      if (!rateLimit(`pw:${user.id}`, 5, 60_000)) {
        return fail('Too many attempts — try again in a minute', 429)
      }
      const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
      const next = typeof body.newPassword === 'string' ? body.newPassword : ''
      if (!current || !next) return fail('Current and new password are required')
      if (next.length < 8) return fail('New password must be at least 8 characters')
      if (next === current) return fail('New password must be different from the current one')

      const row = await db.user.findUnique({ where: { id: user.id } })
      if (!row || !verifyPassword(current, row.passwordHash)) {
        return fail('Current password is incorrect', 403)
      }

      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(next),
          tokenVersion: { increment: 1 }, // kill every existing session
        },
      })
      const token = createSessionToken(updated.id, updated.tokenVersion)
      const response = NextResponse.json({ ok: true, token })
      setSessionCookie(response, token)
      return response
    }

    // ---------- change display name (60-day cooldown) ----------
    if (body.action === 'name') {
      const firstName = sanitizeText(body.firstName, 60)
      if (!firstName) return fail('Name cannot be empty')

      const row = await db.user.findUnique({
        where: { id: user.id },
        select: { nameChangedAt: true },
      })
      const last = row?.nameChangedAt
      if (last) {
        const nextAllowed = new Date(last.getTime() + NAME_CHANGE_COOLDOWN_MS)
        if (nextAllowed > new Date()) {
          const days = Math.ceil((nextAllowed.getTime() - Date.now()) / 86_400_000)
          return fail(`You can change your name again in ${days} day${days === 1 ? '' : 's'}`, 429, {
            nextAllowedAt: nextAllowed.toISOString(),
          })
        }
      }
      await db.user.update({
        where: { id: user.id },
        data: { firstName, nameChangedAt: new Date() },
      })
      return ok({
        firstName,
        nameChangedAt: new Date().toISOString(),
        nextAllowedAt: new Date(Date.now() + NAME_CHANGE_COOLDOWN_MS).toISOString(),
      })
    }

    // ---------- privacy toggles ----------
    if (body.action === 'privacy') {
      const p = body.privacy ?? {}
      const data = {
        ...(typeof p.privateProfile === 'boolean' ? { privateProfile: p.privateProfile } : {}),
        ...(typeof p.showOnlineStatus === 'boolean' ? { showOnlineStatus: p.showOnlineStatus } : {}),
        ...(typeof p.messagesFromAnyone === 'boolean' ? { messagesFromAnyone: p.messagesFromAnyone } : {}),
        ...(typeof p.showReadReceipts === 'boolean' ? { showReadReceipts: p.showReadReceipts } : {}),
        ...(typeof p.searchableByEmail === 'boolean' ? { searchableByEmail: p.searchableByEmail } : {}),
      }
      if (!Object.keys(data).length) return fail('No privacy settings provided')
      const updated = await db.user.update({ where: { id: user.id }, data })
      return ok({
        privacy: {
          privateProfile: updated.privateProfile,
          showOnlineStatus: updated.showOnlineStatus,
          messagesFromAnyone: updated.messagesFromAnyone,
          showReadReceipts: updated.showReadReceipts,
          searchableByEmail: updated.searchableByEmail,
        },
      })
    }

    // ---------- payout account details ----------
    if (body.action === 'payout') {
      const p = body.payout ?? {}
      const method = sanitizeText(p.method, 30)
      const accountName = sanitizeText(p.accountName, 120)
      const details = sanitizeText(p.details, 190)
      if (!['bank', 'paypal', 'crypto', 'mobile_money'].includes(method)) {
        return fail('Choose a valid payout method')
      }
      if (!accountName || !details || details.length < 4) {
        return fail('Account name and account details are required')
      }
      const bankCode = sanitizeText(p.bankCode, 20)
      const bankName = sanitizeText(p.bankName, 80)
      await db.user.update({
        where: { id: user.id },
        data: {
          payoutMethod: method,
          payoutAccountName: accountName,
          payoutDetails: details,
          payoutUpdatedAt: new Date(),
          // Paystack transfer recipient is bound to one bank account —
          // when the destination changes it must be re-created.
          payoutBankCode: method === 'bank' ? bankCode || null : null,
          payoutBankName: method === 'bank' ? bankName || null : null,
          paystackRecipientCode: null,
        },
      })
      return ok({ payout: { method, accountName, details, savedAt: new Date().toISOString() } })
    }

    return fail('Unknown settings action')
  })
