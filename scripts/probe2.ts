import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  try {
    const r = await db.post.findMany({
      where: { status: 'active' },
      select: { id: true, user: { id: true, username: true } },
      take: 2,
    })
    console.log('shorthand-ok:', r.length)
  } catch (e) {
    console.log('shorthand-failed:', (e as Error).message.slice(0, 160))
  }
}
main().finally(() => db.$disconnect())
