from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.incident import Incident, IncidentStatus
from datetime import datetime

async def list_incidents(db: AsyncSession, user_id: str, status: str = None):
    query = (
        select(Incident)
        .where(Incident.user_id == user_id)
        .order_by(desc(Incident.created_at))
    )
    if status:
        query = query.where(Incident.status == status)
    result = await db.execute(query)
    return result.scalars().all()

async def get_incident(db: AsyncSession, user_id: str, incident_id: str):
    result = await db.execute(
        select(Incident).where(
            Incident.id      == incident_id,
            Incident.user_id == user_id
        )
    )
    return result.scalar_one_or_none()

async def resolve_incident(db: AsyncSession, incident: Incident, action_taken: str = None):
    incident.status      = IncidentStatus.resolved
    incident.resolved_at = datetime.utcnow()
    if action_taken:
        incident.action_taken = action_taken
    await db.commit()
    await db.refresh(incident)
    return incident
