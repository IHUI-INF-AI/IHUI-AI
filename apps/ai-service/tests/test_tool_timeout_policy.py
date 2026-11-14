# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""per-tool 超时预算的判据锁(对标 DSH dsh-tool-call-timeout-policy)。

锁三件事:
  ① 纯函数判据 —— run_command 与 handler 同形夹紧(max_timeout / env 硬上限),
     dispatch_subagent / office_document 取声明档,未登记工具回落默认档;
  ② 非法输入不放大 —— bool / 非数字 / 负数 / inf 一律回落或夹紧,绝不无界;
  ③ 接线真生效 —— 同一个 0.3s 的慢工具,叫 office_document 时不被 0.05s 的
     全局档掐断(外层等待 = 预算 + 5s),叫未登记名字时按原档超时。
"""

from __future__ import annotations

import asyncio
import math

import pytest

from app.core.tool_timeout_policy import (
    DEFAULT_TOOL_TIMEOUT_S,
    HARD_CEILING_S,
    LOOP_GUARD_GRACE_S,
    MCP_GUARD_GRACE_S,
    OFFICE_DOCUMENT_BUDGET_S,
    resolve_tool_timeout_budget,
    run_command_budget_s,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition

# =============================================================================
# 辅助
# =============================================================================


@pytest.fixture(autouse=True)
def _clean_timeout_env(monkeypatch):
    """清掉宿主机上的同名 env,避免本机部署值让判据漂移。"""
    for name in ("RUN_COMMAND_TIMEOUT_S", "SUBAGENT_TIMEOUT_S"):
        monkeypatch.delenv(name, raising=False)


def _default_messages() -> list[dict]:
    return [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "跑一下"},
    ]


def _slow_tool(name: str, delay: float = 0.3) -> ToolDefinition:
    async def executor(args):
        await asyncio.sleep(delay)
        return {"ok": True, "name": name}

    return ToolDefinition(
        name=name,
        description="慢工具",
        parameters={"type": "object", "properties": {}},
        executor=executor,
    )


def _one_call_llm(name: str):
    calls = 0

    async def mock_llm(messages, tools):
        nonlocal calls
        calls += 1
        if calls == 1:
            return {
                "content": "调用工具",
                "tool_calls": [{"id": "t1", "name": name, "args": {}}],
            }
        return {"content": "完成", "tool_calls": None}

    return mock_llm


# =============================================================================
# ① 纯函数判据
# =============================================================================


def test_unknown_tool_keeps_default_budget():
    budget = resolve_tool_timeout_budget("get_weather", {"city": "北京"})
    assert budget.source == "default"
    assert budget.tool_budget_s == DEFAULT_TOOL_TIMEOUT_S
    # 默认档不额外放宽:调用方的 tool_timeout 就是外层等待上限
    assert budget.loop_timeout_s == DEFAULT_TOOL_TIMEOUT_S


def test_custom_default_is_honored_and_capped():
    tiny = resolve_tool_timeout_budget("get_weather", None, default_s=0.1)
    assert tiny.loop_timeout_s == pytest.approx(0.1)

    huge = resolve_tool_timeout_budget("get_weather", None, default_s=10_000)
    assert huge.tool_budget_s == HARD_CEILING_S


@pytest.mark.parametrize("bad", [0, -5, float("inf"), float("nan"), "abc", None, True])
def test_invalid_default_falls_back(bad):
    budget = resolve_tool_timeout_budget("get_weather", None, default_s=bad)
    assert budget.tool_budget_s == DEFAULT_TOOL_TIMEOUT_S


def test_run_command_uses_call_timeout():
    budget = resolve_tool_timeout_budget("run_command", {"command": "ls", "timeout": 30})
    assert budget.source == "args"
    assert budget.tool_budget_s == 30.0
    assert budget.loop_timeout_s == 30.0 + LOOP_GUARD_GRACE_S
    assert budget.mcp_guard_s == 30.0 + MCP_GUARD_GRACE_S


def test_run_command_clamped_by_max_timeout():
    budget = resolve_tool_timeout_budget(
        "run_command",
        {"command": "ls", "timeout": 90, "max_timeout": 30},
    )
    assert budget.tool_budget_s == 30.0


def test_run_command_clamped_by_env_hard_timeout(monkeypatch):
    monkeypatch.setenv("RUN_COMMAND_TIMEOUT_S", "200")
    assert run_command_budget_s({"timeout": 180}) == 180.0
    assert run_command_budget_s({"timeout": 600, "max_timeout": 600}) == 200.0


def test_run_command_env_invalid_falls_back(monkeypatch):
    monkeypatch.setenv("RUN_COMMAND_TIMEOUT_S", "not-a-number")
    assert run_command_budget_s({"timeout": 600, "max_timeout": 600}) == 120.0


def test_run_command_invalid_args_do_not_explode():
    # 与 handler 的 max(1, ...) 同形:负数夹到 1s,非数字回落 60s
    assert run_command_budget_s({"timeout": -5}) == 1.0
    assert run_command_budget_s({"timeout": "abc"}) == 60.0
    assert run_command_budget_s({"timeout": True}) == 60.0
    assert run_command_budget_s(None) == 60.0


def test_subagent_declared_budget_and_env(monkeypatch):
    default = resolve_tool_timeout_budget("dispatch_subagent")
    assert default.source == "declared"
    assert default.tool_budget_s == 300.0

    monkeypatch.setenv("SUBAGENT_TIMEOUT_S", "420")
    assert resolve_tool_timeout_budget("dispatch_subagent").tool_budget_s == 420.0

    monkeypatch.setenv("SUBAGENT_TIMEOUT_S", "-1")
    assert resolve_tool_timeout_budget("dispatch_subagent").tool_budget_s == 300.0


def test_office_declared_budget():
    budget = resolve_tool_timeout_budget("office_document", {"operation": "convert"})
    assert budget.source == "declared"
    assert budget.tool_budget_s == OFFICE_DOCUMENT_BUDGET_S
    assert budget.loop_timeout_s == OFFICE_DOCUMENT_BUDGET_S + LOOP_GUARD_GRACE_S


def test_hard_ceiling_applies_everywhere(monkeypatch):
    monkeypatch.setenv("RUN_COMMAND_TIMEOUT_S", "5000")
    budget = resolve_tool_timeout_budget(
        "run_command",
        {"timeout": 5000, "max_timeout": 5000},
    )
    assert budget.tool_budget_s == HARD_CEILING_S
    assert budget.loop_timeout_s == HARD_CEILING_S + LOOP_GUARD_GRACE_S
    assert math.isfinite(budget.loop_timeout_s)


# =============================================================================
# ② 接线:外层等待真的按工具预算放宽
# =============================================================================


async def test_declared_budget_survives_tiny_global_timeout():
    """同名慢工具:office_document(声明档)→ 完成;未登记名 → 仍按全局档超时。"""
    loop = AgentLoopV2(
        _one_call_llm("office_document"),
        [_slow_tool("office_document")],
        max_iterations=3,
        tool_timeout=0.05,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    tr = result.iterations[0].tool_results[0]
    assert tr.error is None, f"声明档没有生效,被全局 0.05s 掐断: {tr.error}"
    assert tr.result == {"ok": True, "name": "office_document"}


async def test_unregistered_tool_still_times_out_at_global_budget():
    loop = AgentLoopV2(
        _one_call_llm("get_weather"),
        [_slow_tool("get_weather")],
        max_iterations=3,
        tool_timeout=0.05,
    )
    result = await loop.run(_default_messages())

    tr = result.iterations[0].tool_results[0]
    assert tr.error is not None
    assert "超时" in tr.error
    # 文案报的是工具预算(默认档 = 全局档),不是外层 grace
    assert "0.05" in tr.error
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
