# Agent long-term memory router end-to-end tests (fastapi TestClient-less).
#
# Isolation strategy: build a fresh FastAPI app per fixture that mounts only the
# memory router (prefix="/api"), monkeypatch the module singleton to a private
# AgentLongTermMemory backed by tmp_path, and override get_current_user_id to a
# mutable per-test uid.
#
# Covers: CRUD, pagination/filter, user isolation (other users cannot see/delete),
# recall top_k, extract auto-import, importance cap, required-field validation,
# 404 / 403 / 409-style errors.

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import agent_memory as agent_memory_router
from app.services.agent_longterm_memory import AgentLongTermMemory

# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def api(monkeypatch, tmp_path):
    """App with isolated memory store + mutable current-user uid. Returns (app, mem, state)."""
    mem = AgentLongTermMemory(file_path=tmp_path / "mem.json")
    monkeypatch.setattr(agent_memory_router, "agent_longterm_memory", mem)
    app = FastAPI()
    app.include_router(agent_memory_router.router, prefix="/api")
    state = {"uid": "alice"}

    async def _fake_current_user_id() -> str:
        return state["uid"]

    app.dependency_overrides[get_current_user_id] = _fake_current_user_id
    return app, mem, state


@pytest.fixture
async def client(api):
    """httpx async client backed by the test app."""
    app, _mem, _state = api
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# =============================================================================
# POST /memory/entries (create + validation)
# =============================================================================


@pytest.mark.asyncio
async def test_create_requires_content(api, client):
    res = await client.post("/api/longterm-memory/entries", json={"type": "goal"})
    assert res.status_code == 400
    assert "不能为空" in res.json()["detail"]


@pytest.mark.asyncio
async def test_create_invalid_type(api, client):
    res = await client.post(
        "/api/longterm-memory/entries", json={"type": "nonsense", "content": "记住这个约定"}
    )
    assert res.status_code == 400
    assert "非法记忆类型" in res.json()["detail"]


