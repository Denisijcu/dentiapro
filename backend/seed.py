"""
DentiaPro — Seed Script
Popula la DB con datos realistas para desarrollo y testing.
Corre desde la raíz del proyecto: python seed.py
Vertex Coders LLC
"""
import asyncio
from datetime import date, datetime, timezone, timedelta
import json
import random

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import hash_password
from app.models.models import (
    Appointment, AppointmentStatus,
    BloodType,
    ClinicalHistory,
    Clinic,
    Invoice, InvoiceStatus,
    Patient,
    User, UserRole,
    XRayAnalysis, XRayStatus,
)

# ---------------------------------------------------------------------------
# Engine independiente (sin NullPool para seed)
# ---------------------------------------------------------------------------
engine = create_async_engine(settings.DATABASE_URL, echo=False, poolclass=NullPool)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Datos
# ---------------------------------------------------------------------------
CLINIC_DATA = {
    "name": "Clínica DentiaPro",
    "address": "Av. Brickell 1200, Miami, FL 33131",
    "phone": "+1-305-555-0100",
    "email": "contacto@dentiapro.com",
    "tax_id": "EIN-123456789",
}

USERS_DATA = [
    {
        "email": "admin@dentiapro.com",
        "password": "Admin123",
        "first_name": "Denis",
        "last_name": "Admin",
        "role": UserRole.ADMIN,
        "phone": "+1-305-555-0001",
    },
    {
        "email": "dr.garcia@dentiapro.com",
        "password": "Doctor123",
        "first_name": "Carlos",
        "last_name": "García",
        "role": UserRole.DOCTOR,
        "phone": "+1-305-555-0002",
        "license_number": "DDS-FL-4521",
        "specialty": "Ortodoncia",
    },
    {
        "email": "dr.martinez@dentiapro.com",
        "password": "Doctor123",
        "first_name": "Sofía",
        "last_name": "Martínez",
        "role": UserRole.DOCTOR,
        "phone": "+1-305-555-0003",
        "license_number": "DDS-FL-7832",
        "specialty": "Endodoncia",
    },
    {
        "email": "recepcion@dentiapro.com",
        "password": "Recep123",
        "first_name": "Laura",
        "last_name": "Pérez",
        "role": UserRole.RECEPTIONIST,
        "phone": "+1-305-555-0004",
    },
]

