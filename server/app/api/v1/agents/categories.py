"""Agent category routes."""

from datetime import UTC, datetime

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import asc, desc

from app.database import get_session
from app.schemas.common import error, success
from app.schemas.error_codes import ErrorCode
from app.security import require_login

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


# ── List categories (enhanced with filters/sorting/pagination) ───────────────


@router.get("/list", summary="List agent categories")
async def list_categories(
    group: str = Query(None, description="Filter by group: 1=members, 2=all"),
    id: int = Query(None, description="Filter by primary key ID"),
    id_list: str = Query(None, description="Comma-separated primary key IDs"),
    agent_id: str = Query(None, description="Filter by agent ID"),
    type: str = Query(None, description="Filter by type: 1=free, 2=limited-free, 3=paid"),
    type_list: str = Query(None, description="Comma-separated types, e.g. 1,2,3"),
    type_child: str = Query(None, description="Filter by child type"),
    limit_free: str = Query(None, description="Filter by limit-free code"),
    start_date: datetime = Query(None, description="Create time >= start_date"),
    end_date: datetime = Query(None, description="Create time <= end_date"),
    keyword: str = Query(None, description="Keyword search on agent_id"),
    sort_by: str = Query("create_time", description="Sort field"),
    sort_order: str = Query("desc", description="asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
):
    """List agent categories with optional filters, sorting and pagination.

    Enhanced from the original ``group``-only filter. Historical fields
    ``agent_name``/``create_uuid``/``discount_month`` are not present in the
    current ``AgentCategory`` model, so ``keyword`` searches ``agent_id``.
    """
    from app.models.activity_models import AgentCategory

    with get_session() as db:
        query = db.query(AgentCategory)

        if group:
            try:
                query = query.filter(AgentCategory.group == int(group))
            except (ValueError, TypeError):
                return error("Invalid group value", code=ErrorCode.BAD_REQUEST)

        if id is not None:
            query = query.filter(AgentCategory.id == id)

        if id_list:
            try:
                id_values = [int(i.strip()) for i in id_list.split(",") if i.strip()]
                if id_values:
                    query = query.filter(AgentCategory.id.in_(id_values))
            except ValueError:
                return error("Invalid id_list value", code=ErrorCode.BAD_REQUEST)

        if agent_id:
            query = query.filter(AgentCategory.agent_id == agent_id)

        if type:
            query = query.filter(AgentCategory.type == type)

        if type_child:
            query = query.filter(AgentCategory.type_child == type_child)

        if limit_free:
            query = query.filter(AgentCategory.limit_free == limit_free)

        if type_list:
            type_values = [t.strip() for t in type_list.split(",") if t.strip()]
            if type_values:
                query = query.filter(AgentCategory.type.in_(type_values))

        if start_date:
            query = query.filter(AgentCategory.create_time >= start_date)
        if end_date:
            query = query.filter(AgentCategory.create_time <= end_date)

        if keyword:
            query = query.filter(AgentCategory.agent_id.like(f"%{keyword}%"))

        total = query.count()

        allowed_sort = {
            "create_time", "agent_id", "type", "account",
            "group", "type_child", "id",
        }
        if sort_by not in allowed_sort:
            sort_by = "create_time"
        order_col = getattr(AgentCategory, sort_by, AgentCategory.create_time)
        query = query.order_by(asc(order_col) if sort_order.lower() == "asc" else desc(order_col))

        offset = (page - 1) * page_size
        items = query.offset(offset).limit(page_size).all()
        data = [_serialize_cat(c) for c in items]
        return success(data, total=total)


# ── Create category (enhanced: upsert + AgentExamine sync) ──────────────────


@router.post("/create", summary="Create agent category")
async def create_category(
    body: CategoryCreateBody,
    user_uuid: str = Depends(require_login),
):
    """Create or update (upsert) an agent category.

    If a category with the same ``agent_id`` already exists, it is updated in
    place. After persisting, the corresponding ``AgentExamine`` record (if any)
    has its ``status`` set to ``1`` (examining) and ``category_id`` linked.
    """
    from app.models.activity_models import AgentCategory, AgentExamine

    with get_session() as db:
        try:
            existing = (
                db.query(AgentCategory)
                .filter(AgentCategory.agent_id == body.agent_id)
                .first()
            )
            now = datetime.now(UTC)
            if existing:
                logger.info("Upsert: updating existing category for agent_id={}", body.agent_id)
                existing.group = body.group
                existing.type = body.type
                existing.type_child = body.type_child
                existing.limit_free = body.limit_free
                existing.account = body.account
                existing.create_time = now
                cat = existing
            else:
                cat = AgentCategory(
                    agent_id=body.agent_id,
                    group=body.group,
                    type=body.type,
                    type_child=body.type_child,
                    limit_free=body.limit_free,
                    account=body.account,
                    create_time=now,
                )
                db.add(cat)

            db.flush()

            # Sync AgentExamine.status = 1 (examining) and link category_id
            try:
                examine = (
                    db.query(AgentExamine)
                    .filter(AgentExamine.agent_id == body.agent_id)
                    .first()
                )
                if examine:
                    examine.status = 1
                    examine.category_id = str(cat.id)
                    logger.info("Synced AgentExamine status=1 for agent_id={}", body.agent_id)
                else:
                    logger.warning(
                        "No AgentExamine record found for agent_id={}", body.agent_id
                    )
            except Exception as sync_err:
                logger.error("Sync AgentExamine failed: {}", sync_err)

            db.commit()
            db.refresh(cat)
            return success(_serialize_cat(cat))
        except Exception as e:
            logger.error("Create category failed: {}", e)
            return error(str(e))


# ── Get category detail ──────────────────────────────────────────────────────


@router.get("/{category_id}", summary="Get category detail")
async def get_category_detail(
    category_id: int,
):
    with get_session() as db:
        from app.models.activity_models import AgentCategory

        cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
        if not cat:
            return error("Category not found", code=ErrorCode.NOT_FOUND)
        return success(_serialize_cat(cat))


# ── Update category (enhanced: AgentExamine + agents.type sync) ──────────────


@router.put("/{category_id}", summary="Update agent category")
async def update_category(
    category_id: int,
    body: CategoryUpdateBody,
    user_uuid: str = Depends(require_login),
):
    """Update an agent category.

    After the update, the corresponding ``AgentExamine`` record has its
    ``status`` set back to ``1`` (examining). If ``type`` was changed, the
    ``agents`` table ``type`` column is synced as well.
    """
    from app.models.activity_models import AgentCategory, AgentExamine

    with get_session() as db:
        try:
            cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
            if not cat:
                return error("Category not found", code=ErrorCode.NOT_FOUND)

            agent_id = cat.agent_id
            update_data = body.model_dump(exclude_unset=True)
            type_changed = "type" in update_data
            for field, value in update_data.items():
                setattr(cat, field, value)

            db.commit()
            db.refresh(cat)

            # Sync AgentExamine.status = 1 (re-enter review)
            try:
                examine_records = (
                    db.query(AgentExamine)
                    .filter(AgentExamine.agent_id == agent_id)
                    .all()
                )
                for examine in examine_records:
                    examine.status = 1
                    examine.category_id = str(cat.id)
                if examine_records:
                    db.commit()
                    logger.info(
                        "Synced {} AgentExamine records status=1 for agent_id={}",
                        len(examine_records), agent_id,
                    )
            except Exception as sync_err:
                logger.error("Sync AgentExamine failed: {}", sync_err)

            # Sync agents.type if type was updated
            if type_changed:
                try:
                    from app.models.agent_models import Agent

                    agent_record = (
                        db.query(Agent).filter(Agent.agent_id == agent_id).first()
                    )
                    if agent_record:
                        try:
                            agent_record.type = int(cat.type) if cat.type else agent_record.type
                        except (ValueError, TypeError):
                            agent_record.type = cat.type
                        db.commit()
                        logger.info("Synced agents.type for agent_id={}", agent_id)
                    else:
                        logger.warning("Agent record not found for agent_id={}", agent_id)
                except Exception as agent_err:
                    logger.error("Sync agents.type failed: {}", agent_err)

            return success(_serialize_cat(cat))
        except Exception as e:
            logger.error("Update category failed: {}", e)
            return error(str(e))


# ── Delete category (hard delete; historical was soft-delete) ────────────────


@router.delete("/{category_id}", summary="Delete agent category")
async def delete_category(
    category_id: int,
    user_uuid: str = Depends(require_login),
):
    """Hard-delete an agent category.

    NOTE: The historical implementation performed a soft-delete by setting
    ``AgentExamine.status = 5`` (delisted) and ``agents.publish_status =
    'unpublished'``. The current implementation keeps the hard-delete behaviour
    that was already in place. For soft operations use
    ``POST /categories/{id}/disable``.
    """
    with get_session() as db:
        try:
            from app.models.activity_models import AgentCategory

            cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
            if not cat:
                return error("Category not found", code=ErrorCode.NOT_FOUND)
            db.delete(cat)
            db.commit()
            return success({"deleted": category_id})
        except Exception as e:
            logger.error("Delete category failed: {}", e)
            return error(str(e))


# ─────────────────────────────────────────────────────────────────────────────
# New endpoints (module sub-prefix /categories)
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/categories/batch-query", summary="Batch query by primary key IDs")
async def batch_query_agent_category(
    id_list: list[int] = Body(..., embed=True, description="Primary key ID list"),
    user_uuid: str = Depends(require_login),
):
    """Batch-query categories by primary key IDs.

    Returns ``found`` (matched records) and ``not_found`` (IDs with no match).
    """
    from app.models.activity_models import AgentCategory

    if not id_list:
        return success({"found": [], "not_found": [], "found_count": 0})

    unique_ids = list(dict.fromkeys(id_list))
    with get_session() as db:
        records = (
            db.query(AgentCategory)
            .filter(AgentCategory.id.in_(unique_ids))
            .all()
        )
        found_ids = {r.id for r in records}
        not_found = [i for i in unique_ids if i not in found_ids]
        return success({
            "found": [_serialize_cat(r) for r in records],
            "not_found": not_found,
            "found_count": len(records),
        })


@router.get("/categories/ids/{id_list}", summary="Batch query by URL path IDs")
async def get_agent_category_by_ids(
    id_list: str,
    user_uuid: str = Depends(require_login),
):
    """Batch-query categories via comma-separated IDs in the URL path."""
    from app.models.activity_models import AgentCategory

    try:
        ids = [int(i.strip()) for i in id_list.split(",") if i.strip()]
    except ValueError:
        return error("Invalid id_list format", code=ErrorCode.BAD_REQUEST)

    if not ids:
        return success({"found": [], "not_found": [], "found_count": 0})

    with get_session() as db:
        records = (
            db.query(AgentCategory)
            .filter(AgentCategory.id.in_(ids))
            .all()
        )
        found_ids = {r.id for r in records}
        not_found = [i for i in ids if i not in found_ids]
        return success({
            "found": [_serialize_cat(r) for r in records],
            "not_found": not_found,
            "found_count": len(records),
        })


@router.get("/categories/stats/summary", summary="Category statistics")
async def get_agent_category_stats(
    user_uuid: str = Depends(require_login),
):
    """Return distribution statistics for agent categories.

    Covers type, group, type_child distributions and price analysis for paid
    categories. Fields not present in the current model (e.g. ``discount_month``,
    ``agent_main_category``) are omitted.
    """
    from app.models.activity_models import AgentCategory

    with get_session() as db:
        base = db.query(AgentCategory)
        total = base.count()

        type_names = {"1": "free", "2": "limited-free", "3": "paid"}
        type_distribution = {}
        for code, name in type_names.items():
            cnt = base.filter(AgentCategory.type == code).count()
            type_distribution[name] = {
                "count": cnt,
                "percentage": round(cnt / total * 100, 2) if total else 0,
            }

        group_names = {1: "members", 2: "all"}
        group_distribution = {}
        for code, name in group_names.items():
            cnt = base.filter(AgentCategory.group == code).count()
            group_distribution[name] = {
                "count": cnt,
                "percentage": round(cnt / total * 100, 2) if total else 0,
            }

        type_child_names = {"1": "monthly", "2": "yearly", "3": "permanent"}
        type_child_distribution = {}
        for code, name in type_child_names.items():
            cnt = base.filter(AgentCategory.type_child == code).count()
            type_child_distribution[name] = {
                "count": cnt,
                "percentage": round(cnt / total * 100, 2) if total else 0,
            }

        paid_rows = base.filter(AgentCategory.type == "3").all()
        prices = [r.account for r in paid_rows if r.account is not None]
        price_analysis = {
            "total_paid": len(paid_rows),
            "avg_price": round(sum(prices) / len(prices), 2) if prices else 0,
            "min_price": min(prices) if prices else 0,
            "max_price": max(prices) if prices else 0,
        }

        return success({
            "total_records": total,
            "type_distribution": type_distribution,
            "group_distribution": group_distribution,
            "type_child_distribution": type_child_distribution,
            "price_analysis": price_analysis,
            "generated_at": datetime.now(UTC).isoformat(),
        })


@router.get("/categories/agent/{agent_id}", summary="Get category by agent ID")
async def get_agent_category_by_agent_id(
    agent_id: str,
    user_uuid: str = Depends(require_login),
):
    """Return the pricing category for a given agent."""
    from app.models.activity_models import AgentCategory

    with get_session() as db:
        cat = (
            db.query(AgentCategory)
            .filter(AgentCategory.agent_id == agent_id)
            .first()
        )
        if not cat:
            return error("No category found for this agent", code=ErrorCode.NOT_FOUND)
        return success(_serialize_cat(cat))


@router.post("/categories/{category_id}/enable", summary="Enable pricing (type=paid)")
async def enable_agent_category(
    category_id: int,
    user_uuid: str = Depends(require_login),
):
    """Enable pricing: set ``type = '3'`` (paid).

    Also attempts to sync the ``agents`` table ``type`` and ``publish_status``
    (1=published) if the Agent model / record exists.
    """
    from app.models.activity_models import AgentCategory

    with get_session() as db:
        try:
            cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
            if not cat:
                return error("Category not found", code=ErrorCode.NOT_FOUND)

            cat.type = "3"
            db.commit()
            db.refresh(cat)

            # Sync agents table
            try:
                from app.models.agent_models import Agent

                agent = (
                    db.query(Agent)
                    .filter(Agent.agent_id == cat.agent_id)
                    .first()
                )
                if agent:
                    agent.type = 3
                    agent.publish_status = 1
                    db.commit()
                    logger.info(
                        "Synced agents table (type=3, publish_status=1) for agent_id={}",
                        cat.agent_id,
                    )
                else:
                    logger.warning("Agent record not found for agent_id={}", cat.agent_id)
            except Exception as agent_err:
                logger.error("Sync agents table failed: {}", agent_err)

            return success(_serialize_cat(cat))
        except Exception as e:
            logger.error("Enable category failed: {}", e)
            return error(str(e))


@router.post("/categories/{category_id}/disable", summary="Disable pricing (type=free)")
async def disable_agent_category(
    category_id: int,
    user_uuid: str = Depends(require_login),
):
    """Disable pricing: set ``type = '1'`` (free).

    Also attempts to sync the ``agents`` table ``type`` and ``publish_status``
    (0=draft/unpublished) if the Agent model / record exists.
    """
    from app.models.activity_models import AgentCategory

    with get_session() as db:
        try:
            cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
            if not cat:
                return error("Category not found", code=ErrorCode.NOT_FOUND)

            cat.type = "1"
            db.commit()
            db.refresh(cat)

            # Sync agents table
            try:
                from app.models.agent_models import Agent

                agent = (
                    db.query(Agent)
                    .filter(Agent.agent_id == cat.agent_id)
                    .first()
                )
                if agent:
                    agent.type = 1
                    agent.publish_status = 0
                    db.commit()
                    logger.info(
                        "Synced agents table (type=1, publish_status=0) for agent_id={}",
                        cat.agent_id,
                    )
                else:
                    logger.warning("Agent record not found for agent_id={}", cat.agent_id)
            except Exception as agent_err:
                logger.error("Sync agents table failed: {}", agent_err)

            return success(_serialize_cat(cat))
        except Exception as e:
            logger.error("Disable category failed: {}", e)
            return error(str(e))
