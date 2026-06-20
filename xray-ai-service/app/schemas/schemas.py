"""
DentiaPro — xray-ai-service Schemas
Vertex Coders LLC
"""
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


class ImageType(str, Enum):
    PANORAMIC = "panoramic"       # Radiografía panorámica
    PERIAPICAL = "periapical"     # Radiografía periapical
    BITEWING = "bitewing"         # Radiografía de aleta de mordida
    CEPHALOMETRIC = "cephalometric"  # Radiografía cefalométrica
    CBCT = "cbct"                 # Tomografía computarizada cone beam


class AnalysisStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Request: backend → AI service
# ---------------------------------------------------------------------------
class AnalysisRequest(BaseModel):
    xray_id: int
    image_url: str
    patient_id: int
    image_type: ImageType = ImageType.PANORAMIC


# ---------------------------------------------------------------------------
# Dental Finding
# ---------------------------------------------------------------------------
class DentalFinding(BaseModel):
    tooth_number: Optional[str] = None       # FDI notation: "11", "36", etc.
    condition: str                            # "cavity", "bone_loss", etc.
    severity: str = Field(default="moderate") # "mild" | "moderate" | "severe"
    confidence: float = Field(ge=0.0, le=1.0)
    bounding_box: Optional[List[float]] = None  # [x, y, w, h] normalized


class AnalysisResult(BaseModel):
    xray_id: int
    status: AnalysisStatus
    findings: List[DentalFinding]
    findings_text: str
    diagnosis: str
    recommendations: str
    confidence_score: float
    heatmap_url: Optional[str] = None
    processing_time_ms: Optional[int] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Response: AI service → backend (via webhook)
# ---------------------------------------------------------------------------
class WebhookPayload(BaseModel):
    xray_id: int
    findings: str
    diagnosis: str
    recommendations: str
    confidence_score: float
    heatmap_url: Optional[str] = None


# ---------------------------------------------------------------------------
# API Responses
# ---------------------------------------------------------------------------
class AnalysisAccepted(BaseModel):
    task_id: str
    xray_id: int
    status: AnalysisStatus = AnalysisStatus.QUEUED
    message: str = "Analysis queued successfully"


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    version: str