PATIENTS_DATA = [
    {
        "first_name": "Juan",       "last_name": "Rodríguez",
        "date_of_birth": date(1985, 3, 15), "phone": "+1-305-555-1001",
        "email": "juan.rodriguez@gmail.com", "national_id": "V-12345678",
        "blood_type": BloodType.O_POS, "gender": "M",
        "allergies": "Penicilina",
        "current_medications": "Ninguno",
        "insurance_provider": "BlueCross",
        "insurance_policy_number": "BC-789456",
        "emergency_contact_name": "María Rodríguez",
        "emergency_contact_phone": "+1-305-555-1099",
    },
    {
        "first_name": "Ana",        "last_name": "López",
        "date_of_birth": date(1992, 7, 22), "phone": "+1-305-555-1002",
        "email": "ana.lopez@gmail.com", "national_id": "V-23456789",
        "blood_type": BloodType.A_POS, "gender": "F",
        "allergies": None,
        "current_medications": "Metformina 500mg",
        "insurance_provider": "Aetna",
        "insurance_policy_number": "AE-123789",
        "emergency_contact_name": "Pedro López",
        "emergency_contact_phone": "+1-305-555-1098",
    },
    {
        "first_name": "Carlos",     "last_name": "Mendoza",
        "date_of_birth": date(1978, 11, 8), "phone": "+1-305-555-1003",
        "email": "carlos.mendoza@hotmail.com", "national_id": "V-34567890",
        "blood_type": BloodType.B_NEG, "gender": "M",
        "allergies": "Látex, Ibuprofeno",
        "current_medications": "Atorvastatina 20mg, Lisinopril 10mg",
        "insurance_provider": "Cigna",
        "insurance_policy_number": "CG-456123",
        "emergency_contact_name": "Rosa Mendoza",
        "emergency_contact_phone": "+1-305-555-1097",
    },
    {
        "first_name": "María",      "last_name": "González",
        "date_of_birth": date(2001, 5, 30), "phone": "+1-305-555-1004",
        "email": "maria.gonzalez@gmail.com", "national_id": "V-45678901",
        "blood_type": BloodType.AB_POS, "gender": "F",
        "allergies": None,
        "current_medications": "Anticonceptivos orales",
        "insurance_provider": None,
        "emergency_contact_name": "Luis González",
        "emergency_contact_phone": "+1-305-555-1096",
    },
    {
        "first_name": "Roberto",    "last_name": "Sánchez",
        "date_of_birth": date(1965, 9, 12), "phone": "+1-305-555-1005",
        "email": "roberto.sanchez@yahoo.com", "national_id": "V-56789012",
        "blood_type": BloodType.O_NEG, "gender": "M",
        "allergies": "Sulfonamidas",
        "current_medications": "Metoprolol 50mg, Aspirina 100mg",
        "insurance_provider": "United Health",
        "insurance_policy_number": "UH-987654",
        "emergency_contact_name": "Elena Sánchez",
        "emergency_contact_phone": "+1-305-555-1095",
    },
    {
        "first_name": "Valentina",  "last_name": "Torres",
        "date_of_birth": date(1998, 2, 14), "phone": "+1-305-555-1006",
        "email": "val.torres@gmail.com", "national_id": "V-67890123",
        "blood_type": BloodType.A_NEG, "gender": "F",
        "allergies": None,
        "current_medications": None,
        "insurance_provider": "BlueCross",
        "insurance_policy_number": "BC-321654",
        "emergency_contact_name": "Carmen Torres",
        "emergency_contact_phone": "+1-305-555-1094",
    },
    {
        "first_name": "Miguel",     "last_name": "Herrera",
        "date_of_birth": date(1955, 6, 25), "phone": "+1-305-555-1007",
        "email": "miguel.herrera@gmail.com", "national_id": "V-78901234",
        "blood_type": BloodType.B_POS, "gender": "M",
        "allergies": "Aspirina, AINES",
        "current_medications": "Losartan 50mg, Omeprazol 20mg, Metformina 1000mg",
        "insurance_provider": "Medicare",
        "insurance_policy_number": "MC-741852",
        "emergency_contact_name": "Isabel Herrera",
        "emergency_contact_phone": "+1-305-555-1093",
    },
    {
        "first_name": "Camila",     "last_name": "Vargas",
        "date_of_birth": date(2010, 8, 3), "phone": "+1-305-555-1008",
        "email": None, "national_id": "V-89012345",
        "blood_type": BloodType.O_POS, "gender": "F",
        "allergies": None,
        "current_medications": None,
        "insurance_provider": "Aetna",
        "insurance_policy_number": "AE-654321",
        "emergency_contact_name": "Jorge Vargas",
        "emergency_contact_phone": "+1-305-555-1092",
    },
]

