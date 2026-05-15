from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: UUID
    email: str
    created_at: datetime

    class Config:
        from_attributes = True

class APIKeyResponse(BaseModel):
    id: UUID
    key: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

class APIKeyRequest(BaseModel):
    name: str = "default"