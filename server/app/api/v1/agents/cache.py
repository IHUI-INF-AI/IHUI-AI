"""Agent category cache management routes."""

import time

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.schemas.error_codes import ErrorCode
from app.security import require_login

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory cache for agent categories
# ---------------------------------------------------------------------------

_category_cache: dict = {
    "data": [],
    "loaded_at": None,
    "version": 0,
}


def _load_cache_from_db() -> list:
    """Load all agent categories from DB into cache."""
    with get_session() as db:
        from app.models.activity_models import AgentCategory

        items = db.query(AgentCategory).all()
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
    if not _category_cache["data"] or _category_cache["loaded_at"] is None:
        _category_cache["data"] = _load_cache_from_db()
        _category_cache["loaded_at"] = time.time()
        _category_cache["version"] += 1


# ---------------------------------------------------------------------------
# Existing routes
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
        "Category cache reloaded: {} items (v{})",
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
    logger.info("Category cache cleared (v{})", _category_cache["version"])
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
    agent_id: str = Query(None, description="Filter by agent_id"),
    agent_main_category: str = Query(
        None, description="Filter by agent_main_category (if present in cache)"
    ),
    agent_category: str = Query(
        None, description="Filter by agent_category (if present in cache)"
    ),
    user_uuid: str = Depends(require_login),
):
    """Search cached agent categories with optional filters.

    Enhanced from the original keyword/group/type filters with additional
    ``agent_id`` / ``agent_main_category`` / ``agent_category`` field search.
    The latter two are applied only when the cache entry contains such keys.
    """
    _ensure_cache_loaded()
    results = _category_cache["data"]

    if keyword:
        keyword_lower = keyword.lower()
        results = [
            r for r in results if keyword_lower in (r.get("agent_id") or "").lower()
        ]
    if group is not None:
        results = [r for r in results if r.get("group") == group]
    if type is not None:
        results = [r for r in results if r.get("type") == type]
    if agent_id:
        agent_id_lower = agent_id.lower()
        results = [
            r for r in results if agent_id_lower in (r.get("agent_id") or "").lower()
        ]
    if agent_main_category:
        mc_lower = agent_main_category.lower()
        results = [
            r
            for r in results
            if mc_lower in str(r.get("agent_main_category") or "").lower()
        ]
    if agent_category:
        ac_lower = agent_category.lower()
        results = [
            r
            for r in results
            if ac_lower in str(r.get("agent_category") or "").lower()
        ]

    return success(results, total=len(results))


# ─────────────────────────────────────────────────────────────────────────────
# New endpoints (module sub-prefix /cache)
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/cache/convert", summary="Convert IDs to names")
async def convert_ids_to_names(
    ids: str = Query(..., description="Comma-separated ID string, e.g. 1,2,3"),
    type: str = Query("0", description="Type: 0=category, 1=track (advisory)"),
    user_uuid: str = Depends(require_login),
):
    """Convert category IDs to basic info (id + agent_id).

    Historical implementation converted dictionary IDs to category/track names.
    The current cache stores ``AgentCategory`` pricing rows which have no
    ``name`` field, so this returns ``id`` and ``agent_id`` for each matched ID.
    The ``type`` parameter is accepted for API compatibility.
    """
    _ensure_cache_loaded()

    try:
        id_values = [int(i.strip()) for i in ids.split(",") if i.strip()]
    except ValueError:
        return error("Invalid ids format", code=ErrorCode.BAD_REQUEST)

    if not id_values:
        return success({"input_ids": ids, "type": type, "result": []})

    cache_map = {item["id"]: item for item in _category_cache["data"] if "id" in item}
    result = []
    for id_val in id_values:
        entry = cache_map.get(id_val)
        if entry:
            result.append({"id": entry["id"], "agent_id": entry.get("agent_id")})
        else:
            result.append({"id": id_val, "agent_id": None})

    return success({
        "input_ids": ids,
        "type": type,
        "result": result,
        "found_count": sum(1 for r in result if r["agent_id"] is not None),
    })


@router.get("/cache/categories", summary="Get categories grouped by group")
async def get_categories(user_uuid: str = Depends(require_login)):
    """Return cached categories grouped by ``group`` field.

    Historical implementation returned main/sub categories with icon URLs from a
    dictionary cache. The current cache stores ``AgentCategory`` rows, so this
    endpoint groups them by ``group`` (1=members, 2=all), sorted by ``id``.
    """
    _ensure_cache_loaded()

    members = []
    all_group = []
    other = []

    for item in _category_cache["data"]:
        group_val = item.get("group")
        if group_val == 1:
            members.append(item)
        elif group_val == 2:
            all_group.append(item)
        else:
            other.append(item)

    members.sort(key=lambda x: x.get("id") or 0)
    all_group.sort(key=lambda x: x.get("id") or 0)
    other.sort(key=lambda x: x.get("id") or 0)

    return success({
        "members": members,
        "all": all_group,
        "other": other,
        "total": len(_category_cache["data"]),
    })


@router.get("/cache/agent/{agent_id}", summary="Get category by agent ID")
async def get_category_by_agent_id(
    agent_id: str,
    user_uuid: str = Depends(require_login),
):
    """Return cached category data for a given agent ID."""
    _ensure_cache_loaded()

    for item in _category_cache["data"]:
        if item.get("agent_id") == agent_id:
            return success(item)

    return error(
        f"No category found for agent {agent_id}", code=ErrorCode.NOT_FOUND
    )


@router.get("/cache/category/{category_id}", summary="Get category by ID")
async def get_category_by_id(
    category_id: int,
    user_uuid: str = Depends(require_login),
):
    """Return cached category data by primary key ID."""
    _ensure_cache_loaded()

    for item in _category_cache["data"]:
        if item.get("id") == category_id:
            return success(item)

    return error(
        f"No category found for ID {category_id}", code=ErrorCode.NOT_FOUND
    )


@router.get("/cache/all", summary="Get all cached categories (paginated)")
async def get_all_categories(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Page size"),
    user_uuid: str = Depends(require_login),
):
    """Return all cached categories with pagination."""
    _ensure_cache_loaded()

    data = _category_cache["data"]
    total = len(data)
    start = (page - 1) * page_size
    end = start + page_size
    page_data = data[start:end]

    return success(
        {
            "categories": page_data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": (total + page_size - 1) // page_size if page_size else 0,
            },
        }
    )
