"""
DentiaPro — API v1 Router
Registra todos los routers del sistema.
Vertex Coders LLC
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    appointments,
    auth,
    chat,
    clinical_history,
    invoices,
    patients,
    users,
    xray,
)

from app.api.v1.endpoints import chat

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(chat.router)

api_router.include_router(patients.router)
api_router.include_router(appointments.router)
api_router.include_router(clinical_history.router)
api_router.include_router(invoices.router)
api_router.include_router(xray.router)