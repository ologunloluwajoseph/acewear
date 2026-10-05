/**
 * ACE — Reels seed
 * Generates vertical demo MP4s with ffmpeg (no external assets), poster WebPs
 * with sharp, and a spread of reels across demo users with likes + views.
 *
 * Run: bun scripts/seed_reels.ts
 */
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const db = new PrismaClient()

const REELS_DIR = path.join(process.cwd(), 'public', 'uploads', 'reels')
fs.mkdirSync(REELS_DIR, { recursive: true })

const REEL_PLAN_SIZE = 9

const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ---------------- ffmpeg video generation ----------------

interface VideoSpec {
  file: string
  c0: string
  c1: string
  c2: string
  line1: string
  line2: string
}

function genVideo(spec: VideoSpec): string {
  const out = path.join(REELS_DIR, spec.file)
  const vf = [
    `drawtext=fontfile=${FONT}:text='${spec.line1}':fontcolor=white@0.95:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2-60`,
    `drawtext=fontfile=${FONT}:text='${spec.line2}':fontcolor=0xf0b429:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2+40`,
    'fade=t=in:st=0:d=0.4',
    'fade=t=out:st=4.6:d=0.4',
  ].join(',')
  const cmd = [
    'ffmpeg -y -loglevel error',
    '-f lavfi -i "gradients=s=540x960:d=5:speed=0.07:nb_colors=3:' +
      `c0=${spec.c0}:c1=${spec.c1}:c2=${spec.c2}"`,
    `-vf "${vf}"`,
    '-c:v libx264 -preset veryfast -crf 27',
    '-pix_fmt yuv420p -movflags +faststart -r 24',
    `"${out}"`,
  ].join(' ')
  execSync(cmd, { stdio: 'pipe' })
  return `/uploads/reels/${spec.file}`
}

// ---------------- sharp poster / image-reel generation ----------------

