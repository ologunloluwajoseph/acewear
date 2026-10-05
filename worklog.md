# Worklog — ACE Platform Upgrade

---
Task ID: 1
Agent: Super Z (main)
Task: Extract and audit Htdocs (1).zip — ACE PHP/MySQL MVC social platform

Work Log:
- Extracted to /home/z/my-project/work/htdocs_src/Htdocs
- Read core: public/index.php (front controller + routes), app/Core/Router.php, app/Core/Controller.php
- Read config: app/Config/config.php (InfinityFree, STORY_LIFETIME_HOURS=13, APP_DEBUG=true), app/Config/database.php (DB facade, currently defines class DB)
- Read controllers: MessageController (poll+typing), NotificationController (index+markRead), StoryController, PostController, ProfileController (avatar/cover upload), ShopController
- Read schema.sql (25 tables), story_likes.sql, feature_expansion.sql, sw.js v1, manifest.json, layouts/app.php, app.js, functions.php
- Audited: CSRF coverage (typing() and viewDuration() lack it), badge IDs (notif-badge-top/right exist, msg badges have NO ids), PDO already EMULATE_PREPARES=false

Stage Summary:
- Key integration facts: DB:: static facade used everywhere; Router supports GET/POST; UPLOAD_PATH=storage/uploads (posts/, stories/, avatars/, covers/ subdirs); csrf-token meta in layout; script injection point before </body> in layouts/app.php lines ~1437; badges updated by realtime.js must cover notif-badge-top/right + new msg-badge-top/right
- Hosting: InfinityFree shared (PHP, MariaDB) — SSE must auto-reconnect with max-duration loop, no cron available
- Decision: create app/Core/Database.php (new class Database) + keep DB facade as `class DB extends Database` in app/Config/database.php for 100% backward compat

---
Task ID: 2
Agent: Super Z (main)
Task: Implement all four upgrade workstreams + supporting features, verify, package

Work Log:
- Created app/Core/Database.php (typed explicit binding, transactions, ensureConnection keep-alive, slow-query log) + DB extends Database BC facade
- Created app/Helpers/ImageHelper.php (WebP pipeline: Imagick→GD, EXIF rotation, square avatars, animated-GIF preservation, size-comparison fallback); fixed canvas fill-order corruption bug found in self-review
- SSE: NotificationController::stream (stats + notifications events, Last-Event-ID resume, 240s rotation, heartbeat, session_write_close, MySQL keep-alive) + MessageController::stream (chat + typing events, id-delta, mark-read) + /notifications/poll fallback; fixed single-quoted \n bugs that would corrupt SSE framing
- realtime.js: EventSource with 3-strike fallback to polling, badge updater for 8 badge IDs, toasts, chat takeover via startChatPolling interception, visibility-aware polling
- sw.js v2 (SWR statics, network-first pages w/ 4s timeout, cache-first media LRU 120, offline.html), pwa-banner.js (15s trigger loop, 7-day localStorage cooldown, Android prompt + iOS hint), real PNG icons 192/512/maskable + manifest v2 + apple-touch meta
- Security: Csrf class (header/form/JSON validate + rotation + sameOrigin fallback), validateCsrfOrOrigin for sendBeacon, CSRF on typing(), security headers + HTTPS enforcement in front controller, APP_DEBUG=false, fresh SECRET_KEY + CRON_SECRET, STORY_LIFETIME_HOURS 13→24, WebP config block
- Entry point: public/index.php = canonical router (added SSE/cron/review/shop/pages routes); root index.php → shim; root .htaccess → public/index.php + blocks app/database/tools/storage-cache; ace-fix-*.php moved to tools/
- 24h story decay: hourly lazy sweep (file-flag) + /cron/stories?secret= endpoint; ContestHelper syncStatuses + winner awarding in locked transaction; gated reviews (ShopController::reviewGate + ShopHelper) + shop_reviews.sql + performance_indexes.sql (composite PKs followers/story_likes/story_views)
- Fixed 8 query sites that referenced dropped surrogate id columns (StoryController, ProfileController, MessageController)
- Verification: node --check on 3 JS files OK; wrote scripts/php_sanity.py (tag-aware PHP tokenizer, brace/string/comment balance) — all 80+ app PHP files clean; caught & fixed real bugs (?> inside docblock, single-quote \n, canvas fill order, goto refactor)
- Packaged /home/z/my-project/download/ACE-upgraded-htdocs.zip (147 files)

Stage Summary:
- All 4 requested deliverables implemented, integrated with existing code conventions, plus security/architecture hardening, 24h story decay, contest lifecycle, gated reviews, and DB migrations
- Deployment docs shipped in UPGRADE-NOTES.md inside the ZIP

---
Task ID: 3
Agent: Super Z (main)
Task: Upgrade ACE platform from PHP to Node.js (user request: "Upgrade it to nodes.js instead of php")

Work Log:
- Initialized fullstack env; mapped all 4 PHP deliverables to Node.js equivalents
- Rewrote prisma/schema.prisma: 15 models (User, Post, Vote, Like, Comment, Story, StoryView, Contest, ContestEntry, ContestVote, Conversation, Message, Notification, Product, Order, Review, Follow) with composite uniques (likes/votes/storyViews/follows/entries) + indexes; db:push OK
- scripts/seed.ts: 8 users (scrypt hashes), 8 posts w/ sharp-generated WebP images, stories, 3 contests + entries + votes, 6 products, orders (demo bought badge+boost => gated reviews), 2 conversations, notifications. Logins: demo/password123, admin/admin123
- Core libs: src/lib/db.ts (Prisma singleton, deliverable-4 equivalent); src/lib/auth.ts (scrypt+timingSafeEqual, HMAC-signed httpOnly session cookie, rate limiter); src/lib/image-helper.ts (deliverable 1: sharp WebP pipeline, presets posts/stories/avatars/covers/contests/products, 5MB guard, EXIF rotate, smaller-original fallback, SVG placeholder gen); src/lib/events.ts (globalThis SSE bus); src/lib/notify.ts (DB row + SSE push); src/lib/contests.ts (lazy lifecycle sync + winner crowning)
- API routes (20): auth(register/login/logout/me), upload(WebP), posts(feed/create/like/comments/delete), stories(+view), contests(admin create, detail, entries, vote), shop(products/orders atomic-coin-transaction/gated-reviews), messages(list/thread/send/typing w/ read receipts), notifications, realtime/stream (SSE: heartbeat 25s, 240s rotation, per-user channels, abort cleanup), realtime/poll (3-strike fallback), follow, users/[username], profile, admin/stats, admin/actions (remove/restore/ban/verify/announce)
- Deliverable 2 client: src/hooks/use-realtime.ts (EventSource, capped backoff, 3-strike -> poll fallback, auto-recover); store registry fans SSE events to views; app-shell wires badges + toasts
- Deliverable 3: public/sw.js v3 (SWR statics, network-first nav 4s timeout, cache-first media LRU 120 w/ timestamps, API network-only + offline JSON), manifest.json (shortcuts), offline.html, sharp-generated icons 192/512/maskable/apple; pwa-provider.tsx (register + updatefound SKIP_WAITING; install banner: 15s eligibility loop, 7d localStorage cooldown, beforeinstallprompt + iOS fallback hint)
- UI (forced-dark casino theme): page.tsx SPA gate; app-shell (desktop sidebar + mobile bottom nav + realtime toast stack); feed (composer+postcard+comments), stories (bar/viewer/create), contests (list/detail/join/vote w/ optimistic re-sort), shop (catalog/buy/review gate), messages (thread/typing/seen), notifications, profile (edit dialog, avatar/cover WebP upload), admin (stats/moderation/users/broadcast)
- Browser E2E (agent-browser, 2 sessions): login demo+nova; like toggle 3-4-3; vote toggle w/ re-sort; story viewer opens w/ 24h countdown; buy crown 1200->450 coins, review gate unlocked, gated review published, unpurchased product gate HOLDS; SSE verified cross-session (nova msg -> demo Chat 2->3 + Alerts 3->4 instantly; reply -> nova badge; broadcast delivered:8 -> nova toast); mark-all-read clears badge; composer post lands at top; admin stats live (8/9/2/4/6/103.9k); moderation remove/restore; SW active, banner dismiss -> 7d cooldown respected past 15s re-check; upload 5MB guard 422; 4MB PNG -> 249KB WebP (94% saved) served 200; offline reload served from SW cache
- Fixed during verification: Prisma filtered _count syntax (messages unread), missing NextResponse import (shop/reviews), lastOnline ghost field (messages/[userId]), contest footer operator-precedence bug, react-hooks lint (ref-in-render, setState-in-effect)

