from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email      = Column(String, unique=True, nullable=False)
    password   = Column(String, nullable=False)           # bcrypt hashed
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    api_keys   = relationship("APIKey", back_populates="user", cascade="all, delete")

class APIKey(Base):
    __tablename__ = "api_keys"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key        = Column(String, unique=True, nullable=False)  # sent by agent in headers
    name       = Column(String, default="default")            # e.g. "prod-server-1"
    created_at = Column(DateTime, default=datetime.utcnow)

    user       = relationship("User", back_populates="api_keys")