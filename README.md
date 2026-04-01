# SentinelAI

AI-powered security intelligence & threat detection platform.

## Docs

- Architecture: `ARCHITECTURE.md`
- API reference: `API.md`
- Deployment: `DEPLOYMENT.md`

## Local Development (Docker)

1. Copy env template:
   - `copy .env.example .env`
2. Deploy services (production):
   - Frontend (Vercel): https://app.domain.com
   - Backend API (Render/Railway): https://api.domain.com
   - AI Engine: https://ai.domain.com

## End-to-End Verification

With the deployed stack running, run:

- `node scripts/verify-e2e.js` (requires `API_BASE=https://api.domain.com`)

Or via npm:

- `npm run verify:e2e`

If you see an npm stdin error in PowerShell, run it via cmd:

- `cmd /c "npm run verify:e2e"`

## Services

- `services/backend-api` — Node.js + Express API (auth, ingest, alerts)
- `services/worker` — Node.js worker (queue → AI → persist → alerts)
- `services/ai-engine` — Python + FastAPI (anomaly + risk scoring + threat detection)
- MongoDB + Redis via docker-compose
