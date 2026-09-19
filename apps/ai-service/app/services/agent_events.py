# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSE 事件契约单一事实源(single source of truth,2026-09-17 立)。

覆盖四条 SSE 通道的事件命名/映射/订阅集合:
1. llm.py    POST /llm/complete/stream(原生 token 流 + 工具链 + 子agent)
2. llm.py    /llm/messages/stream(Anthropic Messages API 兼容层)
3. agents.py POST /agents/execute/stream(AgentLoopV2 真流式,v2 分支)
4. agents.py GET /agents/tasks/stream + GET /agents/{agent_id}/stream(hook 订阅视图)
Node 网关层(apps/api src/routes/ai-chat-stream.ts)透传 ai-service 事件,
以本模块为 Python 端契约基准(前端监听事件名见各常量注释)。

两类事件族:
- SSE_*  :SSE `event:` 字段值(与 data JSON 的 type 字段一致),llm.py 直发;
- HOOK_* :hook_engine 事件总线白名单元组(hook_engine.HOOK_EVENTS 镜像),
  经 HOOK_EVENT_TO_SSE 映射为前端 use-agent-runtime 期望的命名。
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# LLM 主线事件(/llm/complete/stream;前端 apps/web use-chat/MessageItem 消费)
# ---------------------------------------------------------------------------

SSE_CHUNK = "chunk"          # 逐 token 内容 {"content": "..."}
SSE_DONE = "done"            # 完成 {"model", "usage", "stub", "metadata"}
SSE_ERROR = "error"          # 错误 {"message", "errorCode"}(前端 attachErrorMeta)
SSE_FALLBACK = "fallback"    # P4-2 模型降级通知(前端 client.ts onFallback 消费):
                             # {"type":"fallback","primary_model":"失败主模型",
                             #  "backup_model":"切换到的备用模型","reason":"降级原因"}
                             # llm_gateway 主模型失败切换备用模型时 yield;
                             # llm.py 各 astream 事件循环转发(tool loop 两处 +
                             # 非 tool-loop 兜底 yield _sse(event_type, event))
SSE_USAGE = "usage"          # 消息级计量帧(D7/D1 全链路,2026-09-19 立):
                             # {"type":"usage","messageId","usage":{promptTokens,
                             # completionTokens,totalTokens,reasoningTokens},
                             # "timing":{firstTokenMs,durationMs},"model","costUsd"}
                             # 流收尾处发出(优先于 done 之后),前端据此更新消息 meta.usage
SSE_QUESTION = "question"    # 澄清问题 {"question": Question.to_dict()}
SSE_REASONING = "reasoning"  # 推理增量 {"content": "..."}
SSE_MESSAGE = "message"      # 底层 llm_gateway 透传的消息事件(event_type 别名)
SSE_STEER = "steer"          # 中途引导注入确认(2026-09-19 立,前端 use-chat/MessageItem 消费):
                             # {"type":"steer","phase":"injected","text":"用户引导文本",
                             #  "timestamp":"ISO(入队时间)","messageId":"assistant 消息 ID"}
                             # tool loop 每轮 LLM 调用前 drain 注入 messages 时发出

# ---------------------------------------------------------------------------
# 工具链事件(/llm/complete/stream 工具循环)
# ---------------------------------------------------------------------------

SSE_TOOL_CALL_START = "tool-call-start"  # 工具调用开始 {"toolName", "args", ...}
SSE_TOOL_RESULT = "tool-result"          # 工具结果 {"toolCallId", "result", ...}
SSE_TOOL_DELEGATE = "tool-delegate"      # 前端工具委托(session_id + 工具参数)
SSE_TOOL_SUMMARY = "tool-summary"        # 工具汇总(_build_tool_summary 产物)
SSE_TERMINAL_START = "terminal_start"    # 终端命令开始(前端 TerminalSection)
SSE_TERMINAL_END = "terminal_end"        # 终端命令结束(exitCode/duration)
SSE_TERMINAL_DELTA = "terminal_delta"    # 终端命令逐行增量(实时 stdout/stderr)

# ---------------------------------------------------------------------------
# 子 agent 事件(_tool_dispatch_subagent 委托链)
# ---------------------------------------------------------------------------

SSE_SUBAGENT_SPAWN = "subagent_spawn"      # 子agent 派生
SSE_SUBAGENT_PROGRESS = "subagent_progress"  # 子agent 进度
SSE_SUBAGENT_END = "subagent_end"          # 子agent 结束(含 status/ok)

# ---------------------------------------------------------------------------
# 增强事件(非 LLM 主线,由路由层聚合附加)
# ---------------------------------------------------------------------------

SSE_PLAN_UPDATED = "plan_updated"  # 计划更新(_format_plan_updated_event)
SSE_CITATIONS = "citations"        # 知识库引用(_collect_citations)

# ---------------------------------------------------------------------------
# Anthropic Messages API 兼容事件(/llm/messages/stream)
# ---------------------------------------------------------------------------

SSE_MESSAGE_START = "message_start"
SSE_CONTENT_BLOCK_START = "content_block_start"
SSE_CONTENT_BLOCK_DELTA = "content_block_delta"
SSE_CONTENT_BLOCK_STOP = "content_block_stop"
SSE_MESSAGE_DELTA = "message_delta"
SSE_MESSAGE_STOP = "message_stop"

# ---------------------------------------------------------------------------
# agent 任务流自产事件(/agents/execute/stream 直接构造,非 hook 转发)
# ---------------------------------------------------------------------------

SSE_START = "start"  # 执行开始 {"task_id", "session_id", "resume_from"}

# ---------------------------------------------------------------------------
# hook 总线事件(HOOK_EVENTS 镜像常量;agent_loop_v2 经 emit() 发射)
# ---------------------------------------------------------------------------

HOOK_SESSION_START = "session.start"
HOOK_SESSION_END = "session.end"
HOOK_TOOL_BEFORE = "tool.before"
HOOK_TOOL_AFTER = "tool.after"
HOOK_TOOL_APPROVAL = "tool.approval"
HOOK_MESSAGE_SEND = "message.send"
HOOK_MESSAGE_RECEIVE = "message.receive"
HOOK_ERROR = "error"
HOOK_PERMISSION_MODE = "permission.mode"
HOOK_SELF_HEAL = "self_heal"
HOOK_THINKING_DELTA = "thinking.delta"
HOOK_PLAN_STEP = "plan.step"
HOOK_TERMINAL_DELTA = "terminal.delta"  # P0-B(2026-09-18):run_command 逐行 stdout/stderr
HOOK_COMPACTION = "compaction"  # W9#5(2026-09-18):AgentLoopV2 上下文压缩发生(实时通知前端)
HOOK_AGENT_STATUS = "agent.status"  # W9#6(2026-09-18):pause/cancel 过渡事件(pausing/cancelling/resuming)

# ---------------------------------------------------------------------------
# hook 事件 → SSE 事件映射
#
# 目标命名对齐前端 use-agent-runtime.ts 监听的事件名:
# 'tool-approval' / 'self-heal' / 'thinking' / 'plan-step'(kebab-case);
# session/tool_call/tool_result/message 为 workbench 既有约定,不可变更。
# ---------------------------------------------------------------------------

HOOK_EVENT_TO_SSE: dict[str, str] = {
    HOOK_SESSION_START: "session",
    HOOK_SESSION_END: "session_end",
    HOOK_TOOL_BEFORE: "tool_call",
    HOOK_TOOL_AFTER: "tool_result",
    HOOK_TOOL_APPROVAL: "tool-approval",
    HOOK_MESSAGE_SEND: "message_send",
    HOOK_MESSAGE_RECEIVE: "message",
    HOOK_ERROR: SSE_ERROR,
    HOOK_PERMISSION_MODE: "permission-mode",
    HOOK_SELF_HEAL: "self-heal",
    HOOK_THINKING_DELTA: "thinking",
    HOOK_PLAN_STEP: "plan-step",
    HOOK_TERMINAL_DELTA: "terminal-delta",
    HOOK_COMPACTION: "compaction",
    HOOK_AGENT_STATUS: "agent-status",
}


def map_hook_event_to_sse(event: str) -> str:
    """hook_engine 事件 → SSE event 类型(未识别事件原样透传)。"""
    return HOOK_EVENT_TO_SSE.get(event, event)


# ---------------------------------------------------------------------------
# agents.py 三个 SSE 端点统一订阅的 hook 事件集合
#
# = agent_loop_v2 实际发射的全集(2026-09-19 message.send 发射源已在主循环
# LLM 调用前接线,15 种全订阅,无遗留缺口)。此前三端点各自订阅 7-8 种且集合
# 互有缺口(execute/stream 缺 thinking.delta/plan.step/session.end,
# tasks/stream 缺 message.receive/session.end/permission.mode 等),
# 2026-09-17 统一为同一份,新增发射源时在此处补一行即可。
# ---------------------------------------------------------------------------

AGENT_SUBSCRIBE_EVENTS: tuple[str, ...] = (
    HOOK_SESSION_START,
    HOOK_SESSION_END,
    HOOK_TOOL_BEFORE,
    HOOK_TOOL_AFTER,
    HOOK_TOOL_APPROVAL,
    HOOK_MESSAGE_RECEIVE,
    HOOK_MESSAGE_SEND,
    HOOK_ERROR,
    HOOK_PERMISSION_MODE,
    HOOK_SELF_HEAL,
    HOOK_THINKING_DELTA,
    HOOK_PLAN_STEP,
    HOOK_TERMINAL_DELTA,
    HOOK_COMPACTION,
    HOOK_AGENT_STATUS,
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
