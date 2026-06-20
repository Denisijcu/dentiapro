
"""
DentiaPro — xray-ai-service Tasks
Vertex Coders LLC
"""
import asyncio
import logging

from app.services.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="analyze_xray",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def analyze_xray_task(
    self,
    xray_id: int,
    image_url: str,
    patient_id: int,
    image_type: str = "panoramic",
):
    """
    Tarea Celery que ejecuta el pipeline de análisis de forma asíncrona.
    Se reintenta hasta 3 veces si hay error.
    """
    from app.services.analysis_service import run_analysis

    try:
        logger.info(f"[Task] analyze_xray starting — xray_id={xray_id}")
        result = asyncio.run(
            run_analysis(
                xray_id=xray_id,
                image_url=image_url,
                patient_id=patient_id,
                image_type=image_type,
            )
        )
        logger.info(
            f"[Task] analyze_xray completed — xray_id={xray_id} "
            f"status={result.status} time={result.processing_time_ms}ms"
        )
        return {
            "xray_id": xray_id,
            "status": result.status,
            "confidence": result.confidence_score,
        }

    except Exception as exc:
        logger.error(f"[Task] analyze_xray FAILED — xray_id={xray_id}: {exc}")
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(f"[Task] Max retries exceeded for xray_id={xray_id}")
            return {"xray_id": xray_id, "status": "failed", "error": str(exc)}