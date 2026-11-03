# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G5 编译式知识引擎 HTTP 面 + llm 注入开关回归测试(2026-10-30 立项)。

隔离策略(§5b):两数据源(codebase_indexer.search / long_term_memory.recall_cross_session)
全部 monkeypatch 成异步替身,零网络;落盘全在 tmp_path;身份经
`app.dependency_overrides[get_current_user_id]`(test_decisions_inbox 同款最小 app)。

覆盖:① POST /api/knowledge/compile 200 + 计数/落盘/拒绝回报;② GET /api/knowledge/cards
200 + 有效卡列表;③ 两端点未鉴权 401(不新增免鉴权面);④ workspace_path 不存在 400;
⑤ KNOWLEDGE_CARDS_ENABLED 开关 off ⇒ _inject_knowledge_cards 原样返回且**绝不触碰**
卡片读取分支(mock 断言),注入点据此恒走原 _inject_memory_graph 路径(逐字节回归)。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import knowledge as knowledge_router
from app.services import codebase_indexer as ci_mod
from app.services import long_term_memory as ltm_mod

# =============================================================================
# fixtures
# =============================================================================

_FAKE_CODEBASE: list[dict[str, Any]] = [
    {
        "file_path": "src/core/engine.py",
        "line_start": 42,
        "line_end": 88,
        "content": "class Engine: ...",
        "symbol_name": "Engine",
        "symbol_type": "class",
        "score": 0.8,
    },
]
_FAKE_SUMMARIES: list[dict[str, Any]] = [
    {
        "session_id": "sess-x",
        "summary": "s",
        "key_facts": ["索引按 repo 隔离"],
        "key_decisions": [],
        "end_time": "2026-10-01T00:00:00Z",
    },
    {
        "session_id": "",  # 无锚摘要 ⇒ 拒绝
        "key_facts": ["不该产卡"],
        "key_decisions": [],
    },
]


def _mk_app(uid: str | None) -> FastAPI:
    app = FastAPI()
    app.include_router(knowledge_router.router, prefix="/api")
    if uid is not None:

        async def _fake_current_user_id() -> str:
            return uid

        app.dependency_overrides[get_current_user_id] = _fake_current_user_id
    return app


@pytest.fixture
def patched_sources(monkeypatch, tmp_path):
    """两源替身:compile 走真实映射/落盘逻辑,但检索面零网络。"""
    # 2026-10-31 安全强化第 11 批:workspace_path 是客户端自报字段,现只许落在
    # IHUI_WORKSPACE_ROOTS 登记的根内(fail-closed,未登记一律 400)。本文件三个
    # 正常档都用 tmp_path 当工作区 ⇒ 把登记面指到它;"越界 400"另有专项用例覆盖。
    monkeypatch.setenv("IHUI_WORKSPACE_ROOTS", str(tmp_path))

    async def fake_search(query: str, **kwargs: Any) -> list[dict[str, Any]]:
        return list(_FAKE_CODEBASE)

    async def fake_recall(user_id: str, query: str, *, top_k: int = 5) -> list[dict[str, Any]]:
        return list(_FAKE_SUMMARIES)

    monkeypatch.setattr(ci_mod.codebase_indexer, "search", fake_search)
    monkeypatch.setattr(ltm_mod.long_term_memory, "recall_cross_session", fake_recall)


# =============================================================================
# POST /api/knowledge/compile
# =============================================================================


@pytest.mark.asyncio
async def test_compile_endpoint_200_and_writes(tmp_path, patched_sources):
    app = _mk_app("alice")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/knowledge/compile",
            json={"project_id": "proj-api", "workspace_path": str(tmp_path)},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["cards"] == 2  # 1 fact(codebase) + 1 fact(session);无锚摘要被拒
    assert data["wiki_files"] == 1
    assert data["rejected"] and "session_id" in data["rejected"][0]["reason"]
    assert data["source_hash"]
    cards_file = tmp_path / ".ihui" / "knowledge" / "cards" / "proj-api.json"
    wiki_file = tmp_path / ".ihui" / "wiki" / "proj-api.md"
    assert cards_file.exists() and wiki_file.exists()


@pytest.mark.asyncio
async def test_compile_dry_run_200_no_files(tmp_path, patched_sources):
    app = _mk_app("alice")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/knowledge/compile",
            json={"project_id": "proj-api", "workspace_path": str(tmp_path), "dry_run": True},
        )
    assert res.status_code == 200
    assert res.json()["data"]["wiki_files"] == 0
    assert not (tmp_path / ".ihui").exists()