CLINICAL_HISTORY_TEMPLATES = [
    {
        "chief_complaint": "Dolor agudo en molar inferior derecho, empeora con el frío",
        "diagnosis": "Pulpitis irreversible en diente 46. Posible necesidad de tratamiento de conducto.",
        "treatment_performed": "Examen clínico completo, pruebas de vitalidad pulpar, radiografía periapical.",
        "treatment_plan": "Endodoncia en diente 46. Se programa para próxima semana.",
        "prescriptions": "Ibuprofeno 400mg cada 8h por 3 días, Amoxicilina 500mg cada 8h por 7 días",
        "notes": "Paciente refiere que el dolor inició hace 5 días. Sensibilidad marcada al frío.",
    },
    {
        "chief_complaint": "Revisión de ortodoncia mensual — brackets superiores",
        "diagnosis": "Progreso adecuado del tratamiento ortodóncico. Leve apiñamiento residual en sector anterior.",
        "treatment_performed": "Cambio de arco superior a 0.019x0.025 acero. Ajuste de torque en incisivos.",
        "treatment_plan": "Continuar con el plan de tratamiento. Próxima cita en 4 semanas.",
        "prescriptions": "Cera ortodóncica para zonas de roce",
        "notes": "El paciente reporta buena higiene. Se refuerza técnica de cepillado con brackets.",
    },
    {
        "chief_complaint": "Sangrado de encías al cepillarse y mal aliento persistente",
        "diagnosis": "Gingivitis moderada generalizada con bolsas periodontales de 4-5mm en sectores posteriores.",
        "treatment_performed": "Profilaxis dental completa. Raspado y alisado radicular cuadrante superior derecho.",
        "treatment_plan": "Raspado y alisado radicular por cuadrantes (4 sesiones). Control en 3 semanas.",
        "prescriptions": "Colutorio de Clorhexidina 0.12% dos veces al día por 2 semanas",
        "notes": "Se instruye al paciente sobre técnica de Bass para cepillado. Uso de hilo dental diario.",
    },
    {
        "chief_complaint": "Caries extensa en premolar superior izquierdo — ya no aguanta el dolor",
        "diagnosis": "Caries profunda diente 25 comprometiendo la pulpa. Resto radicular no restaurable.",
        "treatment_performed": "Extracción diente 25 bajo anestesia local. Curetaje del alveolo.",
        "treatment_plan": "Cierre espontáneo del alveolo. Valorar implante o prótesis parcial en 3 meses.",
        "prescriptions": "Ibuprofeno 600mg cada 8h, Amoxicilina 500mg cada 8h por 5 días",
        "notes": "Extracción sin complicaciones. Se entregan indicaciones postoperatorias. No debe fumar.",
    },
    {
        "chief_complaint": "Chequeo de rutina semestral — sin molestias",
        "diagnosis": "Dentición en buen estado general. Caries inicial en fosa oclusal diente 36.",
        "treatment_performed": "Profilaxis, aplicación de flúor. Restauración clase I diente 36 con resina compuesta.",
        "treatment_plan": "Próxima revisión en 6 meses. Sellantes preventivos en dientes 37 y 47.",
        "prescriptions": None,
        "notes": "Paciente refiere dieta alta en azúcares. Se da consejería nutricional y de higiene oral.",
    },
    {
        "chief_complaint": "Sensibilidad dental generalizada al frío y al calor",
        "diagnosis": "Hipersensibilidad dentinaria múltiple por recesión gingival localizada.",
        "treatment_performed": "Aplicación de barniz de flúor 5%. Pulido con pasta desensibilizante.",
        "treatment_plan": "Seguimiento en 4 semanas. Evaluar necesidad de injerto gingival.",
        "prescriptions": "Pasta dental Sensodyne dos veces al día",
        "notes": "Paciente usa cepillo de dureza media-dura. Se indica cambio a cepillo suave.",
    },
]

