/**
 * Task 16 — promote the demo account to a full premium experience.
 * (Idempotent; safe to run any time against the live DB.)
 *
 * Run: bun scripts/promote-demo.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const demo = await db.user.findUnique({ where: { username: 'demo' } })
  if (!demo) {
    console.error('demo user not found — run scripts/seed.ts first')
    process.exit(1)
  }
  const updated = await db.user.update({
    where: { username: 'demo' },
    data: {
      isPro: true,
      proPlan: 'lifetime',
      proUntil: null, // null = never expires
      aceCoins: Math.max(demo.aceCoins, 25000),
      isVerified: true,
    },
    select: { username: true, isPro: true, proPlan: true, proUntil: true, aceCoins: true },
  })
  console.log('✓ demo account promoted:', updated)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
