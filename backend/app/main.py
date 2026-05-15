from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth, metrics, incidents, ai, websocket
from app.database import init_db

app = FastAPI(title="Sentinel AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock this down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

app.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(metrics.router,   prefix="/api/metrics",   tags=["Metrics"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
app.include_router(ai.router,        prefix="/api/ai",        tags=["AI"])
app.include_router(websocket.router, prefix="/ws",            tags=["WebSocket"])

@app.get("/health")
def health():
    return {"status": "ok"}