@pytest.mark.asyncio
async def test_create_success_returns_id(api, client):
    res = await client.post(
        "/api/longterm-memory/entries",
        json={
            "type": "goal",
            "content": "本季度目标是一天一个 PR",
            "keywords": ["PR"],
            "tags": ["季度"],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    assert body["data"]["memory_id"]
    entry = body["data"]["entry"]
    assert entry["user_id"] == "alice"
    assert entry["type"] == "goal"
    assert entry["content"] == "本季度目标是一天一个 PR"
    assert "季度" in entry["tags"]


# =============================================================================
# GET /memory/entries (list + filter + pagination)
# =============================================================================


@pytest.mark.asyncio
async def test_list_empty(api, client):
    res = await client.get("/api/longterm-memory/entries")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_list_filter_and_paginate(api, client):
    lesson_contents = [
        "连接数据库超时应该提高超时时间并重试",
        "排查问题时要先看后端日志而不是猜",
        "文件写入需要使用互斥锁保护并发",
        "缓存键必须包含用户 id 避免串数据",
        "上线前要跑一遍完整回归测试集",
    ]
    for content in lesson_contents:
        await client.post(
            "/api/longterm-memory/entries",
            json={"type": "lesson_learned", "content": content},
        )
    await client.post(
        "/api/longterm-memory/entries", json={"type": "goal", "content": "本季度目标是稳定发布"}
    )

    res = await client.get("/api/longterm-memory/entries", params={"type": "lesson_learned"})
    data = res.json()["data"]
    assert data["total"] == 5

    res = await client.get("/api/longterm-memory/entries", params={"page": 2, "page_size": 2})
    data = res.json()["data"]
    assert data["total"] == 6
    assert len(data["items"]) == 2
    assert data["page"] == 2

    res = await client.get("/api/longterm-memory/entries", params={"q": "超时"})
    assert res.json()["data"]["total"] >= 1


# =============================================================================
# PUT /memory/entries/{id} (update + errors)
# =============================================================================


@pytest.mark.asyncio
async def test_update_fields_and_require(api, client):
    mid = (await client.post(
        "/api/longterm-memory/entries", json={"type": "lesson_learned", "content": "原内容"}
    )).json()["data"]["entry"]["memory_id"]

    res = await client.put(
        f"/api/longterm-memory/entries/{mid}",
        json={"content": "新内容", "type": "goal", "tags": ["tag1"], "importance": 4},
    )
    assert res.status_code == 200
    entry = res.json()["data"]
    assert entry["content"] == "新内容"
    assert entry["type"] == "goal"
    assert entry["tags"] == ["tag1"]
    assert entry["importance"] == 4

    # empty content rejected
    res = await client.put(f"/api/longterm-memory/entries/{mid}", json={"content": "   "})
    assert res.status_code == 400

    # invalid importance rejected
    res = await client.put(f"/api/longterm-memory/entries/{mid}", json={"importance": 9})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_update_nonexistent_404(api, client):
    res = await client.put("/api/longterm-memory/entries/nonexistent", json={"content": "x"})
    assert res.status_code == 404
    assert "不存在" in res.json()["detail"]


# =============================================================================
# DELETE /memory/entries/{id}
# =============================================================================


@pytest.mark.asyncio
async def test_delete_and_nonexistent(api, client):
    mid = (await client.post(
        "/api/longterm-memory/entries", json={"content": "要删的"}
    )).json()["data"]["entry"]["memory_id"]

    res = await client.delete(f"/api/longterm-memory/entries/{mid}")
    assert res.status_code == 200
    assert res.json()["data"]["deleted"] == mid

    res = await client.delete(f"/api/longterm-memory/entries/{mid}")
    assert res.status_code == 404


# =============================================================================
# POST /memory/entries/{id}/important (importance bump + cap)
# =============================================================================


@pytest.mark.asyncio
async def test_important_bumps_and_caps(api, client):
    mid = (await client.post(
        "/api/longterm-memory/entries", json={"content": "重要记忆"}
    )).json()["data"]["entry"]["memory_id"]

    entry = (await client.post(f"/api/longterm-memory/entries/{mid}/important")).json()["data"]
    assert entry["importance"] == 4

    res = await client.post("/api/longterm-memory/entries/nonexistent/important")
    assert res.status_code == 404

    # build to cap 5 then confirm it stays
    for _ in range(5):
        res = await client.post(f"/api/longterm-memory/entries/{mid}/important")
        assert res.status_code == 200
    assert res.json()["data"]["importance"] == 5


# =============================================================================
# GET /memory/recall
# =============================================================================


@pytest.mark.asyncio
async def test_recall_requires_q(api, client):
    res = await client.get("/api/longterm-memory/recall")
    assert res.status_code == 400
    assert "缺少查询参数" in res.json()["detail"]


@pytest.mark.asyncio
async def test_recall_top_k(api, client):
    contents = [
        "记得统一前端命名规范",
        "接口返回建议统一字段结构",
        "数据库表名建议统一前缀",
        "错误码建议统一管理定义",
        "日志级别建议统一规范",
        "提交信息建议统一格式规范",
    ]
    for i, content in enumerate(contents):
        mem_types = ["lesson_learned", "project_convention", "resolved_issue"]
        await client.post(
            "/api/longterm-memory/entries",
            json={"type": mem_types[i % 3], "content": content},
        )
    res = await client.get("/api/longterm-memory/recall", params={"q": "统一", "top_k": 3})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["top_k"] == 3
    assert len(data["hits"]) == 3
    assert data["context_block"]


# =============================================================================
# POST /memory/extract (auto import)
# =============================================================================


@pytest.mark.asyncio
async def test_extract_messages_required(api, client):
    res = await client.post("/api/longterm-memory/extract", json={"messages": []})
    assert res.status_code == 400
    assert "messages" in res.json()["detail"]


@pytest.mark.asyncio
async def test_extract_auto_import(api, client):
    messages = [
        {"role": "user", "content": "以后统一用单引号，不要再混用双引号"},
        {"role": "assistant", "content": "好的，今后全项目统一单引号。"},
        {"role": "system", "content": "ignored"},
    ]
    res = await client.post(
        "/api/longterm-memory/extract",
        json={"messages": messages, "source_session_id": "sess-1"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["imported"] >= 1
    assert data["candidates"]
    assert data["stats"]["total"] >= 2

    # imported entries are now visible in list under the same user
    listing = (await client.get("/api/longterm-memory/entries")).json()["data"]
    assert listing["total"] >= 2


# =============================================================================
# user isolation
# =============================================================================


@pytest.mark.asyncio
async def test_user_isolation(api, client):
    mid = (await client.post(
        "/api/longterm-memory/entries", json={"content": "alice 私有记忆"}
    )).json()["data"]["entry"]["memory_id"]

    # switch to another user
    api[2]["uid"] = "bob"

    # cannot see alice's entries
    listing = (await client.get("/api/longterm-memory/entries")).json()["data"]
    assert listing["total"] == 0

    # cannot update / delete / mark-important alice's entry
    res = await client.put(f"/api/longterm-memory/entries/{mid}", json={"content": "hack"})
    assert res.status_code == 403
    assert "无权" in res.json()["detail"]

    res = await client.delete(f"/api/longterm-memory/entries/{mid}")
    assert res.status_code == 403

    res = await client.post(f"/api/longterm-memory/entries/{mid}/important")
    assert res.status_code == 403

    # alice's data untouched
    api[2]["uid"] = "alice"
    entry = (await client.get("/api/longterm-memory/entries")).json()["data"]["items"][0]
    assert entry["content"] == "alice 私有记忆"
