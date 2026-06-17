# MsgNexus.AI Setup Guide

## Prerequisites

- Node.js 18+
- A Neon Postgres database
- Google Cloud Console project (for Gmail OAuth)
- OpenAI API key

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in all required environment variables

### Database Setup (Neon)

1. Create a Neon project at https://neon.tech
2. Copy the connection string to `DATABASE_URL`
3. Run migrations: `npm run db:migrate`

### Google OAuth Setup

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Secret to `.env.local`

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deployment

Deploy to Vercel with environment variables configured.
