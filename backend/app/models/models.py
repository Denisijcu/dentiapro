"""
DentiaPro — Database Models
SQLAlchemy 2.0 async models. Todos los modelos del sistema.
Vertex Coders LLC
"""
import enum
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    RECEPTIONIST = "receptionist"
    PATIENT = "patient"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class XRayStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    ANALYZED = "analyzed"
    REVIEWED = "reviewed"
    ERROR = "error"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class BloodType(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Clinic
# ---------------------------------------------------------------------------
class Clinic(Base, TimestampMixin):
    __tablename__ = "clinics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    tax_id: Mapped[Optional[str]] = mapped_column(String(50))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="clinic")
    patients: Mapped[List["Patient"]] = relationship("Patient", back_populates="clinic")
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment", back_populates="clinic"
    )


# ---------------------------------------------------------------------------
# User (staff: admin, doctor, receptionist)
# ---------------------------------------------------------------------------
class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    clinic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(500), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.RECEPTIONIST, nullable=False
    )
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    license_number: Mapped[Optional[str]] = mapped_column(String(100))  # Para doctores
    specialty: Mapped[Optional[str]] = mapped_column(String(200))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="users")
    appointments_as_doctor: Mapped[List["Appointment"]] = relationship(
        "Appointment", back_populates="doctor", foreign_keys="Appointment.doctor_id"
    )
    xray_reviews: Mapped[List["XRayAnalysis"]] = relationship(
        "XRayAnalysis", back_populates="reviewed_by"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------
class Patient(Base, TimestampMixin):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    clinic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Personal data
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    national_id: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    gender: Mapped[Optional[str]] = mapped_column(String(20))

    # Medical data
    blood_type: Mapped[BloodType] = mapped_column(
        Enum(BloodType), default=BloodType.UNKNOWN
    )
    allergies: Mapped[Optional[str]] = mapped_column(Text)
    current_medications: Mapped[Optional[str]] = mapped_column(Text)
    medical_notes: Mapped[Optional[str]] = mapped_column(Text)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(200))
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(20))

    # Insurance
    insurance_provider: Mapped[Optional[str]] = mapped_column(String(200))
    insurance_policy_number: Mapped[Optional[str]] = mapped_column(String(100))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="patients")
    clinical_histories: Mapped[List["ClinicalHistory"]] = relationship(
        "ClinicalHistory", back_populates="patient", cascade="all, delete-orphan"
    )
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment", back_populates="patient", cascade="all, delete-orphan"
    )
    xray_analyses: Mapped[List["XRayAnalysis"]] = relationship(
        "XRayAnalysis", back_populates="patient", cascade="all, delete-orphan"
    )
    invoices: Mapped[List["Invoice"]] = relationship(
        "Invoice", back_populates="patient", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    __table_args__ = (
        UniqueConstraint("clinic_id", "national_id", name="uq_patient_national_id_clinic"),
    )


# ---------------------------------------------------------------------------
# Clinical History
# ---------------------------------------------------------------------------
class ClinicalHistory(Base, TimestampMixin):
    __tablename__ = "clinical_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    appointment_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("appointments.id"), nullable=True
    )

    visit_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[str] = mapped_column(Text, nullable=False)
    treatment_performed: Mapped[Optional[str]] = mapped_column(Text)
    treatment_plan: Mapped[Optional[str]] = mapped_column(Text)
    prescriptions: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date)

    # Dental chart — JSON string con el estado de cada diente
    dental_chart: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="clinical_histories")
    doctor: Mapped["User"] = relationship("User", foreign_keys=[doctor_id])
    xray_analyses: Mapped[List["XRayAnalysis"]] = relationship(
        "XRayAnalysis", back_populates="clinical_history"
    )


# ---------------------------------------------------------------------------
# Appointment
# ---------------------------------------------------------------------------
class Appointment(Base, TimestampMixin):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    clinic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED, nullable=False
    )
    appointment_type: Mapped[str] = mapped_column(
        String(100), default="consultation"
    )
    reason: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="appointments")
    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")
    doctor: Mapped["User"] = relationship(
        "User", back_populates="appointments_as_doctor", foreign_keys=[doctor_id]
    )
    invoice: Mapped[Optional["Invoice"]] = relationship(
        "Invoice", back_populates="appointment", uselist=False
    )


# ---------------------------------------------------------------------------
# X-Ray Analysis (AI)
# ---------------------------------------------------------------------------
class XRayAnalysis(Base, TimestampMixin):
    __tablename__ = "xray_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clinical_history_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("clinical_histories.id"), nullable=True
    )
    reviewed_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # File
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    image_public_id: Mapped[str] = mapped_column(String(300), nullable=False)
    image_type: Mapped[str] = mapped_column(String(50), default="panoramic")
    file_size_kb: Mapped[Optional[int]] = mapped_column(Integer)

    # AI Results
    status: Mapped[XRayStatus] = mapped_column(
        Enum(XRayStatus), default=XRayStatus.UPLOADED, nullable=False
    )
    ai_task_id: Mapped[Optional[str]] = mapped_column(String(200))
    ai_findings: Mapped[Optional[str]] = mapped_column(Text)
    ai_diagnosis: Mapped[Optional[str]] = mapped_column(Text)
    ai_recommendations: Mapped[Optional[str]] = mapped_column(Text)
    ai_confidence_score: Mapped[Optional[float]] = mapped_column(Float)
    heatmap_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Doctor review
    doctor_notes: Mapped[Optional[str]] = mapped_column(Text)
    doctor_diagnosis: Mapped[Optional[str]] = mapped_column(Text)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="xray_analyses")
    clinical_history: Mapped[Optional["ClinicalHistory"]] = relationship(
        "ClinicalHistory", back_populates="xray_analyses"
    )
    reviewed_by: Mapped[Optional["User"]] = relationship(
        "User", back_populates="xray_reviews", foreign_keys=[reviewed_by_id]
    )


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------
class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("appointments.id"), nullable=True
    )

    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)

    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False
    )
    items_json: Mapped[str] = mapped_column(Text, default="[]")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="invoices")
    appointment: Mapped[Optional["Appointment"]] = relationship(
        "Appointment", back_populates="invoice"
    )