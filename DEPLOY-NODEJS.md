# ACE Platform — Node.js Edition (Deployment Guide)

The complete PHP/MySQL MVC social platform, rewritten as a modern Node.js stack.
All four upgrade deliverables are ported and were verified end-to-end in a real browser.

## What's inside

| Original PHP deliverable | Node.js equivalent | Location |
|---|---|---|
| `app/Core/Database.php` (PDO wrapper) | Prisma ORM singleton — every query parameterized by design | `src/lib/db.ts` |
| `app/Helpers/ImageHelper.php` (WebP) | Sharp WebP pipeline (posts / stories / avatars / covers / contests / products presets, 5 MB guard, EXIF rotate, smaller-original fallback) | `src/lib/image-helper.ts` |
| SSE Notification + Message controllers | SSE bus with 25s heartbeats, 240s rotation, per-user channels, poll fallback + client hook | `src/lib/events.ts`, `src/lib/notify.ts`, `src/app/api/realtime/*`, `src/hooks/use-realtime.ts` |
| `public/sw.js` + PWA banner | SW v3 (stale-while-revalidate, network-first pages w/ 4s timeout, media LRU, offline.html) + install banner: 15s trigger, 7-day dismiss cooldown | `public/sw.js`, `src/components/pwa/pwa-provider.tsx` |

Also included: auth (scrypt + signed httpOnly sessions + rate limiting), posts/likes/comments,
24h stories, contests with lifecycle + winner crowning, shop with atomic coin transactions and
gated reviews, messages with typing/seen, notifications with unread badges, admin stats/moderation.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- Prisma ORM — SQLite for local dev (file: `db/custom.db`)
- Sharp for WebP image processing
- Native SSE for realtime (no Socket.IO needed at this scale)
- Session auth: HMAC-signed httpOnly cookie, `AUTH_SECRET`

## Run locally

```bash
npm install
npm run db:generate        # prisma generate
npm run db:push            # create sqlite db from prisma/schema.prisma
bun scripts/seed.ts        # demo data (users, posts, stories, contests, shop…) — or: npx tsx scripts/seed.ts
npm run dev                # http://localhost:3000
```

Demo logins (after seeding): `demo / password123` and `admin / admin123`.

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string (SQLite in dev) |
| `AUTH_SECRET` | HMAC key for session cookies — set a long random value in production |

**Session cookies** are issued as `HttpOnly; SameSite=None; Secure; Partitioned` (CHIPS) so the
app stays logged in inside cross-site iframe previews, plus a Bearer-token fallback
(`Authorization` header from localStorage, `?token=` for EventSource) for browsers that block
third-party cookies. Requires HTTPS in production (localhost is exempt in dev).

## Deploy (GitHub → hosting)

1. **Push to GitHub** (repo root = this folder). Add `.env` to `.gitignore` first.
2. **Pick a host that runs Node.js** — Render / Railway / Koyeb free tiers all work
   (GitHub Pages can NOT run this backend; InfinityFree MySQL will refuse remote cloud connections).
3. **Database**: easiest is a managed free MySQL-compatible DB (Aiven always-free MySQL or
   TiDB Cloud Serverless). Switch `prisma/schema.prisma` provider to `mysql`, update
   `DATABASE_URL` to the provider's connection string, then run `npm run db:push` + seed once.
4. **Build & start on the host**:
   ```bash
   npm run build
   npm start
   ```
5. **Set env vars on the host**: `DATABASE_URL`, `AUTH_SECRET`.
6. Note: SSE holds one connection per logged-in tab; single-instance deployment is expected
   at free tier. The client already auto-falls-back to polling if SSE is interrupted.

## Uploading files in production

WebP uploads are written to `public/uploads/**`. On ephemeral hosts (Render free), uploads
reset on redeploy — mount a persistent disk for `public/uploads` or swap the two `writeFile`
call sites in `src/lib/image-helper.ts` for object storage (S3/R2) when you scale.
