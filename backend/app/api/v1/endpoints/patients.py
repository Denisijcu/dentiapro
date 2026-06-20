"""
DentiaPro — Patients Router
CRUD completo de pacientes con paginación y búsqueda.
Vertex Coders LLC
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_staff
from app.db.session import get_db
from app.models.models import Patient, User
from app.schemas.schemas import (
    PaginatedResponse,
    PatientCreate,
    PatientResponse,
    PatientSummary,
    PatientUpdate,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Registra un nuevo paciente en la clínica."""
    if payload.national_id:
        exists = await db.execute(
            select(Patient).where(
                Patient.clinic_id == current_user.clinic_id,
                Patient.national_id == payload.national_id,
            )
        )
        if exists.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Patient with national_id '{payload.national_id}' already exists.",
            )

    patient = Patient(clinic_id=current_user.clinic_id, **payload.model_dump())
    db.add(patient)
    await db.flush()
    await db.refresh(patient)
    return patient


# ---------------------------------------------------------------------------
# GET /patients/search?q=término&limit=10
# DEBE ir ANTES de /{patient_id} — si no FastAPI interpreta "search" como un ID
# ---------------------------------------------------------------------------
@router.get("/search", response_model=List[PatientSummary])
async def search_patients(
    q: str = Query(min_length=1, description="Nombre, apellido, cédula o teléfono"),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Búsqueda rápida de pacientes para autocompletado."""
    term = f"%{q.strip()}%"
    result = await db.execute(
        select(Patient)
        .where(
            Patient.clinic_id == current_user.clinic_id,
            Patient.is_active.is_(True),
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.national_id.ilike(term),
                Patient.phone.ilike(term),
                Patient.email.ilike(term),
            ),
        )
        .order_by(Patient.last_name, Patient.first_name)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("", response_model=PaginatedResponse)
async def list_patients(
    search: Optional[str] = Query(default=None, description="Buscar por nombre, email o cédula"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_active: Optional[bool] = Query(default=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Lista pacientes con búsqueda y paginación."""
    base_query = select(Patient).where(Patient.clinic_id == current_user.clinic_id)

    if is_active is not None:
        base_query = base_query.where(Patient.is_active == is_active)

    if search:
        term = f"%{search}%"
        base_query = base_query.where(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.email.ilike(term),
                Patient.national_id.ilike(term),
                Patient.phone.ilike(term),
            )
        )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    result = await db.execute(
        base_query
        .order_by(Patient.last_name, Patient.first_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    patients = result.scalars().all()

    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[PatientSummary.model_validate(p) for p in patients],
    )


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Obtiene el perfil completo de un paciente."""
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


@router.patch("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Actualiza datos del paciente (partial update)."""
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)

    await db.flush()
    await db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Desactiva un paciente (soft delete)."""
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    patient.is_active = False
    await db.flush()