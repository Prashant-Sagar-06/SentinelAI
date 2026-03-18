# SentinelAI Architecture

SentinelAI is an AI-assisted SOC-style security detection and investigation stack.

## Components

- **Frontend** (`services/frontend`) — Next.js (Pages Router) UI for viewing alerts, incidents, logs, and the dashboard.
- **Backend API** (`services/backend-api`) — Node.js + Express API providing auth, logs ingestion, alerts/incidents APIs, and an internal broadcast hook for real-time updates.
- **Worker** (`services/worker`) — Node.js worker that pulls queued events, calls the AI engine, persists results, and broadcasts alert updates to the backend.
- **AI Engine** (`services/ai-engine`) — Python + FastAPI service that scores and classifies events.
- **MongoDB** — primary persistence for alerts, incidents, and log events.
- **Redis** — queue and coordination (BullMQ).

## Data Flow

1. **Ingest security events**
   - Client posts events to `POST /api/logs` (or `POST /api/logs/batch`).
   - Backend stores events in MongoDB and enqueues an `analyze_event` job in Redis.

2. **Analyze + generate alert signals**
   - Worker consumes jobs from Redis.
   - Worker calls AI engine `POST /analyze` for risk assessment.
   - Worker persists derived alerts/incidents back to MongoDB (via backend endpoints / models, depending on implementation).

3. **Realtime updates**
   - Worker calls the backend internal endpoint `POST /internal/broadcast/alert` with header `x-internal-secret`.
   - Backend emits a Socket.IO event to connected clients.

## Security Boundaries

- **User-facing API**: all `/api/*` endpoints (except health/ready) require a JWT (`Authorization: Bearer <token>`).
- **Internal broadcast**: `/internal/broadcast/alert` is intended for the worker only.
  - Disabled if `INTERNAL_BROADCAST_SECRET` is not configured.
  - Requires `x-internal-secret` to match `INTERNAL_BROADCAST_SECRET`.

## Ports (docker-compose)

- Frontend: `3000`
- Backend API: `4000`
- AI Engine: `8000`
- MongoDB: `27017`
- Redis: `6379`
