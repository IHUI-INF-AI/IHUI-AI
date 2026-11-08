# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工作区索引开关:取消不被自动打开揭掉,懒索引在取消后不建索引。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import mcp_server as mcp_server_mod
from app.services.mcp_server import _lazy_index_and_research, _tool_index_codebase
from app.services.workspace_index_policy import (
    apply_workspace_index,
    bind_index_store,
    clear_workspace_index_settings,
    decide,
    indexing_decision,
    transition,
    workspace_key,
)


@pytest.fixture(autouse=True)
def _clean_settings():
    bind_index_store(None)
    clear_workspace_index_settings()
    yield
    bind_index_store(None)
    clear_workspace_index_settings()


def test_cancel_is_not_cleared_by_turning_the_switch_back_on() -> None:
    setting = transition(None, "cancel")
    setting = transition(setting, "set_on")
    setting = transition(setting, "set_auto_on")
    assert decide(setting).phase == "cancelled"
    assert decide(setting).allow_index is False
    opened = transition(setting, "start")
    assert decide(opened).phase == "explicit-on"
    assert decide(opened).allow_index is True


def test_missing_setting_stays_implicit() -> None:
    decision = decide(None)
    assert decision.phase == "implicit"
    assert decision.allow_index is True


class _Indexer:
    def __init__(self) -> None:
        self.calls = 0

    async def index_repository(self, *_args: object, **_kwargs: object) -> None:
        self.calls += 1

    async def search(self, *_args: object, **_kwargs: object) -> list[object]:
        return []


async def test_lazy_index_stops_before_reading_the_repo(tmp_path: object) -> None:
    path = str(tmp_path)
    apply_workspace_index(workspace_key(path), "cancel")
    indexer = _Indexer()
    outcome = await _lazy_index_and_research(indexer, "认证", path, 5, "user-1")
    assert outcome.status == "skipped-index-cancelled"
    assert indexer.calls == 0


async def test_index_tool_switch_does_not_start_an_index(tmp_path: object) -> None:
    path = str(tmp_path)
    turned_off = await _tool_index_codebase({"path": path, "index_control": "set_off"})
    assert turned_off["phase"] == "explicit-off"
    assert turned_off["allowIndex"] is False
    blocked = await _tool_index_codebase({"path": path})
    assert blocked["ok"] is False
    assert blocked["skipped"] == "explicit-off"


def test_cancel_survives_reopen(tmp_path) -> None:
    store = tmp_path / "workspace-index-settings.json"
    bind_index_store(store)
    apply_workspace_index("ws-a", "cancel")
    bind_index_store(None)
    bind_index_store(store)
    assert indexing_decision("ws-a").phase == "cancelled"
    apply_workspace_index("ws-a", "set_on")
    bind_index_store(store)
    assert indexing_decision("ws-a").allow_index is False
    assert indexing_decision("ws-b").phase == "implicit"


def test_unreadable_store_is_not_treated_as_enabled(tmp_path) -> None:
    store = tmp_path / "workspace-index-settings.json"
    store.write_text("{", encoding="utf-8")
    bind_index_store(store)
    blocked = indexing_decision("ws-a")
    assert blocked.phase == "unjudged"
    assert blocked.allow_index is False
    still = apply_workspace_index("ws-a", "start")
    assert still.phase == "unjudged"
    assert still.allow_index is False


def test_one_bad_workspace_does_not_unlock_the_others(tmp_path) -> None:
    store = tmp_path / "workspace-index-settings.json"
    store.write_text(
        '{"version":1,"workspaces":{"ws-a":{"enabled":"yes","auto":true,"cancelled":false},'
        '"ws-b":{"enabled":false,"auto":true,"cancelled":false}}}',
        encoding="utf-8",
    )
    bind_index_store(store)
    assert indexing_decision("ws-a").phase == "unjudged"
    assert indexing_decision("ws-b").phase == "explicit-off"


# =============================================================================
# AIS-080:索引根与搜索根同一把工作区尺
# =============================================================================


async def test_index_tool_rejects_existing_root_outside_workspace(
    tmp_path, monkeypatch
) -> None:
    """旧路径:任意绝对路径不再能被索引/外传。"""
    ws = tmp_path / "ws"
    ws.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    monkeypatch.setattr(mcp_server_mod, "_get_workspace_roots", lambda: [str(ws)])
    monkeypatch.setattr(mcp_server_mod, "_code_index_egress_allowed", lambda *_a, **_k: True)
    indexer = MagicMock()
    indexer.index_repository = AsyncMock()
    monkeypatch.setattr(
        "app.services.codebase_indexer.codebase_indexer.index_repository",
        indexer.index_repository,
    )
    out = await _tool_index_codebase({"path": str(outside)})
    assert out["ok"] is False
    # 越界文案统一到 main 详细版:必须点明"不在工作区白名单"并带上被拒路径本身。
    assert "不在工作区白名单" in out["error"] and str(outside) in out["error"]
    indexer.index_repository.assert_not_awaited()


async def test_index_tool_allows_workspace_root(tmp_path, monkeypatch) -> None:
    """正常路径:白名单内的索引根不被误挡。"""
    ws = tmp_path / "ws"
    ws.mkdir()
    monkeypatch.setattr(mcp_server_mod, "_get_workspace_roots", lambda: [str(ws)])
    monkeypatch.setattr(mcp_server_mod, "_code_index_egress_allowed", lambda *_a, **_k: True)
    result = MagicMock()
    result.errors = []
    fake = AsyncMock(return_value=result)
    monkeypatch.setattr(
        "app.services.codebase_indexer.codebase_indexer.index_repository", fake
    )
    out = await _tool_index_codebase({"path": str(ws)})
    assert out["ok"] is True
    fake.assert_awaited_once()
    assert fake.await_args.args[0] == str(ws)


# ​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
