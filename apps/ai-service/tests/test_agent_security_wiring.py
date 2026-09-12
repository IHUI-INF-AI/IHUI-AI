# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P0-3 安全三件套接线测试:agent_loop_v2 主链路 + mcp_server exec_policy 三档。

覆盖:
- 默认配置下良性工具正常执行(零回归)
- prompt 注入探测拦截(policy=refuse + blocked)→ injection_blocked,不执行
- 危险入参扫描拦截 → scan_blocked,不执行
- 双开关关闭 → 占位依赖直通,真实依赖零调用
- exec_policy PROMPT:审批门已批准 → 跳过二次弹窗,登记一次性放行后重执行
- exec_policy PROMPT:非高危工具未过审批门 → 真实审批;拒绝 → user_rejected
- exec_policy audit 模式:不发起审批,NEEDS_APPROVAL 结构原样回给 LLM(旧行为)
- mcp_server:enforce 拦 PROMPT / 放行登记消费 / audit 记录放行 / off 跳过评估
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

import app.services.mcp_server as mcp_server
from app.services import guarded_tool_pipeline as gtp
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolDefinition,
)
from app.services.security_config import (
    reset_security_config,
    set_security_config,
)


@pytest.fixture(autouse=True)
def _restore_config():
    """每条用例后重置安全配置与一次性放行登记,防串扰。"""
    yield
    reset_security_config()
    mcp_server._exec_approved_commands.clear()


# =============================================================================
# 工具构造
# =============================================================================


def _echo_tool(calls: list[dict]) -> ToolDefinition:
    async def executor(args: dict) -> dict:
        calls.append(dict(args))
        return {"ok": True, "echo": args}

    return ToolDefinition(
        name="echo_tool",
        description="echo",
        parameters={"type": "object"},
        executor=executor,
    )


def _cmd_tool(calls: list[dict], *, needs_approval_first: bool = True, name: str = "run_command") -> ToolDefinition:
    """模拟 run_command:首次返回 EXEC_POLICY_NEEDS_APPROVAL,重执行返回成功。

    name 可自定义:拒绝/audit 用例用 "custom_cmd"(非高危,不触发审批门),
    以验证 exec_policy PROMPT 分支自身的审批路径。
    """

    async def executor(args: dict) -> dict:
        calls.append(dict(args))
        if needs_approval_first and len(calls) == 1:
            cmd = str(args.get("command") or "")
            return {
                "ok": False,
                "tool": name,
                "errorCode": "EXEC_POLICY_NEEDS_APPROVAL",
                "command": cmd,
                "approval_request": {"command": cmd, "reason": "测试:命中 PROMPT 规则"},
                "message": "命令需要用户审批后方可执行",
            }
        return {"ok": True, "executed": True}

    return ToolDefinition(
        name=name,
        description="cmd",
        parameters={"type": "object"},
        executor=executor,
    )


def _make_loop(tool: ToolDefinition, *, approval_enabled: bool = False) -> AgentLoopV2:
    async def mock_llm(messages, tools):  # noqa: ANN001, ANN202
        return {"content": "done", "tool_calls": None}

    return AgentLoopV2(
        mock_llm,
        [tool],
        max_iterations=3,
        approval_enabled=approval_enabled,
    )


# =============================================================================
# guarded_pipeline 前置守卫
# =============================================================================


async def test_default_config_benign_tool_passes() -> None:
    """默认配置(防护全开)下良性工具正常执行——零回归。"""
    calls: list[dict] = []
    loop = _make_loop(_echo_tool(calls))
    tr = await loop._execute_single(ToolCall(id="c1", name="echo_tool", args={"q": "hello"}))
    assert tr.error is None
    assert tr.error_type is None
    assert tr.result == {"ok": True, "echo": {"q": "hello"}}
    assert len(calls) == 1