Stage Summary:
- Platform fully migrated PHP -> Node.js: Next.js 16 App Router + TS + Prisma/SQLite + sharp + SSE; all 4 deliverables ported and browser-verified end-to-end
- Security parity kept: scrypt password hashing, signed httpOnly sessions, parameterized-by-design queries (Prisma), login rate limiting, auth gating on every mutating route, admin guardrails
- Realtime parity kept: SSE w/ heartbeats + rotation + poll fallback (no socket.io needed for 1-process sandbox)

---
Task ID: 4
Agent: Super Z (main)
Task: Fix missing preview/download buttons — finalize delivery of Node.js platform

Work Log:
- Diagnosed root cause: session ended after Task 3 build/verification but before Complete tool call, so preview UI was never provisioned
- Verified app health: next-server v16.1.3 live on :3000 (HTTP 200), /sw.js served, Caddy proxy :81 -> :3000 intact
- Wrote DEPLOY-NODEJS.md (local run, env vars, GitHub -> Render/Railway + Aiven/TiDB MySQL deploy path, uploads persistence note)
- Packaged download/ACE-nodejs-platform-source.zip (177 files, excludes node_modules/.next/uploads) alongside existing ACE-upgraded-htdocs.zip

Stage Summary:
- Preview + download delivery finalized: web_dev project marked Complete; two zips available in download/
- Demo logins: demo/password123, admin/admin123

---
Task ID: 5
Agent: Super Z (main)
Task: Fix "login not transitioning to feed" — cross-site iframe session loss

Work Log:
- Diagnosed via dev.log + curl: server returned login 200 + cookie every time, but browser kept /api/auth/me unauthenticated -> Set-Cookie (SameSite=Lax) dropped in cross-site iframe preview context
- Fix (central, auth.ts): cookie now HttpOnly; SameSite=None; Secure; Partitioned (CHIPS) for iframe-compatible sessions; getSessionUser now accepts cookie -> Authorization: Bearer -> ?token= (EventSource cannot send headers)
- login/register responses now include signed token; client persists it (src/lib/session-token.ts: localStorage + one-time window.fetch interceptor adding Bearer to /api/ calls)
- New SessionBridge component mounted in page.tsx (child effects run before parent bootstrap fetch); auth-view stores token on success; profile-view clears on logout; use-realtime builds EventSource URL with token fallback
- Verified server-side: Set-Cookie attrs correct, Bearer me works, SSE ?token= connects, unauthenticated SSE 401
- Verified in real browser (agent-browser): first-party tab login -> feed; fresh cross-origin iframe (simulated preview pane via :8899 parent page) login -> feed; session survives reload via Partitioned cookie
- Updated DEPLOY-NODEJS.md; repacked download/ACE-nodejs-platform-source.zip with fix

Stage Summary:
- Root cause was iframe third-party cookie policy, not credentials; login now works in standalone tab AND embedded preview contexts

---
Task ID: 6
Agent: Super Z (main)
Task: Dashboard (animated charts) + full Settings suite (password, 60-day name rule, payouts/withdrawals, privacy, legal)

Work Log:
- Schema: User +tokenVersion/+nameChangedAt/+5 privacy toggles/+payout fields; new Withdrawal model; db:push + generate (required dev-server restart to reload client)
- auth.ts: token payload carries tv (tokenVersion); getSessionUser rejects stale tokens -> password change invalidates all sessions, response issues fresh token
- API GET /api/dashboard: totals, 14-day daily series (posts/likes/comments, JS bucketing -> DB-agnostic), 24-bucket hourly histogram, coin spend breakdown (orders by category + paid withdrawals), top posts
- API GET/PUT /api/settings (action dispatcher: password | name | privacy | payout) + POST /api/settings/withdraw (interactive transaction: balance check + decrement + pending row; min 500, payout-details gate, rate limited)
- Nav: AceView +dashboard/+settings; desktop sidebar section; mobile top-bar icons; new views wired in app-shell
- dashboard-view.tsx: count-up stat cards (rAF easing), framer-motion entrances, recharts Area (engagement 14d), Bar (posts/day), 24-bar histogram, donut Pie (coin spend), RadialBar trust gauge; fixed Rules-of-Hooks violation (inline useCountUp -> CountUpText child)
- settings-view.tsx: Account (password + name with live 60-day lock/countdown), Payouts (method/name/details + withdraw + history badges), Privacy (5 optimistic switches), Legal (full T&C + Privacy Policy); withdrawal now also refreshMe() to sync balance
- Seed extras: nova nameChangedAt (10d ago -> lock UI visible), demo withdrawal history (paid 1000 / rejected 200)
- E2E verified: curl (all guards: 60-day 429, below-min, over-balance, wrong current pw, old token dead after change); browser (dashboard 5 SVGs/38 bars/4 pie sectors/2 areas rendered + animated, name lock disabled state, privacy toggle persisted to DB, 500-coin withdrawal created pending row, legal tab 2805 chars); mobile viewport header icons OK

Stage Summary:
- Dashboard + Settings complete and browser-verified; demo balance 700, 1 pending 500 withdrawal for realistic demo state

---
Task ID: 7
Agent: Super Z (main)
Task: Unify navigation — everything inside the menu; hamburger drawer on mobile, clean menu bar on desktop

Work Log:
- Rewrote src/components/ace/app-shell.tsx: replaced split NAV/SIDE_NAV + bottom tab bar + stray mobile header icons with ONE unified MENU list (feed, contests, shop, chat, alerts, dashboard, profile, settings, admin-conditional)
- Mobile: header now only ACE logo + live status dot + hamburger button; hamburger opens animated slide-in drawer (framer-motion spring, right side) with backdrop tap-to-close, Escape-to-close, body scroll lock, auto-close on resize to desktop; drawer contains user card (avatar, name, @username, coins pill, live status), all menu items with badges, and Log out; drawer auto-closes on navigation
- Desktop: sidebar is now a single clean menu bar (no divider-split sections), badges on Chat/Alerts, aria-current on active item, user card kept
- Removed bottom bottom-nav and pb-20 compensation; removed BarChart3/Settings stray icons from mobile header
- Fixed PWA install banner z-index (z-[70]/z-[60] -> z-40) so it no longer covers the drawer footer/logout; iOS hint moved bottom-24 -> bottom-6 since bottom nav is gone
- E2E (agent-browser): mobile 390px — header shows only hamburger; drawer lists 8 items (Admin hidden for demo) + logout visible; JS-click Dashboard via drawer -> drawer closes + Dashboard renders; desktop 1280px — sidebar shows 8 unified items; admin login shows 9th "Admin" item in same list

Stage Summary:
- Navigation is now disorder-free: mobile = hamburger drawer (everything inside), desktop = unified menu bar sidebar; PWA banner layering fixed

