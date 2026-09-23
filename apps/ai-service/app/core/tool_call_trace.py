# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:工具调用追踪 — 对标 codex tools/call_trace.rs。

每个直连/code-mode 工具调用的 trace 里程碑事件:仅含标识符与工具名,
绝不含参数或输出(红线)。两里程碑:received / result_ready。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

EVENT_RECEIVED = "tool_call_received"
EVENT_RESULT_READY = "tool_result_ready"

SOURCE_DIRECT = "direct"
SOURCE_CODE_MODE = "code_mode"


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

    def as_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "event": self.name,
            "conversation.id": self.thread_id,
            "call_id": self.call_id,
            "tool_name": self.tool_name,
            "tool_namespace": self.tool_namespace,
            "tool_source": self.tool_source,
        }
        if self.turn_id is not None:
            d["turn_id"] = self.turn_id
        if self.cell_id is not None:
            d["cell.id"] = self.cell_id
        if self.runtime_tool_call_id is not None:
            d["runtime_tool_call_id"] = self.runtime_tool_call_id
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
) -> CallTraceEvent:
    ev = CallTraceEvent(
        name=EVENT_RESULT_READY,
        thread_id=thread_id,
        tool_name=tool_name,
        tool_namespace=_namespace(tool_name),
        tool_source=source,
        call_id=call_id,
        turn_id=turn_id,
    )
    logger.info("tool_result_ready: %s", ev.as_dict())
    return ev
