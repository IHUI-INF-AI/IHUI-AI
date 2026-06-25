"""Agent category routes."""

from datetime import UTC

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login
from app.services.category_service import get_categories

router = APIRouter()


# ── Request body for create / update ─────────────────────────────────────────


class CategoryCreateBody(BaseModel):
    agent_id: str
    group: int = 2
    type: str = "1"
    type_child: str = "1"
    limit_free: str | None = None
    account: int = 0


class CategoryUpdateBody(BaseModel):
    agent_id: str | None = None
    group: int | None = None
    type: str | None = None
    type_child: str | None = None
    limit_free: str | None = None
    account: int | None = None


def _serialize_cat(c) -> dict:
    """Serialize an AgentCategory row."""
    return {
        "id": c.id,
        "agent_id": c.agent_id,
        "group": c.group,
        "type": c.type,
        "type_child": c.type_child,
        "limit_free": c.limit_free,
        "account": c.account,
        "create_time": c.create_time.isoformat() if c.create_time else None,
    }


# ── List categories ──────────────────────────────────────────────────────────


@router.get("/list", summary="List agent categories")
def list_categories(group: str = Query(None)):
    result = get_categories(group)
    return success(result)


# ── Create category ──────────────────────────────────────────────────────────


@router.post("/create", summary="Create agent category")
def create_category(
    body: CategoryCreateBody,
    user_uuid: str = Depends(require_login),
):
    from datetime import datetime

    with get_session() as db:
        try:
            from app.models.activity_models import AgentCategory

            cat = AgentCategory(
                agent_id=body.agent_id,
                group=body.group,
                type=body.type,
                type_child=body.type_child,
                limit_free=body.limit_free,
                account=body.account,
                create_time=datetime.now(UTC),
            )
            db.add(cat)
            db.commit()
            db.refresh(cat)
            return success(_serialize_cat(cat))
        except Exception as e:
            return error(str(e))


# ── Get category detail ──────────────────────────────────────────────────────


@router.get("/{category_id}", summary="Get category detail")
def get_category_detail(
    category_id: int,
):
    with get_session() as db:
        from app.models.activity_models import AgentCategory

        cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
        if not cat:
            return error("Category not found", code="404")
        return success(_serialize_cat(cat))


# ── Update category ──────────────────────────────────────────────────────────


@router.put("/{category_id}", summary="Update agent category")
def update_category(
    category_id: int,
    body: CategoryUpdateBody,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentCategory

            cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
            if not cat:
                return error("Category not found", code="404")
            update_data = body.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(cat, field, value)
            db.commit()
            db.refresh(cat)
            return success(_serialize_cat(cat))
        except Exception as e:
            return error(str(e))


# ── Delete category ──────────────────────────────────────────────────────────


@router.delete("/{category_id}", summary="Delete agent category")
def delete_category(
    category_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentCategory

            cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
            if not cat:
                return error("Category not found", code="404")
            db.delete(cat)
            db.commit()
            return success({"deleted": category_id})
        except Exception as e:
            return error(str(e))
