# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:工具调用追踪 — 对标 codex tools/call_trace.rs。

每个直连/code-mode 工具调用的 trace 里程碑事件:仅含标识符与工具名,
绝不含参数或输出(红线)。两里程碑:received / result_ready。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from app.middleware.trace_context import current_trace_id

logger = logging.getLogger(__name__)

EVENT_RECEIVED = "tool_call_received"
EVENT_RESULT_READY = "tool_result_ready"

SOURCE_DIRECT = "direct"
SOURCE_CODE_MODE = "code_mode"

# ── D147(2026-09-28):trace 属性必须带本轮 trace id,且**绝不含 prompt 原文与凭据 ──
# 票面硬要求:阳性对照喂一条含 `sk-` 与中文 prompt 的输入,导出里必须搜不到。
# 本文件此前只带标识符(thread_id / call_id / tool_name),没有第二道闸;而
# "标识符"与"内容"的区分靠调用方自觉 —— 调用点在 agent_loop_v2(本票禁改),
# 一旦有人把参数摘要或用户句子塞进 tool_name,凭据就随 trace 出网/落日志。
# 所以这里做**按形状的白名单**,不是按关键字的黑名单:关键字黑名单永远漏
# (新凭据前缀、Base64、中文句子都不在表上),而合法标识符的形状是封闭的。
_MAX_ATTR_LEN = 128
# 允许的标识符形状:十六进制段 / uuid / 点号-冒号-连字符-下划线的名字 / 方括号路径 / 数字。
_SAFE_IDENT_RE = re.compile(r"^[A-Za-z0-9_.:@/#\[\]\-]{1,%d}$" % _MAX_ATTR_LEN)
# 明确的凭据形态(命中即整值替换,不"打码中间"—— 半截凭据仍是凭据)。
_CREDENTIAL_RE = re.compile(
    r"(?i)(sk-|pk-|api[_-]?key|bearer|token=|secret|password|authorization|x-api-key)"
)
# CJK 码位(含日文假名/谚文):标识符字段里出现即说明那是句子不是名字。
_CJK_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]")

REDACTED = "[redacted]"


def scrub_trace_attr(value: Any) -> Any:
    """把一个即将进 trace 的值约束成"标识符或 [redacted]"。

    - str:非白名单形状 / 含凭据形态 / 含 CJK / 超长 ⇒ `REDACTED`(不保留任何片段)
    - None/bool/int:原样(它们是计数与开关,不含内容)
    - 其他类型:不猜,替换为 REDACTED 并记一条 debug(不得静默 str() 出去)
    """
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, str):
        if len(value) > _MAX_ATTR_LEN:
            return REDACTED
        if not _SAFE_IDENT_RE.match(value):
            return REDACTED
        if _CREDENTIAL_RE.search(value) or _CJK_RE.search(value):
            return REDACTED
        return value
    logger.debug("trace 属性类型不可判(%s),按 REDACTED 处理", type(value).__name__)
    return REDACTED


def _namespace(tool_name: str) -> str:
    # codex 语义:namespace 工具面(clock.sleep 等)取点号前缀,内置取 "default"
    if "." in tool_name:
        return tool_name.rsplit(".", 1)[0]
    return "default"


@dataclass(frozen=True)
class CallTraceEvent:
    name: str
    thread_id: str
    tool_name: str
    tool_namespace: str
    tool_source: str
    call_id: str
    turn_id: str | None = None
    cell_id: str | None = None
    runtime_tool_call_id: str | None = None
    # D147:本轮 trace id(32hex)。默认 None ⇒ 由 as_dict() 现取 contextvar,
    # 这样**调用点一行不用改**(它们在禁改的 agent_loop_v2 里)就能挂上链。
    trace_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        trace_id = self.trace_id or current_trace_id()
        d: dict[str, Any] = {
            "event": scrub_trace_attr(self.name),
            "conversation.id": scrub_trace_attr(self.thread_id),
            "call_id": scrub_trace_attr(self.call_id),
            "tool_name": scrub_trace_attr(self.tool_name),
            "tool_namespace": scrub_trace_attr(self.tool_namespace),
            "tool_source": scrub_trace_attr(self.tool_source),
        }
        # 只在真有值时写键:缺 trace.id 与 trace.id="" 是两件事(前者=没接上,
        # 后者=接上了但为空),不得用空串把"没接上"写成"接上了"。
        if trace_id:
            d["trace.id"] = scrub_trace_attr(trace_id)
        if self.turn_id is not None:
            d["turn_id"] = scrub_trace_attr(self.turn_id)
        if self.cell_id is not None:
            d["cell.id"] = scrub_trace_attr(self.cell_id)
        if self.runtime_tool_call_id is not None:
            d["runtime_tool_call_id"] = scrub_trace_attr(self.runtime_tool_call_id)
        return d


def received(
    thread_id: str,
    tool_name: str,
    call_id: str,
    *,
    turn_id: str | None = None,
    source: str = SOURCE_DIRECT,
    cell_id: str | None = None,
    runtime_tool_call_id: str | None = None,
    trace_id: str | None = None,
) -> CallTraceEvent:
    ev = CallTraceEvent(
        name=EVENT_RECEIVED,
        thread_id=thread_id,
        tool_name=tool_name,
        tool_namespace=_namespace(tool_name),
        tool_source=source,
        call_id=call_id,
        turn_id=turn_id if source == SOURCE_DIRECT else None,
        cell_id=cell_id,
        runtime_tool_call_id=runtime_tool_call_id,
        trace_id=trace_id,
    )
    logger.info("tool_call_received: %s", ev.as_dict())
    return ev


def result_ready(
    thread_id: str,
    turn_id: str | None,
    tool_name: str,
    call_id: str,
    *,
    source: str = SOURCE_DIRECT,
    trace_id: str | None = None,
) -> CallTraceEvent:
    ev = CallTraceEvent(
        name=EVENT_RESULT_READY,
        thread_id=thread_id,
        tool_name=tool_name,
        tool_namespace=_namespace(tool_name),
        tool_source=source,
        call_id=call_id,
        turn_id=turn_id,
        trace_id=trace_id,
    )
    logger.info("tool_result_ready: %s", ev.as_dict())
    return ev
