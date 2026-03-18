# SentinelAI

AI-powered security intelligence & threat detection platform.

## Docs

- Architecture: `ARCHITECTURE.md`
- API reference: `API.md`
- Deployment: `DEPLOYMENT.md`

## Local Development (Docker)

1. Copy env template:
   - `copy .env.example .env`
2. Start everything:
   - `docker compose up --build`
3. URLs:
   - Backend API: http://localhost:4000
   - AI Engine: http://localhost:8000
   - Frontend: http://localhost:3000

## End-to-End Verification

With the stack running (`docker compose up --build`), run:

- `node scripts/verify-e2e.js`

Or via npm:

- `npm run verify:e2e`

If you see an npm stdin error in PowerShell, run it via cmd:

- `cmd /c "npm run verify:e2e"`

## Services

- `services/backend-api` — Node.js + Express API (auth, ingest, alerts)
- `services/worker` — Node.js worker (queue → AI → persist → alerts)
- `services/ai-engine` — Python + FastAPI (anomaly + risk scoring + threat detection)
- MongoDB + Redis via docker-compose
