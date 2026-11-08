# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P1 AIS-080:search_codebase / index_codebase 必须过工作区白名单。

旧写法只 resolve/取 workspace_key ⇒ 根外任意目录可被关键词扫描、被 index_repository
索引并送去 embedding。本夹具钉住:根外 → PATH_NOT_ALLOWED,关键词扫描 / 懒索引 /
index_repository 均未被调用;登记根内行为不变。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import codebase_indexer as _cbi
from app.services import mcp_server


class _IndexResult(SimpleNamespace):
    pass


def _index_result() -> _IndexResult:
    return _IndexResult(
        repo_id="r1", files_scanned=1, files_indexed=1, files_unchanged=0,
        files_deleted=0, chunks_created=2, chunks_vectorized=2, merkle_root="m",
        traversal_engine="walk", traversal_duration_s=0.1, traversal_files_seen=1,
        traversal_degraded_reason=None, snapshot_state="ok", snapshot_detail=None,
        lock_state="ok", lock_detail=None, files_ignored=0, ignored_by="none",
        files_tracked_ignored_kept=0, tracked_ignored_kept=[], ignore_notes=[],
        files_renamed=0, rename_candidates=[], rename_note=None,
        dir_rhash_note=None, dirs_moved=0, errors=[],
    )


class _LazyOutcome:
    def __init__(self) -> None:
        self.results: list[dict] = []
        self.status = "ok"
        self.reason = "fake"

    def as_response_field(self) -> dict:
        return {"status": self.status, "reason": self.reason}


@pytest.fixture
def workspace(tmp_path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(root))
    return root


async def test_search_codebase_rejects_outside_dir(
    workspace, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "x.py").write_text("def leaked():\n    pass\n", encoding="utf-8")

    keyword_calls: list[tuple] = []
    lazy_calls: list[tuple] = []
    semantic_calls: list[tuple] = []

    def _keyword_spy(*args, **kwargs):
        keyword_calls.append(args)
        return [], 0

    async def _search_spy(query, **kwargs):
        semantic_calls.append((query, kwargs))
        return []

    async def _lazy_spy(indexer, query, path, max_results, **kwargs):
        lazy_calls.append((query, path, max_results))
        return _LazyOutcome()

    monkeypatch.setattr(mcp_server, "_search_codebase_keyword_sync", _keyword_spy)
    monkeypatch.setattr(mcp_server, "_lazy_index_and_research", _lazy_spy)
    monkeypatch.setattr(_cbi.codebase_indexer, "search", _search_spy)

    out = await mcp_server._tool_search_codebase(
        {"query": "leaked", "path": str(outside)}
    )

    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"
    assert keyword_calls == []
    assert lazy_calls == []
    assert semantic_calls == []


async def test_index_codebase_rejects_outside_dir(
    workspace, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    outside = tmp_path / "outside-index"
    outside.mkdir()
    (outside / "x.py").write_text("print(1)\n", encoding="utf-8")

    index_calls: list[tuple] = []

    async def _index_spy(path, **kwargs):
        index_calls.append((path, kwargs))
        return _index_result()

    monkeypatch.setattr(mcp_server, "_code_index_egress_allowed", lambda uid: True)
    monkeypatch.setattr(_cbi.codebase_indexer, "index_repository", _index_spy)

    out = await mcp_server._tool_index_codebase({"path": str(outside), "__user_id": "u1"})

    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"
    assert index_calls == []


async def test_search_codebase_inside_workspace_still_scans(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    (workspace / "mod.py").write_text("def target():\n    pass\n", encoding="utf-8")
    keyword_calls: list[tuple] = []

    def _keyword_spy(*args, **kwargs):
        keyword_calls.append(args)
        return [{
            "path": str(workspace / "mod.py"), "file": "mod.py", "line": 1,
            "symbol_type": "def", "code": "def target():", "preview": "def target():",
        }], 0

    monkeypatch.setattr(mcp_server, "_search_codebase_keyword_sync", _keyword_spy)

    out = await mcp_server._tool_search_codebase(
        {"query": "target", "path": str(workspace), "use_semantic": False}
    )

    assert out["ok"] is True
    assert keyword_calls
    assert out["matches"]


async def test_index_codebase_inside_workspace_still_indexes(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    index_calls: list[tuple] = []

    async def _index_spy(path, **kwargs):
        index_calls.append((path, kwargs))
        return _index_result()

    monkeypatch.setattr(mcp_server, "_code_index_egress_allowed", lambda uid: True)
    monkeypatch.setattr(_cbi.codebase_indexer, "index_repository", _index_spy)

    out = await mcp_server._tool_index_codebase({"path": str(workspace), "__user_id": "u1"})

    assert out["ok"] is True
    assert index_calls
    assert index_calls[0][0] == str(workspace.resolve())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
