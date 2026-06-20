"""
DentiaPro — X-Ray Analysis Router
Upload + análisis directo con Claude Vision.
Vertex Coders LLC
"""
import base64
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import cloudinary
import cloudinary.uploader
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import require_doctor, require_staff
from app.db.session import get_db
from app.models.models import Patient, User, XRayAnalysis, XRayStatus
from app.schemas.schemas import XRayAnalysisResponse, XRayReviewRequest, XRayUploadResponse

router = APIRouter(prefix="/xray", tags=["xray"])

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

DENTAL_PROMPT = """Eres un especialista en radiología dental con 20 años de experiencia.
Analiza esta radiografía dental con precisión clínica.

Responde ÚNICAMENTE con este JSON sin markdown ni backticks:
{
  "findings": "Descripción detallada de hallazgos radiológicos. Lista cada hallazgo con ubicación.",
  "diagnosis": "Diagnóstico preliminar clínico con condiciones específicas detectadas.",
  "recommendations": "Recomendaciones de tratamiento específicas con urgencia y prioridad.",
  "conditions": ["condicion1", "condicion2"],
  "confidence": 0.85
}

Analiza: caries, pérdida ósea, lesiones periapicales, fracturas, impactaciones, cálculo dental, restauraciones.
"""

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


async def analyze_with_claude(image_bytes: bytes) -> dict:
    """Analiza la radiografía con Claude claude-sonnet-4-6 Vision."""
    # Detectar media type
    if image_bytes[:2] == b'\xff\xd8':
        media_type = "image/jpeg"
    elif image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        media_type = "image/png"
    else:
        media_type = "image/jpeg"

    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 2048,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_b64,
                    },
                },
                {"type": "text", "text": DENTAL_PROMPT}
            ],
        }],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    raw_text = data["content"][0]["text"].strip()
    # Limpiar markdown si viene con backticks
    if "```" in raw_text:
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    return json.loads(raw_text.strip())


@router.post("/upload", response_model=XRayAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def upload_xray(
    patient_id: int = Form(...),
    image_type: str = Form(default="panoramic"),
    clinical_history_id: Optional[int] = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    """
    Sube un rayos X, lo analiza con Claude Vision y guarda los resultados.
    Todo en una sola llamada síncrona.
    """
    # Validar tipo
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo de archivo no permitido. Usa JPEG, PNG o WebP.",
        )

    content = await file.read()
    file_size_kb = len(content) // 1024

    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Archivo excede el límite de {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # Verificar paciente
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    # Subir a Cloudinary
    image_url = ""
    image_public_id = f"dentiapro/xray/{current_user.clinic_id}/{patient_id}/{uuid.uuid4().hex}"

    try:
        upload_result = cloudinary.uploader.upload(
            content,
            public_id=image_public_id,
            resource_type="image",
            tags=["xray", f"patient_{patient_id}"],
        )
        image_url = upload_result["secure_url"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al subir imagen: {str(e)}",
        )

    # Analizar con Claude Vision
    ai_findings = None
    ai_diagnosis = None
    ai_recommendations = None
    ai_confidence = None
    xray_status = XRayStatus.UPLOADED

    if settings.ANTHROPIC_API_KEY:
        try:
            claude_result = await analyze_with_claude(content)
            ai_findings = claude_result.get("findings")
            ai_diagnosis = claude_result.get("diagnosis")
            ai_recommendations = claude_result.get("recommendations")
            ai_confidence = float(claude_result.get("confidence", 0.85))
            xray_status = XRayStatus.ANALYZED
        except Exception as e:
            # No fallar si Claude falla — guardar sin análisis
            ai_findings = f"Error en análisis IA: {str(e)}"
            xray_status = XRayStatus.UPLOADED

    # Guardar en DB
    xray = XRayAnalysis(
        patient_id=patient_id,
        clinical_history_id=clinical_history_id,
        image_url=image_url,
        image_public_id=image_public_id,
        image_type=image_type,
        file_size_kb=file_size_kb,
        status=xray_status,
        ai_findings=ai_findings,
        ai_diagnosis=ai_diagnosis,
        ai_recommendations=ai_recommendations,
        ai_confidence_score=ai_confidence,
    )
    db.add(xray)
    await db.flush()
    await db.refresh(xray)
    return xray


@router.get("/patient/{patient_id}", response_model=list[XRayAnalysisResponse])
async def get_patient_xrays(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    result = await db.execute(
        select(XRayAnalysis)
        .where(XRayAnalysis.patient_id == patient_id)
        .order_by(XRayAnalysis.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{xray_id}", response_model=XRayAnalysisResponse)
async def get_xray(
    xray_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    result = await db.execute(
        select(XRayAnalysis).where(XRayAnalysis.id == xray_id)
    )
    xray = result.scalar_one_or_none()
    if not xray:
        raise HTTPException(status_code=404, detail="Rayos X no encontrado")
    return xray


@router.post("/{xray_id}/review", response_model=XRayAnalysisResponse)
async def review_xray(
    xray_id: int,
    payload: XRayReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    result = await db.execute(
        select(XRayAnalysis).where(XRayAnalysis.id == xray_id)
    )
    xray = result.scalar_one_or_none()
    if not xray:
        raise HTTPException(status_code=404, detail="Rayos X no encontrado")

    xray.doctor_notes = payload.doctor_notes
    xray.doctor_diagnosis = payload.doctor_diagnosis
    xray.reviewed_by_id = current_user.id
    xray.reviewed_at = datetime.now(timezone.utc)
    xray.status = XRayStatus.REVIEWED

    await db.flush()
    await db.refresh(xray)
    return xray


@router.post("/webhook/ai-result")
async def ai_result_webhook(payload: dict, db: AsyncSession = Depends(get_db)):
    """Webhook para compatibilidad con xray-ai-service."""
    xray_id = payload.get("xray_id")
    if not xray_id:
        raise HTTPException(status_code=400, detail="xray_id requerido")

    result = await db.execute(
        select(XRayAnalysis).where(XRayAnalysis.id == xray_id)
    )
    xray = result.scalar_one_or_none()
    if not xray:
        raise HTTPException(status_code=404, detail="Rayos X no encontrado")

    xray.status = XRayStatus.ANALYZED
    xray.ai_findings = payload.get("findings")
    xray.ai_diagnosis = payload.get("diagnosis")
    xray.ai_recommendations = payload.get("recommendations")
    xray.ai_confidence_score = payload.get("confidence_score")
    xray.heatmap_url = payload.get("heatmap_url")

    await db.flush()
    return {"status": "updated", "xray_id": xray_id}