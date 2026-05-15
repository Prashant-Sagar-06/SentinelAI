from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, get_current_api_key
from app.models.user import User, APIKey
from app.schemas.metric import MetricIngest, MetricResponse
from app.services.metric_service import (
    save_metric, cache_latest, get_cached_latest, get_history, check_anomalies
)

router = APIRouter()

# ── Agent calls this every N seconds ─────────────────────────────────
@router.post("/ingest", status_code=201)
async def ingest(
    data: MetricIngest,
    api_key: APIKey = Depends(get_current_api_key),
    db: AsyncSession = Depends(get_db)
):
    user_id = str(api_key.user_id)
    metric  = await save_metric(db, user_id, data)
    await cache_latest(user_id, data.server_name, data.model_dump())
    await check_anomalies(db, user_id, data)
    return {"status": "ok", "id": str(metric.id)}

# ── Dashboard: get latest snapshot ───────────────────────────────────
@router.get("/latest")
async def latest(
    server_name: str,
    current_user: User = Depends(get_current_user),
):
    data = await get_cached_latest(str(current_user.id), server_name)
    return data or {"status": "no data yet"}

# ── Dashboard: get last N data points for charts ─────────────────────
@router.get("/history", response_model=list[MetricResponse])
async def history(
    server_name: str,
    limit: int = 60,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_history(db, str(current_user.id), server_name, limit)