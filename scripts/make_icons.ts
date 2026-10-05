/** Generate ACE PWA icons (192, 512, maskable, apple-touch) via sharp */
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const OUT = '/home/z/my-project/public/icons'
fs.mkdirSync(OUT, { recursive: true })

const svg = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a22"/>
      <stop offset="1" stop-color="#0a0a0f"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f5c451"/>
      <stop offset="1" stop-color="#d98e04"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="${pad ? 200 : 0}" fill="url(#bg)"/>
  <g transform="translate(512,512)">
    <text x="0" y="60" text-anchor="middle" dominant-baseline="middle"
      font-family="Georgia, serif" font-weight="800" font-size="560" fill="url(#gold)">A</text>
    <text x="0" y="330" text-anchor="middle" font-family="Arial" font-size="86"
      fill="rgba(255,255,255,0.55)">♠ ♥ ♦ ♣</text>
  </g>
</svg>`

async function main() {
  const jobs: [string, number, string][] = [
    ['icon-192.png', 192, svg(0)],
    ['icon-512.png', 512, svg(0)],
    ['icon-maskable-512.png', 512, svg(1)],
    ['apple-touch-icon.png', 180, svg(1)],
  ]
  for (const [name, size, src] of jobs) {
    await sharp(Buffer.from(src)).resize(size, size).png().toFile(path.join(OUT, name))
    console.log('✓', name)
  }
}

main()