async def test_prompt_guard_blocks_injection(monkeypatch: pytest.MonkeyPatch) -> None:
    """policy=refuse + 探测 blocked → injection_blocked,工具不执行。"""
    set_security_config(prompt_guard_policy="refuse")
    monkeypatch.setattr(
        gtp,
        "_default_prompt_guard",
        lambda text, **kw: {
            "action": "refuse",
            "blocked": True,
            "output": "inj",
            "risk_level": "high",
            "hits": [],
        },
    )
    calls: list[dict] = []
    loop = _make_loop(_echo_tool(calls))
    tr = await loop._execute_single(ToolCall(id="c1", name="echo_tool", args={"q": "x"}))
    assert tr.error_type == "injection_blocked"
    assert tr.result["blocked"] is True
    assert calls == []  # 未执行
    assert loop._decision_hints["c1"][0] == "security_blocked"


async def test_input_scan_blocks_dangerous_args(monkeypatch: pytest.MonkeyPatch) -> None:
    """入参扫描 dangerous → scan_blocked,工具不执行。"""
    fake = SimpleNamespace(
        dangerous=True, findings=[SimpleNamespace(kind="command_injection")]
    )
    monkeypatch.setattr(gtp, "_default_input_scanner", lambda args, **kw: fake)
    calls: list[dict] = []
    loop = _make_loop(_echo_tool(calls))
    tr = await loop._execute_single(ToolCall(id="c1", name="echo_tool", args={"command": "a|b"}))
    assert tr.error_type == "scan_blocked"
    assert "command_injection" in str(tr.error)
    assert calls == []


async def test_guards_disabled_fully_bypass(monkeypatch: pytest.MonkeyPatch) -> None:
    """双开关关闭 → 占位依赖直通,真实探测/扫描零调用,执行不受影响。"""
    set_security_config(prompt_guard_enabled=False, input_scan_enabled=False)
    touched: list[str] = []

    def _fail_pg(text, **kw):  # noqa: ANN001, ANN202
        touched.append("pg")
        return {"blocked": True}

    def _fail_scan(args, **kw):  # noqa: ANN001, ANN202
        touched.append("sc")
        return SimpleNamespace(dangerous=True, findings=[])

    monkeypatch.setattr(gtp, "_default_prompt_guard", _fail_pg)
    monkeypatch.setattr(gtp, "_default_input_scanner", _fail_scan)
    calls: list[dict] = []
    loop = _make_loop(_echo_tool(calls))
    tr = await loop._execute_single(ToolCall(id="c1", name="echo_tool", args={"q": "x"}))
    assert tr.error is None
    assert len(calls) == 1
    assert touched == []


# =============================================================================
# exec_policy PROMPT → 真实审批
# =============================================================================


async def test_exec_policy_gate_approved_skips_second_popup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """run_command 已过审批门 → exec_policy PROMPT 跳过二次弹窗,登记放行后重执行。"""
    set_security_config(exec_policy_mode="enforce")
    approval_calls: list[str] = []

    async def fake_approval(tc: ToolCall) -> None:
        approval_calls.append(tc.name)
        return None

    calls: list[dict] = []
    loop = _make_loop(_cmd_tool(calls), approval_enabled=True)
    monkeypatch.setattr(loop, "_request_approval", fake_approval)
    tr = await loop._execute_single(
        ToolCall(id="c1", name="run_command", args={"command": "git push origin main"})
    )
    # 仅审批门 1 次(无二次弹窗)
    assert approval_calls == ["run_command"]
    # 重执行成功
    assert tr.result == {"ok": True, "executed": True}
    assert tr.error is None
    assert len(calls) == 2
    assert loop._decision_hints["c1"][0] == "exec_policy_approved"
    # 一次性放行已登记(登记表在,供真实 mcp 链路消费)
    assert mcp_server._consume_exec_approval("git push origin main") is True
    assert mcp_server._consume_exec_approval("git push origin main") is False


async def test_exec_policy_rejection_without_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """非高危工具返回 NEEDS_APPROVAL → 真实审批;拒绝 → user_rejected 不执行。"""
    set_security_config(exec_policy_mode="enforce")
    calls: list[dict] = []
    loop = _make_loop(_cmd_tool(calls, name="custom_cmd"), approval_enabled=True)

    async def fake_reject(tc: ToolCall) -> str:
        return "user_rejected"

    monkeypatch.setattr(loop, "_request_approval", fake_reject)
    tr = await loop._execute_single(
        ToolCall(id="c1", name="custom_cmd", args={"command": "x"})
    )
    assert tr.error_type == "user_rejected"
    assert tr.result == {"approved": False, "reason": "user_rejected"}
    assert len(calls) == 1  # 仅首次(返回待审批结构),重执行未发生


