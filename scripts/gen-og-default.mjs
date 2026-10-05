// Generates public/og-default.png — the branded 1200x630 card used as
// the link-preview image for shared links that have no post picture.
import sharp from 'sharp'

const W = 1200, H = 630

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a22"/>
      <stop offset="0.55" stop-color="#0f0f14"/>
      <stop offset="1" stop-color="#26262e"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#f0b429" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#f0b429" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fde68a"/>
      <stop offset="0.5" stop-color="#f0b429"/>
      <stop offset="1" stop-color="#b45309"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- floating card suits -->
  <text x="90"  y="150" font-family="DejaVu Sans" font-size="64" fill="#f0b429" opacity="0.22" transform="rotate(-14 90 150)">&#9824;</text>
  <text x="1090" y="120" font-family="DejaVu Sans" font-size="56" fill="#ef4444" opacity="0.20" transform="rotate(12 1090 120)">&#9829;</text>
  <text x="1060" y="560" font-family="DejaVu Sans" font-size="70" fill="#f0b429" opacity="0.22" transform="rotate(-10 1060 560)">&#9830;</text>
  <text x="120" y="565" font-family="DejaVu Sans" font-size="56" fill="#22c55e" opacity="0.18" transform="rotate(14 120 565)">&#9827;</text>

  <!-- logo badge -->
  <rect x="${W / 2 - 82}" y="118" width="164" height="164" rx="36" fill="url(#gold)"/>
  <text x="${W / 2}" y="232" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="104" fill="#0f0f14">A</text>

  <!-- wordmark -->
  <text x="${W / 2}" y="382" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="96" letter-spacing="14" fill="#fafafa">ACE</text>
  <text x="${W / 2}" y="452" text-anchor="middle" font-family="DejaVu Sans" font-size="38" fill="#f0b429">Where every face is a wild card &#9824;</text>

  <!-- footer -->
  <text x="${W / 2}" y="548" text-anchor="middle" font-family="DejaVu Sans" font-size="26" fill="#9ca3af">Contests &#183; Stories &#183; Live chat &#183; Reels &#183; Coin shop</text>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('public/og-default.png')
console.log('og-default.png written')
