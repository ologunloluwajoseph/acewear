/**
 * ACE — Database seed (Node.js edition)
 * Creates demo users, posts, stories, contests, shop items,
 * orders (for gated reviews), notifications and conversations.
 * Media is generated locally with sharp (SVG -> WebP), no externals.
 *
 * Run: bun scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

const db = new PrismaClient()

// ---- scrypt hashing (same scheme as src/lib/auth.ts) ----
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString('hex')
  return `scrypt$${salt}$${hash}`
}

// ---- SVG -> WebP generator ----
async function genWebp(
  dir: 'avatars' | 'covers' | 'posts' | 'stories' | 'contests' | 'products',
  svg: string,
  quality = 82
): Promise<string> {
  const out = await sharp(Buffer.from(svg)).webp({ quality }).toBuffer()
  const target = path.join(process.cwd(), 'public', 'uploads', dir)
  fs.mkdirSync(target, { recursive: true })
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webp`
  fs.writeFileSync(path.join(target, name), out)
  return `/uploads/${dir}/${name}`
}

function avatarSvg(initials: string, from: string, to: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial" font-weight="700" font-size="180"
      fill="rgba(255,255,255,0.95)">${initials}</text></svg>`
}

function coverSvg(from: string, to: string): string {
  const id = `c${crypto.randomBytes(3).toString('hex')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    <circle cx="1250" cy="120" r="220" fill="rgba(255,255,255,0.08)"/>
    <circle cx="300" cy="430" r="180" fill="rgba(255,255,255,0.06)"/>
    <text x="75" y="270" font-family="Arial" font-weight="800" font-size="96"
      fill="rgba(255,255,255,0.9)">ACE</text>
    <text x="75" y="330" font-family="Arial" font-size="34"
      fill="rgba(255,255,255,0.75)">Where every face is a wild card.</text></svg>`
}

function postSvg(title: string, from: string, to: string): string {
  const id = `p${crypto.randomBytes(3).toString('hex')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    <circle cx="840" cy="240" r="260" fill="rgba(255,255,255,0.10)"/>
    <circle cx="220" cy="880" r="200" fill="rgba(0,0,0,0.10)"/>
    <text x="60" y="920" font-family="Arial" font-weight="800" font-size="72"
      fill="rgba(255,255,255,0.92)">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
    <text x="60" y="990" font-family="Arial" font-size="38" fill="rgba(255,255,255,0.75)">ACE community</text></svg>`
}

function storySvg(word: string, from: string, to: string): string {
  const id = `s${crypto.randomBytes(3).toString('hex')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    <text x="50%" y="48%" text-anchor="middle" font-family="Arial" font-weight="800"
      font-size="120" fill="rgba(255,255,255,0.95)">${word}</text>
    <text x="50%" y="56%" text-anchor="middle" font-family="Arial" font-size="48"
      fill="rgba(255,255,255,0.8)">24h story · ACE</text></svg>`
}

function productSvg(name: string, emoji: string, from: string, to: string): string {
  const id = `pr${crypto.randomBytes(3).toString('hex')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    <text x="50%" y="46%" text-anchor="middle" font-size="280">${emoji}</text>
    <text x="50%" y="72%" text-anchor="middle" font-family="Arial" font-weight="700"
      font-size="52" fill="rgba(255,255,255,0.95)">${name}</text></svg>`
}

function contestSvg(title: string, from: string, to: string): string {
  const id = `ct${crypto.randomBytes(3).toString('hex')}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    <text x="60" y="330" font-family="Arial" font-weight="800" font-size="84"
      fill="rgba(255,255,255,0.95)">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
    <text x="60" y="400" font-family="Arial" font-size="40" fill="rgba(255,255,255,0.8)">ACE Contest</text>
    <text x="1010" y="180" text-anchor="middle" font-size="150">🏆</text></svg>`
}

const G = [
  ['#f0b429', '#d946ef'],
  ['#10b981', '#0ea5e9'],
  ['#f43f5e', '#f0b429'],
  ['#8b5cf6', '#f43f5e'],
  ['#14b8a6', '#f0b429'],
  ['#ec4899', '#8b5cf6'],
  ['#f97316', '#facc15'],
  ['#06b6d4', '#10b981'],
]

async function main() {
  console.log('🌱 Seeding ACE (Node.js edition)...')

  // wipe in FK-safe order
  await db.notification.deleteMany()
  await db.message.deleteMany()
  await db.conversation.deleteMany()
  await db.contestVote.deleteMany()
  await db.contestEntry.deleteMany()
  await db.vote.deleteMany()
  await db.like.deleteMany()
  await db.comment.deleteMany()
  await db.post.deleteMany()
  await db.storyView.deleteMany()
  await db.story.deleteMany()
  await db.review.deleteMany()
  await db.order.deleteMany()
  await db.product.deleteMany()
  await db.follow.deleteMany()
  await db.contest.deleteMany()
  await db.user.deleteMany()

  // ---------- users ----------
  const pw = hashPassword('password123')
  const adminPw = hashPassword('admin123')

  const userDefs: {
    username: string; email: string; firstName: string; bio: string; coins: number; g: number
    isAdmin?: boolean; isVerified?: boolean; isPro?: boolean; proPlan?: string; ageHours?: number
  }[] = [
    { username: 'admin', email: 'admin@ace.local', firstName: 'ACE Admin', isAdmin: true, isVerified: true, bio: 'The house always wins. Welcome to ACE.', coins: 100000, g: 0 },
    // demo = the "try everything" account: permanent PRO (lifetime plan) + a
    // healthy coin balance so every feature — premium, shop perks, payouts —
    // can be exercised end-to-end without hitting a lock.
    { username: 'demo', email: 'demo@ace.local', firstName: 'Demo', isVerified: true, isPro: true, proPlan: 'lifetime', bio: 'Just here for the vibes and the contests 🃏', coins: 25000, g: 1, ageHours: 5 },
    { username: 'lucky_echo', email: 'echo@ace.local', firstName: 'Echo', bio: 'Fortune favors the bold. Professional optimistic.', coins: 640, g: 2 },
    { username: 'nova_queen', email: 'nova@ace.local', firstName: 'Nova', isVerified: true, isPro: true, bio: 'Contest addict. 3x champion 👑', coins: 890, g: 3 },
    { username: 'ace_high', email: 'high@ace.local', firstName: 'High', bio: 'Living life one bet at a time.', coins: 420, g: 4 },
    { username: 'ruby_dawn', email: 'ruby@ace.local', firstName: 'Ruby', bio: 'Artist, dreamer, story teller.', coins: 510, g: 5 },
    { username: 'max_bluff', email: 'max@ace.local', firstName: 'Max', bio: 'Never fold on your dreams.', coins: 335, g: 6 },
    { username: 'iris_wild', email: 'iris@ace.local', firstName: 'Iris', bio: 'Wild card energy only.', coins: 700, g: 7 },
  ]

  const users: Record<string, { id: number; username: string; firstName: string | null }> = {}
  for (const [i, u] of userDefs.entries()) {
    const [from, to] = G[u.g]
    const initials = (u.firstName ?? u.username)
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    const avatar = await genWebp('avatars', avatarSvg(initials, from, to))
    const cover = await genWebp('covers', coverSvg(to, from))
    const user = await db.user.create({
      data: {
        username: u.username,
        email: u.email,
        passwordHash: u.isAdmin ? adminPw : pw,
        firstName: u.firstName,
        bio: u.bio,
        avatarUrl: avatar,
        coverUrl: cover,
        isAdmin: u.isAdmin ?? false,
        isVerified: u.isVerified ?? false,
        isPro: u.isPro ?? false,
        proPlan: u.proPlan ?? null,
        aceCoins: u.coins,
        trustScore: 100 + i,
        // ageHours backdates the account so the 3-day premium trial on the
        // demo login is visibly mid-countdown (5h in => ~2d 19h left)
        ...(u.ageHours ? { createdAt: new Date(Date.now() - u.ageHours * 3_600_000) } : {}),
      },
    })
    users[u.username] = { id: user.id, username: user.username, firstName: user.firstName }
  }
  console.log(`  ✓ ${Object.keys(users).length} users`)

  // ---------- follows ----------
  const names = Object.keys(users)
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < names.length; j++) {
      if (i !== j && (i + j) % 2 === 0) {
        await db.follow.create({
          data: { followerId: users[names[i]].id, followingId: users[names[j]].id },
        })
      }
    }
  }
  // everyone follows demo
  for (const n of names) {
    if (n !== 'demo') {
      await db.follow
        .create({ data: { followerId: users[n].id, followingId: users.demo.id } })
        .catch(() => null)
    }
  }

  // ---------- posts ----------
  const postDefs = [
    { by: 'demo', text: 'First hand dealt on ACE after the Node.js upgrade — this place feels 10x faster. Who else is in? ♠️', title: 'ACE IS LIVE', g: 0 },
    { by: 'nova_queen', text: 'Defending my crown this week 👑 Enter my contest and try to take it.', title: 'QUEEN OF HEARTS', g: 3 },
    { by: 'lucky_echo', text: 'Sunset, strategy and a good hand. What more do you need?', title: 'GOLDEN HOUR', g: 1 },
    { by: 'ruby_dawn', text: 'New artwork dropping for the art contest — painted this in one sitting.', title: 'WILD ART', g: 5 },
    { by: 'max_bluff', text: 'Bluffed my way into the finals. See you at the voting stage 😎', title: 'ALL IN', g: 2 },
    { by: 'iris_wild', text: 'Story game is strong today. Check my story before it expires in 24h!', title: 'WILD CARD', g: 7 },
    { by: 'ace_high', text: 'Pro tip: upload photos and ACE converts them to WebP automatically. My feed loads instantly now.', title: 'SPEED RUN', g: 6 },
    { by: 'demo', text: 'PSA: reviews in the shop are now gated to verified purchases. No more fake hype — only real ones. ✅', title: 'REAL ONES', g: 4 },
  ]
  const posts: Record<number, number> = {}
  for (const p of postDefs) {
    const [from, to] = G[p.g]
    const image = await genWebp('posts', postSvg(p.title, from, to))
    const post = await db.post.create({
      data: {
        userId: users[p.by].id,
        body: p.text,
        mediaUrl: image,
        mediaType: 'image',
        likesCount: 0,
      },
    })
    posts[post.id] = post.id

    // likes + comments
    for (const n of names) {
      if (n !== p.by && Math.random() > 0.4) {
        await db.like.create({ data: { postId: post.id, userId: users[n].id } })
      }
    }
    const likeCount = await db.like.count({ where: { postId: post.id } })
    await db.post.update({ where: { id: post.id }, data: { likesCount: likeCount } })

    const commenters = names.filter((n) => n !== p.by).slice(0, 2 + Math.floor(Math.random() * 2))
    for (const c of commenters) {
      await db.comment.create({
        data: {
          postId: post.id,
          userId: users[c].id,
          body: [
            'This is fire 🔥',
            'Count me in!',
            'Big facts.',
            'Let’s gooo 🃏',
            'Underrated post tbh.',
          ][Math.floor(Math.random() * 5)],
        },
      })
    }
    const commentCount = await db.comment.count({ where: { postId: post.id } })
    await db.post.update({ where: { id: post.id }, data: { commentsCount: commentCount } })
  }
  console.log(`  ✓ ${Object.keys(posts).length} posts`)

  // ---------- stories (24h) ----------
  const storyDefs = [
    { by: 'demo', word: 'DEAL ME IN', g: 1 },
    { by: 'nova_queen', word: 'STILL CHAMPION', g: 3 },
    { by: 'ruby_dawn', word: 'NEW ART', g: 5 },
    { by: 'iris_wild', word: 'WILD MODE', g: 7 },
  ]
  for (const s of storyDefs) {
    const [from, to] = G[s.g]
    const image = await genWebp('stories', storySvg(s.word, from, to))
    await db.story.create({
      data: {
        userId: users[s.by].id,
        mediaUrl: image,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    })
  }
  console.log('  ✓ stories')

  // ---------- contests ----------
  const now = Date.now()
  const contest1 = await db.contest.create({
    data: {
      title: 'Golden Face of the Week',
      slug: `golden-face-${now.toString(36)}`,
      description: 'Post your best look, gather votes, take the crown. Community voting decides everything — no jury, no mercy.',
      prize: '5,000 ACE coins + Verified badge',
      category: 'beauty',
      coverUrl: await genWebp('contests', contestSvg('GOLDEN FACE OF THE WEEK', '#f0b429', '#f43f5e')),
      startsAt: new Date(now - 24 * 3600 * 1000),
      endsAt: new Date(now + 3 * 24 * 3600 * 1000),
      votingEndsAt: new Date(now + 4 * 24 * 3600 * 1000),
      status: 'active',
      tier: 'weekly',
      createdById: users.admin.id,
    },
  })
  const contest2 = await db.contest.create({
    data: {
      title: 'Wild Art Throwdown',
      slug: `wild-art-${now.toString(36)}`,
      description: 'One canvas. One week. Absolute creative freedom. Winner gets featured on the ACE landing page.',
      prize: 'Featured artist slot + 2,500 coins',
      category: 'art',
      coverUrl: await genWebp('contests', contestSvg('WILD ART THROWDOWN', '#8b5cf6', '#ec4899')),
      startsAt: new Date(now - 3 * 3600 * 1000),
      endsAt: new Date(now + 5 * 24 * 3600 * 1000),
      votingEndsAt: new Date(now + 6 * 24 * 3600 * 1000),
      status: 'active',
      tier: 'monthly',
      createdById: users.admin.id,
    },
  })
  await db.contest.create({
    data: {
      title: 'Dance Royale',
      slug: `dance-royale-${now.toString(36)}`,
      description: '30 seconds. One track. Bring the house down.',
      prize: '3,000 ACE coins',
      category: 'dance',
      coverUrl: await genWebp('contests', contestSvg('DANCE ROYALE', '#10b981', '#06b6d4')),
      startsAt: new Date(now + 7 * 24 * 3600 * 1000),
      endsAt: new Date(now + 12 * 24 * 3600 * 1000),
      votingEndsAt: new Date(now + 13 * 24 * 3600 * 1000),
      status: 'upcoming',
      tier: 'special',
      createdById: users.admin.id,
    },
  })

  // entries for contest 1
  const entryDefs = [
    { by: 'nova_queen', cap: 'Champion energy. Vote if you dare 👑', g: 3 },
    { by: 'ruby_dawn', cap: 'Golden hour, golden face.', g: 5 },
    { by: 'ace_high', cap: 'Suit up, show up.', g: 4 },
  ]
  const entryIds: number[] = []
  for (const e of entryDefs) {
    const [from, to] = G[e.g]
    const entry = await db.contestEntry.create({
      data: {
        contestId: contest1.id,
        userId: users[e.by].id,
        caption: e.cap,
        imageUrl: await genWebp('contests', contestSvg(e.cap.slice(0, 18), from, to)),
      },
    })
    entryIds.push(entry.id)
  }
  // votes
  const votePlan: [number, string[]][] = [
    [entryIds[0], ['demo', 'lucky_echo', 'max_bluff']],
    [entryIds[1], ['iris_wild']],
    [entryIds[2], ['demo', 'iris_wild']],
  ]
  for (const [entryId, voters] of votePlan) {
    for (const v of voters) {
      await db.contestVote
        .create({ data: { entryId, userId: users[v].id } })
        .catch(() => null)
    }
    const count = await db.contestVote.count({ where: { entryId } })
    await db.contestEntry.update({ where: { id: entryId }, data: { votesCount: count } })
  }
  // one entry for demo in contest 2 (so demo can be voted)
  await db.contestEntry.create({
    data: {
      contestId: contest2.id,
      userId: users.demo.id,
      caption: 'Neon dreams and card suit schemes.',
      imageUrl: await genWebp('contests', contestSvg('NEON DREAMS', '#ec4899', '#8b5cf6')),
    },
  })
  console.log('  ✓ contests + entries + votes')

  // ---------- shop ----------
  const productDefs = [
    { name: 'Verified Badge', desc: 'Stand out with the blue-ribbon verified checkmark on your profile and every post.', price: 500, cat: 'badge', emoji: '✅', g: 1, stock: -1 },
    { name: 'Boost Pack x3', desc: 'Push three of your posts to the top of your followers’ feeds at golden hour.', price: 250, cat: 'boost', emoji: '🚀', g: 6, stock: -1 },
    { name: 'Coin Vault 1000', desc: 'A vault of 1,000 ACE coins to spend on boosts, badges and contest entries.', price: 300, cat: 'coins', emoji: '💰', g: 0, stock: -1 },
    { name: 'Wild Card Frame', desc: 'Exclusive animated profile frame showing everyone you play by your own rules.', price: 400, cat: 'cosmetic', emoji: '🃏', g: 5, stock: 50 },
    { name: 'Royal Crown Frame', desc: 'For champions only — the crown frame. Awarded prestige, bought glory.', price: 750, cat: 'cosmetic', emoji: '👑', g: 3, stock: 25 },
    { name: 'Streak Shield', desc: 'Protect your daily login streak once per month. Never lose the count again.', price: 150, cat: 'boost', emoji: '🛡️', g: 2, stock: -1 },
  ]
  const productIds: number[] = []
  for (const p of productDefs) {
    const [from, to] = G[p.g]
    const product = await db.product.create({
      data: {
        name: p.name,
        description: p.desc,
        priceCoins: p.price,
        category: p.cat,
        stock: p.stock,
        image: await genWebp('products', productSvg(p.name, p.emoji, from, to)),
      },
    })
    productIds.push(product.id)
  }

  // orders: demo bought badge + boost => can review those two products
  await db.order.create({
    data: { userId: users.demo.id, productId: productIds[0], priceCoins: 500, status: 'completed' },
  })
  await db.order.create({
    data: { userId: users.demo.id, productId: productIds[1], priceCoins: 250, status: 'completed' },
  })
  await db.order.create({
    data: { userId: users.nova_queen.id, productId: productIds[0], priceCoins: 500, status: 'completed' },
  })
  // demo's existing review (verified purchase)
  await db.review.create({
    data: {
      productId: productIds[1],
      userId: users.demo.id,
      rating: 5,
      body: 'Boosted three posts and my contest entry blew up overnight. Worth every coin.',
      verified: true,
    },
  })
  await db.review.create({
    data: {
      productId: productIds[0],
      userId: users.nova_queen.id,
      rating: 4,
      body: 'Badge looks clean. Would love more color options though.',
      verified: true,
    },
  })
  console.log('  ✓ shop + orders + gated reviews')

  // ---------- conversations & messages ----------
  const dm = await db.conversation.create({
    data: { user1Id: users.demo.id, user2Id: users.nova_queen.id },
  })
  await db.message.createMany({
    data: [
      { conversationId: dm.id, senderId: users.nova_queen.id, body: 'Hey! Saw you joined Wild Art Throwdown 👀', isRead: true },
      { conversationId: dm.id, senderId: users.demo.id, body: 'Of course. Someone has to take your crown 👑', isRead: true },
      { conversationId: dm.id, senderId: users.nova_queen.id, body: 'Big talk! May the best artist win 🃏' },
    ],
  })
  const dm2 = await db.conversation.create({
    data: { user1Id: users.demo.id, user2Id: users.ruby_dawn.id },
  })
  await db.message.createMany({
    data: [
      { conversationId: dm2.id, senderId: users.ruby_dawn.id, body: 'Your neon entry is stunning! What palette did you use?' },
    ],
  })
  console.log('  ✓ conversations + messages')

  // ---------- notifications for demo ----------
  await db.notification.createMany({
    data: [
      { userId: users.demo.id, actorId: users.nova_queen.id, type: 'vote', text: 'Nova voted for your entry in "Wild Art Throwdown"', targetType: 'contest', targetId: contest2.id },
      { userId: users.demo.id, actorId: users.ruby_dawn.id, type: 'like', text: 'Ruby liked your post', targetType: 'post', targetId: Object.keys(posts)[0] ? Number(Object.keys(posts)[0]) : 1 },
      { userId: users.demo.id, actorId: users.iris_wild.id, type: 'follow', text: 'Iris started following you', targetType: 'user', targetId: users.iris_wild.id },
      { userId: users.demo.id, type: 'system', text: 'Welcome to ACE — the Node.js edition. Everything is faster now ⚡', isRead: true },
    ],
  })
  console.log('  ✓ notifications')
  console.log('🌱 Seed complete. Logins: demo/password123 (full PRO) · admin/admin123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
