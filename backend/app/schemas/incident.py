from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.incident import IncidentStatus

class IncidentResponse(BaseModel):
    id:           UUID
    server_name:  str
    title:        str
    description:  Optional[str]
    ai_analysis:  Optional[str]
    action_taken: Optional[str]
    status:       IncidentStatus
    created_at:   datetime
    resolved_at:  Optional[datetime]

    class Config:
        from_attributes = True

class ResolveRequest(BaseModel):
    action_taken: Optional[str] = None
