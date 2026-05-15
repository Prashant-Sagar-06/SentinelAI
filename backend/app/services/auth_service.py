from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.models.user import User, APIKey
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Password helpers ──────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ── JWT helpers ───────────────────────────────────────────────────────
def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

# ── DB helpers ────────────────────────────────────────────────────────
async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

async def get_api_key(db: AsyncSession, key: str) -> APIKey | None:
    result = await db.execute(select(APIKey).where(APIKey.key == key))
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, email: str, password: str) -> User:
    user = User(email=email, password=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def create_api_key(db: AsyncSession, user_id: str, name: str) -> APIKey:
    key = APIKey(
        user_id=user_id,
        key=secrets.token_urlsafe(32),  # random secure key
        name=name
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key