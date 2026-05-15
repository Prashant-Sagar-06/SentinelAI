import redis.asyncio as redis
from app.config import settings

_client = None

async def get_redis():
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client