async def test_exec_policy_audit_mode_passthrough(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """audit 模式:不发起审批,NEEDS_APPROVAL 结构原样回给 LLM(旧行为)。"""
    set_security_config(exec_policy_mode="audit")
    calls: list[dict] = []
    loop = _make_loop(_cmd_tool(calls, name="custom_cmd"), approval_enabled=True)

    async def fail_approval(tc: ToolCall) -> None:
        raise AssertionError("audit 模式不应发起审批")

    monkeypatch.setattr(loop, "_request_approval", fail_approval)
    tr = await loop._execute_single(
        ToolCall(id="c1", name="custom_cmd", args={"command": "x"})
    )
    assert tr.error is None
    assert tr.result["errorCode"] == "EXEC_POLICY_NEEDS_APPROVAL"
    assert len(calls) == 1


# =============================================================================
# mcp_server exec_policy 三档模式 + 一次性放行
# =============================================================================


def _fake_eval(action):  # noqa: ANN001, ANN202
    calls: list[str] = []

    def _eval(command, cwd=None, shell="auto"):
        calls.append(command)
        return SimpleNamespace(
            action=action,
            matched_rules=(),
            risk_notes=("测试风险",),
        )

    return _eval, calls


_NOT_ALLOWED = "definitely_not_allowed_cmd_xyz"


async def test_mcp_enforce_blocks_prompt_and_bypass_works(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """enforce:PROMPT 返回待审批结构;登记一次性放行后跳过 PROMPT 分支。"""
    set_security_config(exec_policy_mode="enforce")
    fake, calls = _fake_eval(mcp_server.RuleDecision.PROMPT)
    monkeypatch.setattr(mcp_server, "exec_policy_evaluate", fake)

    res = await mcp_server._tool_run_command({"command": _NOT_ALLOWED})
    assert res["errorCode"] == "EXEC_POLICY_NEEDS_APPROVAL"
    assert res["approval_request"]["command"] == _NOT_ALLOWED
    assert calls == [_NOT_ALLOWED]

    # 登记一次性放行 → 重执行不再评估(落到白名单等其他防线)
    mcp_server.approve_exec_command(_NOT_ALLOWED)
    res2 = await mcp_server._tool_run_command({"command": _NOT_ALLOWED})
    assert res2.get("errorCode") != "EXEC_POLICY_NEEDS_APPROVAL"
    assert calls == [_NOT_ALLOWED]  # 放行后未再评估
    assert mcp_server._consume_exec_approval(_NOT_ALLOWED) is False  # 已消费


async def test_mcp_audit_mode_allows_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    """audit:PROMPT 仅记录后放行(落到白名单等其他防线),不返回待审批结构。"""
    set_security_config(exec_policy_mode="audit")
    fake, _calls = _fake_eval(mcp_server.RuleDecision.PROMPT)
    monkeypatch.setattr(mcp_server, "exec_policy_evaluate", fake)

    res = await mcp_server._tool_run_command({"command": _NOT_ALLOWED})
    assert res.get("errorCode") != "EXEC_POLICY_NEEDS_APPROVAL"
    assert res.get("ok") is False  # 被后续白名单防线拦截(非 exec_policy)


async def test_mcp_off_mode_skips_evaluation(monkeypatch: pytest.MonkeyPatch) -> None:
    """off:完全跳过 exec_policy 评估。"""

    def _fail_eval(*args, **kwargs):  # noqa: ANN002, ANN003, ANN202
        raise AssertionError("off 模式不应评估")

    set_security_config(exec_policy_mode="off")
    monkeypatch.setattr(mcp_server, "exec_policy_evaluate", _fail_eval)

    res = await mcp_server._tool_run_command({"command": _NOT_ALLOWED})
    assert res.get("errorCode") != "EXEC_POLICY_NEEDS_APPROVAL"
