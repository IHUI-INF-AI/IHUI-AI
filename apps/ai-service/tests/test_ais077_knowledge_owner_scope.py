# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-077 回归(第二段):属主判据必须同时覆盖端点面与 LLM 注入面。

上一段(`test_ais_077_knowledge_card_owner.py`)已把属主写进卡片元数据,并在
GET /knowledge/cards 读端与 compile 写端按属主裁剪。但票面点名的第三处
(`llm.py` 知识卡片注入)当时未收口:它走 `select_relevant_cards` 时不带属主,
同一 workspace 下他人的卡(可能被投毒)仍会被拼进调用方的 system message。

本文件正反成对(全部 tmp_path 落盘、源经注入缝替身,零网络):
① 端点面:A 编译后 B 用同一 project_id/workspace 读不到;
② 写端:B 覆盖 A 的卡库被 403 拒绝,原文件逐字节不变;
③ 兼容面:旧无属主卡库(即当前唯一落盘布局)对任何主体不可见,且**只读保留**——
   不会被读取面删除,也不会被任何人的重编译覆盖;
④ 注入面:B 的上下文不含 A 的卡,A 本人正常命中;
⑤ 选卡出口:属主判据在 `select_relevant_cards` 一层即可生效。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import knowledge as knowledge_router
from app.services import codebase_indexer as ci_mod
from app.services import long_term_memory as ltm_mod
from app.services.knowledge_compiler import compile_project, select_relevant_cards, slugify

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
]
_QUERY = "Engine 索引"


def _mk_app(uid: str) -> FastAPI:
    app = FastAPI()
    app.include_router(knowledge_router.router, prefix="/api")

    async def _fake_current_user_id() -> str:
        return uid

    app.dependency_overrides[get_current_user_id] = _fake_current_user_id
    return app


@pytest.fixture
def patched_sources(monkeypatch, tmp_path):
    """两端点用例:workspace 白名单指向 tmp_path,两数据源替身(零网络)。"""
    monkeypatch.setenv("IHUI_WORKSPACE_ROOTS", str(tmp_path))

    async def fake_search(query: str, **kwargs: Any) -> list[dict[str, Any]]:
        return list(_FAKE_CODEBASE)

    async def fake_recall(user_id: str, query: str, *, top_k: int = 5) -> list[dict[str, Any]]:
        return list(_FAKE_SUMMARIES)

    monkeypatch.setattr(ci_mod.codebase_indexer, "search", fake_search)
    monkeypatch.setattr(ltm_mod.long_term_memory, "recall_cross_session", fake_recall)


def _cards_file(root: Path, project_id: str) -> Path:
    return root / ".ihui" / "knowledge" / "cards" / f"{slugify(project_id)}.json"


async def _compile_via_http(app: FastAPI, ws: Path, project_id: str) -> Any:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        return await c.post(
            "/api/knowledge/compile",
            json={"project_id": project_id, "workspace_path": str(ws)},
        )


async def _compile_service(ws: Path, project_id: str, owner: str) -> dict[str, Any]:
    return await compile_project(
        project_id,
        ws,
        user_id=owner,
        sources={"codebase": list(_FAKE_CODEBASE), "summaries": list(_FAKE_SUMMARIES)},
    )


# =============================================================================
# ① 端点面:B 用同一 project_id / workspace 读不到 A 的卡
# =============================================================================


@pytest.mark.asyncio
async def test_other_user_cannot_read_shared_workspace_cards(tmp_path, patched_sources):
    assert (await _compile_via_http(_mk_app("alice"), tmp_path, "proj-api")).status_code == 200

    async with AsyncClient(transport=ASGITransport(app=_mk_app("bob")), base_url="http://test") as c:
        res = await c.get(
            "/api/knowledge/cards",
            params={"project_id": "proj-api", "workspace_path": str(tmp_path)},
        )
    assert res.status_code == 200
    assert res.json()["data"] == {"cards": [], "total": 0}


# =============================================================================
# ② 写端:B 覆盖被 403 拒绝,原文件逐字节不变
# =============================================================================


@pytest.mark.asyncio
async def test_other_user_cannot_overwrite_shared_workspace_cards(tmp_path, patched_sources):
    assert (await _compile_via_http(_mk_app("alice"), tmp_path, "proj-api")).status_code == 200
    path = _cards_file(tmp_path, "proj-api")
    before = path.read_bytes()

    res = await _compile_via_http(_mk_app("bob"), tmp_path, "proj-api")
    assert res.status_code == 403
    assert path.read_bytes() == before, "拒绝路径必须零写入"


# =============================================================================
# ③ 兼容面:旧无属主卡库不可见,但只读保留(不删、不被任何人重编译覆盖)
# =============================================================================


@pytest.mark.asyncio
async def test_legacy_unowned_cards_are_invisible_and_untouched(tmp_path, patched_sources):
    legacy = [
        {
            "id": "legacy-1",
            "kind": "fact",
            "statement": "src/core/engine.py:42 存在 class Engine",
            "anchors": [{"type": "file", "ref": "src/core/engine.py", "line": 42}],
            "compiled_at": datetime.now(UTC).isoformat(),
            "ttl_days": 30,
            "source_hash": "legacy",
        }
    ]
    path = _cards_file(tmp_path, "proj-legacy")
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")
    before = path.read_bytes()

    async with AsyncClient(transport=ASGITransport(app=_mk_app("alice")), base_url="http://test") as c:
        res = await c.get(
            "/api/knowledge/cards",
            params={"project_id": "proj-legacy", "workspace_path": str(tmp_path)},
        )
    assert res.json()["data"]["total"] == 0, "旧卡无属主 ⇒ 不可见(fail-closed)"

    # 重编译同样不得夺取旧库:失败即零写入,旧文件原样留在盘上(只读兼容)。
    assert (await _compile_via_http(_mk_app("alice"), tmp_path, "proj-legacy")).status_code == 403
    assert path.read_bytes() == before


# =============================================================================
# ④ 注入面:B 的上下文不含 A 的卡,A 本人正常命中
# =============================================================================


@pytest.mark.asyncio
async def test_injection_skips_foreign_cards(tmp_path, monkeypatch):
    await _compile_service(tmp_path, "proj-inj", "alice")
    monkeypatch.setenv("KNOWLEDGE_CARDS_ENABLED", "1")

    from app.routers import llm as llm_router

    msgs = [
        {"role": "system", "content": "S"},
        {"role": "user", "content": _QUERY},
    ]
    out_b, n_b = llm_router._inject_knowledge_cards(msgs, _QUERY, str(tmp_path), "bob")
    assert (out_b, n_b) == (msgs, 0), "他人的卡不得进入调用方上下文"

    out_a, n_a = llm_router._inject_knowledge_cards(msgs, _QUERY, str(tmp_path), "alice")
    assert n_a >= 1
    assert "<knowledge_cards>" in out_a[0]["content"]
    assert "src/core/engine.py" in out_a[0]["content"]


# =============================================================================
# ⑤ 选卡出口:属主判据单点可生效
# =============================================================================


@pytest.mark.asyncio
async def test_select_relevant_cards_respects_owner(tmp_path):
    await _compile_service(tmp_path, "proj-sel", "alice")
    assert select_relevant_cards(tmp_path, _QUERY, owner_user_id="bob", require_owner=True) == []
    hits = select_relevant_cards(tmp_path, _QUERY, owner_user_id="alice", require_owner=True)
    assert hits and hits[0]["statement"].startswith("src/core/engine.py:42")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
