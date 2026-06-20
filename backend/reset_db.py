"""
DentiaPro — Reset DB
Borra y recrea todas las tablas. Corre desde la raíz del backend.
Vertex Coders LLC
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from app.models.models import Base
from app.core.config import settings


async def reset():
    print("⚠️  Reseteando base de datos...")
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("   ✅ Tablas eliminadas")
        await conn.run_sync(Base.metadata.create_all)
        print("   ✅ Tablas recreadas")
    await engine.dispose()
    print("✅ DB reseteada y lista\n")


if __name__ == "__main__":
    asyncio.run(reset())