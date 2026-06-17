# Roadmap

## ✅ Phase 1: Core unification and basic AI parser (Shipped)
- Unified inbox UI across 8 simulated platforms
- Local semantic search (hybrid vector + keyword, pure client-side)
- Local deterministic AI parser for bills, subscriptions, shopping (amounts, vendors, due dates, recurring)
- Pulse dashboard with live aggregates & summaries
- Add simulated messages, bulk + per-message analysis, filters, full export/import/reset
- Self-contained Next.js app, zero backend or keys required

## Phase 2: Full 25 platforms
- Expand platform registry + realistic seed variety
- Real connector interfaces (stubs + examples):
  - WhatsApp (Business API or web bridge)
  - Gmail / Outlook (IMAP or Gmail API)
  - Slack, Discord, Telegram, SMS (Twilio), etc.
- Background sync simulation or webhook receivers
- Threading & deduplication

## Phase 3: Polished app + intelligence
- Optional real LLM calls (xAI / local via Ollama) to improve parser + summaries
- “Ask MsgNexus” RAG chat over your messages
- Reminders, calendar export, rules engine (“auto-hide Amazon orders under $20”)
- Multi-account & cloud sync option (opt-in)
- Beautiful mobile experience + PWA
- Onboarding, settings, themes, keyboard power-user features
- Tests, CI, production deployment examples

Contributions and ideas welcome! Start by running the Phase 1 demo and opening an issue.
