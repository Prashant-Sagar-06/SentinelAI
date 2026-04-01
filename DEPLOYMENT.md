# Deployment

This repo is designed to run as a multi-service stack.

## Local (Docker Compose)

1. Create a local env file:
   - Windows PowerShell: `copy .env.example .env`
   - Or manually create `.env` from `.env.example`

2. Build + start:
This document describes cloud deployment (public URLs only).

## Required environment variables

Backend API (Render/Railway)

- `PORT` (e.g. `4000`)
- `MONGO_URL` (MongoDB Atlas connection string, recommended `mongodb+srv://...`)
- `REDIS_URL` (Redis Cloud TLS URL, `rediss://...`)
- `JWT_SECRET`
- `AI_ENGINE_URL` (public URL, e.g. `https://ai.domain.com`)
- `INTERNAL_BROADCAST_SECRET`
- `CORS_ORIGIN` (frontend origin, e.g. `https://app.domain.com`)

Worker (Background Service)

- `REDIS_URL` (same Redis Cloud URL)
- `AI_ENGINE_URL` (public URL)
- `BACKEND_API_URL` (public URL)
- `INTERNAL_BROADCAST_SECRET` (same secret as backend)

Frontend (Vercel)

- `NEXT_PUBLIC_API_BASE_URL=https://api.domain.com`

AI Engine
- `PORT=8000`
- `CORS_ORIGIN=https://api.domain.com`

## Production notes

- Do not commit `.env` (it is gitignored). Use a secrets manager or your platform’s env var injection.
- Rotate any API keys that have been pasted into local `.env` files.
- `INTERNAL_BROADCAST_SECRET` should be long and random; treat it like a credential.
