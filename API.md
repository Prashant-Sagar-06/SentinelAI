# SentinelAI API

Base URL: `https://api.domain.com`

## Authentication

Most endpoints require a JWT:

- Header: `Authorization: Bearer <token>`

### Register

- `POST /api/auth/register`
- Body:
  - `email` (string, email)
  - `password` (string, min 8)
  - `role` (optional: `admin` | `analyst` | `viewer`)
- Response: `{ token, user: { id, email, role } }`

### Login

- `POST /api/auth/login`
- Body: `{ email, password }`
- Response: `{ token, user: { id, email, role } }`

### Current user

- `GET /api/auth/me` (requires JWT)
- Response: `{ user: { id, email, role } }`

## Health

No auth required.

- `GET /health` → `{ ok: true }`
- `GET /ready` → `{ mongo: boolean }` (200 when ready, 503 when not)

## Alerts

All routes require JWT.

### List alerts

- `GET /api/alerts`
- Query:
  - `limit` (1–200, default 50)
  - `cursor` (ISO datetime; returns items older than cursor)
  - `status` (string)
  - `severity` (string)
- Response: `{ items, nextCursor }`

### Get alert

- `GET /api/alerts/:id`
- Response: `{ alert }`

### Ack / Close alert

- `POST /api/alerts/:id/ack` (role: admin/analyst)
- `POST /api/alerts/:id/close` (role: admin/analyst)
- Response: `{ alert }`

## Incidents

All routes require JWT.

### List incidents

- `GET /api/incidents`
- Query:
  - `page` (>=1, default 1)
  - `limit` (1–100, default 20)
  - `status` (`open` | `investigating` | `resolved`)
  - `severity` (`low` | `medium` | `high` | `critical`)
- Response: `{ incidents, page, total }`

### Get incident

- `GET /api/incidents/:id`
- Response: `{ incident }` (includes populated `alerts`)

### Update incident

- `PATCH /api/incidents/:id` (role: admin/analyst)
- Body (any subset):
  - `status`: `open` | `investigating` | `resolved`
  - `severity`: `low` | `medium` | `high` | `critical`
  - `assigned_to`: string | null
  - `notes`: string | null
- Response: `{ incident }`

## Logs

All routes require JWT.

### Query logs

- `GET /api/logs`
- Query:
  - `page` (>=1, default 1)
  - `limit` (1–100, default 20)
  - `source`, `event_type`, `actor`, `ip`
  - `start_time`, `end_time` (ISO datetime)
- Response: `{ data, page, limit, total }`

### Ingest one event

- `POST /api/logs`
- Body: security event (validated; must include `timestamp`, `source`, `event_type`)
- Response: `{ event_id }`

### Ingest batch

- `POST /api/logs/batch`
- Body: `{ events: [...] }` (1–1000)
- Response: `{ event_ids }`

## Copilot

Requires JWT.

- `GET /api/copilot/explain/:alertId`
- Response:
  - `{ alert_id, analysis, evidence, recommended_actions }`

## Internal (worker-only)

Not protected by JWT; protected by `x-internal-secret`.

- `POST /internal/broadcast/alert`
- Header: `x-internal-secret: <INTERNAL_BROADCAST_SECRET>`
- Body: JSON object representing an alert-like payload
- Responses:
  - `503 { error: "internal_broadcast_disabled" }` if secret not configured
  - `401 { error: "unauthorized" }` if secret mismatch
  - `400 { error: "invalid_body" }` if body invalid
  - `200 { ok: true }`
