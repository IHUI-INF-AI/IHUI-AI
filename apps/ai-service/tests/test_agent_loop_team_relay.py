# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""agent_loop_v2 团队接力(Team Relay)接入单测(P3-3,2026-09-03 立)。

覆盖:
1. 无 team_context / 默认关闭时主循环行为不变(零回归对照断言):
   result.team_relay 为 None,system prompt 不被改动。
2. 显式 team_context(结构化 dict)注入:LLM 首轮即可见"团队接力摘要"段,
   result.team_relay 携带子 agent / 轮次 / 是否注入成功等元信息。
3. 纯文本 str 上下文注入 + 摘要截断标记。
4. 经 AgentBlackboard 共享载体读取并注入(弱耦合的第二传递途径)。
5. 注入失败/异常时静默降级,不炸主循环。

所有 mock 在测试函数内定义,无外部依赖,可 --noconftest 独立运行。
"""

from __future__ import annotations

import json

from app.services.agent_comm import AgentBlackboard, BlackboardEntry
from app.services.agent_loop_v2 import (
    TEAM_RELAY_BLACKBOARD_KEY,
    AgentLoopV2,
    ToolDefinition,
)


def _dummy_tool() -> ToolDefinition:
    return ToolDefinition(
        name="get_weather",
        description="查询城市天气",
        parameters={"type": "object", "properties": {"city": {"type": "string"}}},
        executor=lambda args: {"city": args["city"], "weather": "晴"},
    )


def _default_messages() -> list[dict]:
    return [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "北京天气"},
    ]


def _ok_llm(messages, tools):
    """每轮直接完成(不调用工具),便于断言首轮 system 内容。"""
    return {"content": "完成", "tool_calls": None}


# =============================================================================
# 1. 默认关闭 / 无接力上下文 → 主循环行为不变(零回归对照)
# =============================================================================


async def test_relay_disabled_default_no_side_effect():
    """默认关闭:不传团队参数,run() 行为与现状逐零差异。

    对照断言:system prompt 不为接力摘要所改动,result.team_relay 为 None。
    """
    sys_seen: list[str] = []

    async def observer_llm(messages, tools):
        sys_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "system"]
        sys_seen.append(sys_msgs[0]["content"])
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(observer_llm, [_dummy_tool()], max_iterations=3)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.team_relay is None  # 未启用 → 保持 None
    # system prompt 未被团队接力改动
    assert len(sys_seen) == 1
    assert "团队接力摘要" not in sys_seen[0]
    assert sys_seen[0].startswith("你是助手")


async def test_relay_enabled_no_context_keeps_behavior():
    """开启但无接力上下文:system 不变,主循环正常运行,接力信息标记注入未发生。"""
    sys_seen: list[str] = []

    async def observer_llm(messages, tools):
        sys_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "system"]
        sys_seen.append(sys_msgs[0]["content"])
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3, team_relay_enabled=True
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.team_relay is not None
    assert result.team_relay["enabled"] is True
    assert result.team_relay["injected"] is False
    assert "error" not in result.team_relay
    assert "团队接力摘要" not in sys_seen[0]
    assert sys_seen[0].startswith("你是助手")


# =============================================================================
# 2. 显式 team_context(结构化 dict)注入
# =============================================================================


async def test_relay_dict_context_injected_into_system():
    """开启 + 结构化 dict 上下文 → system prompt 含接力摘要,元信息完整。"""
    sys_seen: list[str] = []

    team_ctx = {
        "objective": "判断是否发布",
        "strategy": "consensus",
        "round_index": 0,
        "round_count": 2,
        "contributors": ["researcher", "reviewer"],
        "succeeded": 2,
        "failed": 0,
        "summary_context": "共识: 可以发布(researcher, reviewer)",
    }

    async def observer_llm(messages, tools):
        sys_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "system"]
        sys_seen.append(sys_msgs[0]["content"])
        return {"content": "基于团队共识推进", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=True, team_context=team_ctx,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    content = sys_seen[0]
    assert "团队接力摘要" in content
    assert "判断是否发布" in content          # objective
    assert "共识: 可以发布" in content          # 摘要正文
    assert "researcher, reviewer" in content   # contributors

    relay = result.team_relay
    assert relay is not None
    assert relay["injected"] is True
    assert relay["round_index"] == 0
    assert relay["round_count"] == 2
    assert relay["contributors"] == ["researcher", "reviewer"]
    assert "error" not in relay


async def test_relay_str_context_injected():
    """开启 + 纯文本 str 上下文 → 摘要以正文注入,无附加元信息。"""
    sys_seen: list[str] = []

    async def observer_llm(messages, tools):
        sys_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "system"]
        sys_seen.append(sys_msgs[0]["content"])
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=True, team_context="团队结论: 方案 A 可行",
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert "团队接力摘要" in sys_seen[0]
    assert "团队结论: 方案 A 可行" in sys_seen[0]
    assert result.team_relay["injected"] is True
    assert result.team_relay["round_index"] is None  # 无元信息


async def test_relay_summary_truncated_flag(monkeypatch):
    """超长摘要 → 注入时截断,team_relay 标记 summary_truncated=True。"""
    # 把上限缩到极小,制造截断
    monkeypatch.setattr(
        "app.services.agent_loop_v2.TEAM_RELAY_SUMMARY_MAX", 20
    )

    sys_seen: list[str] = []

    async def observer_llm(messages, tools):
        sys_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "system"]
        sys_seen.append(sys_msgs[0]["content"])
        return {"content": "完成", "tool_calls": None}

    long_summary = "A" * 100  # 远大于 20
    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=True, team_context=long_summary,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    relay = result.team_relay
    assert relay["injected"] is True
    assert relay["summary_truncated"] is True
    assert relay["summary_length"] == 100
    # 注入的正文确实被截断到上限长度
    assert "A" * 20 in sys_seen[0]
    assert "A" * 21 not in sys_seen[0]


# =============================================================================
# 3. 经 AgentBlackboard 共享载体读取注入(弱耦合第二途径)
# =============================================================================


async def test_relay_via_blackboard_injected():
    """团队摘要先写入黑板,主导 loop 从黑板默认 key 读取并注入。"""
    bb = AgentBlackboard()
    await bb.write(BlackboardEntry(
        id="e1", key=TEAM_RELAY_BLACKBOARD_KEY, value=json.dumps({
            "objective": "竞品调研",
            "summary_context": "竞品 A 主打低价,竞品 B 主打体验",
        }),
        writtenBy="team_orchestrator",
    ))

    sys_seen: list[str] = []

    async def observer_llm(messages, tools):
        sys_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "system"]
        sys_seen.append(sys_msgs[0]["content"])
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=True, team_blackboard=bb,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert "团队接力摘要" in sys_seen[0]
    assert "竞品调研" in sys_seen[0]
    assert "竞品 A 主打低价" in sys_seen[0]
    assert result.team_relay["injected"] is True


async def test_relay_blackboard_missing_key_degrades():
    """黑板无该 key → 无接力摘要,主循环正常运行,injected=False、不炸。"""
    bb = AgentBlackboard()  # 空黑板

    async def observer_llm(messages, tools):
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=True, team_blackboard=bb,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.team_relay["injected"] is False


# =============================================================================
# 4. 注入失败/异常 → 静默降级,不炸主循环
# =============================================================================


async def test_relay_injection_error_degrades_loop_ok():
    """黑板书读取抛异常 → 记录 error,injected=False,主循环照常完成。"""
    class _BrokenBlackboard:
        async def read(self, key, reader):  # noqa: ANN001
            raise RuntimeError("黑板不可用")

    async def observer_llm(messages, tools):
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=True, team_blackboard=_BrokenBlackboard(),
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    relay = result.team_relay
    assert relay["injected"] is False
    assert "error" in relay
    assert "黑板不可用" in relay["error"]


async def test_relay_inject_into_system_failure_degrades(monkeypatch):
    """组装/注入写 content 失败 → 记录 error,injected=False,主循环不中断。"""
    from app.services import agent_loop_v2 as mod

    # 让接力上下文块的组装抛异常(真实 _inject_team_relay_context 内部 try 守卫)
    def _boom_block(summary, meta):  # noqa: ANN001, ARG001
        raise RuntimeError("系统注入写失败")

    monkeypatch.setattr(mod.AgentLoopV2, "_build_team_relay_block", staticmethod(_boom_block))

    async def observer_llm(messages, tools):
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=True, team_context="团队结论: 就绪",
    )
    result = await loop.run(_default_messages())

    assert result.success is True  # 主循环照常完成,不被注入异常打断
    relay = result.team_relay
    assert relay["injected"] is False
    assert "error" in relay
    assert "系统注入写失败" in relay["error"]


# =============================================================================
# 5. 关闭接力时显式传 team_context 也不注入(开关完全 gating)
# =============================================================================


async def test_relay_off_ignores_team_context():
    """总开关关闭时即使传了 team_context 也不注入(不影响默认路径)。"""
    sys_seen: list[str] = []

    async def observer_llm(messages, tools):
        sys_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "system"]
        sys_seen.append(sys_msgs[0]["content"])
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        observer_llm, [_dummy_tool()], max_iterations=3,
        team_relay_enabled=False,
        team_context={"summary_context": "不应注入的摘要"},
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.team_relay is None
    assert "团队接力摘要" not in sys_seen[0]
    assert sys_seen[0].startswith("你是助手")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
