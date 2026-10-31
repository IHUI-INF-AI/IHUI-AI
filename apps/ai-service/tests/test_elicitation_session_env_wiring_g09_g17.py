# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-09 / G-17 接线钉(2026-10-31):工具审批窗口 elicitation 计数 + 会话身份注入子进程。

G-09:ElicitationService 原先零调用方。本文件钉住:
- 真实审批等待窗口内 ``paused`` 为 True / ``outstanding`` 递增,离开窗口(批准、
  异常退出)后归零;
- ``McpToolApprovalPromptOptions.build`` 的 ``tool_call_elicitation_enabled`` 取
  "服务真实可用",能力缺席时持久选项不可用且 always 授权降级为 session;
- 并发未决审批数如实计数。

G-17:``inject_session_env`` 原先零调用方。本文件钉住:
- ``_build_subprocess_env`` 在终端执行上下文带 session_id 时注入
  IHUI_SESSION_ID / IHUI_VERSION,无上下文时不注入(env 与改动前同形);
- ``run_command`` 真实子进程能看到会话身份键;
- ``command_streamer.stream_command`` 的 env 透传处同样注入(上下文 / 显式入参
  两条路),无身份时子进程环境保持原样。
"""

from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

import pytest

# =============================================================================
# 公共桩:与 test_approval_scope_d84 同构的 _request_approval 最小 self
# =============================================================================


@dataclass
class _StubToolCall:
    """最小 ToolCall 形态(_request_approval 只消费 name/args/id)。"""

    id: str = "tc_g09"
    name: str = "write_file"
    args: dict[str, Any] = field(default_factory=lambda: {"path": "/tmp/g09.txt"})


class _StubLoop:
    """_request_approval 的最小 self(鸭子类型,不构造完整 AgentLoopV2)。"""

    def __init__(self, emitted: list[dict[str, Any]] | None = None) -> None:
        self._decision_hints: dict[str, tuple[str, str]] = {}
        self._user_id = "user-1"
        self._session_id = "sess-g09"
        self._approval_timeout = 5
        self.emitted: list[dict[str, Any]] = emitted if emitted is not None else []
        self._events = SimpleNamespace(tool_approval=self._emit)

    async def _emit(self, **kwargs: Any) -> None:
        self.emitted.append(kwargs)


@pytest.fixture()
def v2():
    """隔离审批登记表(全局 dict,用例前后清空)。"""
    from app.services import agent_loop_v2 as mod

    mod._approval_registry.clear()
    mod._approval_persist_keys.clear()
    yield mod
    mod._approval_registry.clear()
    mod._approval_persist_keys.clear()


@pytest.fixture()
def persist(tmp_path):
    """独立 db 路径(隔离 approval_persistence 全局单例)。"""
    from app.services import approval_persistence as ap

    ap.set_db_path(tmp_path / "grants.db")
    yield ap
    ap.close()
    ap.set_db_path(ap.DEFAULT_DB_PATH)


@pytest.fixture()
def elicitation_service():
    """取真实懒构造单例,用例后恢复全局槽位。"""
    from app.services import mcp_server

    saved = mcp_server._ELICITATION_SERVICE
    mcp_server._ELICITATION_SERVICE = None
    service = mcp_server._get_elicitation_service()
    assert service is not None, "ElicitationService 应可构造"
    yield service
    mcp_server._ELICITATION_SERVICE = saved


async def _no_review(tool_name: str, args: Any, **kwargs: Any) -> Any:
    from app.services import agent_loop_v2 as mod

    return mod.unavailable_review("disabled")


async def _wait_registry(mod: Any, expected: int = 1) -> str:
    for _ in range(600):
        if len(mod._approval_registry) >= expected:
            return next(iter(mod._approval_registry))
        await asyncio.sleep(0.005)
    raise AssertionError("审批条目未在窗口内登记")


# =============================================================================
# G-09:申请窗口计数暂停
# =============================================================================


@pytest.mark.asyncio
async def test_approval_window_pauses_and_clears(
    v2: Any, persist: Any, elicitation_service: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """(a) register 期间 paused=True/outstanding+1;释放后 False/归零。"""
    monkeypatch.setattr(v2, "request_guardian_review", _no_review)
    monkeypatch.setattr(persist, "check", lambda key, kind: None)
    base = elicitation_service.outstanding

    stub = _StubLoop()
    tc = _StubToolCall()
    task = asyncio.create_task(v2.AgentLoopV2._request_approval(stub, tc))
    approval_id = await _wait_registry(v2)

    assert elicitation_service.paused is True
    assert elicitation_service.outstanding == base + 1

    outcome = v2.resolve_approval_for_requester(approval_id, "approve", "user-1", scope="once")
    assert outcome is v2.ApprovalOutcome.APPLIED
    assert await task is None
    assert elicitation_service.outstanding == base
    assert elicitation_service.paused is False


@pytest.mark.asyncio
async def test_approval_exception_exit_releases_registration(
    v2: Any, persist: Any, elicitation_service: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """(b) 审批路径异常退出(popup 事件发射炸掉)也必须归零。"""
    monkeypatch.setattr(v2, "request_guardian_review", _no_review)
    monkeypatch.setattr(persist, "check", lambda key, kind: None)
    base = elicitation_service.outstanding

    async def _boom(**kwargs: Any) -> None:
        raise RuntimeError("tool.approval emit failed")

    stub = _StubLoop()
    stub._events = SimpleNamespace(tool_approval=_boom)
    with pytest.raises(RuntimeError, match="emit failed"):
        await v2.AgentLoopV2._request_approval(stub, _StubToolCall())

    assert elicitation_service.outstanding == base
    assert elicitation_service.paused is False
    assert v2._approval_registry == {}
    assert v2._approval_persist_keys == {}


@pytest.mark.asyncio
async def test_outstanding_counts_concurrent_pending_approvals(
    v2: Any, persist: Any, elicitation_service: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """outstanding 反映真实未决数:两条并发审批 = +2,全部结算后归零。"""
    monkeypatch.setattr(v2, "request_guardian_review", _no_review)
    monkeypatch.setattr(persist, "check", lambda key, kind: None)
    base = elicitation_service.outstanding

    stub = _StubLoop()
    tcs = [
        _StubToolCall(id="tc_g09_a", args={"path": "/tmp/a.txt"}),
        _StubToolCall(id="tc_g09_b", args={"path": "/tmp/b.txt"}),
    ]
    tasks = [
        asyncio.create_task(v2.AgentLoopV2._request_approval(stub, tc)) for tc in tcs
    ]
    for _ in range(600):
        if len(v2._approval_registry) >= 2:
            break
        await asyncio.sleep(0.005)
    assert len(v2._approval_registry) == 2
    assert elicitation_service.outstanding == base + 2
    assert elicitation_service.paused is True

    for approval_id in list(v2._approval_registry):
        assert (
            v2.resolve_approval_for_requester(approval_id, "approve", "user-1", scope="once")
            is v2.ApprovalOutcome.APPLIED
        )
    assert await asyncio.gather(*tasks) == [None, None]
    assert elicitation_service.outstanding == base
    assert elicitation_service.paused is False


@pytest.mark.asyncio
async def test_prompt_options_follow_real_elicitation_capability(
    v2: Any,
    persist: Any,
    elicitation_service: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """tool_call_elicitation_enabled 取真实可用值:可用 ⇒ 持久选项开;不可用 ⇒ 关且 always 降级。"""
    from app.services import mcp_server

    monkeypatch.setattr(v2, "request_guardian_review", _no_review)
    monkeypatch.setattr(persist, "check", lambda key, kind: None)
    grants: list[tuple[str, str]] = []
    monkeypatch.setattr(
        persist, "grant", lambda scope, key, kind: grants.append((scope, key)) or True
    )

    # ① 能力可用(paused 服务正常构造)
    stub = _StubLoop()
    tc = _StubToolCall()
    task = asyncio.create_task(v2.AgentLoopV2._request_approval(stub, tc))
    approval_id = await _wait_registry(v2)
    assert v2.resolve_approval_for_requester(
        approval_id, "approve", "user-1", scope="once"
    ) is v2.ApprovalOutcome.APPLIED
    await task
    options = stub.emitted[-1]["prompt_options"]
    assert options == {"allow_session_remember": True, "allow_persistent_approval": True}

    # ② 能力不可用(构造失败降级 False)⇒ 持久选项关闭,always 只落 session
    monkeypatch.setattr(mcp_server, "_ELICITATION_SERVICE", False)
    v2._approval_registry.clear()
    stub2 = _StubLoop()
    tc2 = _StubToolCall(id="tc_g09_disabled", args={"path": "/tmp/disabled.txt"})
    task2 = asyncio.create_task(v2.AgentLoopV2._request_approval(stub2, tc2))
    approval_id2 = await _wait_registry(v2)
    assert v2.resolve_approval_for_requester(
        approval_id2, "approve", "user-1", scope="always"
    ) is v2.ApprovalOutcome.APPLIED
    await task2
    options2 = stub2.emitted[-1]["prompt_options"]
    assert options2 == {"allow_session_remember": True, "allow_persistent_approval": False}
    assert grants and grants[-1][0] == "session", grants


# =============================================================================
# G-17:会话身份注入
# =============================================================================


def _tool_env_probe() -> str:
    """run_command 路径的环境探针(Windows 走 cmd 内建 echo 展开 %VAR%)。"""
    if sys.platform == "win32":
        return "echo %IHUI_SESSION_ID%"
    return 'python -c "print(__import__(\'os\').environ.get(\'IHUI_SESSION_ID\',\'\'))"'


def _stream_env_probe() -> str:
    """command_streamer 路径的环境探针(exec 模式,Windows 需显式 cmd /c)。"""
    if sys.platform == "win32":
        return "cmd /c echo %IHUI_SESSION_ID%"
    return (
        f'"{sys.executable}" -c '
        '"print(__import__(\'os\').environ.get(\'IHUI_SESSION_ID\',\'\'))"'
    )


def test_build_subprocess_env_injects_session_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """执行上下文带 session_id ⇒ 子进程 env 可见 IHUI_SESSION_ID + IHUI_VERSION。"""
    from app.core.exec_env import harness_version
    from app.services import mcp_server

    monkeypatch.delenv("IHUI_SESSION_ID", raising=False)
    monkeypatch.delenv("IHUI_VERSION", raising=False)
    token = mcp_server.set_terminal_stream_context(
        session_id="sess-g17-ctx", tool_call_id="tc_g17"
    )
    try:
        env = mcp_server._build_subprocess_env(None)
    finally:
        mcp_server.reset_terminal_stream_context(token)

    assert env["IHUI_SESSION_ID"] == "sess-g17-ctx"
    assert env["IHUI_VERSION"] == harness_version()


def test_build_subprocess_env_unchanged_without_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """无执行上下文(工具直调)⇒ 不注入,env 与改动前同形。"""
    from app.services import mcp_server

    monkeypatch.delenv("IHUI_SESSION_ID", raising=False)
    monkeypatch.delenv("IHUI_VERSION", raising=False)
    env = mcp_server._build_subprocess_env(None)
    assert "IHUI_SESSION_ID" not in env
    assert env.get("PATH") == os.environ.get("PATH")

    # 空 session_id(工具直调的既有注入形态)同样不注入,绝不编造
    token = mcp_server.set_terminal_stream_context(session_id="", tool_call_id="tc")
    try:
        env_empty = mcp_server._build_subprocess_env(None)
    finally:
        mcp_server.reset_terminal_stream_context(token)
    assert "IHUI_SESSION_ID" not in env_empty


@pytest.mark.asyncio
async def test_run_command_child_sees_session_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """真实子进程(run_command)能看到会话身份键。"""
    from app.services import mcp_server

    monkeypatch.delenv("IHUI_SESSION_ID", raising=False)
    monkeypatch.delenv("IHUI_VERSION", raising=False)
    session = "sess-g17-run-command"
    token = mcp_server.set_terminal_stream_context(session_id=session, tool_call_id="tc_g17")
    try:
        result = await mcp_server._tool_run_command({"command": _tool_env_probe()})
    finally:
        mcp_server.reset_terminal_stream_context(token)

    assert result["ok"] is True, result
    assert session in result["stdout"], result


@pytest.mark.asyncio
async def test_run_command_child_without_identity_is_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """未注入路径行为不变:无上下文时子进程拿不到会话身份键。"""
    from app.services import mcp_server

    monkeypatch.delenv("IHUI_SESSION_ID", raising=False)
    result = await mcp_server._tool_run_command({"command": _tool_env_probe()})
    assert result["ok"] is True, result
    assert "sess-g17" not in result["stdout"], result


@pytest.mark.asyncio
async def test_command_streamer_injects_identity_from_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """stream_command 的 env 透传处:执行上下文有身份 ⇒ 子进程可见。"""
    from app.core.exec_env import reset_session_env_context, set_session_env_context
    from app.services import command_streamer as cs

    monkeypatch.delenv("IHUI_SESSION_ID", raising=False)
    session = "sess-g17-stream-ctx"
    token = set_session_env_context(session)
    try:
        stdout: list[str] = []
        async for event in cs.stream_command(_stream_env_probe(), timeout=30):
            if event.get("type") == "stdout":
                stdout.append(str(event.get("content") or ""))
    finally:
        reset_session_env_context(token)
    assert session in "\n".join(stdout), stdout


@pytest.mark.asyncio
async def test_command_streamer_explicit_session_id_and_absent_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """显式 session_id 同样注入;两者都缺省时子进程环境与改动前同形。"""
    from app.services import command_streamer as cs

    monkeypatch.delenv("IHUI_SESSION_ID", raising=False)
    explicit = "sess-g17-stream-explicit"
    result = await cs.run_command_simple(
        _stream_env_probe(), timeout=30, session_id=explicit
    )
    assert result["ok"] is True, result
    assert explicit in result["stdout"], result

    baseline = await cs.run_command_simple(_stream_env_probe(), timeout=30)
    assert baseline["ok"] is True, baseline
    assert explicit not in baseline["stdout"], baseline
    assert "sess-g17" not in baseline["stdout"], baseline
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
