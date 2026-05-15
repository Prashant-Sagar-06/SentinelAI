from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database import Base
import uuid
import enum

class IncidentStatus(str, enum.Enum):
    open     = "open"
    resolved = "resolved"
    ignored  = "ignored"

class Incident(Base):
    __tablename__ = "incidents"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    server_name = Column(String, nullable=False)

    title       = Column(String, nullable=False)   # e.g. "High CPU usage detected"
    description = Column(Text)                     # raw detail
    ai_analysis = Column(Text)                     # Grok explanation
    action_taken= Column(Text)                     # what self-healing did

    status      = Column(Enum(IncidentStatus), default=IncidentStatus.open)
    created_at  = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)