import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.auth_service import decode_access_token
from app.services.ws_manager import manager
from app.redis_client import get_redis

router = APIRouter()

@router.websocket("/live")
async def live(
    ws: WebSocket,
    token: str       = Query(...),
    server_name: str = Query(...)
):
    # Validate JWT passed as query param (browsers can't set WS headers)
    user_id = decode_access_token(token)
    if not user_id:
        await ws.close(code=1008)  # 1008 = policy violation
        return

    await manager.connect(user_id, ws)
    r = await get_redis()

    try:
        while True:
            key  = f"latest:{user_id}:{server_name}"
            data = await r.get(key)
            if data:
                await ws.send_json(json.loads(data))
            await asyncio.sleep(3)   # push every 3 seconds
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)

