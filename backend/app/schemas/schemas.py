"""
DentiaPro — Pydantic Schemas
Request/response schemas para todos los endpoints.
Vertex Coders LLC
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.models import (
    AppointmentStatus,
    BloodType,
    InvoiceStatus,
    UserRole,
    XRayStatus,
)


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------
class TimestampSchema(BaseModel):
    created_at: datetime
    updated_at: datetime


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Clinic
# ---------------------------------------------------------------------------
class ClinicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str = Field(min_length=5, max_length=500)
    phone: str = Field(min_length=7, max_length=20)
    email: EmailStr
    tax_id: Optional[str] = None


class ClinicUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    address: Optional[str] = Field(default=None, min_length=5, max_length=500)
    phone: Optional[str] = Field(default=None, min_length=7, max_length=20)


class ClinicResponse(TimestampSchema):
    id: int
    name: str
    address: str
    phone: str
    email: str
    tax_id: Optional[str]
    logo_url: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    clinic_id: int
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    role: UserRole = UserRole.RECEPTIONIST
    phone: Optional[str] = None
    license_number: Optional[str] = None
    specialty: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = None
    specialty: Optional[str] = None
    license_number: Optional[str] = None


class UserResponse(TimestampSchema):
    id: int
    clinic_id: int
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: UserRole
    phone: Optional[str]
    license_number: Optional[str]
    specialty: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    last_login: Optional[datetime]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    date_of_birth: date
    phone: str = Field(min_length=7, max_length=20)
    email: Optional[EmailStr] = None
    national_id: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    blood_type: BloodType = BloodType.UNKNOWN
    allergies: Optional[str] = None
    current_medications: Optional[str] = None
    medical_notes: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    blood_type: Optional[BloodType] = None
    allergies: Optional[str] = None
    current_medications: Optional[str] = None
    medical_notes: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None


class PatientResponse(TimestampSchema):
    id: int
    clinic_id: int
    first_name: str
    last_name: str
    full_name: str
    date_of_birth: date
    phone: str
    email: Optional[str]
    national_id: Optional[str]
    address: Optional[str]
    gender: Optional[str]
    blood_type: BloodType
    allergies: Optional[str]
    current_medications: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    insurance_provider: Optional[str]
    insurance_policy_number: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


class PatientSummary(BaseModel):
    """Versión compacta para listas."""
    id: int
    full_name: str
    date_of_birth: date
    phone: str
    email: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Clinical History
# ---------------------------------------------------------------------------
class ClinicalHistoryCreate(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    chief_complaint: str = Field(min_length=5)
    diagnosis: str = Field(min_length=5)
    treatment_performed: Optional[str] = None
    treatment_plan: Optional[str] = None
    prescriptions: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None
    dental_chart: Optional[str] = None


class ClinicalHistoryUpdate(BaseModel):
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_performed: Optional[str] = None
    treatment_plan: Optional[str] = None
    prescriptions: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None
    dental_chart: Optional[str] = None


class ClinicalHistoryResponse(TimestampSchema):
    id: int
    patient_id: int
    doctor_id: int
    appointment_id: Optional[int]
    visit_date: datetime
    chief_complaint: str
    diagnosis: str
    treatment_performed: Optional[str]
    treatment_plan: Optional[str]
    prescriptions: Optional[str]
    notes: Optional[str]
    follow_up_date: Optional[date]
    dental_chart: Optional[str]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Appointment
# ---------------------------------------------------------------------------
class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    appointment_type: str = "consultation"
    reason: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=480)
    status: Optional[AppointmentStatus] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None


class AppointmentResponse(TimestampSchema):
    id: int
    clinic_id: int
    patient_id: int
    doctor_id: int
    scheduled_at: datetime
    duration_minutes: int
    status: AppointmentStatus
    appointment_type: str
    reason: Optional[str]
    notes: Optional[str]
    reminder_sent: bool
    cancellation_reason: Optional[str]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# X-Ray Analysis
# ---------------------------------------------------------------------------
class XRayUploadResponse(BaseModel):
    id: int
    patient_id: int
    image_url: str
    image_type: str
    status: XRayStatus
    ai_task_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class XRayReviewRequest(BaseModel):
    doctor_notes: Optional[str] = None
    doctor_diagnosis: str = Field(min_length=5)


class XRayAnalysisResponse(TimestampSchema):
    id: int
    patient_id: int
    clinical_history_id: Optional[int]
    image_url: str
    image_type: str
    file_size_kb: Optional[int]
    status: XRayStatus
    ai_findings: Optional[str]
    ai_diagnosis: Optional[str]
    ai_recommendations: Optional[str]
    ai_confidence_score: Optional[float]
    heatmap_url: Optional[str]
    doctor_notes: Optional[str]
    doctor_diagnosis: Optional[str]
    reviewed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------
class InvoiceItem(BaseModel):
    description: str
    quantity: float = Field(ge=0)
    unit_price: float = Field(ge=0)

    @property
    def subtotal(self) -> float:
        return round(self.quantity * self.unit_price, 2)


class InvoiceCreate(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    issue_date: date
    due_date: Optional[date] = None
    items: List[InvoiceItem] = Field(min_length=1)
    tax_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    discount_amount: float = Field(default=0.0, ge=0.0)
    notes: Optional[str] = None


class InvoiceResponse(TimestampSchema):
    id: int
    patient_id: int
    appointment_id: Optional[int]
    invoice_number: str
    issue_date: date
    due_date: Optional[date]
    subtotal: float
    tax_rate: float
    tax_amount: float
    discount_amount: float
    total: float
    status: InvoiceStatus
    notes: Optional[str]
    paid_at: Optional[datetime]

    model_config = {"from_attributes": True}