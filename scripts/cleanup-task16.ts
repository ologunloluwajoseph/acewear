/**
 * Task 16 cleanup — remove E2E test artifacts:
 *  - delete the checkout_test user (cascades its Payment row)
 *  - revert lucky_echo to non-PRO (it was upgraded during the sandbox
 *    checkout E2E test)
 * Run: bun scripts/cleanup-task16.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  await db.user.deleteMany({ where: { username: 'checkout_test' } })
  console.log('✓ removed checkout_test')

  await db.user.update({
    where: { username: 'lucky_echo' },
    data: { isPro: false, proPlan: null, proUntil: null },
  })
  console.log('✓ lucky_echo reverted to standard member (trial expired)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
