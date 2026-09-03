# Cost Ledger router endpoint tests (2026-09-03).
# Isolated FastAPI app mounts the router under /api; the global cost_ledger
# singleton is pointed at a tmp file and prefilled with fixture rows.
# Auth uses the same get_current_user_id dependency as cloud_runs.

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import cost_ledger as cost_ledger_router
from app.services.cost_ledger import cost_ledger


def _mk(record_id: str, **kw) -> dict:
    base = {
        "record_id": record_id,
        "user_id": "u2",
        "session_id": "s-a",
        "run_id": "run-a",
        "tool_name": "web_search",
        "model": "deepseek-chat",
        "tokens_in": 100,
        "tokens_out": 40,
        "cost_usd": 0.04,
        "duration_ms": 12.0,
        "status": "ok",
        "at": "2026-09-03T10:00:00Z",
    }
    base.update(kw)
    return base


_FIXTURES = [
    _mk("e1", user_id="u1", session_id="s1", run_id="r1", tool_name="read_file",
        model="gpt-4o", cost_usd=0.02, at="2026-09-01T08:00:00Z"),
    _mk("e2", user_id="u1", session_id="s1", run_id="r2", tool_name="bash",
        model="gpt-4o", cost_usd=0.05, at="2026-09-02T10:00:00Z"),
    _mk("e3", user_id="u2", session_id="s2", run_id="r3", tool_name="read_file",
        model="claude-3-opus", cost_usd=0.01, at="2026-09-03T12:00:00Z"),
    _mk("e4", user_id="u2", session_id="s3", run_id="r4", tool_name="web_search",
        model="deepseek-chat", cost_usd=0.04, at="2026-09-03T13:00:00Z"),
]

_TOTAL_COST = 0.02 + 0.05 + 0.01 + 0.04  # 0.12


