# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""聊天 SSE 的 dispatch_subagent 入参接 resolve_subagent_tool_surface。

缺 allowedTools / disallowedTools 时不给 orchestrator 加新参数。
两键都在时,禁止名单从允许名单里抠掉再传下去。非法名单不派发。
"""

from __future__ import annotations

import pytest

from app.services.agent_orchestrator import AgentStepResult
from app.services.mcp_server import _tool_dispatch_subagent


class _RecordingOrchestrator:
    def __init__(self) -> None:
        self.invoke_kwargs: list[dict[str, object]] = []

    async def invoke(
        self,
        agent_name: str,
        user_input: str,
        session_id: str | None = None,
        **kwargs: object,
    ) -> AgentStepResult:
        self.invoke_kwargs.append(dict(kwargs))
        return AgentStepResult(
            agent_name=agent_name,
            input=user_input,
            output="ok",
            status="completed",
            duration_ms=1.0,
        )


async def test_missing_tool_lists_leave_invoke_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent({"name": "coder", "task": "do"})
    assert out["ok"] is True
    assert fake.invoke_kwargs == [{}]


async def test_allowed_and_disallowed_are_resolved(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent(
        {
            "name": "coder",
            "task": "do",
            "allowedTools": ["read_file", "write_file"],
            "disallowedTools": ["write_file"],
        }
    )
    assert out["ok"] is True
    assert fake.invoke_kwargs == [
        {"tool_allow": ["read_file"], "tool_deny": ["write_file"]}
    ]


async def test_fully_denied_allow_is_passed_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent(
        {
            "name": "coder",
            "task": "do",
            "allowedTools": ["write_file"],
            "disallowedTools": ["write_file"],
        }
    )
    assert out["ok"] is True
    assert fake.invoke_kwargs == [{"tool_allow": [], "tool_deny": ["write_file"]}]


async def test_bad_tool_list_does_not_invoke(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "do", "allowedTools": "read_file"}
    )
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"
    assert fake.invoke_kwargs == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
