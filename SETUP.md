# Setup

## Requirements
- Node.js 18+ (tested on 24)
- npm (or pnpm/yarn)
- Postgres `DATABASE_URL` — Neon (cloud) or local Docker (see below)

## Local Postgres (Docker)

```bash
npm run db:local:up
# In .env.local:
# DATABASE_URL="postgresql://codespace:codespace@127.0.0.1:5433/msgnexus"
npm run db:push
npm run dev
```

Stop with `npm run db:local:down`.

## GitHub Codespaces

After creating a new Codespace (or after a codespace move due to domain name change):

1. Run `npm install` — this ensures platform-specific native dependencies (e.g. Tailwind) match the new environment.
2. `cp .env.example .env.local`
3. Edit `.env.local` and set your `DATABASE_URL` (sign up for free at neon.tech if needed).
4. `npm run db:push`
5. `npm run dev`

The app **automatically detects** the correct public Codespaces URL (`https://<name>-<port>.app.github.dev`) for:
- Magic link sign-in URLs
- Gmail OAuth redirect/callback URLs

No need to set `NEXT_PUBLIC_APP_URL` manually in Codespaces.

Open the forwarded port URL from the **Ports** panel (or the browser preview). 

**Note:** The demo account and magic links (shown on screen in dev) work once the DB is connected.

## Run the app (Phase 1)

```bash
git clone https://github.com/Chrismiller122580/msg-nexus-ai.git
cd msg-nexus-ai

npm install
cp .env.example .env.local
# Add your DATABASE_URL, then:
npm run db:push
npm run dev
```

Open **http://localhost:3000**

The app will:
- Create your user on first login
- Seed 12 demo messages on first inbox visit (per user)
- Store everything in Postgres via server actions

## Common commands

| Command       | Description                    |
|---------------|--------------------------------|
| `npm run dev` | Start development server       |
| `npm run build` | Production build (verifies)  |
| `npm run start` | Start from previous build   |
| `npm run lint` | Run ESLint                    |
| `npm run db:push` | Push schema to Neon       |

## Data
- Everything is stored in Postgres (users, accounts, messages, insights).
- Use the **Export** button (header) to download `msgnexus-export.json`.
- Use the **Import** button to load a previous export.
- **Reset to demo data** button restores the original seeds + partial pre-parses.
- Trash icon clears your data from the database.

## Twilio SMS Setup

For real inbound/outbound SMS (single-tenant — one Twilio number, one user):

1. **Twilio Console** — create or buy a phone number with SMS capability.
2. **Environment variables** in `.env.local` (or Vercel project settings):

   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+15551234567
   TWILIO_AUTO_REPLY=false
   ```

3. **Webhooks** — in Twilio Console → Phone Numbers → your number → Messaging:
   - "A message comes in" → **Webhook** → `POST` → `{NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
   - "Status callback" (optional) → `POST` → `{NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/status`
   - In Codespaces the URL is auto-detected; on Vercel set `NEXT_PUBLIC_APP_URL` to your production domain.

4. **App** — sign in → **Settings** → SMS (Twilio):
   - Enter the same E.164 number as `TWILIO_PHONE_NUMBER`
   - Click **Connect SMS (Twilio)** → **Sync**
   - Use **Send Test SMS** to verify outbound; text the Twilio number from your phone to verify inbound.

5. **Public API** (optional) — create an API key with `sms:send` scope in Admin → API Keys, then:

   ```bash
   curl -X POST "$APP_URL/api/v1/sms/send" \
     -H "Authorization: Bearer mnx_..." \
     -H "Content-Type: application/json" \
     -d '{"to":"+15559876543","message":"Hello from MsgNexus"}'
   ```

**Note:** With a single connected user, all inbound SMS to your Twilio number are assigned to that account. Multi-tenant routing is not supported in this setup.

## Troubleshooting
- Port already in use? `npm run dev -- -p 3001`
- Database errors? Verify `DATABASE_URL` and run `npm run db:push`.
- Login fails? Check Vercel/Neon env vars are set in production.

## Adding real AI later
The parser lives in `lib/ai-parser.ts` as a pure function. Swapping it for an API call to xAI / OpenAI / local LLM is a one-file change.

See the code comments for extension points.

## Production build
```bash
npm run build
npm run start
```

Enjoy the unified inbox + AI that spots your bills and subscriptions.