@pytest.fixture
async def client(monkeypatch, tmp_path):
    """Mount router on an isolated app; prefill the global ledger singleton."""
    monkeypatch.setattr(
        cost_ledger, "_data", {e["record_id"]: dict(e) for e in _FIXTURES}
    )
    monkeypatch.setattr(cost_ledger, "_loaded", True)
    monkeypatch.setattr(cost_ledger, "_file", tmp_path / "ledger.json")
    app = FastAPI()
    app.include_router(cost_ledger_router.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "test-user"
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# =============================================================================
# summary
# =============================================================================


async def test_summary_all_totals(client):
    res = await client.get("/api/cost-ledger/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    assert body["message"] == "ok"
    assert body["data"]["count"] == 4
    assert body["data"]["total_cost"] == pytest.approx(_TOTAL_COST)
    assert body["data"]["total_tokens_out"] == 160
    assert body["data"]["by_tool"]["read_file"]["cost"] == pytest.approx(0.03)
    assert body["data"]["by_model"]["gpt-4o"]["cost"] == pytest.approx(0.07)


async def test_summary_filter_user(client):
    body = (
        await client.get("/api/cost-ledger/summary", params={"user_id": "u1"})
    ).json()
    assert body["data"]["count"] == 2
    assert body["data"]["total_cost"] == pytest.approx(0.07)


async def test_summary_filter_session(client):
    body = (
        await client.get("/api/cost-ledger/summary", params={"session_id": "s1"})
    ).json()
    assert body["data"]["count"] == 2


async def test_summary_filter_run(client):
    body = (
        await client.get("/api/cost-ledger/summary", params={"run_id": "r3"})
    ).json()
    assert body["data"]["count"] == 1
    assert body["data"]["total_cost"] == pytest.approx(0.01)


async def test_summary_filter_tool(client):
    body = (
        await client.get("/api/cost-ledger/summary", params={"tool_name": "read_file"})
    ).json()
    assert body["data"]["count"] == 2
    assert body["data"]["total_cost"] == pytest.approx(0.03)


async def test_summary_filter_model(client):
    body = (
        await client.get("/api/cost-ledger/summary", params={"model": "gpt-4o"})
    ).json()
    assert body["data"]["count"] == 2
    assert body["data"]["total_cost"] == pytest.approx(0.07)


async def test_summary_date_range(client):
    body = (
        await client.get(
            "/api/cost-ledger/summary",
            params={"date_from": "2026-09-02", "date_to": "2026-09-02"},
        )
    ).json()
    assert body["data"]["count"] == 1
    assert body["data"]["total_cost"] == pytest.approx(0.05)
    body2 = (
        await client.get(
            "/api/cost-ledger/summary",
            params={"date_from": "2026-09-01", "date_to": "2026-09-02"},
        )
    ).json()
    assert body2["data"]["count"] == 2
    assert body2["data"]["total_cost"] == pytest.approx(0.07)


async def test_summary_unknown_filter_returns_empty_200(client):
    res = await client.get("/api/cost-ledger/summary", params={"user_id": "nobody"})
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    assert body["data"]["count"] == 0
    assert body["data"]["total_cost"] == 0.0
    assert body["data"]["by_tool"] == {}


# =============================================================================
# top-tools
# =============================================================================


async def test_top_tools_sorted_by_cost_desc(client):
    body = (await client.get("/api/cost-ledger/top-tools")).json()
    data = body["data"]
    names = [t["tool_name"] for t in data]
    # cost desc: bash(0.05) > web_search(0.04) > read_file(0.03)
    assert names == ["bash", "web_search", "read_file"]
    assert data[0]["cost"] == pytest.approx(0.05)
    assert data[0]["steps"] == 1


async def test_top_tools_n_limit(client):
    data = (await client.get("/api/cost-ledger/top-tools", params={"n": 2})).json()["data"]
    assert len(data) == 2
    assert data[0]["tool_name"] == "bash"


async def test_top_tools_respects_filter(client):
    data = (
        await client.get("/api/cost-ledger/top-tools", params={"user_id": "u2"})
    ).json()["data"]
    names = [t["tool_name"] for t in data]
    assert names == ["web_search", "read_file"]


# =============================================================================
# timeseries
# =============================================================================


async def test_timeseries_day_buckets(client):
    data = (
        await client.get(
            "/api/cost-ledger/timeseries", params={"granularity": "day"}
        )
    ).json()["data"]
    buckets = {b["bucket"]: b for b in data}
    assert list(buckets) == ["2026-09-01", "2026-09-02", "2026-09-03"]
    assert buckets["2026-09-03"]["cost"] == pytest.approx(0.05)
    assert buckets["2026-09-03"]["steps"] == 2


async def test_timeseries_hour_buckets(client):
    data = (
        await client.get(
            "/api/cost-ledger/timeseries", params={"granularity": "hour"}
        )
    ).json()["data"]
    buckets = [b["bucket"] for b in data]
    assert "2026-09-03T12" in buckets
    assert "2026-09-03T13" in buckets


async def test_timeseries_respects_filter(client):
    data = (
        await client.get(
            "/api/cost-ledger/timeseries",
            params={"granularity": "day", "tool_name": "read_file"},
        )
    ).json()["data"]
    buckets = {b["bucket"]: b for b in data}
    assert list(buckets) == ["2026-09-01", "2026-09-03"]
    assert buckets["2026-09-01"]["cost"] == pytest.approx(0.02)


async def test_timeseries_invalid_granularity(client):
    res = await client.get(
        "/api/cost-ledger/timeseries", params={"granularity": "week"}
    )
    assert res.status_code == 400
    body = res.json()
    assert body["code"] == 400
    assert body["data"] is None
    assert "hour" in body["message"]


# =============================================================================
# query
# =============================================================================


async def test_query_detail_pagination(client):
    body = (await client.get("/api/cost-ledger/query")).json()
    assert body["code"] == 0
    assert body["data"]["total"] == 4
    assert len(body["data"]["list"]) == 4
    assert body["data"]["list"][0]["record_id"] == "e1"


async def test_query_filter_and_page(client):
    body = (
        await client.get(
            "/api/cost-ledger/query",
            params={"user_id": "u2", "tool_name": "web_search"},
        )
    ).json()
    assert body["data"]["total"] == 1
    assert body["data"]["list"][0]["record_id"] == "e4"
    paged = (
        await client.get(
            "/api/cost-ledger/query", params={"page": 2, "page_size": 2}
        )
    ).json()
    assert paged["data"]["total"] == 4
    assert len(paged["data"]["list"]) == 2


async def test_query_empty_returns_200(client):
    res = await client.get("/api/cost-ledger/query", params={"run_id": "missing"})
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    assert body["data"]["total"] == 0
    assert body["data"]["list"] == []


# =============================================================================
# auth
# =============================================================================


async def test_unauthorized_401():
    """No dependency override -> no request.state.user_id -> 401 (same as cloud_runs)."""
    app = FastAPI()
    app.include_router(cost_ledger_router.router, prefix="/api")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        for path in (
            "/api/cost-ledger/summary",
            "/api/cost-ledger/top-tools",
            "/api/cost-ledger/timeseries",
            "/api/cost-ledger/query",
        ):
            res = await ac.get(path)
            assert res.status_code == 401