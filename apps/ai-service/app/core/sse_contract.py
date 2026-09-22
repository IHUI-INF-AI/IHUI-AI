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
        # D34(2026-09-22,G-40/G-44):运行环境交代两帧。事件名为我方协议自定
        # (与 plan_updated/terminal_end 同族 snake_case);竞品实证部分只有**字段形状**
        # (kind 八枚举 / collapsed+可展开全文 / attempt+maxRetries+retryInMs+httpStatus)。
        # 必须与 packages/shared/src/sse/contract.ts 同步(两份集合由 parity 断言看护)。
        #
        # 收回记录(2026-09-22 第 36 轮自查:上两批我多加了两帧,判定为契约设计错误,不留空心帧)
        # - terminal_output:与既有 terminal_end 重复(后者已带 output/exitCode/durationMs);
        #   其唯一新增语义 formattedOutput/truncated 改为 terminal_end 的字段,不再单列事件。
        # - settings_applied:服务端没有"流中途改设置"的触发点(模型与 personality 切换在
        #   web 客户端状态与 HTTP 变更接口,降级由 fallback 帧承担);竞品侧 Codex 的
        #   thread_settings_applied 在我方 importer 里亦按"非对话项"忽略
        #   (app/services/importers/codex.py:20)。改登记为 D43/R 层:前端把用户切换
        #   写成流内留痕条并支持撤销,不再是协议事件。
        "injection_applied",
        "retry_scheduled",
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
        (
            "terminalId",
            "status",
            "endedAt",
            "durationMs",
            "output",
            "exitCode",
            "messageId",
            # D34 收回 terminal_output 后,截断语义并到本帧(第 39 轮补齐生产点):
            # truncated 仅在真被截断时为 true,totalChars 恒为原始长度。
            # formattedOutput 已删 —— 它只有竞品形状、我方无生产点也无消费方(后端不做排版,
            # stdout/stderr 的结构化在 tool-result 帧里已分开),不留空壳字段。
            "truncated",
            "totalChars",
        ),
    ),
    # D34(2026-09-22,G-40/G-43/G-44/G-52):运行环境交代四帧。
    # 事件名为我方协议自定;字段形状取自竞品一手观察(报告 §1.1 / §16.1)。
    SSEEventContract("injection_applied", ("kind", "collapsed", "fullText", "count")),
    SSEEventContract("retry_scheduled", ("attempt", "maxRetries", "retryInMs", "httpStatus")),
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