---
Task ID: 8
Agent: Super Z (main)
Task: Restore sticky mobile bottom bar for primary tabs (Feed, Contests, Shop, Chat, Alerts)

Work Log:
- app-shell.tsx: added BOTTOM_KEYS (feed/contests/shop/messages/notifications); mobile bottom nav restored (z-50, safe-area padding, amber active state, badges, 44px touch targets)
- Drawer now holds only secondary items (Dashboard, Profile, Settings, admin-conditional Admin) + user card + logout; desktop sidebar unchanged (full unified list)
- main gets pb-16 md:pb-0 for bottom-bar clearance
- pwa-provider.tsx: install banner raised to z-[55] and repositioned above the bottom bar (bottom-[4.5rem+safe]); iOS hint at bottom-24 z-[55]
- E2E: mobile 390px — bottom bar lists 5 tabs, Shop tap switches view + active state; drawer = 3 secondary items; Escape closes drawer; desktop 1280px — bottom bar + burger not rendered (checkVisibility), sidebar full

Stage Summary:
- Final nav pattern: mobile = sticky bottom tabs (primary) + hamburger drawer (secondary), desktop = unified sidebar menu bar

---
Task ID: 9
Agent: Super Z (main)
Task: Infinite scrolling feeds + new Reels feature (bottom nav + full reels page)

Work Log:
- Schema: Reel (video|image, poster, soundLabel, views/likes counters, soft-remove) + ReelLike (unique reelId+userId); db push + generate (required killing stale next-server from 01:08 — fuser failed, old process kept serving old Prisma client -> db.reel undefined)
- CRITICAL FIX: /api/upload route was missing from disk entirely (composer photo uploads broken) — rebuilt it: image presets via processAndStoreImage, new reels preset accepts MP4/WebM/MOV up to 60MB with magic-byte sniffing (ftyp/EBML), stored raw under public/uploads/reels; image-helper got 'reels' preset (1080x1920 cover)
- Reels API: GET /api/reels (cursor pages of 4, likedByMe), POST (caption<=300, /uploads/reels/ URL guard, follower notifications), [id]/like (toggle + denormalized count + notify), [id]/view (per-user+reel dedupe via globalThis Set), [id] DELETE (owner/admin soft-remove)
- app-shell: Reels (Clapperboard icon) added to MENU + BOTTOM_KEYS -> 6 mobile tabs (Feed, Reels, Contests, Shop, Chat, Alerts); desktop sidebar full list; AceView + ReelDTO types
- reels-view.tsx: full-screen snap-y-mandatory feed; per-card IntersectionObserver (root=container, 0.6) drives active play/pause/reset + one-time view POST; global mute toggle; right rail (like/views/mute/delete-owner); double-tap-to-like with framer-motion heart burst, single tap pauses; video progress bar; image reels get CSS Ken Burns; keyboard arrows on desktop; 420px phone frame on desktop; runtime chrome measurement (header+bottom nav+safe-area) for pixel-perfect height
- Infinite LOOP pagination (both feed + reels): cursor pages append; when nextCursor null -> cursor resets to top and cycle++ (uids `id#cycle#i` keep React keys unique); caps: reels 12 cycles, feed 6 cycles, then end card + back-to-top. Feed sentinel rootMargin 600px; reels sentinel inside snap container
- media.tsx UploadButton: + 'reels' preset, accept prop, mediaType passthrough, busyLabel
- Seed scripts/seed_reels.ts: 5 ffmpeg-generated 5s vertical MP4s (animated gradients + casino drawtext) + posters, 4 sharp image reels, 9 reels across real usernames (nova_queen, ace_high, iris_wild, max_bluff, ruby_dawn, demo, lucky_echo) with staggered timestamps, random likes + base views
- SW v4 FIX: video Range requests (206) were being cache.put() -> throws -> SW synthesized empty 504 -> "no supported sources" on all reels video; now Range requests bypass the SW and 206 never enters Cache API
- E2E (browser + curl): upload video->reels 200, image->posts WebP-compressed, video->posts rejected 422; reel create/like-toggle/view/delete + 401 guard; reels page: container 725px (844-56-63), first reel autoplaying (t=2.7s, ready=4), snap scroll pauses previous + starts next, like 4->5, view 5646->5647, deep scroll -> cards 9->13 with cycle-1 uids (loop confirmed); feed 8->16 posts (cycle 1); create dialog renders; desktop sidebar + 420px frame verified

Stage Summary:
- Feeds (posts + reels) now scroll infinitely and loop back through content automatically
- Reels shipped end-to-end: model, APIs, uploads (60MB video), TikTok-style viewer, create flow, seeded demo content; PWA service worker no longer breaks video streaming

---
Task ID: 10
Agent: Super Z (main)
Task: Themes (light/dark/purple/premium-glass), menu completeness (account/payment/terms/help), share & reshare, tag friends & followers, heart=like + broken-heart=dislike

Work Log:
- Schema: Post +dislikesCount/+resharesCount/+originalPostId (self-relation "PostRepost", onDelete SetNull); new Dislike + PostTag models (unique postId+userId); db push + generate (stale next-server had to be hard-killed again — setsid relaunch used)
- Themes (src/lib/theme.ts + globals.css): 4 scopes via html[data-theme] — dark (classic casino), light (daylight deck), purple (royal flush), premium (transparent glass: translucent cards/popover + fixed aurora radial-gradient body backdrop); specificity 0-1-1 beats .dark; SSR default data-theme="dark" in layout (no flash); localStorage persistence with getStoredTheme/applyTheme/canUsePremium(isPro||isAdmin)
- app-shell: ThemeGrid (vertical swatch cells, 2x2) in desktop sidebar + mobile drawer under THEME heading; premium locked with Lock icon for non-PRO, tap shows sonner "Transparent mode is for Premium members…"; theme effect guards stored premium when session user lacks rights; MORE section with 4 quick links — Account details->settings/account, Payment account->settings/payouts, Terms & Privacy->settings/legal, Help & Support->new HelpDialog (support email, payout help, safety reporting)
- settings-view: accepts initialTab prop, Tabs now controlled + sync effect (deep-linkable sections)
- Posts API: GET returns dislikesCount/resharesCount/dislikedByMe/resharedByMe/tagged[]/originalPost(embedded, status-guarded); POST validates taggedUserIds (dedupe, strip self/invalid, max 10) creates PostTag rows + "tagged you in a post" notifications (deduped vs follower notifications); new POST /api/posts/[id]/dislike (toggle, clears like + decrements, no author notification by design); like route now clears dislike (mutual exclusivity both ways); new POST /api/posts/[id]/repost (optional comment<=500, block repost-of-repost, transaction create+increment resharesCount, "reshared your post" notification); new GET /api/users/mutuals?q= (followed+followers union, following flag, search) powers tag picker
- feed-view: TagPickerDialog (debounced search, follow/follows-you labels, checkbox list, n/10 counter, composer chips with remove); PostCard heart=Like + HeartCrack broken-heart directly beside it (both with counts, mutual-exclusive optimistic sync both directions); Share button (navigator.share -> clipboard API -> execCommand fallback chain, ?post=id deep links); Repeat2 reshare button + ReshareDialog (original preview, optional comment, feed reset on success); repost rendering ("You/X reshared" banner + embedded original card); tagged users render as sky chips -> openProfile
- E2E (curl): dislike on liked post 6->5 likes +dislike=1; re-like restores 6 + clears dislike; repost creates embedded child + resharesCount=1 + resharedByMe; repost-of-repost rejected; tagged post filters invalid id 999, keeps iris_wild; feed shows tagged+original fields (test posts cleaned up)
- E2E (browser): sidebar/drawer THEME + MORE render; Light->data-theme=light + light visuals verified; Purple applied + screenshot; Transparent as demo gated with toast (stays); as admin lock absent + premium applies (aurora + glass verified mobile+desktop, persists across reload); quick links deep-link correct tabs (Account/Payouts/Legal) + Help dialog opens; heart/broken-heart adjacency + toggle both directions; reshare dialog -> toast -> repost at top w/ embedded original; share falls to graceful error toast in headless (clipboard blocked by env, chain correct for real browsers); tag picker lists 7 mutuals w/ follow labels, select -> chip -> post -> toast "tagged 1 friend" -> @iris_wild chip renders; infinite scroll still appends (9->27); reels 4 videos readyState 4 + snap container intact; tsc clean for changed files

