import asyncio
import sys
sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import Clinic, User, UserRole

async def create_admin():
    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        clinic = Clinic(
            name="Clínica Dental Demo",
            address="123 Calle Principal, Miami FL",
            phone="+1-305-555-0100",
            email="admin@dentiapro.com",
        )
        db.add(clinic)
        await db.flush()

        admin = User(
            clinic_id=clinic.id,
            email="admin@dentiapro.com",
            hashed_password=hash_password("Admin123!"),
            first_name="Admin",
            last_name="DentiaPro",
            role=UserRole.ADMIN,
        )
        db.add(admin)
        await db.commit()
        print(f"✅ Clínica creada: ID={clinic.id}")
        print(f"✅ Admin: admin@dentiapro.com / Admin123!")

asyncio.run(create_admin())