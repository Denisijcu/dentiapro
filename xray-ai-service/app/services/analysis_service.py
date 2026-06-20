
"""
DentiaPro — Analysis Service
Orquesta el pipeline completo:
1. Descarga imagen desde URL
2. Preprocesa (DICOM/JPEG/PNG → tensor)
3. Inferencia con el modelo
4. Genera heatmap Grad-CAM
5. Sube heatmap a Cloudinary
6. Notifica al backend via webhook
Vertex Coders LLC
"""
import logging
import time
from typing import Optional

import cloudinary
import cloudinary.uploader
import httpx
import numpy as np

from app.core.config import settings
from app.ml.dental_model import (
    CONDITION_RECOMMENDATIONS,
    CONDITION_SEVERITY,
    DENTAL_CONDITIONS,
    model_manager,
)
from app.ml.preprocessing.image_processor import (
    full_pipeline,
    generate_gradcam_heatmap,
    ndarray_to_bytes,
)
from app.schemas.schemas import (
    AnalysisResult,
    AnalysisStatus,
    DentalFinding,
    WebhookPayload,
)

logger = logging.getLogger(__name__)

# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


async def download_image(url: str) -> bytes:
    """Descarga imagen desde URL (Cloudinary u otra fuente)."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


def _get_severity(condition: str, confidence: float) -> str:
    """Determina severidad según la confianza del modelo."""
    thresholds = CONDITION_SEVERITY.get(condition, {})
    severity = "mild"
    for sev, threshold in sorted(thresholds.items(), key=lambda x: x[1]):
        if confidence >= threshold:
            severity = sev
    return severity


def _build_findings_text(findings: dict) -> str:
    """Genera texto descriptivo de los hallazgos para el historial clínico."""
    if "healthy" in findings:
        return "No se detectaron patologías significativas en la radiografía analizada."

    lines = ["Hallazgos detectados por análisis de IA:"]
    for condition, confidence in sorted(findings.items(), key=lambda x: -x[1]):
        severity = _get_severity(condition, confidence)
        condition_es = {
            "caries": "Caries dental",
            "bone_loss": "Pérdida ósea",
            "periapical_lesion": "Lesión periapical",
            "crown_fracture": "Fractura de corona",
            "root_fracture": "Fractura radicular",
            "impaction": "Diente impactado",
            "calculus": "Cálculo dental",
            "missing_tooth": "Diente ausente",
            "overhang": "Desbordamiento de restauración",
        }.get(condition, condition)

        lines.append(
            f"• {condition_es}: severidad {severity} "
            f"(confianza: {confidence * 100:.1f}%)"
        )
    return "\n".join(lines)


def _build_diagnosis(findings: dict) -> str:
    """Genera texto de diagnóstico preliminar."""
    if "healthy" in findings:
        return "Radiografía sin hallazgos patológicos evidentes. Estructuras dentales y periodontales dentro de parámetros normales."

    conditions = list(findings.keys())
    if len(conditions) == 1:
        return f"Diagnóstico preliminar: {conditions[0].replace('_', ' ').title()}. Este diagnóstico es una sugerencia de IA y debe ser confirmado por el odontólogo tratante."

    primary = max(findings, key=findings.get)
    return (
        f"Diagnóstico preliminar principal: {primary.replace('_', ' ').title()}. "
        f"Se detectaron {len(conditions)} condiciones en total. "
        "Revisión clínica completa recomendada antes de establecer plan de tratamiento."
    )


def _build_recommendations(findings: dict) -> str:
    """Genera recomendaciones de tratamiento."""
    if "healthy" in findings:
        return CONDITION_RECOMMENDATIONS["healthy"]

    # Ordenar por confianza y tomar las 3 más relevantes
    top_conditions = sorted(findings.items(), key=lambda x: -x[1])[:3]
    recs = []
    for condition, _ in top_conditions:
        rec = CONDITION_RECOMMENDATIONS.get(condition)
        if rec:
            recs.append(f"[{condition.replace('_', ' ').upper()}]: {rec}")

    recs.append(
        "\n⚠️ AVISO: Este análisis es una herramienta de apoyo diagnóstico. "
        "El diagnóstico final y plan de tratamiento deben ser determinados por el odontólogo."
    )
    return "\n\n".join(recs)


async def upload_heatmap_to_cloudinary(
    heatmap_bytes: bytes,
    xray_id: int,
    patient_id: int,
) -> Optional[str]:
    """Sube el heatmap generado a Cloudinary y retorna la URL segura."""
    try:
        result = cloudinary.uploader.upload(
            heatmap_bytes,
            public_id=f"dentiapro/heatmaps/{patient_id}/xray_{xray_id}_heatmap",
            resource_type="image",
            format="png",
            tags=["heatmap", f"xray_{xray_id}"],
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Failed to upload heatmap: {e}")
        return None


async def notify_backend(payload: WebhookPayload) -> bool:
    """Notifica al backend principal con los resultados del análisis."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                settings.backend_webhook_url,
                json=payload.model_dump(),
                headers={"Content-Type": "application/json"},
            )
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Failed to notify backend: {e}")
        return False


