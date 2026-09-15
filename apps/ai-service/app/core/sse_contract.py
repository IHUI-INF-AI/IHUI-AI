# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSE 事件契约 —— Python 侧单一事实源(#25)。

与 packages/shared/src/sse/contract.ts 的 SSE_EVENTS 保持集合完全一致,
由 scripts/check-agent-event-parity.mjs 断言对齐。

本模块零行为变化:仅作为事件名的事实来源与文档,不被 ai-service 运行时强依赖
(llm.py 等仍直写事件,本文件不承担序列化职责)。
"""

from dataclasses import dataclass, field
from typing import FrozenSet


# SSE 事件名集合(单一事实源)。值即实际 wire 上的事件判别名。
# 顺序无关,frozenset 用于不可变 + 集合运算。
SSE_EVENTS: FrozenSet[str] = frozenset(
    {
        "chunk",
        "token",
        "reasoning",
        "tool-call-start",
        "tool-result",
        "tool-delegate",
        "tool-summary",
        "citations",
        "question",
        "subagent_spawn",
        "subagent_progress",
        "subagent_end",
        "plan-step",
        "thinking_delta",
        "done",
        "error",
        "compaction",
        "repair",
        "resumed",
    }
)


@dataclass(frozen=True)
class SSEEventContract:
    """SSE 事件契约清单(文档性,非运行时校验)。

    仅描述每个事件的判别名与待收紧 payload 字段,供跨端对齐参考。
    不要求 Pydantic 化,保持零行为变化。
    """

    name: str
    # 待收紧 payload 字段(当前多为宽松 dict,后续逐步结构化)
    payload_fields: tuple[str, ...] = field(default_factory=tuple)
    # 是否为 agent 绑定流上会注入 agentId 顶层字段的事件
    injects_agent_id: bool = True


# 事件清单(注释性文档;payload_fields 为待收紧字段提示)
SSE_EVENT_CONTRACTS: tuple[SSEEventContract, ...] = (
    SSEEventContract("chunk", ("content",)),
    SSEEventContract("token", ("content",)),
    SSEEventContract("reasoning", ("content",)),
    SSEEventContract("thinking_delta", ("content",)),
    SSEEventContract("tool-call-start", ("toolCallId", "name", "args")),
    SSEEventContract("tool-result", ("toolCallId", "result")),
    SSEEventContract("tool-delegate", ("payload",)),
    SSEEventContract("tool-summary", ("summary",)),
    SSEEventContract("citations", ("citations",)),
    SSEEventContract("question", ("question",)),
    SSEEventContract("subagent_spawn", ("payload",)),
    SSEEventContract("subagent_progress", ("payload",)),
    SSEEventContract("subagent_end", ("payload",)),
    SSEEventContract("plan-step", ("payload",)),
    SSEEventContract("done", ("usage", "model", "stub")),
    SSEEventContract("error", ("message", "errorCode")),
    SSEEventContract(
        "compaction",
        ("triggered", "tokensBefore", "tokensAfter", "removedCount", "usageRatio"),
    ),
    SSEEventContract("repair", ("removed",)),
    SSEEventContract("resumed", ("payload",)),
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
