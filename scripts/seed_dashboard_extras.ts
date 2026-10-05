// One-off demo data for the new Dashboard + Settings features.
// Idempotent: only inserts if missing. Does NOT wipe existing data.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // 1. Give 'nova' a recent name change so the 60-day lock UI is visible
  const nova = await db.user.findUnique({ where: { username: 'nova' } })
  if (nova && !nova.nameChangedAt) {
    await db.user.update({
      where: { id: nova.id },
      data: { nameChangedAt: new Date(Date.now() - 10 * 86_400_000) }, // 10 days ago -> 50 days locked
    })
    console.log('nova: nameChangedAt set (10 days ago)')
  }

  // 2. Withdrawal history for demo user (paid + rejected) so the table & pie have data
  const demo = await db.user.findUnique({ where: { username: 'demo' } })
  if (demo) {
    const count = await db.withdrawal.count({ where: { userId: demo.id } })
    if (count === 0) {
      await db.withdrawal.createMany({
        data: [
          {
            userId: demo.id,
            amountCoins: 1000,
            method: 'bank',
            destination: 'bank • Demo Player • ACME-00012345',
            status: 'paid',
            processedAt: new Date(Date.now() - 6 * 86_400_000),
            createdAt: new Date(Date.now() - 7 * 86_400_000),
          },
          {
            userId: demo.id,
            amountCoins: 200,
            method: 'paypal',
            destination: 'paypal • Demo Player • demo@ace.local',
            status: 'rejected',
            note: 'Below minimum amount',
            createdAt: new Date(Date.now() - 3 * 86_400_000),
          },
        ],
      })
      console.log('demo: 2 historical withdrawals created')
    }
  }

  console.log('done')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
