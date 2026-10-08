# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM 路由(2 端点)。

提供 LLM 直接调用接口,以及 SSE 流式调用接口(原生 token 级流式)。

集成设计(2026-07-09 Phase 3):
- 请求可选携带 metadata(dict)和 callback_url(str)
- metadata 透传到 done 事件,用于调用方关联会话/消息
- 若提供 callback_url,推理完成后异步 POST 完整结果到该 URL
- callback_url 默认值由 config.api_service_url 构造(如 http://api:8802/api/ai/callback)
"""

import asyncio
import json
import logging
import os
import time
import uuid
from collections import Counter
from collections.abc import AsyncIterator, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.context_compaction import SUMMARY_MARKER, compress_messages_if_needed
from ..core.llm_gateway import llm_gateway, moa_router
from ..core.model_naming import to_official_model_name
from ..core.permission_mode import (
    CHAT_MODE_TOOL_AXIS,
    _readonly_tools,
    allowed_tool_names,
    blocked_tool_message,
    resolve_mode_policy,
    tool_allowed_by_policy,
)
from ..core.provider_caps import (
    cap_to_dict,
    cap_with_max_context,
    get_provider_cap,
)
from ..core.question_parser import QuestionStreamParser

# V3 #53(2026-09-27):ChatMode × PermissionMode 硬收窄的**唯一判据出口**在
# core/permission_mode.py(矩阵 + 交集实现 + 被拦文案)。本路由不再自带任何
# 收窄表或 `in READONLY_TOOLS` 的散写判定 —— 只转发。
# 只读白名单本身仍是 services/plan_mode.py 的 READONLY_TOOLS 一份真相(由该出口内部取)。
from ..core.reasoning_effort_pin import (
    ReasoningEffortPin,
    reasoning_effort_for_request,
)

# D174:帧级 traceId 注入点只有一份实现,住在 `core/sse_frames.py`(取值经 core/trace_context
# 的那份投影,载体仍是 middleware 那一个 ContextVar);本路由不解析 traceparent、不自建 trace 上下文。
from ..core.sse_frames import with_frame_trace_id

# G-403(2026-10-07):usage 帧补发缓存读/写两维 —— 归一层已产出统一键,
# 发射面此前只写 prompt/completion/total/reasoning 四键,缓存两维断在帧构造。
from ..core.usage_cache import extract_cache_metrics, has_cache_signals
from ..services.agent_events import (
    SSE_CHUNK,
    SSE_CONTENT_BLOCK_DELTA,
    SSE_CONTENT_BLOCK_START,
    SSE_CONTENT_BLOCK_STOP,
    SSE_DONE,
    SSE_ERROR,
    SSE_FALLBACK,
    SSE_INJECTION_APPLIED,
    SSE_MESSAGE_DELTA,
    SSE_MESSAGE_START,
    SSE_MESSAGE_STOP,
    SSE_QUESTION,
    SSE_REASONING,
    SSE_STEER,
    SSE_SUBAGENT_END,
    SSE_SUBAGENT_PROGRESS,
    SSE_SUBAGENT_SPAWN,
    SSE_TERMINAL_DELTA,
    SSE_TERMINAL_END,
    SSE_TERMINAL_INTERACTION,
    SSE_TERMINAL_START,
    SSE_TOOL_CALL_START,
    SSE_TOOL_DELEGATE,
    SSE_TOOL_RESULT,
    SSE_USAGE,
)
from ..services.async_gen_close import aclose_async_gen
from ..services.context_recall import context_recall
from ..services.decision_chain import apply_decision_chain
from ..services.mcp_server import (
    _FORM_REQUEST_TOOL_NAME,
    _TOOL_ALIASES,
    _tool_dispatch_subagent,
    _tool_vision_analyze,
    build_form_request_frame,
    get_registered_tool_names,
    reset_terminal_stream_context,
    set_terminal_stream_context,
    settle_terminal_input,
)
from ..services.project_memory import build_system_prompt
from ..services.user_quota import user_trial_quota

router = APIRouter()
logger = logging.getLogger(__name__)

# 持有待完成的回调 task 引用,防止 CPython GC 回收未持有的 task
_pending_callbacks: set[asyncio.Task[None]] = set()

# 持有压缩回捞快照的 fire-and-forget task 引用(防止 GC 回收未持有 task)
_pending_compaction_snapshots: set[asyncio.Task[Any]] = set()


class _InflightToolTasks:
    """MCP 工具调用取消闭环(2026-09-19 立):按流追踪 in-flight 工具任务。

    背景:tool loop 中 dispatch_subagent / call_tool 以独立 asyncio.Task 执行
    (生成器边排水进度/delta 帧边等任务),客户端断开(网关 abort fetch)取消
    生成器时,这些任务无人 cancel 即成孤儿继续跑完,浪费额度且留下脏状态
    (浏览器会话/子进程)。每条 SSE 流(gen)实例化一份,创建工具任务时 track
    登记(完成回调自动 discard 防泄漏),流收尾 finally 统一 cancel_all。
    仅同一 event loop 内操作,无跨线程并发问题。
    """

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[Any]] = set()

    def track(self, task: asyncio.Task[Any]) -> asyncio.Task[Any]:
        """登记 in-flight 工具任务;完成时自动移出集合。返回原 task 便于就地赋值。"""
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    def cancel_all(self) -> int:
        """统一 cancel 仍 in-flight 的工具任务,返回实际取消数;空集 no-op 不报错。

        仅请求取消不 await 回收:收尾路径可能已处于取消作用域内,await 会再次
        招致 CancelledError;被 cancel 的任务由事件循环正常回收,其 CancelledError
        不会外溢为 "exception was never retrieved" 告警。
        """
        cancelled = 0
        for task in list(self._tasks):
            if not task.done():
                task.cancel()
                cancelled += 1
        self._tasks.clear()
        return cancelled

# 浏览器端工具委托 session 管理(2026-08-02 立,阶段 2)
# 每个 /llm/complete/stream 请求(workspace_context 模式)生成一个 session_id,
# tool loop 遇到 fs 类工具时,通过 SSE 发 tool-delegate 事件委托前端执行,
# 前端通过 POST /llm/complete/stream/{session_id}/tool-result 回传结果。
_delegate_sessions: dict[str, dict[str, Any]] = {}
_DELEGATE_TIMEOUT = 60  # 秒

# Steer(中途引导,2026-09-19 立)session 队列:
# 流式对话进行期间,用户经 POST /llm/complete/stream/{session_id}/steer 提交引导文本,
# 入队本 dict;tool loop 每轮 LLM 调用前 drain 注入 messages(不打断当前工具执行),
# 并发 event: steer(phase=injected) 通知前端换 badge。每项 {text, queuedAt ISO, kind};
# 流结束(gen 的 finally)统一清理,与 _delegate_sessions 生命周期一致。
# G-815975:条目带 kind 类型轴 —— 吸收循环遇不可 inline 的 kind 必须停下
# (break 不是 continue);收口时未消费的条目逐条发 steer(phase=dropped) 显式回报,
# 不再静默丢弃(客户端早已拿到"入队成功"ACK,必须有下文)。
_steer_sessions: dict[str, list[dict[str, Any]]] = {}
_STEER_QUEUE_LIMIT = 8  # 单流引导队列上限,超限 steer 端点返回 429(防刷)

# G-815975:steer 条目 kind 枚举。
# - guide:普通引导,可 inline 注入当前轮(既有语义,缺省档);
# - control:控制轮条目(GUI「配置」的设置轮)。它会改变后续轮语义 —— 它之后
#   入队的条目说的是它刚记下的新状态,模型必须先读到「设置已调整、新 run 是谁」,
#   再读到新状态下的进展。所以吸收在它面前停,它**之后**的普通引导同样不得被
#   吸收(把 break 写成 continue 等于把顺序恢复成原来的错法),留给收口回报。
STEER_KINDS = frozenset({"guide", "control"})
_STEER_INLINE_KINDS = frozenset({"guide"})


def _drain_inlineable_steers(session_id: str | None) -> list[dict[str, Any]]:
    """G-815975:带类型轴的引导吸收 —— 只吸收队首连续的可 inline 条目。

    遇到第一条不可 inline 的 kind(control)即停(break,不是 continue 跳过):
    该条目与其后的所有条目都留在队列,由流收口的 `_report_dropped_steers`
    显式回报。全部消费完返回空列表时调用方不发任何 dropped 帧。
    """
    if not session_id:
        return []
    queue = _steer_sessions.get(session_id)
    if not queue:
        return []
    consumed: list[dict[str, Any]] = []
    while queue and str(queue[0].get("kind") or "guide") in _STEER_INLINE_KINDS:
        consumed.append(queue.pop(0))
    return consumed


def _steer_dropped_frame(item: dict[str, Any]) -> dict[str, Any]:
    """G-815975:为一条未消费引导构 steer(phase=dropped) 帧(点名该条目)。

    复用既有 steer 帧(sse_contract 已登记 phase/text/timestamp/messageId;
    kind 为新增可选字段),不另开事件名。
    """
    frame: dict[str, Any] = {
        "type": SSE_STEER,
        "phase": "dropped",
        "text": str(item.get("text", "")),
        "kind": str(item.get("kind") or "guide"),
        "reason": "stream_closed_unconsumed",
    }
    if item.get("queuedAt"):
        frame["timestamp"] = item["queuedAt"]
    return frame


def _report_dropped_steers(session_id: str | None) -> list[dict[str, Any]]:
    """G-815975:流收口时整桶摘除未消费引导并逐条构 dropped 帧。

    空桶返回空列表 —— 全部消费完 ⇒ 一帧不发(防做成"每条都喊")。
    发帧由调用方在生成器收尾处 yield;GeneratorExit/客户端断开路径不允许
    yield,调用方只落 warning 日志留痕。
    """
    if not session_id:
        return []
    remaining = _steer_sessions.pop(session_id, None) or []
    return [_steer_dropped_frame(item) for item in remaining]

# =============================================================================
# V3 #58(2026-09-26 立):主对话流工具审批门(语义对齐 agent_loop_v2 tool_approval)
# =============================================================================
# 为什么:主聊天 /api/llm/complete/stream 的 tool loop 此前工具直接执行,只有
# 「工作区权限模式档位」在前端管;agent 任务流(agent_loop_v2)早已有审批门
# (decision approve/reject + scope once/session/always)。本节把同语义审批门
# 接入主对话流。帧契约(供 parity 对账与前端解析,事件名对账由主会话统一维护):
#   SSE 帧名:`tool-approval`(event: tool-approval + data JSON)
#   payload(snake_case,与 agent 任务流 tool-approval 事件同形):
#     {type:'tool-approval', approval_id, tool_name, tool_call_id,
#      args_preview, danger_level, session_id}
#   决策回传:POST /llm/complete/stream/{session_id}/approval-response
#     {approval_id, decision:'approve'|'reject', scope:'once'|'session'|'always', reason?}
# 注意:本帧常量定义在 llm.py 本地(agent_events.py 非本任务领地);
# sse_contract 契约清单由主会话登记,_sse() 诊断对未登记帧仅告警不阻断。
_SSE_TOOL_APPROVAL = "tool-approval"
# D113(2026-09-27,G-227):文件写类工具流中 diff 预览帧(契约已登记 sse_contract.SSE_EVENTS)。
_SSE_TOOL_DELTA = "tool-delta"
# 预演范围:服务端流内真实执行的文件写类工具(apply_patch/create_file 走浏览器委托,
# 由前端 InlineDiffCard 承担流中显示,不在本帧范围)。
_FILE_EDIT_PREVIEW_TOOLS = frozenset({"write_file", "file_edit", "edit_file"})
# 预览分帧预算:最多 10 帧 x 40 行,总量 400 行 / 32KB 截断(truncated 标志)。
_PREVIEW_MAX_FRAMES = 10
_PREVIEW_LINES_PER_FRAME = 40
_PREVIEW_MAX_LINES = 400
_PREVIEW_MAX_CHARS = 32 * 1024

# D120(2026-09-27,G-234):轮次预算弹性续跑 —— 接近 max_iterations 上限时自动
# 注入"进度交代 + 续期"轮,防止长任务被硬断(对标 GPT-5.3 Codex 长时运行定位)。
# 续期次数有限(默认 2,env LLM_ITERATION_EXTEND_LIMIT 可调,0 = 关闭),每次
# 续 +max_iterations 轮;成本守门(预算门/扣费)不因续期绕过。
_ITERATION_EXTEND_LIMIT = max(0, int(os.getenv("LLM_ITERATION_EXTEND_LIMIT", "2")))

# G-815971(2026-10-07):限额/配额收口 ⇒ 禁止续期。D120 的方向是"接近上限主动
# 注入续跑轮";但"本轮因限额/配额收口"时,任何"会重新打开模型请求"的续跑通道
# 都必须关死 —— 用户看到"额度用完了"后面又跑一轮,而额度正是在这轮里继续被烧。
# 判据唯一出口:`_is_budget_exhaustion_error`(码面白名单 + 消息面模式)。
_BUDGET_EXHAUSTED_ERROR_CODES = frozenset({
    "BUDGET_EXHAUSTED",        # 网关 hard 中断(apps/api checkTokenBudget,errorCode 透传)
    "TRIAL_QUOTA_EXCEEDED",    # 本文件试用额度门(423/429)
    "PROVIDER_QUOTA_EXHAUSTED",  # llm_gateway 额度耗尽稳定码(批次 60)
    "QUOTA_EXCEEDED",
    "RATE_LIMITED",
    "RATE_LIMIT_EXCEEDED",
    "PAYMENT_REQUIRED",
})
_BUDGET_EXHAUSTED_MESSAGE_PATTERNS = (
    "429", "quota", "rate limit", "insufficient", "payment required",
    "额度", "配额", "余额不足", "限额",
)


def _is_budget_exhaustion_error(error_code: Any, message: Any = "") -> bool:
    """判"这个错误是不是限额/配额收口"(G-815971 判据唯一出口)。

    码面精确命中白名单,或消息面含限额/配额模式(大小写不敏感)。
    判宽不判窄:误报的代价只是少续一期(保守方向),漏报的代价是
    额度收口后继续烧钱。
    """
    code = str(error_code or "").strip().upper()
    if code in _BUDGET_EXHAUSTED_ERROR_CODES:
        return True
    text = str(message or "").strip().lower()
    return bool(text) and any(p in text for p in _BUDGET_EXHAUSTED_MESSAGE_PATTERNS)


def _d120_should_extend(
    *,
    tool_iter: int,
    iter_budget: int,
    extensions_used: int,
    tool_executed_last_round: bool,
    budget_exhausted: bool,
) -> bool:
    """D120 续期判定唯一出口(G-815971)。

    触发条件(全部满足):env 开关启用 / 非首轮 / 下一轮即触及上限 / 续期次数
    未用尽 / 上一轮确实执行了工具 —— 且**本轮未因限额/配额收口**(排除条款:
    budget_exhausted=True 一票否决,续期与 hook 注入条目一并归零)。
    """
    if budget_exhausted:
        return False
    return bool(
        _ITERATION_EXTEND_LIMIT > 0
        and tool_iter > 0
        and tool_iter + 1 >= iter_budget
        and extensions_used < _ITERATION_EXTEND_LIMIT
        and tool_executed_last_round
    )


def _file_edit_preview_text(tool_name: str, args: dict[str, Any]) -> str | None:
    """D113:文件写类工具的流中预览文本(纯参数推导,不触碰磁盘、不执行)。"""
    if tool_name == "write_file":
        c = args.get("content")
        return c if isinstance(c, str) else None
    if tool_name in ("file_edit", "edit_file"):
        new = args.get("new_string")
        return new if isinstance(new, str) else None
    return None


def _file_edit_preview_frames(text: str) -> list[tuple[str, bool]]:
    """把预览文本切成 (partialText, truncated) 帧序列(累积式)。"""
    lines = text.splitlines()
    truncated = len(lines) > _PREVIEW_MAX_LINES or len(text) > _PREVIEW_MAX_CHARS
    kept: list[str] = []
    used = 0
    for ln in lines[:_PREVIEW_MAX_LINES]:
        if used + len(ln) + 1 > _PREVIEW_MAX_CHARS:
            truncated = True
            break
        kept.append(ln)
        used += len(ln) + 1
    frames: list[tuple[str, bool]] = []
    for i in range(0, len(kept), _PREVIEW_LINES_PER_FRAME):
        is_last_batch = i + _PREVIEW_LINES_PER_FRAME >= len(kept)
        frames.append(("\n".join(kept[: i + _PREVIEW_LINES_PER_FRAME]), truncated and is_last_batch))
    return frames[:_PREVIEW_MAX_FRAMES]
_APPROVAL_TIMEOUT = 120  # 秒:人工决策窗口(人在环延迟高于机器回传,比委托 60s 宽)
_APPROVAL_KEEPALIVE_INTERVAL = 15  # 秒:等待期间发 SSE 注释行,防前端 30s 读超时掐流

# 审批等待注册表:session_id -> approval_id -> {event, decision, scope, reason}。
# 与 _delegate_sessions 同生命周期模式:条目仅在人工弹窗等待窗口内存在,
# 决策/超时后由等待方清理(防内存泄漏)。
_approval_sessions: dict[str, dict[str, dict[str, Any]]] = {}


def _scoped_exec_prefix_key(owner_uuid: str | None, prefix_tokens: list[str]) -> str | None:
    """D158 owner-binding(2026-09-29):exec_prefix 放行规则 cache_key 的**唯一**算键出口。

    写入侧(`_persist_grant_rule`)与命中侧(`_exec_prefix_grant_hits`)共用这一份,
    主体拼接与规范化都委托 approval_persistence.scoped_cache_key +
    normalize_exec_key —— 存储层与 llm 层各只有一份实现,不在此重抄规则
    (本仓最高频失效型就是"两处算同一件事必漂移";主体来源也只有一个:
    端点入口的 `owner_uuid = _resolve_owner_uuid(request)`,即 JWT 派生,
    绝不取客户端自报 userId —— 与内存侧 `_grant_bucket_key` 的
    `conv::<JWT subject>::<conversationId>` 同一设计意图)。

    缺主体 ⇒ None ⇒ 两侧都不落/不命中(fail-closed,与 `_grant_bucket_key`
    "归属不齐不新增放行面"同语义;绝不允许无主体的全局放行规则存在)。
    """
    uid = str(owner_uuid or "").strip()
    if not uid:
        return None
    try:
        from app.services import approval_persistence as _ap

        return _ap.scoped_cache_key(uid, _ap.normalize_exec_key(prefix_tokens))
    except Exception:  # noqa: BLE001 - 算键失败按无规则处理,两侧调用方各自降级
        return None


def _persist_grant_rule(
    entry: dict[str, Any] | None, tool_name: str, session_id: str, owner_uuid: str | None
) -> None:
    """D158:审批条目带 grant_rule 且工具是 run_command 时,把 argv 前缀落成放行规则。

    键空间唯一实现:`_scoped_exec_prefix_key`(主体 + normalize_exec_key;
    与命中侧同一份);TTL=90 天(用户批的预填口径);登记失败只 warn,不阻断本次
    已批准的执行 —— 宁可下次同类命令再问一次,也不因规则落库失败把用户批准的执行打断。

    D158 owner-binding(2026-09-29):规则必须绑定**令牌主体**(owner_uuid,
    由端点入口 `_resolve_owner_uuid(request)` 单一来源传入)。缺主体 ⇒ 跳过登记,
    本次已批准的执行照常进行,只是不产生持久放行规则(第四档退化为本轮放行)。
    """
    if not isinstance(entry, dict):
        return
    gr = entry.get("grant_rule")
    if not (isinstance(gr, dict) and gr.get("kind") == "exec_prefix"):
        return
    if tool_name != "run_command":
        return
    argv = entry.get("argv") or []
    if not isinstance(argv, (list, tuple)) or len(argv) < 1:
        return
    try:
        from app.services import approval_persistence as _ap

        tokens = max(1, min(4, int(gr.get("tokens", 2))))
        cache_key = _scoped_exec_prefix_key(owner_uuid, [str(x) for x in argv[:tokens]])
        if cache_key is None:
            logger.info(
                "D158 前缀放行规则未登记:缺令牌主体(session=%s, argv前缀=%s)",
                session_id,
                list(argv[:tokens]),
            )
            return
        _ap.grant("always", cache_key, "exec_prefix", ttl_days=90)
        logger.info(
            "D158 前缀放行规则已登记(session=%s, owner=<JWT主体>, argv前缀=%s, ttl=90d)",
            session_id,
            list(argv[:tokens]),
        )
    except Exception:  # noqa: BLE001 - 登记失败不阻断已批准的执行
        logger.warning(
            "D158 前缀放行规则登记失败(session=%s, tool=%s)",
            session_id,
            tool_name,
            exc_info=True,
        )


def _exec_prefix_grant_hits(argv: list[str] | tuple[str, ...], owner_uuid: str | None) -> bool:
    """D158:命令 argv 是否命中任一已登记的前缀放行规则(持久层,经 approval_persistence)。

    键空间唯一实现:`_scoped_exec_prefix_key`(与写入侧同一份,主体 + normalize);
    本函数是主对话流(run_command 工具)的**判定出口**,mcp 侧继续用它自己的内存表+持久层
    双查 —— 两处共用"键怎么算"这一份实现,不共内存表(两套生命周期,各自兜底)。

    D158 owner-binding(2026-09-29):只匹配**当前令牌主体**登记的规则。
    A 批准的 `git push` 前缀对 B 不再免弹窗(B 返回 False ⇒ 调用方保持弹窗,
    即"未发出放行");存量无主体行落在另一键空间,对本判定永不命中(等效失效)。
    缺主体 ⇒ False(无从比对 ⇒ 不放行)。
    fail-closed:持久层查询异常视为未命中(宁可多问一次,不放行)。
    """
    try:
        from app.services import approval_persistence as _ap

        for _n in range(1, min(4, len(argv)) + 1):
            cache_key = _scoped_exec_prefix_key(owner_uuid, [str(x) for x in argv[:_n]])
            if cache_key is None:
                return False
            if _ap.check(cache_key, "exec_prefix"):
                return True
        return False
    except Exception:  # noqa: BLE001
        return False

# D159(2026-09-30 立,用户批"三档到底"):审批载荷的**执行环境/网络目标**事实
# ----------------------------------------------------------------------------
# 组装只有一份实现(``network_approval.approval_env_payload``),本路由只是调用它 ——
# 两处读法必漂移,而这一族漂移的代价是"弹窗说在沙箱里、实际直跑"(票第 8 栏爆炸半径)。
# 回退开关 ``IHUI_APPROVAL_ENV_REPORT=0`` 也在那一份实现里判:关档 ⇒ 一个新字段都不发
# ⇒ 前端整块不渲染,逐字回到本票落地前的形态(已入库载荷不受影响)。
def _approval_env_fields(
    tool_name: str, args: dict[str, Any] | None, owner_uuid: str | None
) -> dict[str, Any]:
    """审批帧的新字段(读不到就整块缺席,绝不发一个"看起来像事实"的默认值)。

    出口自身故障也不能把审批链打断:那条链的失效方向必须是"信息少了(弹窗喊未上报)",
    而不是"高危工具没经过弹窗就执行了"。异常 ⇒ 回空 dict(= 不发新字段)。
    """
    try:
        from ..services.network_approval import approval_env_payload

        payload = approval_env_payload(tool_name, args, owner=owner_uuid)
    except Exception as exc:  # noqa: BLE001 - 载荷事实取不到不阻断弹窗
        logger.warning("D159 审批环境字段组装失败(tool=%s): %s", tool_name, exc)
        return {}
    return dict(payload)


def _approval_network_fact(
    tool_name: str, args: dict[str, Any] | None, owner_uuid: str | None
) -> Any:
    """本次审批**要放行的那一个网络目标**(存进待决条目,结算时按它落规则)。

    与帧上的 ``network_target`` 同一次取值 ⇒ 弹窗上显示的与库里落的结构上同一条。
    取不到(无目标/解析失败/出口故障)⇒ None ⇒ 三档不落任何规则(不退化成"按工具名放行")。
    """
    try:
        from ..services.network_approval import network_target_from_args

        return network_target_from_args(args, owner=owner_uuid)
    except Exception as exc:  # noqa: BLE001
        logger.warning("D159 网络目标读取失败(tool=%s): %s", tool_name, exc)
        return None


def _persist_network_grant(
    fact: Any, decision: str, scope: str, session_id: str, owner_uuid: str | None
) -> None:
    """D159 三档落库:拒绝/非 approve ⇒ 什么都不写;``once`` ⇒ 不落库;其余按目标落规则。

    主体只用**承载层**那一份(owner_uuid = ``_resolve_owner_uuid(request)``,即 JWT),
    目标只用**发帧时存在条目里**的那一份 —— 两者都不读回传体,所以"批 A 连 B"与
    "自报别人的键去撤销"两条都进不来(AGENTS §5"认证不等于授权")。
    缺主体 ⇒ 持久层抛/跳过,本次已批准的执行照常进行(与 D158 第四档同一退化)。
    """
    if decision != "approve" or fact is None or owner_uuid is None:
        return
    try:
        from ..services.network_approval import grant_network_target

        granted = grant_network_target(fact, scope)
        if not granted:
            logger.warning(
                "D159 网络放行未落规则(scope=%s, target=%s, session=%s)",
                scope,
                getattr(fact, "display", "?"),
                session_id,
            )
    except Exception as exc:  # noqa: BLE001 - 落库失败不阻断已批准的执行,但必须响
        logger.warning(
            "D159 网络放行落库异常(scope=%s, session=%s): %s", scope, session_id, exc
        )


def _network_grant_hits(args: dict[str, Any] | None, owner_uuid: str | None) -> bool:
    """D159 三档的**命中侧**(与 `_persist_network_grant` 写入侧成套)。

    只有落库没有这一读,"始终允许该目标"就是一条没人查的死规则 ⇒ 弹窗照样每轮弹,
    而按钮文案已经向用户承诺了 90 天(票第 8 栏预填表"三档到底"的全部意义就在这里,
    与 D158 `_exec_prefix_grant_hits` 是同一课)。

    判据(逐条对应票面):
    - 只认**主体级命中**(pending_network_targets 带 owner ⇒ 查 ``<uuid>\\x1e net\\x1f…`` 键)。
      批 52 的无主体 session 键**不算命中** —— 那是 requester 链路的既有放行面,把它并进
      免弹窗判据会重新打开 D158 修掉的"A 批准、B 免弹"(AGENTS §5 认证不等于授权);
    - 本次调用**所有**可读目标都命中才免弹:命中 1/2 就放行等于把没批过的目标静默连出去,
      同"批 A 连 B"一个方向;
    - 无目标 / 缺主体 / 出口异常 ⇒ False(照弹)。免弹窗是放行动作,判不了就不放。
    """
    if owner_uuid is None:
        return False
    try:
        from ..services.network_approval import pending_network_targets

        targets = pending_network_targets(args, owner=owner_uuid)
    except Exception as exc:  # noqa: BLE001 - 判据故障不放大成免弹
        logger.warning("D159 网络放行命中查询失败(照弹): %s", exc)
        return False
    if not targets:
        return False
    try:
        from app.services import approval_persistence as _ap

        from ..services.network_approval import KIND_NET as _NET_KIND

        return all(
            t.owner_bound_key is not None
            and _ap.check(t.owner_bound_key, _NET_KIND) is not None
            for t in targets
        )
    except Exception as exc:  # noqa: BLE001 - 持久层故障 fail-closed(照弹)
        logger.warning("D159 持久层命中查询异常(照弹): %s", exc)
        return False


# 会话内「总是允许」授权缓存(内存 dict;轻量对齐 agent_loop_v2 审批缓存语义):
# bucket -> {tool_name -> (scope('session'|'always'), 到期时刻)}。
# once 不落缓存;进程重启即失效(session/always 均为内存态,V3 #58 先落地主链路)。
#
# 桶形(2026-09-28 改,原先是平铺 `f"{session_id}::{tool_name}"` 键):流收尾必须能把
# 一个归属的授权整桶收回,平铺键做不到"按会话清"。
#
# 归属键(同日第二次改,把 "session" 档从"本轮"升成"本会话"):
# 上一版键取 `session_id`,而 `streamSessionId` 由网关**每轮**新生成
# (`apps/api/src/routes/ai-chat-stream.ts` 的 `randomUUID()`,缺省时本文件另生成 uuid4)
# —— 于是用户点了「本会话总是允许」,下一轮换一个 id 就读不到那格,同一个工具下一轮
# 又弹一次。声明的档位与执行的寿命不同形,这一档等于没实现。
# 现在按 **令牌主体 + conversationId** 落桶(见 `_grant_bucket_key`):同一会话的后续轮次
# 命中,跨用户/跨会话都不命中;主体只从 JWT 派生,绝不从 `metadata.userId` 取 ——
# 那是客户端自报字段(本文件 P0-9 那条修复讲的正是同一型)。归属不齐时退回本轮桶,
# 行为与改前逐字一致(不新增放行面)。
# 主体身份链(现读确认,免得下一个人重新猜):8802 网关在 `/chat/stream` 上把调用方的
# `Authorization` 头**原样转发**给本服务(`apps/api/src/routes/ai-chat-stream.ts`),
# 由 `core/jwt_auth.py` 验签后写 `request.state.user_id` ⇒ 这条链上 `_resolve_owner_uuid`
# 拿到的就是终端用户,不是 `system-worker`(`apps/api/src/utils/ai-service-fetch.ts` 的
# 系统级凭证是另一条链路 —— v1 工具面走那个,那条上共享桶的害处已登记在
# `v1-knowledge-tools.ts` 的头注里)。
# 内存上界由 `_GRANT_TTL_SECONDS`(滑动)与 `_GRANT_MAX_BUCKETS` 两条一起兜,
# 不再依赖"每轮换 id + 流收尾删桶"那种巧合。
_tool_approval_grants: dict[str, dict[str, tuple[str, float]]] = {}

_GRANT_TTL_SECONDS = 1800.0
_GRANT_MAX_BUCKETS = 512


def _grant_bucket_key(
    owner_uuid: str | None, conversation_id: str | None, turn_id: str | None
) -> str:
    """审批授权的落点键:归属齐备走会话桶,否则走本轮桶。

    返回值形如 `conv::<主体>::<会话>` 或 `turn::<本轮 session_id>`,前缀即档别 ——
    收尾清理只认 `turn::` 那一档(见 `_grant_drop_if_turn_scoped`),
    会话桶必须活过本轮,否则本次改动就白做。
    """
    uid = str(owner_uuid or "").strip()
    conv = str(conversation_id or "").strip()
    if uid and conv:
        return f"conv::{uid}::{conv}"
    return f"turn::{turn_id or ''}"


def _grant_lookup(bucket: str, tool_name: str, now: float) -> str | None:
    """读一次授权;命中即滑动续期,过期条目就地丢弃(空桶跟着收掉)。"""
    inner = _tool_approval_grants.get(bucket)
    if not inner:
        return None
    hit = inner.get(tool_name)
    if hit is None:
        return None
    scope, expires_at = hit
    if expires_at <= now:
        inner.pop(tool_name, None)
        if not inner:
            _tool_approval_grants.pop(bucket, None)
        return None
    inner[tool_name] = (scope, now + _GRANT_TTL_SECONDS)
    return scope


def _grant_record(bucket: str, tool_name: str, scope: str, now: float) -> None:
    """落一次授权。桶按"最近被触碰"排序(evict 的淘汰序即实际使用序)。"""
    _grant_evict(now)
    inner = _tool_approval_grants.setdefault(bucket, {})
    inner[tool_name] = (scope, now + _GRANT_TTL_SECONDS)
    _tool_approval_grants[bucket] = _tool_approval_grants.pop(bucket)


def _grant_evict(now: float) -> None:
    """清扫整桶到期的归属,并把总桶数压回上限(最久未触碰的先走)。"""
    for b in [b for b, inner in _tool_approval_grants.items() if all(exp <= now for _, exp in inner.values())]:
        _tool_approval_grants.pop(b, None)
    while len(_tool_approval_grants) >= _GRANT_MAX_BUCKETS:
        oldest = next(iter(_tool_approval_grants), None)
        if oldest is None:
            return
        _tool_approval_grants.pop(oldest, None)


def _grant_drop_if_turn_scoped(bucket: str) -> bool:
    """流收尾清理:只收本轮桶。返回 True = 确实删掉了一格。

    会话桶不得在这里删 —— 它的定义就是"活过本轮"。改前那一句无条件 pop 之所以
    看起来无害,只因为当时所有桶都是本轮的(每轮换 id),那一行同时承担着"声明的
    寿命"与"内存回收"两件事;归属升成会话级之后必须把它拆开,否则跨轮放行永不成立。
    """
    if not bucket.startswith("turn::"):
        return False
    return _tool_approval_grants.pop(bucket, None) is not None

# =============================================================================
# V3 #63(2026-09-27 立):主对话流业务表单帧 form_request / 应答端点 form-response
# =============================================================================
# 与 V3 #58 的 tool-approval 同族(同一拦截位、同一 keepalive 分段等待、同一注册表
# 生命周期),但语义不同:审批问的是"允不允许我做",表单问的是"这件事的内容请你填"。
# 帧契约(供 parity 对账与前端解析):
#   SSE 帧名:form_request
#   payload(**camelCase**,与 packages/api-client 的 tryParseFormRequest 逐键同形;
#            写 snake_case 不报错、整帧被静默丢弃):
#     {type, requestId, sessionId, kind, fields[], actions:["approve","reject"], messageId?}
#   决策回传:POST /llm/complete/stream/{session_id}/form-response
#     {request_id, kind, action:'approve'|'reject', values?, reject_reason?, message_id?}
#     —— **上行才是 snake_case**(与同通道 tool-result 的 tool_call_id 同族)。
# 工具本体 request_business_form 在 mcp_server 注册(让模型知道有这件事),
# 但**不由 mcp_server 执行**:本文件在 call_tool 之前拦下,拿不到通道时才回落兜底 handler。
_SSE_FORM_REQUEST = "form_request"
_FORM_WAIT_TIMEOUT = 300  # 秒:填表要读要想要,比审批的 120s 宽;超时按未答处理
_FORM_KEEPALIVE_INTERVAL = 15  # 秒:同 _APPROVAL_KEEPALIVE_INTERVAL,防前端 30s 读超时掐流
# session_id -> request_id -> {event, action, values, reject_reason, user_id, kind}
# 与 _approval_sessions 同生命周期:仅在等待用户应答的窗口内存在,结算/超时后由等待方 pop。
_form_sessions: dict[str, dict[str, dict[str, Any]]] = {}


def _form_pending_entry(session_id: str, request_id: str) -> dict[str, Any] | None:
    """取一条仍在等待的表单请求;不存在 ⇒ None(调用方按"与不存在同形"回包)。"""
    entry = _form_sessions.get(session_id, {}).get(request_id)
    if not isinstance(entry, dict) or not isinstance(entry.get("event"), asyncio.Event):
        return None
    return entry


# 工具危险级映射(主对话流已知高危/中危工具;未收录工具不拦截 —— 主聊天工具面
# 由 mcp_server._TOOLS 与浏览器委托面构成,默认全拦会打断日常使用;高危口径与
# agent_loop_v2 对齐:命令执行/删除/移动为 high,文件写入/编辑为 medium)。
_TOOL_DANGER_LEVELS: dict[str, str] = {
    # 命令执行:可执行任意命令,最高危
    "run_command": "high",
    "execute_command": "high",
    # 删除/移动/git:不可逆操作
    "delete_file": "high",
    "move_file": "high",
    "git_operations": "high",
    # 文件写入/编辑:可覆盖内容(accept-edits 档语义放行的就是这一类)
    "write_file": "medium",
    "create_file": "medium",
    "file_edit": "medium",
    "apply_patch": "medium",
}


def _normalize_permission_mode(mode: str | None) -> str:
    """归一权限模式档位(前端 kebab-case 与 agent 侧 camelCase 两种写法都收)。"""
    if not mode:
        return "default"
    m = str(mode).strip()
    if m in ("bypassPermissions", "bypass-permissions"):
        return "bypass-permissions"
    if m in ("acceptEdits", "accept-edits"):
        return "accept-edits"
    if m == "plan":
        return "plan"
    return "default"


def _resolve_tool_approval(permission_mode: str | None, tool_name: str) -> tuple[bool, str]:
    """主对话流审批判定:返回 (是否需要弹窗, 危险级)。

    档位语义(与 agent_loop_v2 既有语义对齐):
    - bypass-permissions:不拦截(用户已显式选择完全访问,既有档位语义);
    - accept-edits:文件写入/编辑类(medium)自动放行 —— 该档语义即"替我审批编辑",
      命令执行/删除类(high)仍需审批;
    - default / plan / None:收录的高/中危工具都需审批(plan 档主对话流本就只靠
      prompt 约束不执行工具,此处兜底同 default,不额外拒绝)。
    """
    danger = _TOOL_DANGER_LEVELS.get(tool_name)
    if danger is None:
        return False, ""
    mode = _normalize_permission_mode(permission_mode)
    if mode == "bypass-permissions":
        return False, danger
    if mode == "accept-edits" and danger == "medium":
        return False, danger
    return True, danger

# fs 类工具集合(依赖本地文件系统,浏览器端需委托前端执行)
# 2026-08-06:list_files 移出本集合 —— 只读目录列表已由 mcp_server 本地实现
# (工作区白名单约束),委托前端反而依赖 workspace 句柄易失败。
#
# 2026-09-26(V3 #49)补口径:本集合成员的**可达性分两种**,此前无文档说明:
#   (a) 本地注册面 —— 名字在 mcp_server._TOOLS 里,任何部署形态都可执行;
#   (b) 浏览器委托面 —— 名字**不在** _TOOLS,仅在 req.workspace_context 存在时
#       由前端 apps/web/src/lib/workspace-tool-executor.ts 执行。
# 二者相交但不对等:下面的 _DELEGATE_ONLY_TOOLS 是 (b) 减 (a) 的部分。
_FS_DEPENDENT_TOOLS = {
    "read_file", "write_file", "file_edit", "file_search",
    "search_codebase", "apply_patch",
    "create_file", "delete_file", "move_file",
    "analyze_code", "generate_test",
}

# 2026-09-26(V3 #49)立:仅存在于浏览器委托面、本地 _TOOLS 未注册的工具。
# 后果此前无人交代谢=Tauri/本地工作区(workspace_path 模式,无 workspace_context)下,
# LLM 调这些名字会一路走到 _mcp.call_tool 得到模糊的「未知工具」,模型既不知道换哪个
# 工具也不知道为什么 —— 而现在它们会得到一条带等价建议的明确错误(见 tool loop 拦截)。
# 新增成员时必须同步给 apps/web workspace-tool-executor.ts 加实现,
# scripts/check-tool-registry-integrity.mjs 负责双向对账。
# 2026-09-26 注:写成 set 字面量而非 frozenset(...) —— 守门 check-tool-registry-integrity
# 需要静态读出成员做双向对账,包一层 Call 会让可解析性失效(§「让工具能被看见」同型教训)。
_DELEGATE_ONLY_TOOLS = {"apply_patch", "create_file", "delete_file", "move_file"}

# 委托专有工具的本地等价建议(仅用于错误提示文案;不参与 _TOOL_ALIASES 归一化,
# 因为语义不等价 —— 例如 create_file 有「已存在则报错」语义,write_file 是覆盖写)。
_DELEGATE_ONLY_HINTS: dict[str, str] = {
    "apply_patch": "file_edit(按 old_string/new_string 改)或 write_file(整文件重写)",
    "create_file": "write_file(注意:它是覆盖写,覆盖语义由调用方保证)",
    "delete_file": "git_operations 或 run_command(需走命令审批)",
    "move_file": "git_operations 或 run_command(需走命令审批)",
}

# 工具名别名归一表 `_TOOL_ALIASES` 自 2026-09-26(V3 #47 第三格)起**唯一定义在**
# `app/services/mcp_server.py`(A 内核与 call_tool 归一共用同一对象),此处经顶部
# `from ..services.mcp_server import ...` 引入。扩充原则(值域必须为已注册工具、
# 写操作别名一律不收)与逐条表体都写在那一处,不得在本文件再抄第二份 ——
# 两份独立表曾让同一个别名在 llm tool loop 被归一、在 call_tool 报「未知工具」,
# 守门 scripts/check-tool-registry-integrity.mjs 的 J11 现对账全仓定义恰好 1 处。


# W1(2026-09-12 立)终端类工具集合(即计划文档所指 shell/exec/command 类别)。
# 命中时 tool loop 在执行前后分别产出 terminal_start / terminal_end SSE 事件,
# 前端 apps/web MessageItem 的 TerminalSection 据此展示命令执行区块
# (对齐 Codex 终端可视化 / Qoder 命令回放)。判断用的是 _TOOL_ALIASES 归一化后的名字。
_TERMINAL_TOOL_NAMES = {"run_command", "run_shell", "shell_command"}


def _resolve_message_id(metadata: Any) -> str | None:
    """W1(2026-09-12 立):从请求 metadata 取出前端 assistant 消息 ID。

    链路:前端 streamChat({metadata:{messageId}}) → apps/api ai-chat-stream.ts mergedMetadata
    → ai-service。plan_updated / terminal_* 事件必须携带该字段,否则前端回调的
    `if (!evt.messageId) return` 守卫会直接丢弃事件
    (apps/web/src/hooks/use-chat/send-message.ts:598)。
    """
    if isinstance(metadata, dict):
        _mid = metadata.get("messageId")
        if isinstance(_mid, str) and _mid:
            return _mid
    return None


def _build_plan_snapshot(
    tool_calls_history: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """W1(2026-09-12 立):把 tool loop 的工具调用历史构造为权威 plan 快照数组。

    单一真相源(2026-09-21 抽取):本函数同时服务两条出口 ——
    ① SSE `plan_updated` 事件(_format_plan_updated_event 的 plan 字段);
    ② 会话持久化(_fire_callback body 的 planSteps → chat_messages.metadata.planSteps)。
    两者必须逐字段等价,否则刷新页面后回放的计划会与流式期间所见不同。

    链路 A(普通对话 /api/ai/chat/stream)此前没有任何 plan 生产者,
    前端只能基于 reasoning/toolCalls/content 伪派生步骤
    (apps/web/src/components/chat/message-list/use-message-list-derivations.ts)。
    本函数把 tool loop 的每次工具调用作为权威计划快照发出。

    协议升级(2026-09-19):与 packages/types/src/ai.ts 的 PlanUpdateEvent 对齐,
    plan[] 每步在 step/status/durationMs 之外新增可选字段:

    - id: 步骤唯一 ID,优先取记录的 toolCallId(strip 处理与 tool-call-start
      事件一致),缺失时回退 f"step-{i}"(i 为序号)
    - toolCallIds: 关联工具调用 ID 数组(仅当 toolCallId 存在时携带)
    - startedAt / endedAt: ISO 8601 起止时间戳(仅当记录中存在时携带)
    - error: 布尔失败标记,仅失败步骤携带("error": true)

    status 五态判定(plan[].status 允许 pending / in_progress / completed /
    skipped / failed,本函数产出 in_progress / completed / failed 三态):
    - result 为 None → in_progress(工具执行中)
    - result 存在且记录 isError → failed(附 "error": true)
    - result 存在无 error → completed

    空历史返回空数组:调用方据此决定不发 SSE 帧、不写 metadata 字段
    (避免用空 plan 把前端 message.planSteps / 已落库计划清空)。
    """
    if not tool_calls_history:
        return []
    _steps: list[dict[str, Any]] = []
    for _i, _rec in enumerate(tool_calls_history):
        # 容错:调用方历史数组可能混入非 dict 脏记录(与 _build_persisted_tool_calls
        # 同口径跳过),不得让 SSE 事件或回调落库因此抛 AttributeError
        if not isinstance(_rec, dict):
            continue
        _done = _rec.get("result") is not None
        _failed = _done and bool(_rec.get("isError"))
        _name = str(_rec.get("toolName") or "tool")
        # 步骤标签:工具名 + 关键参数摘要(命令/查询/路径等),便于用户辨识这一步在做什么
        _label = _name
        _args = _rec.get("args")
        if isinstance(_args, dict):
            for _k in ("command", "query", "path", "file", "url", "pattern", "name"):
                _v = _args.get(_k)
                if isinstance(_v, str) and _v.strip():
                    _label = f"{_name}: {_v.strip()[:80]}"
                    break
        # 步骤唯一 ID:优先 toolCallId(strip 与 tool-call-start 事件一致),缺失回退 step-{i}
        _tc_id = str(_rec.get("toolCallId") or "").strip()
        _step_id = _tc_id or f"step-{_i}"
        if _failed:
            _status = "failed"
        elif _done:
            _status = "completed"
        else:
            _status = "in_progress"
        _step: dict[str, Any] = {
            "step": _label,
            "id": _step_id,
            "status": _status,
        }
        # 关联工具调用 ID 数组(仅当 toolCallId 存在)
        if _tc_id:
            _step["toolCallIds"] = [_tc_id]
        # 失败步骤显式携带 error: true(前端 PlanStepsCard 渲染失败态)
        if _failed:
            _step["error"] = True
        # ISO 8601 起止时间戳透传(仅当记录中存在)
        _started_at = _rec.get("startedAt")
        if isinstance(_started_at, str) and _started_at:
            _step["startedAt"] = _started_at
        _ended_at = _rec.get("endedAt")
        if isinstance(_ended_at, str) and _ended_at:
            _step["endedAt"] = _ended_at
        if _done:
            _dur = _rec.get("durationMs")
            if isinstance(_dur, int) and _dur >= 0:
                _step["durationMs"] = _dur
        _steps.append(_step)

    return _steps


def _format_plan_updated_event(
    tool_calls_history: list[dict[str, Any]],
    *,
    explanation: str,
    message_id: str | None,
) -> str:
    """W1(2026-09-12 立):把 tool loop 历史格式化为 plan_updated SSE 事件帧。

    plan 快照由 _build_plan_snapshot 统一构造(与落库的 metadata.planSteps 同源)。
    空快照返回空串:调用点可无条件 yield(空串不产生 SSE 输出),同时避免发出
    空 plan 数组把前端 message.planSteps 清空。
    """
    _steps = _build_plan_snapshot(tool_calls_history)
    if not _steps:
        return ""

    _evt: dict[str, Any] = {
        "type": "plan_updated",
        "plan": _steps,
        "explanation": explanation,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if message_id:
        _evt["messageId"] = message_id
    # D174:此前这一帧自己拼 f-string、绕过帧工厂 ⇒ 它是"72 个站点之外"的漏网帧之一,
    # 单点注入对它不成立。改走 `_sse` 后**线格式逐字节不变**(同一 dict、同一段
    # `json.dumps(..., ensure_ascii=False)`、同一个 `\n\n` 结尾),只是多经过一次工厂。
    return _sse("plan_updated", _evt)


def _sse_contract_enabled() -> bool:
    """批58(接线):SSE 契约校验开关 —— 默认 off(与接线前逐字节等价)。

    开启后按 app/core/sse_contract.py 的 SSE_EVENT_CONTRACTS 校验事件名与 payload
    必填字段,漂移只告警(不改写帧内容、不阻断流式输出)。
    """
    return os.environ.get("SSE_CONTRACT_VALIDATE_ENABLED", "false").strip().lower() in (
        "on",
        "1",
        "true",
        "yes",
    )


# 帧级 traceId 注入点已提升到 `app/core/sse_frames.py`(单一实现):其余拼帧路径(agents 流、
# 官方 MCP 流)也要走同一份,不能在各自路由里再抄一遍判序 —— 抄开的症状是"主对话流的帧带 trace、
# 任务流的帧不带"。这里保留原函数名作为别名,既有调用点与用例一字未改。
_with_frame_trace_id = with_frame_trace_id


def _sse(evt: str, payload: Any) -> str:
    """SSE 帧构造(事件契约 agent_events.SSE_* 单一事实源)。

    批58(接线):开关开启时经 sse_contract 做跨端契约漂移诊断(仅告警)。
    D174(2026-09-30):帧级 traceId 在这里注入一次(判序见 `_with_frame_trace_id`)。
    """
    if _sse_contract_enabled():
        try:
            from app.core.sse_contract import SSE_EVENT_CONTRACTS

            contract = next((c for c in SSE_EVENT_CONTRACTS if c.name == evt), None)
            if contract is None:
                _sse_contract_warn(f"SSE 事件未在契约清单中登记: {evt}")
            elif isinstance(payload, dict):
                missing = [f for f in contract.payload_fields if f not in payload]
                if missing:
                    _sse_contract_warn(
                        f"SSE 事件 {evt} 缺少契约字段 {missing}",
                    )
        except Exception as e:  # noqa: BLE001 - 契约诊断失败不影响帧产出
            _sse_contract_warn(f"SSE 契约诊断异常(降级跳过): {e}")
    return f"event: {evt}\ndata: {json.dumps(_with_frame_trace_id(evt, payload), ensure_ascii=False)}\n\n"


def _sse_contract_warn(msg: str) -> None:
    """契约漂移告警(warnings 通道,不阻断流式输出)。"""
    import warnings

    warnings.warn(msg, RuntimeWarning, stacklevel=3)


# 终端输出随帧/随记录落库的字符上限(超出必须带 truncated + totalChars 交代)
TERMINAL_OUTPUT_LIMIT = 8000

# injection_applied 的 fullText 上限:超出就**整字段不发**(而不是发一段截断文本冒充全文),
# 前端据此不给展开入口 —— "没有可看的内容"和"内容太长不在流里传"是两回事,但都不能骗人。
INJECTION_FULLTEXT_LIMIT = 4000


def _extract_terminal_output(exec_result: Any) -> tuple[str, int | None]:
    """D24(2026-09-19 立):从 run_command 类执行结果提取 (output, exit_code)。

    原 _format_terminal_end_event 的内联提取逻辑抽为独立函数,
    供 SSE 事件构造与持久化记录构造(_build_terminal_task)共用(单一事实源)。
    run_command handler 返回 {exit_code, stdout, stderr, output?},此处合并为 output。
    """
    _output = ""
    _exit_code: int | None = None
    if isinstance(exec_result, dict):
        _raw_output = exec_result.get("output")
        if isinstance(_raw_output, str) and _raw_output:
            _output = _raw_output
        else:
            _stdout = exec_result.get("stdout")
            _stderr = exec_result.get("stderr")
            _output = "\n".join(
                _p for _p in (
                    _stdout if isinstance(_stdout, str) else "",
                    _stderr if isinstance(_stderr, str) else "",
                ) if _p
            )
        _ec = exec_result.get("exit_code", exec_result.get("exitCode"))
        if isinstance(_ec, int):
            _exit_code = _ec
    return _output, _exit_code


def _clip_terminal_output(output: str) -> tuple[str, bool, int]:
    """终端输出截断,返回 (可见文本, 是否截断, 原始字符数)。

    截断标志与原始长度**必须随帧/随记录一起下发**:SSE 与落库都只带截断后的文本,
    刷新/回放时客户端没有 live 缓冲可比对,长度相等就看不出"后面还有内容没显示"
    (对标 Codex/Trae 的 truncated + 总长度口径)。
    """
    total = len(output)
    if total <= TERMINAL_OUTPUT_LIMIT:
        return output, False, total
    return output[:TERMINAL_OUTPUT_LIMIT], True, total


def _format_terminal_end_event(
    terminal_id: str,
    exec_result: Any,
    ok: bool,
    started_ms: float,
    message_id: str | None,
) -> str:
    """W1(2026-09-12 立):把 run_command 类工具的执行结果格式化为 terminal_end SSE 事件。

    字段与 packages/types/src/ai.ts 的 TerminalEndEvent 严格对齐
    (注意契约字段是 `terminalId`,不是 `id`)。
    提取逻辑复用 _extract_terminal_output(D24 抽取,与持久化记录同源)。
    """
    _output, _exit_code = _extract_terminal_output(exec_result)

    _evt: dict[str, Any] = {
        "type": "terminal_end",
        "terminalId": terminal_id,
        "status": "completed" if ok else "failed",
        "endedAt": datetime.now(UTC).isoformat(),
        "durationMs": int((time.time() - started_ms) * 1000),
    }
    if _output:
        # 截断:超出上限时同时交代 truncated + totalChars(回放无 live 缓冲,只靠长度看不出来)
        _shown, _truncated, _total = _clip_terminal_output(_output)
        _evt["output"] = _shown
        _evt["totalChars"] = _total
        if _truncated:
            _evt["truncated"] = True
    if _exit_code is not None:
        _evt["exitCode"] = _exit_code
    if message_id:
        _evt["messageId"] = message_id
    # D151 验收②:"terminal_end 之前若有交互,必须有交互计数(不得静默)"。计数原本只活在
    # tool-result 的 dict 里 —— 模型看得见、用户看不见,而"我刚才替它答过一次"恰恰是用户
    # 复盘这条命令时的第一个问题。仅在 >0 时下发,零交互的旧帧形状一字不变。
    if isinstance(exec_result, dict):
        _inter = exec_result.get("interactionCount")
        if isinstance(_inter, int) and _inter > 0:
            _evt["interactionCount"] = _inter
    return _sse(SSE_TERMINAL_END, _evt)


def _build_terminal_task(
    terminal_id: str,
    exec_result: Any,
    ok: bool,
    started_ts: float,
    command: str,
) -> dict[str, Any]:
    """D24(2026-09-19 立):构造可持久化的终端任务记录(terminalTasks 数组元素)。

    结构与 packages/types/src/ai.ts 的 TerminalTask 对齐
    (id/command/status/output/startedAt/endedAt/durationMs/exitCode)。
    在各 terminal_end SSE 产出点同步收集,随 _fire_callback 落库到
    chat_messages.metadata.terminalTasks,恢复会话/回放/审计时还原终端区。
    output 沿用 SSE 事件的 8000 字符截断,防 metadata 体积膨胀。
    """
    _output, _exit_code = _extract_terminal_output(exec_result)
    _rec: dict[str, Any] = {
        "id": terminal_id,
        "command": str(command or ""),
        "status": "completed" if ok else "failed",
        "startedAt": datetime.fromtimestamp(started_ts, tz=UTC).isoformat(),
        "endedAt": datetime.now(UTC).isoformat(),
        "durationMs": int((time.time() - started_ts) * 1000),
    }
    if _output:
        # 与 SSE 帧同一截断口径:落库记录也必须带 truncated + totalChars,
        # 否则刷新/回放后界面把 8000 字符当作完整输出(与 SSE 侧同一个缺陷)。
        _shown, _truncated, _total = _clip_terminal_output(_output)
        _rec["output"] = _shown
        _rec["totalChars"] = _total
        if _truncated:
            _rec["truncated"] = True
    if _exit_code is not None:
        _rec["exitCode"] = _exit_code
    return _rec


def _wrap_ok(data: Any, message: str = "ok") -> dict[str, Any]:
    """统一 {code, message, data} 响应信封(AGENTS.md §5 项目约定)。

    ai-service Dashboard 端点(GET /llm/providers/health、GET/POST/DELETE /llm/combos、
    POST /llm/compaction/demo、GET /llm/free-providers)使用此 helper 包装成功响应,
    以兼容前端 packages/api-client 的 fetchApi(其 fetchOnce 强制检查 json.code === 0)。

    注:/llm/complete 与 /llm/complete/stream 不使用此信封,因为它们的响应结构是
    LLM 结果对象(含 content/model/usage/tool_calls 等),已被多个内部服务(api 代理、
    crew-llm-adapter、ai-feed-service 等)依赖为契约,改信封会破坏兼容。
    """
    return {"code": 0, "message": message, "data": data}


def _error_json(message: str, status_code: int, **extra: Any) -> JSONResponse:
    """统一错误响应(带 message 字段供 fetchApi 的 fetchOnce 提取)。

    fetchApi 在 !response.ok 时会尝试 JSON.parse 并提取 parsed.message 作为错误信息,
    所以错误响应必须含 message 字段(而非 error 字段),否则前端只能拿到"请求失败(400)"。
    """
    payload: dict[str, Any] = {"code": 1, "message": message}
    payload.update(extra)
    return JSONResponse(status_code=status_code, content=payload)

# 默认模型清单 JSON 文件路径(运行时按需加载,修改无需重启)
_DEFAULT_MODELS_FILE = Path(__file__).resolve().parent.parent / "data" / "default_models.json"


# ===== 工具来源派生(2026-07-31 立,A2 任务:ToolCallCard 区分原生/MCP/插件工具)=====
# _BUILTIN_AGENT_TOOLS:核心 builtin 工具名集合(对标 apps/web/src/hooks/use-chat.ts 的 AGENT_TOOLS,
#   剔除 browser_*/computer_*——这些属于插件接入类,由 _PLUGIN_TOOL_NAMES 覆盖)。
# _PLUGIN_TOOL_NAMES:插件市场接入的工具名集合(对标 use-chat.ts 的 PLUGIN_ID_TO_TOOLS 反查表,
#   browser_* 由 playwright-mcp/puppeteer/browser-use 等 13 个浏览器插件共用,
#   computer_* 由 anthropic-computer-use/open-interpreter/auto-gpt/babyagi 等 4 个电脑控制插件共用)。
# _MCP_TOOL_NAMES:mcp_server.py 注册表中的全部工具名(模块加载时求值一次)。
_BUILTIN_AGENT_TOOLS: frozenset[str] = frozenset({
    "read_file", "search_codebase", "file_search", "analyze_code", "generate_test",
    "web_search", "search_web", "vision_analyze", "knowledge_lookup", "dispatch_subagent",
    "summarize_artifacts", "proactive_suggestion",
})
_PLUGIN_TOOL_NAMES: frozenset[str] = frozenset({
    # 12 browser tools(所有浏览器类插件共用)
    "browser_screenshot", "browser_click_element", "browser_type_text", "browser_scroll",
    "browser_navigate", "browser_extract_dom", "browser_wait_for_element",
    "browser_get_attribute", "browser_hover", "browser_select_option",
    "browser_switch_tab", "browser_close_tab",
    # 10 computer tools(所有电脑控制类插件共用)
    "computer_screenshot_screen", "computer_mouse_move", "computer_mouse_click",
    "computer_keyboard_type", "computer_mouse_scroll", "computer_keyboard_press",
    "computer_keyboard_hotkey", "computer_active_window",
    "computer_clipboard_get", "computer_clipboard_set",
})
_MCP_TOOL_NAMES: set[str] = get_registered_tool_names()


def resolve_tool_source(tool_name: str) -> tuple[str, str | None, str | None]:
    """派生工具来源(2026-07-31 立,为 tool-call-start/tool-result SSE 事件提供 serverSource 字段)。

    派生规则(按优先级,命中即返回):
    1. tool_name 在 _BUILTIN_AGENT_TOOLS(核心 builtin 工具)→ ('builtin', None, None)
    2. tool_name 在 _PLUGIN_TOOL_NAMES(插件接入类 browser_*/computer_*)→ ('plugin', None, None)
       注:plugins 不区分具体 server,serverId/serverName 为 None。
    3. tool_name 在 _MCP_TOOL_NAMES(mcp_server 注册表)→ ('mcp', None, None)
       注:当前所有工具均为本地实现,server_id/server_name 暂为 None;
       未来接入外部 MCP server(如 context7/filesystem)后扩展为返回真实 server 信息。
    4. 兜底 → ('builtin', None, None)

    Returns:
        tuple (serverSource, serverId, serverName):
        - serverSource: 'builtin' | 'plugin' | 'mcp'
        - serverId: serverSource='mcp' 时为外部 MCP server ID,否则 None
        - serverName: serverSource='mcp' 时为外部 MCP server 显示名,否则 None
    """
    if tool_name in _BUILTIN_AGENT_TOOLS:
        return ("builtin", None, None)
    if tool_name in _PLUGIN_TOOL_NAMES:
        return ("plugin", None, None)
    if tool_name in _MCP_TOOL_NAMES:
        return ("mcp", None, None)
    return ("builtin", None, None)


# ===== tool-summary SSE 事件聚合统计(2026-07-31 立,A2 任务:AI 对话可视化深度接入)=====

# 口径归属(G-415 A9,2026-10-01):下面这两个函数是「行改动统计」的**权威实现**,
# 前端 `apps/web/src/lib/py-line-count.ts` 复刻它们(签名差一层:本侧收 tool_call,
# 前端收 args)。此前那句"复刻"只有注释在担保,现读量到过真漂移(JS 侧漏抄
# \x1c \x1d \x1e 三枚行边界,同一串两侧行数不等)。常驻尺子 =
# `scripts/check-line-split-parity.mjs`(两侧都真求值,逐例并排),问责档
# `--strict`。**改这里的分支次序或 splitlines 用法,必须同笔改那份 TS 实现并跑该门**
# —— 只改一侧不会有任何编译期症状,只会让前后端在同一个位置显示两个数。
def calculate_added_lines(tool_call: dict[str, Any]) -> int:
    """从 tool_call 的 args 中提取新增行数(用于 tool-summary 的 linesAdded 统计)。

    实现策略(先简单实现,后续可扩展):
    - args 含 `diff` 字符串:统计以 `+` 开头但不以 `+++` 开头的行数(unified diff 的 added 行)
    - args 含 `content` 字符串:统计行数(整体写入,全部算 added)
    - args 含 `new_string` 字符串(file_edit 工具):统计 new_string 行数
    - 其他:返回 0
    """
    args = tool_call.get("args") or {}
    if not isinstance(args, dict):
        return 0
    diff = args.get("diff")
    if isinstance(diff, str) and diff:
        return sum(
            1 for line in diff.splitlines()
            if line.startswith("+") and not line.startswith("+++")
        )
    content = args.get("content")
    if isinstance(content, str) and content:
        return len(content.splitlines())
    new_string = args.get("new_string")
    if isinstance(new_string, str) and new_string:
        return len(new_string.splitlines())
    return 0


def calculate_deleted_lines(tool_call: dict[str, Any]) -> int:
    """从 tool_call 的 args 中提取删除行数(用于 tool-summary 的 linesDeleted 统计)。

    实现策略:
    - args 含 `diff` 字符串:统计以 `-` 开头但不以 `---` 开头的行数(unified diff 的 deleted 行)
    - args 含 `old_string` 字符串(file_edit 工具):统计 old_string 行数
    - args 含 `content` 字符串(write_file 整体写入,无删除):返回 0
    - 其他:返回 0
    """
    args = tool_call.get("args") or {}
    if not isinstance(args, dict):
        return 0
    diff = args.get("diff")
    if isinstance(diff, str) and diff:
        return sum(
            1 for line in diff.splitlines()
            if line.startswith("-") and not line.startswith("---")
        )
    old_string = args.get("old_string")
    if isinstance(old_string, str) and old_string:
        return len(old_string.splitlines())
    return 0


def _build_tool_summary(tool_calls_history: list[dict[str, Any]]) -> dict[str, Any] | None:
    """聚合本轮所有工具调用统计(用于 tool-summary SSE 事件)。

    Returns:
        包含 filesSearched/webSearched/filesModified/linesAdded/linesDeleted/
        toolsByCategory/totalCalls/totalDurationMs 的统计 dict,无工具调用时返回 None。
    """
    if not tool_calls_history:
        return None
    _FILE_SEARCH_TOOLS = frozenset({"read_file", "search_codebase", "file_search"})
    _WEB_SEARCH_TOOLS = frozenset({"web_search", "search_web"})
    _FILE_MODIFY_TOOLS = frozenset({"file_edit", "write_file"})
    files_modified: set[str] = set()
    for tc in tool_calls_history:
        if tc.get("toolName") in _FILE_MODIFY_TOOLS:
            args = tc.get("args") or {}
            if isinstance(args, dict):
                fp = args.get("file_path") or args.get("path")
                if isinstance(fp, str) and fp:
                    files_modified.add(fp)
    return {
        "filesSearched": sum(
            1 for tc in tool_calls_history if tc.get("toolName") in _FILE_SEARCH_TOOLS
        ),
        "webSearched": sum(
            1 for tc in tool_calls_history if tc.get("toolName") in _WEB_SEARCH_TOOLS
        ),
        "filesModified": len(files_modified),
        "linesAdded": sum(
            calculate_added_lines(tc)
            for tc in tool_calls_history
            if tc.get("toolName") in _FILE_MODIFY_TOOLS
        ),
        "linesDeleted": sum(
            calculate_deleted_lines(tc)
            for tc in tool_calls_history
            if tc.get("toolName") in _FILE_MODIFY_TOOLS
        ),
        "toolsByCategory": dict(Counter(tc.get("toolName", "") for tc in tool_calls_history)),
        "totalCalls": len(tool_calls_history),
        "totalDurationMs": sum(int(tc.get("durationMs", 0) or 0) for tc in tool_calls_history),
    }


def _format_tool_summary_event(tool_calls_history: list[dict[str, Any]]) -> str | None:
    """构造 tool-summary SSE 事件字符串,无工具调用时返回 None(避免无意义事件)。"""
    summary = _build_tool_summary(tool_calls_history)
    if summary is None:
        return None
    # D174:同 plan_updated —— 改走帧工厂后线格式逐字节不变,但单点注入对它成立了。
    return _sse("tool-summary", summary)



def _citation_url(source: Any, raw: Any) -> str | None:
    """从命中元数据里取**真实**存在的跳转目标,取不到就返回 None(绝不合成链接)。

    - 任意源:raw 里显式给了 url 就用;
    - codebase:给仓库相对路径 —— web 端 CitationBar 把非 http/非 # 的 url 交给 WorkPanel 打开,
      因此文件路径就是可用的溯源深链;小程序/终端不渲染链接,不受影响。
    """
    if not isinstance(raw, dict):
        return None
    url = raw.get("url")
    if isinstance(url, str) and url.strip():
        return url.strip()
    if source == "codebase":
        file_path = raw.get("file_path") or raw.get("path")
        if isinstance(file_path, str) and file_path.strip():
            return file_path.strip().lstrip("/\\")
    return None


def _collect_citations(tool_calls_history: list[dict[str, Any]]) -> list[dict[str, str]]:
    """#11 Citations 全链路(2026-09-13 立):从 tool_calls_history 提取 knowledge_lookup
    的引用溯源条目,按 (source, label) 去重,最多 10 条避免事件体积膨胀。
    第 50 轮补:命中元数据里**确实存在**的 url / 仓库相对路径一并带出(web 据此可点击溯源),
    没有就不发该键 —— 不给界面一个点不动的"假链接"。"""
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, str]] = []
    for tc in tool_calls_history:
        if tc.get("toolName") != "knowledge_lookup" or tc.get("isError"):
            continue
        result = tc.get("result")
        if not isinstance(result, dict):
            continue
        hits = result.get("hits")
        if not isinstance(hits, list):
            continue
        for h in hits:
            if not isinstance(h, dict):
                continue
            source = h.get("source") or "knowledge"
            url = _citation_url(source, h.get("raw"))
            for c in h.get("citations") or []:
                if not isinstance(c, str) or not c.strip():
                    continue
                label = c.strip()[:200]
                key = (str(source), label)
                if key in seen:
                    continue
                seen.add(key)
                entry = {"source": str(source), "label": label}
                if url:
                    entry["url"] = url
                out.append(entry)
                if len(out) >= 10:
                    return out
    return out


def _note_retry(sink: list[dict[str, Any]], evt: dict[str, Any]) -> None:
    """把网关的 retry_scheduled 帧记进累加器(只认契约声明的四字段,类型不符就不记)。

    D39/G-44 的界面交代靠 SSE 实时下发;本函数只为**持久化**服务 —— 没有它,
    刷新页面后"这轮上游重试过几次"就查不到了(与 citations/injections/compaction 同一族)。
    """
    if evt.get("type") != "retry_scheduled":
        return
    attempt = evt.get("attempt")
    max_retries = evt.get("maxRetries")
    if not isinstance(attempt, int) or not isinstance(max_retries, int):
        return
    retry_in_ms = evt.get("retryInMs")
    http_status = evt.get("httpStatus")
    sink.append(
        {
            "attempt": attempt,
            "maxRetries": max_retries,
            "retryInMs": retry_in_ms if isinstance(retry_in_ms, int) else 0,
            **({"httpStatus": http_status} if isinstance(http_status, int) else {}),
        }
    )


def _compaction_payload(info: dict[str, Any] | None) -> dict[str, Any] | None:
    """构造 compaction 载荷 —— SSE 帧与落库字段的**同一真相源**。

    无需交代时返回 None:未压缩且没撞上限就不该留痕(与 _compaction_frame 同判据)。
    G-166:此前只有 SSE 帧这一条出口,刷新页面 / 重拉历史后压缩分隔线整段消失。
    """
    if not info:
        return None
    trigger = str(info.get("trigger") or "")
    compressed = bool(info.get("compressed"))
    if not compressed and trigger != "incompressible":
        return None
    return {
        "triggered": True,
        "tokensBefore": info.get("original_tokens", 0),
        "tokensAfter": info.get("compressed_tokens", 0),
        "removedCount": info.get("removed_count", 0),
        "usageRatio": info.get("usage_ratio", 0),
        "trigger": trigger or "llm",
    }


def _compaction_frame(info: dict[str, Any] | None) -> str | None:
    """构造 compaction SSE 帧;无需交代时返回 None。

    G-150(WorkBuddy 一手对标):过去只在 `compressed=True` 时发帧,**压缩撞到上限
    (incompressible:system/material 本身过大,截到最小仍超阈值)时用户完全无感** ——
    界面上只是"回答变慢/变笨",而竞品会直说"已达上限,建议开新对话或减少上下文"。
    现在 incompressible 同样发帧,并把 `trigger` 带出去供各端区分措辞与给动作。

    载荷构造在 `_compaction_payload`(与落库字段同一真相源),本函数只负责包帧。
    """
    payload = _compaction_payload(info)
    if payload is None:
        return None
    return f"data: {json.dumps({'compaction': payload}, ensure_ascii=False)}\n\n"


def _format_citations_event(
    tool_calls_history: list[dict[str, Any]], message_id: str | None = None
) -> str | None:
    """构造 citations SSE 事件字符串,无引用时返回 None(避免无意义事件)。

    前端 streamChat 的 onCitations 回调解析后写入 ChatMessage.citations,
    MessageItem 渲染 CitationBar(来源标签 + 可点击 URL)。"""
    citations = _collect_citations(tool_calls_history)
    if not citations:
        return None
    evt: dict[str, Any] = {"type": "citations", "citations": citations}
    if message_id:
        evt["messageId"] = message_id
    # D174:同上,改走帧工厂(线格式逐字节不变)。
    return _sse("citations", evt)


# =============================================================================
# P1 #27(2026-09-16 立):记忆更新可视化 —— done 前同步提取本轮新增 LTM 条目
# =============================================================================

# 记忆提取最大等待时长(秒)。超时即降级为空数组,绝不拖住 done 事件下发;
# 前端「已记住」提示条为增强信息,缺失不影响对话主链路。
MEMORY_EXTRACT_TIMEOUT_S = 6.0
# 提取出的摘要文本上限(与 memory_service 的 text[:2000] 对齐,避免事件体积膨胀)
MEMORY_ITEM_MAX_CHARS = 200
# 单轮最多回传条数(前端提示条只展示首条 + 计数,多传无收益)
MEMORY_ITEMS_MAX = 5


async def _extract_memory_updates(
    *,
    owner_uuid: str | None,
    conversation_id: str | None,
    user_messages: list[dict[str, Any]],
    assistant_content: str,
) -> list[str]:
    """P1 #27:在 done 事件前同步提炼本轮对话的长期记忆条目,回传前端「已记住」提示条。

    背景(时序矛盾):主聊天走 /llm/complete/stream,该通道此前无任何 LTM 写入
    能力;LTM 提取仅存在于 agent 通道(agent_loop_v2._persist_memory_insights /
    consolidate),且均为 done 之后的 fire-and-forget,故 done 时点必然拿不到数据。

    方案:在本通道把「提炼」前移到 done 之前同步执行(带超时/异常双降级),产出与
    agent 通道同源的记忆条目,既补齐主聊天的记忆能力,又让 done.memoryUpdates 有真实内容:

    1. stub 模式(无 LLM key)→ 直接返回 [](零成本,不发起任何调用)
    2. 用户隐私开关 autoMemory=false → 返回 [](与 consolidate 同一开关,尊重用户选择)
    3. LLM 提炼 1-3 句长期记忆摘要 → 写入 semantic 层(与 consolidate 同路径)
    4. 回传条目摘要给 done 事件 → 前端 MessageItem 渲染「已记住」提示条

    全部异常 / 超时均降级为 [](logger.warning),不阻塞、不改变对话结果。
    """
    if not owner_uuid or not user_messages:
        return []

    try:
        from ..core.llm_gateway import LLMGateway
        from ..services.memory_service import memory_service

        # 1. stub 模式零成本短路(与 consolidate 一致)
        if LLMGateway._is_stub_mode():
            return []
        # 2. 用户隐私开关:autoMemory=false 时不记忆(与 consolidate 一致)
        if not await memory_service._is_auto_memory_enabled(owner_uuid):
            return []

        # 3. 组装对话文本(user + assistant,截断 8000 与 consolidate 一致)
        lines: list[str] = []
        for m in user_messages:
            role = str(m.get("role", ""))
            content = str(m.get("content", "")).strip()
            if role in ("user", "assistant") and content:
                lines.append(f"{role}: {content}")
        if assistant_content.strip():
            lines.append(f"assistant: {assistant_content.strip()}")
        conversation_text = "\n".join(lines)[-8000:]
        if not conversation_text.strip():
            return []

        # 4. LLM 同步提炼(带超时;超时降级空数组,不拖住 done)
        summarize_messages = [
            {
                "role": "system",
                "content": (
                    "你是记忆提炼助手。从对话中提炼值得长期记住的用户信息,包括:\n"
                    "- 用户长期事实:职业、所在城市、技术栈、身份背景等\n"
                    "- 用户偏好:喜欢/不喜欢的风格、工具、语言、使用习惯\n"
                    "- 已完成事项:重要决策、项目结论、双方确认过的约定\n\n"
                    "只提炼明确、可复用、有价值的信息,忽略一次性任务细节和临时上下文。\n"
                    "用 1-3 句简洁中文概括,直接输出文本,不要 JSON,不要任何前缀。\n"
                    "若本轮对话确实没有值得长期记住的信息,只输出:无"
                ),
            },
            {
                "role": "user",
                "content": f"对话内容:\n{conversation_text}\n\n请提炼长期记忆摘要:",
            },
        ]
        result = await asyncio.wait_for(
            memory_service._gateway.complete(
                summarize_messages, model=settings.litellm_model
            ),
            timeout=MEMORY_EXTRACT_TIMEOUT_S,
        )
        summary = str(result.get("content", "")).strip()
        if not summary or summary in ("无", "没有", "[]"):
            return []

        item = summary[:MEMORY_ITEM_MAX_CHARS]

        # 5. 写入 semantic 层(与 consolidate 同路径;写入失败不阻塞,仍回传条目)
        try:
            await memory_service.add_semantic(
                owner_uuid,
                item,
                importance_score=0.7,
                metadata={
                    "source": "chat_stream_sync",
                    "layer": "episodic_to_semantic",
                    **({"sessionId": conversation_id} if conversation_id else {}),
                },
            )
        except Exception as e:
            logger.warning("memoryUpdates 写入 semantic 失败(降级,仍回传条目): %s", e)

        # P3 #41 记忆图谱(2026-09-16 立):记忆写入后异步触发关系抽取(fire-and-forget,
        # 失败不影响主流程;抽取结果写 agent_memory_edges,供子图查询/前端可视化)。
        from ..services.memory_graph import fire_and_forget_extract

        fire_and_forget_extract(owner_uuid)

        return [item][:MEMORY_ITEMS_MAX]
    except TimeoutError:
        logger.warning(
            "memoryUpdates 提取超时(>%ss,降级为空),user=%s",
            MEMORY_EXTRACT_TIMEOUT_S,
            owner_uuid,
        )
        return []
    except Exception as e:
        logger.warning("memoryUpdates 提取失败(降级为空): %s", e)
        return []


def _escape_xml_attr(value: str) -> str:
    """XML 属性转义(repo 标签属性防注入)。"""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _inject_repo_wiki(
    messages: list[dict[str, Any]],
    wiki_context: str | None,
    wiki_repo: str | None = None,
) -> list[dict[str, Any]]:
    """P1-8(2026-09-13 立,Repo Wiki):将「项目百科」摘要注入为 system message。

    独立实现,不改动 _inject_workspace_memory 的任何行为。语义与工作区记忆同型:
    - wiki_context 为空/纯空白 → 原样返回 messages
    - messages[0].role == 'system' → 追加到现有 system content 末尾
    - messages 无 system → 在开头 insert 一条新 system message
    - 用 <repo_wiki repo="...">...</repo_wiki> 包裹正文(repo 值做 XML 属性转义,防注入)
    - 去重 marker:<!-- repo_wiki:{repo} -->(repo 为空时用 unknown),
      目标 system content 中已存在该 marker 则原样返回 messages
    - 不修改入参列表本身(拷贝后返回)

    2026-09-15 恢复说明:并行会话重写本文件时该函数与两处调用点丢失,
    W29 Repo Wiki 对话注入随之失效(test_repo_wiki_injection 7 例实证),此处按基线原样移植。

    Args:
        messages: 原始消息列表
        wiki_context: 项目百科正文(为空/纯空白时跳过)
        wiki_repo: 仓库名(None/空 → 标签与 marker 用 'unknown')

    Returns:
        注入项目百科后的新消息列表(不修改原列表)
    """
    if not wiki_context or not str(wiki_context).strip():
        return messages
    repo_label = (wiki_repo or "").strip() or "unknown"
    marker = f"<!-- repo_wiki:{repo_label} -->"
    body = (
        "以下为该项目自动生成的「项目百科」(Repo Wiki)摘要,"
        "可作为回答代码/架构问题的权威背景:\n\n"
        f"{wiki_context}"
    )
    isolated = (
        f'<repo_wiki repo="{_escape_xml_attr(repo_label)}">\n'
        f"{body}\n"
        f"</repo_wiki>"
    )
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        if marker in str(existing):
            return messages
        merged = f"{existing}\n\n{marker}\n{isolated}" if existing else f"{marker}\n{isolated}"
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        # 新插入的 system 也带上 marker,保证二次调用可命中去重
        new_messages.insert(0, {"role": "system", "content": f"{marker}\n{isolated}"})
    return new_messages


def _inject_workspace_memory(
    messages: list[dict[str, Any]],
    workspace_path: str | None,
    workspace_context: str | None = None,
) -> list[dict[str, Any]]:
    """将工作区项目记忆注入为 system message。

    两种来源(优先级:workspace_context > workspace_path):
    1. workspace_context(2026-08-02 立,阶段 1):浏览器端用 FileSystemDirectoryHandle
       预加载的工作区文件内容(目录树 + 关键文件),直接注入,跳过文件系统读取。
       适用于 web 非 Tauri 环境(ai-service 在远程服务器访问不到用户本地文件)。
    2. workspace_path:后端从文件系统读取 CLAUDE.md/AGENTS.md/.ihui/memory.md。
       适用于 Tauri 桌面端(ai-service 在本地,能访问真实路径)。

    行为(参考 Claude Code CLAUDE.md 机制):
    - 两者都为 None → 原样返回 messages
    - messages[0].role == 'system' → 把项目记忆追加到现有 system content 后面
    - messages 无 system → 在开头插入新 system message

    Args:
        messages: 原始消息列表
        workspace_path: 工作区路径(None 时跳过文件系统读取)
        workspace_context: 浏览器端预加载的工作区文件内容(优先于 workspace_path)

    Returns:
        注入项目记忆后的新消息列表(不修改原列表)
    """
    # 1. 优先用 workspace_context(浏览器端预加载,直接注入)
    if workspace_context:
        # 附加引导:告知 LLM 文件已预加载,无需调 read_file 等工具
        memory_content = (
            "以下为工作区文件的预加载内容(由浏览器端 FileSystemDirectoryHandle 读取)。\n"
            "你可以直接引用这些文件内容回答问题,无需调用 read_file / search_codebase 等工具。\n"
            "如需读取未在预加载范围内的文件,请告知用户该文件未被预加载。\n\n"
            f"{workspace_context}"
        )
        workspace_label = "browser-context"
    elif workspace_path:
        memory_content = build_system_prompt(workspace_path=workspace_path)
        # 项目记忆服务返回的内容已包含默认 system prompt 前缀,直接拼接即可
        if not memory_content:
            return messages
        workspace_label = workspace_path
    else:
        return messages

    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        # 避免重复注入(同一 workspace 已注入过则跳过)
        marker = f"<!-- workspace:{workspace_label} -->"
        if marker in str(existing):
            return messages
        # 用 XML 隔离标签包裹工作区记忆,防 prompt injection:
        # 明确告知 LLM 这部分是"项目上下文"而非用户指令,降低被注入指令劫持的风险
        isolated_memory = (
            f"<workspace_memory path=\"{workspace_label}\">\n"
            f"{memory_content}\n"
            f"</workspace_memory>"
        )
        merged = f"{existing}\n\n{marker}\n{isolated_memory}" if existing else isolated_memory
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        isolated_memory = (
            f"<workspace_memory path=\"{workspace_label}\">\n"
            f"{memory_content}\n"
            f"</workspace_memory>"
        )
        new_messages.insert(0, {"role": "system", "content": isolated_memory})
    return new_messages


# D9(2026-09-19 立):Repo Wiki 自动 wiki 化 + 增量同步 + 常驻注入。
# 与 _inject_repo_wiki(手动 wiki_context 路径)并列,互不影响:两者 marker 不同,
# 手动路径用 <!-- repo_wiki:{repo} -->,自动路径用 <!-- repo-wiki-auto -->。
def _inject_repo_wiki_auto(
    messages: list[dict[str, Any]],
    wiki_text: str,
    label: str | None = None,
) -> list[dict[str, Any]]:
    """把自动生成的[repo-wiki]项目百科注入 system message(带去重 marker)。

    全同步、零 LLM;调用方需先拿到 wiki_text(经 repo_wiki_engine.ensure_wiki)。
    """
    if not wiki_text or not str(wiki_text).strip():
        return messages
    marker = "<!-- repo-wiki-auto -->"
    body = "[repo-wiki] 项目百科（自动生成，增量同步）：\n" f"{wiki_text}"
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        if marker in str(existing):
            return messages
        merged = f"{existing}\n\n{marker}\n{body}" if existing else f"{marker}\n{body}"
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        new_messages.insert(0, {"role": "system", "content": f"{marker}\n{body}"})
    return new_messages


async def _maybe_inject_auto_repo_wiki(
    messages: list[dict[str, Any]],
    req: "LLMCompleteRequest",
) -> list[dict[str, Any]]:
    """D9 自动项目百科注入挂载点(并行作业热路径)。

    ── 2026-10-03 数据出域合规整改:门槛由 opt-out 翻转为 **显式 opt-in** ──
    旧判据是 `if req.wikiContext is not False and req.workspace_path`,即
    「字段缺省 / null / undefined 一律走注入,必须显式传 false 才关」。这意味着
    客户端只要不主动关,工作区 markdown(含 AGENTS.md / CLAUDE.md 这类承载内部
    架构、密钥位置、部署拓扑的 agent 指令文件)就会在**每次普通对话**里被切前
    4000 字拼进 user message 发往外部模型服务商 —— 与 2026-09 智谱 ZCode
    「未经知情把用户仓库数据传上 MaaS」同型,且隐蔽得多(用户没有任何上传动作)。
    故改为:仅当调用方**显式传 wikiContext=true**(并已就此取得用户同意)才注入。
    缺省一律不注入。

    另保留 IHUI_WIKI_ENABLE=1 全局开关:部署方若确实需要「全站默认开启」
    (如已通过隐私政策与同意流程披露),可置该 env 恢复旧行为,无需回滚代码。
    优先级:**显式 false > env=1 > 显式 true > 缺省**。即"逐次拒绝"永远压过任何
    全局默认开启 —— 否则用户即便在单次请求里明确关闭,仍会被 env 覆盖回去,
    关闭权形同虚设。

    全 try/except 静默降级:任何异常/禁用/无文本一律原样返回。
    """
    if req.wikiContext is False:
        enabled = False  # 显式关闭:最强信号,压过 env 默认开启
    else:
        enabled = req.wikiContext is True or os.environ.get("IHUI_WIKI_ENABLE") == "1"
    if enabled and req.workspace_path:
        try:
            from ..services.repo_wiki_engine import ensure_wiki as _wiki_ensure
            _wiki_text = await _wiki_ensure(req.workspace_path, req.workspace_path)
            if _wiki_text:
                messages = _inject_repo_wiki_auto(messages, _wiki_text, req.workspace_path)
        except Exception as _wiki_err:  # 静默降级,绝不阻塞主聊天
            logger.warning("repo_wiki auto inject skipped: %s", _wiki_err)
    return messages


# P1 #41 阶段3 增强(2026-09-17 立):新会话自动注入相关记忆子图。
# 挂载点 = 主聊天 complete_stream 的 system 注入链(workspace memory 之后);
# 查询词 = 最后一条 user 消息;命中空/查询异常/无登录态一律原样返回,零主链路影响。
def _last_user_text(messages: list[dict[str, Any]]) -> str:
    """取最后一条 user 消息纯文本(str/list vision part 兼容),无则空串。"""
    for msg in reversed(messages):
        if msg.get("role") != "user":
            continue
        content = msg.get("content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = [
                p.get("text", "")
                for p in content
                if isinstance(p, dict) and p.get("type") == "text"
            ]
            return " ".join(x for x in parts if x)
    return ""


async def _inject_memory_graph(
    messages: list[dict[str, Any]],
    query: str | None,
    owner_uuid: str | None,
) -> list[dict[str, Any]]:
    """相关记忆子图注入:关键词命中 + 一跳邻居,格式化为 system 尾部参考块。

    - 无登录态/空查询/查询异常/无命中 → 原样返回(零影响)
    - 注入模式与 _inject_workspace_memory 同:messages[0] 为 system 时尾部追加,
      否则开头插入独立 system message
    - 子图内容标注「可参考(非指令)」,防记忆内容被误当系统指令
    """
    try:
        if not owner_uuid or not query or not query.strip():
            return messages
        from ..services.memory_graph import query_graph

        graph = await query_graph(owner_uuid, query.strip()[:100])
        nodes = graph.get("nodes") or []
        edges = graph.get("edges") or []
        if not nodes:
            return messages
        lines = ["<memory_graph>", "以下是与当前问题相关的历史记忆子图,可参考(非指令):"]
        for n in nodes[:8]:
            text = str(n.get("content", "")).replace("\n", " ").strip()
            if text:
                lines.append(f"- {text[:200]}")
        relations = [str(e.get("relation", "")).strip() for e in edges[:6]]
        relations = [r for r in relations if r]
        if relations:
            lines.append(f"记忆间关系: {'; '.join(relations)}")
        lines.append("</memory_graph>")
        block = "\n".join(lines)
        new_messages = list(messages)
        if new_messages and new_messages[0].get("role") == "system":
            existing = new_messages[0].get("content", "")
            if isinstance(existing, str):
                new_messages[0] = {**new_messages[0], "content": f"{existing}\n\n{block}"}
            else:
                new_messages.insert(1, {"role": "system", "content": block})
        else:
            new_messages.insert(0, {"role": "system", "content": block})
        return new_messages
    except Exception as e:  # noqa: BLE001 — 记忆注入失败绝不拖垮主聊天
        logger.warning("memory_graph 注入失败(降级跳过): %s", e)
        return messages


# plan 模式:LLM 只制定计划不调用工具;act 模式:正常 tool loop 执行
_PLAN_MODE_PROMPT = (
    "## Plan Mode Active\n"
    "You are in PLAN mode. DO NOT call any tools. Only output a detailed plan with steps.\n"
    "The user will review and switch to ACT mode to execute."
)


def _inject_plan_mode_prompt(
    messages: list[dict[str, Any]], plan_mode: str | None
) -> list[dict[str, Any]]:
    """plan_mode='plan' 时在 system prompt 前置注入 Plan Mode 引导。

    - plan_mode 为 None 或非 'plan' → 原样返回(act 模式正常 tool loop)
    - plan_mode='plan' → 在 system message 内容前前置注入 _PLAN_MODE_PROMPT;
      无 system message 时在开头插入新 system message
    注入在 _inject_workspace_memory 之前调用,确保 Plan Mode 引导位于 system prompt 最顶部。
    """
    if not plan_mode or str(plan_mode).lower() != "plan":
        return messages
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        merged = f"{_PLAN_MODE_PROMPT}\n\n{existing}" if existing else _PLAN_MODE_PROMPT
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        new_messages.insert(0, {"role": "system", "content": _PLAN_MODE_PROMPT})
    return new_messages


# ChatMode 5 态引导 prompt(2026-09-13 矩阵 A #24):
# ask=纯问答禁工具;review=只读审查;spec=规格生成。plan 走 _PLAN_MODE_PROMPT;build 不注入。
_CHAT_MODE_PROMPTS: dict[str, str] = {
    "ask": (
        "## Ask Mode Active\n"
        "You are in ASK mode. DO NOT call any tools. Answer the user's question directly "
        "and concisely based on the conversation context."
    ),
    "review": (
        "## Review Mode Active\n"
        "You are in REVIEW mode. Focus on read-only code review. DO NOT modify anything.\n"
        "Produce findings in EXACTLY three severity sections, each finding on one bullet:\n"
        "### P1 Blocking\n### P2 Suggested\n### Nits\n"
        "Every bullet MUST cite evidence as path:line (or path for whole-file issues),\n"
        "state the concrete risk, and end with a one-line actionable fix suggestion.\n"
        "If a section has no findings, write None. End with a one-paragraph overall verdict."
    ),
    "spec": (
        "## Spec Mode Active\n"
        "You are in SPEC mode. Produce or refine a structured specification document "
        "(goals, scope, interfaces, data models, acceptance criteria)."
    ),
}


def _resolve_reasoning_effort(req: "LLMCompleteRequest") -> tuple[str | None, dict[str, object] | None]:
    """推理强度档位的唯一解析出口(D130,2026-09-30 立)。

    返回 `(发给上游的生效档位, 回落通知或 None)`。三段判定,顺序不可颠倒:
      1. 请求没带档位 -> (None, None):不发字段,旧客户端零行为变化(回退=revert)。
      2. 带了但不属于 known_efforts -> (None, notice)。上游只认封闭集,发过去要么被
         provider 拒(400)要么被静默忽略,两种都比"不发"糟,所以丢弃;但**必须留通知**——
         "用户选了档而什么都没发生"正是票第 8 栏点名的静默失效。
      3. 合法档位 -> 交给既有钉扎出口 reasoning_effort_for_request(sampling 语义)。
         它返回 None 或另一个值时同样落通知(钉回也是回落,不是"无事发生")。

    档位值域不在本文件写第二份:`known_efforts` 由 ReasoningEffortPin 自带,与 TS 侧
    `packages/types/src/reasoning-effort.ts` 的封闭联合由
    `scripts/check-model-capacity-parity.mjs` 的 C5/C6 四处对账(第四落点即契约层)。
    """
    requested = getattr(req, "reasoning_effort", None)
    if requested is None:
        return None, None
    pin = ReasoningEffortPin()
    if requested not in pin.known_efforts:
        return None, {
            "requested": requested,
            "effective": None,
            "fallback": True,
            "reason": "unknown-effort",
        }
    effective = reasoning_effort_for_request(pin, req.model or "", requested, "sampling")
    if effective == requested:
        return effective, None
    return effective, {
        "requested": requested,
        "effective": effective,
        "fallback": True,
        "reason": "pinned",
    }


def _resolve_chat_mode(mode: str | None, plan_mode: str | None) -> str | None:
    """归一化 ChatMode(2026-09-13 矩阵 A #24)。

    - mode 字段('ask'/'build'/'plan'/'review'/'spec',大小写不敏感)优先于 legacy plan_mode
    - legacy plan_mode 兼容:'plan'→plan,'act'→build(不注入,正常 tool loop)
    - 未知值 → None(保持默认行为,不猜测)
    """
    m = (mode or "").strip().lower() or None
    if m in ("ask", "build", "plan", "review", "spec"):
        return m
    legacy = (plan_mode or "").strip().lower()
    if legacy == "plan":
        return "plan"
    return None


# ===== ChatMode 工具硬收窄(V3 #53,2026-09-26 立;2026-09-27 归一到矩阵唯一真源)=====
# 本段**不再持有自己的表**:三轴与 25 格笛卡尔矩阵的唯一真源在
# app/core/permission_mode.py(TS 镜像 packages/types/src/permission-mode.ts,
# 逐格对账 = scripts/check-mode-permission-matrix.mjs)。
# 名字保留 _CHAT_MODE_TOOL_POLICY 是给既有阅读链(llm.py ↔ chat-mode-policy.ts 互指)
# 一个稳定锚点,它现在是 CHAT_MODE_TOOL_AXIS 的别名而不是第二份抄本 ——
# 一处改、处处改,正是"两份真相各写一半"的成因,已消除。
_CHAT_MODE_TOOL_POLICY: Mapping[str, str] = CHAT_MODE_TOOL_AXIS


def _chat_mode_allows_tool(
    chat_mode: str | None, tool_name: str, permission_mode: str | None = None
) -> bool:
    """判断 (chat_mode × permission_mode) 下是否允许调用 tool_name(V3 #53 硬收窄判定)。

    判定表在 core/permission_mode.py;此处只做出口转发,**不含任何本地 if**:
    - 未知/None mode → 'build' 语义 = 'all'(与 _resolve_chat_mode 返回 None 的默认一致)
    - ask(任一权限档)= 'none':全拦截
    - plan / review = 'readonly':仅 plan_mode.READONLY_TOOLS 白名单内放行
      —— 且该格**不随 permission_mode 放宽**:选了 plan 就是只读承诺,
      bypassPermissions 不能把它顶开(V3 #53 判据三的核心一格)。
    """
    return tool_allowed_by_policy(resolve_mode_policy(chat_mode, permission_mode), tool_name)


def _filter_agent_tools_for_chat_mode(
    chat_mode: str | None,
    agent_tools: list[str] | None,
    permission_mode: str | None = None,
) -> list[str] | None:
    """按 (模式 × 权限档) 收窄 agent_tools(V3 #53:发给 LLM 的 tools 数组硬过滤)。

    在 control_autonomy.augment_agent_tools / filter_unauthorized_page_tools **之后**
    调用(服务端自主补全的浏览器/电脑控制族同样受本闸约束)。ask 模式上游已置 None,
    此处保持 None 语义。交集计算只有 core/permission_mode.allowed_tool_names 一处,
    本函数只负责**保序**(发给 LLM 的数组顺序影响缓存与可读性)。
    """
    if agent_tools is None:
        return None
    policy = resolve_mode_policy(chat_mode, permission_mode)
    allowed = allowed_tool_names(policy, agent_tools)
    return [name for name in agent_tools if name in allowed]


def _chat_mode_blocked_message(
    chat_mode: str | None, tool_name: str, permission_mode: str | None = None
) -> str:
    """被拦文案唯一出口(V3 #53 判据一:原因 + 替代建议;V3 #49 同口径)。"""
    return blocked_tool_message(resolve_mode_policy(chat_mode, permission_mode), tool_name)


def _inject_system_prefix(messages: list[dict[str, Any]], prefix: str) -> list[dict[str, Any]]:
    """在 system prompt 最顶部前置注入 prefix(无 system message 时在开头插入新 system message)。

    抽取自 _inject_plan_mode_prompt 的合并逻辑(2026-09-13 矩阵 A #24),
    供 plan/ask/review/spec 各模式复用。
    """
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        merged = f"{prefix}\n\n{existing}" if existing else prefix
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        new_messages.insert(0, {"role": "system", "content": prefix})
    return new_messages


def _inject_custom_system_prompt(
    messages: list[dict[str, Any]], prefix: str | None
) -> list[dict[str, Any]]:
    """P1-7(2026-09-13 立):会话级自定义 system prompt 前置注入。

    与 _inject_system_prefix 同语义(在 system 消息最顶部合并,无 system 消息则新插一条);
    此处独立实现,保证本次 P1-7 提交不依赖其他并行改动的中间态。
    prefix 为空时原样返回,调用点可无条件调用。
    """
    if not prefix:
        return messages
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        merged = f"{prefix}\n\n{existing}" if existing else prefix
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        new_messages.insert(0, {"role": "system", "content": prefix})
    return new_messages


# ===== 多 agent 编排引导 prompt(2026-07-24 立,2026-07-24 升级 5→10 agent + invoke_parallel)=====
# 仅当请求 agent_tools 含 dispatch_subagent 时,在 tool loop 入口注入此 system message,
# 引导 LLM 在复杂任务时主动派发子智能体而非单打独斗。
# agent 清单对齐 AgentOrchestrator._register_defaults 的 10 个默认 agent(5 通用 + 5 专业,2026-07-24 新增)
_SUBAGENT_ORCHESTRATION_PROMPT = (
    "你当前可以使用 dispatch_subagent 工具派发子智能体执行独立子任务,"
    "子智能体独立执行后返回结果,不污染主对话上下文。\n\n"
    "通用 agent(5 个):\n"
    "- researcher:研究助手,调研任务、收集信息、生成摘要\n"
    "- coder:代码助手,实现功能、修复 bug、写代码\n"
    "- reviewer:代码审查助手,审查 diff、给出修改建议\n"
    "- architect:架构师,设计方案、规划模块、API 契约\n"
    "- debugger:调试助手,定位 bug、给出修复方案\n\n"
    "专业 agent(5 个,2026-07-24 新增,自研智能体):\n"
    "- frontend-dev:前端开发专家,React 19/Next.js 15/Tailwind 4/shadcn/ui,遵循项目 UI 约束\n"
    "- backend-dev:后端开发专家,Fastify 5/Drizzle ORM/PostgreSQL/Redis,遵循项目 API 约束\n"
    "- devops:DevOps 工程师,Docker/Turborepo/pnpm workspace/CI/CD,monorepo 构建\n"
    "- security-auditor:安全审计专家,OWASP Top 10/CWE 检测,RCE/SSRF/SQL注入/XSS 漏洞模式\n"
    "- test-engineer:测试工程师,Vitest/pytest/Playwright,单元/集成/E2E 测试设计\n\n"
    "并行派发(2026-07-24 新增,对标 Codex 并行 Agent):\n"
    "- 当任务涉及多个独立子任务时,可在单次 dispatch_subagent 调用中传入 tasks 数组批量派发\n"
    "- invoke_parallel 自动用 asyncio.Semaphore 限流(默认并发 5),单个失败不影响其他\n"
    "- 返回结构化聚合结果:total/succeeded/failed/results[]\n\n"
    "使用时机:\n"
    "- 任务涉及多个独立子步骤(如\"审查代码 + 写测试\")→ 拆分为多个 dispatch_subagent 调用,每个子任务一个 agent\n"
    "- 任务需要多视角审查(如\"评估方案是否合理\")→ 用 reviewer\n"
    "- 任务需要专业能力而你自身不擅长(如\"调研某新技术进展\")→ 用 researcher\n"
    "- 前端 UI 改动 → 用 frontend-dev(熟悉项目 UI 约束,产出更合规)\n"
    "- 后端 API 改动 → 用 backend-dev(熟悉项目 API 约束,产出更规范)\n"
    "- 安全审查 → 用 security-auditor(产出按 severity 分级 + 修复建议)\n"
    "- 测试设计 → 用 test-engineer(覆盖 4 状态:默认/hover/active/dark mode)\n"
    "- 简单任务(单一问题、直接回答)→ 不需要 dispatch_subagent,自己回答即可\n\n"
    "禁止滥用:\n"
    "- 不要为单一简单问题派发多个 subagent(浪费 token)\n"
    "- 不要重复派发相同任务(去重机制会跳过)"
)


def _build_subagent_orchestration_prompt() -> str:
    """构造多 agent 编排引导 system prompt。

    仅当 agent_tools 含 dispatch_subagent 时由主流程注入一次(tool loop 入口),
    不在每轮 iteration 重复注入。返回模块级常量,避免每次请求重新构造。
    """
    return _SUBAGENT_ORCHESTRATION_PROMPT


def _load_default_models() -> list[dict[str, Any]]:
    """从 data/default_models.json 加载默认模型清单,按 id 去重。

    文件不存在或解析失败时返回内置最小兜底列表(避免启动失败)。
    """
    fallback_minimal = [
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "context_length": 128000, "input_price": 2.5},
        {"id": "gpt-4o-mini", "name": "GPT-4o mini", "provider": "openai", "context_length": 128000, "input_price": 0.15},
    ]
    try:
        if not _DEFAULT_MODELS_FILE.exists():
            logger.warning("Default models file not found: %s, using minimal fallback", _DEFAULT_MODELS_FILE)
            return fallback_minimal
        raw = _DEFAULT_MODELS_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
        models = data.get("models", [])
        if not isinstance(models, list) or not models:
            return fallback_minimal
        # 按 id 去重(保留首次出现)
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for m in models:
            if not isinstance(m, dict):
                continue
            mid = m.get("id")
            if not mid or mid in seen:
                continue
            seen.add(mid)
            unique.append(m)
        return unique
    except Exception as e:
        logger.exception("Failed to load default models from %s: %s", _DEFAULT_MODELS_FILE, e)
        return fallback_minimal


class LLMCompleteRequest(BaseModel):
    """LLM 调用请求。"""

    messages: list[dict[str, Any]] = Field(..., description="OpenAI 格式消息列表")
    model: str | None = Field(None, description="模型名称,为空使用默认")
    # function calling(OpenAI tools 格式,透传给 LiteLLM 或厂商原生 API)
    tools: list[dict[str, Any]] | None = Field(None, description="OpenAI 格式 tools 定义")
    tool_choice: str | dict[str, Any] | None = Field(
        None, description="工具选择策略: auto/none/required 或 {type:'function',function:{name:'xxx'}}"
    )
    temperature: float | None = Field(None, description="采样温度")
    max_tokens: int | None = Field(None, description="最大生成 token 数")
    # P1-7(2026-09-13 立,四竞品对标:CodeX/Qoder 高级参数面板):
    # 会话级采样参数与自定义 system prompt,由前端"高级参数"抽屉按会话下发。
    top_p: float | None = Field(None, description="核采样 top-p(0-1),None=用模型默认")
    top_k: int | None = Field(None, description="top-k 采样(>0),None=用模型默认")
    system_prompt: str | None = Field(
        None, description="自定义 system prompt,注入到 system 消息最顶部(与工作区记忆叠加)"
    )
    # Phase 3 集成字段(可选)
    metadata: dict[str, Any] | None = Field(
        None, description="调用方元数据(conversation_id/message_id/user_id 等),原样透传到 done 事件"
    )
    callback_url: str | None = Field(
        None, description="推理完成后回调该 URL(POST 完整结果),默认由 api_service_url 构造"
    )
    # 当前绑定的本地工作区路径,用于注入 CLAUDE.md/AGENTS.md 项目记忆作为 system prompt
    workspace_path: str | None = Field(
        None, description="工作区路径,自动加载并注入项目记忆文件(CLAUDE.md/AGENTS.md/.ihui/memory.md)"
    )
    # 浏览器端预加载的工作区文件内容(2026-08-02 立,阶段 1)
    # web 非 Tauri 环境下,前端用 FileSystemDirectoryHandle 遍历读取工作区关键文件,
    # 把内容通过此字段传给后端,后端直接注入 system prompt(跳过从文件系统读取)。
    # 优先级:workspace_context > workspace_path
    workspace_context: str | None = Field(
        None, description="浏览器端预加载的工作区文件内容,直接注入 system prompt(优先于 workspace_path)"
    )
    # P1-8(2026-09-13 立,Repo Wiki):项目百科摘要注入
    # API 网关按 repo_name 从 repo_wiki_docs 读出最新一版 overview 文档,截断后经此字段传入,
    # 由 _inject_repo_wiki 独立注入(与 workspace_context 互不影响)。
    wiki_context: str | None = Field(
        None, description="项目百科(Repo Wiki)摘要,注入 system prompt 作为代码/架构问答背景"
    )
    wiki_repo: str | None = Field(
        None, description="项目百科对应仓库名(用于去重 marker 与 <repo_wiki repo> 标签标注)"
    )
    # D9(2026-09-19 立):Repo Wiki 自动 wiki 化 + 增量同步 + 常驻注入 开关。
    # 2026-10-03 数据出域合规整改:默认由 None(视为开启)改为 **None=不开启**。
    # 理由:本开关一旦默认开启,工作区 markdown(含 AGENTS.md / CLAUDE.md 这类承载
    # 内部架构、密钥位置、部署拓扑的 agent 指令文件)会在每次普通对话中被自动切前
    # 4000 字发往外部模型服务商,而用户从未做过任何上传动作 —— 与智谱 ZCode 事件
    # 同型。改为显式 true 才注入,使"用户已就本次外传取得同意"成为可验证的前置条件。
    # 部署方如需全站默认开启(如已通过隐私政策披露),可置 env IHUI_WIKI_ENABLE=1。
    # 反向硬开关 IHUI_WIKI_DISABLE=1 仍在 repo_wiki_engine 内生效,优先级最高。
    wikiContext: bool | None = Field(
        None,
        description=(
            "Repo Wiki 自动项目百科注入开关(会读取工作区 .md 并发给模型服务商):"
            "**必须显式 true 才开启**,缺省/null/false 一律不注入;"
            "调用方须确保用户已就本次外传明确同意"
        ),
    )
    # 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一,Python 端兜底)
    context_limit: int | None = Field(
        None, description="模型上下文窗口大小(tokens),达 88% 阈值自动压缩。0 或 None = 不压缩"
    )
    # Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
    # 传入工具名列表后,后端从 mcp_server 加载完整 schema,走 tool loop(complete→tool_calls→execute→astream)
    agent_tools: list[str] | None = Field(
        None, description="Agent 工具名列表(如 browser_screenshot/computer_mouse_click),传入后走 tool loop"
    )
    # ChatMode 5 态(2026-09-13 矩阵 A #24):mode='ask'/'build'/'plan'/'review'/'spec'
    # 优先于 legacy plan_mode;由 apps/api ai-chat-stream.ts 透传前端 ChatMode 选择。
    mode: str | None = Field(
        None, description="ChatMode 5 态:'ask'=纯问答禁工具,'build'=默认执行,"
        "'plan'=只制定计划,'review'=只读审查,'spec'=规格生成"
    )
    # Plan/Act 模式(2026-07-24 立,自研双模切换)
    # plan_mode='plan' 时前置注入 Plan Mode system prompt,LLM 只制定计划不调用工具;
    # 'act' 或 None = 正常 tool loop 执行(默认)
    plan_mode: str | None = Field(None, description="Plan/Act 模式:'plan'=只制定计划,'act'=正常执行(默认)")
    # D7(2026-09-19 立):主聊天自动语义检索注入开关。
    # 默认 True(开启);显式 false 关闭 @codebase 风格的首答前代码库检索注入。
    # 环境变量 IHUI_AUTO_CONTEXT_DISABLE=1 为全局硬开关(在 auto_context 模块内生效)。
    autoContext: bool | None = Field(
        None, description="自动语义检索注入开关:true/false,默认开启(None 视为开启)"
    )
    # Steer(2026-09-19 立):调用方(API 网关)为本流预生成的会话 ID。
    # 网关把它同时存进 StreamSession.upstreamSessionId,用户中途引导时凭
    # conversationId/messageId 找回并转发到 /llm/complete/stream/{session_id}/steer。
    # 优先级高于 workspace_context 模式的自生成 id(两者同为每流唯一 uuid)。
    streamSessionId: str | None = Field(
        None, description="调用方预生成的流会话 ID,steer(中途引导)入队寻址用"
    )
    # V3 #58(2026-09-26 立):工作区权限模式档位,透传自前端 ai-panel store
    # ('default'/'accept-edits'/'bypass-permissions'/'plan')。工具审批门据此决定
    # 高危工具执行前是否弹审批:bypass 不拦截;accept-edits 放行文件编辑类(medium)。
    # 缺省按 default 处理(保守:高危工具需审批)。
    permission_mode: str | None = Field(
        None, description="权限模式档位:default/accept-edits/bypass-permissions/plan"
    )
    # D130(2026-09-30 立):推理强度档位(输入区第三轴)。可选 ⇒ 旧客户端零行为变化。
    # 值域是封闭集但**本字段刻意不写 Literal**:写就是第五份档位表(该表已有四处,
    # 由 scripts/check-model-capacity-parity.mjs C5/C6 对账)。非法值由 _resolve_reasoning_effort
    # 丢弃并落通知 —— Pydantic 直接 422 会把「用户选了个不支持的档」打成整轮请求失败。
    reasoning_effort: str | None = Field(
        None, description="推理强度档位:minimal/low/medium/high(封闭集,非法值丢弃并回报回落)"
    )


# =============================================================================
# 受限模型访问控制(2026-08-05 立,安全红线)
# 生产真实 LLM API key 的模型只允许系统内置管理员(users.is_system_admin=true)
# 使用;普通用户 403。system-worker(API 内部签发凭证,ai-feed 分类等后台任务)豁免。
# 同时覆盖 /llm/complete 与 /llm/complete/stream(主聊天入口)。
# 2026-08-06 扩展:新增 nvidia_nim/siliconflow/zhipu/bailian/openai 真实 key。
# =============================================================================

# 受限模型 id 前缀(llm_gateway._model_to_provider_code 映射后的模型 id 形态):
# stepfun/agnes/groq/ → 真实 key;nvidia/ → nvidia_nim;siliconcloud/ 与 siliconflow/ →
# siliconflow;bailian/ → 阿里百炼;glm- → zhipu(智谱模型 id 无斜杠前缀)
RESTRICTED_PREFIXES = (
    "stepfun/",
    "agnes/",
    "groq/",
    "nvidia/",
    "siliconcloud/",
    "siliconflow/",
    "bailian/",
    "glm-",
)
# 无前缀的受限模型(deepseek/gpt 官方模型 id 不带 provider 前缀)
RESTRICTED_MODEL_IDS = {"deepseek-chat", "deepseek-reasoner", "gpt-4o", "gpt-4o-mini"}


def _is_restricted_model(model: str | None) -> bool:
    """判断模型是否属于受限(真实付费 key)集合。

    2026-09-13 修复:先做小写归一,避免客户端传大写写法(如 GPT-4o)绕过前缀/集合
    判定导致非管理员越权消费付费额度(下游仍按小写解析到 openai 真实 key)。
    """
    if not model:
        return False
    m = model.lower()
    if m in RESTRICTED_MODEL_IDS:
        return True
    return any(m.startswith(p) for p in RESTRICTED_PREFIXES)


async def _ensure_restricted_model_access(request: Request, model: str | None) -> None:
    """受限模型仅系统管理员可用;非管理员抛 403。"""
    if not _is_restricted_model(model):
        return
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if uid == "system-worker":
        return  # API 内部系统凭证(8802 已鉴权),供 ai-feed-process 等后台任务使用
    try:
        from ..core.db_pool import get_shared_pool

        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT is_system_admin FROM users WHERE id = $1", uid
            )
        if not row or not row["is_system_admin"]:
            raise HTTPException(status_code=403, detail="该模型仅系统管理员可用")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("[model-access] 受限模型校验异常: %s", e)
        raise HTTPException(status_code=403, detail="该模型仅系统管理员可用")


def _resolve_owner_uuid(request: Request) -> str | None:
    """P0-9 修复(2026-08-05):owner_uuid 一律从 JWT(request.state.user_id)派生,
    忽略请求体/元数据中的 userId —— 客户端传他人 owner_uuid 越权使用他人 BYOK Key /
    读取他人私有记忆的漏洞被消除。

    仅保留系统内部凭证(system-worker)例外:该凭证由 8802 网关鉴权后注入。
    """
    uid = getattr(request.state, "user_id", None)
    if not uid:
        return None
    return str(uid)


def _resolve_user_role(request: Request) -> int:
    """从 JWT(request.state.role_id)派生用户角色(0=普通用户,>=1=admin)。

    2026-08-06 修复:call_tool 权限矩阵(run_command/write_file 等 admin-only 工具)
    此前未传递 user_role(默认 0),导致 admin 用户调用被 PERMISSION_DENIED
    (实测:admin 会话调 run_command → '需要 admin 权限(role >= 1),当前 role=0')。
    system-worker 内部凭证(8802 网关已鉴权)视为 admin。
    """
    uid = getattr(request.state, "user_id", None)
    if uid == "system-worker":
        return 1
    raw = getattr(request.state, "role_id", None)
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0


def _snapshot_compaction_if_needed(
    original_messages: list[dict[str, Any]],
    compressed_messages: list[dict[str, Any]],
    compaction_info: dict[str, Any],
    session_id: str | None,
    user_id: str | None,
) -> None:
    """压缩发生后异步回捞快照:抽取被移除消息,fire-and-forget 写入向量库。

    不在压缩调用点阻塞主请求;embed / 写盘失败由 context_recall 内部降级,
    不会冒泡到请求链路。task 引用存入 _pending_compaction_snapshots 防止 GC 提前回收。

    被移除消息的判定:context_compaction 返回的压缩产物 = system + 摘要(summary,新消息)
    + 尾部保留(tail,复用原消息同一 dict 对象)。因此 removed = 原 messages 中未出现在
    compressed_messages 的消息,用对象身份(is)比对,精确且不受内容重复干扰。
    """
    if not compaction_info.get("compressed"):
        return
    removed = [m for m in original_messages if all(m is not c for c in compressed_messages)]
    if not removed:
        return
    # 摘要文本:压缩产物中 content 以 SUMMARY_MARKER 开头的消息
    summary_text: str | None = None
    for m in compressed_messages:
        content = m.get("content") if isinstance(m, dict) else None
        if isinstance(content, str) and content.startswith(SUMMARY_MARKER):
            summary_text = content
            break
    sid = session_id or (f"chat:{user_id}" if user_id else "global")
    try:
        task = asyncio.create_task(
            context_recall.snapshot_compacted(
                session_id=sid,
                user_id=user_id,
                removed_messages=removed,
                summary=summary_text,
                reason=str(compaction_info.get("trigger", "compaction")),
            )
        )
        _pending_compaction_snapshots.add(task)
        task.add_done_callback(_pending_compaction_snapshots.discard)
    except Exception as e:
        logger.warning("压缩快照 fire-and-forget 提交失败(不影响主流程): %s", e)


def _record_compaction_step(
    compressed_messages: list[dict[str, Any]],
    compaction_info: dict[str, Any],
    session_id: str | None,
    user_id: str | None,
    duration_ms: float = 0.0,
) -> None:
    """把一次真实发生的上下文语义压缩登记到 /api/context-compaction 感知队列。

    P0-1 LLM 语义压缩闭环:llm 压缩命中时,除向量回捞外还要把 original/compressed
    tokens + 摘要写进 context_compaction 的进程内历史,供"上下文压缩感知"面板读取。
    用延迟 import 规避 llm.py 顶层导入环路;失败仅 warning,绝不影响主请求链路。

    1-3(2026-09-12):同步上报压缩生产指标(Prometheus + 进程内报告通道,
    source="llm_router"),H7 压缩比/耗时进入指标报告。
    """
    sid = session_id or (f"chat:{user_id}" if user_id else "global")
    try:
        from .context_compaction import record_compaction as _record

        summary_text = ""
        for m in compressed_messages:
            content = m.get("content") if isinstance(m, dict) else None
            if isinstance(content, str) and content.startswith(SUMMARY_MARKER):
                summary_text = content
                break
        _record(
            sid,
            original_tokens=int(compaction_info.get("original_tokens") or 0),
            compressed_tokens=int(compaction_info.get("compressed_tokens") or 0),
            summary=summary_text[:500],
            trigger=str(compaction_info.get("trigger") or "llm"),
            user_id=user_id or "",
        )
    except Exception as e:
        logger.warning("record_compaction 登记失败(不影响主流程): %s", e)
    try:
        from ..services.compaction_metrics import record_compaction_event

        record_compaction_event(
            session_id=sid,
            info=compaction_info,
            source="llm_router",
            duration_ms=duration_ms,
        )
    except Exception as e:
        logger.warning("compaction 指标上报失败(不影响主流程): %s", e)


@router.post("/llm/complete", response_model=None)
async def llm_complete(req: LLMCompleteRequest, request: Request) -> dict[str, Any] | JSONResponse:
    """直接调用 LLM 完成对话(支持 function calling)。"""
    # 2026-09-13 立:入站模型名官方改写(大小写归一),须在受限模型权限判定前完成,
    # 让权限判定与后续链路共用同一个归一值。
    # model 为可选字段(None = 由下游选默认模型),此时保持 None 不改写。
    if req.model:
        req.model = to_official_model_name(req.model)
    await _ensure_restricted_model_access(request, req.model)
    owner_uuid = _resolve_owner_uuid(request)
    # P3 3-4-A(2026-09-17 拍板):新用户免费试用额度检查(env USER_TRIAL_DAILY_TOKENS,0=关闭)
    trial = await user_trial_quota.check(owner_uuid)
    if not trial["allowed"]:
        return _error_json(
            "今日免费额度已用完,明天自动恢复;可在模型设置中配置自己的 API Key 获得无限额度",
            429,
            errorCode="TRIAL_QUOTA_EXCEEDED",
            usage=trial,
        )
    # 工作区上下文注入:若 workspace_path 提供且存在 CLAUDE.md/AGENTS.md,合并到 system message
    messages = _inject_workspace_memory(req.messages, req.workspace_path, req.workspace_context)
    # P1-8(2026-09-13 立,Repo Wiki):项目百科独立注入(紧邻工作区记忆,互不影响)
    messages = _inject_repo_wiki(messages, req.wiki_context, req.wiki_repo)
    # D9(2026-09-19 立):Repo Wiki 自动 wiki 化注入(紧邻手动 wiki 路径,互不影响)
    messages = await _maybe_inject_auto_repo_wiki(messages, req)
    # P1 #41 阶段3 增强(2026-09-17 立):相关记忆子图自动注入(全降级,零主链路影响)
    messages = await _inject_memory_graph(
        messages, _last_user_text(messages), _resolve_owner_uuid(request)
    )
    # P1-7(2026-09-13 立):会话级自定义 system prompt,叠加在工作区记忆之上(置顶优先级最高)
    messages = _inject_custom_system_prompt(messages, req.system_prompt)
    # 跨端统一 88% 阈值自动压缩(Python 端兜底,API 层未压缩时由本层保护)
    if req.context_limit and req.context_limit > 0:
        original_messages = messages
        _compact_started = time.perf_counter()
        messages, compaction_info = compress_messages_if_needed(messages, req.context_limit)
        # P1-②(2026-09-18)决策链保留:把被压缩 head 段每轮 assistant 推理蒸馏为结构化
        # 决策条目注入摘要消息(纯确定性、零 LLM 调用;开关 AGENT_DECISION_CHAIN_ENABLED
        # 关闭 / 无摘要消息 / 无 head / 异常 → 产物与现状逐零差异),并自证推理保留率。
        if compaction_info.get("compressed"):
            messages, _chain_meta = apply_decision_chain(messages, original_messages)
            if _chain_meta.get("injected"):
                compaction_info["decision_chain"] = {
                    "entries": _chain_meta.get("entries"),
                    "fresh": _chain_meta.get("fresh"),
                    "carried": _chain_meta.get("carried"),
                }
                compaction_info["reasoning_retention"] = (
                    _chain_meta.get("reasoning_retention") or {}
                )
        _compact_duration_ms = (time.perf_counter() - _compact_started) * 1000
        if compaction_info["compressed"]:
            logger.info(
                "Context auto-compressed (Python fallback): %d → %d tokens, removed %d msgs",
                compaction_info["original_tokens"],
                compaction_info["compressed_tokens"],
                compaction_info["removed_count"],
            )
            # 压缩回捞:把被移除旧消息异步快照入向量库(不阻塞主链路)
            _snapshot_compaction_if_needed(
                original_messages=original_messages,
                compressed_messages=messages,
                compaction_info=compaction_info,
                session_id=(
                    req.metadata.get("conversationId")
                    if isinstance(req.metadata, dict)
                    else None
                ),
                user_id=owner_uuid,
            )
            # P0-1 压缩闭环:登记到 /api/context-compaction 感知面板
            _record_compaction_step(
                compressed_messages=messages,
                compaction_info=compaction_info,
                session_id=(
                    req.metadata.get("conversationId")
                    if isinstance(req.metadata, dict)
                    else None
                ),
                user_id=owner_uuid,
                duration_ms=_compact_duration_ms,
            )
    # 构造透传 kwargs(只透传非 None 的字段)
    kwargs: dict[str, Any] = {}
    if req.tools is not None:
        kwargs["tools"] = req.tools
    if req.tool_choice is not None:
        kwargs["tool_choice"] = req.tool_choice
    if req.temperature is not None:
        kwargs["temperature"] = req.temperature
    if req.max_tokens is not None:
        kwargs["max_tokens"] = req.max_tokens
    # P1-7(2026-09-13 立):高级参数面板 top_p / top_k 透传(厂商不支持时 filter_call_kwargs 兜底剔除)
    if req.top_p is not None:
        kwargs["top_p"] = req.top_p
    if req.top_k is not None:
        kwargs["top_k"] = req.top_k
    # D130(2026-09-30 立):推理强度档位 → 上游 kwargs。生效档位由唯一出口算,
    # llm_gateway 已认这个 kwarg(core/llm_gateway.py:486 读 call_kwargs['reasoning_effort']),
    # provider 不支持时由 core/provider_caps.filter_call_kwargs 兜底剔除(不在本层猜厂商)。
    _eff_kwargs, _ = _resolve_reasoning_effort(req)
    if _eff_kwargs is not None:
        kwargs["reasoning_effort"] = _eff_kwargs
    result = await llm_gateway.complete(messages, model=req.model, owner_uuid=owner_uuid, **kwargs)
    # 错误前置返回(P1 错误标准化,2026-07-22 立):
    # 之前 LLM 错误一律 HTTP 200 + result.error:True,网关/监控层无法通过状态码识别失败,
    # 必须在调用方解析 result 字段才能区分成功/失败,影响 ELK/Prometheus 错误率统计。
    # 现在:错误统一返回 HTTP 4xx + 结构化 {errorCode, message, model} JSON,
    # 前端 api-client streamChat 在 resp.ok=false 时自动 throw SSEError,
    # attachErrorMeta 从 parsedBody.errorCode 透传到 Error.errorCode,
    # formatSSEError 按状态码 422/501/502 选 severity → toast。
    if result.get("error"):
        err_msg = str(result.get("error_message") or "LLM 调用失败")
        # 优先用 llm_gateway 已分类的 errorCode,兜底重新分类(双保险)
        err_code = result.get("errorCode")
        if not err_code:
            if "API key 未配置" in err_msg or "未配置" in err_msg:
                err_code = "MODEL_NOT_CONFIGURED"
            elif "NotImplemented" in err_msg:
                err_code = "PROVIDER_NOT_IMPLEMENTED"
            else:
                err_code = "LLM_ERROR"
        status_map = {
            "MODEL_NOT_CONFIGURED": 422,
            "PROVIDER_NOT_IMPLEMENTED": 501,
            "LLM_ERROR": 502,
        }
        status_code = status_map.get(err_code, 502)
        logger.warning(
            "llm_complete failed: model=%s code=%s status=%d msg=%s",
            req.model, err_code, status_code, err_msg,
        )
        return JSONResponse(
            status_code=status_code,
            content={
                "errorCode": err_code,
                "message": err_msg,
                "model": req.model,
            },
        )
    # 透传 metadata
    if req.metadata:
        result["metadata"] = req.metadata
    # 异步回调(仅当 metadata 含关联键时才触发,避免无谓网络开销)
    # 错误响应(error: True)不回调,避免把错误文本当作 AI 回复持久化
    has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
    if has_association and not result.get("error"):
        url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
        task = asyncio.create_task(_fire_callback(url, result, req.metadata))
        _pending_callbacks.add(task)
        task.add_done_callback(_pending_callbacks.discard)
    return result


@router.get("/llm/models")
async def list_models(request: Request) -> dict[str, Any]:
    """返回可用模型列表(已按 provider 健康状态自动过滤)。

    过滤规则(2026-07-31 立,用户规则:只显示可完美接通调用的模型):
    - 加载 data/default_models.json + ai_model_config_models 表合并清单
    - 调 model_availability.get_available_models() 过滤:
      * 未配置 key 的 provider 模型 → 过滤
      * 健康检查 DOWN(401/403/超时/网络错误)的 provider 模型 → 过滤
      * zero_cost provider(pollinations/llm7/aihorde/opencode_zen)→ 保留
      * LOCAL provider(ollama/lmstudio/llamacpp/vllm)→ 保留
      * PENDING(尚未检测)/ DEGRADED(延迟高但仍可用)→ 保留
    - stub 模式下绕过过滤(本地开发无 key,返回默认列表)
    - 健康状态由 ModelAvailabilityService 后台每 5 分钟刷新一次(不阻塞请求)

    前端 /models 页面通过 API 代理调用此端点获取动态模型清单。
    Dashboard 可调 GET /llm/providers/availability 查看 provider 健康状态详情。
    """
    default_models = _load_default_models()
    # 从数据库加载额外模型(ai_model_config_models 表,is_relay_public=true)
    try:
        from ..core.db_pool import get_shared_pool
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            # 2026-09-08:v4 优先带 m.metadata(token6688 富元数据);迁移未应用时
            # (列不存在)降级为旧查询,保证模型列表不被单列缺失拖垮
            _base_sql = (
                """SELECT m.model_id, m.display_name, m.context_length, c.provider_code,
                          m.release_date, m.tags{extra}
                   FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE m.enabled = true AND c.enabled = true AND m.is_relay_public = true
                   ORDER BY c.sort_order NULLS LAST, m.relay_sort_order"""
            )
            try:
                rows = await conn.fetch(_base_sql.format(extra=", m.metadata"))
            except Exception:
                rows = await conn.fetch(_base_sql.format(extra=""))
        seen = {m["id"] for m in default_models}
        for r in rows:
            mid = r["model_id"]
            provider_code = r["provider_code"]
            # 2026-08-02 立:DB 模型 id 规范化(修复 /llm/models 模型缺失),按 provider 分支:
            # - gemini:剥掉 "models/" 前缀再加 "gemini/"(DB 中两种格式混存,如
            #   "models/gemini-2.0-flash" 与 "gemini-2.5-flash",统一为 "gemini/<name>")
            # - agnes:统一加 "agnes/" 前缀
            # - nvidia / nvidia_nim:统一加 "nvidia/" 前缀
            # - openrouter / stepfun:已有前缀逻辑,保持
            # - cloudflare_workers_ai:DB id 已带 "@cf/" 前缀,保持原样
            if provider_code == "gemini":
                mid = mid.split("models/", 1)[-1] if mid.startswith("models/") else mid
                if not mid.startswith("gemini/"):
                    mid = f"gemini/{mid}"
            elif provider_code == "agnes" and not mid.startswith("agnes/"):
                mid = f"agnes/{mid}"
            elif provider_code in ("nvidia", "nvidia_nim") and not mid.startswith("nvidia/"):
                mid = f"nvidia/{mid}"
            elif provider_code == "openrouter" and not mid.startswith("openrouter/"):
                # OpenRouter 模型需要 "openrouter/" 前缀(调用时 _model_to_provider_code 匹配)
                mid = f"openrouter/{mid}"
            elif provider_code == "stepfun" and not mid.startswith("stepfun/"):
                # StepFun 模型加 "stepfun/" 前缀(与 default_models.json 对齐,避免重复)
                mid = f"stepfun/{mid}"
            elif provider_code == "token6688":
                # 2026-09-08 立:token6688 模型加 "t6688/" 前缀(调用时 gateway 按前缀路由,
                # 否则裸 ID 会误路由到 OpenAI 默认分支);且只放行 chat 模型——
                # 同步入库的 112 模型含 69 个 video/image/audio(tags 带 modality),
                # 它们走 MCP 图片/视频/TTS 工具,不能作为对话模型列出
                row_tags = {str(t).lower() for t in (r["tags"] or [])}
                if "chat" not in row_tags and not mid.startswith("t6688/"):
                    continue
                if not mid.startswith("t6688/"):
                    mid = f"t6688/{mid}"
            # 以规范化后的 mid 作为去重键(seen 在遍历 DB 行时持续累加,保证全局唯一,
            # 修复 DB 内部重复,如 stepfun 18 条=9 个唯一 id)
            if mid not in seen:
                _entry: dict[str, Any] = {
                    "id": mid,
                    "name": r["display_name"] or mid,
                    "provider": provider_code,
                    "context_length": r["context_length"] or 4096,
                    # 分类引擎输入:用途分类需要 tags,代次判定需要 release_date
                    "release_date": r["release_date"],
                    "tags": list(r["tags"] or []),
                }
                # token6688 富元数据摘要(v4,2026-09-08):capabilities/健康分/排序权重/
                # 输入提示随条目输出,供前端展示与 agent 参数参考;媒体模型已在上方 continue
                if provider_code == "token6688":
                    _meta = r.get("metadata", None)
                    if isinstance(_meta, dict) and _meta:
                        _summary = {
                            k: _meta[k]
                            for k in (
                                "capabilities", "health_score", "sort_weight",
                                "input_hint_zh", "billing_mode",
                            )
                            if _meta.get(k) is not None
                        }
                        if _summary:
                            _entry["t6688"] = _summary
                default_models.append(_entry)
                seen.add(mid)
    except Exception as e:
        logger.warning("从数据库加载模型失败: %s", e)

    # 模型可用性过滤(2026-07-31 立,用户规则:只显示可完美接通调用的模型)
    # stub 模式下绕过过滤(本地开发无 key,所有模型都不可用会被过滤光)
    stub_mode = llm_gateway._is_stub_mode()
    total_before = len(default_models)
    if not stub_mode:
        from ..services.model_availability import model_availability
        default_models = model_availability.get_available_models(default_models)
        filtered_out = total_before - len(default_models)
        logger.info(
            "[llm/models] availability filter: %d → %d (filtered out %d unavailable)",
            total_before, len(default_models), filtered_out,
        )
    # H5(Phase C,2026-08-01):为每个模型附加 caps 字段(provider capability 声明)。
    # 优先用 default_models.json 中已静态声明的 caps(H5 已给每个模型条目加 caps),
    # DB 同步的模型(无 caps 字段)按 provider_code 从 PROVIDER_CAPS 动态推导。
    # P0(2026-07-31):同步附加 points_multiplier 字段(积分消耗倍数,5 档梯度),
    # 由 free_provider_registry.infer_points_multiplier(model.id) 推断,前端按倍数显示积分消耗。
    from ..services.free_provider_registry import infer_points_multiplier
    for m in default_models:
        if not m.get("caps"):
            # DB 同步的模型无 caps 字段,按 provider_code 动态推导
            provider_code = str(m.get("provider") or "")
            cap = get_provider_cap(provider_code)
            # 模型级 context_length 覆盖 provider 默认 max_context
            ctx_len = m.get("context_length")
            if isinstance(ctx_len, int) and ctx_len > 0:
                cap = cap_with_max_context(cap, ctx_len)
            m["caps"] = cap_to_dict(cap)
        # 积分消耗倍数(0.0 免费 / 1.0 经济 / 3.0 标准 / 10.0 高级 / 30.0 旗舰)
        m["points_multiplier"] = infer_points_multiplier(str(m.get("id") or ""))

    # 2026-08-29 立:模型分类(用途 category + 代次 model_tier)。
    # 解决"聊天模型选择器塞满历史过时模型"——默认只展示 model_tier=latest,
    # 其余收进前端"历史模型"折叠区,并按用途分类标注(嵌入/语音/图像等)。
    # 分类引擎详见 app/services/model_catalog.py;失败时降级为全部 standard,
    # 保证老前端(不认识这两个字段)行为不变。
    try:
        from ..services.model_catalog import annotate_models

        annotate_models(default_models)
    except Exception as e:  # pragma: no cover - 分类失败不应让模型列表整体不可用
        logger.warning("[llm/models] 模型分类失败,降级为全部 standard: %s", e)
        for _m in default_models:
            _m.setdefault("category", "chat")
            _m.setdefault("model_tier", "standard")

    # 2026-08-05 安全红线:非系统内置管理员过滤受限模型(真实付费 key 模型)。
    # 与 /llm/complete(/stream) 的 _ensure_restricted_model_access、8802 列表过滤三端一致。
    # system-worker 内部凭证同样过滤(它不应出现在普通列表,8802 /models 也不用于后台任务)。
    uid = getattr(request.state, "user_id", None)
    if uid and uid != "system-worker":
        try:
            from ..core.db_pool import get_shared_pool

            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT is_system_admin FROM users WHERE id = $1", uid
                )
            is_admin = bool(row and row["is_system_admin"])
            if not is_admin:
                default_models = [
                    m for m in default_models if not _is_restricted_model(str(m.get("id") or ""))
                ]
        except Exception as e:
            logger.warning("[model-access] /llm/models 角色过滤异常: %s", e)
    return {
        "models": default_models,
        "default": settings.litellm_model,
        "stub_mode": stub_mode,
    }


@router.get("/llm/providers/availability", response_model=None)
async def list_providers_availability() -> dict[str, Any]:
    """模型可用性服务健康状态摘要(供 Dashboard 调试 + 用户透明可见)。

    返回 ModelAvailabilityService 缓存的 provider 健康状态:
    - providers[]:每个 provider 的 status/latency_ms/last_check/error
    - summary:healthy/degraded/down/local/zero_cost 计数

    用于让用户理解"为什么某些模型不显示"——因为对应 provider 健康检查失败。
    """
    from ..services.model_availability import model_availability
    return _wrap_ok(model_availability.get_health_summary())


@router.post("/llm/models/sync", response_model=None)
async def sync_models(provider: str | None = None, dry_run: bool = False) -> dict[str, Any]:
    """手动触发模型自动同步(可选 provider 定向 + dry_run 预览)。

    - 不传 provider:全量同步所有已配置 key 的 provider
    - 传 provider=xxx:只同步该 provider(F2.1)
    - dry_run=true:只预览不写入 DB,返回将新增/下架的 model_id 列表(F2.2)

    返回同步状态(含每个 provider 的结果 + preview 字段)。
    """
    from ..services.model_sync import model_sync_service
    if provider:
        status = await model_sync_service.sync_single_provider(provider, dry_run=dry_run)
    else:
        status = await model_sync_service.sync_all_providers(dry_run=dry_run)
    return _wrap_ok(status)


@router.get("/llm/models/sync/history", response_model=None)
async def get_sync_history(limit: int = 20) -> dict[str, Any]:
    """查询同步历史记录(最近 N 次,从 ai_model_sync_log 表读取,F1.3)。

    返回字段:
    - provider_code: provider 唯一标识
    - sync_started_at / sync_finished_at: ISO 8601 时间戳
    - success: 是否成功
    - total_models / new_models / removed_models: 模型计数
    - error: 错误信息(成功时为空)
    - latency_ms: 同步耗时
    """
    from ..services.model_sync import model_sync_service
    return _wrap_ok(await model_sync_service.get_history(limit=limit))


@router.get("/llm/models/sync/status", response_model=None)
async def get_models_sync_status() -> dict[str, Any]:
    """查询模型同步状态(最近一次同步时间 + 每个 provider 的结果)。

    返回字段:
    - last_sync_at: ISO 8601 时间戳
    - last_sync_duration_ms: 同步耗时
    - total_providers / total_new_models / total_removed_models: 汇总计数
    - is_syncing: 当前是否正在同步(防止并发触发)
    - results[]: 每个 provider 的同步结果
    """
    from ..services.model_sync import model_sync_service
    return _wrap_ok(model_sync_service.get_status())


@router.get("/llm/models/sync/health", response_model=None)
async def get_sync_health() -> dict[str, Any]:
    """查询每个 provider 的健康状态(F4.7 连续失败计数 + 永久禁用列表)。

    返回字段:
    - failure_counters: {provider_code: 连续失败次数, ...}
    - permanently_disabled: [provider_code, ...] 永久禁用的 provider 列表
    - failure_threshold: 触发 unhealthy 的连续失败阈值(默认 3)
    """
    from ..services.model_sync import model_sync_service
    return _wrap_ok(model_sync_service.get_health())


class SyncConfigUpdateRequest(BaseModel):
    """同步配置运行时更新请求(v4 深度优化)。

    两个字段都可选,但至少传一个。由 PUT /llm/models/sync/config 端点接收。
    """

    interval_s: int | None = Field(None, description="同步间隔(秒),>0 且 <=86400(最大 24 小时)")
    concurrency: int | None = Field(None, description="并发限流,>0 且 <=20")


@router.post("/llm/models/sync/reset", response_model=None)
async def reset_sync_provider(provider: str) -> dict[str, Any] | JSONResponse:
    """重置 provider 的失败计数 + 从永久禁用列表移除,允许重新同步(v4 深度优化)。

    用途:provider 因连续失败被永久禁用后,admin 调此端点重置状态,
    允许下次同步周期重新拉取。

    Query param:
        provider: provider_code(必填),如 stepfun / openai / cloudflare_workers_ai。

    返回字段:
        - provider_code: 重置的 provider 标识
        - reset: True(固定)
        - previous_failures: 重置前的连续失败次数
        - was_disabled: 重置前是否在永久禁用列表中
    """
    from ..services.model_sync import model_sync_service
    data = model_sync_service.reset_provider(provider)
    return _wrap_ok(data)


@router.put("/llm/models/sync/config", response_model=None)
async def update_sync_config(req: SyncConfigUpdateRequest) -> dict[str, Any] | JSONResponse:
    """运行时更新同步间隔 + 并发限流(无需重启 ai-service,v4 深度优化)。

    请求体(两个字段都可选,但至少传一个):
        {"interval_s": 21600, "concurrency": 5}

    参数校验:
        - interval_s: 必须 > 0 且 <= 86400(最大 24 小时)
        - concurrency: 必须 > 0 且 <= 20

    返回字段:
        - interval_s: 当前生效的同步间隔(秒)
        - concurrency: 当前生效的并发限流
        - applied: True(固定)

    错误:
        - 400: 参数校验失败(interval_s 超出范围 / concurrency 超出范围 / 两个字段都为 None)
    """
    if req.interval_s is None and req.concurrency is None:
        return _error_json("interval_s 和 concurrency 至少传一个", 400)
    from ..services.model_sync import model_sync_service
    try:
        data = model_sync_service.update_config(
            interval_s=req.interval_s, concurrency=req.concurrency
        )
        return _wrap_ok(data)
    except ValueError as e:
        return _error_json(str(e), 400)


@router.get("/llm/models/sync/stats", response_model=None)
async def get_sync_stats(days: int = 7) -> dict[str, Any]:
    """查询最近 N 天的聚合统计(成功率、平均延迟、新增/下架模型数,v4 深度优化)。

    查询 ai_model_sync_log 表,聚合计算同步成功率、平均/最大/最小延迟、
    新增/下架模型总数,并按 provider_code 分组输出 by_provider 列表。

    Query param:
        days: 查询天数(可选,默认 7,最大 90)。

    返回字段:
        - days: 实际查询天数
        - total_syncs / success_count / failure_count / success_rate: 同步结果汇总
        - avg_latency_ms / max_latency_ms / min_latency_ms: 延迟统计
        - total_new_models / total_removed_models: 模型变更汇总
        - by_provider[]: 按 provider_code 分组的聚合统计(含 last_sync_at)
    """
    from ..services.model_sync import model_sync_service
    data = await model_sync_service.get_aggregated_stats(days=days)
    return _wrap_ok(data)


@router.delete("/llm/models/sync/history", response_model=None)
async def delete_sync_history(before_days: int = 30) -> dict[str, Any]:
    """清理 N 天前的同步日志(防止 ai_model_sync_log 表无限增长,v4 深度优化)。

    Query param:
        before_days: 清理多少天前的日志(可选,默认 30,最小 1)。

    返回字段:
        - deleted_count: 删除的记录数
        - before_days: 清理的天数阈值
    """
    from ..services.model_sync import model_sync_service
    data = await model_sync_service.cleanup_old_logs(before_days=before_days)
    return _wrap_ok(data)


@router.post("/llm/complete/stream", response_model=None)
async def complete_stream(req: LLMCompleteRequest, request: Request) -> StreamingResponse | JSONResponse:
    """流式 LLM 调用(原生 token 级流式 + SSE event 字段 + 心跳保活)。

    事件类型:
    - event: chunk  — 逐 token 内容 {"content": "..."}
    - event: done   — 完成 {"model": ..., "usage": ..., "stub": bool, "metadata": {...}}
    - event: error  — 错误 {"message": "...", "errorCode": "..."}

    错误标准化(P1 流式配套,2026-07-22 立):
    - MODEL_NOT_CONFIGURED(api_key 缺失):在返回 StreamingResponse 前做 pre-flight check,
      直接返回 HTTP 422 + JSON,不进入流(因为 StreamingResponse 一旦开始 yield,
      HTTP 状态码已锁定 200,无法中途变更)。
    - PROVIDER_NOT_IMPLEMENTED / LLM_ERROR(运行时错误):无法 pre-flight,仍走流内
      event: error(含 errorCode 字段),前端 api-client parseStreamLine → attachErrorMeta
      透传 errorCode 到 Error 对象 → onError 回调。
    """

    # 2026-09-13 立:入站模型名官方改写(大小写归一),须在受限模型权限判定前完成,
    # 让权限判定与后续链路共用同一个归一值。
    # model 为可选字段(None = 由下游选默认模型),此时保持 None 不改写。
    if req.model:
        req.model = to_official_model_name(req.model)
    # D159 接手修复(2026-09-30):前一代理在本文件合入 D130 档位改动时**误删了这行初始化**,
    # 导致 complete_stream 全程 `name 'accumulated' is not defined`(stream gen 直接崩,
    # D158 的 4 个 grant 测试因此整片红)。恢复 HEAD 原形,位置与 HEAD 逐字一致。
    accumulated: dict[str, Any] = {"content": "", "reasoning": "", "model": req.model, "usage": None, "stub": False}
    await _ensure_restricted_model_access(request, req.model)
    owner_uuid = _resolve_owner_uuid(request)
    # D130(2026-09-30 立):整条流共用一次档位解析(生效值 + 回落通知)。
    # 算在 gen() 之外:done 帧有三处产出点,它们都闭包读这两个量,不得各算各的。
    _reasoning_effort_effective, _reasoning_effort_notice = _resolve_reasoning_effort(req)
    # P3 3-4-A(2026-09-17 拍板):新用户免费试用额度检查(env USER_TRIAL_DAILY_TOKENS,0=关闭)
    trial = await user_trial_quota.check(owner_uuid)
    if not trial["allowed"]:
        return _error_json(
            "今日免费额度已用完,明天自动恢复;可在模型设置中配置自己的 API Key 获得无限额度",
            429,
            errorCode="TRIAL_QUOTA_EXCEEDED",
            usage=trial,
        )
    # D10(2026-09-19 立):跨会话记忆自动沉淀。每 N 轮用户消息后台触发一次,
    # 抽取会话近期消息写入长期记忆。fire-and-forget,失败静默,零主链路影响。
    try:
        from ..services.memory_sedimenter import maybe_sediment

        await maybe_sediment(
            str((req.metadata or {}).get("conversationId") or owner_uuid or ""),
            owner_uuid,
            recent_messages=req.messages,
        )
    except Exception as e:  # 防御:沉淀入口绝不阻塞主聊天
        logger.warning("memory_sedimenter 入口异常(已忽略): %s", e)
    # 2026-08-06 修复:透传用户角色给 call_tool(权限矩阵),否则 admin 也按 role=0 拒绝
    user_role = _resolve_user_role(request)
    # ChatMode 模式注入(2026-09-13 矩阵 A #24):mode 优先于 legacy plan_mode。
    # plan → Plan Mode 引导;ask/review/spec → 对应模式引导;build/None → 原样返回。
    # 注入在 _inject_workspace_memory 之前,确保模式引导位于 system prompt 最顶部。
    chat_mode = _resolve_chat_mode(req.mode, req.plan_mode)
    if chat_mode == "plan":
        messages = _inject_plan_mode_prompt(req.messages, "plan")
    elif chat_mode in _CHAT_MODE_PROMPTS:
        messages = _inject_system_prefix(req.messages, _CHAT_MODE_PROMPTS[chat_mode])
    else:
        messages = req.messages
    # 工作区上下文注入:若 workspace_path 提供且存在 CLAUDE.md/AGENTS.md,合并到 system message
    messages = _inject_workspace_memory(messages, req.workspace_path, req.workspace_context)
    # P1-8(2026-09-13 立,Repo Wiki):项目百科独立注入(紧邻工作区记忆,互不影响)
    messages = _inject_repo_wiki(messages, req.wiki_context, req.wiki_repo)
    # D9(2026-09-19 立):Repo Wiki 自动 wiki 化注入(紧邻手动 wiki 路径,互不影响)
    messages = await _maybe_inject_auto_repo_wiki(messages, req)
    # P1 #41 阶段3 增强(2026-09-17 立):相关记忆子图自动注入(全降级,零主链路影响)
    messages = await _inject_memory_graph(
        messages, _last_user_text(messages), _resolve_owner_uuid(request)
    )
    # P1-7(2026-09-13 立):会话级自定义 system prompt,叠加在工作区记忆之上(置顶优先级最高)
    messages = _inject_custom_system_prompt(messages, req.system_prompt)
    # D7(2026-09-19 立):主聊天自动语义检索注入(对标 Cursor @codebase 自动注入)。
    # 普通对话且工作区路径存在、索引可用时,首答前自动检索 top-k 代码块注入 system。
    # 开关:autoContext=false 关闭;IHUI_AUTO_CONTEXT_DISABLE=1 全局禁用(auto_context 模块内生效)。
    # 防重复:同一会话同一 query 60s 内不重复检索(auto_context 模块内 LRU)。
    # 全 try/except 静默降级:检索失败/异常绝不阻塞主聊天。
    auto_context_hits = 0
    if (req.autoContext is not False) and req.workspace_path:
        try:
            from ..core.auto_context import auto_retrieve as _ac_retrieve
            from ..core.auto_context import format_auto_context_block as _ac_format
            _ac_query = _last_user_text(messages)
            if _ac_query:
                _ac_session_id = (
                    req.metadata.get("conversationId")
                    if isinstance(req.metadata, dict)
                    else None
                )
                _ac_chunks = await _ac_retrieve(_ac_query, req.workspace_path, session_id=_ac_session_id)
                _ac_block = _ac_format(_ac_chunks) if _ac_chunks else None
                if _ac_block:
                    auto_context_hits = len(_ac_chunks)
                    if messages and messages[0].get("role") == "system":
                        messages[0] = {
                            **messages[0],
                            "content": f"{messages[0]['content']}\n\n{_ac_block}",
                        }
                    else:
                        messages.insert(0, {"role": "system", "content": _ac_block})
        except Exception as _ac_err:  # 静默降级,绝不阻塞主聊天
            logger.warning("auto_context inject skipped: %s", _ac_err)
    # D34(2026-09-22,G-40):把"本轮到底给模型注入了什么"交代成帧,在 gen() 首帧前发出。
    # 判定只复用注入器既有的去重 marker 与请求字段,不给任何注入器加新状态:
    # 手动 wiki `<!-- repo_wiki:{repo} -->` / 自动 wiki `<!-- repo-wiki-auto -->` /
    # 工作区记忆 `<!-- workspace:{label} -->`;auto_context 命中数由上方块内记录。
    _system_blob = "\n".join(
        str(_m.get("content", "")) for _m in messages if _m.get("role") == "system"
    )
    injection_frames: list[dict[str, Any]] = []
    # G-166 第⑥步:网关换 key / 退避重试的记账(逐条累积,落库取最后一条 = attempt 最大那条)
    retry_notices: list[dict[str, Any]] = []
    # D33 剩余类(2026-09-24 立):steer(中途引导)注入记录。tool loop drain 注入点
    # (SSE steer phase=injected 同一循环)逐条累积,随终局 _fire_callback 落库,
    # 刷新/重拉历史后「⚡ 引导已生效」badge 仍可回放。空列表不写字段(与"本轮无引导"语义区分)。
    steer_applied: list[dict[str, Any]] = []
    # kind 是**前端本地化的键**(措辞由 5 语言词表给出),collapsed 只作未知 kind 的兜底文本。
    # 因此:① kind 必须逐场景互不相同(曾把 Repo Wiki 与自动检索都写成 environments,
    # 前端无法区分);② 改 kind 必须同步 apps/web 的 INJECTION_KIND_KEYS 与词表。
    if req.system_prompt and str(req.system_prompt).strip():
        _instr_text = str(req.system_prompt)
        # fullText 只在"能整段给出"时携带:不给 = 界面无可展开入口(不以截断文本冒充全文)
        if len(_instr_text) <= INJECTION_FULLTEXT_LIMIT:
            injection_frames.append(
                {
                    "type": SSE_INJECTION_APPLIED,
                    "kind": "developer_instructions",
                    "collapsed": "已应用会话级自定义指令",
                    "fullText": _instr_text,
                }
            )
        else:
            injection_frames.append(
                {
                    "type": SSE_INJECTION_APPLIED,
                    "kind": "developer_instructions",
                    "collapsed": "已应用会话级自定义指令",
                }
            )
    if "<!-- workspace:" in _system_blob:
        injection_frames.append(
            {
                "type": SSE_INJECTION_APPLIED,
                "kind": "workspace_memory",
                "collapsed": "已注入工作区记忆 / AGENTS.md 上下文",
            }
        )
    if "<!-- repo_wiki:" in _system_blob or "<!-- repo-wiki-auto -->" in _system_blob:
        injection_frames.append(
            {
                "type": SSE_INJECTION_APPLIED,
                "kind": "repo_wiki",
                "collapsed": "已注入 Repo Wiki 项目百科",
            }
        )
    if auto_context_hits:
        injection_frames.append(
            {
                "type": SSE_INJECTION_APPLIED,
                "kind": "auto_context",
                "collapsed": f"已自动检索并注入 {auto_context_hits} 段代码上下文",
                "count": auto_context_hits,
            }
        )
    # 跨端统一 88% 阈值自动压缩(Python 端兜底,API 层未压缩时由本层保护)
    compaction_info: dict[str, Any] | None = None
    if req.context_limit and req.context_limit > 0:
        original_messages = messages
        _compact_started = time.perf_counter()
        messages, compaction_info = compress_messages_if_needed(messages, req.context_limit)
        # P1-②(2026-09-18)决策链保留:同 /v1/chat 主路径 —— 蒸馏 head 段推理注入摘要消息
        # (纯确定性、零 LLM;任何不适用/异常场景都退化为与现状逐零差异),并自证推理保留率。
        if compaction_info.get("compressed"):
            messages, _chain_meta = apply_decision_chain(messages, original_messages)
            if _chain_meta.get("injected"):
                compaction_info["decision_chain"] = {
                    "entries": _chain_meta.get("entries"),
                    "fresh": _chain_meta.get("fresh"),
                    "carried": _chain_meta.get("carried"),
                }
                compaction_info["reasoning_retention"] = (
                    _chain_meta.get("reasoning_retention") or {}
                )
        _compact_duration_ms = (time.perf_counter() - _compact_started) * 1000
        if compaction_info.get("compressed"):
            # 压缩回捞:把被移除旧消息异步快照入向量库(不阻塞主链路)
            _snapshot_compaction_if_needed(
                original_messages=original_messages,
                compressed_messages=messages,
                compaction_info=compaction_info,
                session_id=(
                    req.metadata.get("conversationId")
                    if isinstance(req.metadata, dict)
                    else None
                ),
                user_id=owner_uuid,
            )
            # P0-1 压缩闭环:登记到 /api/context-compaction 感知面板
            _record_compaction_step(
                compressed_messages=messages,
                compaction_info=compaction_info,
                session_id=(
                    req.metadata.get("conversationId")
                    if isinstance(req.metadata, dict)
                    else None
                ),
                user_id=owner_uuid,
                duration_ms=_compact_duration_ms,
            )

    # P1 流式配套 pre-flight check:检测 api_key 缺失(MODEL_NOT_CONFIGURED),
    # 在返回 StreamingResponse 前直接返回 422 JSON,避免流式开始后只能推 event: error。
    # stub 模式下无需 api_key(返回模拟响应),跳过 pre-flight。
    if not llm_gateway._is_stub_mode():
        try:
            _api_key, _, _, _ = await llm_gateway._resolve(req.model or settings.litellm_model, owner_uuid)
        except Exception as e:
            logger.warning("stream pre-flight _resolve failed: %s", e)
            _api_key = None
        if not _api_key:
            err_msg = (
                f"模型 {req.model or settings.litellm_model} 对应的 provider API key 未配置,"
                f"请在 .env 或 ai_model_config 表中设置"
            )
            logger.warning(
                "stream pre-flight blocked: model=%s code=MODEL_NOT_CONFIGURED",
                req.model,
            )
            return JSONResponse(
                status_code=422,
                content={
                    "errorCode": "MODEL_NOT_CONFIGURED",
                    "message": err_msg,
                    "model": req.model,
                },
            )

    async def gen() -> AsyncIterator[str]:
        # 提问标记解析器:检测 LLM 输出中的 [[ASK_USER:JSON]] 标记,转换为结构化 question 事件
        # 标记本身从内容中剥离,不污染对话文本;跨 chunk 分片自动累积
        question_parser = QuestionStreamParser()
        # 工具调用历史(2026-07-31 立,A2 任务:tool-summary SSE 事件聚合统计用)
        # 每次 tool-call-start 事件发出时 append 一条记录,tool-result 事件到达时更新 result/durationMs/isError。
        # 在 SSE 流末尾(每个 done 事件之前)聚合统计,发出 tool-summary 事件。
        tool_calls_history: list[dict[str, Any]] = []
        # D24(2026-09-19 立):终端任务持久化收集器。
        # 各 terminal_end SSE 产出点同步 append(_build_terminal_task 构造,
        # 与 SSE 事件同源同截断),流收尾随 _fire_callback 落库到 metadata.terminalTasks。
        terminal_tasks_history: list[dict[str, Any]] = []
        # D33(2026-09-23 立):过程性信息持久化补全 —— fallback / memoryUpdates / usageDetail
        # 收集器(与 toolCalls / planSteps 同一套 keyword-only 扩参落库语义)。
        # - fallback_records:tool loop 每轮 drain 的 SSE fallback 事件(最后一个即最终降级),
        #   流收尾随 _fire_callback 落库到 metadata.fallback。
        # - _mem_updates:done 前同步提炼的长期记忆条目(done.memoryUpdates 同源),落库供回放。
        # - _usage_detail:流收尾 usage 帧同源的用量明细(token 分项 + 计时 + 成本),落库供回放。
        fallback_records: list[dict[str, Any]] = []
        _mem_updates: list[str] = []
        _usage_detail: dict[str, Any] | None = None
        # W1(2026-09-12 立):前端 assistant 消息 ID。plan_updated / terminal_* 事件必须携带,
        # 否则前端 onPlanUpdate/onTerminalStart/onTerminalEnd 回调的 messageId 守卫会丢弃事件。
        message_id = _resolve_message_id(req.metadata)
        # D1(2026-09-19 立):消息级 usage 计量帧计时。
        # _stream_started:gen 起始(请求起始);_first_token_ts:首个正文(chunk)增量时间戳。
        # 流收尾(finally)处据此计算 firstTokenMs / durationMs 并发出一帧 event: usage。
        _stream_started = time.perf_counter()
        _first_token_ts: float | None = None

        # D34(2026-09-22,G-40):上下文注入交代帧必须是**流上最早的业务帧**(先于任何 chunk/工具帧),
        # 前端才能把它排在"本轮开始"处;每帧补 messageId,与 plan_updated/terminal_* 同一守卫口径。
        for _inj in injection_frames:
            yield _sse(SSE_INJECTION_APPLIED, {**_inj, "messageId": message_id})

        def _mark_first_token() -> None:
            """记录首个正文(chunk)增量时间戳(幂等,仅首次调用生效)。"""
            nonlocal _first_token_ts
            if _first_token_ts is None:
                _first_token_ts = time.perf_counter()

        # MCP 工具调用取消闭环(2026-09-19 立):本流 in-flight 工具任务追踪器。
        # dispatch_subagent / call_tool 等工具任务创建时登记,流收尾(finally,
        # 覆盖正常 done / error / 客户端断开取消 / GeneratorExit)统一 cancel,
        # 防孤儿工具任务在客户端已断开后继续跑完(浪费额度/留脏状态)。
        _inflight_tool_tasks = _InflightToolTasks()

        # 阶段 2:浏览器端工具委托 session_id(workspace_context 模式下生成)
        session_id: str | None = None
        if req.streamSessionId:
            # Steer(2026-09-19 立):优先使用调用方(网关)预生成的流会话 ID ——
            # 网关已把它存进 StreamSession.upstreamSessionId,中途引导请求凭
            # replayKey(conversationId:messageId)在网关侧找回并转发到本流。
            session_id = req.streamSessionId
        elif req.workspace_context:
            session_id = str(uuid.uuid4())
        # Steer(2026-09-19 立):注册引导队列(空列表即"流活跃"标记)。
        # gen() 首次被 StreamingResponse 迭代即执行,先于任何工具调用;
        # steer 端点据此区分 200(流活跃,入队)/404(流不存在或已结束)。
        if session_id:
            _steer_sessions[session_id] = []

        def _grants_bucket() -> str:
            """本轮审批授权的落点桶(见 `_grant_bucket_key` 头注)。

            刻意写成闭包而不是把键存成变量:`session_id` 在两个惰性兜底处会从 None
            变成新 uuid4,存下来的键会与真正用于回传的那个 id 分叉。
            归属(owner/conv)齐 ⇒ 会话桶(跨轮存活);缺 ⇒ 本轮桶(与改前逐字同形)。
            """
            return _grant_bucket_key(
                owner_uuid,
                str((req.metadata or {}).get("conversationId") or ""),
                session_id,
            )
        # D152(2026-09-29 立):goal 主副本的**流内推送口**。按 conversationId 注册
        # (不是 streamSessionId —— REST 写入口拿的是会话 id,同一会话的多条流都要收到),
        # 与 _steer_sessions 同一生命周期、在同一个 finally 里摘除。
        from ..services.agent_events import (
            drain_goal_updates as _drain_goal_updates,
        )
        from ..services.agent_events import (
            register_goal_listener as _register_goal_listener,
        )
        from ..services.agent_events import (
            unregister_goal_listener as _unregister_goal_listener,
        )

        _goal_conversation_id = str((req.metadata or {}).get("conversationId") or "")
        _goal_queue = _register_goal_listener(_goal_conversation_id)
        # 流首带出当前目标:新接入的端不必等下一次 set 就能看到"这个会话正在追什么"。
        # 取不到(会话无引擎线程行 / 无 goal / 主副本坏了)一律静默跳过 —— 一帧都没有
        # 是本来的形状,不得为这一格把整条流改判成 error。
        try:
            if _goal_conversation_id:
                from ..routers.sessions import get_session_store as _get_session_store

                _goal_store = _get_session_store()
                _goal_thread_id = _goal_store.resolve_thread_id_for_conversation(_goal_conversation_id)
                _goal_state = _goal_store.get_thread_goal_state(_goal_thread_id or "")
                if _goal_state:
                    yield _sse(
                        "goal_updated",
                        {
                            "type": "goal_updated",
                            "sessionId": _goal_conversation_id,
                            "status": _goal_state["status"],
                            "objective": _goal_state.get("objective", ""),
                            "updatedAt": _goal_state.get("updatedAt"),
                        },
                    )
        except Exception as _goal_seed_err:
            logger.info("goal 流首帧取不到(已忽略): %s", _goal_seed_err)
        # 2026-08-31 原生 function calling:标记服务端 agent tool loop 是否执行。
        # 执行过则 messages 已归一化且工具循环结束,generic astream 不再带 tools;
        # 未执行(generic 路径)则透传请求体的 tools/tool_choice 给 astream。
        _agent_tool_loop_ran = False
        # G-815975:生成器是否正被"无消费者"地关闭(GeneratorExit/客户端断开取消)。
        # 此时 finally 不允许 yield,dropped 显式回报降级为日志留痕。
        _stream_exiting = False
        # 借来的异步生成器(本流下方 astream)的句柄:先置 None,让末尾 finally 在
        # "尚未创建生成器"的路径上也能安全引用 —— llm_gateway 里记过一次同型
        # UnboundLocalError(except/finally 引用了只在 try 内赋值的局部量)。
        _native_fc_stream: AsyncIterator[dict[str, Any]] | None = None
        try:
            # 若发生压缩(或压缩已撞到上限),通过 SSE 首事件通知调用方
            _compaction_sse = _compaction_frame(compaction_info)
            if _compaction_sse:
                yield _compaction_sse

            # ===== Agent tool loop(2026-07-22 立,AI 浏览器/电脑控制)=====
            # 当请求携带 agent_tools(工具名列表)时:
            # 1. 从 mcp_server 加载完整 schema,转换为 OpenAI tools 格式
            # 2. 调 llm_gateway.complete() 带 tools,获取 LLM 决策(tool_calls)
            # 3. 如有 tool_calls:推送 SSE 事件 → 执行工具 → 回灌结果 → 继续 astream 生成最终回复
            # 4. 如无 tool_calls:推送 content + done,跳过 astream
            # ask 模式(2026-09-13 矩阵 A #24):纯问答禁工具,即使携带 agent_tools 也跳过 tool loop
            #
            # 服务端自主补全(2026-09-21 立):原先"要不要给 AI 操控本站的工具"完全由客户端
            # 一张关键词表决定(agent_tools 为空就根本不进本 if),用户没说中那几个词整条链静默
            # 失效。现在服务端自己也判一次 —— 意图复用 conversation 的强信号正则,工具族只给
            # **该用户此刻真在线的端**(查 status 得到),查不到就一律不加,绝不为这一步打断聊天。
            # ask 模式下保持 None ⇒ 与原语义逐字一致(纯问答永不进 tool loop)。
            agent_tools: list[str] | None = None
            if chat_mode != "ask":
                from ..services.control_autonomy import (
                    augment_agent_tools,
                    filter_unauthorized_page_tools,
                )

                agent_tools = await augment_agent_tools(
                    req.agent_tools,
                    _last_user_text(messages),
                    _resolve_owner_uuid(request),
                )
                # 页面句柄族闸(2026-09-25 立):客户端可以带着 browser_page_* 来,但该用户此刻
                # 没有"申报了 browserPageActions 的扩展端"在线就摘掉 —— 服务端自主注入那四族
                # 应用内 UI 不覆盖这一族(它读的是任意站点,必须显式授权 + 端申报双条件)。
                agent_tools = await filter_unauthorized_page_tools(
                    agent_tools, _resolve_owner_uuid(request)
                )
                # V3 #53(2026-09-26 立,2026-09-27 归一到矩阵):ChatMode 工具硬收窄 —— 第一道闸。
                # 此前 mode 只有提示词软注入("只制定计划不调用工具"),用户选了
                # plan/review 模型照样拿到写类工具,权限承诺与实际不符。现在在
                # 发给 LLM 前按 (mode × permission_mode) 矩阵过滤:plan/review 收窄为
                # READONLY_TOOLS 交集(与 AgentLoopV2 plan 档同源同语义)。
                # 必须在 augment 之后过滤:服务端自主补全的浏览器/电脑控制族同样受约束。
                # ask 模式上游 if 已置 None(不进 tool loop),无需再过滤。
                agent_tools = _filter_agent_tools_for_chat_mode(
                    chat_mode, agent_tools, getattr(req, "permission_mode", None)
                )
            if agent_tools:
                from ..services.mcp_server import mcp_server as _mcp
                all_tools = _mcp.list_tools()
                tool_map = {t.name: t for t in all_tools}
                openai_tools: list[dict[str, Any]] = []
                for _name in agent_tools:
                    _t = tool_map.get(_name)
                    if _t:
                        openai_tools.append({
                            "type": "function",
                            "function": {
                                "name": _t.name,
                                "description": _t.description,
                                "parameters": _t.input_schema,
                            },
                        })

                if openai_tools:
                    _agent_tool_loop_ran = True
                    # ===== 多 agent 编排引导注入(2026-07-24 立)=====
                    # 当 dispatch_subagent 在 agent_tools 中时,在 tool loop 开始前注入引导 system message,
                    # 引导 LLM 在复杂任务时主动派发子智能体。注入只发生一次,不随 iteration 重复。
                    # 注入策略与 _inject_workspace_memory 一致:messages[0] 为 system 则追加,否则在开头插入。
                    if "dispatch_subagent" in agent_tools:
                        _subagent_prompt = _build_subagent_orchestration_prompt()
                        if messages and messages[0].get("role") == "system":
                            _existing = messages[0].get("content", "")
                            _merged = f"{_existing}\n\n{_subagent_prompt}" if _existing else _subagent_prompt
                            messages[0] = {**messages[0], "content": _merged}
                        else:
                            messages.insert(0, {"role": "system", "content": _subagent_prompt})

                    # ===== 多轮 tool loop(2026-07-22 升级,支持 AI 连续操作:截图→分析→点击→再截图)=====
                    # 每轮:complete(tools) → 执行 tool_calls → 回灌结果
                    # 直到 LLM 不再决策 tool_calls 或达到 max_iterations → 归一化 → astream 生成最终回复
                    # 2026-07-24 修复:从 settings.max_agent_iterations 读取(原硬编码 3,无法覆盖多步操作)
                    max_iterations = settings.max_agent_iterations
                    # 重复调用检测集合(2026-07-24 立,修复 stepfun/step-router-v1 在 tool loop 中重复调用
                    # search_codebase(query="config") 8 次耗尽 max_iterations 的问题):
                    # - executed_tool_keys:本轮 tool loop 内已执行过的 (tool_name, args_hash) 集合,命中则跳过执行
                    # - injected_warning_keys:已注入过 system 提示的 key 集合(每个 key 只注入一次,避免每轮重复注入)
                    # 每次 /llm/complete/stream 请求独立(集合在 tool loop 进入时初始化为空)
                    executed_tool_keys: set[str] = set()
                    injected_warning_keys: set[str] = set()
                    # Steer(2026-09-19 立):迭代预算动态化(原 for-range 不可延长)。
                    # 每注入一条引导消息延长一轮,防止引导恰好落在最后一轮工具执行期间
                    # 被 max_iterations 截断(前端"排队中"badge 永远等不到"已注入")。
                    _iter_budget = max_iterations
                    _tool_iter = 0
                    # D120:续期计数(0 = 未续期;上限 _ITERATION_EXTEND_LIMIT)
                    _iteration_extensions_used = 0
                    # G-815971:本轮(整条流)是否已因限额/配额收口 —— 一次命中,
                    # 整轮闩死(续期与 hook 注入一并排除,防"额度在这轮里被烧")。
                    _budget_exhausted_this_turn = False
                    # D120 判定在轮首读上一轮工具结果;初始化提到 while 前,
                    # 让首轮的绑定静态可证(此前靠 _tool_iter=0 短路,首轮根本读不到)。
                    tool_exec_tracker: list[bool] = []
                    while _tool_iter < _iter_budget:
                        # ===== Steer(中途引导)注入点:每轮 LLM 调用前 drain =====
                        # 把流期间用户提交的引导消息注入 messages 尾部(上一轮工具结果之后,
                        # OpenAI 协议合法:user 可跟在 tool 结果后),不打断当前工具执行;
                        # 每条发一帧 event: steer(phase=injected) 通知前端换 badge。
                        # ===== D152:goal 主副本变更注入点(每轮 drain 一次,与 steer 同位)=====
                        # 别的端在同一个会话上 /goal 了什么,这一轮就上一屏 —— 票面验收①
                        # 要的是"不刷新即见",所以必须在流里发帧,不能只在流首带一次。
                        for _goal_payload in _drain_goal_updates(_goal_queue):
                            _goal_evt: dict[str, Any] = {
                                "type": "goal_updated",
                                "sessionId": _goal_payload.get("sessionId") or _goal_conversation_id,
                                "status": _goal_payload.get("status"),
                            }
                            for _goal_key in ("objective", "elapsedMs", "tokenUsage", "updatedAt"):
                                if _goal_payload.get(_goal_key) is not None:
                                    _goal_evt[_goal_key] = _goal_payload[_goal_key]
                            yield _sse("goal_updated", _goal_evt)
                        # G-815975:吸收改走类型轴 —— 只吸收队首连续的可 inline 条目;
                        # 遇 control(设置轮)条目即停,它之后的条目(哪怕 kind=guide)
                        # 本轮同样不得被吸收,留给收口回报路径按序处理。
                        if session_id and _steer_sessions.get(session_id):
                            for _st in _drain_inlineable_steers(session_id):
                                _steer_text = str(_st.get("text", "")).strip()
                                if not _steer_text:
                                    continue
                                messages.append({"role": "user", "content": _steer_text})
                                _steer_evt: dict[str, Any] = {
                                    "type": SSE_STEER,
                                    "phase": "injected",
                                    "text": _steer_text,
                                }
                                if _st.get("queuedAt"):
                                    _steer_evt["timestamp"] = _st["queuedAt"]
                                if message_id:
                                    _steer_evt["messageId"] = message_id
                                yield _sse(SSE_STEER, _steer_evt)
                                # D33:落库形状与 SteerNotice(web store)对齐 {text, timestamp?} ——
                                # messageId 是 store 寻址键,落库行天然按消息行寻址,不重复存。
                                steer_applied.append(
                                    {
                                        "text": _steer_text,
                                        **({"timestamp": _st["queuedAt"]} if _st.get("queuedAt") else {}),
                                    }
                                )
                                _iter_budget += 1
                        # ===== D120(2026-09-27,G-234):轮次预算弹性续跑 =====
                        # 判定收敛到唯一出口 _d120_should_extend(条件与原内联逐项一致):
                        # env 开关启用 / 非首轮 / 下一轮即触及上限 / 续期次数未用尽 /
                        # 上一轮确实执行了工具(tool_exec_tracker 为上一轮结果 ——
                        # while 内 for 前重置,此处读到的是上一轮值)。
                        # G-815971 追加排除条款:本轮因限额/配额收口(budget_exhausted)
                        # ⇒ 一票否决,续期与 hook 注入条目一并归零 —— 上限命中后只允许
                        # 这一轮纯文本说明,不得把已收口的 turn 延长成新的恢复循环。
                        # 动作:注入进度交代消息(天然随对话上下文持久化,回放可见) +
                        # _iter_budget += max_iterations(与 steer 的预算延长同一机制)+
                        # injection_applied 帧(kind=iteration_extension,开放字符串枚举)。
                        if _d120_should_extend(
                            tool_iter=_tool_iter,
                            iter_budget=_iter_budget,
                            extensions_used=_iteration_extensions_used,
                            tool_executed_last_round=bool(tool_exec_tracker),
                            budget_exhausted=_budget_exhausted_this_turn,
                        ):
                            _iteration_extensions_used += 1
                            _iter_budget += max_iterations
                            _ext_note = (
                                f"[系统] 已执行 {_tool_iter} 轮工具调用,接近轮次预算上限({max_iterations})。"
                                f"任务若尚未完成请继续;系统已追加续期预算"
                                f"(第 {_iteration_extensions_used}/{_ITERATION_EXTEND_LIMIT} 次)。"
                            )
                            messages.append({"role": "user", "content": _ext_note})
                            _ext_evt: dict[str, Any] = {
                                "type": SSE_INJECTION_APPLIED,
                                "kind": "iteration_extension",
                                "text": _ext_note,
                                "round": _tool_iter,
                                "extensionIndex": _iteration_extensions_used,
                                "extensionLimit": _ITERATION_EXTEND_LIMIT,
                            }
                            if message_id:
                                _ext_evt["messageId"] = message_id
                            yield _sse(SSE_INJECTION_APPLIED, _ext_evt)

                        # ===== 第一轮:流式化(2026-08-29 修复)=====
                        # 根因:tool loop 第一轮此前用非流式 complete(),LLM 无 tool_calls
                        # 直接回复时一次性 yield 整个 content → 前端"内容一下全出"而非打字机。
                        # 修复:第一轮改调带 tools 的 astream,逐 token 输出 content/reasoning,
                        # 同时收集 astream 在流结束前统一产出的完整 tool_calls(见 llm_gateway._accumulate_tool_calls)。
                        if _tool_iter == 0:
                            first_round_tool_calls: list[dict[str, Any]] = []
                            async for evt in llm_gateway.astream(
                                messages, model=req.model, owner_uuid=owner_uuid,
                                tools=openai_tools, tool_choice="auto",
                            ):
                                _evt_type = evt.get("type", "")
                                _note_retry(retry_notices, evt)
                                # G-815971:网关内部重试(httpStatus=429)与额度等效降级
                                # (reason=quota*)都是"限额命中且循环继续"的信号 ——
                                # 本轮续期通道一并闩死,防额度在续期轮里继续被烧。
                                if _evt_type == "retry_scheduled" and evt.get("httpStatus") == 429:
                                    _budget_exhausted_this_turn = True
                                elif _evt_type == "fallback" and str(
                                    evt.get("reason") or ""
                                ).startswith("quota"):
                                    _budget_exhausted_this_turn = True
                                if _evt_type == "chunk":
                                    # 逐 token 透传 + 提问标记解析(与 1144-1146 行格式一致)
                                    clean_text, questions = question_parser.feed(evt.get("content", ""))
                                    for q in questions:
                                        q_event = {"type": "question", "question": q.to_dict()}
                                        yield _sse(SSE_QUESTION, q_event)
                                    if clean_text:
                                        accumulated["content"] += clean_text
                                        chunk_event = {"type": "chunk", "content": clean_text}
                                        _mark_first_token()
                                        yield _sse(SSE_CHUNK, chunk_event)
                                elif _evt_type == "reasoning":
                                    # 思考过程逐 token 透传(与 1129-1130 行格式一致)
                                    _reasoning_token = evt.get("content", "")
                                    accumulated["reasoning"] += _reasoning_token
                                    _reasoning_evt = {"type": "reasoning", "content": _reasoning_token}
                                    yield _sse(SSE_REASONING, _reasoning_evt)
                                elif _evt_type == "tool_calls":
                                    # astream 统一在流结束前 yield 累积后的完整 tool_calls
                                    first_round_tool_calls = evt.get("tool_calls") or []
                                elif _evt_type == "done":
                                    # 记录 model/usage/stub(与 1162-1164 行一致)
                                    accumulated["model"] = evt.get("model", req.model)
                                    accumulated["usage"] = evt.get("usage")
                                    accumulated["stub"] = evt.get("stub", False)
                                    # G-425(2026-10-07 立,默认档"只提示"):finish/stop
                                    # reason 一并接住,流收尾随 done 帧下发;缺席不带键。
                                    if evt.get("finishReason"):
                                        accumulated["finishReason"] = evt["finishReason"]
                                elif _evt_type == "fallback":
                                    # P4-2(2026-09-19 修复):llm_gateway 主模型失败切换备用
                                    # 模型时 yield {"type":"fallback",...};此前本循环只认
                                    # chunk/reasoning/tool_calls/done/error 五类,事件被静默
                                    # 丢弃,前端 onFallback 永不触发。原样转发(与非 tool-loop
                                    # 路径的兜底 yield _sse(event_type, event) 行为对齐)。
                                    # D33(2026-09-23 立):fallback 事件同步入收集器,流收尾随
                                    # _fire_callback 落库到 metadata.fallback(与 SSE 同源同字段)。
                                    fallback_records.append(evt)
                                    yield _sse(SSE_FALLBACK, evt)
                                elif _evt_type == "error":
                                    # 流式错误(与 1113-1119 行一致)
                                    # G-815971:限额/配额收口 ⇒ 本轮续期通道闩死
                                    if _is_budget_exhaustion_error(
                                        evt.get("errorCode"), evt.get("message")
                                    ):
                                        _budget_exhausted_this_turn = True
                                    err_evt = {
                                        "type": "error",
                                        "message": evt.get("message", "LLM 调用失败"),
                                        "errorCode": evt.get("errorCode", "LLM_ERROR"),
                                    }
                                    yield _sse(SSE_ERROR, err_evt)
                                    return
                            # 流结束:flush 提问解析器残留(与 1154-1161 行一致)
                            leftover, leftover_qs = question_parser.flush()
                            if leftover:
                                chunk_event = {"type": "chunk", "content": leftover}
                                accumulated["content"] += leftover
                                yield _sse(SSE_CHUNK, chunk_event)
                            for q in leftover_qs:
                                q_event = {"type": "question", "question": q.to_dict()}
                                yield _sse(SSE_QUESTION, q_event)

                            tool_calls_raw = first_round_tool_calls
                            if not tool_calls_raw:
                                # 无 tool_calls:内容已流式逐块输出,直接收尾(不再整体 yield)
                                if not accumulated["content"]:
                                    # 2026-08-06 修复:空回复兜底(step_plan 等模型可能返回空 content,
                                    # 不能给用户一条空消息)
                                    _fallback = "抱歉,未能生成有效回复,请换个说法重试一下。"
                                    accumulated["content"] = _fallback
                                    _fallback_evt = {"type": "chunk", "content": _fallback}
                                    yield _sse(SSE_CHUNK, _fallback_evt)
                                # P1 #27(2026-09-16 立):done 前同步提炼本轮长期记忆,
                                # 条目经 done.memoryUpdates 回传,前端渲染「已记住」提示条。
                                # 超时/异常双降级为空数组,不阻塞 done 下发。
                                _mem_updates = await _extract_memory_updates(
                                    owner_uuid=owner_uuid,
                                    conversation_id=(
                                        req.metadata.get("conversationId")
                                        if isinstance(req.metadata, dict)
                                        else None
                                    ),
                                    user_messages=req.messages,
                                    assistant_content=accumulated["content"],
                                )
                                done_event = {
                                    "type": "done",
                                    "model": accumulated["model"],
                                    "usage": accumulated["usage"],
                                    "stub": accumulated["stub"],
                                    "memoryUpdates": _mem_updates,
                                }
                                # G-425:finishReason 透传(缺席不带键,不造值)
                                if accumulated.get("finishReason"):
                                    done_event["finishReason"] = accumulated["finishReason"]
                                if req.metadata:
                                    done_event["metadata"] = req.metadata
                                # W1(2026-09-12 立):最终回答前发一次 plan 快照(全部步骤已完成)
                                yield _format_plan_updated_event(
                                    tool_calls_history,
                                    explanation="全部步骤已完成",
                                    message_id=message_id,
                                )
                                # 2026-07-31 A2:done 之前发出 tool-summary(无工具调用时为 no-op)
                                _ts_str = _format_tool_summary_event(tool_calls_history)
                                if _ts_str:
                                    yield _ts_str
                                if _reasoning_effort_notice is not None:
                                    done_event["reasoningEffort"] = _reasoning_effort_notice
                                yield _sse(SSE_DONE, done_event)
                                has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
                                if has_association and not accumulated.get("error") and not await request.is_disconnected():
                                    url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
                                    # D24(2026-09-19 立):携带工具调用/终端任务历史,回调落库供恢复/回放/审计
                                    task = asyncio.create_task(_fire_callback(
                                        url, accumulated, req.metadata,
                                        tool_calls_history=tool_calls_history,
                                        terminal_tasks_history=terminal_tasks_history,
                                    injections=injection_frames,
                                    compaction_info=compaction_info,
                                    retry_notice=retry_notices[-1] if retry_notices else None,
                                    steer_applied=steer_applied or None,
                                    ))
                                    _pending_callbacks.add(task)
                                    task.add_done_callback(_pending_callbacks.discard)
                                return

                            # 有 tool_calls:回灌 assistant 消息(与 1189-1193 行一致),继续公共工具执行
                            messages.append({
                                "role": "assistant",
                                "content": accumulated["content"],
                                "tool_calls": first_round_tool_calls,
                            })
                            # 2026-08-29 修复:第一轮改走 astream 后无 complete_result,
                            # 合成兼容 dict 供下方公共工具执行逻辑的"全部失败"分支引用。
                            complete_result = {
                                "model": accumulated.get("model") or req.model,
                                "usage": accumulated.get("usage") or {},
                                "stub": accumulated.get("stub", False),
                            }
                        else:
                            # ===== 后续轮次:统一流式(W7 #10 修复,2026-09-18)=====
                            # 原实现:非流式 complete() + 8 字符/块打字机模拟 + reasoning 整段补发。
                            # 现在与第一轮同构走 astream:content/reasoning 逐 token 真流式,
                            # tool_calls 仍在流末由 llm_gateway._accumulate_tool_calls 统一产出。
                            _round_tool_calls: list[dict[str, Any]] = []
                            _round_content_parts: list[str] = []
                            complete_result = {
                                "model": req.model,
                                "usage": {},
                                "stub": False,
                            }
                            async for evt in llm_gateway.astream(
                                messages, model=req.model, owner_uuid=owner_uuid,
                                tools=openai_tools, tool_choice="auto",
                            ):
                                _evt_type = evt.get("type", "")
                                _note_retry(retry_notices, evt)
                                # G-815971:网关内部重试(httpStatus=429)与额度等效降级
                                # (reason=quota*)都是"限额命中且循环继续"的信号 ——
                                # 本轮续期通道一并闩死,防额度在续期轮里继续被烧。
                                if _evt_type == "retry_scheduled" and evt.get("httpStatus") == 429:
                                    _budget_exhausted_this_turn = True
                                elif _evt_type == "fallback" and str(
                                    evt.get("reason") or ""
                                ).startswith("quota"):
                                    _budget_exhausted_this_turn = True
                                if _evt_type == "chunk":
                                    clean_text, questions = question_parser.feed(evt.get("content", ""))
                                    for q in questions:
                                        q_event = {"type": "question", "question": q.to_dict()}
                                        yield _sse(SSE_QUESTION, q_event)
                                    if clean_text:
                                        accumulated["content"] += clean_text
                                        _round_content_parts.append(clean_text)
                                        chunk_event = {"type": "chunk", "content": clean_text}
                                        _mark_first_token()
                                        yield _sse(SSE_CHUNK, chunk_event)
                                elif _evt_type == "reasoning":
                                    # 思考过程逐 token 透传(与第一轮一致)
                                    _reasoning_token = evt.get("content", "")
                                    accumulated["reasoning"] += _reasoning_token
                                    _reasoning_evt = {"type": "reasoning", "content": _reasoning_token}
                                    yield _sse(SSE_REASONING, _reasoning_evt)
                                elif _evt_type == "tool_calls":
                                    # astream 统一在流结束前 yield 累积后的完整 tool_calls
                                    _round_tool_calls = evt.get("tool_calls") or []
                                elif _evt_type == "done":
                                    # 记录 model/usage/stub(与第一轮一致)
                                    complete_result = {
                                        "model": evt.get("model", req.model),
                                        "usage": evt.get("usage"),
                                        "stub": evt.get("stub", False),
                                    }
                                    # G-425:finish/stop reason 一并接住(与第一轮同口径)
                                    if evt.get("finishReason"):
                                        complete_result["finishReason"] = evt["finishReason"]
                                elif _evt_type == "fallback":
                                    # P4-2(2026-09-19 修复):同第一轮 —— 此前后续轮次的
                                    # fallback 事件同样被静默丢弃,原样转发给前端。
                                    # D33(2026-09-23 立):fallback 事件同步入收集器,流收尾随
                                    # _fire_callback 落库到 metadata.fallback(与 SSE 同源同字段)。
                                    fallback_records.append(evt)
                                    yield _sse(SSE_FALLBACK, evt)
                                elif _evt_type == "error":
                                    # 流式错误(与第一轮一致)
                                    # G-815971:限额/配额收口 ⇒ 本轮续期通道闩死
                                    if _is_budget_exhaustion_error(
                                        evt.get("errorCode"), evt.get("message")
                                    ):
                                        _budget_exhausted_this_turn = True
                                    err_evt = {
                                        "type": "error",
                                        "message": evt.get("message", "LLM 调用失败"),
                                        "errorCode": evt.get("errorCode", "LLM_ERROR"),
                                    }
                                    yield _sse(SSE_ERROR, err_evt)
                                    return
                            # 流结束:flush 提问解析器残留(与第一轮一致)
                            leftover, leftover_qs = question_parser.flush()
                            if leftover:
                                accumulated["content"] += leftover
                                _round_content_parts.append(leftover)
                                chunk_event = {"type": "chunk", "content": leftover}
                                yield _sse(SSE_CHUNK, chunk_event)
                            for q in leftover_qs:
                                q_event = {"type": "question", "question": q.to_dict()}
                                yield _sse(SSE_QUESTION, q_event)

                            tool_calls_raw = _round_tool_calls

                            # 无 tool_calls:LLM 不再需要工具(W7 #10:content 已逐 token
                            # 流式输出,删除原 8 字符/块打字机模拟;仅保留空回复兜底)
                            if not tool_calls_raw:
                                if not accumulated["content"]:
                                    # 2026-08-06 修复:空回复兜底(step_plan 等模型可能返回空 content,
                                    # 不能给用户一条空消息)
                                    # 2026-09-03 修复(agent 通道污染):工具循环已执行过工具时不再兜底 ——
                                    # 工具结果后 0 content 是 agent 场景的正常形态,插"抱歉,未能生成有效回复"
                                    # 假文案会被 CLI 存入 assistant 消息回传 provider,污染对话上下文
                                    # (对齐 generic astream 路径 done 事件的 _had_tools 修复)。
                                    if not tool_calls_history:
                                        _fallback = "抱歉,未能生成有效回复,请换个说法重试一下。"
                                        accumulated["content"] = _fallback
                                        _fallback_evt = {"type": "chunk", "content": _fallback}
                                        yield _sse(SSE_CHUNK, _fallback_evt)
                                accumulated["model"] = complete_result.get("model", req.model)
                                accumulated["usage"] = complete_result.get("usage", {})
                                accumulated["stub"] = complete_result.get("stub", False)
                                # G-425:finishReason 随轮次结果拷进 accumulated(流收尾透传)
                                if complete_result.get("finishReason"):
                                    accumulated["finishReason"] = complete_result["finishReason"]
                                # P1 #27(2026-09-16 立):done 前同步提炼本轮长期记忆,
                                # 条目经 done.memoryUpdates 回传,前端渲染「已记住」提示条。
                                _mem_updates = await _extract_memory_updates(
                                    owner_uuid=owner_uuid,
                                    conversation_id=(
                                        req.metadata.get("conversationId")
                                        if isinstance(req.metadata, dict)
                                        else None
                                    ),
                                    user_messages=req.messages,
                                    assistant_content=accumulated["content"],
                                )
                                done_event = {
                                    "type": "done",
                                    "model": accumulated["model"],
                                    "usage": accumulated["usage"],
                                    "stub": accumulated["stub"],
                                    "memoryUpdates": _mem_updates,
                                }
                                # G-425:finishReason 透传(缺席不带键,不造值)
                                if accumulated.get("finishReason"):
                                    done_event["finishReason"] = accumulated["finishReason"]
                                if req.metadata:
                                    done_event["metadata"] = req.metadata
                                # W1(2026-09-12 立):最终回答前发一次 plan 快照(全部步骤已完成)
                                yield _format_plan_updated_event(
                                    tool_calls_history,
                                    explanation="全部步骤已完成",
                                    message_id=message_id,
                                )
                                # 2026-07-31 A2:done 之前发出 tool-summary
                                _ts_str = _format_tool_summary_event(tool_calls_history)
                                if _ts_str:
                                    yield _ts_str
                                if _reasoning_effort_notice is not None:
                                    done_event["reasoningEffort"] = _reasoning_effort_notice
                                yield _sse(SSE_DONE, done_event)
                                has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
                                if has_association and not accumulated.get("error") and not await request.is_disconnected():
                                    url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
                                    # D24(2026-09-19 立):携带工具调用/终端任务历史,回调落库供恢复/回放/审计
                                    task = asyncio.create_task(_fire_callback(
                                        url, accumulated, req.metadata,
                                        tool_calls_history=tool_calls_history,
                                        terminal_tasks_history=terminal_tasks_history,
                                    injections=injection_frames,
                                    compaction_info=compaction_info,
                                    retry_notice=retry_notices[-1] if retry_notices else None,
                                    steer_applied=steer_applied or None,
                                    ))
                                    _pending_callbacks.add(task)
                                    task.add_done_callback(_pending_callbacks.discard)
                                return

                            # 有 tool_calls:执行工具 + 回灌结果(下方的代码会继续处理)
                            # (W7 #10:content 取本轮流式产出,不能回灌整个 accumulated——
                            #  否则会把前几轮 content 重复并入对话上下文)
                            messages.append({
                                "role": "assistant",
                                "content": "".join(_round_content_parts),
                                "tool_calls": tool_calls_raw,
                            })

                        # ===== D119(2026-09-27,G-233):同批只读工具并行预取 =====
                        # 只读白名单 = core/permission_mode._readonly_tools()(plan_mode.READONLY_TOOLS
                        # 单一真源出口);blocked 判定 = _chat_mode_allows_tool(同一函数);
                        # 审批判定 = _resolve_tool_approval(同一函数)—— 判据零复制。
                        # 仅对「无阻塞 + 无需审批」的只读工具预取;写类/终端/dispatch 保持顺序。
                        # SSE 帧序不变(start/result 仍按原循环序回),预取只并行化真实执行
                        # (call_tool 耗时);结果按 toolCallId 缓存,主循环命中即用。
                        _readonly_prefetch: dict[str, Any] = {}
                        if len(tool_calls_raw) > 1:
                            _prefetch_ids: list[str] = []
                            _prefetch_coros = []
                            for _pf_tc in tool_calls_raw:
                                _pf_fn = _pf_tc.get("function", {})
                                _pf_name = _TOOL_ALIASES.get(_pf_fn.get("name", ""), _pf_fn.get("name", ""))
                                if _pf_name not in _readonly_tools():
                                    continue
                                _pf_raw = _pf_fn.get("arguments", "") or ""
                                try:
                                    _pf_args = json.loads(_pf_raw) if _pf_raw.strip() else {}
                                except (json.JSONDecodeError, ValueError):
                                    continue
                                if not _chat_mode_allows_tool(
                                    chat_mode, _pf_name, getattr(req, "permission_mode", None)
                                ):
                                    continue
                                if _resolve_tool_approval(
                                    getattr(req, "permission_mode", None), _pf_name
                                )[0]:
                                    continue
                                _pf_id = _pf_tc.get("id", "")
                                _prefetch_ids.append(_pf_id)
                                _prefetch_coros.append(
                                    _mcp.call_tool(
                                        _pf_name, _pf_args,
                                        user_id=owner_uuid,
                                        user_role=user_role,
                                        session_id=(
                                            req.metadata.get("conversationId")
                                            if isinstance(req.metadata, dict)
                                            else None
                                        ),
                                    )
                                )
                            if len(_prefetch_ids) > 1:
                                _pf_results = await asyncio.gather(*_prefetch_coros, return_exceptions=True)
                                for _pf_id, _pf_res in zip(_prefetch_ids, _pf_results, strict=True):
                                    if isinstance(_pf_res, BaseException):
                                        # 与主循环 call_tool 的 except 分支同构(失败归一,不让 Exception 流入回灌)
                                        _readonly_prefetch[_pf_id] = {
                                            "tool": "prefetch",
                                            "ok": False,
                                            "error": str(_pf_res)[:500],
                                        }
                                    else:
                                        _readonly_prefetch[_pf_id] = _pf_res

                        # ===== 公共工具执行逻辑(两分支汇合,2026-08-29 修复保持不动)=====
                        tool_exec_tracker = []
                        for tc in tool_calls_raw:
                            fn = tc.get("function", {})
                            tool_name = fn.get("name", "")
                            # 2026-08-06 修复:别名归一化(execute_command → run_command),
                            # 防止 LLM 返回未注册工具名导致"未知工具"工具执行失败
                            tool_name = _TOOL_ALIASES.get(tool_name, tool_name)
                            raw_args = fn.get("arguments", "")
                            try:
                                args = json.loads(raw_args) if raw_args.strip() else {}
                            except (json.JSONDecodeError, ValueError):
                                args = {"_raw": raw_args}

                            # 推送 tool-call-start 事件(前端 onToolCall 回调)
                            # 2026-07-31 A2:补齐 serverSource/serverId/serverName 字段(ToolCallCard 区分原生/MCP/插件)
                            _src, _sid, _sname = resolve_tool_source(tool_name)
                            _tc_start_ts = time.time()
                            tc_start = {
                                "type": "tool-call-start",
                                "toolCallId": tc.get("id", ""),
                                "toolName": tool_name,
                                "args": args,
                                "iteration": _tool_iter + 1,
                                "serverSource": _src,
                                "serverId": _sid,
                                "serverName": _sname,
                            }
                            yield _sse(SSE_TOOL_CALL_START, tc_start)
                            # 记录到 tool_calls_history(tool-summary 聚合统计用)
                            # 协议升级(2026-09-19):startedAt 为 ISO 8601 起始时间戳,
                            # endedAt 由各结果回写点补写;isError 即失败标记(plan 步骤 error)
                            tool_calls_history.append({
                                "toolCallId": tc.get("id", ""),
                                "toolName": tool_name,
                                "args": args,
                                "iteration": _tool_iter + 1,
                                "serverSource": _src,
                                "serverId": _sid,
                                "serverName": _sname,
                                "startTimeMs": _tc_start_ts * 1000.0,
                                "startedAt": datetime.now(UTC).isoformat(),
                                "durationMs": 0,
                                "isError": False,
                                "result": None,
                            })

                            # V3 #53(2026-09-26 立,2026-09-27 归一到矩阵):ChatMode 硬收窄 —— 第二道闸(双保险)。
                            # 工具清单在 loop 入口已按模式过滤,但模型仍可能幻觉调用未下发的
                            # 工具名(跨平台别名/训练数据污染)。此处不执行、不触碰
                            # _mcp.call_tool,直接回灌 errorCode=CHAT_MODE_TOOL_BLOCKED 的
                            # 失败结果,并由回灌文本显式要求 LLM 告知用户被拦截,防止幻觉
                            # "已完成"。ask 理论上进不到本循环(入口已跳过),一并兜底。
                            if not _chat_mode_allows_tool(
                                chat_mode, tool_name, getattr(req, "permission_mode", None)
                            ):
                                # 文案唯一出口 = core/permission_mode.blocked_tool_message
                                # (V3 #49 口径:原因 + 替代建议,禁止模糊"未知工具"让模型原地重试)
                                _blocked_reason = _chat_mode_blocked_message(
                                    chat_mode, tool_name, getattr(req, "permission_mode", None)
                                )
                                blocked_result = {
                                    "tool": tool_name,
                                    "ok": False,
                                    "error": _blocked_reason,
                                    "errorCode": "CHAT_MODE_TOOL_BLOCKED",
                                    "message": _blocked_reason,
                                }
                                ok = False
                                tool_exec_tracker.append(ok)
                                _hist_idx_blocked = len(tool_calls_history) - 1
                                if _hist_idx_blocked >= 0 and tool_calls_history[_hist_idx_blocked].get("toolCallId") == tc.get("id", ""):
                                    tool_calls_history[_hist_idx_blocked].update({
                                        "result": blocked_result,
                                        "isError": True,
                                        "durationMs": int((time.time() - _tc_start_ts) * 1000),
                                        "endedAt": datetime.now(UTC).isoformat(),
                                    })
                                tc_blocked_evt = {
                                    "type": "tool-result",
                                    "toolCallId": tc.get("id", ""),
                                    "toolName": tool_name,
                                    "args": args,
                                    "result": blocked_result,
                                    "isError": True,
                                    "iteration": _tool_iter + 1,
                                    "serverSource": _src,
                                    "serverId": _sid,
                                    "serverName": _sname,
                                }
                                yield _sse(SSE_TOOL_RESULT, tc_blocked_evt)
                                yield _format_plan_updated_event(
                                    tool_calls_history,
                                    explanation=f"工具 {tool_name} 被 ChatMode 拦截",
                                    message_id=message_id,
                                )
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", ""),
                                    "name": tool_name,
                                    "content": (
                                        "TOOL EXECUTION FAILED. errorCode=CHAT_MODE_TOOL_BLOCKED. "
                                        f"error={_blocked_reason}. You MUST tell the user this tool "
                                        "is blocked in the current chat mode. Do NOT claim success."
                                    ),
                                })
                                continue

                            # D113(2026-09-27,G-227):文件写类工具流中 diff 预览帧(执行前纯参数推导)。
                            # 让用户在审批弹窗与执行期间就看到改动走向;不触碰磁盘、不影响执行
                            # 语义,tool-result 到达即被前端清除(最终 diff 以 tool-result 为准)。
                            if tool_name in _FILE_EDIT_PREVIEW_TOOLS:
                                _preview_text = _file_edit_preview_text(tool_name, args)
                                if _preview_text:
                                    for _pv_seq, (_pv_text, _pv_trunc) in enumerate(
                                        _file_edit_preview_frames(_preview_text), start=1
                                    ):
                                        _pv_evt: dict[str, Any] = {
                                            "type": _SSE_TOOL_DELTA,
                                            "toolCallId": tc.get("id", ""),
                                            "seq": _pv_seq,
                                            "partialText": _pv_text,
                                        }
                                        if _pv_trunc:
                                            _pv_evt["truncated"] = True
                                        yield _sse(_SSE_TOOL_DELTA, _pv_evt)
                            # W1(2026-09-12 立)终端类工具:执行前发 terminal_start 事件。
                            # 前端 onTerminalStart → chatStore.appendMessageTerminalTask
                            # → MessageItem 的 TerminalSection 实时显示"运行中"命令区块。
                            _is_terminal_tool = tool_name in _TERMINAL_TOOL_NAMES
                            _terminal_id = ""
                            if _is_terminal_tool:
                                _terminal_id = tc.get("id") or f"term-{uuid.uuid4().hex[:8]}"
                                _term_start_evt: dict[str, Any] = {
                                    "type": "terminal_start",
                                    "terminalId": _terminal_id,
                                    "command": str(args.get("command", "") or ""),
                                    "status": "running",
                                    "startedAt": datetime.now(UTC).isoformat(),
                                }
                                if message_id:
                                    _term_start_evt["messageId"] = message_id
                                yield _sse(SSE_TERMINAL_START, _term_start_evt)

                            # W1(2026-09-12 立)plan_updated 权威快照(本轮工具开始执行 → in_progress)。
                            # 前端 onPlanUpdate → chatStore.setMessagePlanSteps → PlanStepsCard 实时更新。
                            yield _format_plan_updated_event(
                                tool_calls_history,
                                explanation=f"开始执行工具 {tool_name}",
                                message_id=message_id,
                            )

                            # Subagent 派发生成事件(2026-07-28 立,自动派发):
                            # dispatch_subagent 工具执行前,解析 args.tasks 数组或 args.name+args.task 单任务,
                            # 为每个子任务发 subagent_spawn SSE 事件,前端进度面板自动展示 subagent 生命周期。
                            # _spawned_sub_ids 在本次 tool call 作用域内收集,执行后用于发 subagent_end 事件。
                            _spawned_sub_ids: list[str] = []
                            if tool_name == "dispatch_subagent":
                                _sa_tasks: list[dict[str, str]] = []
                                _tasks_field = args.get("tasks")
                                if isinstance(_tasks_field, list):
                                    for _tk in _tasks_field:
                                        if isinstance(_tk, dict) and _tk.get("name") and _tk.get("task"):
                                            _sa_tasks.append({"name": str(_tk["name"]), "task": str(_tk["task"])})
                                elif args.get("name") and args.get("task"):
                                    _sa_tasks.append({"name": str(args["name"]), "task": str(args["task"])})
                                _spawn_now = datetime.now(UTC).isoformat()
                                for _sa_task in _sa_tasks:
                                    _sa_id = f"sub-{uuid.uuid4().hex[:8]}"
                                    _spawned_sub_ids.append(_sa_id)
                                    _spawn_evt = {
                                        "type": "subagent_spawn",
                                        "id": _sa_id,
                                        "role": _sa_task["name"],
                                        "task": _sa_task["task"],
                                        "timestamp": _spawn_now,
                                    }
                                    yield _sse(SSE_SUBAGENT_SPAWN, _spawn_evt)

                            # 重复调用检测(2026-07-24 立,修复 stepfun/step-router-v1 在 tool loop 中重复调用
                            # search_codebase(query="config") 8 次耗尽 max_iterations 的问题):
                            # 命中已执行集合则跳过 _mcp.call_tool,构造简短 result,推送带 repeated: True 标记的
                            # tool-result 事件,并注入一次 system 提示消息引导 LLM 基于已有结果回答或换参数
                            args_hash = json.dumps(args, sort_keys=True, ensure_ascii=False)
                            dedup_key = f"{tool_name}::{args_hash}"

                            if dedup_key in executed_tool_keys:
                                # 重复调用:跳过执行,构造简短 result(标注 previous_result_available)
                                exec_result = {
                                    "tool": tool_name,
                                    "ok": True,
                                    "skipped": True,
                                    "message": "已跳过重复调用,结果见之前 tool-result",
                                    "previous_result_available": True,
                                }
                                ok = True
                                tool_exec_tracker.append(ok)
                                # 推送 tool-result 事件(带 repeated: True 标记,让前端可见 LLM 决策了但被去重)
                                # 2026-07-31 A2:补齐 serverSource/serverId/serverName 字段
                                _r_src, _r_sid, _r_sname = resolve_tool_source(tool_name)
                                tc_result_evt = {
                                    "type": "tool-result",
                                    "toolCallId": tc.get("id", ""),
                                    "toolName": tool_name,
                                    "args": args,
                                    "result": exec_result,
                                    "isError": False,
                                    "iteration": _tool_iter + 1,
                                    "repeated": True,
                                    "serverSource": _r_src,
                                    "serverId": _r_sid,
                                    "serverName": _r_sname,
                                }
                                yield _sse(SSE_TOOL_RESULT, tc_result_evt)
                                # 更新 tool_calls_history 中对应记录(去重分支:durationMs≈0)
                                _hist_idx = len(tool_calls_history) - 1
                                if _hist_idx >= 0 and tool_calls_history[_hist_idx].get("toolCallId") == tc.get("id", ""):
                                    tool_calls_history[_hist_idx].update({
                                    "result": exec_result,
                                    "isError": False,
                                    "durationMs": int((time.time() - _tc_start_ts) * 1000),
                                    "endedAt": datetime.now(UTC).isoformat(),
                                })
                                # W1(2026-09-12 立):终端类工具收尾(去重跳过分支视为已完成)
                                if _is_terminal_tool:
                                    yield _format_terminal_end_event(
                                        _terminal_id, exec_result, ok, _tc_start_ts, message_id
                                    )
                                    # D24(2026-09-19 立):同步收集终端任务记录,回调落库(恢复/回放/审计)
                                    terminal_tasks_history.append(_build_terminal_task(
                                        _terminal_id, exec_result, ok, _tc_start_ts,
                                        str((args if isinstance(args, dict) else {}).get("command", "") or ""),
                                    ))
                                # W1(2026-09-12 立):plan 快照收尾(result 已写回 → 该步转 completed)
                                yield _format_plan_updated_event(
                                    tool_calls_history,
                                    explanation=f"工具 {tool_name} 已完成(重复调用已跳过)",
                                    message_id=message_id,
                                )
                                # 回灌工具结果(简短提示,让 LLM 知道工具被跳过,完整结果见之前 tool 消息)
                                result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", ""),
                                    "name": tool_name,
                                    "content": result_json,
                                })
                                # system 提示消息只注入一次(同一 (tool_name, args_hash) 第二次重复时才注入,
                                # 避免每轮都重复注入同一提示)
                                if dedup_key not in injected_warning_keys:
                                    injected_warning_keys.add(dedup_key)
                                    messages.append({
                                        "role": "system",
                                        "content": (
                                            f"工具 '{tool_name}' (args={args_hash}) 已在之前轮次成功执行,"
                                            f"结果已记录在上方 tool 角色消息中。请基于已有结果直接回答用户问题,"
                                            f"或调用不同参数的工具,不要重复调用相同参数的同一工具。"
                                        ),
                                    })
                                continue

                            # 首次调用:记录到集合(不管成功失败都记录,防止 LLM 重复调用同一参数的同一工具)
                            executed_tool_keys.add(dedup_key)

                            # ===== V3 #49(2026-09-26 立):委托专有工具的可用性拦截 =====
                            # _DELEGATE_ONLY_TOOLS 里的名字只存在于浏览器委托面(前端
                            # workspace-tool-executor.ts 实现),本地 _TOOLS 未注册。当请求不带
                            # workspace_context(桌面端/本地工作区)时它们不会命中下面的 delegate
                            # 分支,会一路走到 _mcp.call_tool 拿到模糊的「未知工具」—— 模型既不知道
                            # 为什么失败也不知道换哪个工具,只会原地重试到 max_iterations。
                            # 此处提前返回一条带等价建议的明确错误,把「静默失败」变成「可自愈的提示」。
                            if tool_name in _DELEGATE_ONLY_TOOLS and not req.workspace_context:
                                _hint = _DELEGATE_ONLY_HINTS.get(tool_name, "其他已注册工具")
                                exec_result = {
                                    "tool": tool_name,
                                    "ok": False,
                                    "error": (
                                        f"工具 '{tool_name}' 在当前运行模式不可用:它属于浏览器工作区"
                                        f"委托工具(需前端提供 workspace_context),当前为本地工作区模式。"
                                        f"请勿重试该工具,改用:{_hint}。"
                                    ),
                                    "errorCode": "TOOL_MODE_UNAVAILABLE",
                                    "message": f"工具 {tool_name} 需要浏览器工作区模式",
                                }
                                ok = False
                                tool_exec_tracker.append(ok)
                                _r_src, _r_sid, _r_sname = resolve_tool_source(tool_name)
                                tc_result_evt = {
                                    "type": "tool-result",
                                    "toolCallId": tc.get("id", ""),
                                    "toolName": tool_name,
                                    "args": args,
                                    "result": exec_result,
                                    "isError": True,
                                    "iteration": _tool_iter + 1,
                                    "serverSource": _r_src,
                                    "serverId": _r_sid,
                                    "serverName": _r_sname,
                                }
                                yield _sse(SSE_TOOL_RESULT, tc_result_evt)
                                _hist_idx = len(tool_calls_history) - 1
                                if _hist_idx >= 0 and tool_calls_history[_hist_idx].get("toolCallId") == tc.get("id", ""):
                                    tool_calls_history[_hist_idx].update({
                                        "result": exec_result,
                                        "isError": True,
                                        "durationMs": int((time.time() - _tc_start_ts) * 1000),
                                        "endedAt": datetime.now(UTC).isoformat(),
                                    })
                                # plan 快照收尾(该步标记失败,前端 PlanStepsCard 可见)
                                yield _format_plan_updated_event(
                                    tool_calls_history,
                                    explanation=f"工具 {tool_name} 在当前模式下不可用(需浏览器工作区)",
                                    message_id=message_id,
                                )
                                # 回灌工具结果 —— 模型据此换工具,而不是重试同一名字
                                result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", ""),
                                    "name": tool_name,
                                    "content": result_json,
                                })
                                continue

                            # ===== V3 #63(2026-09-27 立):主对话流业务表单请求 =====
                            # 位置语义:与 tool-approval 同一拦截位、且在其**之前** ——
                            # 本工具不产生副作用(它只是请用户填一张表),再走一遍审批门
                            # 会让用户先被问"允许吗"再被问"内容是什么",两问一答。
                            # 结算口径与审批分支同构:成功/拒绝/超时都回填一条 tool 消息,
                            # 让模型拿到明确结论而不是静默等不到回音。
                            if tool_name == _FORM_REQUEST_TOOL_NAME:
                                _form_kind = args.get("kind") if isinstance(args, dict) else None
                                # 组帧函数是唯一形状权威(见 mcp_server.build_form_request_frame):
                                # 未知 kind 或字段表为空 ⇒ 返回 None,此时**不发半帧**
                                # (端上解析层对畸形帧整帧丢弃且不报错,发出去就等于"服务端
                                # 以为弹了、界面上什么都没有")。
                                if session_id is None:
                                    session_id = str(uuid.uuid4())
                                _request_id = f"frm_{uuid.uuid4().hex[:12]}"
                                _form_frame = (
                                    build_form_request_frame(
                                        request_id=_request_id,
                                        kind=_form_kind,
                                        session_id=session_id,
                                        message_id=message_id,
                                    )
                                    if isinstance(_form_kind, str)
                                    else None
                                )
                                if _form_frame is None:
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": (
                                            f"业务表单种类 '{_form_kind}' 不存在。可用种类见工具"
                                            "描述;都不匹配时不要用本工具,直接向用户提问即可。"
                                        ),
                                        "errorCode": "form_invalid",
                                        "message": "未知的业务表单种类,未发起表单",
                                    }
                                    ok = False
                                    tool_exec_tracker.append(ok)
                                    _f_src, _f_sid, _f_sname = resolve_tool_source(tool_name)
                                    yield _sse(
                                        SSE_TOOL_RESULT,
                                        {
                                            "type": "tool-result",
                                            "toolCallId": tc.get("id", ""),
                                            "toolName": tool_name,
                                            "args": args,
                                            "result": exec_result,
                                            "isError": True,
                                            "iteration": _tool_iter + 1,
                                            "serverSource": _f_src,
                                            "serverId": _f_sid,
                                            "serverName": _f_sname,
                                        },
                                    )
                                    yield _format_plan_updated_event(
                                        tool_calls_history,
                                        explanation=f"工具 {tool_name} 的表单种类未知,未发起表单",
                                        message_id=message_id,
                                    )
                                    messages.append({
                                        "role": "tool",
                                        "tool_call_id": tc.get("id", ""),
                                        "name": tool_name,
                                        "content": json.dumps(exec_result, ensure_ascii=False)[:4000],
                                    })
                                    continue

                                # 注册待决项。**user_id 存的是令牌主体 owner_uuid,不是模型传的任何字段**
                                # —— 结算端点靠它判归属;缺这份记录时"别人的 requestId"与
                                # "不存在的 requestId"就无法区分(端点会变成存在性探针)。
                                _form_ev = asyncio.Event()
                                _form_sessions.setdefault(session_id, {})[_request_id] = {
                                    "event": _form_ev,
                                    "action": None,
                                    "values": None,
                                    "reject_reason": None,
                                    "user_id": owner_uuid,
                                    "kind": _form_kind,
                                }
                                yield _sse(_SSE_FORM_REQUEST, _form_frame)
                                # 分段等待 + keepalive 注释行:与审批分支同一理由 ——
                                # 前端 streamChat 有 30s 读超时,静默超窗会被掐断重连。
                                _form_action: str | None = None
                                _form_values: dict[str, Any] | None = None
                                _form_reason: str | None = None
                                try:
                                    _form_waited = 0.0
                                    while _form_waited < _FORM_WAIT_TIMEOUT:
                                        _form_remain = _FORM_WAIT_TIMEOUT - _form_waited
                                        try:
                                            await asyncio.wait_for(
                                                _form_ev.wait(),
                                                timeout=min(_FORM_KEEPALIVE_INTERVAL, _form_remain),
                                            )
                                        except TimeoutError:
                                            _form_waited += _FORM_KEEPALIVE_INTERVAL
                                            if _form_waited < _FORM_WAIT_TIMEOUT:
                                                yield ": keep-alive (waiting form response)\n\n"
                                            continue
                                        _f_entry = _form_sessions.get(session_id, {}).get(_request_id)
                                        if _f_entry is not None:
                                            _form_action = _f_entry.get("action")
                                            _raw_vals = _f_entry.get("values")
                                            _form_values = (
                                                _raw_vals if isinstance(_raw_vals, dict) else None
                                            )
                                            _form_reason = _f_entry.get("reject_reason")
                                        break
                                finally:
                                    # 无论结算/超时都不留残条目(与 _approval_sessions 同纪律)
                                    _form_sessions.get(session_id, {}).pop(_request_id, None)

                                # 预填值合并:**只在这一处**把模型给的 prefill 与用户提交的
                                # values 归并(用户提交的赢)。为什么本帧里没有 prefill:
                                # 下行帧的线格式没有承载它的槽位(api-client 解析层只保留
                                # requestId/kind/fields/actions/sessionId/messageId,多余键
                                # 不透传),所以预填**不会显示在表单上**,只在回灌给模型时合并。
                                # 这一格是已知残余,登记在 contract.ts 的 FORM_FRAME_EVENTS ③。
                                _prefill_raw = (
                                    args.get("prefill") if isinstance(args, dict) else None
                                )
                                # 变量名带 _form_ 前缀不是风格问题:gen() 是个数千行的巨型
                                # 协程,`_merged` 在第 2770 行的 subagent 提示注入处已是一个 str,
                                # 复用同名会被 mypy 判成"str 上没有 update"并让本处类型塌掉。
                                _form_merged: dict[str, Any] = (
                                    dict(_prefill_raw) if isinstance(_prefill_raw, dict) else {}
                                )
                                if isinstance(_form_values, dict):
                                    _form_merged.update(_form_values)

                                if _form_action == "approve":
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": True,
                                        "action": "approve",
                                        "kind": _form_kind,
                                        "values": _form_merged,
                                        "userProvidedValues": _form_values or {},
                                        "message": "用户已提交表单",
                                    }
                                    ok = True
                                    _form_explanation = f"表单 {str(_form_kind)} 已由用户提交"
                                else:
                                    _form_timed_out = _form_action is None
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "action": "reject" if not _form_timed_out else None,
                                        "kind": _form_kind,
                                        "error": (
                                            f"用户等待超时({_FORM_WAIT_TIMEOUT}s),表单未提交"
                                            if _form_timed_out
                                            else f"用户拒绝了本次表单:{_form_reason or '(未填理由)'}"
                                        ),
                                        "errorCode": "timeout" if _form_timed_out else "rejected",
                                        "message": "表单未提交,请勿重试该工具",
                                    }
                                    ok = False
                                    _form_explanation = (
                                        f"表单 {str(_form_kind)} "
                                        f"{'超时未提交' if _form_timed_out else '被用户拒绝'}"
                                    )
                                tool_exec_tracker.append(ok)
                                _f_src2, _f_sid2, _f_sname2 = resolve_tool_source(tool_name)
                                yield _sse(
                                    SSE_TOOL_RESULT,
                                    {
                                        "type": "tool-result",
                                        "toolCallId": tc.get("id", ""),
                                        "toolName": tool_name,
                                        "args": args,
                                        "result": exec_result,
                                        "isError": not ok,
                                        "iteration": _tool_iter + 1,
                                        "serverSource": _f_src2,
                                        "serverId": _f_sid2,
                                        "serverName": _f_sname2,
                                    },
                                )
                                yield _format_plan_updated_event(
                                    tool_calls_history,
                                    explanation=_form_explanation,
                                    message_id=message_id,
                                )
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", ""),
                                    "name": tool_name,
                                    "content": json.dumps(exec_result, ensure_ascii=False)[:4000],
                                })
                                continue

                            # ===== V3 #58(2026-09-26 立):主对话流工具审批门 =====
                            # 位置语义:在重复调用/委托可用性拦截(上方)与浏览器委托、
                            # 本地 _mcp.call_tool 执行(下方)之间 —— 无论工具走哪条执行
                            # 路径,执行前都要过门。deny/超时时工具不执行,回填带
                            # errorCode=TOOL_APPROVAL_DENIED / TOOL_APPROVAL_TIMEOUT 的
                            # 明确失败 tool-result(收尾与 delegate-timeout 分支同构),
                            # 让模型知道工具被拒,而非静默失败后原地重试。
                            _approval_needed, _danger = _resolve_tool_approval(
                                getattr(req, "permission_mode", None), tool_name
                            )
                            if _approval_needed:
                                if session_id is None:
                                    # 兜底:理论上 gen() 开始时已生成(与 delegate 分支同防御)
                                    session_id = str(uuid.uuid4())
                                _grant_scope = _grant_lookup(
                                    _grants_bucket(), tool_name, time.monotonic()
                                )
                                if _grant_scope in ("session", "always"):
                                    # 会话内「总是允许」命中:免弹窗(与 agent_loop_v2 审批缓存同语义)
                                    _approval_needed = False
                                # D158:run_command 额外查前缀放行规则(第四档批准时登记的
                                # 持久层规则;跨会话、跨重启有效)。命中免弹窗,规则长期
                                # 有效但可经审批授予列表撤销(见 revoke 出口)。
                                if (
                                    _approval_needed
                                    and tool_name == "run_command"
                                    and _exec_prefix_grant_hits(
                                        args.get("argv") or [], owner_uuid
                                    )
                                ):
                                    _approval_needed = False
                                # D159 三档命中侧(与 _persist_network_grant 写入侧成套):
                                # 本次调用**所有**可读网络目标都被本人主体级规则覆盖 ⇒ 免弹。
                                # 没有这一读,"始终允许该目标(90 天后失效)"落库后无人查,
                                # 下一轮照弹 —— 写-only 的规则就是假承诺。撤销经同一对
                                # GET/DELETE /llm/approval-grants,撤完下一轮即恢复弹窗。
                                if _approval_needed and _network_grant_hits(
                                    args if isinstance(args, dict) else None, owner_uuid
                                ):
                                    _approval_needed = False
                            if _approval_needed:
                                # 类型收窄兜底(与 delegate 分支同一模式):走到本块 ⇒ 上方 grant
                                # 块必已执行且未置 False,session_id 在那时已被保证非 None,
                                # 故此判据实际恒不触发;mypy 无法跨两个 if 块关联该收窄,重复
                                # 一次同款兜底让本块内(含 3387/3428/3436 的字典键取用)恒为 str。
                                if session_id is None:
                                    session_id = str(uuid.uuid4())
                                tool_call_id = tc.get("id", "")
                                _approval_id = f"appr_{uuid.uuid4().hex[:12]}"
                                # 参数预览截断 200 字符(与 agent 任务流 tool-approval 口径一致)
                                _args_preview = json.dumps(args, ensure_ascii=False)[:200]
                                _approval_ev = asyncio.Event()
                                _approval_sessions.setdefault(session_id, {})[_approval_id] = {
                                    "event": _approval_ev,
                                    "decision": None,
                                    "scope": None,
                                    "reason": None,
                                    # D158 UI 半张补(2026-09-28):_persist_grant_rule 从
                                    # 条目读 argv 落前缀规则,而条目此前不含 argv ⇒ 第四档
                                    # 批准在生产链路上永远落空(测试夹具带 argv,生产条目
                                    # 没有 —— 上一批遗漏)。补齐后规则才真正落库;
                                    # 非 run_command / argv 缺失时 _persist_grant_rule 自行跳过。
                                    "argv": args.get("argv") if isinstance(args, dict) else None,
                                    "tool_name": tool_name,
                                    # D159:本次审批**要放行的网络目标**(读工具参数里的 url,
                                    # 服务端存着,结算时按它落规则)。存的是**发帧那一刻**的
                                    # 取值 ⇒ 帧上显示的与库里落的必然同一条;客户端回传里
                                    # 没有 target 这一格,所以"批 A 连 B"进不来。
                                    "net_fact": _approval_network_fact(
                                        tool_name, args if isinstance(args, dict) else None,
                                        owner_uuid,
                                    ),
                                }
                                # 发 tool-approval SSE 帧(帧名/payload 见模块头注释,与
                                # agent 任务流同形,前端 ToolApprovalDialog 可复用解析)
                                yield _sse(
                                    _SSE_TOOL_APPROVAL,
                                    {
                                        "type": "tool-approval",
                                        "approval_id": _approval_id,
                                        "tool_name": tool_name,
                                        "tool_call_id": tool_call_id,
                                        "args_preview": _args_preview,
                                        "danger_level": _danger,
                                        "session_id": session_id,
                                        # D159:执行环境 + 网络目标事实(开关关档 ⇒ 整块缺席,
                                        # 前端整块不渲染;开着但读不到 ⇒ 弹窗喊"未上报")
                                        **_approval_env_fields(
                                            tool_name,
                                            args if isinstance(args, dict) else None,
                                            owner_uuid,
                                        ),
                                    },
                                )
                                # 等待人工决策:分段等待 + 注释行 keepalive。
                                # 为什么不一次 wait_for(120):前端 streamChat 有 30s 读超时
                                # (readWithTimeout),SSE 流静默超 30s 会被前端掐断重连;
                                # SSE 注释行(": ...")对所有解析器透明,专治此症。
                                _decision: str | None = None
                                _scope = "once"
                                try:
                                    _waited = 0.0
                                    while _waited < _APPROVAL_TIMEOUT:
                                        _remain = _APPROVAL_TIMEOUT - _waited
                                        try:
                                            await asyncio.wait_for(
                                                _approval_ev.wait(),
                                                timeout=min(_APPROVAL_KEEPALIVE_INTERVAL, _remain),
                                            )
                                        except TimeoutError:
                                            _waited += _APPROVAL_KEEPALIVE_INTERVAL
                                            if _waited < _APPROVAL_TIMEOUT:
                                                yield ": keep-alive (waiting tool approval)\n\n"
                                            continue
                                        # 事件已置位:读取决策(回传端点已写入 entry)
                                        _entry = _approval_sessions.get(session_id, {}).get(_approval_id)
                                        if _entry is not None:
                                            _decision = str(_entry.get("decision") or "")
                                            _scope = str(_entry.get("scope") or "once")
                                        break
                                finally:
                                    # 条目清理(决策/超时后都不残留,与 agent_loop_v2
                                    # _approval_registry 同语义,防内存泄漏)
                                    _approval_sessions.get(session_id, {}).pop(_approval_id, None)
                                if _decision == "approve" and _scope in ("session", "always"):
                                    # 落会话内授权缓存(once 不落,下次同工具仍弹窗)
                                    _grant_record(
                                        _grants_bucket(), tool_name, _scope, time.monotonic()
                                    )
                                # D158:第四档「批准并生成放行规则」—— 只对 run_command 生效,
                                # 按 argv 前 N 个 token 落**前缀**规则(持久层,90 天 TTL,
                                # 与 mcp_server 的 exec_prefix 同一键空间)。落规则提成
                                # _persist_grant_rule(可单测;失败不阻断本次执行)。
                                if _decision == "approve":
                                    _persist_grant_rule(_entry, tool_name, session_id, owner_uuid)
                                    # D159:网络放行三档 —— 目标取**发帧时存在条目里**的那一份,
                                    # 主体取承载层的 owner_uuid,scope 取用户刚选的档(once 不落库)。
                                    # 条目里没有网络目标(非出站工具)⇒ 这个调用什么都不做。
                                    _persist_network_grant(
                                        _entry.get("net_fact") if isinstance(_entry, dict) else None,
                                        _decision,
                                        _scope,
                                        session_id,
                                        owner_uuid,
                                    )
                                if _decision is None or _decision != "approve":
                                    _is_timeout = _decision is None
                                    _denied_why = (
                                        f"审批等待超时({_APPROVAL_TIMEOUT}s),未执行"
                                        if _is_timeout
                                        else "用户拒绝了本次工具执行"
                                    )
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": _denied_why,
                                        "errorCode": (
                                            "TOOL_APPROVAL_TIMEOUT"
                                            if _is_timeout
                                            else "TOOL_APPROVAL_DENIED"
                                        ),
                                        "message": (
                                            f"工具 {tool_name} 未执行"
                                            f"({'审批超时' if _is_timeout else '审批拒绝'})"
                                        ),
                                    }
                                    ok = False
                                    tool_exec_tracker.append(ok)
                                    # 推送 tool-result 事件(前端工具卡显示失败态)
                                    _r_src, _r_sid, _r_sname = resolve_tool_source(tool_name)
                                    tc_result_evt = {
                                        "type": "tool-result",
                                        "toolCallId": tc.get("id", ""),
                                        "toolName": tool_name,
                                        "args": args,
                                        "result": exec_result,
                                        "isError": True,
                                        "iteration": _tool_iter + 1,
                                        "serverSource": _r_src,
                                        "serverId": _r_sid,
                                        "serverName": _r_sname,
                                    }
                                    yield _sse(SSE_TOOL_RESULT, tc_result_evt)
                                    _hist_idx = len(tool_calls_history) - 1
                                    if _hist_idx >= 0 and tool_calls_history[_hist_idx].get("toolCallId") == tc.get("id", ""):
                                        tool_calls_history[_hist_idx].update({
                                            "result": exec_result,
                                            "isError": True,
                                            "durationMs": int((time.time() - _tc_start_ts) * 1000),
                                            "endedAt": datetime.now(UTC).isoformat(),
                                        })
                                    # W1:终端类工具收尾(拒绝/超时分支视为已结束)
                                    if _is_terminal_tool:
                                        yield _format_terminal_end_event(
                                            _terminal_id, exec_result, ok, _tc_start_ts, message_id
                                        )
                                        # D24:同步收集终端任务记录,回调落库(恢复/回放/审计)
                                        terminal_tasks_history.append(_build_terminal_task(
                                            _terminal_id, exec_result, ok, _tc_start_ts,
                                            str((args if isinstance(args, dict) else {}).get("command", "") or ""),
                                        ))
                                    yield _format_plan_updated_event(
                                        tool_calls_history,
                                        explanation=(
                                            f"工具 {tool_name} "
                                            f"{'审批超时' if _is_timeout else '被用户拒绝'},未执行"
                                        ),
                                        message_id=message_id,
                                    )
                                    # 回灌工具结果 —— 模型据此改道(换工具/向用户解释),不重试同名工具
                                    result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                                    messages.append({
                                        "role": "tool",
                                        "tool_call_id": tc.get("id", ""),
                                        "name": tool_name,
                                        "content": result_json,
                                    })
                                    continue

                            # ===== 阶段 2:浏览器端工具委托执行(2026-08-02 立)=====
                            # web 非 Tauri 环境(workspace_context 模式)下,fs 类工具委托前端用
                            # FileSystemDirectoryHandle 执行,通过 SSE tool-delegate 事件通知前端,
                            # 前端执行完通过 POST /llm/complete/stream/{session_id}/tool-result 回传结果。
                            # Tauri 桌面端走原有 _mcp.call_tool 逻辑(workspace_path 模式,ai-service 在本地)。
                            if req.workspace_context and tool_name in _FS_DEPENDENT_TOOLS:
                                if session_id is None:
                                    # 兜底:理论上 gen() 开始时已生成,此处防御
                                    session_id = str(uuid.uuid4())
                                tool_call_id = tc.get("id", "")
                                delegate_event_obj: dict[str, Any] = {
                                    "type": "tool-delegate",
                                    "session_id": session_id,
                                    "tool_call_id": tool_call_id,
                                    "tool_name": tool_name,
                                    "args": args,
                                    "iteration": _tool_iter + 1,
                                }
                                # 注册 pending Event 到 session
                                _ev = asyncio.Event()
                                _delegate_sessions.setdefault(session_id, {})["pending_" + tool_call_id] = _ev
                                # 发送 tool-delegate SSE 事件
                                yield _sse(SSE_TOOL_DELEGATE, delegate_event_obj)
                                # 等待前端回传结果(超时 60 秒)
                                try:
                                    await asyncio.wait_for(_ev.wait(), timeout=_DELEGATE_TIMEOUT)
                                except TimeoutError:
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": f"前端工具执行超时({_DELEGATE_TIMEOUT}s)",
                                        "errorCode": "DELEGATE_TIMEOUT",
                                        "message": f"浏览器端工具 {tool_name} 执行超时",
                                    }
                                    ok = False
                                    tool_exec_tracker.append(ok)
                                    # 推送 tool-result 事件
                                    _r_src, _r_sid, _r_sname = resolve_tool_source(tool_name)
                                    tc_result_evt = {
                                        "type": "tool-result",
                                        "toolCallId": tool_call_id,
                                        "toolName": tool_name,
                                        "args": args,
                                        "result": exec_result,
                                        "isError": True,
                                        "iteration": _tool_iter + 1,
                                        "delegated": True,
                                        "serverSource": _r_src,
                                        "serverId": _r_sid,
                                        "serverName": _r_sname,
                                    }
                                    yield _sse(SSE_TOOL_RESULT, tc_result_evt)
                                    _hist_idx = len(tool_calls_history) - 1
                                    if _hist_idx >= 0 and tool_calls_history[_hist_idx].get("toolCallId") == tool_call_id:
                                        tool_calls_history[_hist_idx].update({
                                            "result": exec_result,
                                            "isError": True,
                                            "durationMs": int((time.time() - _tc_start_ts) * 1000),
                                            "endedAt": datetime.now(UTC).isoformat(),
                                        })
                                    # W1(2026-09-12 立):委托超时收尾(该步记 failed,plan 快照同步)
                                    if _is_terminal_tool:
                                        yield _format_terminal_end_event(
                                            _terminal_id, exec_result, ok, _tc_start_ts, message_id
                                        )
                                        # D24(2026-09-19 立):同步收集终端任务记录,回调落库(恢复/回放/审计)
                                        terminal_tasks_history.append(_build_terminal_task(
                                            _terminal_id, exec_result, ok, _tc_start_ts,
                                            str((args if isinstance(args, dict) else {}).get("command", "") or ""),
                                        ))
                                    yield _format_plan_updated_event(
                                        tool_calls_history,
                                        explanation=f"工具 {tool_name} 委托超时",
                                        message_id=message_id,
                                    )
                                    result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                                    messages.append({
                                        "role": "tool",
                                        "tool_call_id": tool_call_id,
                                        "name": tool_name,
                                        "content": result_json,
                                    })
                                    # 清理 session
                                    _delegate_sessions.get(session_id, {}).pop("pending_" + tool_call_id, None)
                                    continue
                                # 取前端回传的结果
                                _sess = _delegate_sessions.get(session_id, {})
                                _front_result = _sess.pop("result_" + tool_call_id, None)
                                _sess.pop("pending_" + tool_call_id, None)
                                if _front_result and _front_result.get("error"):
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": _front_result["error"],
                                        "errorCode": "DELEGATE_ERROR",
                                        "message": f"浏览器端工具 {tool_name} 执行失败: {_front_result['error']}",
                                    }
                                elif _front_result and _front_result.get("result") is not None:
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": True,
                                        "result": _front_result["result"],
                                        "delegated": True,
                                        "message": f"浏览器端工具 {tool_name} 执行成功",
                                    }
                                else:
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": "前端未返回有效结果",
                                        "errorCode": "DELEGATE_NO_RESULT",
                                    }
                                ok = bool(exec_result.get("ok", True))
                                tool_exec_tracker.append(ok)
                                # 推送 tool-result 事件
                                _r_src, _r_sid, _r_sname = resolve_tool_source(tool_name)
                                tc_result_evt = {
                                    "type": "tool-result",
                                    "toolCallId": tool_call_id,
                                    "toolName": tool_name,
                                    "args": args,
                                    "result": exec_result,
                                    "isError": not ok,
                                    "iteration": _tool_iter + 1,
                                    "delegated": True,
                                    "serverSource": _r_src,
                                    "serverId": _r_sid,
                                    "serverName": _r_sname,
                                }
                                yield _sse(SSE_TOOL_RESULT, tc_result_evt)
                                # 更新 tool_calls_history
                                _hist_idx = len(tool_calls_history) - 1
                                if _hist_idx >= 0 and tool_calls_history[_hist_idx].get("toolCallId") == tool_call_id:
                                    tool_calls_history[_hist_idx].update({
                                    "result": exec_result,
                                    "isError": not ok,
                                    "durationMs": int((time.time() - _tc_start_ts) * 1000),
                                    "endedAt": datetime.now(UTC).isoformat(),
                                })
                                # W1(2026-09-12 立):委托结束收尾(终端类发 terminal_end,plan 快照同步)
                                if _is_terminal_tool:
                                    yield _format_terminal_end_event(
                                        _terminal_id, exec_result, ok, _tc_start_ts, message_id
                                    )
                                    # D24(2026-09-19 立):同步收集终端任务记录,回调落库(恢复/回放/审计)
                                    terminal_tasks_history.append(_build_terminal_task(
                                        _terminal_id, exec_result, ok, _tc_start_ts,
                                        str((args if isinstance(args, dict) else {}).get("command", "") or ""),
                                    ))
                                yield _format_plan_updated_event(
                                    tool_calls_history,
                                    explanation=f"工具 {tool_name} 已{'完成' if ok else '失败'}",
                                    message_id=message_id,
                                )
                                # 回灌工具结果到 messages
                                result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call_id,
                                    "name": tool_name,
                                    "content": result_json,
                                })
                                continue  # 跳过后续的本地执行逻辑

                            # 执行工具(异常保护:网络/超时/JSON 错误不应崩溃 SSE 流)
                            # G6(2026-07-26):透传 owner_uuid(user_id)给 knowledge_lookup 查 LTM 源
                            # dispatch_subagent 特殊处理(2026-07-28 立):
                            # 直接调用 _tool_dispatch_subagent(绕过 _mcp.call_tool 通用接口),
                            # 注入 progress_callback → asyncio.Queue → 实时 yield subagent_progress SSE 事件,
                            # 让前端进度面板在 subagent 执行期间看到 thinking/tool_call/tool_result/output_ready。
                            #
                            # 4 phase 发出时机(2026-07-31 A2 验证:均已正确发出,无需修复):
                            # - thinking:agent_orchestrator.py _run_agent 每轮迭代开始时发出(含 iteration 字段)
                            # - tool_call:agent_orchestrator.py 在 mcp_server.call_tool 调用前发出(含 tool 字段)
                            # - tool_result:agent_orchestrator.py 在 mcp_server.call_tool 返回后发出(含 tool + ok 字段)
                            # - output_ready:agent_orchestrator.py 在 3 个出口发出(无 tool_calls break / 最后一轮总结 / loop else)
                            # _progress_cb 实时转发所有 phase 到 _progress_queue → SSE yield,不延迟到 subagent_end。
                            if tool_name == "dispatch_subagent" and _spawned_sub_ids:
                                # task_index → subagent_id 映射(并行模式多 task,单模式只有 1 个)
                                _sub_id_by_index: dict[int, str] = dict(enumerate(_spawned_sub_ids))
                                _single_sub_id = _spawned_sub_ids[0]
                                _progress_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

                                def _progress_cb(
                                    evt: dict[str, Any],
                                    *,
                                    _sub_id_by_index: dict[int, str] = _sub_id_by_index,
                                    _single_sub_id: str = _single_sub_id,
                                    _progress_queue: asyncio.Queue[dict[str, Any] | None] = _progress_queue,
                                ) -> None:
                                    """进度回调:_run_agent 事件 → SSE progress 事件格式。"""
                                    _task_idx = evt.pop("task_index", None)
                                    _agent_name = evt.pop("agent_name", "")
                                    if _task_idx is not None and _task_idx in _sub_id_by_index:
                                        _sa_id = _sub_id_by_index[_task_idx]
                                    else:
                                        _sa_id = _single_sub_id
                                    _sse_evt: dict[str, Any] = {
                                        "type": "subagent_progress",
                                        "id": _sa_id,
                                        "phase": evt.get("phase", ""),
                                        "timestamp": datetime.now(UTC).isoformat(),
                                    }
                                    for _fk in ("iteration", "tool", "ok", "output_preview"):
                                        if _fk in evt:
                                            _sse_evt[_fk] = evt[_fk]
                                    if _agent_name:
                                        _sse_evt["agentName"] = _agent_name
                                    _progress_queue.put_nowait(_sse_evt)

                                try:
                                    # MCP 工具调用取消闭环:登记到本流追踪器,
                                    # 客户端断开/请求取消时 finally 统一 cancel
                                    _dispatch_task = _inflight_tool_tasks.track(asyncio.create_task(
                                        _tool_dispatch_subagent(args, progress_callback=_progress_cb)
                                    ))
                                    # 排水进度事件,直到 dispatch 任务完成
                                    while not _dispatch_task.done():
                                        try:
                                            _pevt = await asyncio.wait_for(_progress_queue.get(), timeout=0.05)
                                            if _pevt:
                                                yield _sse(SSE_SUBAGENT_PROGRESS, _pevt)
                                        except TimeoutError:
                                            continue
                                    # 排水剩余事件
                                    while not _progress_queue.empty():
                                        _pevt = _progress_queue.get_nowait()
                                        if _pevt:
                                            yield _sse(SSE_SUBAGENT_PROGRESS, _pevt)
                                    exec_result = await _dispatch_task
                                except Exception as e:
                                    logger.exception("dispatch_subagent execution exception")
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": str(e)[:500],
                                        "errorCode": "EXECUTION_EXCEPTION",
                                        "message": f"dispatch_subagent 执行异常: {type(e).__name__}",
                                    }
                            else:
                                try:
                                    # 终端类工具:启用进程内 delta 直投,实时下发 terminal_delta 帧。
                                    # 注入 contextvar(push=Queue.put_nowait),工具执行期间同步回调把增量
                                    # 帧塞入队列;主生成器边等任务边排水转发,不阻塞工具执行、不改 SSE 顺序。
                                    _term_token = None
                                    if _is_terminal_tool and _terminal_id:
                                        _delta_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
                                        # D151(2026-09-29):user_id 走**令牌主体**注入 ——
                                        # 交互式命令的代答待决项在注册点盖章,结算点只比对
                                        # 该值;模型参数与请求体都碰不到它(§5 认证≠授权)。
                                        _term_token = set_terminal_stream_context(
                                            session_id=session_id or "",
                                            iteration=_tool_iter + 1,
                                            tool_call_id=_terminal_id,
                                            user_id=owner_uuid,
                                            messageId=message_id,
                                            push=_delta_queue.put_nowait,
                                        )
                                    if _term_token is not None:
                                        try:
                                            # MCP 工具调用取消闭环:登记到本流追踪器,
                                            # 客户端断开/请求取消时 finally 统一 cancel
                                            _call_task = _inflight_tool_tasks.track(asyncio.ensure_future(
                                                _mcp.call_tool(
                                                    tool_name, args,
                                                    user_id=owner_uuid,
                                                    user_role=user_role,
                                                    session_id=(
                                                        req.metadata.get("conversationId")
                                                        if isinstance(req.metadata, dict)
                                                        else None
                                                    ),
                                                )
                                            ))
                                            # 等待期间实时排水 delta 帧(超时探测,不阻塞工具主链路)
                                            while not _call_task.done():
                                                try:
                                                    await asyncio.wait_for(_delta_queue.get(), timeout=0.15)
                                                except TimeoutError:
                                                    continue
                                                while not _delta_queue.empty():
                                                    _d = _delta_queue.get_nowait()
                                                    # D151:同一 push 通道现在有两种帧。按 payload 的
                                                    # type 分流,**不得**再靠"有没有 text 字段"判 ——
                                                    # 那样交互帧会被静默丢掉(前端永远等不到)。
                                                    if _d and _d.get("type") == "terminal_interaction":
                                                        yield _sse(SSE_TERMINAL_INTERACTION, _d)
                                                    elif _d and _d.get("text"):
                                                        yield _sse(SSE_TERMINAL_DELTA, _d)
                                            # 任务结束后排空残余 delta 帧
                                            while not _delta_queue.empty():
                                                _d = _delta_queue.get_nowait()
                                                if _d and _d.get("type") == "terminal_interaction":
                                                    yield _sse(SSE_TERMINAL_INTERACTION, _d)
                                                elif _d and _d.get("text"):
                                                    yield _sse(SSE_TERMINAL_DELTA, _d)
                                            exec_result = _call_task.result()
                                        finally:
                                            reset_terminal_stream_context(_term_token)
                                    elif tc.get("id", "") in _readonly_prefetch:
                                        # D119:命中并行预取缓存(只读工具,执行已提前完成)
                                        exec_result = _readonly_prefetch[tc.get("id", "")]
                                    else:
                                        exec_result = await _mcp.call_tool(
                                            tool_name, args,
                                            user_id=owner_uuid,
                                            user_role=user_role,
                                            session_id=(
                                                req.metadata.get("conversationId")
                                                if isinstance(req.metadata, dict)
                                                else None
                                            ),
                                        )
                                except Exception as e:
                                    logger.exception("Tool execution exception: %s", tool_name)
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": str(e)[:500],
                                        "errorCode": "EXECUTION_EXCEPTION",
                                        "message": f"工具执行异常: {type(e).__name__}",
                                    }
                            # 默认成功:工具 handler 不返回 ok 字段时视为成功
                            # (异常分支已显式设置 ok: False,此处只兜底无 ok 字段的正常结果)
                            ok = bool(exec_result.get("ok", True))
                            tool_exec_tracker.append(ok)

                            # 推送 tool-result 事件
                            # 2026-07-31 A2:补齐 serverSource/serverId/serverName 字段
                            _r_src, _r_sid, _r_sname = resolve_tool_source(tool_name)
                            tc_result_evt = {
                                "type": "tool-result",
                                "toolCallId": tc.get("id", ""),
                                "toolName": tool_name,
                                "args": args,
                                "result": exec_result,
                                "isError": not ok,
                                "iteration": _tool_iter + 1,
                                "serverSource": _r_src,
                                "serverId": _r_sid,
                                "serverName": _r_sname,
                            }
                            # 2026-09-09 媒体产物顶层扁平化:媒体工具(图/视频/音乐/改图/TTS)的
                            # 产物 URL 与 task_id 提取到事件顶层,前端 ToolCallCard 无需深挖
                            # result 嵌套即可渲染(image_url/audio_url/video_url/task_id 均为
                            # 字符串或 None,超长 data URI 一律不扁平化防事件体积膨胀)。
                            if isinstance(exec_result, dict):
                                for _mf in ("image_url", "audio_url", "video_url", "task_id"):
                                    _mv = exec_result.get(_mf)
                                    if isinstance(_mv, str) and _mv and not _mv.startswith("data:"):
                                        tc_result_evt[_mf] = _mv
                            yield _sse(SSE_TOOL_RESULT, tc_result_evt)
                            # 更新 tool_calls_history 中对应记录(正常分支:含真实 durationMs)
                            _hist_idx = len(tool_calls_history) - 1
                            if _hist_idx >= 0 and tool_calls_history[_hist_idx].get("toolCallId") == tc.get("id", ""):
                                tool_calls_history[_hist_idx].update({
                                    "result": exec_result,
                                    "isError": not ok,
                                    "durationMs": int((time.time() - _tc_start_ts) * 1000),
                                    "endedAt": datetime.now(UTC).isoformat(),
                                })

                            # W1(2026-09-12 立):工具执行收尾。
                            # 终端类工具(归一化后名命中 _TERMINAL_TOOL_NAMES)发 terminal_end,
                            # 携带 output/exitCode/durationMs;所有工具都发 plan_updated 快照
                            # (该步 result 已写回 → completed),前端 PlanStepsCard 实时勾选。
                            if _is_terminal_tool:
                                yield _format_terminal_end_event(
                                    _terminal_id, exec_result, ok, _tc_start_ts, message_id
                                )
                                # D24(2026-09-19 立):同步收集终端任务记录,回调落库(恢复/回放/审计)
                                terminal_tasks_history.append(_build_terminal_task(
                                    _terminal_id, exec_result, ok, _tc_start_ts,
                                    str((args if isinstance(args, dict) else {}).get("command", "") or ""),
                                ))
                            yield _format_plan_updated_event(
                                tool_calls_history,
                                explanation=f"工具 {tool_name} 已{'完成' if ok else '失败'}",
                                message_id=message_id,
                            )

                            # Subagent 派发结束事件(2026-07-28 立,自动派发):
                            # dispatch_subagent 工具执行后,为每个已 spawn 的 sub_id 发 subagent_end 事件,
                            # status=done(成功)或 failed(失败),失败时附 failureReason(截断 500 字符)。
                            # 重复调用分支(dedup)不发 end 事件:subagent 在首次调用时已发过 spawn+end,
                            # 重复调用只是 LLM 决策被去重跳过,不应重复触发前端生命周期展示。
                            if tool_name == "dispatch_subagent" and _spawned_sub_ids:
                                _sa_status = "done" if ok else "failed"
                                _sa_error_msg = None
                                if not ok:
                                    # 2026-08-02 补充默认错误信息:当 error/message 都为空时,
                                    # 前端 markSubagentEnd 会显示"执行失败"(无原因),用户无法排查
                                    _sa_error_msg = exec_result.get("error") or exec_result.get("message") or "subagent 执行失败(无详细错误信息)"
                                _end_now = datetime.now(UTC).isoformat()
                                for _sa_id in _spawned_sub_ids:
                                    _end_evt = {
                                        "type": "subagent_end",
                                        "id": _sa_id,
                                        "status": _sa_status,
                                        "timestamp": _end_now,
                                    }
                                    if _sa_error_msg:
                                        _end_evt["failureReason"] = str(_sa_error_msg)[:500]
                                    yield _sse(SSE_SUBAGENT_END, _end_evt)

                            # 回灌工具结果(失败时显式标注,防止 LLM 幻觉"已完成")
                            result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                            if not ok:
                                err_detail = exec_result.get("error") or exec_result.get("message") or "unknown error"
                                err_code = exec_result.get("errorCode", "UNKNOWN")
                                inner = exec_result.get("result", {})
                                if isinstance(inner, dict) and inner.get("errorCode"):
                                    err_code = inner.get("errorCode", err_code)
                                    err_detail = inner.get("error", err_detail)
                                # G-815971:工具侧限额/配额失败且循环将继续 ⇒ 本轮续期闩死
                                if _is_budget_exhaustion_error(err_code, err_detail):
                                    _budget_exhausted_this_turn = True
                                result_json = (
                                    f"TOOL EXECUTION FAILED. errorCode={err_code}. error={err_detail}. "
                                    f"You MUST tell the user the tool failed. Do NOT claim success. "
                                    f"Raw result: {result_json}"
                                )
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id", ""),
                                "name": tool_name,
                                "content": result_json,
                            })
                        # 全部 tool 失败时,直接构造失败响应,不走 astream(与 conversation.py 一致,防止 LLM 幻觉)
                        if tool_exec_tracker and all(not ok_flag for ok_flag in tool_exec_tracker):
                            failed_lines = []
                            for tc in tool_calls_raw:
                                fn = tc.get("function", {})
                                t_name = fn.get("name", "")
                                for m in messages:
                                    if m.get("role") == "tool" and m.get("name") == t_name:
                                        raw_content = m.get("content", "")
                                        err_code = "UNKNOWN"
                                        err_msg = "unknown error"
                                        if "errorCode=" in raw_content:
                                            try:
                                                err_code = raw_content.split("errorCode=")[1].split(".")[0].strip()
                                                if "error=" in raw_content:
                                                    err_msg = raw_content.split("error=")[1].split(".")[0].strip()
                                            except (IndexError, ValueError):
                                                pass
                                        failed_lines.append(f"- {t_name}: {err_code} — {err_msg}")
                                        break
                            fail_text = (
                                "工具执行失败,未能完成您的请求:\n"
                                + "\n".join(failed_lines) + "\n\n"
                                "可能的原因:\n"
                                "- TARGET_NOT_CONNECTED:浏览器扩展或桌面端未启动,请确保对应端已打开并登录\n"
                                "- TIMEOUT:操作超时,请稍后重试\n"
                                "- SELECTOR_NOT_FOUND:页面元素未找到,请检查选择器是否正确\n"
                            )
                            clean_text, questions = question_parser.feed(fail_text)
                            for q in questions:
                                q_event = {"type": "question", "question": q.to_dict()}
                                yield _sse(SSE_QUESTION, q_event)
                            if clean_text:
                                chunk_event = {"type": "chunk", "content": clean_text}
                                accumulated["content"] += clean_text
                                yield _sse(SSE_CHUNK, chunk_event)
                            leftover, leftover_qs = question_parser.flush()
                            if leftover:
                                chunk_event = {"type": "chunk", "content": leftover}
                                accumulated["content"] += leftover
                                yield _sse(SSE_CHUNK, chunk_event)
                            for q in leftover_qs:
                                q_event = {"type": "question", "question": q.to_dict()}
                                yield _sse(SSE_QUESTION, q_event)
                            accumulated["model"] = complete_result.get("model", req.model)
                            accumulated["usage"] = complete_result.get("usage", {})
                            # P1 #27(2026-09-16 立):done 前同步提炼本轮长期记忆
                            # (工具全失败收尾路径同款接线)。
                            _mem_updates = await _extract_memory_updates(
                                owner_uuid=owner_uuid,
                                conversation_id=(
                                    req.metadata.get("conversationId")
                                    if isinstance(req.metadata, dict)
                                    else None
                                ),
                                user_messages=req.messages,
                                assistant_content=accumulated["content"],
                            )
                            done_event = {
                                "type": "done",
                                "model": accumulated["model"],
                                "usage": accumulated["usage"],
                                "stub": accumulated.get("stub", False),
                                "memoryUpdates": _mem_updates,
                            }
                            if req.metadata:
                                done_event["metadata"] = req.metadata
                            # W1(2026-09-12 立):全部失败收尾前发 plan 快照(每步 result 已写回)
                            yield _format_plan_updated_event(
                                tool_calls_history,
                                explanation="工具执行失败",
                                message_id=message_id,
                            )
                            # 2026-07-31 A2:done 之前发出 tool-summary(全部工具失败场景,tool_calls_history 非空)
                            _ts_str = _format_tool_summary_event(tool_calls_history)
                            if _ts_str:
                                yield _ts_str
                            if _reasoning_effort_notice is not None:
                                done_event["reasoningEffort"] = _reasoning_effort_notice
                            yield _sse(SSE_DONE, done_event)
                            has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
                            if has_association and not accumulated.get("error") and not await request.is_disconnected():
                                url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
                                # D24(2026-09-19 立):携带工具调用/终端任务历史,回调落库供恢复/回放/审计
                                task = asyncio.create_task(_fire_callback(
                                    url, accumulated, req.metadata,
                                    tool_calls_history=tool_calls_history,
                                    terminal_tasks_history=terminal_tasks_history,
                                injections=injection_frames,
                                compaction_info=compaction_info,
                                retry_notice=retry_notices[-1] if retry_notices else None,
                                steer_applied=steer_applied or None,
                                ))
                                _pending_callbacks.add(task)
                                task.add_done_callback(_pending_callbacks.discard)
                            return

                        # 有成功的 tool:继续下一轮循环(下一轮 complete 会带 tools,让 LLM 决定是否需要更多操作)
                        # 注意:不在这里归一化 messages,因为下一轮 complete() 需要原生 tool 角色
                        _tool_iter += 1  # Steer:while 形态下的步进(原 for-range 自增)

                    # 循环结束(无 tool_calls 或达到 max_iterations)
                    # 归一化 messages:把 tool 角色消息转为 user 消息(避免被 astream 内部 repair_messages 过滤)
                    normalized_msgs: list[dict[str, Any]] = []
                    for m in messages:
                        if m.get("role") == "tool":
                            normalized_msgs.append({
                                "role": "user",
                                "content": f"[Tool Result: {m.get('name', 'unknown')}]\n{m.get('content', '')}",
                            })
                        elif m.get("role") == "assistant" and m.get("tool_calls"):
                            content = m.get("content", "") or ""
                            if not content:
                                tool_names = [tc.get("function", {}).get("name", "") for tc in m.get("tool_calls", [])]
                                content = f"[I called tools: {', '.join(tool_names)}]"
                            normalized_msgs.append({
                                "role": "assistant",
                                "content": content,
                            })
                        else:
                            normalized_msgs.append(m)
                    messages[:] = normalized_msgs  # 切片赋值:修改原列表,避免创建本地变量
                    # 继续走 astream(用归一化后的 messages,不带 tools)

            # 2026-08-31 原生 function calling 透传:未走服务端 agent tool loop 时,
            # 把请求体的 tools/tool_choice 原样传给 astream(OpenAI 兼容 schema),
            # 由 llm_gateway 透传到上游 provider(厂商不支持时 filter_call_kwargs 兜底剔除)。
            _native_fc_kwargs: dict[str, Any] = {}
            if req.tools and not _agent_tool_loop_ran:
                _native_fc_kwargs["tools"] = req.tools
                if req.tool_choice is not None:
                    _native_fc_kwargs["tool_choice"] = req.tool_choice
            # P1-7(2026-09-13 立):高级参数面板 temperature/top_p/top_k/max_tokens 透传
            # (厂商不支持时由 llm_gateway.filter_call_kwargs 兜底剔除)
            if req.temperature is not None:
                _native_fc_kwargs["temperature"] = req.temperature
            if req.top_p is not None:
                _native_fc_kwargs["top_p"] = req.top_p
            if req.top_k is not None:
                _native_fc_kwargs["top_k"] = req.top_k
            if req.max_tokens is not None:
                _native_fc_kwargs["max_tokens"] = req.max_tokens
            # D130(2026-09-30 立):推理强度档位透传给 astream(与 temperature/top_p 同区同规)。
            # 删掉这两行 = 前端选了档而上游收不到,界面仍一切正常(票第 8 栏的静默失效本体)。
            if _reasoning_effort_effective is not None:
                _native_fc_kwargs["reasoning_effort"] = _reasoning_effort_effective
            # 2026-09-03 修复(agent 通道污染):原生 FC 本轮是否已发出 tool-call-start。
            # agent 场景模型常返回 tool_calls + 0 content,下方空回复兜底若不排除该情况,
            # 会往流里插一条"抱歉,未能生成有效回复"假文案,被 CLI 存入 assistant 消息回传 provider,污染上下文。
            _native_fc_emitted_tools = False

            _native_fc_stream = llm_gateway.astream(
                messages, model=req.model, owner_uuid=owner_uuid, **_native_fc_kwargs
            )
            async for event in _native_fc_stream:
                if await request.is_disconnected():
                    logger.info("SSE client disconnected, stopping stream")
                    # 被弃路径就地关停:break 之后本流还要走完半截落库 / 空回复兜底 /
                    # 计量帧,而 provider 侧此刻仍停在 `async with client.stream(...)`
                    # 的半读态 —— 拖到函数 finally(更差是 GC)才关,已经太晚。
                    await aclose_async_gen(
                        _native_fc_stream,
                        label="routers.llm astream (client disconnected)",
                    )
                    break
                event_type = event.get("type", "message")
                _note_retry(retry_notices, event)
                # 累积内容用于回调
                if event_type in ("chunk", "message"):
                    raw_content = event.get("content", "")
                    # 喂入提问解析器,拿到剥离标记后的纯文本 + 提问列表
                    clean_text, questions = question_parser.feed(raw_content)
                    # 用纯文本替换原 content(标记不进对话文本)
                    event["content"] = clean_text
                    accumulated["content"] += clean_text
                    # 先推送可能存在的提问事件(在 chunk 之前,让 UI 提前弹窗)
                    for q in questions:
                        q_event = {"type": "question", "question": q.to_dict()}
                        yield _sse(SSE_QUESTION, q_event)
                    # 仅当有纯文本时才推送 chunk(避免空 chunk)
                    if clean_text:
                        _mark_first_token()
                        yield _sse(event_type, event)
                    continue
                elif event_type == "reasoning":
                    accumulated["reasoning"] += event.get("content", "")
                elif event_type == "tool_calls":
                    # 2026-08-31 原生 function calling:上游返回 tool_calls → 转换为
                    # tool-call-start SSE 事件(packages/api-client ToolCallEvent 契约:
                    # type/toolCallId/toolName/args),CLI runToolLoop 通过 onToolCall
                    # 回调接收后本地执行工具;不再向下透传原生 tool_calls 事件。
                    _native_fc_emitted_tools = True
                    for _tc in event.get("tool_calls") or []:
                        _fn = _tc.get("function") or {}
                        _args_raw = _fn.get("arguments")
                        _args: dict[str, Any] | str
                        if _args_raw is None:
                            _args = {}
                        elif isinstance(_args_raw, str):
                            try:
                                _args = json.loads(_args_raw)
                            except (json.JSONDecodeError, ValueError):
                                _args = _args_raw
                        else:
                            _args = _args_raw
                        _tc_start = {
                            "type": "tool-call-start",
                            # 2026-09-03:strip 工具 id(个别 provider 返回的 id 尾部带换行,
                            # CLI 回传 tool_call_id 时不匹配会被 provider 拒绝)
                            "toolCallId": (_tc.get("id") or "").strip(),
                            "toolName": _fn.get("name") or "",
                            "args": _args,
                        }
                        yield _sse(SSE_TOOL_CALL_START, _tc_start)
                    continue
                elif event_type == "done":
                    # 流结束前 flush 解析器残留(不完整标记作为普通文本输出,不吞内容)
                    leftover, leftover_qs = question_parser.flush()
                    if leftover:
                        # 残留文本作为最后一个 chunk 推送
                        chunk_event = {"type": "chunk", "content": leftover}
                        accumulated["content"] += leftover
                        yield _sse(SSE_CHUNK, chunk_event)
                    for q in leftover_qs:
                        q_event = {"type": "question", "question": q.to_dict()}
                        yield _sse(SSE_QUESTION, q_event)
                    accumulated["model"] = event.get("model", req.model)
                    accumulated["usage"] = event.get("usage")
                    # P3 3-4-A(2026-09-17 拍板):per-user 试用额度计量(done usage 到达即累加,
                    # fire-and-forget;enable=env USER_TRIAL_DAILY_TOKENS>0)
                    _usage_obj = event.get("usage")
                    if isinstance(_usage_obj, dict) and owner_uuid:
                        _trial_tokens = int(_usage_obj.get("total_tokens", 0) or 0)
                        if _trial_tokens > 0:
                            asyncio.create_task(
                                user_trial_quota.consume(owner_uuid, _trial_tokens)
                            )
                    accumulated["stub"] = event.get("stub", False)
                    # 在 done 事件中透传 metadata
                    if req.metadata:
                        event["metadata"] = req.metadata
                    # W1(2026-09-12 立):tool loop 结束走 astream 时,最终 done 前发 plan 快照
                    # (tool_calls_history 为空时返回空串,no-op)
                    yield _format_plan_updated_event(
                        tool_calls_history,
                        explanation="全部步骤已完成",
                        message_id=message_id,
                    )
                    # 2026-07-31 A2:done 之前发出 tool-summary(tool loop 完成后走 astream 的场景)
                    _ts_str = _format_tool_summary_event(tool_calls_history)
                    if _ts_str:
                        yield _ts_str
                    # 2026-08-06 修复:空回复兜底 —— 模型可能返回 0 content
                    # (step_plan 只返回 tool_calls 或空文本),不能给用户一条空消息。
                    # 此时通常已发生工具调用,提示用户可基于工具结果重试。
                    # 2026-09-03 修复:本轮已发出 tool-call-start 时不兜底(原生 FC agent 场景,
                    # tool_calls+0 content 是正常形态,插假文案会污染 CLI 回传的对话上下文)。
                    if not accumulated["content"] and not accumulated.get("error"):
                        _had_tools = bool(tool_calls_history) or _native_fc_emitted_tools
                        if not _had_tools:
                            _fallback = "抱歉,未能生成有效回复。请换个说法重试一下。"
                            accumulated["content"] = _fallback
                            _fallback_evt = {"type": "chunk", "content": _fallback}
                            yield _sse(SSE_CHUNK, _fallback_evt)
                yield _sse(event_type, event)
        except GeneratorExit:
            # G-815975:客户端断开 ⇒ 生成器被 aclose,finally 里不允许 yield,
            # dropped 回报降级为日志留痕(先置位再放行)。
            _stream_exiting = True
            raise
        except asyncio.CancelledError:
            _stream_exiting = True
            logger.info("SSE generator cancelled by client disconnect")
            raise
        except Exception as e:
            # 流内运行时错误(PROVIDER_NOT_IMPLEMENTED / LLM_ERROR)无法 pre-flight,
            # 推送 event: error 含 errorCode,前端 attachErrorMeta 透传到 Error.errorCode
            err_msg = str(e)
            err_code = "LLM_ERROR"
            if "NotImplemented" in err_msg:
                err_code = "PROVIDER_NOT_IMPLEMENTED"
            elif "API key 未配置" in err_msg or "未配置" in err_msg:
                err_code = "MODEL_NOT_CONFIGURED"
            err = {"type": "error", "message": err_msg, "errorCode": err_code}
            logger.warning(
                "stream gen error: model=%s code=%s msg=%s",
                req.model, err_code, err_msg,
            )
            yield _sse(SSE_ERROR, err)
            return
        finally:
            # 借来的异步生成器兜底关停:覆盖"流中途抛错 / GeneratorExit"两条被弃路径
            # (客户端断开那条已在 break 之前就关)。正常耗尽时 aclose 是合法 no-op,
            # 不构成二次回滚;出口自身吞错,绝不用关停异常掩盖正在传播的原异常。
            # **必须 shield + 只吞本行等待**:这段 finally 会在"任务被取消"的作用域里执行,而它后面
            # 还挂着 MCP 取消闭环 / 委托 session / 表单待决 / 引导队列四项清理。站点跑在
            # uvicorn + anyio 上,而 anyio 的取消是**持续投递**的(作用域内每一处 await 都会再点燃
            # CancelledError)⇒ 裸 await 在这里可能把那四项整批跳过(与本文件既有的"取消仅 fire 不
            # await"同一条理由)。shield 让关停任务脱离本次取消跑完(资源真的关掉),except 只吞
            # "这一行的等待":外层正在传播的取消 / GeneratorExit 仍随 finally 结束后照常向外传播。
            try:
                await asyncio.shield(
                    aclose_async_gen(
                        _native_fc_stream, label="routers.llm astream (stream finally)"
                    )
                )
            except BaseException as close_err:  # noqa: BLE001 - 兜底关停不得越过后四项清理
                logger.warning(
                    "[stream] 兜底关停未在此处等待完成(已交 shield 接管) err=%r",
                    close_err,
                )
            # MCP 工具调用取消闭环:流收尾(正常 done / error / 客户端断开取消
            # /GeneratorExit)统一 cancel 本流仍 in-flight 的工具任务,切断孤儿链路。
            # 正常完成路径任务已被 await 且经完成回调移出集合,此处天然 no-op;
            # 取消仅 fire 不 await(避免在取消作用域内二次招致 CancelledError)。
            _inflight_tool_tasks.cancel_all()
            # 阶段 2:清理委托 session(始终执行,先于计量帧)
            if session_id and session_id in _delegate_sessions:
                del _delegate_sessions[session_id]
            # V3 #63:清理本流尚未结算的表单待决项。等待处已有逐条 pop 的 finally,
            # 这一层兜的是"流在等待中被掐断 ⇒ 该 session 的桶整个留下空壳"——
            # 桶不删,后续同名 session 的端点仍能查到条目却永远等不到被 await 的 Event。
            if session_id:
                _form_sessions.pop(session_id, None)
            # Steer(2026-09-19 立):清理引导队列(始终执行)。G-815975:未消费的
            # 引导不再随流结束静默丢弃 —— 收口时逐条发 steer(phase=dropped) 显式
            # 回报(客户端早已拿到"入队成功"ACK,必须有下文);全部消费完 ⇒
            # 一帧不发。GeneratorExit/客户端断开路径不允许 yield,降级为日志留痕;
            # 端点此后对本 session 返回 404 的语义不变。
            if session_id:
                _dropped_steer_frames = _report_dropped_steers(session_id)
                if _dropped_steer_frames:
                    logger.warning(
                        "[steer] session=%s 流收口时 %d 条引导未消费,显式回报 dropped",
                        session_id,
                        len(_dropped_steer_frames),
                    )
                    if not _stream_exiting:
                        for _drop_evt in _dropped_steer_frames:
                            if message_id:
                                _drop_evt["messageId"] = message_id
                            yield _sse(SSE_STEER, _drop_evt)
            # 审批授权缓存(V3 #58,2026-09-28 两次改):收尾**只收本轮桶**。
            # 改前这里无条件 pop session_id,当时所有桶都是本轮的(网关每轮换 id),
            # 所以那一行同时干了"声明的寿命"与"内存回收"两件事。归属升成会话级之后
            # 两件事必须拆开:会话桶删在这里删就等于把「本会话总是允许」又降回「本轮」,
            # 而内存上界改由 `_GRANT_TTL_SECONDS` + `_GRANT_MAX_BUCKETS` 兜(见 `_grant_evict`)。
            _grant_drop_if_turn_scoped(_grants_bucket())
            # D152:摘掉本流的 goal 监听(与上面三个注册表同一收尾)。不摘就会留着
            # 一个没人 await 的队列,后续 publish 只会把帧堆进内存直到满。
            _unregister_goal_listener(_goal_conversation_id, _goal_queue)
            # D1(2026-09-19 立):流收尾处发出消息级 usage 计量帧(event: usage)。
            # 覆盖所有收尾路径(正常 done / 异常 error / 客户端断开),确保每条回复结束都能拿到
            # 本条消息的 token 用量与耗时。独立 try:计量帧失败/生成器关闭绝不影响主链路。
            try:
                _u = accumulated.get("usage") or {}
                _u = _u if isinstance(_u, dict) else {}
                _prompt = _u.get("prompt_tokens") or _u.get("promptTokens")
                _completion = _u.get("completion_tokens") or _u.get("completionTokens")
                _total = _u.get("total_tokens") or _u.get("totalTokens")
                _reasoning = _u.get("reasoning_tokens") or _u.get("reasoningTokens")
                # G-403(2026-10-07):缓存读/写两维补发射 —— 两态分工与 reasoningTokens
                # 同款纪律(G-721),但判据反过来:reasoning 是"键恒写、上游没有 ⇒ null";
                # 缓存是"上游 usage 里出现任何缓存别名键才发数字(可能是 0 = 真没命中),
                # 整维缺席 ⇒ None(没采到)"。归一层 normalize_usage 会把没采到折叠成 0,
                # 那是内部计量口径;对外下发帧必须区分两个结论,不许拿 0 冒充"没命中"
                # (G-394 禁令)。_u 是各 provider 原生形态(流式主路径未过 normalize_usage),
                # extract_cache_metrics 内部走归一,各家别名都认。
                _cache_read: int | None
                _cache_write: int | None
                if has_cache_signals(_u):
                    _cache_read, _cache_write = extract_cache_metrics(_u)
                else:
                    _cache_read, _cache_write = None, None
                if _total is None and _prompt is not None and _completion is not None:
                    _total = _prompt + _completion
                _first_ms = (
                    int((_first_token_ts - _stream_started) * 1000) if _first_token_ts else None
                )
                _duration_ms = int((time.perf_counter() - _stream_started) * 1000)
                _usage_frame: dict[str, Any] = {
                    "type": "usage",
                    "messageId": message_id,
                    "usage": {
                        "promptTokens": _prompt,
                        "completionTokens": _completion,
                        "totalTokens": _total,
                        "reasoningTokens": _reasoning,
                        "cacheReadTokens": _cache_read,
                        "cacheWriteTokens": _cache_write,
                    },
                    "timing": {"firstTokenMs": _first_ms, "durationMs": _duration_ms},
                    "model": accumulated.get("model"),
                    "costUsd": None,
                }
                # D33(2026-09-23 立):usageDetail 持久化通道(与 event: usage 同源同字段)。
                # 成本经 model_pricing.estimate_cost_usd 推算(与 ai-cost 扣费同口径);
                # 失败/未计费降级为 None,绝不阻塞主链路。仅当确有 token 用量时才构建,
                # 否则保持 None(空值不写 key)。
                if _total is not None or _prompt is not None or _completion is not None:
                    _cost_usd: float | None = None
                    try:
                        from ..core.model_pricing import estimate_cost_usd

                        if accumulated.get("model"):
                            _cost_usd = estimate_cost_usd(
                                str(accumulated.get("model")),
                                int(_prompt or 0),
                                int(_completion or 0),
                            ).get("cost_usd")
                    except Exception as _cost_err:
                        _cost_usd = None
                        logger.warning("usageDetail cost estimate failed: %s", _cost_err)
                    _usage_detail = {
                        "promptTokens": _prompt,
                        "completionTokens": _completion,
                        "totalTokens": _total,
                        "reasoningTokens": _reasoning,
                        # G-403:与 event: usage 同源同字段(注释同上);回放端 web
                        # history-message 的 readUsageDetailFromMetadata 按同一键名读回。
                        "cacheReadTokens": _cache_read,
                        "cacheWriteTokens": _cache_write,
                        "firstTokenMs": _first_ms,
                        "durationMs": _duration_ms,
                        "model": accumulated.get("model"),
                        "costUsd": _cost_usd,
                    }
                yield _sse(SSE_USAGE, _usage_frame)
            except GeneratorExit:
                # 客户端断开/取消:放弃计量帧,保持生成器关闭语义(不吞没 GeneratorExit)
                raise
            except Exception as _usage_err:  # 计量帧绝不影响主链路
                logger.warning("usage frame emit failed: %s", _usage_err)

        # 流结束后异步回调(仅当 metadata 含关联键且无错误时)
        # 客户端已断开则不触发 callback(避免 POST 到已废弃 URL)
        has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
        if has_association and not accumulated.get("error") and not await request.is_disconnected():
            url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
            # D24(2026-09-19 立):携带工具调用/终端任务历史,回调落库供恢复/回放/审计
            task = asyncio.create_task(_fire_callback(
                url, accumulated, req.metadata,
                tool_calls_history=tool_calls_history,
                terminal_tasks_history=terminal_tasks_history,
            injections=injection_frames,
            compaction_info=compaction_info,
            retry_notice=retry_notices[-1] if retry_notices else None,
            usage_detail=_usage_detail,
            fallback=fallback_records[-1] if fallback_records else None,
            memory_updates=_mem_updates if _mem_updates else None,
            steer_applied=steer_applied or None,
            ))
            _pending_callbacks.add(task)
            task.add_done_callback(_pending_callbacks.discard)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲,确保实时流式
        },
    )


@router.post("/llm/complete/stream/{session_id}/tool-result", response_model=None)
async def post_delegated_tool_result(session_id: str, body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """阶段 2:前端工具执行代理结果回传端点(2026-08-02 立)。

    前端收到 SSE tool-delegate 事件后,用 FileSystemDirectoryHandle 执行 fs 类工具,
    通过此端点回传结果,唤醒 ai-service tool loop 中等待的 asyncio.Event。
    """
    session = _delegate_sessions.get(session_id)
    if not session:
        return {"ok": False, "error": "session not found or expired"}
    tool_call_id = body.get("tool_call_id", "")
    result = body.get("result")
    error = body.get("error")
    # 存储结果
    session["result_" + tool_call_id] = {"result": result, "error": error}
    # 唤醒等待的 Event
    event = session.get("pending_" + tool_call_id)
    if event and isinstance(event, asyncio.Event):
        event.set()
    return {"ok": True}


@router.post("/llm/complete/stream/{session_id}/approval-response", response_model=None)
async def post_tool_approval_response(session_id: str, body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """V3 #58(2026-09-26 立):主对话流工具审批决策回传端点。

    前端弹窗(ToolApprovalDialog,channel='chat-stream')收到 tool-approval SSE 帧
    后,用户批准/拒绝经此端点回传,唤醒 llm.py tool loop 中等待审批的 asyncio.Event。
    与 agent 任务流的 /agents/approval-response 注册表互相独立(两套 session 域,
    主对话流审批条目在 _approval_sessions,agent 任务流在 agent_loop_v2 注册表)。
    兼容 camelCase(approvalId,与网关 /agent/approval-response 同款双写法)。
    """
    session = _approval_sessions.get(session_id)
    if not session:
        return {"ok": False, "error": "session not found or expired"}
    approval_id = str(body.get("approval_id") or body.get("approvalId") or "")
    entry = session.get(approval_id)
    if not entry or not isinstance(entry.get("event"), asyncio.Event):
        return {"ok": False, "error": "approval not found or expired"}
    decision = str(body.get("decision", "")).strip().lower()
    if decision not in ("approve", "reject"):
        return {"ok": False, "error": "decision must be approve/reject"}
    # scope 缺省 once(最小特权;与前端弹窗默认档一致,防旧客户端意外放大授权)
    scope = str(body.get("scope") or "once").strip().lower()
    if scope not in ("once", "session", "always"):
        scope = "once"
    # D158(2026-09-28,用户批"按预填上"):正交扩展 grant_rule —— 与三档 scope 语义并行,
    # 不新增第四个 scope 字符串。approve 时附带 = "顺手把这类命令写成前缀放行规则"。
    grant_rule_raw = body.get("grant_rule")
    grant_rule: dict[str, Any] | None = None
    if isinstance(grant_rule_raw, dict):
        _gk = str(grant_rule_raw.get("kind") or "")
        _gt = grant_rule_raw.get("tokens", 2)
        if _gk == "exec_prefix" and (isinstance(_gt, int) and 1 <= _gt <= 4):
            grant_rule = {"kind": "exec_prefix", "tokens": int(_gt)}
    entry["decision"] = decision
    entry["scope"] = scope
    entry["grant_rule"] = grant_rule  # None = 未要求生成规则(旧客户端语义不变)
    reason = body.get("reason")
    entry["reason"] = str(reason)[:500] if reason else None  # 截断与网关 schema 上限对齐
    entry["event"].set()
    return {"ok": True, "accepted": True, "approvalId": approval_id, "decision": decision}


def _form_settle_rejected(request_id: str) -> dict[str, Any]:
    """表单应答**未能结算**时的统一回包。

    "这条 requestId 不存在"与"这条存在但不是你的"必须**逐字段同形**:端点因此
    不可能被当成存在性探针(拿 404/403 的差异就能枚举出谁的 requestId 是真的)。
    形状与 approval-response 的既有失败回包对齐(`ok:False` + 单条 `error` 文本),
    不新增错误码字段 —— 调用方无法据此分辨两种情形,这正是本函目的。
    """
    return {"ok": False, "error": "form request not found or expired", "requestId": request_id}


@router.post("/llm/complete/stream/{session_id}/form-response", response_model=None)
async def post_form_response(
    request: Request,
    session_id: str,
    body: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    """V3 #63(2026-09-27 立):对话流业务表单的应答回传端点。

    前端 BusinessFormSection 的提交/拒绝经 `@ihui/api-client` 的 `postFormResponse`
    打到本端点,唤醒 llm.py 工具循环里等待用户填表的 asyncio.Event;工具循环据此把
    「用户填了什么 / 用户拒绝了 / 超时未答」回灌成一条 tool 消息。

    线格式是 **snake_case**(`request_id` / `reject_reason` / `message_id`),与同一条
    会话通道上的 tool-result(`tool_call_id`)同族 —— 注意**下行**的 form_request 帧是
    camelCase(解析层只认那三个 camel 键),两条通道形状不同不是疏漏。

    越权与不存在**同形回包**(见 `_form_settle_rejected`),且两种情形都**不结算**待决项。
    """
    request_id = str(body.get("request_id") or body.get("requestId") or "")
    if not request_id:
        return _form_settle_rejected(request_id)
    entry = _form_pending_entry(session_id, request_id)
    if entry is None:
        return _form_settle_rejected(request_id)

    # 归属判定:待决项在发帧时记的是**令牌主体** owner_uuid(见工具循环),
    # 这里再取一次当前调用方的主体比对。模型从来不能决定这两个值中的任何一个。
    caller_uid = _resolve_owner_uuid(request)
    owner_uid = entry.get("user_id")
    if isinstance(owner_uid, str) and owner_uid:
        if caller_uid != owner_uid:
            # 别人持有的 requestId:与"不存在"同形,且**绝不 set()那个 Event** ——
            # 先改了再抛 403 是本仓越权用例专门要断言排掉的写法。
            logger.warning(
                "form-response 越权尝试(session=%s, request=%s)已拒绝:未结算待决项",
                session_id,
                request_id,
            )
            return _form_settle_rejected(request_id)
    elif caller_uid is not None:
        # 待决项发帧时没有主体(未鉴权的开发/进程内路径),而调用方带身份 ——
        # 这不是"匹配",而是两条不同身份通道的偶然相遇,不予结算。
        return _form_settle_rejected(request_id)
    # 落到这里的情形:待决项与本调用方**都**没有主体。这是 jwt_secret 未启用
    # (开发态 / ASGI in-process 测试)时的**回退路径**,不构成授权结论:
    # 生产配置下中间件必注入 user_id,`entry["user_id"]` 恒为真实主体,走不到这一格。

    action = str(body.get("action", "")).strip().lower()
    if action not in ("approve", "reject"):
        return {"ok": False, "error": "action must be approve/reject"}

    values = body.get("values")
    reject_reason = body.get("reject_reason") or body.get("rejectReason")
    if action == "approve":
        # approve 必须带 values 对象;缺失/非对象 ⇒ 拒绝结算(不给"批准但内容为空"
        # 留一条静默通路,那会让模型以为用户交了白卷)
        if not isinstance(values, dict):
            return {"ok": False, "error": "values required for approve"}
        entry["values"] = values
        entry["reject_reason"] = None
    else:
        # 拒绝零副作用:整字段丢弃 values,而不是写个空对象(空对象会诱导下游
        # 建一条空草稿/空日程 —— 与端内 buildFormResponseEvent 的成对判据同一条)
        entry["values"] = None
        entry["reject_reason"] = str(reject_reason)[:500] if reject_reason else None
    entry["action"] = action
    ev = entry["event"]
    ev.set()
    return {"ok": True, "accepted": True, "requestId": request_id, "action": action}


@router.post("/llm/complete/stream/{session_id}/terminal-input", response_model=None)
async def post_terminal_input(
    request: Request,
    session_id: str,
    body: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    """D151(2026-09-29 立,用户批「默认开 + 单次等待 300s」):把用户键入送回正在等的命令。

    上行形状是 **snake_case**(`terminal_id` / `text`),与同通道的 form-response、
    tool-result 同族 —— 注意**下行**的 `terminal_interaction` 帧是 camelCase。

    归属判定只认**令牌主体**,不读 body 里的任何 userId;比对发生在 mcp_server 的
    唯一结算出口 `settle_terminal_input`(那里存的是带主记录的待决项)。
    "没这条"与"不是你的"**同形回包** —— 否则本端点会变成存在性预言机。

    刻意**不回显 text**:键入内容可能是密码,而返回值会进访问日志与响应体。
    """
    terminal_id = str(body.get("terminal_id") or body.get("terminalId") or "")
    text = body.get("text")
    if not terminal_id or not isinstance(text, str):
        # 形状不对也不告诉调用方差在哪一位:与"not found"同形,少一条可枚举的差异。
        return {"ok": False, "error": "terminal input request not found"}
    outcome = settle_terminal_input(
        session_id=session_id,
        terminal_id=terminal_id,
        text=text,
        caller_user_id=_resolve_owner_uuid(request),
    )
    if not outcome.get("settled"):
        logger.info(
            "terminal-input 未结算(session=%s, terminal=%s)—— 不存在或不属于本调用方",
            session_id,
            terminal_id,
        )
        return {"ok": False, "error": "terminal input request not found"}
    return {"ok": True, "accepted": True, "terminalId": terminal_id}


@router.post("/llm/sessions/{session_id}/goal", response_model=None)
async def post_session_goal(
    request: Request,
    session_id: str,
    body: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    """D152(2026-09-29 立,用户拍板「服务化,但存会话元数据、不建新表」):
    把一个会话的「当前目标 + 状态」写进**服务端主副本**。

    一个端点带 `action`(set / pause / resume / clear),不拆四条路由 —— 四种动作改的是
    同一个键、走同一条归属判定,拆四条就会有人只接三条(AGENTS §4「一条门只管自己立项
    那一型」的同族风险)。上行 body 是 **snake_case**(`elapsed_ms` / `token_usage`),
    与同通道的 form-response、terminal-input 同族;**下行** `goal_updated` 帧是 camelCase。

    三条不可漂的写法(AGENTS §5「认证不等于授权」):
      1. principal **只取令牌主体**(`_resolve_owner_uuid` 读 request.state.user_id,
         由 JWT 中间件注入),body 里自报的 userId **一律不读** —— 读了就是"可认领
         他人会话"的入口;
      2. "没这条会话"与"不是你的"**同形回包**(HTTP 200 + accepted:false),端点因此
         不可能被当成存在性预言机;两种情形**都不写库、都不发帧**;
      3. 未鉴权通道(caller_uid 为 None)对**写面**一律拒绝:这与 `_principal_allows`
         对内存线程放宽的方向不同 —— 那是"已经建在内存里、无人可证明身份的线程要不要
         继续跑",而这里是"能不能替这个会话改状态",没有 dev 回退可言。

    存储落点:`threads.metadata.goalState`(唯一写口
    `session_store.set_thread_goal_state`)。`thread/metadata` 的整写(merge=False)
    既抹不掉也改不动它 —— 守卫在 `carry_goal_keys`,由 `update_thread_metadata` 咽喉点
    施加,判序与身份键同形。

    回退口径(票第 8 栏):`accepted:false` 时调用方**退回纯本地态**(web stores/goal
    仍是缓存,功能不中断),不得弹"设置失败"。
    """
    from ..routers.sessions import get_session_store
    from ..services.agent_events import SSE_GOAL_UPDATED, publish_goal_update
    from ..services.session_store import (
        GOAL_STATUSES,
        normalize_goal_state,
        owner_scoped_allows,
        thread_owner,
    )

    def _rejected() -> dict[str, Any]:
        # 不带任何"为什么被拒"的差异字段 —— 差异本身就是可枚举的信息。
        return {"ok": False, "accepted": False, "sessionId": session_id}

    action = str(body.get("action") or "").strip().lower()
    if action not in ("set", "pause", "resume", "clear"):
        # 形状不对也不告诉调用方差在哪一位:与 not-found 同形。
        return _rejected()

    caller_uid = _resolve_owner_uuid(request)
    if caller_uid is None:
        return _rejected()

    store = get_session_store()
    thread_id = store.resolve_thread_id_for_conversation(session_id)
    if not thread_id:
        return _rejected()
    thread = store.get_thread(thread_id)
    if thread is None or not owner_scoped_allows(caller_uid, thread_owner(thread)):
        if thread is not None:
            # 别人的会话:**不写库、不发帧**,只留一行服务端日志(不给调用方任何差异)。
            logger.warning(
                "goal 越权尝试(session=%s, caller=%s)已拒绝:未写入、未广播",
                session_id,
                caller_uid,
            )
        return _rejected()

    existing = store.get_thread_goal_state(thread_id) or {}
    now = time.time()
    if action == "clear":
        new_state = None
        status = "cleared"
    else:
        objective = body.get("objective")
        status = {"set": "active", "pause": "paused", "resume": "active"}[action]
        candidate: dict[str, Any] = {
            "status": status,
            # set 带新文本;pause/resume 保留既有 objective(状态变了但目标没换)
            "objective": (
                str(objective)[:2000].strip()
                if isinstance(objective, str) and objective.strip()
                else str(existing.get("objective") or "")
            ),
            "updatedAt": now,
        }
        for src_key, dst_key in (("elapsed_ms", "elapsedMs"), ("token_usage", "tokenUsage")):
            value = body.get(src_key)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                value = existing.get(dst_key)
            if isinstance(value, int):
                candidate[dst_key] = value
        new_state = normalize_goal_state(candidate)
        if new_state is None or not new_state["objective"]:
            # set 却没目标文本 / 状态不在六档内:同形拒绝,且不写库。
            return _rejected()
        if not new_state["objective"] and status != "active":
            return _rejected()
        assert status in GOAL_STATUSES

    if store.set_thread_goal_state(thread_id, new_state) is None:
        return _rejected()

    payload: dict[str, Any] = {
        "type": SSE_GOAL_UPDATED,
        "sessionId": session_id,
        "status": status,
    }
    if new_state is not None:
        payload["objective"] = new_state.get("objective", "")
        payload["updatedAt"] = new_state.get("updatedAt", now)
        for _k in ("elapsedMs", "tokenUsage"):
            if new_state.get(_k) is not None:
                payload[_k] = new_state[_k]
    # 推进该会话当前所有活跃流(别的端**不刷新**即见)。返回 0 不是失败:主副本已落库,
    # 下一次流首会带出当前目标 —— 所以刻意不因 0 投递而改判 accepted。
    publish_goal_update(session_id, payload)
    return {
        "ok": True,
        "accepted": True,
        "status": status,
        "sessionId": session_id,
        "threadId": thread_id,
    }


@router.post("/llm/complete/stream/{session_id}/steer", response_model=None)
async def post_steer_message(session_id: str, body: dict[str, Any] = Body(...)) -> Any:
    """Steer(中途引导,2026-09-19 立):流式对话期间提交引导文本。

    文本入队 _steer_sessions[session_id];tool loop 每轮 LLM 调用前 drain 注入
    messages 并发 event: steer(phase=injected),不打断当前工具执行。
    G-815975:body.kind 选条目类型(缺省 guide;control=设置轮,不可 inline,
    吸收循环在它面前停,收口未消费时发 steer(phase=dropped) 显式回报)。
    状态码:422 text 缺失/为空或 kind 非法;404 流不存在或已结束;429 队列满;200 入队成功。
    """
    text = str(body.get("text", "")).strip()
    if not text:
        return JSONResponse(
            status_code=422,
            content={"ok": False, "error": "text required"},
        )
    kind = str(body.get("kind") or "guide").strip()
    if kind not in STEER_KINDS:
        return JSONResponse(
            status_code=422,
            content={"ok": False, "error": f"kind must be one of {sorted(STEER_KINDS)}"},
        )
    queue = _steer_sessions.get(session_id)
    if queue is None:
        return JSONResponse(
            status_code=404,
            content={"ok": False, "error": "session not found or expired"},
        )
    if len(queue) >= _STEER_QUEUE_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"ok": False, "error": "steer queue full"},
        )
    queue.append({
        "text": text[:4000],  # 截断防超长注入撑爆上下文
        "queuedAt": datetime.now(UTC).isoformat(),
        "kind": kind,  # G-815975:类型轴(control 不可 inline,吸收在它面前停)
    })
    return {"ok": True, "queued": len(queue), "kind": kind}


# =============================================================================
# D201 多根工作区(2026-10-02 立):会话级附加目录控制端点
# =============================================================================
# 对标 Qoder/Codex/Trae 的 add_directories 控制帧:会话中途追加/移除目录。
# 键 = conversationId(与工具执行链 call_tool 的 session_id 同源 —— 流会话 ID
# 每轮新生成,工具校验层认的是 conversationId),注册表在 mcp_server 模块级。
# **整表替换**语义:paths=[] 即清空(移除即失效,不留残根);任一目录准入失败
# 整表拒绝(422,不做部分生效)。生命周期 = ai-service 进程内存态(与 thread.settings
# 热更项一致,重启后须重新下发;持久化面由网关侧写会话 metadata)。
# 准入校验(绝对路径/存在/是目录)在 set_session_extra_roots 内。
@router.post("/llm/conversations/{conversation_id}/directories")
async def post_conversation_directories(
    conversation_id: str, body: dict[str, Any] = Body(...)
) -> Any:
    if not conversation_id.strip():
        return JSONResponse(
            status_code=422,
            content={"ok": False, "error": "conversation_id required"},
        )
    paths = body.get("paths")
    if not isinstance(paths, list) or not all(isinstance(x, str) for x in paths):
        return JSONResponse(
            status_code=422,
            content={
                "ok": False,
                "error": "paths must be a list of strings (empty list = clear)",
            },
        )
    from ..services.mcp_server import set_session_extra_roots

    try:
        effective = set_session_extra_roots(conversation_id, paths)
    except ValueError as e:
        return JSONResponse(status_code=422, content={"ok": False, "error": str(e)})
    return {"ok": True, "additionalDirectories": list(effective)}


# D24(2026-09-19 立):工具调用/终端任务持久化 —— metadata 体积护栏。
# chat_messages.metadata 为 jsonb 列,工具 result 可能是整文件内容/长命令输出,
# 不截断会把 metadata 撑到 MB 级拖垮会话列表查询。量级与 SSE 事件对齐:
# args 2000 / result 8000(与 terminal output 截断同量级),超长退化为截断文本。
_TOOL_ARGS_PERSIST_LIMIT = 2000
_TOOL_RESULT_PERSIST_LIMIT = 8000


def _truncate_persist_value(value: Any, limit: int) -> Any:
    """D24(2026-09-19 立):持久化值截断 —— 序列化超 limit 时退化为截断文本。

    体积在限内原样返回(保持结构,前端 ToolCallCard 按 dict 渲染);
    超限返回带标注的截断字符串(截断后的 JSON 无法安全反序列化,退化为文本
    是明确可预期的展示形态,前端 result 展示区按文本渲染)。
    """
    try:
        _s = json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        _s = str(value)
    if len(_s) <= limit:
        return value
    return f"{_s[:limit]}...[truncated {len(_s) - limit} chars]"


def _build_persisted_tool_calls(
    tool_calls_history: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """D24(2026-09-19 立):把 tool loop 的工具调用历史构造为可持久化数组。

    随 _fire_callback 落库到 chat_messages.metadata.toolCalls,恢复会话/
    回放/审计时还原工具卡(对标 Codex TUI 历史完整 patch G-31)。

    结构与 packages/types/src/ai.ts 的 BaseToolCall 对齐:
    id/toolName/status/isError/iteration/durationMs/repeated/serverSource/
    serverId/serverName/startedAt/endedAt/args/result。
    status 三态推导(BaseToolCall.status 必填):result 缺失 → running;
    isError → error;其余 → success。
    体积护栏:args/result 经 _truncate_persist_value 截断(2000/8000 字符),
    与 share-content.ts 分享回放的隐私剥离不同 —— 本处是用户私有会话恢复,
    本人可见,保留内容用于完整还原,仅限体积。
    """
    out: list[dict[str, Any]] = []
    for rec in tool_calls_history:
        if not isinstance(rec, dict):
            continue
        _tc_id = str(rec.get("toolCallId") or "")
        _name = str(rec.get("toolName") or "")
        if not _tc_id and not _name:
            continue
        _has_result = rec.get("result") is not None
        _is_err = bool(rec.get("isError"))
        item: dict[str, Any] = {
            "id": _tc_id,
            "toolName": _name,
            "status": "error" if _is_err else ("success" if _has_result else "running"),
        }
        if _is_err:
            item["isError"] = True
        args = rec.get("args")
        if isinstance(args, dict) and args:
            item["args"] = _truncate_persist_value(args, _TOOL_ARGS_PERSIST_LIMIT)
        if _has_result:
            item["result"] = _truncate_persist_value(
                rec.get("result"), _TOOL_RESULT_PERSIST_LIMIT
            )
        # 透传展示/审计字段(值存在才写,保持 metadata 精简)
        for k in (
            "iteration", "repeated", "serverSource", "serverId", "serverName",
            "startedAt", "endedAt",
        ):
            v = rec.get(k)
            if v is not None and v != "":
                item[k] = v
        dur = rec.get("durationMs")
        if isinstance(dur, (int, float)) and dur >= 0:
            item["durationMs"] = int(dur)
        out.append(item)
    return out


async def _fire_callback(
    url: str,
    payload: dict[str, Any],
    metadata: dict[str, Any] | None,
    *,
    tool_calls_history: list[dict[str, Any]] | None = None,
    terminal_tasks_history: list[dict[str, Any]] | None = None,
    injections: list[dict[str, Any]] | None = None,
    compaction_info: dict[str, Any] | None = None,
    retry_notice: dict[str, Any] | None = None,
    usage_detail: dict[str, Any] | None = None,
    fallback: dict[str, Any] | None = None,
    memory_updates: list[str] | None = None,
    steer_applied: list[dict[str, Any]] | None = None,
) -> None:
    """异步 POST 推理结果到 callback_url。

    失败静默(只记日志),不阻塞主流程。
    由 API 侧的 /api/ai/callback 端点接收并入队 aiCallback 处理。

    D24(2026-09-19 立):tool_calls_history / terminal_tasks_history 非空时,
    经 _build_persisted_tool_calls 构造后附加到回调 body 的 toolCalls /
    terminalTasks 字段,API 侧落库到 chat_messages.metadata,恢复会话/
    回放/审计时还原工具卡与终端区。非流式端点(/llm/complete)无 tool loop,
    不传即缺省 None(不带字段,向后兼容)。

    planSteps 持久化(2026-09-21 立):同一份 tool_calls_history 还经
    _build_plan_snapshot 生成 body.planSteps,与 SSE plan_updated 的 plan 数组
    逐字段同源。API 侧 /api/ai/callback 收到后浅合并进
    chat_messages.metadata.planSteps(已有 jsonb 列,零 schema 迁移),使刷新页面 /
    重拉历史后输入框上方任务状态条与消息流 PlanStepsCard 均可回放。

    健壮性:
    - 若配置 ai_callback_secret,携带 X-Internal-Secret 头(与后端共享密钥校验)
    - 对 5xx / 网络错误重试 2 次(指数退避 0.5s → 1s),4xx 不重试(请求本身有问题)
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)
    body = {
        "content": payload.get("content", ""),
        "model": payload.get("model"),
        "usage": payload.get("usage"),
        "stub": payload.get("stub", False),
        "metadata": metadata or {},
    }
    if payload.get("reasoning"):
        body["reasoning"] = payload["reasoning"]
    # D24(2026-09-19 立):工具调用与终端任务持久化通道(空历史不写字段,
    # 与"无工具调用"语义区分,也避免 API 侧收到空数组)
    _persist_calls = _build_persisted_tool_calls(tool_calls_history or [])
    if _persist_calls:
        body["toolCalls"] = _persist_calls
    if terminal_tasks_history:
        body["terminalTasks"] = terminal_tasks_history
    # planSteps 持久化(2026-09-21 立,零 schema 迁移):与 plan_updated SSE 事件
    # 逐字段同源(_build_plan_snapshot 单一真相源),API 侧浅合并进
    # chat_messages.metadata.planSteps,jsonb 已有列,不新增字段/不改表结构。
    # 空快照不写字段:与"本轮无计划"语义区分,也不会覆盖 worker 已合并的其他 key。
    _persist_plan = _build_plan_snapshot(tool_calls_history or [])
    if _persist_plan:
        body["planSteps"] = _persist_plan
    # G-166(2026-09-22 立)交代帧持久化:citations 与 SSE citations 事件**同一个
    # _collect_citations** 产出(同源同去重同上限),injections 与 SSE injection_applied
    # 帧同源(流内累积的同一份列表),落库后刷新页面 / 重拉历史仍能交代"引用了哪些来源、
    # 带了哪些上下文"。空列表不写字段:与"本轮无引用/无注入"区分,也不覆盖 worker
    # 已浅合并的其他 key。injections 里的 "type" 是 SSE 帧判别字,持久化记录不需要 → 剥掉。
    _persist_citations = _collect_citations(tool_calls_history or [])
    if _persist_citations:
        body["citations"] = _persist_citations
    _persist_injections = [{k: v for k, v in f.items() if k != "type"} for f in injections or []]
    if _persist_injections:
        body["injections"] = _persist_injections
    # compaction(G-166 第②步):载荷与 SSE compaction 帧同一个 _compaction_payload,
    # 未压缩且未撞上限时返回 None → 不写字段(与"本轮没压缩"语义一致)。
    _persist_compaction = _compaction_payload(compaction_info)
    if _persist_compaction:
        body["compaction"] = _persist_compaction
    # retryNotice(G-166 第⑥步):同一轮可能重试多次,落**最后一条**(attempt 最大 = 最终那次)
    if retry_notice:
        body["retryNotice"] = retry_notice
    # D33(2026-09-23 立):usageDetail / fallback / memoryUpdates 过程性信息持久化。
    # 与 citations / compaction 同一套"非空才写字段"语义:空值(None/空数组)不写 key,
    # worker 侧浅合并因此不会覆盖已合并的其他 key(与 planSteps 同口径)。
    if usage_detail:
        body["usageDetail"] = usage_detail
    if fallback:
        body["fallback"] = fallback
    if memory_updates:
        body["memoryUpdates"] = memory_updates
    # D33 剩余类(2026-09-24 立):steer 注入记录,与 SSE steer(phase=injected) 帧同源
    # (同一 drain 循环逐条累积)。非空才写 key,形状 {text, timestamp?} 与 web
    # SteerNotice 对齐,刷新后「⚡ 引导已生效」badge 由读回侧灌回既有渲染位。
    if steer_applied:
        body["steerApplied"] = steer_applied
    # 2026-08-06 修复(配套):API 侧 /api/ai/callback 已改为 fail-closed
    # (未配置 AI_CALLBACK_SECRET 直接 401 拒绝)。此处未配置 ai_callback_secret
    # 时回调必然被拒,跳过发送并记录明确错误,避免无效网络请求 + 静默丢回调。
    if not settings.ai_callback_secret:
        logger.error(
            "LLM callback skipped: ai_callback_secret 未配置(API 侧 AI_CALLBACK_SECRET 缺失时拒绝回调)"
        )
        return
    headers: dict[str, str] = {"X-Internal-Secret": settings.ai_callback_secret}

    max_attempts = 3  # 首次 + 2 次重试
    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=body, headers=headers)
                if resp.status_code < 500:
                    # 2xx 成功 / 4xx 客户端错误(请求本身有问题,不重试)
                    if resp.status_code >= 400:
                        logger.warning(
                            "LLM callback to %s failed: %s %s",
                            url,
                            resp.status_code,
                            resp.text[:200],
                        )
                    return
                # 5xx 服务端错误,可重试
                if attempt < max_attempts - 1:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                    continue
                logger.warning(
                    "LLM callback to %s failed after %d attempts: %s %s",
                    url,
                    max_attempts,
                    resp.status_code,
                    resp.text[:200],
                )
        except Exception as e:
            if attempt < max_attempts - 1:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            logger.warning("LLM callback to %s error after %d attempts: %s", url, max_attempts, e)


# ---------------------------------------------------------------------------
# MoA / Vision 路由(P2-2 + P2-3,对标 Hermes Agent provider 扩展 + 多模态输入)
# ---------------------------------------------------------------------------


@router.get("/llm/moa-presets")
async def list_moa_presets() -> dict[str, Any]:
    """列出所有 MoA 预设。"""
    return {"code": 0, "message": "ok", "data": moa_router.list_presets()}


@router.post("/llm/moa-presets")
async def register_moa_preset(request: Request) -> dict[str, Any]:
    """注册 MoA 预设。

    请求体(MoaPreset 契约):
    - name: 预设名(必填)
    - models: 模型列表,每项含 {model, role: proposer|aggregator|critic}
    """
    body = await request.json()
    name = body.get("name")
    if not name:
        return {"code": 1, "message": "name is required"}
    moa_router.register_preset(name, body)
    return {"code": 0, "message": "ok"}


@router.post("/llm/moa-complete")
async def moa_complete(request: Request) -> dict[str, Any]:
    """MoA 推理(多模型出方案 + 聚合)。

    请求体:
    - messages: OpenAI 格式消息列表
    - presetName: MoA 预设名
    """
    body = await request.json()
    messages = body.get("messages", [])
    preset_name = body.get("presetName", "")
    if not preset_name:
        return {"code": 1, "message": "presetName is required"}
    result = await moa_router.complete(messages, preset_name)
    return {"code": 0, "message": "ok", "data": result}


@router.post("/llm/vision")
async def vision_analyze(request: Request) -> dict[str, Any]:
    """视觉分析(图像 URL 或 base64 + 任务描述 → LLM 视觉模型分析)。

    请求体(VisionAnalyzeRequest 契约):
    - image: 图片 URL 或 base64 编码(必填)
    - task: 分析任务描述(必填)
    - model: 期望模型(可选)
    """
    body = await request.json()
    result = await _tool_vision_analyze(body)
    return {"code": 0, "message": "ok", "data": result}


# ---------------------------------------------------------------------------
# Embeddings 路由(2026-07-22 立,补建 v1/embeddings 503 修复的依赖端点)
# ---------------------------------------------------------------------------


class EmbeddingsRequest(BaseModel):
    """Embedding 向量生成请求(OpenAI 兼容)。"""

    model: str = Field(..., description="模型名称")
    input: str | list[str] = Field(..., description="文本或文本列表")
    dimensions: int | None = Field(None, description="输出维度(部分模型支持)")


@router.post("/llm/embeddings", response_model=None)
async def create_embeddings(req: EmbeddingsRequest) -> dict[str, Any] | JSONResponse:
    """生成文本嵌入向量(OpenAI 兼容格式)。

    返回格式:
    {
        "object": "list",
        "data": [{"object": "embedding", "index": 0, "embedding": [0.1, ...]}],
        "model": "text-embedding-3-small",
        "usage": {"prompt_tokens": 10, "total_tokens": 10}
    }
    """
    texts = [req.input] if isinstance(req.input, str) else list(req.input)
    if not texts:
        return JSONResponse(
            status_code=400,
            content={"code": "INVALID_INPUT", "message": "input must not be empty", "model": req.model},
        )

    used_model = req.model or getattr(settings, "embedding_model", "text-embedding-3-small")

    # stub 模式:逐条调 llm_gateway.embed(返回确定性哈希向量,无真实 usage)
    if llm_gateway._is_stub_mode():
        embeddings = [await llm_gateway.embed(t, used_model) for t in texts]
        total_chars = sum(len(t) for t in texts)
        est_tokens = max(1, total_chars // 4)
        return {
            "object": "list",
            "data": [
                {"object": "embedding", "index": i, "embedding": emb}
                for i, emb in enumerate(embeddings)
            ],
            "model": used_model,
            "usage": {"prompt_tokens": est_tokens, "total_tokens": est_tokens},
        }

    # 非 stub 模式:直接调 litellm.aembedding(批量,含真实 usage)
    import litellm

    kwargs: dict[str, Any] = {}
    if req.dimensions is not None:
        kwargs["dimensions"] = req.dimensions
    try:
        response = await litellm.aembedding(model=used_model, input=texts, **kwargs)
    except Exception as e:
        logger.exception("Embedding generation failed: model=%s", used_model)
        return JSONResponse(
            status_code=502,
            content={"code": "EMBEDDING_ERROR", "message": str(e), "model": used_model},
        )

    embeddings = [item["embedding"] for item in response.data]
    usage_obj = getattr(response, "usage", None)
    if isinstance(usage_obj, dict):
        prompt_tokens = usage_obj.get("prompt_tokens", 0) or 0
        total_tokens = usage_obj.get("total_tokens", 0) or 0
    else:
        prompt_tokens = getattr(usage_obj, "prompt_tokens", 0) or 0
        total_tokens = getattr(usage_obj, "total_tokens", 0) or 0

    return {
        "object": "list",
        "data": [
            {"object": "embedding", "index": i, "embedding": emb}
            for i, emb in enumerate(embeddings)
        ],
        "model": used_model,
        "usage": {"prompt_tokens": prompt_tokens, "total_tokens": total_tokens},
    }


# ============================================================================
# P0-2 协议互转端点(2026-07-30 立,对齐 OmniRoute 三协议互转)
#
# 暴露 Anthropic Messages 和 Gemini generateContent 协议端点,客户端可直接用
# 对应厂商官方 SDK 调用 IHUI 网关,无需改 SDK 代码。内部用 ProtocolAdapter
# 转成 OpenAI 格式走 llm_gateway 标准调用链,响应转回入站协议格式。
#
# 端点:
# - POST /llm/anthropic/v1/messages          (Anthropic Messages 协议,支持 stream)
# - POST /llm/gemini/v1beta/models/{model}:generateContent  (Gemini 协议,支持 stream)
# - POST /llm/gemini/v1beta/models/{model}:streamGenerateContent  (Gemini 强制流式)
# ============================================================================


def _anthropic_streaming_response(
    messages: list[dict[str, Any]], model: str, kwargs: dict[str, Any], request: Request
) -> StreamingResponse:
    """构造 Anthropic Messages SSE 流式响应(对齐 Anthropic Messages Streaming)。

    SSE 事件序列:
    1. event: message_start — 初始消息元数据
    2. event: content_block_start — 文本块开始
    3. event: content_block_delta (多次) — 逐 token 文本增量
    4. event: content_block_stop — 文本块结束
    5. event: message_delta — 消息级增量(stop_reason + usage)
    6. event: message_stop — 消息结束
    """
    msg_id = f"msg_{uuid.uuid4().hex[:24]}"

    async def gen() -> AsyncIterator[str]:
        # 1. message_start
        msg_start = {
            "type": "message_start",
            "message": {
                "id": msg_id,
                "type": "message",
                "role": "assistant",
                "content": [],
                "model": model,
                "stop_reason": None,
                "usage": {"input_tokens": 0, "output_tokens": 0},
            },
        }
        yield _sse(SSE_MESSAGE_START, msg_start)

        # 2. content_block_start
        block_start = {
            "type": "content_block_start",
            "index": 0,
            "content_block": {"type": "text", "text": ""},
        }
        yield _sse(SSE_CONTENT_BLOCK_START, block_start)

        # 3. content_block_delta(逐 token)
        final_usage: dict[str, Any] = {}
        try:
            async for event in llm_gateway.astream(messages, model=model, **kwargs):
                # P2 修复(2026-08-06):客户端断开后立即停止消费上游流,
                # 避免 LLM token 继续生成浪费资源(StreamingResponse 断开取消 + 显式检测双保险)。
                if await request.is_disconnected():
                    return
                event_type = event.get("type", "")
                if event_type in ("chunk", "message"):
                    text = event.get("content", "")
                    if text:
                        delta = {
                            "type": "content_block_delta",
                            "index": 0,
                            "delta": {"type": "text_delta", "text": text},
                        }
                        yield _sse(SSE_CONTENT_BLOCK_DELTA, delta)
                elif event_type == "done":
                    final_usage = event.get("usage", {})
                elif event_type == "error":
                    err_evt = {
                        "type": "error",
                        "error": {"type": "api_error", "message": event.get("message", "LLM 流式调用失败")},
                    }
                    yield _sse(SSE_ERROR, err_evt)
                    return
        except Exception as e:
            err_evt = {
                "type": "error",
                "error": {"type": "api_error", "message": str(e)[:500]},
            }
            yield _sse(SSE_ERROR, err_evt)
            return

        # 4. content_block_stop
        block_stop = {"type": "content_block_stop", "index": 0}
        yield _sse(SSE_CONTENT_BLOCK_STOP, block_stop)

        # 5. message_delta(stop_reason + usage)
        usage = final_usage or {}
        out_tokens = usage.get("completion_tokens", 0)
        msg_delta = {
            "type": "message_delta",
            "delta": {"stop_reason": "end_turn"},
            "usage": {"output_tokens": out_tokens},
        }
        yield _sse(SSE_MESSAGE_DELTA, msg_delta)

        # 6. message_stop
        msg_stop = {"type": "message_stop"}
        yield _sse(SSE_MESSAGE_STOP, msg_stop)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _gemini_streaming_response(
    messages: list[dict[str, Any]], model: str, kwargs: dict[str, Any], request: Request
) -> StreamingResponse:
    """构造 Gemini generateContent SSE 流式响应(对齐 Gemini Streaming)。

    SSE 格式:
        data: {"candidates":[{"content":{"parts":[{"text":"..."}],"role":"model"},"index":0}]}

    最后一个 chunk 含 finishReason + usageMetadata。
    """
    async def gen() -> AsyncIterator[str]:
        final_usage: dict[str, Any] = {}
        try:
            async for event in llm_gateway.astream(messages, model=model, **kwargs):
                # P2 修复(2026-08-06):客户端断开后立即停止消费上游流,
                # 避免 LLM token 继续生成浪费资源。
                if await request.is_disconnected():
                    return
                event_type = event.get("type", "")
                if event_type in ("chunk", "message"):
                    text = event.get("content", "")
                    if text:
                        chunk_data = {
                            "candidates": [{
                                "content": {"parts": [{"text": text}], "role": "model"},
                                "index": 0,
                            }],
                        }
                        yield f"data: {json.dumps(chunk_data, ensure_ascii=False)}\n\n"
                elif event_type == "done":
                    final_usage = event.get("usage", {})
                elif event_type == "error":
                    err_data = {
                        "error": {"code": 502, "message": event.get("message", "LLM 流式调用失败"), "status": "INTERNAL"},
                    }
                    yield f"data: {json.dumps(err_data, ensure_ascii=False)}\n\n"
                    return
        except Exception as e:
            err_data = {
                "error": {"code": 502, "message": str(e)[:500], "status": "INTERNAL"},
            }
            yield f"data: {json.dumps(err_data, ensure_ascii=False)}\n\n"
            return

        # 最后一个 chunk:含 finishReason + usageMetadata
        usage = final_usage or {}
        final_chunk = {
            "candidates": [{
                "content": {"parts": [{"text": ""}], "role": "model"},
                "finishReason": "STOP",
                "index": 0,
            }],
            "usageMetadata": {
                "promptTokenCount": usage.get("prompt_tokens", 0),
                "candidatesTokenCount": usage.get("completion_tokens", 0),
                "totalTokenCount": usage.get("total_tokens", 0),
            },
        }
        yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/llm/anthropic/v1/messages", response_model=None)
async def anthropic_messages_endpoint(request: Request) -> dict[str, Any] | JSONResponse | StreamingResponse:
    """Anthropic Messages 协议端点(对齐 OmniRoute 协议互转)。

    客户端可直接用 Anthropic 官方 SDK:
        from anthropic import Anthropic
        client = Anthropic(api_key="ihui-relay-key", base_url="http://ai-service:8800/llm/anthropic")
        resp = client.messages.create(model="claude-3.5-sonnet", max_tokens=1024, messages=[...])

    内部流程:
    1. 接收 Anthropic Messages 格式 payload
    2. ProtocolAdapter 转成 OpenAI Chat Completions 格式
    3. 调 llm_gateway.complete()(享受 Combo fallback / provider 适配器 / stub 降级)
    4. 响应用 ProtocolAdapter 转回 Anthropic Messages 格式
    """
    try:
        from ..services.protocol_adapter import (
            ProtocolType,
            protocol_converter,
        )
    except ImportError as e:
        logger.error("ProtocolAdapter 加载失败: %s", e)
        return JSONResponse(
            status_code=503,
            content={"type": "error", "error": {"type": "service_unavailable", "message": "ProtocolAdapter unavailable"}},
        )

    try:
        payload = await request.json()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"type": "error", "error": {"type": "invalid_request", "message": f"JSON 解析失败: {e}"}},
        )

    # Anthropic → OpenAI
    openai_req = protocol_converter.convert_request(
        payload, ProtocolType.ANTHROPIC, ProtocolType.OPENAI
    )
    model = openai_req.get("model") or payload.get("model") or settings.litellm_model
    messages = openai_req.get("messages", [])
    kwargs: dict[str, Any] = {}
    for k in ("tools", "tool_choice", "temperature", "max_tokens"):
        if k in openai_req:
            kwargs[k] = openai_req[k]

    # streaming 模式:调 llm_gateway.astream() + Anthropic SSE 事件格式输出
    if bool(payload.get("stream", False)):
        return _anthropic_streaming_response(messages, model, kwargs, request)

    result = await llm_gateway.complete(messages, model=model, **kwargs)
    if result.get("error"):
        err_msg = str(result.get("error_message") or "LLM 调用失败")
        return JSONResponse(
            status_code=502,
            content={
                "type": "error",
                "error": {"type": "api_error", "message": err_msg},
            },
        )

    # OpenAI 响应 → Anthropic 响应
    openai_resp = {
        "id": f"msg_{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "model": result.get("model", model),
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": result.get("content", ""),
                "tool_calls": result.get("tool_calls"),
            },
            "finish_reason": "stop",
        }],
        "usage": result.get("usage", {}),
    }
    anthropic_resp = protocol_converter.convert_response(
        openai_resp, ProtocolType.OPENAI, ProtocolType.ANTHROPIC
    )
    return anthropic_resp


@router.post("/llm/gemini/v1beta/models/{model_name}:generateContent", response_model=None)
async def gemini_generate_content_endpoint(
    model_name: str,
    request: Request,
) -> dict[str, Any] | JSONResponse | StreamingResponse:
    """Gemini generateContent 协议端点(对齐 OmniRoute 协议互转)。

    客户端可直接用 Google Gen AI SDK:
        from google import genai
        client = genai.Client(api_key="ihui-relay-key", http_options={"base_url": "http://ai-service:8800/llm/gemini"})
        resp = client.models.generate_content(model="gemini-1.5-pro", contents="Hello")

    内部流程:
    1. 接收 Gemini generateContent 格式 payload
    2. ProtocolAdapter 转成 OpenAI Chat Completions 格式
    3. 调 llm_gateway.complete()(stream=true 时调 astream)
    4. 响应用 ProtocolAdapter 转回 Gemini generateContent 格式
    """
    try:
        from ..services.protocol_adapter import (
            ProtocolType,
            protocol_converter,
        )
    except ImportError as e:
        logger.error("ProtocolAdapter 加载失败: %s", e)
        return JSONResponse(
            status_code=503,
            content={"error": {"code": 503, "message": "ProtocolAdapter unavailable"}},
        )

    try:
        payload = await request.json()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": 400, "message": f"JSON 解析失败: {e}"}},
        )

    # Gemini → OpenAI
    openai_req = protocol_converter.convert_request(
        payload, ProtocolType.GEMINI, ProtocolType.OPENAI
    )
    # Gemini 的 model 在 URL path 中,需要补回
    messages = openai_req.get("messages", [])
    kwargs: dict[str, Any] = {}
    for k in ("tools", "temperature", "max_tokens"):
        if k in openai_req:
            kwargs[k] = openai_req[k]
    # topP → top_p(OpenAI 命名)
    if "topP" in payload.get("generationConfig", {}):
        kwargs["top_p"] = payload["generationConfig"]["topP"]

    # streaming 模式:调 llm_gateway.astream() + Gemini SSE 格式输出
    if bool(payload.get("stream", False)):
        return _gemini_streaming_response(messages, model_name, kwargs, request)

    result = await llm_gateway.complete(messages, model=model_name, **kwargs)
    if result.get("error"):
        err_msg = str(result.get("error_message") or "LLM 调用失败")
        return JSONResponse(
            status_code=502,
            content={"error": {"code": 502, "message": err_msg, "status": "INTERNAL"}},
        )

    # OpenAI 响应 → Gemini 响应
    openai_resp = {
        "object": "chat.completion",
        "model": result.get("model", model_name),
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": result.get("content", ""),
                "tool_calls": result.get("tool_calls"),
            },
            "finish_reason": "stop",
        }],
        "usage": result.get("usage", {}),
    }
    gemini_resp = protocol_converter.convert_response(
        openai_resp, ProtocolType.OPENAI, ProtocolType.GEMINI
    )
    return gemini_resp


@router.post("/llm/gemini/v1beta/models/{model_name}:streamGenerateContent", response_model=None)
async def gemini_stream_generate_content_endpoint(
    model_name: str,
    request: Request,
) -> dict[str, Any] | JSONResponse | StreamingResponse:
    """Gemini streamGenerateContent 协议端点(强制流式,对齐 Gemini SDK streaming)。

    客户端可直接用 Google Gen AI SDK 的 stream 参数:
        from google import genai
        client = genai.Client(api_key="ihui-relay-key", http_options={"base_url": "http://ai-service:8800/llm/gemini"})
        resp = client.models.generate_content(model="gemini-1.5-pro", contents="Hello", stream=True)

    内部流程与 :generateContent 一致,但始终走流式输出(Gemini SSE 格式)。
    """
    try:
        from ..services.protocol_adapter import (
            ProtocolType,
            protocol_converter,
        )
    except ImportError as e:
        logger.error("ProtocolAdapter 加载失败: %s", e)
        return JSONResponse(
            status_code=503,
            content={"error": {"code": 503, "message": "ProtocolAdapter unavailable"}},
        )

    try:
        payload = await request.json()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": 400, "message": f"JSON 解析失败: {e}"}},
        )

    # Gemini → OpenAI
    openai_req = protocol_converter.convert_request(
        payload, ProtocolType.GEMINI, ProtocolType.OPENAI
    )
    messages = openai_req.get("messages", [])
    kwargs: dict[str, Any] = {}
    for k in ("tools", "temperature", "max_tokens"):
        if k in openai_req:
            kwargs[k] = openai_req[k]
    if "topP" in payload.get("generationConfig", {}):
        kwargs["top_p"] = payload["generationConfig"]["topP"]

    return _gemini_streaming_response(messages, model_name, kwargs, request)


@router.get("/llm/free-providers", response_model=None)
async def list_free_providers() -> dict[str, Any]:
    """免费 provider 注册表(对齐 OmniRoute 免费 provider 矩阵 + 超越)。

    返回 30+ 免费 LLM provider 的申请入口、免费额度、限制、key 配置状态,
    供前端 Dashboard 可视化展示"已配置 / 未配置 / 本地"三态。

    超越 OmniRoute 的点:
    - 本地 LLM 兜底(Ollama / LMStudio / LlamaCpp / vLLM)
    - 国内 provider 全覆盖(中文场景优化)
    - key 状态感知(从 .env 检测)
    """
    try:
        from ..services.free_provider_registry import free_provider_registry
    except ImportError as e:
        logger.error("FreeProviderRegistry 加载失败: %s", e)
        return _wrap_ok({"providers": [], "total": 0, "configured": 0, "local": 0, "not_configured": 0})

    providers = free_provider_registry.to_dashboard_dict()
    configured = sum(1 for p in providers if p["status"] == "configured")
    local_count = sum(1 for p in providers if p["status"] == "local")
    return _wrap_ok({
        "providers": providers,
        "total": len(providers),
        "configured": configured,
        "local": local_count,
        "not_configured": len(providers) - configured - local_count,
    })


# ============================================================================
# P0-3 网关 Dashboard 后端 API(2026-07-30 立,对齐 OmniRoute Dashboard + 超越)
#
# 暴露 provider 健康状态 + combo 链 CRUD,供前端 Dashboard 可视化展示:
# - GET    /llm/providers/health  — 所有免费 provider 健康状态(含 429 冷却期)
# - GET    /llm/combos            — 列出所有 combo 链配置
# - POST   /llm/combos            — 创建/更新 combo 链配置
# - DELETE /llm/combos/{name}     — 删除 combo 链配置
# ============================================================================


def _aggregate_provider_health(default_models: list[str]) -> tuple[bool, int]:
    """聚合 provider 在 ComboRouter 中的健康状态。

    遍历 provider 的 default_models,检查是否有任一 model 在 combo_router._health 中,
    聚合 is_in_cooldown(任一 model 在冷却期则 True)和 consecutive_failures(取最大值)。

    Args:
        default_models: provider 的推荐免费模型列表。

    Returns:
        (is_in_cooldown, consecutive_failures) 二元组。
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError:
        return (False, 0)

    is_in_cooldown = False
    max_failures = 0
    for model in default_models:
        health = combo_router._health.get(model)
        if health is not None:
            if health.is_in_cooldown():
                is_in_cooldown = True
            max_failures = max(max_failures, health.consecutive_failures)
    return (is_in_cooldown, max_failures)


@router.get("/llm/providers/health", response_model=None)
async def list_providers_health() -> dict[str, Any]:
    """所有已配置 provider 的实时健康状态(主动预检,供 Dashboard 可视化)。

    H3(Phase B,2026-08-01 升级):主动预检版 —
    对每个已配置 provider 并发发 GET {api_base}/models 验证 key 有效性 + 连通性。

    返回结构(_wrap_ok 信封):
    {
      "code": 0,
      "data": {
        "providers": [
          {
            "provider": "openai",
            "status": "ok"|"invalid_key"|"unreachable"|"not_configured",
            "latency_ms": 123,
            "model_count": 42,
            "error": null,
            "last_check": "2026-08-01T12:00:00Z",
            "display_name": "OpenAI",        // 从 free_provider_registry 注入(兼容旧 Dashboard)
            "category": "international",
            "free_quota": "$5 credits",
            "default_models": ["gpt-4o"],
            "default_base_url": "https://api.openai.com/v1",
            "is_in_cooldown": false,
            "consecutive_failures": 0
          }
        ],
        "total": 5,
        "healthy_count": 3,
        "checked_at": "2026-08-01T12:00:00Z",
        "summary": { ... }  // 兼容旧 Dashboard 统计字段
      }
    }

    status 判定:
    - HTTP 200 → ok(从响应 data 数组长度取 model_count)
    - HTTP 401/403 → invalid_key(key 无效或过期)
    - 超时/连接失败/其他 HTTP 错误 → unreachable
    - api_key 为空 → not_configured

    并发用 asyncio.gather + asyncio.timeout(5s),总耗时 < 10s。
    复用 settings.get_provider_config(code) 获取配置 + llm_gateway.get_http_client() 复用连接池。
    """
    # 解析 LLM_PROVIDERS JSON 获取所有 provider 名称(枚举),
    # 再用 settings.get_provider_config(code) 获取强类型配置(H3 复用要求)
    try:
        providers_json = json.loads(settings.llm_providers) if settings.llm_providers else {}
    except (json.JSONDecodeError, TypeError):
        providers_json = {}
    if not isinstance(providers_json, dict):
        providers_json = {}

    # 收集待检查 provider + 未配置 provider(not_configured 状态)
    to_check: list[tuple[str, str, str]] = []
    not_configured_results: list[dict[str, Any]] = []
    for name in providers_json:
        if not isinstance(providers_json.get(name), dict):
            continue
        # H3:复用 settings.get_provider_config(code) 获取强类型配置
        cfg = settings.get_provider_config(name)
        api_key = (cfg.api_key or "").strip()
        api_base = (cfg.api_base or "").strip() if cfg.api_base else ""
        if not api_key:
            # api_key 为空 → not_configured(H3 新增状态)
            not_configured_results.append({
                "provider": name,
                "status": "not_configured",
                "latency_ms": 0,
                "model_count": 0,
                "error": "api_key not configured",
            })
            continue
        if not api_base:
            # api_key 已配置但 api_base 为空 → not_configured(无法预检)
            not_configured_results.append({
                "provider": name,
                "status": "not_configured",
                "latency_ms": 0,
                "model_count": 0,
                "error": "api_base not configured, cannot pre-check",
            })
            continue
        to_check.append((name, api_key, api_base))

    # H3:复用 llm_gateway.get_http_client() 全局共享 httpx client(连接池复用)
    from ..core.llm_gateway import get_http_client
    client = get_http_client()

    # 并发预检所有已配置 provider(asyncio.gather,单 provider asyncio.timeout 5s)
    tasks = [_check_single_provider(name, api_key, api_base, client) for name, api_key, api_base in to_check]
    checked_results = await asyncio.gather(*tasks, return_exceptions=False)

    # 合并结果
    results = checked_results + not_configured_results
    checked_at = datetime.now(UTC).isoformat()

    # 汇总统计
    ok_count = sum(1 for r in results if r["status"] == "ok")
    invalid_count = sum(1 for r in results if r["status"] == "invalid_key")
    unreachable_count = sum(1 for r in results if r["status"] == "unreachable")
    not_configured_count = sum(1 for r in results if r["status"] == "not_configured")

    # 补注入 free_provider_registry 展示字段(兼容旧 Dashboard 消费)。
    # 旧 Dashboard 需 display_name/category/free_quota/default_models/default_base_url 等字段渲染,
    # 不补回会导致前端网关 Dashboard 渲染 undefined。
    try:
        from ..services.free_provider_registry import free_provider_registry as _registry
    except ImportError:
        _registry = None  # type: ignore[assignment]
    for r in results:
        provider_code = str(r.get("provider") or "")
        info = _registry.get_by_code(provider_code) if _registry else None
        r["display_name"] = info.display_name if info else provider_code
        r["category"] = info.category.value if info else ""
        r["free_quota"] = info.free_quota if info else ""
        r["default_models"] = list(info.default_models) if info else []
        r["default_base_url"] = info.default_base_url if info else ""
        r["is_in_cooldown"] = False  # 新 schema 未实现 cooldown,默认 False
        r["consecutive_failures"] = 0  # 新 schema 未实现,默认 0
        # 补 last_check 字段(兼容旧 Dashboard,checked_at 是新字段)
        if "last_check" not in r:
            r["last_check"] = checked_at

    return _wrap_ok({
        "providers": results,
        # H3(Phase B)新字段:total / healthy_count / checked_at
        "total": len(results),
        "healthy_count": ok_count,
        "checked_at": checked_at,
        # 兼容旧 Dashboard 统计字段(summary 子对象)
        "summary": {
            "total": len(results),
            "ok": ok_count,
            "invalid_key": invalid_count,
            "unreachable": unreachable_count,
            "not_configured": not_configured_count,
            "configured": ok_count + invalid_count,  # 已配置 api_key 的(ok + invalid_key)
            "local": 0,  # 新 schema 无 local 概念
        },
    })


async def _check_single_provider(
    provider_name: str, api_key: str, api_base: str, client: httpx.AsyncClient
) -> dict[str, Any]:
    """对单个 provider 发 GET {api_base}/models 主动预检 key 有效性。

    H3(Phase B):复用全局共享 httpx client(连接池复用)+ asyncio.timeout(5s) 单 provider 超时。

    Args:
        provider_name: provider 唯一标识(如 "openai" / "anthropic")。
        api_key: API 凭证。
        api_base: API endpoint URL(已去尾部 /)。
        client: 全局共享 httpx.AsyncClient(由 llm_gateway.get_http_client() 提供)。

    Returns:
        {provider, status, latency_ms, model_count, error, last_check} 健康状态条目。
    """
    url = f"{api_base}/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    start = asyncio.get_running_loop().time()
    try:
        # H3:单个 provider 5s 超时(asyncio.timeout,Python 3.11+)
        async with asyncio.timeout(5.0):
            resp = await client.get(url, headers=headers)
        latency_ms = int((asyncio.get_running_loop().time() - start) * 1000)
        now_iso = datetime.now(UTC).isoformat()
        if resp.status_code == 200:
            # 从响应提取 model_count(OpenAI 兼容格式:{"data": [...]})
            model_count = 0
            try:
                body = resp.json()
                if isinstance(body, dict):
                    data = body.get("data")
                    if isinstance(data, list):
                        model_count = len(data)
                    elif isinstance(body.get("models"), list):
                        model_count = len(body["models"])
            except (json.JSONDecodeError, ValueError):
                pass
            return {
                "provider": provider_name,
                "status": "ok",
                "latency_ms": latency_ms,
                "model_count": model_count,
                "error": None,
                "last_check": now_iso,
            }
        if resp.status_code in (401, 403):
            return {
                "provider": provider_name,
                "status": "invalid_key",
                "latency_ms": latency_ms,
                "model_count": 0,
                "error": f"HTTP {resp.status_code}",
                "last_check": now_iso,
            }
        # 其他 HTTP 错误(429/5xx 等)视为不可达
        return {
            "provider": provider_name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "model_count": 0,
            "error": f"HTTP {resp.status_code}",
            "last_check": now_iso,
        }
    except TimeoutError:
        # asyncio.timeout 超时(Python 3.11+ TimeoutError)
        latency_ms = int((asyncio.get_running_loop().time() - start) * 1000)
        return {
            "provider": provider_name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "model_count": 0,
            "error": "timeout (5s)",
            "last_check": datetime.now(UTC).isoformat(),
        }
    except (httpx.ConnectError, httpx.HTTPError) as e:
        latency_ms = int((asyncio.get_running_loop().time() - start) * 1000)
        return {
            "provider": provider_name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "model_count": 0,
            "error": f"{type(e).__name__}: {str(e)[:100]}",
            "last_check": datetime.now(UTC).isoformat(),
        }
    except Exception as e:
        latency_ms = int((asyncio.get_running_loop().time() - start) * 1000)
        return {
            "provider": provider_name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "model_count": 0,
            "error": f"{type(e).__name__}: {str(e)[:100]}",
            "last_check": datetime.now(UTC).isoformat(),
        }


@router.get("/llm/combos", response_model=None)
async def list_combos() -> dict[str, Any]:
    """列出所有 combo 链配置。

    返回结构:
    {
      "combos": [
        {"name": "maximize-free", "strategy": "priority", "chain": [...], "judge": null, "description": "..."}
      ]
    }
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError as e:
        logger.error("ComboRouter 加载失败: %s", e)
        return _wrap_ok({"combos": []})

    combos_data: list[dict[str, Any]] = []
    for c in combo_router.list_combos():
        combos_data.append({
            "name": c.name,
            "strategy": c.strategy.value,
            "chain": list(c.chain),
            "judge": c.judge,
            "description": c.description,
        })
    return _wrap_ok({"combos": combos_data})


class ComboConfigRequest(BaseModel):
    """Combo 链配置请求(创建/更新)。"""

    name: str = Field(..., description="链名(如 'maximize-free')")
    strategy: str = Field("priority", description="路由策略: priority/cheapest/fusion")
    chain: list[str] = Field(..., description="provider/model 列表")
    judge: str | None = Field(None, description="fusion 策略下的 judge model")
    description: str = Field("", description="人类可读描述")


@router.post("/llm/combos", response_model=None)
async def create_or_update_combo(req: ComboConfigRequest) -> dict[str, Any] | JSONResponse:
    """创建/更新 combo 链配置(管理端)。

    请求体:
    {"name": "maximize-quality", "strategy": "priority", "chain": ["claude-opus-4", "gpt-5"], "description": "..."}

    响应:
    {"ok": true, "combo": {...}}
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError as e:
        logger.error("ComboRouter 加载失败: %s", e)
        return _error_json("ComboRouter unavailable", 503)

    if not req.chain:
        return _error_json("chain must not be empty", 400)

    config: dict[str, Any] = {
        "strategy": req.strategy,
        "chain": req.chain,
        "description": req.description,
    }
    if req.judge:
        config["judge"] = req.judge

    combo_router.configure_combo(req.name, config)
    combo = combo_router.get_combo(req.name)
    if combo is None:
        return _error_json("configure_combo failed silently", 500)
    return _wrap_ok({
        "ok": True,
        "combo": {
            "name": combo.name,
            "strategy": combo.strategy.value,
            "chain": list(combo.chain),
            "judge": combo.judge,
            "description": combo.description,
        },
    })


@router.delete("/llm/combos/{name}", response_model=None)
async def delete_combo(name: str) -> dict[str, Any] | JSONResponse:
    """删除 combo 链配置。

    响应:
    {"ok": true, "name": "maximize-free"}
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError as e:
        logger.error("ComboRouter 加载失败: %s", e)
        return _error_json("ComboRouter unavailable", 503)

    if name not in combo_router._combos:
        return _error_json(f"combo '{name}' not found", 404)
    del combo_router._combos[name]
    return _wrap_ok({"ok": True, "name": name})


# =============================================================================
# Token 压缩演示端点(P3-1,token_compaction.py 集成配套)
# 提供 POST /llm/compaction/demo 供前端 Dashboard 手动触发压缩并查看效果,
# 与 llm_gateway._apply_token_compaction 内部自动压缩使用同一个 token_compactor 单例。
# =============================================================================


class CompactionDemoRequest(BaseModel):
    """Token 压缩演示请求体。"""

    messages: list[dict[str, Any]] = Field(
        ..., description="OpenAI 格式消息列表([{role, content, ...}])"
    )
    strategy: str = Field(
        "rtk_caveman",
        description="压缩策略:rtk / caveman / rtk_caveman(默认 rtk_caveman)",
    )
    keep_recent: int = Field(
        6,
        ge=0,
        le=100,
        description="Caveman 策略保留最近 N 条不压缩(0-100,默认 6)",
    )


# 策略字符串 → CompactionStrategy 枚举映射(无效值返回 400)
_STRATEGY_MAP: dict[str, str] = {
    "rtk": "rtk",
    "caveman": "caveman",
    "rtk_caveman": "rtk_caveman",
}


@router.post("/llm/compaction/demo", response_model=None)
async def compaction_demo(
    req: CompactionDemoRequest,
    request: Request,
) -> dict[str, Any] | JSONResponse:
    """Token 压缩演示端点(供前端 Dashboard 手动触发并查看压缩效果)。

    请求体:
    ```json
    {
      "messages": [{"role": "user", "content": "..."}],
      "strategy": "rtk_caveman",
      "keep_recent": 6
    }
    ```

    响应:
    ```json
    {
      "original_tokens": 1234,
      "compressed_tokens": 123,
      "compression_ratio": 0.9,
      "strategy": "rtk_caveman",
      "rtk_map_size": 5,
      "compressed_messages": [{"role": "user", "content": "..."}],
      "decompressed_messages": [{"role": "user", "content": "..."}]
    }
    ```

    错误:
    - 400: messages 为空 / strategy 无效
    - 500: 内部异常

    注:跳过 ResponseSanitizer 中间件 — 响应仅含 token 计数和压缩后消息,
    无敏感数据;字段名 original_tokens / compressed_tokens 含 "token" 子串,
    否则会被脱敏为 "***"(SAFE_KEYS 白名单只覆盖 prompt_tokens / completion_tokens / total_tokens)。
    """
    # 跳过响应脱敏(本端点响应无敏感字段,token 计数需保留为 int 供前端展示)
    request.state.skip_response_sanitization = True

    # 空消息检查
    if not req.messages:
        return _error_json("messages must not be empty", 400)

    # 策略校验:字符串 → CompactionStrategy 枚举
    strategy_str = req.strategy.lower().strip()
    if strategy_str not in _STRATEGY_MAP:
        return _error_json(
            f"invalid strategy '{req.strategy}', must be one of: rtk / caveman / rtk_caveman",
            400,
        )

    try:
        from ..services.token_compaction import (
            CompactionStrategy,
            TokenCompactor,
            token_compactor,
        )
    except ImportError as e:
        logger.error("token_compaction 模块加载失败: %s", e)
        return _error_json(f"token_compaction module unavailable: {e}", 500)

    # 策略字符串 → 枚举值(已在 _STRATEGY_MAP 校验过,直接对应)
    strategy_enum = CompactionStrategy(strategy_str)

    try:
        result = token_compactor.compact_messages(
            req.messages, strategy=strategy_enum, keep_recent=req.keep_recent
        )
        # 解压:还原 RTK 占位符($N → 原文),Caveman 不可逆
        decompressed = TokenCompactor.decompress(result)
        return _wrap_ok({
            "original_tokens": result.original_tokens,
            "compressed_tokens": result.compressed_tokens,
            "compression_ratio": result.compression_ratio,
            "strategy": strategy_str,
            "rtk_map_size": len(result.rtk_map),
            "compressed_messages": result.compressed_messages,
            "decompressed_messages": decompressed,
        })
    except Exception as e:
        logger.exception("compaction_demo 内部异常: %s", e)
        return _error_json(f"compaction failed: {type(e).__name__}: {e}", 500)


# =============================================================================
# D158 UI 半张(2026-09-28):前缀放行规则的管理出口(列表 + 撤销)
# =============================================================================
# 前端 ApprovedRulesPanel(apps/web)经 @ihui/api-client 的 listApprovalGrants /
# revokeApprovalGrant 调用本端点,管理审批第四档「批准并生成放行规则」落库的前缀规则。
# 鉴权复用本文件既有模式:JWT 中间件已把令牌主体注入 request.state.user_id
# (与 _resolve_owner_uuid / _ensure_restricted_model_access 同一来源),
# 缺失即 401;不接受请求体/Query 自报身份。

# 本出口只管前缀规则(exec_prefix);其余 kind(exec_once / mcp_tool)不经这里删。
#: 本出口代管的放行规则 kind(D158 前缀 + D159 网络目标)。**撤销与列表共用这一张表**,
#: 所以"面板能看见某条规则却撤不掉它"这种半接线在结构上不可能出现(两把白名单必漂移)。
_APPROVAL_GRANT_MANAGED_KINDS = ("exec_prefix", "network")


def _readable_exec_prefix(cache_key: str) -> str:
    """把 normalize_exec_key 的 \\x1f 连接键还原成可读形态(``git\\x1fpush`` → ``git push``)。"""
    return cache_key.replace("\x1f", " ").strip()


def _readable_grant_prefix(kind: str, bare_key: str) -> str:
    """把某一条放行规则的**裸键**还原成给人看的形态(两种 kind 各用自己的可读映射)。

    - ``exec_prefix``:\\x1f 连接 → 空格(``git push``);
    - ``network``:走 ``network_approval.display_from_cache_key`` 那一份(票面口径
      "弹窗上把键原样显示成 host:port,不显示哈希")。
    未知 kind 原样返回 —— 面板宁可看见一串怪键,也不该看见空白。
    """
    if kind == "network":
        try:
            from ..services.network_approval import display_from_cache_key

            return display_from_cache_key(bare_key)
        except Exception as exc:  # noqa: BLE001 - 显示层故障不回退成空白行
            logger.warning("D159 网络目标可读名计算失败: %s", exc)
            return bare_key
    return _readable_exec_prefix(bare_key)


@router.get("/llm/approval-grants", response_model=None)
async def list_approval_grants(request: Request) -> dict[str, Any]:
    """D158/D159:列出放行规则(前缀规则 + 网络目标规则,**同一个出口、同一张面板**)。

    未过期判定复用 approval_persistence.list_keys 的权威集(单一实现,不复制第二份
    过期过滤逻辑);created_at / expires_at 明细是 list_keys 没有的投影,走
    approval_persistence.list_grant_rows(2026-10-03 从本文件收编进持久层 —— 裸 SQL
    留在非 sqlite3 文件里会被 schema_check 的驱动判据当成 Postgres 表报数据孤岛;
    SQL 只住持久层才是"单一 DB 路径"的完整含义)。

    D159 把网络目标并进**这两条既有路由**而不是新开一套:票面第 3 条不可漂"与 D158
    已有的 exec_prefix 规则共面板共 API,不得新建第二套规则存储或第二个面板组件"。
    """
    if not getattr(request.state, "user_id", None):
        raise HTTPException(status_code=401, detail="Not authenticated")
    _kinds = list(_APPROVAL_GRANT_MANAGED_KINDS)
    try:
        from app.services import approval_persistence as _ap

        unexpired: set[str] = set()
        for _kind in _kinds:
            unexpired.update(_ap.list_keys(_kind))
        uid = _resolve_owner_uuid(request)  # D158 owner-binding:只看自己主体的规则
        rows = _ap.list_grant_rows(_kinds)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 - 持久层异常不炸路由,显式失败标记回给面板
        logger.warning("D158 approval-grants 列表查询失败: %s", e)
        return {"ok": False, "error": "query failed", "grants": []}
    by_key: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = str(row["cache_key"])
        if key not in unexpired:
            # 已过期/未登记:以 list_keys 权威集为准(过期行留给 purge 清理)
            continue
        if not _ap.key_is_owned_by(key, uid):
            # D158 owner-binding:别人主体的规则与存量无主体行一律不可见
            # (cacheKey 回显保留完整绑定键,撤销用它精确回传并再过归属闸)
            continue
        _kind = str(row["kind"])
        _bare = _ap.split_scoped_key(key)[1]
        grant = by_key.setdefault(
            key,
            {
                "cacheKey": key,
                "prefix": _readable_grant_prefix(_kind, _bare),
                "tokenCount": len([t for t in _bare.split("\x1f") if t]),
                "kind": _kind,
                "scopes": [],
                "createdAt": None,
                "expiresAt": None,
            },
        )
        if row["scope"] not in grant["scopes"]:
            grant["scopes"].append(str(row["scope"]))
        created = row["created_at"]
        expires = row["expires_at"]
        if created and (grant["createdAt"] is None or str(created) < str(grant["createdAt"])):
            grant["createdAt"] = created
        # 同键多行取最晚过期(展示最长有效期;NULL = 永不过期,保持 NULL)
        if expires and (grant["expiresAt"] is None or str(expires) > str(grant["expiresAt"])):
            grant["expiresAt"] = expires
    grants = sorted(by_key.values(), key=lambda g: str(g["createdAt"] or ""), reverse=True)
    return {"ok": True, "grants": grants}


@router.delete("/llm/approval-grants", response_model=None)
async def revoke_approval_grant(request: Request) -> dict[str, Any] | JSONResponse:
    """D158:按 cache_key + kind 精确撤销一条放行规则(面板单条撤销按钮)。

    撤销复用 approval_persistence.revoke(单一实现,按 cache_key+kind 复合键删);
    kind 白名单只放行本出口覆盖的 exec_prefix(宁窄不误)。"没这条"与"删了"都回
    ok(幂等),不给存在性探针 —— 面板撤销后自行刷新列表即可看到结果。
    """
    if not getattr(request.state, "user_id", None):
        raise HTTPException(status_code=401, detail="Not authenticated")
    cache_key = str(request.query_params.get("cache_key") or "")
    kind = str(request.query_params.get("kind") or "exec_prefix")
    if not cache_key:
        return JSONResponse(status_code=422, content={"ok": False, "error": "cache_key required"})
    if kind not in _APPROVAL_GRANT_MANAGED_KINDS:
        return JSONResponse(status_code=422, content={"ok": False, "error": "kind not allowed"})
    try:
        from app.services import approval_persistence as _ap

        if not _ap.key_is_owned_by(cache_key, _resolve_owner_uuid(request)):
            # D158 owner-binding:非本人主体的键(含存量无主体行)一律不删,
            # 回 ok 与"没这条"同形(面板语义本就无存在性探针)—— B 拿 A 的键
            # 撤销 ⇒ A 的规则原样存活,B 也探测不出它存在。
            return {"ok": True}
        _ap.revoke(cache_key, kind)
        # D159:撤销**必须回读确认库里真没了**,不能只看"DELETE 调用没抛"。
        # 这条不是装饰:面板的撤销按钮按 ok 就把行从界面上摘掉,而 revoke 的
        # SQL 若因为键形不同(比如主体段拼错)没命中,ok:True 就是假的成功 ——
        # 用户以为撤掉了,规则还在跑(票第 2 条不可漂"撤销要断言库/内存里真没了")。
        if _ap.check(cache_key, kind) is not None:
            logger.warning("D159 撤销后规则仍可命中(kind=%s),判为失败", kind)
            return {"ok": False, "error": "revoke not confirmed"}
    except Exception as e:  # noqa: BLE001
        logger.warning("D158 放行规则撤销失败(kind=%s): %s", kind, e)
        return {"ok": False, "error": "revoke failed"}
    logger.info("D158 放行规则已撤销(kind=%s, key=%s)", kind, cache_key[:64])
    return {"ok": True}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
