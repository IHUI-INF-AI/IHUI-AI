# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSE 事件契约 —— Python 侧单一事实源(#25)。

与 packages/shared/src/sse/contract.ts 的 SSE_EVENTS 保持集合完全一致,
由 scripts/check-agent-event-parity.mjs 断言对齐。

本模块零行为变化:仅作为事件名的事实来源与文档,不被 ai-service 运行时强依赖
(llm.py 等仍直写事件,本文件不承担序列化职责)。
"""

from dataclasses import dataclass, field

# SSE 事件名集合(单一事实源)。值即实际 wire 上的事件判别名。
# 顺序无关,frozenset 用于不可变 + 集合运算。
SSE_EVENTS: frozenset[str] = frozenset(
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
        "thinking",
        "plan_updated",
        "terminal_start",
        "terminal_end",
        "done",
        "error",
        "fallback",
        "usage",
        "compaction",
        "steer",
        "budget",
        # D34(2026-09-22,G-40/G-43/G-44/G-52):运行环境交代四帧。
        # 事件名为我方协议自定(与 plan_updated/terminal_end 同族 snake_case);
        # 竞品实证部分只有字段形状(kind 八枚举 / collapsed+全文 / attempt+maxRetries+retryInMs+httpStatus /
        # stdout+stderr+formattedOutput+exitCode+truncated)。必须与
        # packages/shared/src/sse/contract.ts 同步(两份集合由 parity 断言看护)。
        "injection_applied",
        "settings_applied",
        "retry_scheduled",
        "terminal_output",
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
    SSEEventContract("thinking", ("content",)),
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
    SSEEventContract("plan_updated", ("plan", "explanation", "timestamp", "messageId")),
    SSEEventContract("terminal_start", ("terminalId", "command", "status", "startedAt", "messageId")),
    SSEEventContract(
        "terminal_end",
        ("terminalId", "status", "endedAt", "durationMs", "output", "exitCode", "messageId"),
    ),
    # D34(2026-09-22,G-40/G-43/G-44/G-52):运行环境交代四帧。
    # 事件名为我方协议自定;字段形状取自竞品一手观察(报告 §1.1 / §16.1)。
    SSEEventContract("injection_applied", ("kind", "collapsed", "fullText")),
    SSEEventContract("settings_applied", ("model", "reasoningEffort", "personality", "prev")),
    SSEEventContract("retry_scheduled", ("attempt", "maxRetries", "retryInMs", "httpStatus")),
    SSEEventContract(
        "terminal_output",
        ("stdout", "stderr", "formattedOutput", "exitCode", "truncated"),
    ),
    SSEEventContract("done", ("usage", "model", "stub")),
    # 消息级计量帧(D7/D1 全链路,2026-09-19 立):llm.py 流结束前发出
    SSEEventContract(
        "usage",
        ("messageId", "usage", "timing", "model", "costUsd"),
    ),
    SSEEventContract("error", ("message", "errorCode")),
    # 模型降级通知(P4-2,2026-09-19 入契约):llm_gateway 主模型失败切换备用模型时
    # yield,llm.py tool loop 两处 astream 循环 + 非 tool-loop 兜底路径转发
    SSEEventContract("fallback", ("primary_model", "backup_model", "reason")),
    SSEEventContract(
        "compaction",
        ("triggered", "tokensBefore", "tokensAfter", "removedCount", "usageRatio"),
    ),
    # 中途引导注入确认(Steer,2026-09-19 立):llm.py tool loop 注入用户引导文本时发出
    SSEEventContract("steer", ("phase", "text", "timestamp", "messageId")),
    # 预算档位提醒(2026-09-19 立,网关发):流首按当日用量分档软提醒
    # (80%~95% warning / 95%~100% critical);>=100% 走 HTTP 429
    # errorCode=BUDGET_EXHAUSTED 硬中断
    SSEEventContract("budget", ("level", "percent", "usedTokens", "limitTokens", "tier", "resetAt")),
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
