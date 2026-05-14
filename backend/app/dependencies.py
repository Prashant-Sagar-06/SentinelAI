from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth_service import decode_access_token, get_user_by_id, get_api_key
from app.models.user import User, APIKey

bearer_scheme  = HTTPBearer()
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)

# ── Protects dashboard routes (JWT) ──────────────────────────────────
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

# ── Protects agent routes (API Key) ──────────────────────────────────
async def get_current_api_key(
    key: str = Security(api_key_scheme),
    db: AsyncSession = Depends(get_db)
) -> APIKey:
    if not key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key missing")
    api_key = await get_api_key(db, key)
    if not api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
    return api_key