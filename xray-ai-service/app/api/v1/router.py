
"""
DentiaPro — xray-ai-service API Router
Vertex Coders LLC
"""
from fastapi import APIRouter
from app.api.v1.endpoints import analysis

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(analysis.router)