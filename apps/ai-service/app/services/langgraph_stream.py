"""LangGraph 5 模式 streaming(P3 Q1.6)。

stream_mode 组合:updates + messages + events + values + debug
SSE 12 类事件:session / token / node_start / node_end / tool_call / tool_result /
              state_update / plan / interrupt / done / error / custom

设计:
- 入口 stream_agent_execution(graph, thread_id, graph_input, stream_modes) -> AsyncIterator[SSEEvent]
- 按 stream_mode 订阅 graph.astream(stream_mode=[...]) 输出,统一映射为 SSEEvent。
- 遇到 interrupt(graph StateSnapshot.tasks 中存在 interrupts)→ yield interrupt 事件并暂停。
- 兼容 langgraph 不可用:yield error 事件并结束。
- 不直接依赖 HTTP,产出 SSEEvent dataclass,由 router 层转 SSE 文本。
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

logger = logging.getLogger(__name__)

# 软依赖:langgraph 缺失时仍可导入本模块,stream_agent_execution 会 yield error
try:
    from langgraph.types import Command  # type: ignore[import-not-found]  # noqa: F401

    _LANGGRAPH_AVAILABLE = True
except ImportError:  # pragma: no cover
    Command = None  # type: ignore[assignment]
    _LANGGRAPH_AVAILABLE = False

# ----------------------------------------------------------------------
# 常量(对齐 packages/types/src/langgraph.ts)
# ----------------------------------------------------------------------

VALID_STREAM_MODES = {"updates", "messages", "events", "values", "debug"}
DEFAULT_STREAM_MODES = ["updates", "messages", "events"]

# 12 类 SSE 事件
SSE_EVENT_TYPES = {
    "session",
    "token",
    "node_start",
    "node_end",
    "tool_call",
    "tool_result",
    "state_update",
    "plan",
    "interrupt",
    "done",
    "error",
    "custom",
}


@dataclass
class SSEEvent:
    """LangGraph SSE 事件(对齐 packages/types/src/langgraph.ts SSEEvent)。

    Attributes:
        type: 12 类事件之一
        thread_id: 线程 id
        node_id: 节点 id(可空,如 session/done/error 全局事件)
        data: 事件负载(任意可 JSON 化对象)
        timestamp: ISO8601 时间戳
    """

    type: str
    thread_id: str
    node_id: Optional[str]
    data: Any
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        """转 dict(供 JSON 序列化)。"""
        return {
            "type": self.type,
            "threadId": self.thread_id,
            "nodeId": self.node_id,
            "data": self.data,
            "timestamp": self.timestamp,
        }


# ----------------------------------------------------------------------
# 辅助
# ----------------------------------------------------------------------


def _make_event(
    type_: str,
    thread_id: str,
    data: Any,
    node_id: Optional[str] = None,
) -> SSEEvent:
    """构造 SSEEvent(校验 type 合法性)。"""
    if type_ not in SSE_EVENT_TYPES:
        raise ValueError(f"非法 SSE 事件类型: {type_},允许 {sorted(SSE_EVENT_TYPES)}")
    return SSEEvent(type=type_, thread_id=thread_id, node_id=node_id, data=data)


def _safe_value(value: Any) -> Any:
    """把任意值转成 JSON 可序列化形式(失败则 str 兜底)。"""
    try:
        json.dumps(value, ensure_ascii=False, default=str)
        return value
    except (TypeError, ValueError):
        return str(value)


def _normalize_stream_modes(stream_modes: Optional[list[str]]) -> list[str]:
    """校验并规范化 stream_mode 列表。"""
    if not stream_modes:
        return list(DEFAULT_STREAM_MODES)
    invalid = [m for m in stream_modes if m not in VALID_STREAM_MODES]
    if invalid:
        raise ValueError(
            f"非法 stream_mode: {invalid},允许 {sorted(VALID_STREAM_MODES)}"
        )
    return list(stream_modes)


def _extract_node_name(chunk_key: str) -> Optional[str]:
    """从 graph.astream 的 chunk key 提取节点名。

    LangGraph updates 模式下,chunk 是 {node_name: update_dict} 形式,
    chunk_key 即 node_name;messages/events 模式 key 可能是元数据。
    """
    if not chunk_key:
        return None
    # 过滤 LangGraph 内部 key(如 ":" 命名空间前缀)
    return chunk_key.split(":")[-1] if ":" in chunk_key else chunk_key


# ----------------------------------------------------------------------
# 核心:stream_agent_execution
# ----------------------------------------------------------------------


async def stream_agent_execution(
    graph: Any,
    thread_id: str,
    graph_input: Optional[dict[str, Any]],
    stream_modes: Optional[list[str]] = None,
    *,
    config: Optional[dict[str, Any]] = None,
) -> AsyncIterator[SSEEvent]:
    """流式输出 agent 执行过程。

    Args:
        graph: 已编译的 LangGraph(compile(checkpointer=...) 返回值)
        thread_id: 线程 id(用于 thread_id 隔离 + interrupt 恢复)
        graph_input: 图输入(首次执行传完整 input;恢复时传 None 由调用方决定)
        stream_modes: stream_mode 列表,默认 ["updates", "messages", "events"]
        config: 额外 LangGraph config(可选,thread_id 自动注入 configurable)

    Yields:
        SSEEvent 序列,前端通过 SSE 消费。
        事件顺序示例:
          session → node_start → token* → tool_call → tool_result →
          node_end → state_update → ... → interrupt?(HITL)→ done | error
    """
    if not _LANGGRAPH_AVAILABLE:
        yield _make_event(
            "error",
            thread_id,
            {"message": "langgraph 未安装,无法执行 streaming"},
        )
        return

    modes = _normalize_stream_modes(stream_modes)
    # 构造 config,注入 thread_id
    base_config: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
    if config:
        base_config.update(config)
        base_config["configurable"].update(config.get("configurable", {}))

    # 1. session 事件
    yield _make_event(
        "session",
        thread_id,
        {"threadId": thread_id, "streamModes": modes, "input": _safe_value(graph_input)},
    )

    try:
        # 2. 执行 graph.astream(stream_mode=[...])
        # stream_mode 多模式时,每个 chunk 形如 (mode, payload)
        async for chunk in graph.astream(
            graph_input, config=base_config, stream_mode=modes
        ):
            # 多 stream_mode:chunk 是 (mode, data) 元组
            # 单 stream_mode:chunk 是 data
            if (
                isinstance(chunk, tuple)
                and len(chunk) == 2
                and chunk[0] in VALID_STREAM_MODES
            ):
                mode, payload = chunk
            else:
                mode = modes[0] if len(modes) == 1 else "updates"
                payload = chunk

            async for evt in _dispatch_stream_chunk(
                mode, payload, thread_id, base_config, graph
            ):
                yield evt

            # 每次 chunk 后检查是否处于 interrupt 暂停态
            if await _is_interrupted(graph, base_config):
                interrupt_evt = await _build_interrupt_event(graph, thread_id, base_config)
                if interrupt_evt is not None:
                    yield interrupt_evt
                # interrupt 后停止本轮 streaming(等待 resume)
                return

    except asyncio.CancelledError:
        yield _make_event(
            "custom",
            thread_id,
            {"message": "streaming cancelled by client"},
        )
        raise
    except Exception as e:
        logger.exception("stream_agent_execution 异常 thread=%s", thread_id)
        yield _make_event(
            "error",
            thread_id,
            {"message": str(e), "type": type(e).__name__},
        )
        return

    # 3. 完成
    yield _make_event(
        "done",
        thread_id,
        {"threadId": thread_id, "status": "completed"},
    )


# ----------------------------------------------------------------------
# chunk 分发:stream_mode -> SSEEvent
# ----------------------------------------------------------------------


async def _dispatch_stream_chunk(
    mode: str,
    payload: Any,
    thread_id: str,
    config: dict[str, Any],
    graph: Any,
) -> AsyncIterator[SSEEvent]:
    """按 stream_mode 把 chunk 映射为 SSEEvent。"""
    if mode == "updates":
        # updates: {node_name: {state_update_dict}}
        if isinstance(payload, dict):
            for node_name, update in payload.items():
                node_id = _extract_node_name(node_name)
                if not isinstance(update, dict):
                    continue
                yield _make_event(
                    "state_update",
                    thread_id,
                    {"node": node_id, "update": _safe_value(update)},
                    node_id=node_id,
                )
                # plan 检测:若 update 中含 "plan" 字段,额外发 plan 事件
                if "plan" in update:
                    yield _make_event(
                        "plan",
                        thread_id,
                        {"plan": _safe_value(update["plan"])},
                        node_id=node_id,
                    )

    elif mode == "values":
        # values: 完整 state 快照
        if isinstance(payload, dict):
            yield _make_event(
                "state_update",
                thread_id,
                {"values": _safe_value(payload), "mode": "values"},
            )

    elif mode == "messages":
        # messages: (message_chunk, metadata) 元组
        if isinstance(payload, tuple) and len(payload) == 2:
            message_chunk, metadata = payload
            node_id = (
                metadata.get("langgraph_node")
                if isinstance(metadata, dict)
                else None
            )
            # token 事件:LLM 流式输出
            content = getattr(message_chunk, "content", None)
            if content is not None:
                yield _make_event(
                    "token",
                    thread_id,
                    {"content": content, "chunk": _safe_value(message_chunk)},
                    node_id=node_id,
                )
            # tool_call 检测
            tool_calls = getattr(message_chunk, "tool_call_chunks", None) or getattr(
                message_chunk, "tool_calls", None
            )
            if tool_calls:
                yield _make_event(
                    "tool_call",
                    thread_id,
                    {"tool_calls": _safe_value(tool_calls)},
                    node_id=node_id,
                )

    elif mode == "events":
        # events: LangGraph 内部事件(name, data, metadata)
        if isinstance(payload, dict):
            event_name = payload.get("name") or payload.get("event") or "custom"
            event_data = payload.get("data", payload)
            raw_meta = payload.get("metadata", {})
            metadata = raw_meta if isinstance(raw_meta, dict) else {}
            node_id = metadata.get("langgraph_node")
            mapped = _map_langgraph_event(event_name, event_data, thread_id, node_id)
            if mapped is not None:
                yield mapped
            else:
                yield _make_event(
                    "custom",
                    thread_id,
                    {"event": event_name, "data": _safe_value(event_data)},
                    node_id=node_id,
                )

    elif mode == "debug":
        # debug: 调试事件(payload 结构不固定)
        if isinstance(payload, dict):
            event_type = payload.get("type") or payload.get("event") or "debug"
            if event_type == "task_starts":
                for task in payload.get("payload", {}).get("tasks", []) or []:
                    node_id = task.get("name") if isinstance(task, dict) else None
                    yield _make_event(
                        "node_start",
                        thread_id,
                        {"task": _safe_value(task)},
                        node_id=node_id,
                    )
            elif event_type == "task_ends":
                for task in payload.get("payload", {}).get("tasks", []) or []:
                    node_id = task.get("name") if isinstance(task, dict) else None
                    yield _make_event(
                        "node_end",
                        thread_id,
                        {"task": _safe_value(task)},
                        node_id=node_id,
                    )
            else:
                yield _make_event(
                    "custom",
                    thread_id,
                    {"debug": event_type, "payload": _safe_value(payload.get("payload"))},
                )


def _map_langgraph_event(
    event_name: str,
    event_data: Any,
    thread_id: str,
    node_id: Optional[str],
) -> Optional[SSEEvent]:
    """把 LangGraph events 模式的命名事件映射为 12 类 SSE 事件。

    无法映射的返回 None(由调用方降级为 custom 事件)。
    """
    name_lower = (event_name or "").lower()
    if name_lower in ("on_chain_start", "on_chat_model_start"):
        return _make_event(
            "node_start",
            thread_id,
            {"event": event_name, "data": _safe_value(event_data)},
            node_id=node_id,
        )
    if name_lower in ("on_chain_end", "on_chat_model_end"):
        return _make_event(
            "node_end",
            thread_id,
            {"event": event_name, "data": _safe_value(event_data)},
            node_id=node_id,
        )
    if name_lower in ("on_tool_start", "on_tool_call"):
        return _make_event(
            "tool_call",
            thread_id,
            {"event": event_name, "data": _safe_value(event_data)},
            node_id=node_id,
        )
    if name_lower in ("on_tool_end", "on_tool_result"):
        return _make_event(
            "tool_result",
            thread_id,
            {"event": event_name, "data": _safe_value(event_data)},
            node_id=node_id,
        )
    if name_lower in ("on_chat_model_stream", "on_llm_new_token"):
        content = (
            getattr(event_data, "content", None)
            if event_data is not None
            else None
        )
        return _make_event(
            "token",
            thread_id,
            {
                "event": event_name,
                "content": content if content is not None else _safe_value(event_data),
            },
            node_id=node_id,
        )
    return None


# ----------------------------------------------------------------------
# interrupt 检测
# ----------------------------------------------------------------------


async def _is_interrupted(graph: Any, config: dict[str, Any]) -> bool:
    """检查当前线程是否处于 interrupt 暂停态。"""
    try:
        snapshot = await graph.aget_state(config)
        if snapshot is None:
            return False
        tasks = getattr(snapshot, "tasks", ()) or ()
        for task in tasks:
            if getattr(task, "interrupts", None):
                return True
        return False
    except Exception as e:  # pragma: no cover
        logger.debug("_is_interrupted 检查异常: %s", e)
        return False


async def _build_interrupt_event(
    graph: Any,
    thread_id: str,
    config: dict[str, Any],
) -> Optional[SSEEvent]:
    """从当前 graph state 构造 interrupt SSE 事件。"""
    try:
        snapshot = await graph.aget_state(config)
        if snapshot is None:
            return None
        interrupts_list: list[dict[str, Any]] = []
        for task in getattr(snapshot, "tasks", ()) or ():
            for intr in getattr(task, "interrupts", ()) or ():
                interrupts_list.append(
                    {
                        "interrupt_id": getattr(intr, "interrupt_id", None),
                        "value": _safe_value(getattr(intr, "value", None)),
                        "resumable": getattr(intr, "resumable", True),
                        "task_id": getattr(task, "id", None),
                        "node": getattr(task, "name", None),
                    }
                )
        if not interrupts_list:
            return None
        node_id = interrupts_list[0].get("node")
        return _make_event(
            "interrupt",
            thread_id,
            {
                "interrupts": interrupts_list,
                "next": list(snapshot.next) if snapshot.next else [],
            },
            node_id=node_id,
        )
    except Exception as e:  # pragma: no cover
        logger.warning("_build_interrupt_event 构造异常: %s", e)
        return None


__all__ = [
    "SSEEvent",
    "SSE_EVENT_TYPES",
    "VALID_STREAM_MODES",
    "DEFAULT_STREAM_MODES",
    "stream_agent_execution",
]
