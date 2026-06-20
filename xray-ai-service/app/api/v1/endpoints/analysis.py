
"""
DentiaPro — xray-ai-service Analysis Router
Endpoint principal que recibe requests del backend y lanza análisis async.
Vertex Coders LLC
"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.security import verify_api_key
from app.ml.dental_model import model_manager
from app.schemas.schemas import (
    AnalysisAccepted,
    AnalysisRequest,
    AnalysisResult,
    AnalysisStatus,
)
from app.services.tasks import analyze_xray_task

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post(
    "",
    response_model=AnalysisAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_api_key)],
)
async def request_analysis(payload: AnalysisRequest):
    """
    Recibe una solicitud de análisis del backend principal.
    Encola la tarea en Celery y retorna inmediatamente con task_id.
    El resultado llega al backend via webhook cuando termina.
    """
    if not model_manager.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI model is not loaded yet. Please try again in a moment.",
        )

    # Encolar tarea en Celery
    task = analyze_xray_task.apply_async(
        kwargs={
            "xray_id": payload.xray_id,
            "image_url": str(payload.image_url),
            "patient_id": payload.patient_id,
            "image_type": payload.image_type.value,
        },
        task_id=f"xray-{payload.xray_id}-{uuid.uuid4().hex[:8]}",
    )

    return AnalysisAccepted(
        task_id=task.id,
        xray_id=payload.xray_id,
        status=AnalysisStatus.QUEUED,
    )


@router.post(
    "/sync",
    response_model=AnalysisResult,
    dependencies=[Depends(verify_api_key)],
    summary="Análisis síncrono (solo para testing)",
)
async def request_analysis_sync(payload: AnalysisRequest):
    """
    Análisis síncrono — espera el resultado antes de responder.
    Útil para testing. En producción usar el endpoint async (/analyze).
    """
    from app.services.analysis_service import run_analysis

    if not model_manager.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI model is not loaded yet.",
        )

    result = await run_analysis(
        xray_id=payload.xray_id,
        image_url=str(payload.image_url),
        patient_id=payload.patient_id,
        image_type=payload.image_type.value,
    )
    return result