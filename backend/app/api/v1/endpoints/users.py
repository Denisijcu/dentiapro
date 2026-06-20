"""
DentiaPro — Users Router (COMPLETO)
Vertex Coders LLC
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.dependencies import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.models import User
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# Schemas locales para endpoints nuevos
# ---------------------------------------------------------------------------
class ToggleActivePayload(BaseModel):
    is_active: bool


class ChangePasswordPayload(BaseModel):
    new_password: str = Field(min_length=8)


# ---------------------------------------------------------------------------
# POST /users  — crear usuario (ya existía)
# ---------------------------------------------------------------------------
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        **payload.model_dump(exclude={"password"}),
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# GET /users  — listar (ya existía)
# ---------------------------------------------------------------------------
@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(User)
        .where(User.clinic_id == current_user.clinic_id)  # sin filtro is_active
        .order_by(User.last_name)
    )
    return result.scalars().all()

# ---------------------------------------------------------------------------
# GET /users/{user_id}  — NUEVO
# ---------------------------------------------------------------------------
@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.clinic_id == current_user.clinic_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# PATCH /users/{user_id}  — editar datos (ya existía, extendido)
# ---------------------------------------------------------------------------
@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.clinic_id == current_user.clinic_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# PATCH /users/{user_id}/active  — NUEVO: toggle is_active
# ---------------------------------------------------------------------------
@router.patch("/{user_id}/active", response_model=UserResponse)
async def toggle_active(
    user_id: int,
    payload: ToggleActivePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.clinic_id == current_user.clinic_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = payload.is_active
    await db.flush()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# POST /users/{user_id}/password  — NUEVO: cambiar contraseña (solo admin)
# ---------------------------------------------------------------------------
@router.post("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    user_id: int,
    payload: ChangePasswordPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.clinic_id == current_user.clinic_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    await db.flush()


# ---------------------------------------------------------------------------
# DELETE /users/{user_id}  — desactiva, no borra (ya existía)
# ---------------------------------------------------------------------------
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.clinic_id == current_user.clinic_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await db.flush()