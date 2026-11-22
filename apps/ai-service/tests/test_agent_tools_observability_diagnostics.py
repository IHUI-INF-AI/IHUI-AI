# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器观测工具 + get_diagnostics 工具单测(2026-11-08)。

钉住:
  ① 三枚新工具同时出现在 _TOOLS 与 _TOOL_HANDLERS(注册面不漏、计数一致);
  ② 观测工具 fail-closed:无主体 / 缺 session_id / 会话不可见 分别具名拒绝;
  ③ 读取上限被夹到 200(不把整条事件流倒给模型);
  ④ get_diagnostics 复用 lsp 判据:参数缺失、工作区被拒、LSP 不可用 均具名降级,
     成功时按 severity 过滤并给出 errors/warnings 计数。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi import HTTPException

from app.api.v1 import lsp as lsp_mod
from app.services import agent_security_prefs
from app.services import browser_hub as bh
from app.services import mcp_server as ms


class FakeObservedSession:
    session_id = "sess-obs"

    def __init__(self) -> None:
        self.console_kwargs: dict[str, Any] = {}
        self.network_kwargs: dict[str, Any] = {}

    async def console_messages(self, **kwargs: Any) -> dict[str, Any]:
        self.console_kwargs = kwargs
        return {"enabled": True, "count": 1, "dropped": 0, "events": [{"text": "boom"}]}

    async def network_requests(self, **kwargs: Any) -> dict[str, Any]:
        self.network_kwargs = kwargs
        return {"enabled": True, "count": 1, "dropped": 0, "pending": 0, "events": [{"status": 500}]}


@pytest.fixture(autouse=True)
def _principal(monkeypatch):
    monkeypatch.setattr(agent_security_prefs, "current_security_principal", lambda: "owner-1")


@pytest.fixture
def fake_hub(monkeypatch):
    session = FakeObservedSession()
    calls: list[tuple[str, str | None]] = []

    def _get_session(session_id: str, caller_uid: str | None = None):
        calls.append((session_id, caller_uid))
        return session if session_id == session.session_id else None

    monkeypatch.setattr(bh.hub, "get_session", _get_session)
    return session, calls


# ---------------------------------------------------------------------------
# ① 注册面
# ---------------------------------------------------------------------------


def test_observability_and_diagnostics_tools_are_registered():
    tool_names = {tool.name for tool in ms._TOOLS}
    for name in ("browser_console_messages", "browser_network_requests", "get_diagnostics"):
        assert name in tool_names
        assert name in ms._TOOL_HANDLERS
    assert len(ms._TOOLS) == len(ms._TOOL_HANDLERS)


# ---------------------------------------------------------------------------
# ② 观测工具 fail-closed + 上限
# ---------------------------------------------------------------------------


async def test_console_tool_rejects_missing_principal(monkeypatch):
    monkeypatch.setattr(agent_security_prefs, "current_security_principal", lambda: None)
    result = await ms._tool_browser_console_messages({"session_id": "sess-obs"})
    assert result["ok"] is False
    assert result["errorCode"] == "PRINCIPAL_REQUIRED"


async def test_console_tool_rejects_missing_session_id(fake_hub):
    result = await ms._tool_browser_console_messages({})
    assert result["errorCode"] == "MISSING_SESSION_ID"


async def test_console_tool_rejects_invisible_session(fake_hub):
    result = await ms._tool_browser_console_messages({"session_id": "sess-other"})
    assert result["errorCode"] == "SESSION_NOT_FOUND"


async def test_console_tool_clamps_limit_and_passes_filters(fake_hub):
    session, calls = fake_hub
    result = await ms._tool_browser_console_messages(
        {"session_id": "sess-obs", "level": "error", "limit": 9999, "textContains": "boom"}
    )
    assert result["ok"] is True
    assert calls == [("sess-obs", "owner-1")]
    assert session.console_kwargs == {"level": "error", "limit": 200, "text_contains": "boom"}


