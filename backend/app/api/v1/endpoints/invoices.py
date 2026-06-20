"""
DentiaPro — Invoices Router (COMPLETO)
Vertex Coders LLC
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin, require_staff
from app.db.session import get_db
from app.models.models import Invoice, InvoiceStatus, Patient, User
from app.schemas.schemas import InvoiceCreate, InvoiceResponse

router = APIRouter(prefix="/invoices", tags=["invoices"])


class CancelPayload(BaseModel):
    reason: Optional[str] = None


def _serialize_invoice(inv: Invoice, patient: Optional[Patient]) -> dict:
    return {
        "id": inv.id,
        "patient_id": inv.patient_id,
        "appointment_id": inv.appointment_id,
        "invoice_number": inv.invoice_number,
        "issue_date": str(inv.issue_date),
        "due_date": str(inv.due_date) if inv.due_date else None,
        "subtotal": inv.subtotal,
        "tax_rate": inv.tax_rate,
        "tax_amount": inv.tax_amount,
        "discount_amount": inv.discount_amount,
        "total": inv.total,
        "status": inv.status.value,
        "notes": inv.notes,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "created_at": inv.created_at.isoformat(),
        "updated_at": inv.updated_at.isoformat(),
        "patient_name": patient.full_name if patient else "N/A",
        "patient_national_id": patient.national_id if patient else None,
        "items": json.loads(inv.items_json) if inv.items_json else [],
    }


def _generate_invoice_number(clinic_id: int) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"DP-{clinic_id:04d}-{timestamp}"


# GET /invoices/summary
@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    all_result = await db.execute(
        select(Invoice)
        .join(Patient, Invoice.patient_id == Patient.id)
        .where(Patient.clinic_id == current_user.clinic_id)
    )
    all_invoices = all_result.scalars().all()

    month_result = await db.execute(
        select(func.count(Invoice.id))
        .join(Patient, Invoice.patient_id == Patient.id)
        .where(Patient.clinic_id == current_user.clinic_id, Invoice.created_at >= month_start)
    )
    facturas_mes = month_result.scalar_one() or 0

    return {
        "total_facturado": round(sum(i.total for i in all_invoices if i.status != InvoiceStatus.CANCELLED), 2),
        "total_cobrado":   round(sum(i.total for i in all_invoices if i.status == InvoiceStatus.PAID), 2),
        "total_pendiente": round(sum(i.total for i in all_invoices if i.status in (InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE)), 2),
        "facturas_mes":    facturas_mes,
    }


# GET /invoices  (lista paginada)
@router.get("")
async def list_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    invoice_status: Optional[str] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    base_q = (
        select(Invoice)
        .join(Patient, Invoice.patient_id == Patient.id)
        .where(Patient.clinic_id == current_user.clinic_id)
    )
    if invoice_status:
        try:
            base_q = base_q.where(Invoice.status == InvoiceStatus(invoice_status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status '{invoice_status}'. Valid: draft, issued, paid, overdue, cancelled")

    total = (await db.execute(select(func.count()).select_from(base_q.subquery()))).scalar_one() or 0
    invoices = (await db.execute(base_q.order_by(Invoice.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()

    patient_ids = list({i.patient_id for i in invoices})
    patients_map = {}
    if patient_ids:
        pr = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        patients_map = {p.id: p for p in pr.scalars().all()}

    return {"total": total, "page": page, "page_size": page_size,
            "items": [_serialize_invoice(inv, patients_map.get(inv.patient_id)) for inv in invoices]}


# GET /invoices/patient/{patient_id}
@router.get("/patient/{patient_id}")
async def get_patient_invoices(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    invoices = (await db.execute(select(Invoice).where(Invoice.patient_id == patient_id).order_by(Invoice.issue_date.desc()))).scalars().all()
    patient = (await db.execute(select(Patient).where(Patient.id == patient_id))).scalar_one_or_none()
    return [_serialize_invoice(inv, patient) for inv in invoices]


# GET /invoices/{invoice_id}
@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    patient = (await db.execute(select(Patient).where(Patient.id == invoice.patient_id))).scalar_one_or_none()
    return _serialize_invoice(invoice, patient)


# POST /invoices
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    patient = (await db.execute(select(Patient).where(Patient.id == payload.patient_id, Patient.clinic_id == current_user.clinic_id))).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    subtotal   = sum(item.quantity * item.unit_price for item in payload.items)
    tax_amount = round(subtotal * payload.tax_rate, 2)
    total      = round(subtotal + tax_amount - payload.discount_amount, 2)

    invoice = Invoice(
        patient_id=payload.patient_id,
        appointment_id=payload.appointment_id,
        invoice_number=_generate_invoice_number(current_user.clinic_id),
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        subtotal=round(subtotal, 2),
        tax_rate=payload.tax_rate,
        tax_amount=tax_amount,
        discount_amount=payload.discount_amount,
        total=total,
        status=InvoiceStatus.ISSUED,
        items_json=json.dumps([item.model_dump() for item in payload.items]),
        notes=payload.notes,
    )
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return _serialize_invoice(invoice, patient)


# POST /invoices/{invoice_id}/pay
@router.post("/{invoice_id}/pay")
async def mark_as_paid(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="Invoice already paid")
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot pay a cancelled invoice")

    invoice.status  = InvoiceStatus.PAID
    invoice.paid_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(invoice)
    patient = (await db.execute(select(Patient).where(Patient.id == invoice.patient_id))).scalar_one_or_none()
    return _serialize_invoice(invoice, patient)


# POST /invoices/{invoice_id}/cancel
@router.post("/{invoice_id}/cancel")
async def cancel_invoice(
    invoice_id: int,
    payload: CancelPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Invoice already cancelled")

    invoice.status = InvoiceStatus.CANCELLED
    note = f"\n[CANCELADA por {current_user.full_name}] {payload.reason or ''}".strip()
    invoice.notes = (invoice.notes or "") + note
    await db.flush()
    await db.refresh(invoice)
    patient = (await db.execute(select(Patient).where(Patient.id == invoice.patient_id))).scalar_one_or_none()
    return _serialize_invoice(invoice, patient)


# GET /invoices/{invoice_id}/pdf
@router.get("/{invoice_id}/pdf")
async def download_pdf(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    patient = (await db.execute(select(Patient).where(Patient.id == invoice.patient_id))).scalar_one_or_none()
    items = json.loads(invoice.items_json) if invoice.items_json else []

    try:
        from io import BytesIO
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                leftMargin=0.75*inch, rightMargin=0.75*inch,
                                topMargin=0.75*inch, bottomMargin=0.75*inch)
        styles = getSampleStyleSheet()
        elements = []

        elements.append(Paragraph("DentiaPro", styles["Title"]))
        elements.append(Paragraph(f"Factura {invoice.invoice_number}", styles["Heading2"]))
        elements.append(Spacer(1, 0.15*inch))

        info = [
            ["Fecha:", str(invoice.issue_date), "Paciente:", patient.full_name if patient else "N/A"],
            ["Vence:", str(invoice.due_date) if invoice.due_date else "—", "ID:", patient.national_id if patient and patient.national_id else "—"],
            ["Estado:", invoice.status.value.upper(), "", ""],
        ]
        info_t = Table(info, colWidths=[1.2*inch, 2.3*inch, 1*inch, 2.2*inch])
        info_t.setStyle(TableStyle([("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),("FONTNAME",(2,0),(2,-1),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),9)]))
        elements.append(info_t)
        elements.append(Spacer(1, 0.25*inch))

        rows = [["Descripción", "Cant.", "Precio Unit.", "Subtotal"]]
        for item in items:
            q, p = item.get("quantity", 0), item.get("unit_price", 0)
            rows.append([item.get("description",""), str(q), f"${p:.2f}", f"${q*p:.2f}"])

        t = Table(rows, colWidths=[3.8*inch, 0.8*inch, 1.2*inch, 1.2*inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#2B6CB0")),
            ("TEXTCOLOR",(0,0),(-1,0),colors.white),
            ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
            ("FONTSIZE",(0,0),(-1,-1),9),
            ("ALIGN",(1,0),(-1,-1),"RIGHT"),
            ("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#F7FAFC")]),
            ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 0.2*inch))

        totales = [
            ["","Subtotal", f"${invoice.subtotal:.2f}"],
            ["",f"Descuento", f"-${invoice.discount_amount:.2f}"],
            ["",f"Impuesto ({invoice.tax_rate*100:.1f}%)", f"${invoice.tax_amount:.2f}"],
            ["","TOTAL", f"${invoice.total:.2f}"],
        ]
        tt = Table(totales, colWidths=[4.5*inch, 1.5*inch, 1*inch])
        tt.setStyle(TableStyle([
            ("ALIGN",(1,0),(-1,-1),"RIGHT"),
            ("FONTNAME",(1,3),(-1,3),"Helvetica-Bold"),
            ("FONTSIZE",(1,3),(-1,3),11),
            ("LINEABOVE",(1,3),(-1,3),1,colors.HexColor("#2B6CB0")),
            ("TEXTCOLOR",(1,3),(-1,3),colors.HexColor("#2B6CB0")),
        ]))
        elements.append(tt)

        if invoice.notes:
            elements.append(Spacer(1, 0.2*inch))
            elements.append(Paragraph(f"<b>Notas:</b> {invoice.notes}", styles["Normal"]))

        doc.build(elements)
        return Response(content=buffer.getvalue(), media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'})
    except ImportError:
        raise HTTPException(status_code=501, detail="Run: pip install reportlab")