Stage Summary:
- Full theme system shipped: light/dark/purple + PRO-gated transparent glass, switchable from both menus, persisted per device
- Menu is now complete: nav + Theme + Account details / Payment account / Terms & Privacy / Help & Support deep links
- Posts now support share (link), reshare with comment (embedded original), tagging friends/followers (notifications + chips), and heart/broken-heart reactions with mutual exclusivity

---
Task ID: 11
Agent: Super Z (main)
Task: Premium live typing — chat drafts stream as faint ghost bubbles on both ends while typing

Work Log:
- events.ts: added 'live_typing' to the SSE RealtimeEvent union (ephemeral by design — never persisted to DB)
- PUT /api/messages/:userId: optional { draft } body (sliced to 500 chars) upgrades the typing ping into the live stream; premium gate isPro||isAdmin else 403 "Live typing is a Premium feature"; empty-string draft = clear signal that suppresses the classic dots event; legacy body-less ping behavior untouched (live:false)
- use-realtime.ts: triggerTyping(toUserId, draft?) now sends an optional JSON body ('' included, undefined = old ping)
- messages-view.tsx: premium = isPro||isAdmin; broadcastLiveDraft with leading+trailing 700ms throttle (recipient id captured per scheduling so a trailing timer can never leak a draft into a different chat after switching); stopLiveBroadcast clears trailing timer + emits '' on thread open/back/send/view-unmount (activeUserRef kept in sync via effect, no ref-in-render); live_typing listener filters to active partner, sets peerLive {text,name} with 4s stale-expiry, message arrival clears it
- UI: peer ghost bubble = dashed emerald border, italic 55% opacity text, pinging live dot + "X is typing live" footer; self ghost = dashed amber bubble "live · {name} sees this as you type"; both rendered in the thread above the classic dots with fade-in motion and data-testids; free users see a Crown chip above the composer -> sonner upsell toast (receiving from a PRO typist is NOT gated — the perk belongs to the broadcaster)
- E2E (curl): demo(free) draft -> 403; nova(PRO) draft -> 200 live:true; '' clear -> 200; body-less ping -> 200 live:false; unauthenticated -> 401
- E2E (browser, agent-browser): admin types in demo thread -> live-ghost-self appears + updates keystroke-batch by keystroke-batch ("... — it updates live!") + Enter -> ghost gone + message lands; demo login -> Crown chip visible + typing produces NO self ghost + chip click shows upsell toast; curl nova draft -> live-ghost-peer renders instantly in demo's browser with exact text + "Nova is typing live" (screenshot download/e2e-live-typing-peer-ghost.png), '' clears it; tsc clean on all touched files

Stage Summary:
- Chats now "go live" for Premium (PRO/admin) users: in-progress messages appear faintly at the sender's and recipient's thread in real time over SSE, with clear signals on send/backspace/switch/unmount; free users keep the classic typing dots plus a premium upsell chip

---
Task ID: 12
Agent: Super Z (main)
Task: Shared-post link previews (post picture at the shared link) + deep-link landing

Work Log:
- page.tsx converted to a server component with generateMetadata({searchParams}): reads ?post=, loads the post (status-active guard) straight from Prisma, emits og:title "{author} on ACE", og:description (body, 160 chars), og:image + twitter:image = post's mediaUrl as ABSOLUTE URL (origin derived from x-forwarded-host/proto headers so preview-proxy shares carry correct URLs), twitter:card summary_large_image; missing/removed/no-image posts fall back to branded /og-default.png; SPA moved unchanged into src/components/ace/ace-app.tsx (client)
- scripts/gen-og-default.mjs: sharp SVG->PNG 1200x630 branded casino card (gold A badge, wordmark, suits) -> public/og-default.png (131KB)
- New GET /api/posts/:id (single post, exact feed-item shape + viewer flags via postId_userId uniques); pre-existing DELETE handler preserved in same file (owner hard-delete / admin soft-remove, restored from git after overwrite catch)
- feed-view deep-link landing: on first page load, ?post=<id> -> replaceState URL cleanup -> if post in feed, flash; else fetch /api/posts/:id and PREPEND -> flash = scrollIntoView(block:center) retried every 500ms x8 (layout grows while images load) + amber ring highlight (PostCard highlight prop, ring-offset) cleared ~1.8s after last attempt
- E2E (curl): ?post=1 served og:image=/uploads/posts/...webp + twitter:card=summary_large_image + author title; ?post=999 -> default title + og-default.png; og-default.png 200 (131KB); GET /api/posts/1 authed 200 full DTO, anon 401; DELETE owner-check verified (demo deleted own post 1 legitimately)
- E2E (browser): /?post=3 lands scrolled to the post (y=3836, picture full-bleed in view), amber ring highlight visible, URL cleaned to /; screenshot download/e2e-shared-post-landing.png
- FIXED ALONG THE WAY: (1) latent runtime crash — comments route used NextResponse without importing it (GET /api/posts/:id/comments would 500); (2) dev-only staleness trap — SW's staleWhileRevalidate never updates entries answered with 304 (response.ok false => no cache.put), so pwa-provider now skips SW registration when NODE_ENV !== 'production' (prod assets are content-hashed, SWR safe); (3) headless-testing insight — rAF callbacks only fire when frames are produced, flash scheduling moved to setTimeout
- tsc clean for all touched files

Stage Summary:
- Shared links now unfurl with the post's own picture (og:image/twitter:image, absolute URL, branded fallback) and land the recipient on the actual post in-feed with an amber highlight; SW no longer registers in dev (kills 304 staleness trap)

---
Task ID: 13
Agent: Super Z (main)
Task: Premium page + menu link; all premium features free for the first 3 days (welcome trial) with a live countdown (days/hours/minutes/seconds/milliseconds) on the Premium page

Work Log:
- src/lib/theme.ts: added TRIAL_MS (3d), PremiumUser type, trialEndsAt(), trialRemainingMs(), premiumTier(); extended canUsePremium() to return true during the trial window (derived from createdAt — survives logins, not resettable)
- src/app/api/messages/[userId]/route.ts: live-typing gate now canUsePremium(user) — trial users can broadcast drafts (403 only when trial expired and not PRO/admin)
- src/components/ace/messages-view.tsx: premium flag = canUsePremium(me) so the ghost bubbles/Crown chip follow the trial too
- src/components/ace/premium-view.tsx (new): ACE PRO hero, trial card with 5 live countdown tiles (DAYS/HOURS/MINUTES/SECONDS/MILLIS — rAF loop throttled ~25fps, millis tile amber-glow), day-N-of-3 chip, burn-down progress bar, member state (PRO/admin), expired-trial upsell state, 6 feature cards (2 unlocked: live typing + transparent theme; 4 SOON), 3 mock plans (monthly/yearly/lifetime) with sonner toasts
- src/lib/client-store.ts: AceView union += 'premium'
- src/components/ace/app-shell.tsx: Premium menu entry (Crown icon, amber) in the shared MENU — renders in the desktop sidebar and the mobile hamburger drawer; amber chip shows PRO (member/expired) or TRIAL (in trial); wired PremiumView into the view switcher
- scripts/seed.ts: demo user now seeded 5h backdated (ageHours) so the trial is visibly mid-countdown after re-seeds; live DB demo.createdAt set to now-5h
- Verify (curl): demo (trial) PUT draft -> 200 live:true; lucky_echo (trial expired) -> 403; /api/auth/me returns createdAt
- Verify (agent-browser): drawer shows Premium [TRIAL]; /premium countdown ticks (02d18h57m36s478ms -> 34s928ms across captures); Transparent theme applies during trial with no upsell toast (data-theme=premium), then back to dark; desktop sidebar Premium [TRIAL]; chat live self-ghost renders for trial user; screenshots saved to download/ (premium-countdown-t1/t2, premium-page-transparent-trial, premium-page-desktop, preview-mobile-drawer-premium, preview-feed-desktop, preview-chat-live-typing)
- tsc: no new errors (all remaining are pre-existing examples/skills/api-route items)

