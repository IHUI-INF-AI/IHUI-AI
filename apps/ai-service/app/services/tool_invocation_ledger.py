# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""B04(2026-10-27 立)工具调用事实 → 证据级明细账的内部摄入派发腿。

载体同 D154 `mcp_status.py`(有界、失败不拖主循环的 fire-and-forget 腿):
agent 循环每次工具执行收尾,把「谁(user_id)在哪次会话、哪个工具、权限怎么走、
结果如何」POST 给 apps/api 的 `/api/internal/tool-ledger/invocation`,
由那里经 strict schema 与 `recordToolInvocationLedger` 唯一出口落 `tool_invocation_ledger`。

三条不可漂的写法:
 ① **主体纪律(86H/ticket_subject_of 同型)**:`user_id` 不是 UUID ⇒ 视同拿不到主体,
    跳过并计数(`skipped_no_principal`),绝不编造、绝不降级成"发给服务端再猜"。
    明细账的 principal 是归属型身份,账上写错人比缺一条账更糟。
 ② **权限词汇零新造**:`TOOL_APPROVAL_ROUTES` / `TOOL_APPROVAL_DENY_CAUSES` /
    `LEDGER_STATES` 是 apps/api `tool-approval-audit.ts` 与 ledger schema 的封闭集镜像
    (TS 侧 zod enum 是权威;此处多一档或少一档都会表现为"服务端 400 整批丢")。
    越界值一律拒派并计数(`rejected_vocab`),不折叠成邻近档。
 ③ **失败必须响但不许穿透**(§5e + D154③):派发异常/非 2xx 只 warn + 计数;
    证据腿丢了的表现是"账上少一行",绝不能变成"对话挂了"。

input/output 用循环里既有的**摘要素材**(`_summarize_step` 产物,截断自由文本),
原文不出 ai-service 进程;`includeRaw` 缺省不下发 ⇒ 服务端默认 false,只存摘要。
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 与 apps/api tool-approval-audit.ts 的封闭集逐项对应(TS zod enum 为权威;镜像测试逐值钉)。
TOOL_APPROVAL_ROUTES: tuple[str, ...] = ("flag", "approved", "denied")
TOOL_APPROVAL_DENY_CAUSES: tuple[str, ...] = (
    "no-prompt",
    "prompt-declined",
    "prompt-empty",
    "prompt-error",
)
LEDGER_STATES: tuple[str, ...] = ("registered", "started", "settled", "lost")

INGEST_PATH = "/api/internal/tool-ledger/invocation"
_REQUEST_TIMEOUT_SECONDS = 5.0

# 与 ledger strict schema 的字段上限一致(超限截断而非拒派:证据宁缺角不丢整行,
# 但截断必须出声 —— 见 _clip)。
_MAX_INVOCATION_ID = 160
_MAX_SESSION_ID = 128
_MAX_TOOL_NAME = 80
_MAX_SUMMARY = 800

# D172 同款:W3C trace id 只接受 32 位小写 hex,脏值不带(服务端 schema 会整行 400)。
_TRACE_ID_RE = re.compile(r"^[0-9a-f]{32}$")

# 强引用集合:asyncio 只弱引用 task,不托住就可能落账前被 GC 掉(静默丢帧常见成因)。
_pending_tasks: set[asyncio.Task[None]] = set()

_dispatch_stats: dict[str, int] = {
    "sent": 0,
    "skipped_no_principal": 0,
    "skipped_no_loop": 0,
    "rejected_vocab": 0,
    "rejected_incomplete": 0,
    "failed": 0,
}


def dispatch_stats() -> dict[str, int]:
    """派读数(测试与观测面用);返回副本,外部改不动真表。"""
    return dict(_dispatch_stats)


def reset_dispatch_ledger() -> None:
    """清空计数(测试隔离用;生产代码不得调)。"""
    for key in _dispatch_stats:
        _dispatch_stats[key] = 0


def _is_uuid_principal(value: str | None) -> bool:
    if not value:
        return False
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def _clip(text: str | None, limit: int, field: str) -> str | None:
    if text is None:
        return None
    if len(text) <= limit:
        return text
    logger.warning("[b04] 账字段 %s 超上限 %d,截断落账(原文 %d 字符)", field, limit, len(text))
    return text[:limit]