@pytest.mark.asyncio
async def test_compile_missing_workspace_400(tmp_path):
    app = _mk_app("alice")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/knowledge/compile",
            json={"project_id": "p", "workspace_path": str(tmp_path / "nope")},
        )
    assert res.status_code == 400


# =============================================================================
# GET /api/knowledge/cards
# =============================================================================


@pytest.mark.asyncio
async def test_cards_endpoint_returns_active(tmp_path, patched_sources):
    app = _mk_app("alice")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post(
            "/api/knowledge/compile",
            json={"project_id": "proj-api", "workspace_path": str(tmp_path)},
        )
        res = await c.get(
            "/api/knowledge/cards",
            params={"project_id": "proj-api", "workspace_path": str(tmp_path)},
        )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total"] == 2
    assert all(c["kind"] in {"fact", "convention", "procedure"} for c in data["cards"])
    assert all(c["anchors"] for c in data["cards"])  # 有效卡必带锚(无锚不落盘)


# =============================================================================
# 鉴权面:不新增免鉴权
# =============================================================================


@pytest.mark.asyncio
async def test_endpoints_unauthenticated_401(tmp_path):
    app = _mk_app(None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r1 = await c.post("/api/knowledge/compile", json={"project_id": "p"})
        r2 = await c.get("/api/knowledge/cards", params={"project_id": "p"})
    assert r1.status_code == 401
    assert r2.status_code == 401


# =============================================================================
# llm 注入开关:off ⇒ 逐字节回归(mock 断言未走卡片分支)
# =============================================================================


def test_knowledge_switch_off_returns_messages_untouched(tmp_path, monkeypatch):
    """env 缺省/非 '1' ⇒ 开关 off:原对象返回、计数 0,且卡片读取分支绝不被触达。"""
    from app.routers import llm as llm_router

    # spy:若 off 路径触达卡片选择 ⇒ 立刻炸(证明未走卡片分支)
    def _boom(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("开关 off 时不得读取知识卡片")

    monkeypatch.setattr("app.services.knowledge_compiler.select_relevant_cards", _boom)
    monkeypatch.delenv("KNOWLEDGE_CARDS_ENABLED", raising=False)
    msgs = [{"role": "system", "content": "S"}, {"role": "user", "content": "bootstrap?"}]
    out, n = llm_router._inject_knowledge_cards(msgs, "bootstrap?", str(tmp_path))
    assert out is msgs and n == 0

    for off_value in ("0", "true", "yes", ""):
        monkeypatch.setenv("KNOWLEDGE_CARDS_ENABLED", off_value)
        out, n = llm_router._inject_knowledge_cards(msgs, "bootstrap?", str(tmp_path))
        assert out is msgs and n == 0


def test_knowledge_switch_on_injects_cards(tmp_path, monkeypatch):
    """开关 on + 命中卡片 ⇒ 注入 <knowledge_cards> 块并回报条数(卡片优先路径)。

    卡片经服务模块公开出口注入假卡(不依赖真实编译,也避开 off 用例残留的 spy
    被本用例的模块属性绑定捕获)。
    """
    from app.routers import llm as llm_router
    from app.services import knowledge_compiler as kc_mod

    cards = [
        {
            "id": "k1", "kind": "fact", "statement": "src/core/engine.py:42 存在 class Engine",
            "anchors": [{"type": "file", "ref": "src/core/engine.py", "line": 42}],
            "compiled_at": "", "ttl_days": 30, "source_hash": "h",
        },
        {
            "id": "k2", "kind": "fact", "statement": "索引按 repo 隔离",
            "anchors": [{"type": "transcript", "ref": "sess-x"}],
            "compiled_at": "", "ttl_days": 30, "source_hash": "h",
        },
    ]
    monkeypatch.setattr(kc_mod, "select_relevant_cards", lambda ws, q, *, limit=8: cards)
    msgs = [{"role": "system", "content": "S"}, {"role": "user", "content": "Engine 索引"}]
    monkeypatch.setenv("KNOWLEDGE_CARDS_ENABLED", "1")
    out, n = llm_router._inject_knowledge_cards(msgs, "Engine 索引", str(tmp_path))
    assert n == 2
    assert out is not msgs
    assert "<knowledge_cards>" in out[0]["content"]
    assert "src/core/engine.py:42" in out[0]["content"]
    assert "file:src/core/engine.py#42" in out[0]["content"]
    # 开关回到 off ⇒ 原样返回(与注入点 `if _kc < 3` 回落逻辑共同保证逐字节回归)
    monkeypatch.delenv("KNOWLEDGE_CARDS_ENABLED")
    out2, n2 = llm_router._inject_knowledge_cards(msgs, "Engine 索引", str(tmp_path))
    assert out2 is msgs and n2 == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
