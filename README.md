# Journal (changelog-saas)

Hosted changelog + embeddable "What's new" widget. A product owner writes release notes in a small Markdown subset
(drafts, scheduled dates, New / Improved / Fixed tags) and gets:

- a public page at `/c/<slug>` (tear-off calendar leaf per entry),
- an RSS feed at `/c/<slug>/rss.xml`,
- a widget: `<script src="https://YOUR-HOST/whatsnew.js" data-slug="<slug>" defer></script>` with an "unread" badge
  (remembered per browser), FR / EN / AR (RTL).

Stack: Next.js 16 + Tailwind 4 + TypeScript strict, SQLite via Node's built-in `node:sqlite` (Node 22.5+, developed on
Node 25). The widget is dependency-free vanilla JS in `public/whatsnew.js`.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3420
```

## Checks

```bash
npm run typecheck && npm run lint && npm test   # 29 tests: markdown, RSS, repo/ownership, public API, widget in jsdom
npm run build && npm start                      # then, in another terminal:
npm run smoke                                   # 20 end-to-end HTTP checks against the running server
```

## Security model

- **No HTML path.** Markdown is parsed into a data structure (blocks/inlines). React and the widget render it with text
  nodes and a fixed set of elements; raw HTML in the source stays literal text. Links are only kept for `http(s)`; `javascript:`,
  `data:` etc. degrade to plain text (server-side, and re-checked in the widget). Tested with hostile payloads, including in jsdom.
- **CORS**: the public API (`/api/public/<slug>/entries`) is read-only and cookie-free. Per project you may set an allow-list of
  sites (echoed origin + `Vary: Origin`, else 403); empty = `*`. Non-browser clients can fake `Origin`; it stops other _websites_ only.
  Drafts and future-dated entries are never returned.
- RSS output is XML-escaped (control chars stripped). Dashboard: scrypt passwords, hashed session tokens, httpOnly SameSite=Lax
  cookies, every write scoped by owner. Auth is rate limited (in memory, per IP). The limiter trusts `x-forwarded-for`: run behind a proxy that sets it.
- Customer sites with a strict CSP must allow `script-src` and `connect-src` for your host.

## Deploy

SQLite needs a persistent disk, so not Vercel serverless. VPS / Fly.io / Railway with a volume: `npm run build`, `npm start`,
set `DATABASE_PATH` (on the volume) and `NEXT_PUBLIC_SITE_URL`, HTTPS in front, back up the SQLite file.

## Not done yet

Stripe checkout (Pro = `users.plan`, UI shows "not configured"), email subscriptions to updates (RSS only), password reset,
custom domains for the hosted page, images in entries, project edit/delete, pagination of the public page (latest 100).
