"""Agent category cache management routes."""

import logging
import time

from fastapi import APIRouter, Depends, Query

from app.database import get_session
from app.schemas.common import success
from app.security import require_login

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory cache for agent categories
# ---------------------------------------------------------------------------

_category_cache: dict = {
    "data": [],
    "loaded_at": None,
    "version": 0,
}


def _load_cache_from_db() -> dict:
    """Load all agent categories from DB into cache."""
    with get_session() as db:
        from app.models.activity_models import AgentCategory

        items = db.query(AgentCategory).limit(1000).all()
        data = [
            {
                "id": c.id,
                "agent_id": c.agent_id,
                "group": c.group,
                "type": c.type,
                "type_child": c.type_child,
                "limit_free": c.limit_free,
                "account": c.account,
                "create_time": c.create_time.isoformat() if c.create_time else None,
            }
            for c in items
        ]
        return data


def _ensure_cache_loaded():
    """Ensure cache is populated."""
    if _category_cache["data"] is None or _category_cache["loaded_at"] is None:
        _category_cache["data"] = _load_cache_from_db()
        _category_cache["loaded_at"] = time.time()
        _category_cache["version"] += 1


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/info", summary="Get category cache info")
async def cache_info(user_uuid: str = Depends(require_login)):
    """Return cache metadata: size, last reload time, version."""
    _ensure_cache_loaded()
    return success(
        {
            "count": len(_category_cache["data"]),
            "loaded_at": _category_cache["loaded_at"],
            "version": _category_cache["version"],
        }
    )


@router.post("/reload", summary="Reload category cache from DB")
async def cache_reload(user_uuid: str = Depends(require_login)):
    """Force-reload agent categories from database into memory cache."""
    _category_cache["data"] = _load_cache_from_db()
    _category_cache["loaded_at"] = time.time()
    _category_cache["version"] += 1
    logger.info(
        "Category cache reloaded: %d items (v%d)",
        len(_category_cache["data"]),
        _category_cache["version"],
    )
    return success(
        {
            "count": len(_category_cache["data"]),
            "loaded_at": _category_cache["loaded_at"],
            "version": _category_cache["version"],
        }
    )


@router.post("/clear", summary="Clear category cache")
async def cache_clear(user_uuid: str = Depends(require_login)):
    """Clear the in-memory category cache."""
    _category_cache["data"] = []
    _category_cache["loaded_at"] = None
    _category_cache["version"] += 1
    logger.info("Category cache cleared (v%d)", _category_cache["version"])
    return success(
        {
            "count": 0,
            "loaded_at": None,
            "version": _category_cache["version"],
        }
    )


@router.get("/search", summary="Search categories in cache")
async def cache_search(
    keyword: str = Query(None, description="Search keyword for agent_id"),
    group: int = Query(None, description="Filter by group"),
    type: str = Query(None, description="Filter by type"),
    user_uuid: str = Depends(require_login),
):
    """Search cached agent categories with optional filters."""
    _ensure_cache_loaded()
    results = _category_cache["data"]

    if keyword:
        keyword_lower = keyword.lower()
        results = [r for r in results if keyword_lower in (r.get("agent_id") or "").lower()]
    if group is not None:
        results = [r for r in results if r.get("group") == group]
    if type is not None:
        results = [r for r in results if r.get("type") == type]

    return success(results, total=len(results))
