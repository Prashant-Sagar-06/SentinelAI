from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.incident import IncidentResponse, ResolveRequest
from app.services.incident_service import list_incidents, get_incident, resolve_incident

router = APIRouter()

@router.get("/", response_model=list[IncidentResponse])
async def get_incidents(
    status: Optional[str] = None,
    current_user: User    = Depends(get_current_user),
    db: AsyncSession      = Depends(get_db)
):
    return await list_incidents(db, str(current_user.id), status)

@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_one(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession   = Depends(get_db)
):
    incident = await get_incident(db, str(current_user.id), incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.patch("/{incident_id}/resolve", response_model=IncidentResponse)
async def resolve(
    incident_id: str,
    body: ResolveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession   = Depends(get_db)
):
    incident = await get_incident(db, str(current_user.id), incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return await resolve_incident(db, incident, body.action_taken)
