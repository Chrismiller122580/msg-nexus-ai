# Setup

## Requirements
- Node.js 18+ (tested on 24)
- npm (or pnpm/yarn)
- Neon Postgres `DATABASE_URL` (for full functionality)

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