def record_tool_invocation(
    *,
    user_id: str | None,
    session_id: str,
    invocation_id: str,
    tool_name: str,
    permission_decision: str,
    permission_cause: str | None = None,
    state: str = "settled",
    ok: bool | None = None,
    input_summary: str | None = None,
    output_summary: str | None = None,
    trace_id: str | None = None,
) -> bool:
    """派发一条工具调用事实到 apps/api 摄入入口。

    @returns True 表示"这一行已交给事件循环"(不等于已落账);
    False 表示按判据没派发(无 UUID 主体 / 词汇越界 / 无运行中的事件循环),
    原因一律出声并计入 `dispatch_stats()`,不得静默。
    """
    if not _is_uuid_principal(user_id):
        # 主体纪律见模块头①:非 UUID 属主一律视同拿不到主体。
        _dispatch_stats["skipped_no_principal"] += 1
        logger.warning(
            "[b04] 工具账派发被拒:主体不是 UUID(user_id=%r, tool=%s)",
            (user_id or "")[:40],
            tool_name,
        )
        return False

    if not (session_id or "").strip() or not (tool_name or "").strip():
        # sessionId/toolName 是 schema 的 min(1) 硬要求:必空则必 400 —— 与其发一帧
        # 注定失败的请求,不如就地拒派 + 计数(缺的是哪一格,日志里要说清)。
        _dispatch_stats["rejected_incomplete"] += 1
        logger.warning(
            "[b04] 工具账派发被拒:session/tool 为空(session=%r tool=%r)",
            session_id,
            tool_name,
        )
        return False

    if permission_decision not in TOOL_APPROVAL_ROUTES or state not in LEDGER_STATES:
        _dispatch_stats["rejected_vocab"] += 1
        logger.warning(
            "[b04] 工具账派发被拒:词汇越界 decision=%r state=%r(封闭集见 TOOL_APPROVAL_ROUTES/LEDGER_STATES)",
            permission_decision,
            state,
        )
        return False
    if permission_cause is not None and permission_cause not in TOOL_APPROVAL_DENY_CAUSES:
        # cause 是可选档:越界 cause 降级为"无 cause"而不是丢整行 —— denied 事实本身仍是证据。
        logger.warning("[b04] 工具账 cause 词汇越界(%r),按无成因落账", permission_cause)
        permission_cause = None

    payload: dict[str, Any] = {
        "invocationId": _clip(invocation_id, _MAX_INVOCATION_ID, "invocationId"),
        "sessionId": _clip(session_id, _MAX_SESSION_ID, "sessionId"),
        "toolName": _clip(tool_name, _MAX_TOOL_NAME, "toolName"),
        "permissionDecision": permission_decision,
        "state": state,
        # input 必给(哪怕 None = 无参调用):schema refine 的硬要求,缺键整行 400。
        "input": _clip(input_summary, _MAX_SUMMARY, "input"),
    }
    if permission_cause is not None:
        payload["permissionCause"] = permission_cause
    if ok is not None:
        payload["ok"] = ok
    if output_summary is not None:
        payload["output"] = _clip(output_summary, _MAX_SUMMARY, "output")
    if trace_id and _TRACE_ID_RE.match(trace_id):
        payload["traceId"] = trace_id

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        _dispatch_stats["skipped_no_loop"] += 1
        logger.debug("[b04] 无运行中的事件循环,工具账未派发: %s/%s", tool_name, invocation_id)
        return False

    task = loop.create_task(_dispatch(str(user_id), payload))
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)
    return True


async def _dispatch(principal: str, payload: dict[str, Any]) -> None:
    """把一行交给 apps/api;失败只 warn + 计数,绝不向上抛(证据腿不许拖主循环)。

    `api_tools_bridge` 在**函数内**导入(同 mcp_status.py:顶部 import 会牵出
    mcp_server↔agent 循环链;派发在事件循环里,两侧已加载完毕,延迟导入无代价)。
    """
    from .api_tools_bridge import api_base_url, internal_headers

    url = f"{api_base_url()}{INGEST_PATH}"
    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload, headers=internal_headers(principal))
        if resp.status_code >= 400:
            _dispatch_stats["failed"] += 1
            logger.warning(
                "[b04] 工具账摄入失败: %s → HTTP %s(invocation=%s)",
                payload.get("toolName"),
                resp.status_code,
                payload.get("invocationId"),
            )
            return
        _dispatch_stats["sent"] += 1
    except Exception as e:  # 网络/序列化任何异常都不能穿透到 agent 主循环
        _dispatch_stats["failed"] += 1
        logger.warning(
            "[b04] 工具账摄入异常: %s(%s);证据面缺一行,对话不受影响",
            payload.get("toolName"),
            e,
        )


__all__ = [
    "TOOL_APPROVAL_ROUTES",
    "TOOL_APPROVAL_DENY_CAUSES",
    "LEDGER_STATES",
    "INGEST_PATH",
    "record_tool_invocation",
    "dispatch_stats",
    "reset_dispatch_ledger",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
