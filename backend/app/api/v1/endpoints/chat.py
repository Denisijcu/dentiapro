"""
DentiaPro — Chat Assistant Router
Chatbot con acceso a la DB usando Claude API.
Vertex Coders LLC
"""
from datetime import datetime, timezone
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import require_staff
from app.db.session import get_db
from app.models.models import (
    Appointment, AppointmentStatus,
    ClinicalHistory,
    Invoice, InvoiceStatus,
    Patient,
    User,
)

router = APIRouter(prefix="/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str


# ---------------------------------------------------------------------------
# Recopilar contexto de la DB para el sistema
# ---------------------------------------------------------------------------
async def get_clinic_context(db: AsyncSession, clinic_id: int) -> str:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Totales generales
    total_patients = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id, Patient.is_active == True
        )
    )).scalar_one() or 0

    total_users = (await db.execute(
        select(func.count(User.id)).where(
            User.clinic_id == clinic_id, User.is_active == True
        )
    )).scalar_one() or 0

    # Citas de hoy
    today_appts = (await db.execute(
        select(Appointment).where(
            Appointment.clinic_id == clinic_id,
            Appointment.scheduled_at >= today_start,
            Appointment.scheduled_at < now.replace(hour=23, minute=59, second=59),
        ).order_by(Appointment.scheduled_at)
    )).scalars().all()

    # Próximas citas (7 días)
    next_week = now.replace(hour=23, minute=59) 
    from datetime import timedelta
    next_week = now + timedelta(days=7)
    upcoming_appts = (await db.execute(
        select(Appointment).where(
            Appointment.clinic_id == clinic_id,
            Appointment.scheduled_at > now,
            Appointment.scheduled_at <= next_week,
            Appointment.status == AppointmentStatus.SCHEDULED,
        ).order_by(Appointment.scheduled_at).limit(10)
    )).scalars().all()

    # Facturas pendientes
    pending_invoices = (await db.execute(
        select(Invoice).join(Patient).where(
            Patient.clinic_id == clinic_id,
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE]),
        ).order_by(Invoice.due_date).limit(10)
    )).scalars().all()

    total_pendiente = (await db.execute(
        select(func.sum(Invoice.total)).join(Patient).where(
            Patient.clinic_id == clinic_id,
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE]),
        )
    )).scalar_one() or 0

    total_cobrado = (await db.execute(
        select(func.sum(Invoice.total)).join(Patient).where(
            Patient.clinic_id == clinic_id,
            Invoice.status == InvoiceStatus.PAID,
        )
    )).scalar_one() or 0

    # Pacientes recientes
    recent_patients = (await db.execute(
        select(Patient).where(
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,
        ).order_by(Patient.created_at.desc()).limit(5)
    )).scalars().all()

    # Staff de la clínica
    staff = (await db.execute(
        select(User).where(
            User.clinic_id == clinic_id,
            User.is_active == True,
        ).order_by(User.role)
    )).scalars().all()

    # Construir contexto
    ctx = f"""
=== DATOS EN TIEMPO REAL DE LA CLÍNICA (actualizado: {now.strftime('%d/%m/%Y %H:%M')}) ===

RESUMEN GENERAL:
- Pacientes activos: {total_patients}
- Personal activo: {total_users}
- Monto pendiente de cobro: ${total_pendiente:,.2f}
- Total cobrado: ${total_cobrado:,.2f}

CITAS DE HOY ({now.strftime('%d/%m/%Y')}):
"""
    if today_appts:
        for a in today_appts:
            # Obtener nombre del paciente
            pat = (await db.execute(select(Patient).where(Patient.id == a.patient_id))).scalar_one_or_none()
            pat_name = pat.full_name if pat else f"Paciente #{a.patient_id}"
            ctx += f"  - {a.scheduled_at.strftime('%H:%M')} | {pat_name} | {a.appointment_type} | Estado: {a.status.value}\n"
    else:
        ctx += "  - No hay citas programadas para hoy\n"

    ctx += f"\nPRÓXIMAS CITAS (próximos 7 días):\n"
    if upcoming_appts:
        for a in upcoming_appts:
            pat = (await db.execute(select(Patient).where(Patient.id == a.patient_id))).scalar_one_or_none()
            pat_name = pat.full_name if pat else f"Paciente #{a.patient_id}"
            ctx += f"  - {a.scheduled_at.strftime('%d/%m %H:%M')} | {pat_name} | {a.appointment_type}\n"
    else:
        ctx += "  - No hay citas próximas\n"

    ctx += f"\nFACTURAS PENDIENTES DE COBRO:\n"
    if pending_invoices:
        for inv in pending_invoices:
            pat = (await db.execute(select(Patient).where(Patient.id == inv.patient_id))).scalar_one_or_none()
            pat_name = pat.full_name if pat else f"Paciente #{inv.patient_id}"
            vence = inv.due_date.strftime('%d/%m/%Y') if inv.due_date else "Sin vencimiento"
            ctx += f"  - {inv.invoice_number} | {pat_name} | ${inv.total:,.2f} | Vence: {vence} | Estado: {inv.status.value}\n"
    else:
        ctx += "  - No hay facturas pendientes\n"

    ctx += f"\nPACIENTES REGISTRADOS RECIENTEMENTE:\n"
    for p in recent_patients:
        ctx += f"  - {p.full_name} | Tel: {p.phone} | {p.created_at.strftime('%d/%m/%Y')}\n"

    ctx += f"\nPERSONAL DE LA CLÍNICA:\n"
    for u in staff:
        spec = f" ({u.specialty})" if u.specialty else ""
        ctx += f"  - {u.full_name} | {u.role.value}{spec} | {u.email}\n"

    return ctx


