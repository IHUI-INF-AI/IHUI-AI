# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""list_symbol_definitions MCP 工具测试(P0-8 第五批,2026-11-23)。

测试隔离(AGENTS.md §5 铁律):不连库、不打 HTTP —— knowledge_fs 与 repo_id 推导两处
全部 monkeypatch。

覆盖:缺 name / 缺身份(两种都不许发起上游调用)/ limit 非法 / 正常透传 /
repo_id 缺省按 path 推导 / 空集 detail 原委透传 / 注册双射。
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services import knowledge_fs as knowledge_fs_module
from app.services import mcp_server


def _defs_payload() -> dict:
    return {
        "status": "ok",
        "repo_id": "r-hash",
        "name": "fn_a",
        "count": 2,
        "definitions": [
            {
                "path": "/repo/r-hash/src/a.py#fn_a",
                "file_path": "src/a.py",
                "line_start": 3,
                "line_end": 9,
                "kind": "function",
            },
            {
                "path": "/repo/r-hash/src/deep/b.py#fn_a",
                "file_path": "src/deep/b.py",
                "line_start": 41,
                "line_end": 47,
                "kind": "function",
            },
        ],
    }


async def test_missing_name_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    must_not_call = AsyncMock()
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_symbols", must_not_call)
    out = await mcp_server._tool_list_symbol_definitions({"__user_id": "u1", "name": "   "})
    assert out["ok"] is False and out["errorCode"] == "missing_argument"
    must_not_call.assert_not_awaited()


async def test_missing_identity_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    must_not_call = AsyncMock()
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_symbols", must_not_call)
    out = await mcp_server._tool_list_symbol_definitions({"name": "fn_a"})
    assert out["ok"] is False and out["errorCode"] == "missing_identity"
    must_not_call.assert_not_awaited()


@pytest.mark.parametrize("bad", ["abc", "", None])
async def test_bad_limit_rejected(monkeypatch: pytest.MonkeyPatch, bad: object) -> None:
    must_not_call = AsyncMock()
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_symbols", must_not_call)
    out = await mcp_server._tool_list_symbol_definitions(
        {"__user_id": "u1", "name": "fn_a", "limit": bad}
    )
    assert out["ok"] is False and out["errorCode"] == "invalid_argument"
    must_not_call.assert_not_awaited()


async def test_happy_path_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = AsyncMock(return_value=_defs_payload())
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_symbols", fake)
    out = await mcp_server._tool_list_symbol_definitions(
        {"__user_id": "u1", "name": "fn_a", "repo_id": "r-hash", "limit": 50}
    )
    assert out["ok"] is True and out["status"] == "ok" and out["count"] == 2
    assert [d["file_path"] for d in out["definitions"]] == ["src/a.py", "src/deep/b.py"]
    fake.assert_awaited_once_with("r-hash", "fn_a", "u1", limit=50)


async def test_repo_id_derived_from_path(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import codebase_indexer

    seen: list[object] = []

    def fake_repo_id(root: object) -> str:
        seen.append(root)
        return "derived-hash"

    monkeypatch.setattr(codebase_indexer, "_default_repo_id", fake_repo_id)
    fake = AsyncMock(return_value={**_defs_payload(), "repo_id": "derived-hash"})
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_symbols", fake)
    out = await mcp_server._tool_list_symbol_definitions(
        {"__user_id": "u1", "name": "fn_a", "path": "."}
    )
    assert out["repo_id"] == "derived-hash"
    assert fake.await_args.args[0] == "derived-hash"
    assert len(seen) == 1


async def test_empty_catalog_missing_detail_survives(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = AsyncMock(
        return_value={
            "status": "catalog_missing",
            "detail": "repo 有切片但实体表无该符号:或索引建立于实体表之前(重建索引可补齐)",
            "repo_id": "r",
            "name": "fn_a",
        }
    )
    monkeypatch.setattr(knowledge_fs_module.knowledge_fs, "list_symbols", fake)
    out = await mcp_server._tool_list_symbol_definitions(
        {"__user_id": "u1", "name": "fn_a", "repo_id": "r"}
    )
    assert out["ok"] is False and out["status"] == "catalog_missing"
    assert "重建索引可补齐" in out["detail"]


def test_registry_is_bijective_for_new_tool() -> None:
    names = [t.name for t in mcp_server._TOOLS]
    assert names.count("list_symbol_definitions") == 1
    assert "list_symbol_definitions" in mcp_server._TOOL_HANDLERS
    assert mcp_server._TOOL_HANDLERS["list_symbol_definitions"] is (
        mcp_server._tool_list_symbol_definitions
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
