# Cost Ledger read-only router (2026-09-03).
# Mounted by main.py as: app.include_router(cost_ledger.router,
#     prefix="/api", tags=["cost-ledger"])
# Endpoints (read-only, Envelope {"code":0,"message":"ok","data":...}):
#   GET /api/cost-ledger/summary    -> aggregate totals + by_tool/by_model
#   GET /api/cost-ledger/top-tools  -> top tools by cost desc (?n=N)
#   GET /api/cost-ledger/timeseries -> hour/day buckets (?granularity=hour|day)
#   GET /api/cost-ledger/query      -> raw detail rows (in-memory pagination)
# Auth: same as cloud_runs -> get_current_user_id (401 when unauth).

from __future__ import annotations

from typing import Any

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from ..core.jwt_auth import get_current_user_id
from ..services.cost_ledger import CostLedger, cost_ledger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cost-ledger", tags=["cost-ledger"])

_DEFAULT_N = 10
_MAX_PAGE_SIZE = 200
_GRANULARITIES = ("hour", "day")


def _build_filter(
    user_id: str | None,
    session_id: str | None,
    run_id: str | None,
    tool_name: str | None,
    model: str | None,
) -> dict[str, Any]:
    """Build the exact-match filter dict for cost_ledger._filtered."""
    filt: dict[str, Any] = {}
    if user_id:
        filt["user_id"] = user_id
    if session_id:
        filt["session_id"] = session_id
    if run_id:
        filt["run_id"] = run_id
    if tool_name:
        filt["tool_name"] = tool_name
    if model:
        filt["model"] = model
    return filt


def _parse_dt(value: str) -> datetime | None:
    """Parse ISO datetime; trailing 'Z' normalized to +00:00."""
    if not value:
        return None
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _parse_bound(value: str | None, is_end: bool) -> datetime | None:
    """Parse a date/short ISO bound. Bare 'YYYY-MM-DD' -> start/end of day."""
    if not value:
        return None
    text = str(value).strip()
    if "T" in text:
        return _parse_dt(text)
    suffix = "T23:59:59" if is_end else "T00:00:00"
    return _parse_dt(text + suffix + "+00:00")


def _in_window(entries: list[Any], date_from: str | None, date_to: str | None) -> list[Any]:
    """Retain entries whose 'at' falls within [date_from, date_to] (inclusive)."""
    if not date_from and not date_to:
        return entries
    lo = _parse_bound(date_from, False)
    hi = _parse_bound(date_to, True)
    out = []
    for e in entries:
        dt = _parse_dt(e.get("at") or "")
        if dt is None:
            continue
        if lo is not None and dt < lo:
            continue
        if hi is not None and dt > hi:
            continue
        out.append(e)
    return out


def _scratch(entries: list[Any]) -> CostLedger:
    """Wrap the filtered entry rows in an in-memory ledger for read-only aggregation.

    Populates _data directly (no append/persist) so nothing is written to disk,
    then reuses the service's aggregate/top_tools/timeseries logic.
    """
    ledger = CostLedger()
    ledger._data = {
        str(e.get("record_id") or idx): dict(e) for idx, e in enumerate(entries)
    }
    ledger._loaded = True
    return ledger


def _collect(
    user_id: str | None,
    session_id: str | None,
    run_id: str | None,
    tool_name: str | None,
    model: str | None,
    date_from: str | None,
    date_to: str | None,
) -> list[Any]:
    filt = _build_filter(user_id, session_id, run_id, tool_name, model)
    entries = cost_ledger._filtered(filt)
    return _in_window(entries, date_from, date_to)


@router.get("/summary")
async def cost_summary(
    user_id: str | None = None,
    session_id: str | None = None,
    run_id: str | None = None,
    tool_name: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    uid: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Aggregate totals and by_tool/by_model under the given filters."""
    data = _scratch(
        _collect(user_id, session_id, run_id, tool_name, model, date_from, date_to)
    ).aggregate()
    logger.info(
        "cost-ledger summary uid=%s steps=%s cost=%s",
        uid, data["count"], data["total_cost"],
    )
    return {"code": 0, "message": "ok", "data": data}


@router.get("/top-tools")
async def cost_top_tools(
    n: int = Query(_DEFAULT_N, ge=1),
    user_id: str | None = None,
    session_id: str | None = None,
    run_id: str | None = None,
    tool_name: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    uid: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Top N tools by cost (desc), optionally scoped by filter."""
    data = _scratch(
        _collect(user_id, session_id, run_id, tool_name, model, date_from, date_to)
    ).top_tools(n)
    logger.info("cost-ledger top-tools uid=%s n=%s", uid, len(data))
    return {"code": 0, "message": "ok", "data": data}


@router.get("/timeseries", response_model=None)
async def cost_timeseries(
    granularity: str = "hour",
    user_id: str | None = None,
    session_id: str | None = None,
    run_id: str | None = None,
    tool_name: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    uid: str = Depends(get_current_user_id),
) -> dict[str, Any] | JSONResponse:
    """Ledger trend buckets by hour or day."""
    if granularity not in _GRANULARITIES:
        return JSONResponse(
            status_code=400,
            content={
                "code": 400,
                "message": "granularity 必须是 hour 或 day",
                "data": None,
            },
        )
    data = _scratch(
        _collect(user_id, session_id, run_id, tool_name, model, date_from, date_to)
    ).timeseries(granularity)
    logger.info(
        "cost-ledger timeseries uid=%s granularity=%s buckets=%s",
        uid, granularity, len(data),
    )
    return {"code": 0, "message": "ok", "data": data}


@router.get("/query")
async def cost_query(
    user_id: str | None = None,
    session_id: str | None = None,
    run_id: str | None = None,
    tool_name: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1),
    uid: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Raw detail rows under filters with in-memory pagination."""
    entries = _collect(
        user_id, session_id, run_id, tool_name, model, date_from, date_to
    )
    size = min(page_size, _MAX_PAGE_SIZE)
    start = (page - 1) * size
    logger.info(
        "cost-ledger query uid=%s total=%s page=%s size=%s",
        uid, len(entries), page, size,
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "list": entries[start:start + size],
            "total": len(entries),
            "page": page,
            "page_size": size,
        },
    }