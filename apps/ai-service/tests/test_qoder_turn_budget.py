# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Qoder 能力对齐 · 轮次预算提示(agent 循环)。

钉住的行为:

1. **默认预算不变**:未设 ``IHUI_AGENT_MAX_ITERATIONS`` 时,
   ``AgentLoopV2.max_iterations`` 与传入档逐字一致(不破 check-doom-loop-parity 的基准登记);
2. env 显式放宽才生效,越界夹到 [1, 300],非法值忽略并保留原档;
3. 进入收尾窗口(最后 1/3 且 ≤3 轮)时向模型注入**一次** budget reminder
   ——只注入一次,不在每轮重发;
4. 轮次耗尽的返回值保持既有契约(success=False / final_response="" /
   stop_reason="max_iterations"),但 error 里补上"已完成多少工具调用 + 怎么续",
   且仍以 "达到最大迭代数 N" 开头(既有断言不破)。
"""

from __future__ import annotations

import pytest

from app.core.turn_budget import (
    AGENT_MAX_ITERATIONS_ENV,
    BUDGET_CEILING,
    BUDGET_FLOOR,
    build_budget_exhausted_error,
    build_budget_nudge,
    resolve_turn_budget,
    should_nudge,
    wrapup_window,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition


def _weather_tool() -> ToolDefinition:
    async def _executor(args):
        return {"city": args["city"], "weather": "晴"}

    return ToolDefinition(
        name="get_weather",
        description="查询城市天气",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
        executor=_executor,
    )


def _messages() -> list[dict]:
    return [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "查天气"},
    ]


def _has_budget_tag(message: dict) -> bool:
    content = message.get("content")
    if isinstance(content, str):
        return "<budget_reminder>" in content
    if isinstance(content, list):
        return any(
            isinstance(block, dict)
            and "<budget_reminder>" in str(block.get("text", ""))
            for block in content
        )
    return False


def test_resolve_keeps_requested_when_env_absent(monkeypatch):
    monkeypatch.delenv(AGENT_MAX_ITERATIONS_ENV, raising=False)
    assert resolve_turn_budget(10) == 10
    assert resolve_turn_budget(25) == 25


def test_resolve_honors_env_with_clamp(monkeypatch):
    monkeypatch.setenv(AGENT_MAX_ITERATIONS_ENV, "40")
    assert resolve_turn_budget(10) == 40

    monkeypatch.setenv(AGENT_MAX_ITERATIONS_ENV, "0")
    assert resolve_turn_budget(10) == BUDGET_FLOOR

    monkeypatch.setenv(AGENT_MAX_ITERATIONS_ENV, "9999")
    assert resolve_turn_budget(10) == BUDGET_CEILING


def test_resolve_ignores_invalid_env(monkeypatch):
    monkeypatch.setenv(AGENT_MAX_ITERATIONS_ENV, "forty")
    assert resolve_turn_budget(10) == 10


def test_wrapup_window_is_one_third_capped_at_three():
    assert wrapup_window(10) == 3
    assert wrapup_window(30) == 3
    assert wrapup_window(4) == 1
    assert wrapup_window(1) == 1


def test_should_nudge_only_inside_window():
    assert should_nudge(7, 10) is False  # 剩 4 轮
    assert should_nudge(8, 10) is True   # 剩 3 轮
    assert should_nudge(10, 10) is True


def test_budget_nudge_shape_and_text():
    frag = build_budget_nudge(8, 10)
    assert frag["role"] == "developer"
    text = frag["content"][0]["text"]
    assert "<budget_reminder>" in text and "</budget_reminder>" in text
    assert "剩余 3 轮" in text


def test_exhausted_error_keeps_legacy_prefix_and_adds_next_step():
    message = build_budget_exhausted_error(10, 7)
    assert message.startswith("达到最大迭代数 10")  # 既有断言依赖这个前缀
    assert "已完成 7 次工具调用" in message
    assert "继续" in message


@pytest.mark.asyncio
async def test_loop_injects_nudge_once_and_keeps_exhaustion_contract(monkeypatch):
    monkeypatch.delenv(AGENT_MAX_ITERATIONS_ENV, raising=False)
    seen: list[list[dict]] = []

    async def mock_llm(messages, tools):
        seen.append([dict(m) for m in messages])
        return {
            "content": "",
            # 每轮换参数:避免触发 doom-loop 的"连续 3 轮相同模式"提前终止,
            # 本用例要验的是预算耗尽(不是卡死检测)。
            "tool_calls": [
                {
                    "id": f"c{len(seen)}",
                    "name": "get_weather",
                    "args": {"city": f"城市{len(seen)}"},
                }
            ],
        }

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=4)
    assert loop.max_iterations == 4
    result = await loop.run(_messages())

    # 既有契约:耗尽仍是"未完成",不把空回复伪装成成功。
    assert result.success is False
    assert result.final_response == ""
    assert result.stop_reason == "max_iterations"
    assert "达到最大迭代数 4" in result.error
    assert "已完成 4 次工具调用" in result.error

    # 收尾窗口(4 轮 ⇒ 最后 1 轮)才注入,且整个回合只注入一次。
    assert not any(_has_budget_tag(m) for m in seen[0])
    assert not any(_has_budget_tag(m) for m in seen[2])
    assert _has_budget_tag(seen[3][-1])
    total = sum(
        1 for batch in seen for message in batch if _has_budget_tag(message)
    )
    assert total == 1


@pytest.mark.asyncio
async def test_no_nudge_when_turn_finishes_before_window(monkeypatch):
    monkeypatch.delenv(AGENT_MAX_ITERATIONS_ENV, raising=False)
    seen: list[list[dict]] = []

    async def mock_llm(messages, tools):
        seen.append([dict(m) for m in messages])
        if len(seen) == 1:
            return {
                "content": "",
                "tool_calls": [
                    {"id": "c1", "name": "get_weather", "args": {"city": "上海"}}
                ],
            }
        return {"content": "上海晴", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=10)
    result = await loop.run(_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert not any(_has_budget_tag(m) for batch in seen for m in batch)


@pytest.mark.asyncio
async def test_env_override_widens_loop_budget(monkeypatch):
    monkeypatch.setenv(AGENT_MAX_ITERATIONS_ENV, "40")
    loop = AgentLoopV2(lambda messages, tools: None, [_weather_tool()], max_iterations=10)
    assert loop.max_iterations == 40
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
