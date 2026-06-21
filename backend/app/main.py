import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.limiter import limiter

# Configure logging — never DEBUG in production
logging.basicConfig(
    level=logging.DEBUG if not settings.is_production else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    logger.info(f"Starting 2LTP backend [env={settings.APP_ENV}]...")
    import os
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield
    logger.info("Shutting down 2LTP backend...")


# Disable Swagger/ReDoc/OpenAPI in production (§ security)
app = FastAPI(
    title="2LTP Task Portal API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=settings.docs_url,
    redoc_url=settings.redoc_url,
    openapi_url=settings.openapi_url,
)

# Rate limiter middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS — strict origin list from env
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from app.routers import (
    auth,
    users,
    teams,
    applications,
    services,
    tickets,
    tasks,
    subtasks,
    comments,
    notifications,
    analytics,
    audit_log,
    websocket,
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(applications.router)
app.include_router(services.router)
app.include_router(tickets.router)
app.include_router(tasks.router)
app.include_router(subtasks.router)
app.include_router(comments.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(audit_log.router)
app.include_router(websocket.router)


@app.get("/health", tags=["health"], include_in_schema=not settings.is_production)
async def health():
    return {"status": "ok", "version": "1.0.0", "env": settings.APP_ENV}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Never leak internal details to client
    logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )
