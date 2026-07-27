# MsgNexus.AI

**Unify messaging · Spot bills & subscriptions · Cancel smarter**

One inbox for email, SMS, Slack, and more — with local AI that finds subscriptions and bills, a Pulse dashboard for spend, and step-by-step cancel guides for services that show up in your messages.

**Live:** [www.msgnexus.ai](https://www.msgnexus.ai)

## Features

### For users
- **Unified inbox** — Gmail, Outlook, Twilio SMS, Slack, Discord, Telegram, WhatsApp, and X when configured (iMessage planned)
- **Magic-link auth** — Passwordless sign-in via Resend (verified domain in production)
- **Local AI parser** — Extracts category (subscription / bill / shopping / other), amount, vendor, due date, recurring flag, and a short summary (no external AI keys required)
- **Semantic search + Ask** — Hybrid keyword + concept search; Ask panel returns top matching messages
- **Pulse dashboard** — Monthly recurring spend, upcoming bills, subscription list
- **Subscription cancel guides** — Vendor-specific cancel URLs and steps for Netflix, Spotify, Amazon, Apple, and more (generic guide for unknown vendors)
- **Settings** — Connect integrations, Sync all, Stripe billing (Pro / Enterprise when configured)
- **Export** — Download your messages and insights as JSON
- **SMS reply** — Reply to SMS when Twilio is connected
- **PWA-ready** — Installable manifest for mobile home-screen use

### For admins (`/admin`)
- Dashboard, users (roles / suspend), subscriptions, connections + force sync
- Audit log, analytics, API keys, outbound webhooks
- UserLens UX/a11y/Lighthouse scans (optional companion service)
- RBAC: `support`, `billing`, `admin` (bootstrap via `ADMIN_EMAILS`)

### Platform / API
- Public API v1: `GET /api/v1/messages`, `POST /api/v1/sms/send` (admin-issued API keys)
- Vercel cron sync every 6 hours (`/api/cron/sync`)
- OAuth token refresh with reconnect-friendly errors
- Integration status: `GET /api/auth/oauth-info`

## Quick start

```bash
git clone https://github.com/Chrismiller122580/msg-nexus-ai.git
cd msg-nexus-ai
npm install
cp .env.example .env.local
# Set DATABASE_URL (see below)
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local Postgres (Docker)

```bash
npm run db:local:up
# DATABASE_URL=postgresql://codespace:codespace@127.0.0.1:5433/msgnexus
npm run db:push
npm run dev
```

### New user flow
1. **`/`** — Landing  
2. **`/login`** — Magic-link sign-in  
3. **`/settings`** — Connect apps & billing  
4. **`/inbox`** — Feed, Ask, Pulse, cancel guides  

Keyboard: `/` focuses search · `Esc` closes panels  

More detail: [SETUP.md](SETUP.md)

## Architecture

| Layer | Stack |
|--------|--------|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 |
| Data | Drizzle ORM + Neon / Postgres |
| Auth | Magic links (Resend) + httpOnly session cookie |
| Billing | Stripe Checkout + Customer Portal + webhooks |
| AI (local) | `lib/ai-parser.ts`, `lib/semantic-search.ts`, `lib/subscription-cancel.ts` |
| Connectors | Per-platform modules under `lib/*` + `lib/connectors/sync-all.ts` |

```
OAuth / webhooks / cron
  → connector sync
  → ingest (dedupe) + parseMessage → insights
  → Inbox / Pulse / Admin / API v1
```

## Deploy (Vercel + Neon)

1. Import the GitHub repo in Vercel  
2. Add **Postgres** (Neon) via Storage — sets `DATABASE_URL` (or map `POSTGRES_URL_*`)  
3. Set env vars (minimum below)  
4. Deploy — `vercel-build` runs `db:push` then `build`  

### Required / recommended env

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (or Neon `POSTGRES_URL_*` — app resolves both) |
| `NEXT_PUBLIC_APP_URL` | Canonical URL, e.g. `https://www.msgnexus.ai` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Magic links (domain must be verified in Resend) |
| `ADMIN_EMAILS` | Comma-separated emails promoted to admin |

### Optional integrations

| Integration | Env vars | Redirect / webhook |
|-------------|----------|--------------------|
| Gmail | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `{APP_URL}/api/auth/gmail/callback` |
| Outlook | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | `{APP_URL}/api/auth/microsoft/callback` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | `{APP_URL}/api/auth/slack/callback` |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | `{APP_URL}/api/auth/discord/callback` |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | `{APP_URL}/api/auth/x/callback` |
| Twilio SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | `{APP_URL}/api/webhooks/twilio` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | `{APP_URL}/api/webhooks/telegram` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | `{APP_URL}/api/webhooks/whatsapp` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE` | `{APP_URL}/api/webhooks/stripe` |
| Cron | `CRON_SECRET` | Authorizes `/api/cron/sync` |

Full list: [`.env.example`](.env.example)

**OAuth tip:** Register redirect URIs for **both** `www` and apex if you use both hosts.  
**Gmail example:** `https://www.msgnexus.ai/api/auth/gmail/callback`

Live connector status (no secrets): [www.msgnexus.ai/api/auth/oauth-info](https://www.msgnexus.ai/api/auth/oauth-info)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run db:push` | Push Drizzle schema |
| `npm run db:local:up` / `db:local:down` | Local Docker Postgres |
| `npm run db:status` | Probe database connectivity |

## UserLens (optional)

Admin **`/admin/userlens`** runs UX/a11y/Lighthouse scans via a companion app:

```bash
# Terminal 1
npm run dev

# Terminal 2
cd userlens-tester && npm install && npx playwright install chromium
npm run dev -- -p 3001
```

Set `USERLENS_SERVICE_URL=http://localhost:3001`. See [docs/USERLENS.md](docs/USERLENS.md).

## Roadmap

| Phase | Status |
|-------|--------|
| **1** Core inbox, parser, search, Pulse, auth | Shipped |
| **2** Real connectors, admin, Stripe, API, token refresh | Shipped / hardening |
| **3** LLM/RAG Ask, reminders, rules, calendar, deeper CI | Started |

Details: [ROADMAP.md](ROADMAP.md) · [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)

## Project layout

```
app/                 # Next.js routes (inbox, settings, admin, API)
app/actions/         # Server actions (user + admin)
lib/                 # Auth, AI, connectors, Stripe, cancel guides
db/                  # Drizzle schema
docs/                # Integrations, UserLens
userlens-tester/     # Optional UX scanner service
tests/               # Unit tests
```

## License

Private / proprietary unless otherwise noted.

---

MsgNexus.AI — one place for messages, money signals, and cancel help.
