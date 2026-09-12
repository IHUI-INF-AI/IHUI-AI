# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""1-8 上下文超限压缩测试(2026-09-07 立)。

覆盖:默认关闭逐零差异 / 超限触发压缩继续执行 / system 保留 / 压缩失败降级 /
幂等防抖(压缩后回落不重复触发) / 事件写入 AgentLoopResult.compaction_events。
"""


from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition


def _weather_tool() -> ToolDefinition:
    async def _executor(args):
        return {"city": args.get("city", ""), "weather": "晴", "temp": 25}

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


def _big_history_messages() -> list[dict]:
    """长历史(触发压缩用):system + 10 对长 user/assistant。

    设计(摘要器每条仅保留 120-200 字符):
    - 每条消息 ≈ 800 token,10 对共 ≈ 16100 token,远超触发阈值(8000*0.85=6800)
    - keep_recent=2(测试 monkeypatch)时尾部仅 2 条 ≈ 1600 token
    - head 摘要 ≈ 18 条 × 130 字符 ≈ 2300 token → 压缩后 ≈ 3900 < 6800,
      产生真实压缩收益(不会被"防循环保护"判为 incompressible)。
    """
    filler = "历史上下文内容," * 100  # 每条约 800 字符 ≈ 800 token
    msgs: list[dict] = [{"role": "system", "content": "你是天气助手,只回答天气。"}]
    for i in range(10):
        msgs.append({"role": "user", "content": f"第{i}轮提问 {filler}"})
        msgs.append({"role": "assistant", "content": f"第{i}轮回答 {filler}"})
    msgs.append({"role": "user", "content": "北京天气"})
    return msgs


async def test_compaction_disabled_by_default_zero_diff():
    """默认关闭(未传参+env 未设):大上下文也不触发压缩,事件为空,行为与现状逐零差异。"""
    seen_sizes: list[int] = []

    async def mock_llm(messages, tools):
        seen_sizes.append(len(messages))
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=3)
    result = await loop.run(_big_history_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.compaction_events == []
    # 未压缩:LLM 看到的消息数 = 原样(13 条)
    assert seen_sizes[0] == len(_big_history_messages())


async def test_compaction_triggers_and_loop_continues(monkeypatch):
    """启用 + 超限 → 压缩触发,system 保留,循环继续到完成,事件写入 result。"""
    import app.services.agent_loop_v2 as mod

    seen: list[list[dict]] = []

    async def mock_llm(messages, tools):
        seen.append([dict(m) for m in messages])
        return {"content": "北京晴", "tool_calls": None}

    monkeypatch.setattr(mod, "DEFAULT_COMPACTION_KEEP_RECENT", 2)
    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=3,
        compaction_enabled=True,
        compaction_context_limit=8000,
    )
    result = await loop.run(_big_history_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert len(result.compaction_events) >= 1
    assert result.compaction_events[0]["trigger"] == "deterministic"
    assert result.compaction_events[0]["removed_count"] > 0
    # LLM 收到的消息被压缩过:数量显著少于原 13 条
    assert len(seen[0]) < len(_big_history_messages())
    # system 消息保留(循环会在其后追加 meta_learner 元知识等注入,故用前缀断言)
    assert seen[0][0]["role"] == "system"
    assert seen[0][0]["content"].startswith("你是天气助手,只回答天气。")
    # 摘要消息存在(压缩产物),且为 user 角色
    roles = [m["role"] for m in seen[0]]
    assert "user" in roles


async def test_compaction_failure_degrades_to_original(monkeypatch):
    """压缩器抛异常 → 原样返回消息,循环不受影响(降级路径)。"""
    async def mock_llm(messages, tools):
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=3,
        compaction_enabled=True,
        compaction_context_limit=8000,
    )

    import app.services.agent_loop_v2 as mod

    def _boom(*args, **kwargs):
        raise RuntimeError("compressor down")

    monkeypatch.setattr(
        mod, "DEFAULT_COMPACTION_TRIGGER_RATIO", 0.85
    )  # 保持不变,显式表达依赖
    # 让方法内部 import 的 compress_messages_if_needed 抛错:patch 源模块
    import app.core.context_compaction as cc

    monkeypatch.setattr(cc, "compress_messages_if_needed", _boom)

    result = await loop.run(_big_history_messages())
    assert result.success is True
    assert result.compaction_events == []


async def test_compaction_idempotent_no_retrigger(monkeypatch):
    """压缩后占用回落到阈值下 → 后续迭代不重复压缩(事件数不随迭代线性增长)。"""
    import app.services.agent_loop_v2 as mod

    seen: list[list[dict]] = []

    async def mock_llm(messages, tools):
        seen.append(list(messages))
        if len(seen) == 1:
            return {
                "content": "查一下",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京晴", "tool_calls": None}

    monkeypatch.setattr(mod, "DEFAULT_COMPACTION_KEEP_RECENT", 2)
    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=5,
        compaction_enabled=True,
        compaction_context_limit=8000,
    )
    result = await loop.run(_big_history_messages())

    assert result.success is True
    # 至少压缩 1 次;压缩后回落,不应每轮都新增事件(2 轮循环 ≤ 1 次)
    assert 1 <= len(result.compaction_events) <= 1


async def test_compaction_off_small_context_noop():
    """启用但占用远低于阈值 → 不压缩。"""
    seen: list[list[dict]] = []

    async def mock_llm(messages, tools):
        seen.append(list(messages))
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=3,
        compaction_enabled=True,
        compaction_context_limit=1_000_000,
    )
    result = await loop.run(
        [
            {"role": "system", "content": "你是助手"},
            {"role": "user", "content": "hi"},
        ]
    )
    assert result.success is True
    assert result.compaction_events == []
    assert len(seen[0]) == 2


# =============================================================================
# 1-3 压缩灰度机制(2026-09-12 立):AGENT_COMPACTION_MODE=off/ratio/full +
# AGENT_COMPACTION_CANARY_PERCENT 按 session_id 稳定哈希。
# 以下测试均不传 compaction_enabled(构造参数显式传参 = 与现状逐零差异,
# 走灰度决策路径);显式传 compaction_context_limit 便于构造超限场景。
# =============================================================================


async def test_canary_mode_off_disables_compaction(monkeypatch):
    """MODE=off 优先级最高:即使 legacy env enabled 也不压缩(一键回滚)。"""
    seen_sizes: list[int] = []

    async def mock_llm(messages, tools):
        seen_sizes.append(len(messages))
        return {"content": "完成", "tool_calls": None}

    monkeypatch.setenv("AGENT_COMPACTION_ENABLED", "true")
    monkeypatch.setenv("AGENT_COMPACTION_MODE", "off")
    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=3,
        session_id="canary-off-session",
        compaction_context_limit=8000,
    )
    result = await loop.run(_big_history_messages())

    assert result.success is True
    assert result.compaction_events == []
    # off 模式:LLM 原样看到全部 13 条消息
    assert seen_sizes[0] == len(_big_history_messages())


async def test_canary_mode_ratio_triggers_deterministic(monkeypatch):
    """MODE=ratio(默认 100% 灰度)→ 确定性压缩触发,指标进入报告。"""
    import app.services.agent_loop_v2 as mod
    from app.services.compaction_metrics import (
        get_compaction_metrics_report,
        reset_compaction_metrics,
    )

    reset_compaction_metrics()
    monkeypatch.setenv("AGENT_COMPACTION_MODE", "ratio")
    monkeypatch.setattr(mod, "DEFAULT_COMPACTION_KEEP_RECENT", 2)

    seen: list[list[dict]] = []

    async def mock_llm(messages, tools):
        seen.append(list(messages))
        return {"content": "北京晴", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=3,
        session_id="canary-ratio-session",
        compaction_context_limit=8000,
    )
    result = await loop.run(_big_history_messages())

    assert result.success is True
    assert len(result.compaction_events) == 1
    assert result.compaction_events[0]["trigger"] == "deterministic"
    assert len(seen[0]) < len(_big_history_messages())
    # 1-3 指标:压缩事件 + run 成功结果进入报告
    report = get_compaction_metrics_report()
    assert report["events_total"] >= 1
    # 确定性路径:沿用压缩器机制标签(ratio)
    assert report["by_trigger"].get("ratio", 0) >= 1
    assert report["runs"]["total"] == 1
    assert report["runs"]["success_rate"] == 1.0


async def test_canary_mode_full_uses_llm_path(monkeypatch):
    """MODE=full → 走 compact_with_llm 语义压缩路径,trigger 记为 llm。"""
    import app.services.compact_with_llm as cwl
    from app.services.compaction_metrics import (
        get_compaction_metrics_report,
        reset_compaction_metrics,
    )

    reset_compaction_metrics()
    monkeypatch.setenv("AGENT_COMPACTION_MODE", "full")

    llm_calls: list[int] = []

    async def mock_llm(messages, tools):
        llm_calls.append(len(messages))
        return {"content": "北京晴", "tool_calls": None}

    async def fake_compact_with_llm(
        messages, context_limit, llm_complete_fn, **kwargs
    ):
        # 语义压缩成功:返回压缩后消息 + 带 llm_summary 的 info
        compressed = [
            messages[0],
            {"role": "user", "content": "[LLM 摘要] 此前多轮天气问答已压缩。"},
            messages[-1],
        ]
        info = {
            "compressed": True,
            "original_tokens": 16100,
            "compressed_tokens": 4000,
            "removed_count": 10,
            "llm_summary": "此前多轮天气问答已压缩。",
        }
        return compressed, info

    monkeypatch.setattr(cwl, "compact_with_llm", fake_compact_with_llm)

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=3,
        session_id="canary-full-session",
        compaction_context_limit=8000,
    )
    result = await loop.run(_big_history_messages())

    assert result.success is True
    assert len(result.compaction_events) == 1
    assert result.compaction_events[0]["trigger"] == "llm"
    # 压缩后的消息(3 条 < 13 条)进入 LLM
    assert llm_calls[0] < len(_big_history_messages())
    # 1-3 指标:llm trigger 事件进入报告
    report = get_compaction_metrics_report()
    assert report["by_trigger"].get("llm", 0) == 1


async def test_canary_zero_percent_falls_back_to_legacy(monkeypatch):
    """MODE=ratio + PERCENT=0(未命中灰度)→ 回退 legacy(默认关闭),不压缩。"""
    seen_sizes: list[int] = []

    async def mock_llm(messages, tools):
        seen_sizes.append(len(messages))
        return {"content": "完成", "tool_calls": None}

    monkeypatch.setenv("AGENT_COMPACTION_MODE", "ratio")
    monkeypatch.setenv("AGENT_COMPACTION_CANARY_PERCENT", "0")
    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=3,
        session_id="canary-zero-percent-session",
        compaction_context_limit=8000,
    )
    result = await loop.run(_big_history_messages())

    assert result.success is True
    assert result.compaction_events == []
    # legacy(env 未设 AGENT_COMPACTION_ENABLED,默认 off)→ 原样消息
    assert seen_sizes[0] == len(_big_history_messages())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
