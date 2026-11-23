# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""find_import_edges MCP 工具测试(P0-8 第八批,2026-11-23)。

测试隔离(AGENTS.md §5 铁律):不连库、不打 HTTP —— knowledge_fs 与 repo_id 推导两处
全部 monkeypatch;拒绝路径一律断言 `must_not_call.assert_not_awaited()`(拒绝时副作用零发生)。

覆盖:缺 target / 缺身份 / direction 非法 / limit 非法 / from 档透传(含 direction 与 limit) /
to 档透传(按 toName 口径由 service 决定,这里只断言方向参数到位)/ repo_id 缺省按 path 推导 /
空集 detail 原委透传 / 注册双射(工具在 _TOOLS 与 _TOOL_HANDLERS 各一枚)。
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services import knowledge_fs as knowledge_fs_module
from app.services import mcp_server


def _edges_payload() -> dict:
    return {
        "status": "ok",
        "repo_id": "r-hash",
        "target": "src/a.py",
        "direction": "from",
        "count": 2,
        "edges": [
            {
                "path": "/repo/r-hash/src/a.py#os",
                "file_path": "src/a.py",
                "line": 1,
                "kind": "import",
                "from_name": "src/a.py",
                "to_name": "os",
            },
            {
                "path": "/repo/r-hash/src/a.py#json",
                "file_path": "src/a.py",
                "line": 2,
                "kind": "import",
                "from_name": "src/a.py",
                "to_name": "json",
            },
        ],
    }


async def test_missing_target_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    must_not_call = AsyncMock()
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", must_not_call)
    out = await mcp_server._tool_find_import_edges({"__user_id": "u1", "target": "   "})
    assert out["ok"] is False and out["errorCode"] == "missing_argument"
    must_not_call.assert_not_awaited()


async def test_missing_identity_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    must_not_call = AsyncMock()
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", must_not_call)
    out = await mcp_server._tool_find_import_edges({"target": "src/a.py"})
    assert out["ok"] is False and out["errorCode"] == "missing_identity"
    must_not_call.assert_not_awaited()


@pytest.mark.parametrize("bad", ["both", "FROM", "xyz"])
async def test_bad_direction_rejected(monkeypatch: pytest.MonkeyPatch, bad: str) -> None:
    must_not_call = AsyncMock()
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", must_not_call)
    out = await mcp_server._tool_find_import_edges(
        {"__user_id": "u1", "target": "src/a.py", "direction": bad}
    )
    assert out["ok"] is False and out["errorCode"] == "invalid_argument"
    must_not_call.assert_not_awaited()


@pytest.mark.parametrize("bad", ["abc", "", None])
async def test_bad_limit_rejected(monkeypatch: pytest.MonkeyPatch, bad: object) -> None:
    must_not_call = AsyncMock()
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", must_not_call)
    out = await mcp_server._tool_find_import_edges(
        {"__user_id": "u1", "target": "src/a.py", "limit": bad}
    )
    assert out["ok"] is False and out["errorCode"] == "invalid_argument"
    must_not_call.assert_not_awaited()


async def test_from_direction_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = AsyncMock(return_value=_edges_payload())
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", fake)
    out = await mcp_server._tool_find_import_edges(
        {"__user_id": "u1", "target": "src/a.py", "repo_id": "r-hash"}
    )
    assert out["ok"] is True and out["status"] == "ok" and out["count"] == 2
    assert out["direction"] == "from"
    assert [e["to_name"] for e in out["edges"]] == ["os", "json"]
    fake.assert_awaited_once_with("r-hash", "src/a.py", "u1", direction="from", limit=50)


async def test_to_direction_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = _edges_payload()
    payload["direction"] = "to"
    payload["target"] = "os"
    fake = AsyncMock(return_value=payload)
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", fake)
    out = await mcp_server._tool_find_import_edges(
        {"__user_id": "u1", "target": "os", "direction": "to", "repo_id": "r-hash"}
    )
    assert out["ok"] is True and out["direction"] == "to"
    fake.assert_awaited_once_with("r-hash", "os", "u1", direction="to", limit=50)


async def test_repo_id_derived_from_path(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import codebase_indexer

    seen: list[object] = []

    def fake_repo_id(root: object) -> str:
        seen.append(root)
        return "r-derived"

    monkeypatch.setattr(
        codebase_indexer, "_default_repo_id", fake_repo_id, raising=True
    )
    fake = AsyncMock(return_value=_edges_payload())
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", fake)
    out = await mcp_server._tool_find_import_edges(
        {"__user_id": "u1", "target": "src/a.py", "path": "."}
    )
    assert out["repo_id"] == "r-derived" and len(seen) == 1


async def test_empty_detail_passed_through(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = AsyncMock(
        return_value={
            "status": "catalog_missing",
            "detail": "repo 有切片但边表无该记录:…TS/JS 的 import {x} from 'm' 不产边…",
            "repo_id": "r-hash",
            "target": "src/a.py",
            "direction": "from",
        }
    )
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_imports", fake)
    out = await mcp_server._tool_find_import_edges(
        {"__user_id": "u1", "target": "src/a.py", "repo_id": "r-hash"}
    )
    assert out["ok"] is False and out["status"] == "catalog_missing"
    assert "TS/JS" in out["detail"]


def test_tool_registered_both_faces() -> None:
    names = [t.name for t in mcp_server._TOOLS]
    assert "find_import_edges" in names
    assert mcp_server._TOOL_HANDLERS["find_import_edges"] is mcp_server._tool_find_import_edges
    assert len(mcp_server._TOOL_HANDLERS) == len(mcp_server._TOOLS)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