INVOICE_ITEMS = [
    [{"description": "Consulta de urgencias", "quantity": 1.0, "unit_price": 80.0}],
    [{"description": "Endodoncia molar", "quantity": 1.0, "unit_price": 850.0},
     {"description": "Corona temporal", "quantity": 1.0, "unit_price": 150.0}],
    [{"description": "Profilaxis dental", "quantity": 1.0, "unit_price": 120.0},
     {"description": "Aplicación de flúor", "quantity": 1.0, "unit_price": 45.0},
     {"description": "Radiografía panorámica", "quantity": 1.0, "unit_price": 95.0}],
    [{"description": "Extracción simple", "quantity": 1.0, "unit_price": 180.0},
     {"description": "Anestesia local", "quantity": 1.0, "unit_price": 30.0}],
    [{"description": "Restauración resina clase I", "quantity": 1.0, "unit_price": 220.0}],
    [{"description": "Consulta de ortodoncia", "quantity": 1.0, "unit_price": 75.0},
     {"description": "Activación de aparatos", "quantity": 1.0, "unit_price": 85.0}],
    [{"description": "Raspado y alisado radicular (cuadrante)", "quantity": 2.0, "unit_price": 175.0},
     {"description": "Profilaxis", "quantity": 1.0, "unit_price": 120.0}],
    [{"description": "Blanqueamiento dental", "quantity": 1.0, "unit_price": 350.0},
     {"description": "Consulta de evaluación", "quantity": 1.0, "unit_price": 60.0}],
]


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def seed():
    async with SessionLocal() as db:
        print("🦷 DentiaPro Seed — iniciando...\n")

        # 1. CLINIC
        print("📍 Creando clínica...")
        clinic = Clinic(**CLINIC_DATA)
        db.add(clinic)
        await db.flush()
        print(f"   ✅ {clinic.name} (id={clinic.id})")

        # 2. USERS
        print("\n👤 Creando usuarios...")
        users: list[User] = []
        for u in USERS_DATA:
            user = User(
                clinic_id=clinic.id,
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                first_name=u["first_name"],
                last_name=u["last_name"],
                role=u["role"],
                phone=u.get("phone"),
                license_number=u.get("license_number"),
                specialty=u.get("specialty"),
                is_active=True,
            )
            db.add(user)
            users.append(user)
        await db.flush()
        doctors = [u for u in users if u.role == UserRole.DOCTOR]
        for u in users:
            print(f"   ✅ {u.full_name} ({u.role.value}) — {u.email} / pass: {USERS_DATA[users.index(u)]['password']}")

        # 3. PATIENTS
        print("\n🧑‍⚕️ Creando pacientes...")
        patients: list[Patient] = []
        for p in PATIENTS_DATA:
            patient = Patient(clinic_id=clinic.id, **p)
            db.add(patient)
            patients.append(patient)
        await db.flush()
        for p in patients:
            print(f"   ✅ {p.full_name} (id={p.id})")

        # 4. APPOINTMENTS
        print("\n📅 Creando citas...")
        now = datetime.now(timezone.utc)
        appt_count = 0
        appointments: list[Appointment] = []

        statuses_past = [
            AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED,
            AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW,
            AppointmentStatus.CANCELLED,
        ]

        for i, patient in enumerate(patients):
            doctor = doctors[i % len(doctors)]

            # 2 citas pasadas por paciente
            for j in range(2):
                days_ago = random.randint(10, 90)
                appt = Appointment(
                    clinic_id=clinic.id,
                    patient_id=patient.id,
                    doctor_id=doctor.id,
                    scheduled_at=now - timedelta(days=days_ago, hours=random.randint(8, 17)),
                    duration_minutes=random.choice([30, 45, 60, 90]),
                    status=random.choice(statuses_past),
                    appointment_type=random.choice(["consultation", "procedure", "follow_up", "cleaning"]),
                    reason=random.choice([
                        "Dolor dental", "Revisión periódica", "Seguimiento tratamiento",
                        "Urgencia", "Limpieza dental", "Control de ortodoncia",
                    ]),
                )
                db.add(appt)
                appointments.append(appt)
                appt_count += 1

            # 1 cita futura por paciente
            days_ahead = random.randint(1, 30)
            appt_future = Appointment(
                clinic_id=clinic.id,
                patient_id=patient.id,
                doctor_id=doctor.id,
                scheduled_at=now + timedelta(days=days_ahead, hours=random.randint(8, 17)),
                duration_minutes=random.choice([30, 45, 60]),
                status=AppointmentStatus.SCHEDULED,
                appointment_type=random.choice(["consultation", "procedure", "follow_up"]),
                reason="Cita programada",
            )
            db.add(appt_future)
            appointments.append(appt_future)
            appt_count += 1

        await db.flush()
        print(f"   ✅ {appt_count} citas creadas")

        # 5. CLINICAL HISTORY
        print("\n📋 Creando historias clínicas...")
        ch_count = 0
        completed_appts = [a for a in appointments if a.status == AppointmentStatus.COMPLETED]

        for i, patient in enumerate(patients):
            # 2-4 entradas por paciente
            num_entries = random.randint(2, 4)
            patient_appts = [a for a in completed_appts if a.patient_id == patient.id]

            for j in range(num_entries):
                template = CLINICAL_HISTORY_TEMPLATES[(i + j) % len(CLINICAL_HISTORY_TEMPLATES)]
                doctor = doctors[i % len(doctors)]
                days_ago = random.randint(5, 120)
                appt_id = patient_appts[j].id if j < len(patient_appts) else None

                follow_up = None
                if random.random() > 0.4:
                    follow_up = (now + timedelta(days=random.randint(7, 60))).date()

                ch = ClinicalHistory(
                    patient_id=patient.id,
                    doctor_id=doctor.id,
                    appointment_id=appt_id,
                    visit_date=now - timedelta(days=days_ago - j * 15),
                    chief_complaint=template["chief_complaint"],
                    diagnosis=template["diagnosis"],
                    treatment_performed=template["treatment_performed"],
                    treatment_plan=template["treatment_plan"],
                    prescriptions=template["prescriptions"],
                    notes=template["notes"],
                    follow_up_date=follow_up,
                )
                db.add(ch)
                ch_count += 1

        await db.flush()
        print(f"   ✅ {ch_count} entradas clínicas creadas")

        # 6. INVOICES
        print("\n💰 Creando facturas...")
        inv_count = 0
        inv_statuses = [
            InvoiceStatus.PAID, InvoiceStatus.PAID, InvoiceStatus.ISSUED,
            InvoiceStatus.OVERDUE, InvoiceStatus.PAID,
        ]

        for i, patient in enumerate(patients):
            num_invoices = random.randint(1, 3)
            for j in range(num_invoices):
                items = INVOICE_ITEMS[(i + j) % len(INVOICE_ITEMS)]
                subtotal = sum(it["quantity"] * it["unit_price"] for it in items)
                tax_rate = 0.0          # sin IVA por defecto
                discount = random.choice([0.0, 0.0, 0.0, 10.0, 20.0])
                tax_amount = round(subtotal * tax_rate, 2)
                total = round(subtotal + tax_amount - discount, 2)
                inv_status = random.choice(inv_statuses)
                days_ago = random.randint(5, 180)
                issue_date = (now - timedelta(days=days_ago)).date()

                invoice = Invoice(
                    patient_id=patient.id,
                    invoice_number=f"DP-{clinic.id:04d}-{now.strftime('%Y')}-{inv_count+1:04d}",
                    issue_date=issue_date,
                    due_date=issue_date + timedelta(days=30),
                    subtotal=round(subtotal, 2),
                    tax_rate=tax_rate,
                    tax_amount=tax_amount,
                    discount_amount=discount,
                    total=total,
                    status=inv_status,
                    items_json=json.dumps(items),
                    paid_at=now - timedelta(days=random.randint(1, days_ago)) if inv_status == InvoiceStatus.PAID else None,
                    notes=f"Servicios prestados a {patient.full_name}",
                )
                db.add(invoice)
                inv_count += 1

        await db.flush()
        print(f"   ✅ {inv_count} facturas creadas")

        # 7. COMMIT
        await db.commit()
        print("\n" + "="*50)
        print("✅ Seed completado exitosamente")
        print("="*50)
        print(f"\n📊 Resumen:")
        print(f"   • 1 clínica")
        print(f"   • {len(users)} usuarios")
        print(f"   • {len(patients)} pacientes")
        print(f"   • {appt_count} citas")
        print(f"   • {ch_count} entradas clínicas")
        print(f"   • {inv_count} facturas")
        print(f"\n🔑 Credenciales:")
        print(f"   Admin:        admin@dentiapro.com      / Admin123")
        print(f"   Doctor 1:     dr.garcia@dentiapro.com  / Doctor123")
        print(f"   Doctor 2:     dr.martinez@dentiapro.com / Doctor123")
        print(f"   Recepción:    recepcion@dentiapro.com  / Recep123")


if __name__ == "__main__":
    asyncio.run(seed())