Stage Summary:
- Premium = isPro || isAdmin || within-3-day-trial(createdAt), enforced identically client- and server-side; new signups get the trial automatically from createdAt default
- Premium page reachable from both menus with live ms-resolution countdown; expired trial flips to upsell card, PRO/admin get member card
- Countdown derivation is pure client-side from me.createdAt (no API change needed); plans are mocked with toasts until checkout lands in the Shop

---
Task ID: 14
Agent: Super Z (main)
Task: Transparent mode -> LIGHT transparent glass; make posts, feeds, stories and chat glassy with CSS gradient animations (real transparent-glass feel)

Work Log:
- src/app/globals.css — rewrote the premium token block to a LIGHT glass scheme (color-scheme: light; dark foreground; translucent white card/popover/muted/accent/sidebar tokens; white glass borders; pink primary)
- Animated aurora backdrop: body::before fixed layer (inset -18%, z -1) with 4 pastel radial blobs + diagonal base gradient, `ace-aurora` 26s keyframes animating translate3d/scale/rotate + hue-rotate wobble so the tint keeps shifting behind the frosted panes
- Glass surfaces via wildcard attribute selectors (match every opacity variant): [class*='bg-card']/[class*='bg-popover'] -> blur(20px) saturate(1.65) + inset white top edge + tinted drop shadow; [class*='bg-muted']/[class*='bg-secondary'] (chat bubbles, chips, story tiles) -> blur(14px); [class*='bg-accent']/[class*='bg-background'] -> blur(16px); amber live-ghost bubble frost; header/bottom-nav/aside get `ace-glass-sheen` 16s animated gradient pan (moving light streak)
- Readability guards: deepened .text-amber-200/300/400 and .text-gradient-gold stops inside premium theme (amber text shipped for dark themes was too pale on white frost); light glass scrollbar tints
- src/lib/theme.ts: premium swatch now shows the light frost gradient; hint 'PRO light glass mode'
- BUG FIXED ALONG THE WAY: hand-writing backdrop-filter + -webkit-backdrop-filter made Lightning CSS (Next minifier) emit ONLY -webkit-backdrop-filter, which Blink/Chromium does not support (Safari-only prefix) -> frost silently dead in Chrome/agent-browser; fix = declare standard backdrop-filter only, minifier then emits both. Also hit a stale turbopack/postcss worker serving old CSS chunk until `next dev` was restarted (touch did not invalidate) — restart dev server when served CSS lags the source
- Verify (agent-browser): computed backdropFilter blur(20px) saturate(1.65) on cards; ace-aurora animation running; body text dark; screenshots download/glass-feed-mobile.png, glass-drawer.png (aurora blobs visibly refracting through the panel), glass-chat.png (frosted bubbles + amber live-ghost + gradient self-bubbles), glass-desktop.png; tsc filtered clean

Stage Summary:
- Transparent mode is now a true light-glass theme: animated pastel aurora behind, every card/story/chat surface frosted with backdrop blur, animated gradient sheens on chrome; all existing bg-* class usages get the treatment automatically (no component edits needed)
- Chromium-safe CSS: never hand-write both backdrop-filter and -webkit-backdrop-filter in this codebase (Lightning CSS drops the standard form)
- Dev-server quirk: if served CSS doesn't match globals.css, restart next dev (turbopack watcher can go stale)

---
Task ID: 15
Agent: Super Z (main)
Task: Restore the sticky bottom nav; separate Themes page (menu shows only a link); per-theme brightness & darkness adjustment

