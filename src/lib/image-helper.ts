import sharp from 'sharp'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

// =====================================================================
// Deliverable 1 (Node.js edition): WebP Media Upload & Compression
// ---------------------------------------------------------------------
// Node.js port of app/Helpers/ImageHelper.php. Same pipeline contract:
//   1. Validate mime type + size (5 MB photo cap, matches PHP config)
//   2. Auto-orient via EXIF (sharp .rotate() with no angle does this)
//   3. Resize per preset (avatars square-cropped 512, posts max 1080,
//      stories 1080x1920 cover-crop, contest covers 1200x630, products 800)
//   4. Re-encode to .webp quality ~80 — typically 60-80% smaller than JPEG
//   5. Persist under public/uploads/<preset>/ and return the public URL
// =====================================================================

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 MB (max_photo_size_mb)

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
] as const

export type UploadPreset =
  | 'posts'
  | 'stories'
  | 'avatars'
  | 'covers'
  | 'contests'
  | 'products'
  | 'reels'

interface PresetConfig {
  width: number
  height: number | null
  fit: keyof sharp.FitEnum
  quality: number
}

const PRESETS: Record<UploadPreset, PresetConfig> = {
  posts: { width: 1080, height: 1350, fit: 'inside', quality: 80 },
  stories: { width: 1080, height: 1920, fit: 'cover', quality: 80 },
  avatars: { width: 512, height: 512, fit: 'cover', quality: 82 },
  covers: { width: 1500, height: 500, fit: 'cover', quality: 78 },
  contests: { width: 1200, height: 630, fit: 'cover', quality: 80 },
  products: { width: 800, height: 800, fit: 'cover', quality: 80 },
  reels: { width: 1080, height: 1920, fit: 'cover', quality: 80 },
}

export interface ProcessedImage {
  url: string
  fileName: string
  width: number
  height: number
  bytes: number
  originalBytes: number
  savedPercent: number
}

export class UploadError extends Error {}

/**
 * Convert any supported upload into an optimized .webp asset.
 * Throws UploadError on invalid input; writes to public/uploads/<preset>/.
 */
export async function processAndStoreImage(
  file: File,
  preset: UploadPreset
): Promise<ProcessedImage> {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new UploadError('No file provided')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError('File exceeds the 5 MB limit')
  }
  const mime = (file.type || '').toLowerCase()
  if (!ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
    throw new UploadError(`Unsupported image type: ${mime || 'unknown'}`)
  }

  const cfg = PRESETS[preset]
  const originalBytes = file.size
  const buffer = Buffer.from(await file.arrayBuffer())

  let output: sharp.OutputInfo
  const webpBuffer = await sharp(buffer, { animated: false })
    .rotate() // EXIF auto-orient
    .resize({
      width: cfg.width,
      height: cfg.height ?? undefined,
      fit: cfg.fit,
      withoutEnlargement: true,
    })
    .webp({ quality: cfg.quality, effort: 4 })
    .toBuffer({ resolveWithObject: true })
    .then((res) => {
      output = res.info
      return res.data
    })

  // If WebP somehow came out larger (rare), keep the smaller original
  let finalBuffer = webpBuffer
  let ext = 'webp'
  if (webpBuffer.byteLength >= originalBytes && originalBytes < 1024 * 512) {
    finalBuffer = buffer
    ext = mime.split('/')[1].replace('jpeg', 'jpg')
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', preset)
  await fs.promises.mkdir(dir, { recursive: true })
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`
  await fs.promises.writeFile(path.join(dir, fileName), finalBuffer)

  return {
    url: `/uploads/${preset}/${fileName}`,
    fileName,
    width: output!.width,
    height: output!.height,
    bytes: finalBuffer.byteLength,
    originalBytes,
    savedPercent: Math.max(
      0,
      Math.round((1 - finalBuffer.byteLength / Math.max(1, originalBytes)) * 100)
    ),
  }
}

/**
 * Generate a deterministic gradient placeholder (avatars, seed media).
 * Renders an inline SVG then encodes to .webp — no external assets needed.
 */
export async function generatePlaceholderWebp(
  dir: UploadPreset,
  opts: {
    width?: number
    height?: number
    from?: string
    to?: string
    label?: string
  } = {}
): Promise<string> {
  const width = opts.width ?? 600
  const height = opts.height ?? 600
  const from = opts.from ?? '#f0b429'
  const to = opts.to ?? '#d946ef'
  const id = `g${crypto.randomBytes(4).toString('hex')}`
  const label = (opts.label ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const fontSize = Math.round(Math.min(width, height) / 3)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    ${label ? `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="rgba(255,255,255,0.92)">${label}</text>` : ''}
  </svg>`
  const out = await sharp(Buffer.from(svg))
    .webp({ quality: 85 })
    .toBuffer()
  const target = path.join(process.cwd(), 'public', 'uploads', dir)
  await fs.promises.mkdir(target, { recursive: true })
  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.webp`
  await fs.promises.writeFile(path.join(target, fileName), out)
  return `/uploads/${dir}/${fileName}`
}
