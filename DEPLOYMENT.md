# Deployment

This repo is designed to run as a multi-service stack.

## Local (Docker Compose)

1. Create a local env file:
   - Windows PowerShell: `copy .env.example .env`
   - Or manually create `.env` from `.env.example`

2. Build + start:
   - `docker compose up -d --build`

3. Verify:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000/health
   - AI Engine: http://localhost:8000/health

To stop:
- `docker compose down`

## Required environment variables

At minimum for docker-compose:

- `MONGO_URL` (e.g. `mongodb://mongo:27017/sentinelai`)
- `REDIS_URL` (e.g. `redis://redis:6379`)
- `BACKEND_PORT` (default `4000`)
- `JWT_SECRET` (set a strong value in real deployments)
- `CORS_ORIGIN` (frontend origin, e.g. `http://localhost:3000`)
- `INTERNAL_BROADCAST_SECRET` (required when `NODE_ENV=production`)
- `NEXT_PUBLIC_API_BASE_URL` (frontend → backend base URL)

Worker-specific:

- `AI_ENGINE_URL` (e.g. `http://ai-engine:8000`)
- `BACKEND_API_URL` (e.g. `http://backend-api:4000`)
- `ALERT_THRESHOLD_RISK` (e.g. `0.6`)

Copilot (optional):

- `COPILOT_PROVIDER` (`mock` | `openai` | `groq`)
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `GROQ_API_KEY`, `GROQ_MODEL`
- `COPILOT_RATE_LIMIT_PER_MINUTE`

## Production notes

- Do not commit `.env` (it is gitignored). Use a secrets manager or your platform’s env var injection.
- Rotate any API keys that have been pasted into local `.env` files.
- `INTERNAL_BROADCAST_SECRET` should be long and random; treat it like a credential.