Work Log:
- ROOT-CAUSED the "restore the sticky nav" bug: layout.tsx puts a literal `bg-background` class on <body>; Task 14's frost wildcard `html[data-theme='premium'] [class*='bg-background']` matched <body> and gave it backdrop-filter — a filter value turns an element into the containing block for position:fixed descendants, so in transparent mode the bottom nav + toast stack dropped to the bottom of the DOCUMENT (rect.bottom 4673px vs 844px viewport). Fix: `:not(body)` on the wildcard + explicit `html[data-theme='premium'] body { backdrop-filter: none }` in globals.css. Verified pinned:true afterwards (cards kept blur(20px) saturate(1.65)).
- Bottom nav (app-shell.tsx): removed `md:hidden` — sticky primary tabs (Feed/Reels/Contests/Shop/Chat/Alerts) now pinned on ALL viewports; main `pb-16` always; desktop sidebar `pb-20` so the account card clears the bar.
- New Themes page: src/components/ace/themes-view.tsx (view 'themes' added to AceView in client-store.ts) — theme gallery cards (swatch banner, active check, PRO lock chip + "Unlock with Premium" -> premium view, saved-brightness badge) + Brightness & Darkness tuner: range 50-150%, Dim/Cozy/Normal/Bright/Max presets, Reset, "Saved level per theme" grid.
- theme.ts: BRIGHTNESS_STORAGE_KEY, MIN/MAX/DEFAULT_BRIGHTNESS (50/150/100), getStoredBrightnessMap/getStoredBrightness, applyBrightness (full-screen #ace-brightness-veil: black veil when <100%, white when >100%; a veil never breaks position:fixed or backdrop-blur, unlike CSS filters), setThemeBrightness (persist per theme + apply).
- app-shell.tsx: MENU gained { themes, Palette icon } between Premium and Settings; ThemeGrid/THEME_ICON removed from the shell together with the sidebar + drawer inline pickers — menus now only link to the page; view case renders ThemesView (theme state + selectTheme guard passed down); theme effect re-applies the brightness veil on every theme switch (incl. premium-guard fallback to dark).
- Infra note: sandbox reaps every child process between tool calls (even setsid) — the long-lived dev server died mid-task; scripts/devup.sh revives it at the start of each verification batch (restart is also the known fix for stale turbopack CSS).
- Verify (agent-browser): mobile 390x844 + desktop 1280x800; drawer buttons = Dashboard/Profile/Premium TRIAL/Themes/Settings + quick links, no grid; sidebar full list incl. Themes, no grid; nav pinned on all viewports; Dim on premium -> veil rgba(0,0,0,0.28) + stored {"premium":65}; Bright on dark -> rgba(255,255,255,0.11) + {"dark":120}; switching back restores 65 + black veil; light theme: no frost, no body backdrop, veil transparent (no regression); glass chat screenshot with veil; screenshots download/t15-*.png (6). Brightness reset to defaults at the end.

Stage Summary:
- Sticky bottom nav RESTORED everywhere — the transparent-mode containing-block bug is fixed for good (keep <body> free of backdrop-filter/filter triggers in this app)
- Themes is now its own page; both menus show only a Themes link
- Every theme has a persisted 50-150% brightness/darkness tuner; levels are per-theme and survive reloads
- New testids for E2E: themes-page, theme-card-*, brightness-slider, brightness-value, brightness-preset-*, brightness-reset, brightness-theme-*

---
Task ID: 16
Agent: Super Z (main)
Task: Transparent theme -> black & white + tip of purple; demo account = full premium; Paystack payout + checkout; Shop -> real-product marketplace (AceWears/AceLaptops/AcePhones), perks moved to Premium

Work Log:
- Theme recolor (globals.css + theme.ts): premium/transparent is now monochrome glass — grayscale aurora (white light, silver haze, deep charcoal shadow) with ONE violet blob as the only hue; primary/ring/charts -> purple; ALL amber UI recolored to violet in this mode (text-amber-*, bg-amber-400, from/to/via-amber-* gradient stops via --tw-gradient-from/to/via, bg-amber-400/10|15 chips, border-amber-*, shadow-amber) + story-ring conic -> monochrome sweep with purple tip; card alpha 55->62% for contrast over the darker aurora; glass shadows neutralized; swatch = #fafafa->#17171c->#a855f7, hint "PRO black & white glass".
- Demo account = full experience: scripts/promote-demo.ts sets demo -> isPro, proPlan lifetime, proUntil null, aceCoins 25000 (idempotent, ran against live DB); seed.ts updated the same way ("demo/password123 (full PRO)" on the login card). theme.ts: proEntitlementActive() honors isPro + proUntil expiry (admin bypass kept); canUsePremium/premiumTier rebuilt on it; SessionUser + auth select gained proPlan/proUntil.
- Paystack backend (src/lib/paystack.ts, PAYSTACK_ENABLED via sk_test/live key): listNigerianBanks (24-bank offline fallback), resolveBankAccount, createTransferRecipient, initTransfer, verifyTransaction, verifyWebhookSignature (HMAC SHA512), activateProFromPayment (idempotent: Payment success + user isPro/proPlan/proUntil + notification), finalizeDemoTransfers (TRF_demo_ rows settle to paid after 8s on read — mirrors the live transfer.success webhook). Plans in src/lib/premium-plans.ts (NGN: monthly 2500, yearly 20000 best, lifetime 45000; 1 coin = ₦1).
- New APIs: /api/paystack/banks, /resolve-account, /initialize (pending Payment + mode paystack|demo), /verify (live: verify+amount-match, demo: direct activation), /webhook (signature-gated, idempotent), /api/admin/withdrawals (GET queue, POST paid|rejected with coin refund). /settings/withdraw now fires real Paystack transfers for bank payouts (recipient cached on user, re-created when destination changes) or TRF_demo_ refs in sandbox; /api/settings GET finalizes demo transfers + returns bank fields; payout PUT persists payoutBankCode/Name and resets the recipient.
- Payouts UI (settings-view): Paystack bank picker (25 banks), 10-digit NUBAN + Verify button -> auto-fills holder name + "account verified" badge, "Paystack · sandbox mode / Secured by Paystack" chip, ₦1-per-coin copy with live "you receive ₦X" preview, history rows show ₦ + transfer ref. Admin view gained a Payouts tab (queue with refs, Mark paid / Reject-refund).
- Premium page: NGN plans with Paystack checkout — initialize -> live inline popup (js.paystack.co loaded on demand) when keys exist, else built-in sandbox checkout dialog (Paystack Secure Checkout -> Pay -> success state); verify-on-success + refreshMe; "Coin payouts via Paystack" feature now UNLOCKED; PRO Perks Store section (new perks-store.tsx — moved coin perks + verified reviews from the old shop, ProductDialog renamed PerkDialog, data-testid perk-product-*).
- Shop marketplace (shops.ts + shop-view rewrite): AceWears (hoodie/tee/cap/joggers), AceLaptops (ProBook 16/AirBook 14/LiteBook 14), AcePhones (Ultra 5G/Note 12/Mini) — 10 AI-generated studio product photos in public/shop/ (scripts/gen-shop-images.sh, resumable); store banners with gradient + tagline + Visit store button; product dialogs with ₦ price, delivery/authenticity chips, "Buy at {store}" -> window.open(shop.url); shop.url is null until the owner sends links -> graceful "coming soon" toast (drop links into SHOPS[].url later, zero code changes); footer pointer to Premium -> Perks Store.
- Schema (pushed to db/custom.db): User.proPlan/proUntil/payoutBankCode/payoutBankName/paystackRecipientCode, Withdrawal.amountNaira/transferRef, new Payment model (reference unique, provider paystack|demo). .env.example documents PAYSTACK_SECRET_KEY / NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY + webhook URL.
- Verify (curl + agent-browser): demo /me -> isPro lifetime 25k coins; banks(24, demo) + resolve-account + payout save; withdraw 1000 -> processing TRF_demo_... -> paid after 9s, coins 25000->24000; fresh user checkout: initialize ACE-YEARLY ref -> verify -> isPro yearly proUntil +365d, re-verify idempotent, bogus ref 404, webhook 401 unsigned; admin queue lists 4 rows w/ refs. Browser: PRO chip on login, member card "lifetime crown", ₦ plans, perks grid (6), shop sections + 10 loaded images + hoodie dialog ₦25,000 + coming-soon toast, transparent theme violet recolor + pinned nav (mobile+desktop), payouts UI verify badge, sandbox checkout -> "Payment successful ♦" -> "yearly plan" member card, chat glass violet bubbles, admin payouts tab. Screenshots download/t16-*.png (6).
- Cleanup: scripts/cleanup-task16.ts removed checkout_test + reverted lucky_echo; dev.log clean.

Stage Summary:
- Transparent = black & white glass, purple is the only hue (incl. amber->violet sweep); brightness veil untouched.
- demo/password123 now experiences EVERYTHING: lifetime PRO, 25k coins, prefilled GTBank payout account.
- Money flows both ways on Paystack: PRO checkout (popup w/ keys, sandbox dialog without) and coin->₦1 bank payouts (resolve -> recipient -> transfer; webhook/verify idempotent). Add sk_test/pk_test keys in .env to go live — no code changes.
- Shop sells real products across AceWears/AceLaptops/AcePhones; perks live on the Premium page. Vendor URLs pending — one-line edit per store in src/lib/shops.ts (SHOPS[].url) when the links arrive.
- New testids: shop-page, shop-section-*, shop-name-*, shop-product-{shop}-{id}, shop-product-buy, shop-visit-{id}, perk-product-*, premium-plans, plan-upgrade-{id}, sandbox-checkout, sandbox-pay-button, sandbox-checkout-success, payout-bank, payout-verify, payout-save, payout-verified-badge, withdraw-button.

---
Task ID: 17
Agent: Super Z (main)
Task: Sign in/up button texts + broken login fix; transparent theme glass text-shadow; strong glass posts; hundreds of floating ace leaves (CSS + JS)

Work Log:
- Auth UX (auth-view.tsx): sign-in submit "Enter the tables" -> "Sign in", sign-up submit "Claim 250 free coins" -> "Sign up", register tab "Join ACE" -> "Sign up"; error clears on tab switch; username/email trimmed+lowercased on submit + helper line + autoCapitalize=none.
- Root-caused "buttons are not signing or logging me in": API + UI work in a normal browser (curl 200 + agent-browser login OK) — the failure is preview-webview environments that block third-party cookies AND localStorage, so the post-login session fetch returned user:null and bounced back to the auth screen. Defense in depth: (1) login/register now return the FULL SessionUser (new publicUser() in auth.ts) and the client setMe()s it directly — no dependent fetch, sign-in always visibly lands; (2) session-token.ts is now storage-tiered localStorage -> sessionStorage -> JS cookie (ace_client_token, read by getSessionUser) -> in-memory, so even fully-blocked clients keep the token for the page session; (3) username validation friction reduced.
- Transparent theme text glass (globals.css): html[data-theme='premium'] * gets a 3-layer white halo text-shadow (glass plate behind every glyph); .text-gradient-gold gets a pure-white through-glyph halo so the violet gradient reads backlit.
- Strong post glass: html[data-theme='premium'] article[data-post-id] (feed PostCard root) -> 1px white rim + inset light lines + 3-stage deep drop shadow + blur(26px) saturate(1.35).
- ACE leaves (NEW src/components/ace/ace-leaves.tsx): 160 leaves desktop / 120 mobile generated by JS (random type/size/color/timing) + CSS-keyframes-only animation; splits into TWO portals on <body>: 62% at z -1 (behind app — frosted cards blur them, depth through glass) and 38% at z 30 (clearly visible above content, opacity capped 0.6, below z-40 header / z-50 bottom nav / z-60 drawer / z-90 toasts). Rise = ace-leaf-rise 11-26s linear infinite with NEGATIVE delays (sky already full at mount), sway = 3 keyframe flavors (a/b/c) with --sway amplitude; 5 leaf types: oval, petal, willow, ace-leaf--spade (brand silhouette, clip-path) and maple (jagged clip-path); 10-color palette: pure white, black, charcoal, silver, magenta, magenta-white, pale-magenta, violet, white-violet, black-violet, each with matching glow. AceLeaves watches html[data-theme] via MutationObserver and mounts from AceApp (works on auth screen too). theme.ts premium hint -> "PRO black & white glass — floating ace leaves".
- DEV-INFRA: this session the turbopack persistent cache went HARD stale — new globals.css rules were missing from the served chunk even after `next dev` restart; the reliable fix is `pkill -f next; rm -rf .next; devup.sh`. Do a cache nuke after every globals.css edit before trusting computed styles.
- Verify (curl): login/register return full 16-field user (isPro true for demo).
- Verify (agent-browser): auth page shows Sign in/Sign up texts; UI sign-UP created glass_tester and landed in-app; log out; UI sign-IN as demo landed in-app with token stored; Themes -> Transparent: theme=premium, 120 leaves mobile (74 back z-1 / 46 front z-30) + 160 desktop (99/61), all 5 shapes + mixed colors present, ace-leaf-rise running (leaf moved y 233->96 in 2s), front leaves visibly drift OVER posts while nav/header stay clear; post border 1px white 0.92 + 5-layer shadow computed; text-shadow live; dark theme probe -> 0 leaves + no text-shadow (observer cleanup works); bottom nav pinned mobile+desktop; screenshots download/t17-glass-feed-mobile.png, t17-glass-feed-scrolled.png, t17-glass-feed-desktop.png.
- tsc: only the 4 pre-existing api-route errors remain; dev.log clean.

Stage Summary:
- Auth pages say "Sign in"/"Sign up" and sign-in/sign-up now work even in cookie+storage-blocked preview browsers (direct login + 4-tier token persistence).
- Transparent theme: every glyph sits on a glass halo, feed posts are thick floating glass panes, and 120-160 uniquely-shaped ace leaves (white/black/magenta-white/violet...) rise through the app in two depth layers, CSS-animated, JS-generated.
- Remember: rm -rf .next after globals.css edits in this sandbox or computed styles lie.

---
Task ID: 18
Agent: Super Z (main)
Task: Floating aces reshaped — ONLY the four card suits (Ace of Spades / Hearts / Diamonds / Clubs), pink petal colors added

Work Log:
- User refinement of Task 17's leaves: "let the shapes be: pink petals Ace of Spades, Ace of Hearts, Ace of Diamonds, and Ace of Clubs only" — leaf silhouettes (oval/petal/willow/spade/maple) are OUT; only the four playing-card aces remain.
- ace-leaves.tsx rewritten: each ace is now a crisp inline-SVG <svg viewBox="0 0 100 100"><path/></svg> — SUIT_PATHS holds one path per suit (club = single path with 3 arc lobes + flare stem); classes ace-suit--spades|hearts|diamonds|clubs mark suits for E2E. Same animation architecture kept: 160 desktop / 120 mobile aces, 62% back layer z -1 + 38% front z 30, ace-leaf-rise 11-26s with negative delays, 3 sway flavors, glow via SVG drop-shadow.
- Palette extended with the PINK PETAL family: grad-pink-petal (#ffe3f1→#ff8fc4), grad-rose-pink (#ffb7d9→#ff5fa8), grad-pink-white (#ffffff→#ffb7d9) — alongside pure white, black, charcoal, silver, magenta family, violet (the purple tip), white-violet, black-violet (13 unique colors). 10 shared <linearGradient> defs rendered once and referenced by fill="url(#…)".
- globals.css: removed the 5 clip-path/border-radius leaf-shape rules; .ace-leaf now just display:block, .ace-suit--* sets overflow:visible so the glow isn't clipped; section comment updated to "ACE suit cards".
- theme.ts premium hint -> "PRO black & white glass — floating aces ♠ ♥ ♦ ♣".
- Dropped the redundant mounted flag in AceLeaves (themeActive already false on server+client first render) — component now lint-clean (bunx eslint ace-leaves.tsx exit 0; the 6 remaining project lint errors are the pre-existing set-state-in-effect patterns).
- DEV-INFRA: cache nuke per Task 17 lesson — pkill next + rm -rf .next + devup.sh after the globals.css edit.
- Verify (agent-browser, demo login): theme=premium -> 2 layers, 160 aces, bySuit {spades 38, hearts 43, diamonds 41, clubs 38} — ONLY the four suits; fills include all 3 pink petal gradients + white/black/violet family; a leaf moved y 519->330 in 2s (rising); premium text glass-shadow live; feed post border 1px lab(100 0 0 / 0.92) + blur(26px) saturate(1.35); Dark theme via theme-card-dark button -> 0 aces 0 layers (observer cleanup); Transparent restored. Auth page still "Sign in"/"Sign up". No console errors, dev.log all 200s. Screenshots download/t18-aces-suits-feed-desktop.png + t18-aces-suits-feed-mobile.png.
- Zip refreshed per the standing "give me the zip" request: download/ace-social-app.zip rebuilt (339 files, 4.2MB, ace-social-app/ prefix) — excludes node_modules/.next/.git/download/work/upload/tests/skills/examples; includes db/custom.db (demo = lifetime PRO) + public/uploads + .env; verified new SUIT_PATHS code inside.

Stage Summary:
- Transparent theme's living backdrop is now exactly the four ACES — Spades, Hearts, Diamonds, Clubs — rising through the glass in pink petal / white / black / magenta / violet uniqueness, sizes 9-40px, CSS-keyframes-only motion, JS-generated.
- Fresh upload-ready source zip: download/ace-social-app.zip.

---
Task ID: 19
Agent: Super Z (main)
Task: Aces background-only — remove the front layer that floated suits over content

Work Log:
- User: "the ace animation is displaying over all elements, i want it to be displaying at the background only" — Task 17/18 had TWO layers (62% back z -1 + 38% front z 30 drifting OVER posts); the front subset is now gone.
- ace-leaves.tsx: single background layer only — removed the front portal, the split/back/front slicing and the front opacity cap; every one of the 160 (120 mobile) aces now lives in the one fixed z -1 layer (above the aurora, below all app content, frosted cards blur them). Header comment updated.
- globals.css: deleted .ace-leaf-layer--front { z-index: 30 } rule.
- Cache nuke (pkill next + rm -rf .next + devup.sh) after the CSS edit; bunx eslint ace-leaves.tsx exit 0.
- Verify (agent-browser, demo login after hydration-warm retry — note: eval clicking text 'Sign in' hits the TAB not the submit button; use form button[type=submit]): theme=premium -> layers=1 zIndex=[-1], frontLayers=0, aces=160, elementFromPoint(720,300)=app element (nothing ace on top); screenshots t19-aces-background-only-desktop.png + -mobile.png show suits only around/behind the glass, never over posts; Dark theme -> 0 aces 0 layers; no console errors; dev.log all 200s.
- download/ace-social-app.zip rebuilt (4.2MB-class source zip, ace-social-app/ prefix) — zero ace-leaf-layer--front refs inside.

Stage Summary:
- The four floating aces are strictly backdrop now: they rise behind every element, get frosted-blurred under glass cards, and never overlap posts/text/nav.

---
Task ID: 20
Agent: Super Z (main)
Task: Aces over/behind TEXT only — never over images and videos

Work Log:
- User: "i want the animation to be displaying over or behind text but not over images and videos" — after Task 19 went background-only, this restores a front subset for over-text liveliness while adding media protection.
- ace-leaves.tsx: front layer back (38% of aces, z 30, under header/nav/drawer/toasts); background layer unchanged (62% at z -1 = "behind text" + frosted blur). NEW MediaAvoidance component: requestAnimationFrame loop throttled to ~8 Hz — READ phase collects every rendered img/video rect (document.querySelectorAll('img, video'), skipping <2px), classifies each front ace by center-point hit test; WRITE phase toggles .ace-avoid-media only on changed elements (batched reads->writes, no layout thrash). Hidden via CSS visibility:hidden (paint-skip, no layout impact). Cleanup on theme switch cancels the rAF.
- globals.css: .ace-leaf-layer--front { z-index: 30 } restored + .ace-leaf-fall.ace-avoid-media { visibility: hidden }.
- Cache nuke + devup; bunx eslint ace-leaves.tsx exit 0.
- Verify (agent-browser, demo login via form button[type=submit]): layers=2 zIndex=[-1,30], 160 aces (99 back / 61 front); front 61 -> 50 visible over text, 11 auto-hidden over media, VIOLATIONS=0 (17 media els); after scroll 900px VIOLATIONS still 0 (loop recomputes rects each tick); screenshots t20-aces-over-text-not-media.png (big post image completely clean, suits over sidebar text + background) + t20-aces-mobile.png; Dark theme -> 0 aces 0 layers; no console errors.
- download/ace-social-app.zip rebuilt with the MediaAvoidance code inside.

Stage Summary:
- Aces now sandwich the text layer: behind it (z -1, frosted) AND a lively subset over it (z 30) — while any ace crossing a photo/video/reel hides itself within ~125ms. Media stays pixel-clean everywhere, including after scroll and on Reels (fullscreen video -> all front aces tucked away).

---
Task ID: 21
Agent: Super Z (main)
Task: Petal realism pass — aces now dominated by pink petals with white gradients

Work Log:
- User: "let the animation be more of pink petals with white gradient that makes it look real" — shapes stay the four card suits; the COLOR story flips to petal-pink dominance with realistic lighting.
- ace-leaves.tsx palette rebuilt: 6 realistic multi-stop PETAL gradients (sakura #fff6fa→#ffc2dc→#ff8fbf, blush, rose, hot-pink, peony, cotton — deep pink edge → soft pink mid → near-white base, like light through a real petal), each weighted ×2 in ACE_COLORS so ~75% of aces are pink petals; rare accents kept: pure white, magenta-white, violet (the purple tip), black. GradientDefs now renders multi-stop <stop> arrays; old 2-stop entries pruned to what's referenced.
- REALISM: every ace gets a second SVG path overlay filled with a shared radial 'grad-petal-sheen' (white 0.75 → 0.2 → 0, centered 30%/22%) — a glossy light-catch that makes the gradients read as real petals, not flat fills. Rosy drop-shadow glows matched per petal.
- Cache nuke + devup; eslint clean.
- Verify (agent-browser, demo login, Transparent on Feed): 160 aces -> 125 pink-petal fills (78%) + 35 accents; 160/160 sheen overlays; all 6 petal gradients + sheen present in defs; front layer 61 with 7 auto-hidden over media (avoidance still live); Dark theme -> 0 aces; restored Transparent. Screenshots t21-pink-petal-aces-desktop.png + -mobile.png — petals clearly pink→white with sheen, post image clean.
- download/ace-social-app.zip rebuilt with the petal palette.

Stage Summary:
- The glass backdrop now reads as a drift of real pink petals: ~3 of 4 aces are sakura/blush/rose/hot/peony/cotton pink→white gradients with a glossy sheen, rare white/violet/black aces as accents — still strictly over/behind text only, never over media.

---
Task ID: 22
Agent: Super Z (main)
Task: 3D glass-gradient treatment for ALL buttons

Work Log:
- User: "give all button a 3d gradient transparent effect".
- Surveyed usage first: 21x amber gradient CTAs (bg-gradient-to-r from-amber-400 to-amber-600) + 1 emerald gradient, variant classes bg-primary/secondary/destructive/background, native buttons with bg-black/40, bg-muted, bg-card, ghost icon buttons; no variant="link" usage.
- globals.css: appended UN-layered "3D glass gem" section (un-layered CSS beats Tailwind @layer utilities, so hover tints / utility focus rings / shadow-xs are intentionally retired and rebuilt):
  * base button,[data-slot=button]: 1px white lip border, bevel box-shadow stack (inset top white 42% + inset bottom dark 15% + inset ring + contact + float drop), backdrop-filter blur(9px) saturate(1.35), transition on transform/box-shadow/filter/background-color/border-color.
  * vertical sheen background-image (white->dark) via :not([class*='bg-gradient-']):not([class*='bg-linear-']) so brand gradient CTAs keep their utility gradient (they still get bevel+shadows+lift).
  * translucent fills: button.bg-primary -> color-mix(in srgb, var(--primary) 85%, transparent), secondary 76%, destructive 85%, background(outline) 62%.
  * hover: translateY(-1px) + brightness(1.06) + taller float shadow; :active: translateY(1px) scale(.98) + pressed inset shadows; focus-visible: ring rebuilt as 3px color-mix ring in the same shadow stack; disabled: flat glass (opacity-50 utility still dims).
  * light theme: dark hairline border (white lip invisible on daylight glass) + stronger white sheen; premium: white/55 lip, blur(14px) saturate(1.45), brighter inset lip.
- GOTCHA for future: lightningcss minifies oklch -> lab/#hex fallbacks and wraps color-mix in @supports(color:color-mix(in lab,red,red)) — grepping the served CSS for the raw source text fails (declarations are on separate lines + duplicated as fallback pairs). Verify with getComputedStyle, not source grep. Also: className.includes('bg-primary') substring-matches hover:bg-primary/90 — use classList.contains.
- Cache nuke + devup. Verify (agent-browser, demo login via form button[type=submit]): bg-secondary computed color(srgb .10 .10 .13 / .76) translucent ✓, ghost blur+sheen+lip ✓, gradient CTA keeps amber gradient + blur(14px premium) + inset lip ✓, hover lift matrix(1,0,0,1,0,-1) + 10px float ✓, premium buttons white/55 lip + blur(14px) ✓, aces 160 + front 61 + 4 auto-hidden over 17 media els (avoidance intact) ✓, zero console errors.
- Screenshots: t22-buttons-3d-glass-{premium-desktop,premium-mobile,light-desktop,dark-desktop}.png — all buttons render as raised glass pills in every theme; gradient CTAs keep brand gradients; media stays clean.
- download/ace-social-app.zip rebuilt (339 files).

Stage Summary:
- Every button in the app — nav items, CTAs, icon buttons, chips, tabs, dialog actions — is now a translucent 3D glass gem: gradient sheen for volume, inset light lip + inner shade for the bevel, float shadow for lift, hover rise and press-down feedback, theme-aware in light/dark/purple/premium. Brand gradient CTAs keep their amber/emerald gradients with the same 3D treatment.