async def test_network_tool_parses_status_and_failed_only(fake_hub):
    session, _ = fake_hub
    result = await ms._tool_browser_network_requests(
        {
            "session_id": "sess-obs",
            "limit": -3,
            "statusMin": "500",
            "failedOnly": True,
            "urlContains": "/api",
        }
    )
    assert result["ok"] is True
    assert session.network_kwargs == {
        "limit": 1,
        "url_contains": "/api",
        "method": "",
        "status_min": 500,
        "failed_only": True,
    }


# ---------------------------------------------------------------------------
# ③ get_diagnostics
# ---------------------------------------------------------------------------


class FakeLspClient:
    def __init__(self) -> None:
        self.started = False
        self.requested: str | None = None

    async def _ensure_started(self) -> None:
        self.started = True

    async def get_diagnostics(self, file_path: str) -> list[dict[str, Any]]:
        self.requested = file_path
        return [
            {
                "severity": 1,
                "range": {"start": {"line": 0, "character": 2}},
                "message": "Type error",
                "source": "ts",
            },
            {
                "severity": 2,
                "range": {"start": {"line": 4, "character": 0}},
                "message": "Unused var",
                "source": "ts",
            },
        ]


@pytest.fixture
def fake_lsp(monkeypatch):
    client = FakeLspClient()
    monkeypatch.setattr(lsp_mod, "_check_lsp_available", lambda: None)
    monkeypatch.setattr(lsp_mod, "_assert_workspace_root", lambda workspace: "/ws")
    monkeypatch.setattr(
        lsp_mod, "_resolve_file", lambda file_value, workspace: str(Path("/ws") / file_value)
    )
    monkeypatch.setattr(lsp_mod.LspClient, "get", staticmethod(lambda workspace: client))
    return client


async def test_get_diagnostics_success_and_severity_filter(fake_lsp):
    result = await ms._tool_get_diagnostics({"workspacePath": "/ws", "file": "app.ts"})
    assert result["ok"] is True
    assert result["count"] == 2
    assert result["errors"] == 1
    assert result["warnings"] == 1
    assert fake_lsp.started is True
    assert fake_lsp.requested == str(Path("/ws/app.ts"))
    first = result["diagnostics"][0]
    assert (first["severity"], first["line"], first["column"]) == ("Error", 1, 3)

    only_warnings = await ms._tool_get_diagnostics(
        {"workspacePath": "/ws", "file": "app.ts", "severity": "warning"}
    )
    assert only_warnings["count"] == 1
    assert only_warnings["diagnostics"][0]["severity"] == "Warning"


async def test_get_diagnostics_requires_arguments(fake_lsp):
    result = await ms._tool_get_diagnostics({"workspacePath": "/ws"})
    assert result["ok"] is False
    assert result["errorCode"] == "MISSING_ARGUMENTS"


async def test_get_diagnostics_requires_principal(fake_lsp, monkeypatch):
    monkeypatch.setattr(agent_security_prefs, "current_security_principal", lambda: None)
    result = await ms._tool_get_diagnostics({"workspacePath": "/ws", "file": "app.ts"})
    assert result["errorCode"] == "PRINCIPAL_REQUIRED"


async def test_get_diagnostics_workspace_rejected(fake_lsp, monkeypatch):
    def _reject(workspace: str):
        raise HTTPException(status_code=403, detail="workspace 不在白名单")

    monkeypatch.setattr(lsp_mod, "_assert_workspace_root", _reject)
    result = await ms._tool_get_diagnostics({"workspacePath": "/etc", "file": "passwd"})
    assert result["ok"] is False
    assert result["errorCode"] == "WORKSPACE_REJECTED"


async def test_get_diagnostics_lsp_unavailable(fake_lsp, monkeypatch):
    def _unavailable():
        raise HTTPException(status_code=503, detail="lsp 不可用")

    monkeypatch.setattr(lsp_mod, "_check_lsp_available", _unavailable)
    result = await ms._tool_get_diagnostics({"workspacePath": "/ws", "file": "app.ts"})
    assert result["ok"] is False
    assert result["errorCode"] == "LSP_UNAVAILABLE"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