# ---------------------------------------------------------------------------
# System prompt del asistente
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """Eres el asistente virtual de DentiaPro, una plataforma de gestión de clínica dental.

Tu nombre es **DentyAI** y eres un asistente experto en:
- Gestión de citas dentales (agendar, cancelar, reprogramar)
- Información de pacientes (historial, datos de contacto, alergias)
- Facturación y cobros (facturas pendientes, pagos, estados)
- Historia clínica (entradas, diagnósticos, tratamientos)
- Gestión del personal de la clínica
- Análisis de rayos X con IA (módulo Rayos X)

MÓDULOS DEL SISTEMA:
- Dashboard: Resumen general con KPIs
- Pacientes (/patients): CRUD completo de pacientes
- Citas (/appointments): Gestión de agenda
- Rayos X (/xray): Análisis IA de radiografías con Claude Vision
- Facturas (/invoices): Facturación electrónica
- Usuarios (/users): Gestión del personal (solo admin)
- Historia Clínica: Accesible desde el detalle de cada paciente

CAPACIDADES:
- Consultar datos en tiempo real de la clínica
- Responder preguntas sobre pacientes específicos
- Informar sobre citas del día y próximas
- Verificar estados de facturas
- Orientar al usuario sobre cómo usar el sistema
- Dar recomendaciones clínicas basadas en el contexto

REGLAS:
- Responde siempre en español
- Sé conciso y directo — las recepcionistas tienen poco tiempo
- Si te preguntan por un paciente específico, busca en los datos del contexto
- Para acciones que requieren modificar datos, indica al usuario dónde hacerlo en el sistema
- Nunca inventes datos — solo usa la información del contexto proporcionado
- Usa emojis con moderación para hacer las respuestas más legibles

Los datos en tiempo real de la clínica se incluirán en cada mensaje del sistema."""


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Anthropic API key not configured")

    # Contexto en tiempo real de la DB
    clinic_context = await get_clinic_context(db, current_user.clinic_id)

    system_with_context = f"{SYSTEM_PROMPT}\n\n{clinic_context}"

    # Construir historial de mensajes
    messages = []
    for msg in request.history[-10:]:  # máximo 10 turnos de historial
        messages.append({"role": msg.role, "content": msg.content})

    # Agregar mensaje actual
    messages.append({"role": "user", "content": request.message})

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=system_with_context,
            messages=messages,
        )
        reply = response.content[0].text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling Claude API: {str(e)}")

    return ChatResponse(reply=reply)