# MsgNexus.AI

**Unify all your messaging • Semantic search anywhere • AI that spots bills, subs & shopping automatically**

Phase 1 MVP — unified inbox demo with Postgres-backed persistence.

## Features
- **Unified Inbox** — Messages from WhatsApp, Email, Slack, SMS, Telegram, X, and Discord in one feed. Real OAuth/webhook connectors when env is configured (iMessage planned).
- **Smart Semantic Search** — Type natural queries like "netflix", "rent due", "amazon order", or "$15". Uses a local hybrid keyword + concept-vector engine (no external AI API keys).
- **Local AI Parser** — One-click (or bulk) analysis that extracts:
  - Category (subscription / bill / shopping / other)
  - Amount, vendor, due date, recurring flag
  - Human-readable summary + entities
- **Pulse Dashboard** — Live aggregates: monthly recurring spend, upcoming bills total, subscription list. Switch between Inbox ↔ Pulse.
- **Sync + export** — Incremental connector sync with OAuth token refresh, export JSON, clear data.
- **Multi-account support** — Connect multiple accounts per platform (e.g. two Gmails, two phone numbers).
- **Magic link auth** — Passwordless email sign-in (Resend in production, dev link locally).
- **Admin portal** — Users, billing, connections, audit, API keys, UserLens UX scans.

## Quick Start

```bash
git clone https://github.com/Chrismiller122580/msg-nexus-ai.git
cd msg-nexus-ai
npm install
cp .env.example .env.local
# Add your DATABASE_URL, then:
npm run db:push
npm run dev
```

Open http://localhost:3000.

### New user flow
1. **Homepage** (`/`) — Landing with hero and feature highlights
2. **Login** (`/login`) — Magic-link email sign-in
3. **Settings** (`/settings`) — Connect messaging apps and billing
4. **Inbox** (`/inbox`) — Unified feed filtered to your connected platforms

Keyboard shortcuts: `/` focuses search, `Esc` closes panels/modals.

See [SETUP.md](SETUP.md) for more.

## Architecture (Phase 1)
- Next.js 16 (App Router) + TypeScript + Tailwind
- Server Actions + Drizzle ORM with Neon Postgres (Vercel Postgres)
- Cookie-based sessions (`lib/session.ts`)
- Pure TypeScript modules:
  - `lib/ai-parser.ts` — rule-based + dictionary heuristic parser
  - `lib/semantic-search.ts` — tiny concept embeddings + cosine + keyword boost
  - `lib/seed-data.ts` + platforms registry
- Data (users, connected accounts, messages, AI insights) stored in Postgres

## Deployment (Vercel + Neon Postgres)

1. **Push your code** to GitHub.

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com), import your GitHub repo.
   - Vercel will detect Next.js automatically.

3. **Add Database**:
   - In your Vercel project dashboard → **Storage** tab.
   - Click **Create Database** → **Postgres** (powered by Neon).
   - This automatically sets `DATABASE_URL` as an environment variable for Preview + Production.

4. **Set up the database schema**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your DATABASE_URL
   npm run db:push
   ```
   This creates all tables (`users`, `magic_links`, `gmail_connections`, `messages`, `insights`, etc.). Vercel runs this automatically via `vercel-build`.

5. **Deploy** — push to GitHub or trigger deploy in Vercel.

**Environment variables** (see `.env.example`):
- `DATABASE_URL` — required
- `NEXT_PUBLIC_APP_URL` — production URL for magic links & OAuth
- `RESEND_API_KEY` — optional, sends magic link emails
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional, enables Gmail sync in `/settings`

**Notes**:
- Multiple accounts per platform are fully supported and displayed in the inbox sidebar.
- Sessions use secure httpOnly cookies.
- Gmail OAuth redirect URI: `{NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`

See `drizzle.config.ts` and `db/` for DB config.

## UserLens (UX Auditor)

Admin portal at **`/admin/userlens`** — live site scans (smoke, axe a11y, Lighthouse desktop/mobile), UX score trends, and one-click **Composer fix** export.

```bash
# Terminal 1 — main app
npm run dev

# Terminal 2 — scanner service
cd userlens-tester && npm run dev -- -p 3001
```

See [docs/USERLENS.md](docs/USERLENS.md) for full setup and deployment.

## Next Steps (Roadmap)
See [ROADMAP.md](ROADMAP.md) and [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

Built with ❤️ as a powerful personal AI messaging & finance command center.

---

**Phase 1 status: ✅ Shipped** — clone, run with DB, enjoy. Deployed on Vercel with Postgres.