async function genVerticalWebp(
  name: string,
  from: string,
  to: string,
  glyph: string,
  label: string,
  quality = 82
): Promise<string> {
  const id = `g${crypto.randomBytes(4).toString('hex')}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/>
        <stop offset="1" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    <circle cx="240" cy="420" r="180" fill="rgba(255,255,255,0.08)"/>
    <circle cx="860" cy="1500" r="260" fill="rgba(0,0,0,0.10)"/>
    <text x="50%" y="42%" text-anchor="middle" dominant-baseline="middle"
      font-family="DejaVu Sans, Arial, sans-serif" font-size="380"
      fill="rgba(255,255,255,0.9)">${glyph}</text>
    <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle"
      font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="72"
      fill="rgba(255,255,255,0.95)">${label}</text>
  </svg>`
  const out = await sharp(Buffer.from(svg)).webp({ quality }).toBuffer()
  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webp`
  fs.writeFileSync(path.join(REELS_DIR, fileName), out)
  return `/uploads/reels/${fileName}`
}

// ---------------- main ----------------

async function main() {
  const users = await db.user.findMany({
    select: { id: true, username: true },
  })
  const byName = new Map(users.map((u) => [u.username, u.id]))
  console.log('users:', [...byName.keys()].join(', '))

  const existing = await db.reel.count()
  if (existing >= REEL_PLAN_SIZE) {
    console.log(`Reels already seeded (${existing}) — skipping generation`)
    return
  }

  // 1) five ffmpeg videos (5s loops, 540x960)
  const videoSpecs: VideoSpec[] = [
    { file: 'seed-ace-blackjack.mp4', c0: '0x0f0f23', c1: '0xf0b429', c2: '0x1a1a2e', line1: 'ACE', line2: 'BLACKJACK ♠' },
    { file: 'seed-royal-flush.mp4',   c0: '0x2d1b36', c1: '0xd946ef', c2: '0x12081f', line1: '♥ ♦', line2: 'ROYAL FLUSH' },
    { file: 'seed-high-roller.mp4',   c0: '0x011c2e', c1: '0x0ea5e9', c2: '0x05263d', line1: 'HIGH', line2: 'ROLLER ♦' },
    { file: 'seed-chip-stack.mp4',    c0: '0x1c1917', c1: '0xf59e0b', c2: '0x292524', line1: 'CHIPS', line2: 'STACK UP ♣' },
    { file: 'seed-jackpot.mp4',       c0: '0x3b0764', c1: '0xf43f5e', c2: '0x1e1b4b', line1: 'JACKPOT', line2: '7 7 7 ♥' },
  ]
  const videoUrls = videoSpecs.map(genVideo)
  console.log('videos:', videoUrls.join(', '))

  // 2) posters for the videos (sharp, matching palettes)
  const posterSets = [
    ['#0f0f23', '#f0b429'], ['#2d1b36', '#d946ef'], ['#011c2e', '#0ea5e9'],
    ['#1c1917', '#f59e0b'], ['#3b0764', '#f43f5e'],
  ]
  const posters: string[] = []
  for (const [from, to] of posterSets) {
    const url = await genVerticalWebp('poster', from, to, '♠', 'ACE REELS')
    posters.push(url)
  }

  // 3) image-only reels
  const imageReels: { url: string; caption: string; sound: string; user: string }[] = []
  const imageSpecs = [
    { from: '#7c2d12', to: '#f59e0b', glyph: '♦', label: 'ALL IN', caption: 'Pushed my whole stack to the middle. No regrets. ♦', sound: 'Ace Beats — All In' },
    { from: '#14532d', to: '#22c55e', glyph: '♣', label: 'CLEAN HIT', caption: 'Dealt myself the cleanest hand of the night ♣', sound: 'Green Felt Loops' },
    { from: '#1e1b4b', to: '#8b5cf6', glyph: '♥', label: 'MIDNIGHT', caption: 'Midnight session at the velvet table ♥', sound: 'Velvet Lounge — Midnight' },
    { from: '#831843', to: '#f43f5e', glyph: '♠', label: 'WINNER', caption: 'When the spade hits just right ♠ #acewinner', sound: 'House of Cards — Remix' },
  ]
  for (const s of imageSpecs) {
    const url = await genVerticalWebp('imgreel', s.from, s.to, s.glyph, s.label)
    imageReels.push({ url, caption: s.caption, sound: s.sound, user: '' })
  }

  // 4) reel rows across users
  const reelPlan: {
    user: string; caption: string; sound: string;
    mediaUrl: string; mediaType: 'video' | 'image'; posterUrl: string | null;
  }[] = [
    { user: 'nova_queen', caption: 'Fresh felt, fresh luck — welcome to the reel floor ♠ #ACEreels', sound: 'House of Cards — Ace Beats', mediaUrl: videoUrls[0], mediaType: 'video', posterUrl: posters[0] },
    { user: 'ace_high', caption: 'When the ♦ running flush lands at 2AM', sound: 'Neon Nights — High Stakes', mediaUrl: videoUrls[1], mediaType: 'video', posterUrl: posters[1] },
    { user: 'iris_wild', caption: 'POV: you bet the whole vault on blue', sound: 'Ocean Casino — Drift', mediaUrl: videoUrls[2], mediaType: 'video', posterUrl: posters[2] },
    { user: 'max_bluff', caption: 'Chip stacks don\'t lie. Keep stacking ♣', sound: 'Clack Clack — Chip ASMR', mediaUrl: videoUrls[3], mediaType: 'video', posterUrl: posters[3] },
    { user: 'ruby_dawn', caption: '777 — the jackpot reel, as promised ♥', sound: 'Cherry Pop — Jackpot Mix', mediaUrl: videoUrls[4], mediaType: 'video', posterUrl: posters[4] },
    { user: 'demo', caption: imageReels[0].caption, sound: imageReels[0].sound, mediaUrl: imageReels[0].url, mediaType: 'image', posterUrl: null },
    { user: 'lucky_echo', caption: imageReels[1].caption, sound: imageReels[1].sound, mediaUrl: imageReels[1].url, mediaType: 'image', posterUrl: null },
    { user: 'nova_queen', caption: imageReels[2].caption, sound: imageReels[2].sound, mediaUrl: imageReels[2].url, mediaType: 'image', posterUrl: null },
    { user: 'ruby_dawn', caption: imageReels[3].caption, sound: imageReels[3].sound, mediaUrl: imageReels[3].url, mediaType: 'image', posterUrl: null },
  ]

  let created = 0
  for (const p of reelPlan) {
    const userId = byName.get(p.user)
    if (!userId) continue
    const reel = await db.reel.create({
      data: {
        userId,
        caption: p.caption,
        mediaUrl: p.mediaUrl,
        mediaType: p.mediaType,
        posterUrl: p.posterUrl,
        soundLabel: p.sound,
        viewsCount: rand(120, 8400),
        createdAt: new Date(Date.now() - created * 3600_000 * 7), // staggered history
      },
    })
    // random likes from other users
    const likers = users.filter((u) => u.id !== userId).sort(() => Math.random() - 0.5).slice(0, rand(1, 4))
    for (const l of likers) {
      await db.reelLike.create({ data: { reelId: reel.id, userId: l.id } }).catch(() => null)
    }
    await db.reel.update({
      where: { id: reel.id },
      data: { likesCount: likers.length },
    })
    created++
  }
  console.log(`created ${created} reels`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
