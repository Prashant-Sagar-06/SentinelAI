from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        # user_id → list of active WebSocket connections
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.active:
            self.active[user_id].remove(ws)

    async def send(self, user_id: str, data: dict):
        for ws in self.active.get(user_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass

manager = ConnectionManager()
