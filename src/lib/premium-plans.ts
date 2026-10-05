// =====================================================================
// ACE PRO plans — shared between the premium page (client) and the
// Paystack routes (server). Prices are in Nigerian Naira because the
// checkout runs on Paystack Nigeria (amounts are sent to Paystack in
// kobo = naira * 100).
// =====================================================================

export type ProPlanId = 'monthly' | 'yearly' | 'lifetime'

export interface ProPlan {
  id: ProPlanId
  name: string
  /** Charge amount in whole naira (converted to kobo for Paystack). */
  priceNaira: number
  per: string
  note: string
  best?: boolean
  /** Length of the paid period in days (null/undefined = forever). */
  days?: number
}

export const PRO_PLANS: ProPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    priceNaira: 2500,
    per: '/ month',
    note: 'Cancel anytime',
    days: 30,
  },
  {
    id: 'yearly',
    name: 'Yearly',
    priceNaira: 20000,
    per: '/ year',
    note: 'Save 33% — 2 months free',
    best: true,
    days: 365,
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    priceNaira: 45000,
    per: 'once',
    note: 'Pay once, crown forever',
  },
]

export function findPlan(id: string): ProPlan | undefined {
  return PRO_PLANS.find((p) => p.id === id)
}

export function formatNaira(naira: number): string {
  return `₦${naira.toLocaleString('en-NG')}`
}

/** Coin → cash rate used by the payout system: 1 coin = ₦1. */
export const COINS_TO_NAIRA = 1
