import psutil
import httpx
import asyncio
import os
import socket
from datetime import datetime

API_URL    = os.getenv("SENTINEL_API_URL", "https://your-ec2-ip/api/metrics/ingest")
API_KEY    = os.getenv("SENTINEL_API_KEY", "")
SERVER_NAME= os.getenv("SENTINEL_SERVER_NAME", socket.gethostname())
INTERVAL   = int(os.getenv("SENTINEL_INTERVAL", "10"))  # seconds between each send

def collect():
    net = psutil.net_io_counters()
    return {
        "server_name"   : SERVER_NAME,
        "cpu_percent"   : psutil.cpu_percent(interval=1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent"  : psutil.disk_usage("/").percent,
        "net_bytes_sent": net.bytes_sent,
        "net_bytes_recv": net.bytes_recv,
        "recorded_at"   : datetime.utcnow().isoformat(),
    }

async def run():
    print(f"[Sentinel Agent] Starting — server: {SERVER_NAME}, interval: {INTERVAL}s")
    async with httpx.AsyncClient() as client:
        while True:
            try:
                data = collect()
                resp = await client.post(
                    API_URL,
                    json=data,
                    headers={"X-API-Key": API_KEY},
                    timeout=5
                )
                print(f"[{datetime.utcnow()}] Sent → {resp.status_code}")
            except Exception as e:
                print(f"[{datetime.utcnow()}] Error: {e}")
            await asyncio.sleep(INTERVAL)

if __name__ == "__main__":
    asyncio.run(run())