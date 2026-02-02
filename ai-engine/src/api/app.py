"""
SentinelAI API - FastAPI Application Entry Point
================================================

This is the main entry point for the SentinelAI API service.
It exposes AI-generated insights (anomalies, root causes) via REST APIs.

PURPOSE:
--------
Enable external systems (dashboards, monitoring tools, alerting systems)
to query AI-generated insights stored in MongoDB.

FEATURES:
- Health check endpoint
- Anomaly listing with filters
- Root cause listing with filters
- Statistics endpoint
- OpenAPI documentation (auto-generated)

RUNNING THE API:
----------------
From the ai-engine directory:

    # Development (with auto-reload)
    uvicorn src.api.app:app --reload --host 0.0.0.0 --port 8000

    # Production
    uvicorn src.api.app:app --host 0.0.0.0 --port 8000 --workers 4

API DOCUMENTATION:
------------------
Once running, access:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

DESIGN PRINCIPLES:
------------------
1. READ-ONLY: No writes to database via API
2. STATELESS: No session state, easy to scale
3. DOCUMENTED: Full OpenAPI/Swagger docs
4. SECURE: No raw data exposure, clean responses
"""

import sys
import os
from datetime import datetime
from contextlib import asynccontextmanager

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from src.api.routes import router
from src.api.schemas import HealthResponse


# API Metadata for OpenAPI documentation
API_TITLE = "SentinelAI Insights API"
API_DESCRIPTION = """
## SentinelAI AI-Powered Log Intelligence API

This API provides access to AI-generated insights from the SentinelAI log analysis engine.

### Features

* **Anomaly Detection Results** - Access logs flagged as anomalous by the autoencoder model
* **Root Cause Analysis** - Retrieve correlated root cause insights
* **Statistics** - Get summary statistics about detected issues

### Collections

The API reads from two MongoDB collections:

* `anomalies` - Individual logs flagged as anomalous
* `root_causes` - Correlated root cause analysis results

### Note

This API is **read-only**. AI analysis is performed offline via `python main.py`.
"""

API_VERSION = "1.0.0"

API_TAGS = [
    {
        "name": "Health",
        "description": "Service health and status endpoints"
    },
    {
        "name": "AI Insights",
        "description": "Access AI-generated anomaly and root cause insights"
    }
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup/shutdown events.
    
    On startup: Log API initialization
    On shutdown: Clean up resources
    """
    # Startup
    print("=" * 60)
    print(f"  SentinelAI Insights API v{API_VERSION}")
    print("=" * 60)
    print(f"  Starting at {datetime.utcnow().isoformat()}Z")
    print()
    print("  Endpoints:")
    print("    GET  /health           - Health check")
    print("    GET  /api/v1/anomalies - List anomalies")
    print("    GET  /api/v1/root-causes - List root causes")
    print("    GET  /api/v1/stats     - Get statistics")
    print()
    print("  Documentation:")
    print("    Swagger UI: http://localhost:8000/docs")
    print("    ReDoc:      http://localhost:8000/redoc")
    print("=" * 60)
    
    yield
    
    # Shutdown
    print("\n[API] Shutting down...")


# Create FastAPI application
app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    openapi_tags=API_TAGS,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# Configure CORS for cross-origin requests (e.g., from dashboard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["GET"],  # Read-only API
    allow_headers=["*"],
)


# Register API routes
app.include_router(router)


# Health check endpoint (at root level)
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health Check",
    description="Check if the API service is running and healthy."
)
async def health_check():
    """
    Health check endpoint.
    
    Returns service status, name, and version.
    Use this endpoint for:
    - Load balancer health checks
    - Kubernetes liveness probes
    - Monitoring systems
    
    Returns:
        HealthResponse with status, service name, and version
    """
    return HealthResponse(
        status="healthy",
        service="SentinelAI Insights API",
        version=API_VERSION,
        timestamp=datetime.utcnow()
    )


# Root endpoint redirect to docs
@app.get("/", include_in_schema=False)
async def root():
    """Redirect root to API documentation."""
    return {
        "message": "SentinelAI Insights API",
        "version": API_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for uncaught errors."""
    return {
        "error": "InternalServerError",
        "message": "An unexpected error occurred",
        "detail": str(exc) if os.getenv("DEBUG", "false").lower() == "true" else None
    }
