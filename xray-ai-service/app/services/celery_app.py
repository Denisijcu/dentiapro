"""
DentiaPro — xray-ai-service Celery
Task asíncrona para el análisis de rayos X.
Vertex Coders LLC
"""
import asyncio
import logging

from celery import Celery

from app.core.config import settings

logger = logging.getLogger(__name__)

celery_app = Celery(
    "xray_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.services.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_soft_time_limit=120,  # 2 min timeout por análisis
    task_time_limit=180,
    broker_connection_retry_on_startup=True,
)