import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.metric import Metric
from app.models.incident import Incident, IncidentStatus
from app.schemas.metric import MetricIngest
from app.redis_client import get_redis
from datetime import datetime

# ── Thresholds — what counts as an anomaly ────────────────────────────
THRESHOLDS = {
    "cpu_percent":    85.0,
    "memory_percent": 90.0,
    "disk_percent":   90.0,
}

# ── Save metric to PostgreSQL ─────────────────────────────────────────
async def save_metric(db: AsyncSession, user_id: str, data: MetricIngest) -> Metric:
    metric = Metric(
        user_id        = user_id,
        server_name    = data.server_name,
        cpu_percent    = data.cpu_percent,
        memory_percent = data.memory_percent,
        disk_percent   = data.disk_percent,
        net_bytes_sent = data.net_bytes_sent,
        net_bytes_recv = data.net_bytes_recv,
        recorded_at    = data.recorded_at,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric

# ── Cache latest metric in Redis (for live dashboard) ─────────────────
async def cache_latest(user_id: str, server_name: str, data: dict):
    r = await get_redis()
    key = f"latest:{user_id}:{server_name}"
    await r.set(key, json.dumps(data, default=str), ex=60)  # expires in 60s

async def get_cached_latest(user_id: str, server_name: str) -> dict | None:
    r = await get_redis()
    key = f"latest:{user_id}:{server_name}"
    val = await r.get(key)
    return json.loads(val) if val else None

# ── Get metric history from DB ────────────────────────────────────────
async def get_history(db: AsyncSession, user_id: str, server_name: str, limit: int = 60):
    result = await db.execute(
        select(Metric)
        .where(Metric.user_id == user_id, Metric.server_name == server_name)
        .order_by(desc(Metric.recorded_at))
        .limit(limit)
    )
    return result.scalars().all()

# ── Check thresholds and create incident if breached ──────────────────
async def check_anomalies(db: AsyncSession, user_id: str, data: MetricIngest):
    for field, threshold in THRESHOLDS.items():
        value = getattr(data, field)
        if value >= threshold:
            title = f"High {field.replace('_', ' ').title()} detected"
            incident = Incident(
                user_id     = user_id,
                server_name = data.server_name,
                title       = title,
                description = f"{field} is at {value:.1f}% (threshold: {threshold}%)",
                status      = IncidentStatus.open,
            )
            db.add(incident)
    await db.commit()