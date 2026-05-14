from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.incident import Incident, IncidentStatus
from app.models.metric import Metric
from app.schemas.ai import (
    AnalyzeRequest, ExplainLogRequest,
    ChatRequest, RecommendRequest, AIResponse
)
from app.services.ai_service import (
    analyze_incident, explain_logs, chat, recommend
)
from app.services.incident_service import get_incident

router = APIRouter()

@router.post("/analyze", response_model=AIResponse)
async def analyze(
    body: AnalyzeRequest,
    current_user: User   = Depends(get_current_user),
    db: AsyncSession     = Depends(get_db)
):
    incident = await get_incident(db, str(current_user.id), body.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    result = await analyze_incident(
        incident.title,
        incident.description or "",
        incident.server_name
    )

    # Save analysis back to the incident row
    incident.ai_analysis = result
    await db.commit()

    return {"result": result}

@router.post("/explain-log", response_model=AIResponse)
async def explain_log(
    body: ExplainLogRequest,
    current_user: User = Depends(get_current_user),
):
    result = await explain_logs(body.log_text, body.server_name)
    return {"result": result}

@router.post("/chat", response_model=AIResponse)
async def chat_endpoint(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    result = await chat(body.message, body.server_name)
    return {"result": result}

@router.post("/recommend", response_model=AIResponse)
async def recommendations(
    body: RecommendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession   = Depends(get_db)
):
    # Fetch averages from last 60 metric rows for this server
    result = await db.execute(
        select(
            func.avg(Metric.cpu_percent).label("cpu_avg"),
            func.avg(Metric.memory_percent).label("memory_avg"),
            func.avg(Metric.disk_percent).label("disk_avg"),
        ).where(
            Metric.user_id     == current_user.id,
            Metric.server_name == body.server_name
        )
    )
    row = result.one()

    # Count open incidents for this server
    inc_result = await db.execute(
        select(func.count()).where(
            Incident.user_id     == current_user.id,
            Incident.server_name == body.server_name,
            Incident.status      == IncidentStatus.open
        )
    )
    incident_count = inc_result.scalar()

    ai_result = await recommend(
        body.server_name,
        row.cpu_avg    or 0.0,
        row.memory_avg or 0.0,
        row.disk_avg   or 0.0,
        incident_count or 0
    )
    return {"result": ai_result}
