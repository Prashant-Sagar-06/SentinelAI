from sqlalchemy import Column, Float, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database import Base
import uuid

class Metric(Base):
    __tablename__ = "metrics"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    server_name = Column(String, nullable=False)     # agent sends this

    # Core system stats
    cpu_percent    = Column(Float)
    memory_percent = Column(Float)
    disk_percent   = Column(Float)
    net_bytes_sent = Column(Float)
    net_bytes_recv = Column(Float)

    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)