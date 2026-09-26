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
        # V3 #48(2026-09-26):补登两个一直在生产、契约却漏登的漂移事件。
        # terminal_delta 由 agent_events.SSE_TERMINAL_DELTA 定义、mcp_server 的
        # _emit_terminal_delta 以 {"type": "terminal_delta"} dict 形态产出、llm.py
        # 终端工具直投;此前 parity 门只扫 _sse(...) / event: 形态,dict 形态漏网
        # 造成「生产 ⊆ 契约」断言假绿。
        "terminal_delta",
        # start 由 agent_events.SSE_START 定义、agents.py:1011 的
        # {"type": SSE_START, "task_id", "session_id", "resume_from"} 产出。
        "start",
        # V3 #58(2026-09-26):主聊天流工具审批门(llm.py 工具执行前拦截)。
        # 需要审批时发本帧(payload 与 agent 任务流的 tool-approval 同形:
        # type/approval_id/tool_name/tool_call_id/args_preview/danger_level/session_id),
        # 前端 ToolApprovalDialog 弹窗,决策经
        # POST /llm/complete/stream/{session_id}/approval-response 回传;
        # deny/超时产出 errorCode=TOOL_APPROVAL_DENIED / TOOL_APPROVAL_TIMEOUT 的失败
        # tool-result,工具不执行。bypassPermissions 档不拦截。
        "tool-approval",
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
        #
        # V3 #48(2026-09-26)再收回一帧:
        # - token:全仓零生产点(ai-service 的 llm.py / agent_events.py、apps/api 的
        #   ai-chat-stream / agent-runtime / agent-langgraph 全部查过)。此前契约里它与
        #   chunk 双写同一语义("增量 token 的两种命名"),真正在用的是 chunk。前端
        #   use-agent-stream.ts 的 'token' 消费分支为死分支,同批拆除。
        "injection_applied",
        "retry_scheduled",
    }
)

# V3 #48(2026-09-26):Anthropic Messages API 兼容面事件,单列不入对话流契约。
# 它们由 llm.py 的 Anthropic 兼容端点产出(agent_events.py:88-93 的 SSE_MESSAGE_START
# 等六个常量是单一事实源),wire 形态与 Anthropic 官方一致;语义上不是对话流 UI 事件,
# 混进 SSE_EVENTS 会让前端监听对账与文档都失真。parity 门对两份集合分别做双端一致断言。
SSE_COMPAT_EVENTS: frozenset[str] = frozenset(
    {
        "message_start",
        "content_block_start",
        "content_block_delta",
        "content_block_stop",
        "message_delta",
        "message_stop",
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
    # V3 #48(2026-09-26)补登:终端命令逐行增量(mcp_server._emit_terminal_delta 实时产出)
    SSEEventContract("terminal_delta", ("terminalId", "stream", "text")),
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
    # V3 #48(2026-09-26)补登:agent 流执行开始(agents.py,断点续跑时带 resume_from)
    SSEEventContract("start", ("task_id", "session_id", "resume_from")),
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
        ("triggered", "tokensBefore", "tokensAfter", "removedCount", "usageRatio", "trigger"),
    ),
    # 中途引导注入确认(Steer,2026-09-19 立):llm.py tool loop 注入用户引导文本时发出
    SSEEventContract("steer", ("phase", "text", "timestamp", "messageId")),
    # V3 #58(2026-09-26):主聊天流工具审批帧(与 agent 任务流 tool-approval 同形,
    # 前端同一弹窗消费;approval_id 为流内唯一标识,decision 回传走流级端点)
    SSEEventContract(
        "tool-approval",
        ("approval_id", "tool_name", "tool_call_id", "args_preview", "danger_level", "session_id"),
    ),
    # 预算档位提醒(2026-09-19 立,网关发):流首按当日用量分档软提醒
    # (80%~95% warning / 95%~100% critical);>=100% 走 HTTP 429
    # errorCode=BUDGET_EXHAUSTED 硬中断。
    # V3 #48(2026-09-26)补注生产点精确位置:apps/api/src/routes/ai-chat-stream.ts
    # 的 checkTokenBudget 三态分流(block→429 / warning,critical→extraFirstEvents
    # 流首命名帧,两处 :776 与 :1039)。2026-09-26 对标轮曾误判本帧"零生产点"——
    # 只查了 ai-service 的 llm_gateway 没查 apps/api 网关层,教训:**跨端事件先查网关**。
    SSEEventContract("budget", ("level", "percent", "usedTokens", "limitTokens", "tier", "resetAt")),
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
