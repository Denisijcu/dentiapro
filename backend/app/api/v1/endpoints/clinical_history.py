"""
DentiaPro — Clinical History Router
Historia clínica completa por paciente.
Vertex Coders LLC
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import require_doctor, require_staff
from app.db.session import get_db
from app.models.models import ClinicalHistory, Patient, User
from app.schemas.schemas import (
    ClinicalHistoryCreate,
    ClinicalHistoryResponse,
    ClinicalHistoryUpdate,
)

router = APIRouter(prefix="/clinical-history", tags=["clinical-history"])


@router.post("", response_model=ClinicalHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_record(
    payload: ClinicalHistoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    """Crea un nuevo registro en la historia clínica."""
    # Verify patient belongs to this clinic
    patient = await db.execute(
        select(Patient).where(
            Patient.id == payload.patient_id,
            Patient.clinic_id == current_user.clinic_id,
        )
    )
    if not patient.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    record = ClinicalHistory(
        doctor_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.get("/patient/{patient_id}", response_model=List[ClinicalHistoryResponse])
async def get_patient_history(
    patient_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Obtiene el historial clínico completo de un paciente."""
    result = await db.execute(
        select(ClinicalHistory)
        .where(ClinicalHistory.patient_id == patient_id)
        .order_by(ClinicalHistory.visit_date.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{record_id}", response_model=ClinicalHistoryResponse)
async def get_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    result = await db.execute(
        select(ClinicalHistory).where(ClinicalHistory.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Clinical history record not found")
    return record


@router.patch("/{record_id}", response_model=ClinicalHistoryResponse)
async def update_record(
    record_id: int,
    payload: ClinicalHistoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    """Actualiza un registro clínico. Solo el doctor que lo creó o un admin."""
    result = await db.execute(
        select(ClinicalHistory).where(ClinicalHistory.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    from app.models.models import UserRole
    if record.doctor_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only the author doctor or admin can edit this record"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    await db.flush()
    await db.refresh(record)
    return record