from dotenv import load_dotenv
load_dotenv()

import os
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"]     = "false"
os.environ["POSTHOG_DISABLED"]     = "true"

try:
    import posthog
    posthog.disabled = True
    posthog.capture = lambda *args, **kwargs: None
except Exception:
    pass


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

from config import settings
from database import init_db
from routes import chat, upload, memory
from services.llm import check_llm_health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Nexus Memory API...")

    # Initialize database (don't crash the whole app if the DB is briefly down)
    try:
        init_db()
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.error(f"⚠️  Database init failed: {e}")

    # Check LLM provider health (Groq or Ollama)
    health = await check_llm_health()
    if health["status"] == "healthy":
        provider = health.get("provider", "ollama")
        logger.info(f"✅ LLM ready ({provider}) | Models: {health['models']}")
    else:
        logger.warning(f"⚠️  LLM check failed: {health.get('error')}")
        logger.warning("   Set GROQ_API_KEY, or run Ollama: ollama serve")

    logger.info(f"✅ Nexus Memory ready on http://{settings.HOST}:{settings.PORT}")

    yield

    # Shutdown
    logger.info("Shutting down Nexus Memory...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Local AI Assistant with Persistent Memory and PDF Chat",
    lifespan=lifespan,
)

# CORS Configuration
# Set CORS_ORIGINS env var to a comma-separated list to restrict origins.
# Defaults to "*" so the hosted Space (and its Swagger UI) is reachable.
_cors_env = os.environ.get("CORS_ORIGINS", "*")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # allow_credentials must be False when origins is "*" (browser rule).
    allow_credentials="*" not in _cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(chat.router, tags=["Chat"])
app.include_router(upload.router, tags=["Documents"])
app.include_router(memory.router, tags=["Memory"])


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    llm_status = await check_llm_health()
    from services.cache import cache_status
    return {
        "api": "healthy",
        "ollama": llm_status,  # key kept for frontend compatibility
        "model": llm_status.get("current_model"),
        "cache": cache_status(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )