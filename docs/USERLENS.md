# UserLens — AI UX Auditor

Test any live website from the real user perspective → get actionable reports → one-click fixes for Cursor Composer.

UserLens is integrated into MsgNexus Admin at **`/admin/userlens`**.

## Features

- **Live site analysis** — Paste any URL (especially Vercel deployments) for smoke, accessibility, and Lighthouse scans
- **Multi-device simulation** — Desktop + mobile Lighthouse journeys in a full scan
- **UX score** — Composite 0–100 score with trend chart across scan history
- **Composer-ready fixes** — One-click copy of prioritized fix instructions for Cursor Composer
- **Admin portal** — Overview cards, history table, re-test, and detailed run breakdown
- **Secure** — Role-based access (`userlens.read` / `userlens.write` permissions)

## Quick Start

### 1. Main app (MsgNexus)

```bash
npm install
cp .env.example .env.local
# Set DATABASE_URL, then:
npm run db:push
npm run dev
```

Open http://localhost:3000/admin/userlens (sign in as an admin user).

### 2. UserLens tester service

The scanner runs as a separate Next.js service (Playwright + axe-core + Lighthouse):

```bash
cd userlens-tester
npm install
npx playwright install chromium
npm run dev -- -p 3001
```

Set in `.env.local`:

```bash
USERLENS_SERVICE_URL="http://localhost:3001"
```

## Admin portal

| Section | Description |
|---------|-------------|
| Overview | Avg UX score, critical issues, last tested, service health |
| Trend chart | UX score over recent scans |
| Analyze | URL input + presets (full, smoke, a11y, desktop, mobile) |
| History | Past runs with Composer export and re-test |
| Details | Per-run scores, fix instructions, raw JSON |

Demo admin access: set `ADMIN_EMAILS` in `.env.local` and sign in with that email.

## Deploy on Vercel

1. Deploy **msg-nexus-ai** to Vercel with Neon Postgres (`DATABASE_URL`).
2. Deploy **userlens-tester** as a separate Vercel project (or run on a VM with Chrome).
3. Set `USERLENS_SERVICE_URL` on the main app to the tester service URL.

> Lighthouse requires Chrome/Chromium. For serverless, consider a dedicated Node runtime or container with Playwright browsers installed.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `USERLENS_SERVICE_URL` | Yes (for scans) | Base URL of userlens-tester (default `http://localhost:3001`) |
| `DATABASE_URL` | Yes | Stores scan history in `userlens_runs` |
| `ADMIN_EMAILS` | Recommended | Comma-separated emails promoted to admin |

## Architecture

```
Admin UI (/admin/userlens)
    → Server Actions (app/actions/admin/userlens.ts)
    → lib/userlens/client.ts (HTTP client)
    → userlens-tester (/api/run, /api/health)
        → Playwright smoke + axe-core a11y
        → Lighthouse desktop + mobile
```

Built with Next.js 16, TypeScript, Drizzle ORM, and the same admin design system as MsgNexus.