async def run_analysis(
    xray_id: int,
    image_url: str,
    patient_id: int,
    image_type: str = "panoramic",
) -> AnalysisResult:
    """
    Pipeline completo de análisis de rayos X.

    1. Descarga la imagen
    2. Preprocesa (DICOM → tensor normalizado + imagen enhanced)
    3. Inferencia con EfficientNet-B4
    4. Genera heatmap Grad-CAM de la condición principal
    5. Sube heatmap a Cloudinary
    6. Notifica al backend via webhook
    7. Retorna AnalysisResult completo
    """
    start_time = time.time()
    logger.info(f"[XRay #{xray_id}] Starting analysis — type={image_type}")

    try:
        # ── 1. Descargar imagen ────────────────────────────────────────────
        logger.info(f"[XRay #{xray_id}] Downloading from {image_url}")
        raw_bytes = await download_image(image_url)

        # ── 2. Preprocesar ────────────────────────────────────────────────
        logger.info(f"[XRay #{xray_id}] Preprocessing ({len(raw_bytes)//1024}KB)")
        img_enhanced, tensor_input = full_pipeline(raw_bytes)

        # ── 3. Inferencia ─────────────────────────────────────────────────
        logger.info(f"[XRay #{xray_id}] Running inference on {settings.device}")
        findings_dict, global_confidence = model_manager.predict(
            tensor_input,
            threshold=settings.MODEL_CONFIDENCE_THRESHOLD,
        )
        logger.info(f"[XRay #{xray_id}] Findings: {list(findings_dict.keys())} (conf={global_confidence:.3f})")

        # ── 4. Grad-CAM heatmap ───────────────────────────────────────────
        heatmap_url = None
        if findings_dict and "healthy" not in findings_dict:
            primary_condition = max(findings_dict, key=findings_dict.get)
            logger.info(f"[XRay #{xray_id}] Generating Grad-CAM for '{primary_condition}'")

            attention_map = model_manager.get_gradcam_for_finding(tensor_input, primary_condition)
            heatmap_img = generate_gradcam_heatmap(img_enhanced, attention_map, alpha=0.45)
            heatmap_bytes = ndarray_to_bytes(heatmap_img, format="PNG")

            # ── 5. Subir heatmap ──────────────────────────────────────────
            heatmap_url = await upload_heatmap_to_cloudinary(heatmap_bytes, xray_id, patient_id)
            logger.info(f"[XRay #{xray_id}] Heatmap: {heatmap_url}")

        # ── 6. Construir resultado ────────────────────────────────────────
        dental_findings = [
            DentalFinding(
                condition=condition,
                severity=_get_severity(condition, confidence),
                confidence=confidence,
            )
            for condition, confidence in findings_dict.items()
        ]

        findings_text = _build_findings_text(findings_dict)
        diagnosis = _build_diagnosis(findings_dict)
        recommendations = _build_recommendations(findings_dict)
        processing_ms = int((time.time() - start_time) * 1000)

        result = AnalysisResult(
            xray_id=xray_id,
            status=AnalysisStatus.COMPLETED,
            findings=dental_findings,
            findings_text=findings_text,
            diagnosis=diagnosis,
            recommendations=recommendations,
            confidence_score=global_confidence,
            heatmap_url=heatmap_url,
            processing_time_ms=processing_ms,
        )

        # ── 7. Notificar al backend ───────────────────────────────────────
        webhook = WebhookPayload(
            xray_id=xray_id,
            findings=findings_text,
            diagnosis=diagnosis,
            recommendations=recommendations,
            confidence_score=global_confidence,
            heatmap_url=heatmap_url,
        )
        notified = await notify_backend(webhook)
        logger.info(
            f"[XRay #{xray_id}] Done in {processing_ms}ms — "
            f"backend notified: {notified}"
        )

        return result

    except Exception as e:
        processing_ms = int((time.time() - start_time) * 1000)
        logger.error(f"[XRay #{xray_id}] Analysis FAILED: {e}", exc_info=True)

        # Notificar fallo al backend
        await notify_backend(WebhookPayload(
            xray_id=xray_id,
            findings="Error durante el análisis","""
DentiaPro — Analysis Service (Claude Vision)
Usa Claude claude-sonnet-4-6 con visión multimodal para analizar radiografías dentales.
Vertex Coders LLC
"""
import base64
import logging
import time
from typing import Optional

import cloudinary
import cloudinary.uploader
import httpx

from app.core.config import settings
from app.schemas.schemas import (
    AnalysisResult,
    AnalysisStatus,
    DentalFinding,
    WebhookPayload,
)

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

DENTAL_ANALYSIS_PROMPT = """Eres un especialista en radiología dental con 20 años de experiencia.
Analiza esta radiografía dental con precisión clínica.

Responde EXACTAMENTE en este formato JSON sin markdown ni backticks:
{
  "findings": "Descripción detallada de los hallazgos radiológicos observados. Lista cada hallazgo con ubicación y características.",
  "diagnosis": "Diagnóstico preliminar clínico basado en los hallazgos. Menciona condiciones específicas detectadas.",
  "recommendations": "Recomendaciones de tratamiento específicas para cada hallazgo. Incluye urgencia y prioridad.",
  "conditions": ["condicion1", "condicion2"],
  "confidence": 0.85,
  "severity": "mild|moderate|severe"
}

Analiza: caries, pérdida ósea, lesiones periapicales, fracturas, impactaciones, cálculo dental, restauraciones existentes, y cualquier anomalía visible.
Si la imagen no es una radiografía dental, responde con confidence: 0.0 y findings: "Imagen no reconocida como radiografía dental."
"""


async def download_image(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def analyze_with_claude(image_bytes: bytes, image_type: str = "panoramic") -> dict:
    """Envía la imagen a Claude claude-sonnet-4-6 Vision para análisis dental."""
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    # Detectar media type
    if image_bytes[:4] == b'\xff\xd8\xff\xe0' or image_bytes[:3] == b'\xff\xd8\xff':
        media_type = "image/jpeg"
    elif image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        media_type = "image/png"
    elif image_bytes[:4] == b'RIFF':
        media_type = "image/webp"
    else:
        media_type = "image/jpeg"  # fallback

    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 1024,
        "messages": [
            {
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
                    {
                        "type": "text",
                        "text": DENTAL_ANALYSIS_PROMPT + f"\n\nTipo de radiografía: {image_type}"
                    }
                ],
            }
        ],
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

    # Extraer texto de la respuesta
    raw_text = data["content"][0]["text"].strip()

    # Limpiar markdown si viene con backticks
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        raw_text = "\n".join(lines[1:-1])

    import json
    result = json.loads(raw_text)
    return result


async def upload_to_cloudinary(image_bytes: bytes, xray_id: int, patient_id: int, suffix: str = "") -> Optional[str]:
    try:
        public_id = f"dentiapro/xrays/{patient_id}/xray_{xray_id}{suffix}"
        result = cloudinary.uploader.upload(
            image_bytes,
            public_id=public_id,
            resource_type="image",
            tags=["xray", f"patient_{patient_id}"],
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        return None


async def notify_backend(payload: WebhookPayload) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                settings.backend_webhook_url,
                json=payload.model_dump(),
                headers={"Content-Type": "application/json"},
            )
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Failed to notify backend: {e}")
        return False


async def run_analysis(
    xray_id: int,
    image_url: str,
    patient_id: int,
    image_type: str = "panoramic",
) -> AnalysisResult:
    """
    Pipeline completo:
    1. Descarga imagen
    2. Sube a Cloudinary
    3. Analiza con Claude Vision
    4. Notifica al backend
    """
    start_time = time.time()
    logger.info(f"[XRay #{xray_id}] Starting Claude Vision analysis")

    try:
        # 1. Descargar imagen
        logger.info(f"[XRay #{xray_id}] Downloading image...")
        raw_bytes = await download_image(image_url)
        logger.info(f"[XRay #{xray_id}] Downloaded {len(raw_bytes)//1024}KB")

        # 2. Subir original a Cloudinary si no tiene URL de Cloudinary
        stored_url = image_url
        if "cloudinary" not in image_url:
            stored_url = await upload_to_cloudinary(raw_bytes, xray_id, patient_id) or image_url

        # 3. Analizar con Claude Vision
        logger.info(f"[XRay #{xray_id}] Sending to Claude Vision...")
        claude_result = await analyze_with_claude(raw_bytes, image_type)
        logger.info(f"[XRay #{xray_id}] Claude analysis complete: {claude_result.get('conditions', [])}")

        findings_text = claude_result.get("findings", "Sin hallazgos detectados.")
        diagnosis = claude_result.get("diagnosis", "Sin diagnóstico disponible.")
        recommendations = claude_result.get("recommendations", "Consulte con su odontólogo.")
        confidence = float(claude_result.get("confidence", 0.85))
        conditions = claude_result.get("conditions", [])

        dental_findings = [
            DentalFinding(
                condition=c,
                severity=claude_result.get("severity", "moderate"),
                confidence=confidence,
            )
            for c in conditions
        ]

        processing_ms = int((time.time() - start_time) * 1000)

        result = AnalysisResult(
            xray_id=xray_id,
            status=AnalysisStatus.COMPLETED,
            findings=dental_findings,
            findings_text=findings_text,
            diagnosis=diagnosis,
            recommendations=recommendations,
            confidence_score=confidence,
            heatmap_url=None,
            processing_time_ms=processing_ms,
        )

        # 4. Notificar al backend
        webhook = WebhookPayload(
            xray_id=xray_id,
            findings=findings_text,
            diagnosis=diagnosis,
            recommendations=recommendations,
            confidence_score=confidence,
            heatmap_url=None,
        )
        notified = await notify_backend(webhook)
        logger.info(f"[XRay #{xray_id}] Done in {processing_ms}ms — backend notified: {notified}")

        return result

    except Exception as e:
        processing_ms = int((time.time() - start_time) * 1000)
        logger.error(f"[XRay #{xray_id}] FAILED: {e}", exc_info=True)

        await notify_backend(WebhookPayload(
            xray_id=xray_id,
            findings="Error durante el análisis",
            diagnosis="Error de procesamiento",
            recommendations="Vuelva a intentarlo.",
            confidence_score=0.0,
        ))

        return AnalysisResult(
            xray_id=xray_id,
            status=AnalysisStatus.FAILED,
            findings=[],
            findings_text="Error durante el análisis.",
            diagnosis="Error de procesamiento",
            recommendations="Verificar que la imagen sea válida.",
            confidence_score=0.0,
            processing_time_ms=processing_ms,
            error=str(e),
        )
            diagnosis="Error de procesamiento",
            recommendations="Vuelva a subir la imagen o contacte soporte técnico.",
            confidence_score=0.0,
        ))

        return AnalysisResult(
            xray_id=xray_id,
            status=AnalysisStatus.FAILED,
            findings=[],
            findings_text="Error durante el análisis de IA.",
            diagnosis="Error de procesamiento",
            recommendations="Verificar que la imagen sea válida.",
            confidence_score=0.0,
            processing_time_ms=processing_ms,
            error=str(e),
        )