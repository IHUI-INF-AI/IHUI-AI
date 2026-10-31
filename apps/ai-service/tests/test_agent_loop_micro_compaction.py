# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""micro 前置档接入执行器(_maybe_compact_context)的副作用回归(2026-10-31,q1 / S2§10-10)。

对齐 CLI 同族 apps/cli/src/compaction-v2.ts:437 reclaimStaleToolResults
(经 agent.ts:1462 decideCompaction 装车):整窗摘要压缩之前先跑零 LLM、零摘要的
"旧工具结果回收"。本组用例证明接入后:
1. 到跨端触发线 RECLAIM_WINDOW_RATIO_TRIGGER 就产生一条 trigger='micro' 事件;
2. 回收确实减少了注入模型的 token,且回收掉的工具结果正文不再出现在发往模型的 messages 里
   (副作用断言);最近 N 轮工具结果与消息条数、tool_calls 配对完整性一律保留;
3. 纯确定性:同输入两次调用逐字节相同(跑两次同结果);
4. 占用低于触发线时严格 no-op(与接入前逐零差异)。

测试隔离:全程 mock LLM,不打真网,不连 PG 8810 / Redis 8811。数字一律 import 单源
(app.core.tunables),禁止在测试里再抄一份阈值。
"""

from __future__ import annotations

import json
import math

from app.core.context_compaction import MICRO_COMPACT_PLACEHOLDER, estimate_messages_tokens
from app.core.tunables import (
    RECLAIM_KEEP_RECENT_ROUNDS,
    RECLAIM_MIN_RESULT_TOKENS,
    RECLAIM_WINDOW_RATIO_TRIGGER,
)
from app.services.agent_loop_v2 import (
    DEFAULT_COMPACTION_TRIGGER_RATIO,
    AgentLoopV2,
    ToolDefinition,
)

# 可复现地让单条工具结果"达标"(≥ RECLAIM_MIN_RESULT_TOKENS)且整批节省过
# RECLAIM_MIN_SAVED_TOKENS,同时不含被断言的标记词,标记词单独放最前便于
# presence/absence 断言。填充取 ASCII,tiktoken 计数稳定。
_FILLER = "payload token stream " * 200


def _weather_tool() -> ToolDefinition:
    async def _executor(args):  # pragma: no cover - 测试内不触发真实执行
        return {"city": args.get("city", ""), "weather": "晴"}

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


def _round_count() -> int:
    """可回收轮数须 > 0 ⇒ 至少 RECLAIM_KEEP_RECENT_ROUNDS + 3 轮。"""
    return RECLAIM_KEEP_RECENT_ROUNDS + 3


def _history_with_tool_results() -> list[dict]:
    """system + N 轮(user / assistant+tool_call / tool 长结果),每轮 tool 正文带唯一 MARK。

    tool 结果长度足以过 RECLAIM_MIN_RESULT_TOKENS 单条门槛,且总节省过
    RECLAIM_MIN_SAVED_TOKENS;最近 RECLAIM_KEEP_RECENT_ROUNDS 轮受保护不回收。
    """
    msgs: list[dict] = [{"role": "system", "content": "你是天气助手,只回答天气。"}]
    for i in range(_round_count()):
        msgs.append({"role": "user", "content": f"第{i}轮提问"})
        msgs.append(
            {
                "role": "assistant",
                "content": "查一下天气",
                "tool_calls": [
                    {
                        "id": f"tc{i}",
                        "type": "function",
                        "function": {"name": "get_weather", "arguments": '{"city": "北京"}'},
                    }
                ],
            }
        )
        msgs.append(
            {
                "role": "tool",
                "tool_call_id": f"tc{i}",
                "content": f"MARK{i} {_FILLER}",
            }
        )
    msgs.append({"role": "user", "content": "北京天气"})
    return msgs


def _limit_in_reclaim_band(msgs: list[dict]) -> int:
    """取 context_limit 使占用率落在 (RECLAIM_WINDOW_RATIO_TRIGGER, DEFAULT_COMPACTION_TRIGGER_RATIO) 之间:

    micro 触发线之上、摘要触发线之下 ⇒ 隔离出"只有 micro 档生效"的场景,
    避免与整窗摘要混淆。band_ratio 由两个单源常量中点派生,不新写阈值字面量。
    """
    band_ratio = (RECLAIM_WINDOW_RATIO_TRIGGER + DEFAULT_COMPACTION_TRIGGER_RATIO) / 2
    tokens = estimate_messages_tokens(msgs)
    return max(1, math.ceil(tokens / band_ratio))


async def test_micro_compact_context_wiring_reclaims_and_preserves_integrity():
    """直接驱动 _maybe_compact_context:micro 档回收旧工具结果,条数/配对/最近轮完整保留。"""
    msgs = _history_with_tool_results()
    # 前置:确认夹具单条工具结果确实过门槛(否则用例空转、无回收可断言)。
    # 索引 3 = 首轮 tool 消息(0=system, 1=user, 2=assistant+tool_call, 3=tool)。
    assert estimate_messages_tokens([msgs[3]]) >= RECLAIM_MIN_RESULT_TOKENS

    async def _noop_llm(messages, tools):  # pragma: no cover - 不走 run
        return {"content": "done", "tool_calls": None}

    limit = _limit_in_reclaim_band(msgs)
    loop = AgentLoopV2(
        _noop_llm,
        [_weather_tool()],
        max_iterations=1,
        compaction_enabled=True,
        compaction_context_limit=limit,
    )

    original_tokens = estimate_messages_tokens(msgs)
    out = await loop._maybe_compact_context(msgs)

    # ① 恰好一条 micro 事件(占用在摘要线下,整窗摘要 no-op)
    assert len(loop._compaction_events) == 1
    event = loop._compaction_events[0]
    assert event["trigger"] == "micro"
    assert event["tools_removed"] == _round_count() - RECLAIM_KEEP_RECENT_ROUNDS
    assert event["compressed_tokens"] < event["original_tokens"]

    # ② 回收生效:注入的 token 严格变小
    assert estimate_messages_tokens(out) < original_tokens

    # ③ 完整性:条数不变(micro 只改写正文、绝不删消息)、tool_calls 配对不被拆散
    assert len(out) == len(msgs)
    blob = json.dumps(out, ensure_ascii=False)
    assert MICRO_COMPACT_PLACEHOLDER in blob
    for idx, m in enumerate(out):
        if m.get("role") == "assistant" and m.get("tool_calls"):
            tcid = m["tool_calls"][0]["id"]
            nxt = out[idx + 1]
            assert nxt["role"] == "tool" and nxt["tool_call_id"] == tcid

    # ④ 回收掉的旧工具正文不再出现;最近 N 轮(未回收)正文原样保留
    reclaimable_last_idx = _round_count() - RECLAIM_KEEP_RECENT_ROUNDS
    for i in range(reclaimable_last_idx):
        assert f"MARK{i}" not in blob
    for i in range(reclaimable_last_idx, _round_count()):
        assert f"MARK{i}" in blob


async def test_micro_compact_context_wiring_is_deterministic():
    """同输入两次调用产出逐字节相同(纯确定性、零 LLM、零时钟)。"""
    async def _noop_llm(messages, tools):  # pragma: no cover
        return {"content": "done", "tool_calls": None}

    msgs = _history_with_tool_results()
    limit = _limit_in_reclaim_band(msgs)

    outputs: list[str] = []
    for _ in range(2):
        loop = AgentLoopV2(
            _noop_llm,
            [_weather_tool()],
            max_iterations=1,
            compaction_enabled=True,
            compaction_context_limit=limit,
        )
        out = await loop._maybe_compact_context(msgs)
        outputs.append(json.dumps(out, ensure_ascii=False))

    assert outputs[0] == outputs[1]


async def test_micro_compact_context_wiring_seen_by_model():
    """经完整 run():模型实际收到的 messages 已含占位符、不含被回收的旧正文(副作用断言)。"""
    seen: list[list[dict]] = []

    async def mock_llm(messages, tools):
        seen.append([dict(m) for m in messages])
        return {"content": "北京晴", "tool_calls": None}

    msgs = _history_with_tool_results()
    limit = _limit_in_reclaim_band(msgs)
    original_tokens = estimate_messages_tokens(msgs)

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=1,
        compaction_enabled=True,
        compaction_context_limit=limit,
    )
    result = await loop.run(msgs)

    assert result.success is True
    assert result.compaction_events[0]["trigger"] == "micro"
    blob = json.dumps(seen[0], ensure_ascii=False)
    # 回收掉的旧工具正文不再发往模型
    assert "MARK0" not in blob
    assert MICRO_COMPACT_PLACEHOLDER in blob
    # 最近轮正文仍在(未被过度回收)+ 注入模型的 token 确实下降
    assert f"MARK{_round_count() - 1}" in blob
    assert estimate_messages_tokens(seen[0]) < original_tokens


async def test_micro_compact_context_wiring_noop_below_trigger():
    """占用低于 RECLAIM_WINDOW_RATIO_TRIGGER:micro 档严格 no-op(与接入前逐零差异)。"""
    async def _noop_llm(messages, tools):  # pragma: no cover
        return {"content": "done", "tool_calls": None}

    msgs = _history_with_tool_results()
    # limit 放到占用率远低于触发线(0.1 < 0.6)
    tokens = estimate_messages_tokens(msgs)
    limit = math.ceil(tokens / (RECLAIM_WINDOW_RATIO_TRIGGER * 0.2))

    loop = AgentLoopV2(
        _noop_llm,
        [_weather_tool()],
        max_iterations=1,
        compaction_enabled=True,
        compaction_context_limit=limit,
    )
    out = await loop._maybe_compact_context(msgs)

    assert loop._compaction_events == []
    assert out == msgs
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
