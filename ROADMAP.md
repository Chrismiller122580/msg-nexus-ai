# Roadmap

## Phase 1: Core unification and basic AI parser (Shipped)
- Unified inbox UI across 8 platforms
- Local semantic search (hybrid vector + keyword)
- Local deterministic AI parser for bills, subscriptions, shopping
- Pulse dashboard with live aggregates and summaries
- Add simulated messages, bulk + per-message analysis, filters, export/import/reset
- Postgres persistence, magic link auth, multi-account onboarding

## Phase 2: Real platform connectors (In progress)
- **Shipped:** Gmail, Outlook, Twilio SMS (send + webhook + sync), Slack, Discord, Telegram, WhatsApp, X
- **Shipped:** Admin portal, RBAC, Stripe billing, public API v1, UserLens UX auditor
- **Shipped:** OAuth token refresh with reconnect errors; incremental sync via lastSyncedAt (Gmail/Outlook/Slack/Discord)
- **In progress:** Webhook automation, harder sync limits, Gmail historyId cursors
- **Remaining:** iMessage (Mac relay), Teams, Signal, additional platforms from [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)
- Threading, stronger cross-platform deduplication

## Phase 3: Polished app + intelligence (Started)
- **Started:** Ask MsgNexus semantic Q&A panel in inbox
- **Started:** PWA manifest for mobile install
- **Shipped:** Mobile UI for user inbox/settings and admin drawer nav
- Optional real LLM calls (xAI / Ollama) to improve parser + summaries
- Full RAG chat over messages
- Reminders, calendar export, rules engine
- CI + broader integration tests

Contributions welcome — run the app with `npm run dev` and open an issue.