"""
DentiaPro — Celery App
Vertex Coders LLC
"""
from celery import Celery
from app.core.config import settings

# 1. Instanciación del core asíncrono
celery_app = Celery(
    "dentiapro",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.services.tasks"],
)

# 2. Hardening y Configuración Global
celery_app.conf.update(
    # Prevención de ataques de deserialización (Pickle) forzando JSON
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Manejo de tiempo
    timezone="UTC",
    enable_utc=True,
    
    # Corrección del Warning: Regla de reconexión inyectada en el objeto correcto
    broker_connection_retry_on_startup=True,
)