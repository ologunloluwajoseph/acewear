import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  try {
    const posts = await db.post.findMany({
      where: {
        status: 'active',
        body: { contains: 'demo' },
        user: { isBanned: false },
      },
      select: {
        id: true,
        body: true,
        likesCount: true,
        commentsCount: true,
        createdAt: true,
        user: { select: { id: true, username: true, isPro: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })
    console.log('A-ok:', posts.length)
  } catch (e) {
    console.log('A failed:', (e as Error).message.slice(0, 400))
  }

  try {
    const posts = await db.post.findMany({
      where: {
        status: 'active',
        body: { contains: 'demo' },
        user: { is: { isBanned: false } },
      },
      select: {
        id: true,
        user: { select: { id: true, username: true } },
      },
      take: 3,
    })
    console.log('B-ok:', posts.length)
  } catch (e) {
    console.log('B failed:', (e as Error).message.slice(0, 400))
  }

  try {
    const users = await db.user.findMany({
      where: {
        AND: [{ isBanned: false }, { OR: [{ username: { contains: 'demo' } }] }],
      },
      select: { id: true, username: true, isPro: true },
      take: 3,
    })
    console.log('C-ok:', users.length, users)
  } catch (e) {
    console.log('C failed:', (e as Error).message.slice(0, 400))
  }
}

main().finally(() => db.$disconnect())
