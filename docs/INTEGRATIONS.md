# Top 25 + Integration Ideas

> **Current status:** Gmail, Outlook, Twilio SMS, Slack, Discord, Telegram, WhatsApp, and X have real connector code paths (OAuth/webhook/sync) when env vars are set. iMessage remains simulated. All platforms also support demo seed data for onboarding.

## Messaging & Communication (Core)
1. WhatsApp — Business API or WhatsApp Web bridge
2. iMessage / SMS — via MacOS relay, or Twilio / carrier APIs
3. Telegram — Bot API + personal chats
4. Signal — (limited; research Signal CLI / Desktop bridge)
5. Discord — Bot or user token (guild + DMs)
6. Slack — Slack API (channels + DMs)
7. Microsoft Teams — Graph API
8. X / Twitter DMs — Twitter API v2
9. Instagram DMs — Meta Graph / Instagram Basic Display (restricted)
10. Facebook Messenger — Meta Graph API

## Email
11. Gmail — Gmail API + Pub/Sub push
12. Outlook / Microsoft 365 — Microsoft Graph
13. IMAP (generic) — any self-hosted or corporate mail
14. Apple Mail (via iCloud IMAP or local bridge)

## Productivity & Finance
15. Notion — Notion API (comments + page updates)
16. Linear / Jira — issue comments & updates
17. GitHub — notifications + PR/issue comments
18. Stripe / billing emails — webhooks or parsed inbound
19. Banking / credit card alerts — via Plaid or email parsing (with user consent)
20. Venmo / Cash App / PayPal — transaction webhooks or email receipts

## Others
21. Calendar invites (Google Calendar / iCloud) — parse meeting + cost mentions
22. Shopping receipts (Amazon, Shopify stores) — email + order APIs
23. Food delivery (DoorDash, Uber Eats) — order confirmations
24. Utilities & SaaS bills (PG&E, Comcast, Adobe, etc.) — email + account portals
25. Internal company chat / forums

## Integration Architecture (Future)
We will introduce a clean `Connector` interface:

```ts
interface Connector {
  id: string;
  name: string;
  connect(): Promise<void>;
  fetchMessages(since?: Date): Promise<Message[]>;
  // + webhooks, incremental sync, auth refresh, etc.
}
```

Each platform will live in `lib/connectors/`. The UI already uses a platform registry that can be extended without touching the rest of the app.

See [ROADMAP.md](../ROADMAP.md) for timing.

Phase 1 proves the value with perfect local simulation + AI so the product feels alive immediately. Real connectors are the logical next layer.
