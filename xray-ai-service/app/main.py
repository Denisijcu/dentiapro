
"""
DentiaPro — xray-ai-service Main
Microservicio de análisis de rayos X con IA.
Vertex Coders LLC
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.ml.dental_model import model_manager
from app.schemas.schemas import HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga el modelo al startup — una sola vez."""
    logger.info("🦷🤖 xray-ai-service starting up...")
    logger.info(f"   Device: {settings.device}")
    logger.info(f"   Model weights: {settings.MODEL_WEIGHTS_PATH}")

    loaded = model_manager.load(
        weights_path=settings.MODEL_WEIGHTS_PATH,
        device=settings.device,
    )
    logger.info(f"   Model loaded: {loaded}")
    logger.info("🦷🤖 xray-ai-service ready!")

    yield

    logger.info("🦷🤖 xray-ai-service shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="DentiaPro AI X-Ray Analysis Microservice — Vertex Coders LLC",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://api:8000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(api_router)


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    return HealthResponse(
        status="healthy" if model_manager.is_loaded else "loading",
        model_loaded=model_manager.is_loaded,
        device=model_manager.device,
        version=settings.APP_VERSION,
    )


@app.get("/", tags=["system"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }