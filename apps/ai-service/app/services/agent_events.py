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

import asyncio
from typing import Any

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
SSE_INJECTION_APPLIED = "injection_applied"
                             # 本轮"到底给模型注入了什么"的交代帧(D34,2026-09-22 立,G-40):
                             # {"type":"injection_applied","kind":"environments|agents_md|
                             #  developer_instructions|…(8 枚举之一)","collapsed":"一行摘要",
                             #  "fullText":"可选全文"}
                             # /llm/complete/stream 在 gen() 首帧前按实际生效顺序发出;
                             # 前端消费点属 B2(D37-D41),接线前由 api-client parseStreamLine
                             # 显式分流,绝不回落成正文(见 sse-d34-frames.test.ts)

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
# D151(2026-09-29 立,用户批"默认开 + 单次等待 300s"):命令在等键盘输入时的一帧。
# 与 terminal_delta 的区别:后者是"它在输出",前者是"它停住了、在等你敲一行"。
SSE_TERMINAL_INTERACTION = "terminal_interaction"

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
# D152(2026-09-29 立,用户拍板「服务化但存会话元数据、不建新表」):
# 会话目标(goal)状态的下行帧 + 「REST 写入口 → 正在跑的流」的推送口
# ---------------------------------------------------------------------------
#
# 单帧形态:`goal_updated` 带 `status`,清除目标走 `status:'cleared'`(不建第二帧
# `goal_cleared` —— 拍板口径,少一名就少一处会腐烂的清单)。载荷**必须自带
# sessionId**:上行出口的路径里带 {session_id},帧不给会话 id 前端只能猜,而猜错的
# 表现是"点了什么都没发生且不报错"(D151 的 terminal_interaction 同一课)。
SSE_GOAL_UPDATED = "goal_updated"

# 目标状态六档的服务端镜像(权威定义在 session_store.GOAL_STATUSES;这里只保证
# 「推送口」与「校验口」用的是同一份收窄,不在本文件重写第三份)。

# 正在跑的流按 conversationId 挂监听:`POST /llm/sessions/{session_id}/goal` 落在
# 服务端主副本之后,把这一帧推进**同会话当前活跃的流**(每条流一个 Queue)。
# 为什么需要一个注册表而不是"下次流首带出来":票面验收①是"A 端 set 后 B 端
# **不刷新**即见目标" —— 只带在流首就必然要刷新,那条验收会假绿在"我这边看了对"
# 而红在别人的真机。注册表随流生命周期注册/注销(llm.py 三处,与 _steer_sessions
# 同一组锚点),不消费、不清空别的流的队列。
_goal_listeners: dict[str, list[asyncio.Queue[dict[str, Any]]]] = {}


def register_goal_listener(conversation_id: str) -> asyncio.Queue[dict[str, Any]]:
    """为一条活跃流挂上 goal 监听(空列表即"该会话有流在跑")。"""
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    if conversation_id:
        _goal_listeners.setdefault(conversation_id, []).append(queue)
    return queue


def unregister_goal_listener(
    conversation_id: str, queue: asyncio.Queue[dict[str, Any]]
) -> None:
    """流收尾时摘掉自己的监听 —— 桶不删,后续同名会话会拿到一个没人 await 的队列。"""
    if not conversation_id:
        return
    listeners = _goal_listeners.get(conversation_id)
    if listeners is None:
        return
    try:
        listeners.remove(queue)
    except ValueError:
        return
    if not listeners:
        _goal_listeners.pop(conversation_id, None)


def publish_goal_update(conversation_id: str, payload: dict[str, Any]) -> int:
    """把一帧 goal_updated 推进该会话当前所有活跃流,返回实际投递的队列数。

    满队列(上一条还没被 yield 出去)**丢弃并计入返回值**:一个已经断流/卡住的消费方
    不该让写入口报错 —— 服务端主副本已经落库,刷新即见,而静默阻塞 REST 会让用户
    看到"设置目标失败"这种比"另一端暂时没更新"更假的结论。
    """
    delivered = 0
    for queue in list(_goal_listeners.get(conversation_id, ())):
        try:
            queue.put_nowait(payload)
            delivered += 1
        except asyncio.QueueFull:
            continue
    return delivered


def drain_goal_updates(queue: asyncio.Queue[dict[str, Any]]) -> list[dict[str, Any]]:
    """非阻塞取干该流的 goal 帧(流循环每轮调用一次,与 steer 的 drain 同位)。"""
    drained: list[dict[str, Any]] = []
    while True:
        try:
            drained.append(queue.get_nowait())
        except asyncio.QueueEmpty:
            return drained

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
