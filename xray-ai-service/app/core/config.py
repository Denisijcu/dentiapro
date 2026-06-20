"""
DentiaPro — xray-ai-service Config
Vertex Coders LLC
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    APP_NAME: str = "DentiaPro XRay AI Service"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8001

    # Auth
    AI_SERVICE_API_KEY: str = "internal-service-key"

    # Backend webhook
    BACKEND_URL: str = "http://api:8000"
    BACKEND_WEBHOOK_PATH: str = "/api/v1/xray/webhook/ai-result"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/3"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/4"

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Anthropic Claude Vision
    ANTHROPIC_API_KEY: str = ""

    # ML (legacy - kept for compatibility)
    MODEL_WEIGHTS_PATH: str = "/app/app/ml/weights/dental_model.pth"
    MODEL_CONFIDENCE_THRESHOLD: float = 0.5
    USE_GPU: bool = False

    @property
    def device(self) -> str:
        return "cpu"

    @property
    def backend_webhook_url(self) -> str:
        return f"{self.BACKEND_URL}{self.BACKEND_WEBHOOK_PATH}"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()