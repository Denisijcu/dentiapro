"""
DentiaPro — Appointments Router
Gestión de citas con validación de conflictos de horario.
Vertex Coders LLC
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_staff
from app.db.session import get_db
from app.models.models import Appointment, AppointmentStatus, User
from app.schemas.schemas import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentUpdate,
    PaginatedResponse,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


async def _check_doctor_availability(
    db: AsyncSession,
    doctor_id: int,
    scheduled_at: datetime,
    duration_minutes: int,
    exclude_id: Optional[int] = None,
) -> bool:
    """Verifica que el doctor no tenga otra cita en ese horario."""
    end_time = scheduled_at + timedelta(minutes=duration_minutes)

    query = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.status.notin_(
            [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]
        ),
        or_(
            and_(
                Appointment.scheduled_at <= scheduled_at,
                func.cast(Appointment.scheduled_at, type_=None)
                + func.make_interval(0, 0, 0, 0, 0, Appointment.duration_minutes)
                > scheduled_at,
            ),
            and_(
                Appointment.scheduled_at >= scheduled_at,
                Appointment.scheduled_at < end_time,
            ),
        ),
    )
    if exclude_id:
        query = query.where(Appointment.id != exclude_id)

    result = await db.execute(query)
    return result.scalar_one_or_none() is None


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Programa una nueva cita verificando disponibilidad del doctor."""
    # Simple overlap check using Python logic (compatible with all DB versions)
    end_time = payload.scheduled_at + timedelta(minutes=payload.duration_minutes)

    existing = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == payload.doctor_id,
            Appointment.status.notin_(
                [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]
            ),
            Appointment.scheduled_at < end_time,
        )
    )
    for appt in existing.scalars().all():
        appt_end = appt.scheduled_at + timedelta(minutes=appt.duration_minutes)
        if appt_end > payload.scheduled_at:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Doctor has a conflicting appointment at {appt.scheduled_at.isoformat()}",
            )

    appointment = Appointment(
        clinic_id=current_user.clinic_id,
        **payload.model_dump(),
    )
    db.add(appointment)
    await db.flush()
    await db.refresh(appointment)
    return appointment


@router.get("", response_model=PaginatedResponse)
async def list_appointments(
    doctor_id: Optional[int] = Query(default=None),
    patient_id: Optional[int] = Query(default=None),
    status_filter: Optional[AppointmentStatus] = Query(default=None, alias="status"),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Lista citas con filtros por doctor, paciente, status y rango de fechas."""
    query = select(Appointment).where(Appointment.clinic_id == current_user.clinic_id)

    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    if patient_id:
        query = query.where(Appointment.patient_id == patient_id)
    if status_filter:
        query = query.where(Appointment.status == status_filter)
    if date_from:
        query = query.where(Appointment.scheduled_at >= date_from)
    if date_to:
        query = query.where(Appointment.scheduled_at <= date_to)

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    result = await db.execute(
        query.order_by(Appointment.scheduled_at)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[AppointmentResponse.model_validate(a) for a in items],
    )


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.clinic_id == current_user.clinic_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Actualiza estado o detalles de una cita."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.clinic_id == current_user.clinic_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(appt, field, value)

    await db.flush()
    await db.refresh(appt)
    return appt