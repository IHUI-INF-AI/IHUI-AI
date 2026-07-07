"""
API routes for custom model provider configuration (developer module).

Endpoints under /api/v1/developer/models/:
- GET    /            List providers (with pagination/filter)
- POST   /            Create provider
- GET    /{id}        Get provider detail
- PUT    /{id}        Update provider
- DELETE /{id}        Delete provider (built-in protected)
- PATCH  /{id}/toggle Enable/disable toggle
- POST   /{id}/test   Test saved provider connection
- POST   /test        Test unsaved config (ad-hoc, before saving)
- GET    /formats     List supported API formats
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import or_

from app.database import get_session
from app.models.developer_models import AiModelConfig
from app.schemas.common import error, success
from app.schemas.developer_models import (
    AiModelConfigCreate,
    AiModelConfigUpdate,
    AiModelTestRequest,
    AiModelToggleRequest,
)
from app.security import require_login
from app.services.model_test_service import get_api_formats, test_model_connection
from app.utils.crypto_util import decrypt_value, encrypt_value, mask_api_key

router = APIRouter(prefix="/models", tags=["Developer: Model Config"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _config_to_dict(cfg: AiModelConfig) -> dict:
    """Convert a model config ORM object to a response dict (apiKey masked)."""
    api_key_plain = decrypt_value(cfg.api_key_enc) if cfg.api_key_enc else ""
    return {
        "id": cfg.id,
        "name": cfg.name,
        "providerCode": cfg.provider_code,
        "isBuiltin": cfg.is_builtin,
        "baseUrl": cfg.base_url,
        "apiFormat": cfg.api_format,
        "apiKey": mask_api_key(api_key_plain),
        "hasApiKey": bool(cfg.api_key_enc),
        "modelIdForTest": cfg.model_id_for_test,
        "enabled": cfg.enabled,
        "description": cfg.description,
        "sortOrder": cfg.sort_order,
        "ownerUuid": cfg.owner_uuid,
        "lastTestStatus": cfg.last_test_status,
        "lastTestResponseMs": cfg.last_test_response_ms,
        "lastTestedAt": cfg.last_tested_at,
        "lastTestError": cfg.last_test_error,
        "extraConfig": cfg.extra_config,
        "createdAt": cfg.created_at.isoformat() if cfg.created_at else None,
        "updatedAt": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/formats", summary="Get supported API formats")
async def get_formats(user_uuid: str = Depends(require_login)):
    """Return the list of supported API formats for the format dropdown."""
    return success(data=get_api_formats())


@router.get("", summary="List model provider configs")
async def list_providers(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
    enabled: Optional[bool] = Query(None),
    providerCode: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    user_uuid: str = Depends(require_login),
):
    """List all model provider configurations with optional filters."""
    with get_session() as db:
        try:
            q = db.query(AiModelConfig)
            # Show global (owner_uuid=NULL) + user's own configs
            q = q.filter(
                or_(
                    AiModelConfig.owner_uuid.is_(None),
                    AiModelConfig.owner_uuid == user_uuid,
                )
            )
            if enabled is not None:
                q = q.filter(AiModelConfig.enabled == enabled)
            if providerCode:
                q = q.filter(AiModelConfig.provider_code == providerCode)
            if keyword:
                kw = f"%{keyword}%"
                q = q.filter(AiModelConfig.name.ilike(kw))

            total = q.count()
            items = (
                q.order_by(AiModelConfig.sort_order, AiModelConfig.id)
                .offset((page - 1) * pageSize)
                .limit(pageSize)
                .all()
            )
            data = [_config_to_dict(c) for c in items]
            return success(data=data, total=total)
        except Exception as e:
            logger.error(f"List providers error: {e}")
            return error(str(e))


@router.post("", summary="Create model provider config")
async def create_provider(
    body: AiModelConfigCreate,
    user_uuid: str = Depends(require_login),
):
    """Create a new custom model provider configuration."""
    with get_session() as db:
        try:
            cfg = AiModelConfig(
                name=body.name,
                provider_code=body.providerCode,
                is_builtin=False,
                base_url=body.baseUrl,
                api_format=body.apiFormat,
                api_key_enc=encrypt_value(body.apiKey) if body.apiKey else "",
                model_id_for_test=body.modelIdForTest,
                enabled=body.enabled,
                description=body.description,
                sort_order=body.sortOrder,
                owner_uuid=user_uuid,
                extra_config=body.extraConfig,
            )
            db.add(cfg)
            db.commit()
            db.refresh(cfg)
            return success(data=_config_to_dict(cfg), msg="Created")
        except Exception as e:
            db.rollback()
            logger.error(f"Create provider error: {e}")
            return error(str(e))


@router.get("/{provider_id}", summary="Get provider detail")
async def get_provider(
    provider_id: int,
    user_uuid: str = Depends(require_login),
):
    """Get a single model provider configuration by ID."""
    with get_session() as db:
        cfg = db.query(AiModelConfig).filter(AiModelConfig.id == provider_id).first()
        if not cfg:
            return error("Provider not found", code="404000")
        # Access control: only owner or global config
        if cfg.owner_uuid and cfg.owner_uuid != user_uuid:
            return error("Access denied", code="403000")
        return success(data=_config_to_dict(cfg))


@router.put("/{provider_id}", summary="Update provider config")
async def update_provider(
    provider_id: int,
    body: AiModelConfigUpdate,
    user_uuid: str = Depends(require_login),
):
    """Update an existing model provider configuration."""
    with get_session() as db:
        cfg = db.query(AiModelConfig).filter(AiModelConfig.id == provider_id).first()
        if not cfg:
            return error("Provider not found", code="404000")
        if cfg.owner_uuid and cfg.owner_uuid != user_uuid:
            return error("Access denied", code="403000")

        try:
            if body.name is not None:
                cfg.name = body.name
            if body.providerCode is not None:
                cfg.provider_code = body.providerCode
            if body.baseUrl is not None:
                cfg.base_url = body.baseUrl
            if body.apiFormat is not None:
                cfg.api_format = body.apiFormat
            if body.modelIdForTest is not None:
                cfg.model_id_for_test = body.modelIdForTest
            if body.enabled is not None:
                cfg.enabled = body.enabled
            if body.description is not None:
                cfg.description = body.description
            if body.sortOrder is not None:
                cfg.sort_order = body.sortOrder
            if body.extraConfig is not None:
                cfg.extra_config = body.extraConfig
            # apiKey: None = keep, "" = clear, value = update
            if body.apiKey is not None:
                cfg.api_key_enc = encrypt_value(body.apiKey) if body.apiKey else ""

            db.commit()
            db.refresh(cfg)
            return success(data=_config_to_dict(cfg), msg="Updated")
        except Exception as e:
            db.rollback()
            logger.error(f"Update provider error: {e}")
            return error(str(e))


@router.delete("/{provider_id}", summary="Delete provider config")
async def delete_provider(
    provider_id: int,
    user_uuid: str = Depends(require_login),
):
    """Delete a model provider configuration. Built-in providers cannot be deleted."""
    with get_session() as db:
        cfg = db.query(AiModelConfig).filter(AiModelConfig.id == provider_id).first()
        if not cfg:
            return error("Provider not found", code="404000")
        if cfg.is_builtin:
            return error("Built-in providers cannot be deleted", code="400000")
        if cfg.owner_uuid and cfg.owner_uuid != user_uuid:
            return error("Access denied", code="403000")

        try:
            db.delete(cfg)
            db.commit()
            return success(msg="Deleted")
        except Exception as e:
            db.rollback()
            logger.error(f"Delete provider error: {e}")
            return error(str(e))


@router.patch("/{provider_id}/toggle", summary="Toggle provider enabled")
async def toggle_provider(
    provider_id: int,
    body: AiModelToggleRequest,
    user_uuid: str = Depends(require_login),
):
    """Enable or disable a model provider configuration."""
    with get_session() as db:
        cfg = db.query(AiModelConfig).filter(AiModelConfig.id == provider_id).first()
        if not cfg:
            return error("Provider not found", code="404000")
        if cfg.owner_uuid and cfg.owner_uuid != user_uuid:
            return error("Access denied", code="403000")

        try:
            cfg.enabled = body.enabled
            db.commit()
            db.refresh(cfg)
            return success(data=_config_to_dict(cfg), msg="Updated")
        except Exception as e:
            db.rollback()
            logger.error(f"Toggle provider error: {e}")
            return error(str(e))


@router.post("/{provider_id}/test", summary="Test saved provider connection")
async def test_saved_provider(
    provider_id: int,
    mode: str = Query("chat", regex="^(connect|list|chat)$"),
    user_uuid: str = Depends(require_login),
):
    """Test a saved provider's connection and update last_test_* cache fields."""
    with get_session() as db:
        cfg = db.query(AiModelConfig).filter(AiModelConfig.id == provider_id).first()
        if not cfg:
            return error("Provider not found", code="404000")
        if cfg.owner_uuid and cfg.owner_uuid != user_uuid:
            return error("Access denied", code="403000")

        api_key = decrypt_value(cfg.api_key_enc) if cfg.api_key_enc else ""
        result = await test_model_connection(
            base_url=cfg.base_url,
            api_key=api_key,
            api_format=cfg.api_format,
            model_id=cfg.model_id_for_test,
            mode=mode,
        )

        # Cache test result
        try:
            cfg.last_test_status = result.status
            cfg.last_test_response_ms = result.responseMs
            cfg.last_tested_at = datetime.utcnow().isoformat()
            cfg.last_test_error = result.detail if not result.success else None
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to cache test result: {e}")

        return success(data=result.model_dump())


@router.post("/test", summary="Test unsaved provider config (ad-hoc)")
async def test_adhoc_provider(
    body: AiModelTestRequest,
    user_uuid: str = Depends(require_login),
):
    """Test a provider configuration without saving it first.

    Used by the "Test Model" button when the user hasn't saved the config yet.
    The API key is never stored — it's used only for this single test request.
    """
    result = await test_model_connection(
        base_url=body.baseUrl,
        api_key=body.apiKey,
        api_format=body.apiFormat,
        model_id=body.modelIdForTest,
        mode=body.mode,
    )
    return success(data=result.model_dump())
