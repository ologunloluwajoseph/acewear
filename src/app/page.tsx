import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { AceApp } from '@/components/ace/ace-app'

// =====================================================================
// Shared-post link previews ("the picture of a shared post appears at
// the shared link"). Social crawlers (WhatsApp, X, Telegram, iMessage,
// Discord…) never run the client SPA, so the OG/Twitter tags below are
// rendered server-side from the ?post= parameter of share links:
//   /?post=12  ->  og:image = that post's picture
// Drafts are read straight from the DB (no auth) — only metadata for
// ACTIVE posts leaks; removed posts fall back to the default card.
// =====================================================================

const DEFAULT_TITLE = 'ACE — Where every face is a wild card'
const DEFAULT_DESCRIPTION =
  'Social platform with contests, stories, real-time chat and a coin shop.'

/** Absolute origin as seen by the visitor (preview proxy, localhost…). */
async function currentOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const sp = await searchParams
  const raw = Array.isArray(sp.post) ? sp.post[0] : sp.post
  const postId = parseInt(raw ?? '', 10)

  const origin = await currentOrigin()
  let title = DEFAULT_TITLE
  let description = DEFAULT_DESCRIPTION
  let image = `${origin}/og-default.png`
  let large = false

  if (Number.isInteger(postId) && postId > 0) {
    const post = await db.post.findUnique({
      where: { id: postId },
      select: {
        body: true,
        mediaUrl: true,
        mediaType: true,
        status: true,
        user: { select: { firstName: true, username: true } },
      },
    })
    if (post && post.status === 'active') {
      title = `${post.user.firstName ?? post.user.username} on ACE`
      const text = (post.body ?? '').replace(/\s+/g, ' ').trim()
      description = text
        ? text.length > 160
          ? `${text.slice(0, 157)}…`
          : text
        : 'Check out this post on ACE 🃏'
      if (post.mediaType === 'image' && post.mediaUrl) {
        image = post.mediaUrl.startsWith('http')
          ? post.mediaUrl
          : `${origin}${post.mediaUrl}`
        large = true
      }
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'ACE',
      type: 'article',
      url: `${origin}/`,
      images: [{ url: image }],
    },
    twitter: {
      card: large ? 'summary_large_image' : 'summary',
      title,
      description,
      images: [image],
    },
  }
}

export default function Page() {
  return <AceApp />
}
