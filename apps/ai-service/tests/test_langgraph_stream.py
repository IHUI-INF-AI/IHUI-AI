"""LangGraph 流式 SSE 事件单元测试。

覆盖维度:
- 模块常量与可用性(_LANGGRAPH_AVAILABLE / Command 软依赖)
- SSEEvent dataclass(字段 / to_dict camelCase / 默认 timestamp)
- _make_event(合法/非法 type / node_id 默认)
- _safe_value(JSON 可序列化返回原值 / 不可序列化 str 兜底 / 循环引用)
- _normalize_stream_modes(None/空/合法/非法)
- _extract_node_name(空/普通/命名空间)
- _map_langgraph_event(10 类事件映射 / 大小写 / None)
- _dispatch_stream_chunk(5 种 stream_mode 分发 + 边界)
- _is_interrupted / _build_interrupt_event(中断检测与构造)
- stream_agent_execution(session/done/error/interrupt/cancel/exception/config 合并)
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import langgraph_stream
from app.services.langgraph_stream import (
    DEFAULT_STREAM_MODES,
    SSE_EVENT_TYPES,
    SSEEvent,
    VALID_STREAM_MODES,
    _build_interrupt_event,
    _dispatch_stream_chunk,
    _extract_node_name,
    _is_interrupted,
    _make_event,
    _map_langgraph_event,
    _normalize_stream_modes,
    _safe_value,
    stream_agent_execution,
)


# ---------------------------------------------------------------------------
# 辅助:mock graph / snapshot / task / interrupt / message chunk
# ---------------------------------------------------------------------------


class _FakeAstream:
    """模拟 graph.astream:返回预设 chunks 的 async iterator。"""

    def __init__(self, chunks: list[Any]):
        self._chunks = chunks

    def __call__(self, *args: Any, **kwargs: Any):
        return self._iter()

    async def _iter(self):
        for chunk in self._chunks:
            yield chunk


class _RaisingAstream:
    """模拟 graph.astream:迭代时抛出指定异常。"""

    def __init__(self, exc: BaseException):
        self._exc = exc

    def __call__(self, *args: Any, **kwargs: Any):
        return self._iter()

    async def _iter(self):  # noqa: BUG - yield 使其成为 async generator
        raise self._exc
        yield  # pragma: no cover


def _make_graph(
    chunks: list[Any] | None = None,
    snapshot: Any = None,
    raises: BaseException | None = None,
) -> MagicMock:
    """构造 mock graph。astream 返回 chunks 或抛异常,aget_state 返回 snapshot。"""
    graph = MagicMock()
    if raises is not None:
        graph.astream = _RaisingAstream(raises)
    else:
        graph.astream = _FakeAstream(chunks or [])
    graph.aget_state = AsyncMock(return_value=snapshot)
    return graph


def _make_snapshot(
    tasks: list[Any] | None = None,
    next_nodes: tuple[Any, ...] | None = None,
) -> MagicMock:
    """构造 mock StateSnapshot。"""
    snap = MagicMock()
    snap.tasks = tasks or []
    snap.next = next_nodes or ()
    return snap


def _make_task(
    task_id: str = "task-1",
    name: str = "node-1",
    interrupts: list[Any] | None = None,
) -> MagicMock:
    """构造 mock task。"""
    task = MagicMock()
    task.id = task_id
    task.name = name
    task.interrupts = interrupts if interrupts is not None else []
    return task


def _make_interrupt(
    interrupt_id: str = "intr-1",
    value: Any = "need input",
    resumable: bool = True,
) -> MagicMock:
    """构造 mock interrupt。"""
    intr = MagicMock()
    intr.interrupt_id = interrupt_id
    intr.value = value
    intr.resumable = resumable
    return intr


class _MockMessageChunk:
    """模拟 LangChain message chunk(避免 MagicMock 自动属性陷阱)。"""

    def __init__(
        self,
        content: Any = None,
        tool_call_chunks: Any = None,
        tool_calls: Any = None,
    ):
        self.content = content
        self.tool_call_chunks = tool_call_chunks
        self.tool_calls = tool_calls


async def _collect(gen):
    """收集 async generator 的所有事件为 list。"""
    return [evt async for evt in gen]


# ---------------------------------------------------------------------------
# 模块常量与可用性
# ---------------------------------------------------------------------------


class TestModuleConstants:
    """模块级常量与 langgraph 软依赖。"""

    def test_valid_stream_modes_contains_5_modes(self):
        assert VALID_STREAM_MODES == {"updates", "messages", "events", "values", "debug"}

    def test_default_stream_modes_is_updates_messages_events(self):
        assert DEFAULT_STREAM_MODES == ["updates", "messages", "events"]

    def test_sse_event_types_contains_12_types(self):
        assert len(SSE_EVENT_TYPES) == 12
        for t in (
            "session", "token", "node_start", "node_end", "tool_call",
            "tool_result", "state_update", "plan", "interrupt", "done",
            "error", "custom",
        ):
            assert t in SSE_EVENT_TYPES

    def test_langgraph_available_is_bool(self):
        assert isinstance(langgraph_stream._LANGGRAPH_AVAILABLE, bool)

    def test_all_export_contains_public_api(self):
        for name in ("SSEEvent", "SSE_EVENT_TYPES", "VALID_STREAM_MODES",
                     "DEFAULT_STREAM_MODES", "stream_agent_execution"):
            assert name in langgraph_stream.__all__


# ---------------------------------------------------------------------------
# SSEEvent dataclass
# ---------------------------------------------------------------------------


class TestSSEEvent:
    """SSEEvent dataclass 字段与 to_dict。"""

    def test_construction_with_all_fields(self):
        evt = SSEEvent(type="token", thread_id="t1", node_id="n1", data={"k": "v"})
        assert evt.type == "token"
        assert evt.thread_id == "t1"
        assert evt.node_id == "n1"
        assert evt.data == {"k": "v"}
        assert evt.timestamp  # 非空

    def test_node_id_accepts_none(self):
        evt = SSEEvent(type="session", thread_id="t1", node_id=None, data={})
        assert evt.node_id is None

    def test_default_timestamp_is_iso_string(self):
        evt = SSEEvent(type="session", thread_id="t1", node_id=None, data={})
        assert isinstance(evt.timestamp, str)
        assert "T" in evt.timestamp  # ISO8601 特征

    def test_to_dict_returns_camelcase_keys(self):
        evt = SSEEvent(type="session", thread_id="t1", node_id="n1", data={"k": "v"})
        d = evt.to_dict()
        assert d["type"] == "session"
        assert d["threadId"] == "t1"
        assert d["nodeId"] == "n1"
        assert d["data"] == {"k": "v"}
        assert d["timestamp"] == evt.timestamp


# ---------------------------------------------------------------------------
# _make_event
# ---------------------------------------------------------------------------


class TestMakeEvent:
    """_make_event 事件构造与 type 校验。"""

    def test_valid_type_creates_event(self):
        evt = _make_event("session", "t1", {"k": "v"})
        assert evt.type == "session"
        assert evt.thread_id == "t1"
        assert evt.node_id is None
        assert evt.data == {"k": "v"}

    def test_valid_type_with_node_id(self):
        evt = _make_event("token", "t1", {"content": "hi"}, node_id="n1")
        assert evt.node_id == "n1"

    def test_invalid_type_raises_value_error(self):
        with pytest.raises(ValueError, match="非法 SSE 事件类型"):
            _make_event("invalid_type", "t1", {})

    def test_all_12_event_types_accepted(self):
        for t in SSE_EVENT_TYPES:
            evt = _make_event(t, "t1", {})
            assert evt.type == t


# ---------------------------------------------------------------------------
# _safe_value
# ---------------------------------------------------------------------------


class TestSafeValue:
    """_safe_value JSON 安全化处理。"""

    def test_serializable_dict_returns_as_is(self):
        d = {"a": 1, "b": [1, 2, {"c": "x"}]}
        assert _safe_value(d) is d

    def test_none_returns_none(self):
        assert _safe_value(None) is None

    def test_str_returns_str(self):
        assert _safe_value("hello") == "hello"

    def test_int_returns_int(self):
        assert _safe_value(42) == 42

    def test_object_with_default_str_returns_as_is(self):
        """default=str 时 json.dumps 成功,_safe_value 返回原对象(非 str)。"""
        class Foo:
            pass
        obj = Foo()
        result = _safe_value(obj)
        assert result is obj  # 返回原对象

    def test_circular_reference_returns_str(self):
        """循环引用 json.dumps 失败,降级为 str()。"""
        a: list[Any] = []
        a.append(a)
        result = _safe_value(a)
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# _normalize_stream_modes
# ---------------------------------------------------------------------------


class TestNormalizeStreamModes:
    """_normalize_stream_modes 校验与默认值。"""

    def test_none_returns_default_copy(self):
        result = _normalize_stream_modes(None)
        assert result == DEFAULT_STREAM_MODES
        assert result is not DEFAULT_STREAM_MODES  # 返回副本

    def test_empty_list_returns_default_copy(self):
        result = _normalize_stream_modes([])
        assert result == DEFAULT_STREAM_MODES

    def test_valid_list_returns_copy(self):
        modes = ["updates", "values"]
        result = _normalize_stream_modes(modes)
        assert result == ["updates", "values"]
        assert result is not modes  # 返回副本

    def test_invalid_mode_raises_value_error(self):
        with pytest.raises(ValueError, match="非法 stream_mode"):
            _normalize_stream_modes(["updates", "invalid"])

    def test_all_5_valid_modes_accepted(self):
        result = _normalize_stream_modes(["updates", "messages", "events", "values", "debug"])
        assert result == ["updates", "messages", "events", "values", "debug"]


# ---------------------------------------------------------------------------
# _extract_node_name
# ---------------------------------------------------------------------------


class TestExtractNodeName:
    """_extract_node_name 从 chunk key 提取节点名。"""

    def test_empty_string_returns_none(self):
        assert _extract_node_name("") is None

    def test_none_returns_none(self):
        assert _extract_node_name(None) is None

    def test_plain_string_returns_as_is(self):
        assert _extract_node_name("node1") == "node1"

    def test_single_namespace_returns_last_segment(self):
        assert _extract_node_name("ns:node1") == "node1"

    def test_multi_namespace_returns_last_segment(self):
        assert _extract_node_name("ns:sub:deep:node1") == "node1"


# ---------------------------------------------------------------------------
# _map_langgraph_event
# ---------------------------------------------------------------------------


class TestMapLanggraphEvent:
    """_map_langgraph_event LangGraph 事件名 → SSE 事件映射。"""

    def test_on_chain_start_maps_to_node_start(self):
        evt = _map_langgraph_event("on_chain_start", {"x": 1}, "t1", "n1")
        assert evt is not None
        assert evt.type == "node_start"
        assert evt.node_id == "n1"
        assert evt.data["event"] == "on_chain_start"

    def test_on_chat_model_start_maps_to_node_start(self):
        evt = _map_langgraph_event("on_chat_model_start", {}, "t1", None)
        assert evt.type == "node_start"

    def test_on_chain_end_maps_to_node_end(self):
        evt = _map_langgraph_event("on_chain_end", {}, "t1", None)
        assert evt.type == "node_end"

    def test_on_chat_model_end_maps_to_node_end(self):
        evt = _map_langgraph_event("on_chat_model_end", {}, "t1", None)
        assert evt.type == "node_end"

    def test_on_tool_start_maps_to_tool_call(self):
        evt = _map_langgraph_event("on_tool_start", {}, "t1", None)
        assert evt.type == "tool_call"

    def test_on_tool_call_maps_to_tool_call(self):
        evt = _map_langgraph_event("on_tool_call", {}, "t1", None)
        assert evt.type == "tool_call"

    def test_on_tool_end_maps_to_tool_result(self):
        evt = _map_langgraph_event("on_tool_end", {}, "t1", None)
        assert evt.type == "tool_result"

    def test_on_tool_result_maps_to_tool_result(self):
        evt = _map_langgraph_event("on_tool_result", {}, "t1", None)
        assert evt.type == "tool_result"

    def test_on_chat_model_stream_with_content_object(self):
        chunk = _MockMessageChunk(content="hello")
        evt = _map_langgraph_event("on_chat_model_stream", chunk, "t1", "n1")
        assert evt.type == "token"
        assert evt.data["content"] == "hello"
        assert evt.data["event"] == "on_chat_model_stream"

    def test_on_llm_new_token_with_dict_event_data(self):
        """event_data 无 content 属性时,降级为 _safe_value(event_data)。"""
        evt = _map_langgraph_event("on_llm_new_token", {"k": "v"}, "t1", None)
        assert evt.type == "token"
        assert evt.data["content"] == {"k": "v"}

    def test_on_chat_model_stream_with_none_event_data(self):
        evt = _map_langgraph_event("on_chat_model_stream", None, "t1", None)
        assert evt.type == "token"
        assert evt.data["content"] is None

    def test_unknown_event_returns_none(self):
        assert _map_langgraph_event("unknown_event", {}, "t1", None) is None

    def test_empty_event_name_returns_none(self):
        assert _map_langgraph_event("", {}, "t1", None) is None

    def test_none_event_name_returns_none(self):
        assert _map_langgraph_event(None, {}, "t1", None) is None

    def test_case_insensitive_mapping(self):
        evt = _map_langgraph_event("ON_CHAIN_START", {}, "t1", None)
        assert evt.type == "node_start"


# ---------------------------------------------------------------------------
# _dispatch_stream_chunk - updates 模式
# ---------------------------------------------------------------------------


class TestDispatchUpdates:
    """updates 模式:{node_name: update_dict} → state_update 事件。"""

    @pytest.mark.asyncio
    async def test_dict_payload_yields_state_update(self):
        payload = {"node1": {"output": "done"}}
        events = await _collect(_dispatch_stream_chunk("updates", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "state_update"
        assert events[0].node_id == "node1"
        assert events[0].data["node"] == "node1"
        assert events[0].data["update"] == {"output": "done"}

    @pytest.mark.asyncio
    async def test_dict_with_plan_yields_state_update_and_plan(self):
        payload = {"planner": {"plan": ["step1", "step2"], "other": "x"}}
        events = await _collect(_dispatch_stream_chunk("updates", payload, "t1", {}, MagicMock()))
        types = [e.type for e in events]
        assert types == ["state_update", "plan"]
        plan_evt = events[1]
        assert plan_evt.data["plan"] == ["step1", "step2"]
        assert plan_evt.node_id == "planner"

    @pytest.mark.asyncio
    async def test_multiple_nodes_yield_multiple_events(self):
        payload = {"node1": {"a": 1}, "node2": {"b": 2}}
        events = await _collect(_dispatch_stream_chunk("updates", payload, "t1", {}, MagicMock()))
        assert len(events) == 2
        assert events[0].node_id == "node1"
        assert events[1].node_id == "node2"

    @pytest.mark.asyncio
    async def test_non_dict_payload_no_events(self):
        events = await _collect(_dispatch_stream_chunk("updates", "not a dict", "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_non_dict_update_value_skipped(self):
        """update 值非 dict 时跳过(continue)。"""
        payload = {"node1": "not a dict", "node2": {"ok": True}}
        events = await _collect(_dispatch_stream_chunk("updates", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].node_id == "node2"

    @pytest.mark.asyncio
    async def test_namespace_node_name_extracted(self):
        payload = {"ns:sub:nodeX": {"out": 1}}
        events = await _collect(_dispatch_stream_chunk("updates", payload, "t1", {}, MagicMock()))
        assert events[0].node_id == "nodeX"
        assert events[0].data["node"] == "nodeX"


# ---------------------------------------------------------------------------
# _dispatch_stream_chunk - values 模式
# ---------------------------------------------------------------------------


class TestDispatchValues:
    """values 模式:完整 state 快照 → state_update 事件。"""

    @pytest.mark.asyncio
    async def test_dict_payload_yields_state_update(self):
        payload = {"messages": [], "count": 5}
        events = await _collect(_dispatch_stream_chunk("values", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "state_update"
        assert events[0].data["values"] == payload
        assert events[0].data["mode"] == "values"
        assert events[0].node_id is None

    @pytest.mark.asyncio
    async def test_non_dict_payload_no_events(self):
        events = await _collect(_dispatch_stream_chunk("values", [1, 2, 3], "t1", {}, MagicMock()))
        assert events == []


# ---------------------------------------------------------------------------
# _dispatch_stream_chunk - messages 模式
# ---------------------------------------------------------------------------


class TestDispatchMessages:
    """messages 模式:(message_chunk, metadata) → token / tool_call 事件。"""

    @pytest.mark.asyncio
    async def test_tuple_with_content_yields_token(self):
        chunk = _MockMessageChunk(content="hello")
        events = await _collect(_dispatch_stream_chunk(
            "messages", (chunk, {"langgraph_node": "n1"}), "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "token"
        assert events[0].data["content"] == "hello"
        assert events[0].node_id == "n1"

    @pytest.mark.asyncio
    async def test_tuple_with_tool_call_chunks_yields_tool_call(self):
        chunk = _MockMessageChunk(content=None, tool_call_chunks=[{"name": "tool1"}])
        events = await _collect(_dispatch_stream_chunk(
            "messages", (chunk, {}), "t1", {}, MagicMock()))
        # content is None → no token event; tool_call_chunks → tool_call event
        types = [e.type for e in events]
        assert types == ["tool_call"]
        assert events[0].data["tool_calls"] == [{"name": "tool1"}]

    @pytest.mark.asyncio
    async def test_tuple_with_tool_calls_fallback_yields_tool_call(self):
        """tool_call_chunks 为空时,回退到 tool_calls 属性。"""
        chunk = _MockMessageChunk(content=None, tool_call_chunks=[], tool_calls=[{"id": "tc1"}])
        events = await _collect(_dispatch_stream_chunk(
            "messages", (chunk, {}), "t1", {}, MagicMock()))
        types = [e.type for e in events]
        assert types == ["tool_call"]
        assert events[0].data["tool_calls"] == [{"id": "tc1"}]

    @pytest.mark.asyncio
    async def test_tuple_with_content_and_tool_calls_yields_both(self):
        chunk = _MockMessageChunk(content="hi", tool_call_chunks=[{"name": "t"}])
        events = await _collect(_dispatch_stream_chunk(
            "messages", (chunk, {}), "t1", {}, MagicMock()))
        types = [e.type for e in events]
        assert types == ["token", "tool_call"]

    @pytest.mark.asyncio
    async def test_non_tuple_payload_no_events(self):
        events = await _collect(_dispatch_stream_chunk(
            "messages", "not a tuple", "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_tuple_wrong_length_no_events(self):
        chunk = _MockMessageChunk(content="hi")
        events = await _collect(_dispatch_stream_chunk(
            "messages", (chunk,), "t1", {}, MagicMock()))  # len=1
        assert events == []

    @pytest.mark.asyncio
    async def test_non_dict_metadata_node_id_none(self):
        chunk = _MockMessageChunk(content="hi")
        events = await _collect(_dispatch_stream_chunk(
            "messages", (chunk, "not a dict"), "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].node_id is None

    @pytest.mark.asyncio
    async def test_content_none_no_token_event(self):
        chunk = _MockMessageChunk(content=None)
        events = await _collect(_dispatch_stream_chunk(
            "messages", (chunk, {}), "t1", {}, MagicMock()))
        assert events == []


# ---------------------------------------------------------------------------
# _dispatch_stream_chunk - events 模式
# ---------------------------------------------------------------------------


class TestDispatchEvents:
    """events 模式:LangGraph 内部事件 → 映射或降级 custom。"""

    @pytest.mark.asyncio
    async def test_mapped_event_yields_mapped(self):
        payload = {"name": "on_chain_start", "data": {"x": 1}, "metadata": {"langgraph_node": "n1"}}
        events = await _collect(_dispatch_stream_chunk("events", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "node_start"
        assert events[0].node_id == "n1"
        assert events[0].data["data"] == {"x": 1}

    @pytest.mark.asyncio
    async def test_unmapped_event_yields_custom(self):
        payload = {"name": "unknown_event", "data": {"y": 2}}
        events = await _collect(_dispatch_stream_chunk("events", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "custom"
        assert events[0].data["event"] == "unknown_event"
        assert events[0].data["data"] == {"y": 2}

    @pytest.mark.asyncio
    async def test_empty_payload_uses_defaults(self):
        """空 dict:event_name=custom,event_data=整个 payload。"""
        payload: dict[str, Any] = {}
        events = await _collect(_dispatch_stream_chunk("events", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "custom"
        assert events[0].data["event"] == "custom"
        # event_data 默认为整个 payload
        assert events[0].data["data"] == {}

    @pytest.mark.asyncio
    async def test_event_key_fallback_when_name_empty(self):
        """name 为空时回退到 event key。"""
        payload = {"name": "", "event": "on_tool_end"}
        events = await _collect(_dispatch_stream_chunk("events", payload, "t1", {}, MagicMock()))
        assert events[0].type == "tool_result"

    @pytest.mark.asyncio
    async def test_non_dict_metadata_treated_as_empty(self):
        payload = {"name": "on_chain_start", "data": {}, "metadata": "not a dict"}
        events = await _collect(_dispatch_stream_chunk("events", payload, "t1", {}, MagicMock()))
        assert events[0].node_id is None

    @pytest.mark.asyncio
    async def test_non_dict_payload_no_events(self):
        events = await _collect(_dispatch_stream_chunk("events", "not a dict", "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_event_data_defaults_to_whole_payload(self):
        """无 data key 时,event_data 为整个 payload。"""
        payload = {"name": "on_chain_end", "extra": "info"}
        events = await _collect(_dispatch_stream_chunk("events", payload, "t1", {}, MagicMock()))
        assert events[0].type == "node_end"
        assert events[0].data["data"] == {"name": "on_chain_end", "extra": "info"}


# ---------------------------------------------------------------------------
# _dispatch_stream_chunk - debug 模式
# ---------------------------------------------------------------------------


class TestDispatchDebug:
    """debug 模式:task_starts/task_ends/其他。"""

    @pytest.mark.asyncio
    async def test_task_starts_yields_node_start_events(self):
        payload = {
            "type": "task_starts",
            "payload": {"tasks": [{"name": "node1"}, {"name": "node2"}]},
        }
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert len(events) == 2
        assert all(e.type == "node_start" for e in events)
        assert events[0].node_id == "node1"
        assert events[1].node_id == "node2"

    @pytest.mark.asyncio
    async def test_task_ends_yields_node_end_events(self):
        payload = {
            "type": "task_ends",
            "payload": {"tasks": [{"name": "node1"}]},
        }
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "node_end"
        assert events[0].node_id == "node1"

    @pytest.mark.asyncio
    async def test_other_type_yields_custom(self):
        payload = {"type": "custom_debug", "payload": {"info": "x"}}
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "custom"
        assert events[0].data["debug"] == "custom_debug"
        assert events[0].data["payload"] == {"info": "x"}

    @pytest.mark.asyncio
    async def test_non_dict_payload_no_events(self):
        events = await _collect(_dispatch_stream_chunk("debug", "string", "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_empty_tasks_no_events(self):
        payload = {"type": "task_starts", "payload": {"tasks": []}}
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_no_payload_key_defaults_to_empty(self):
        """无 payload key 时,payload.get('payload', {}) 返回 {},无 tasks。"""
        payload = {"type": "task_starts"}
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_tasks_none_yields_no_events(self):
        """tasks 为 None 时,None or [] = []。"""
        payload = {"type": "task_starts", "payload": {"tasks": None}}
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_event_key_fallback_for_type(self):
        """无 type key 时,回退到 event key,再回退到 'debug'。"""
        payload = {"event": "task_starts", "payload": {"tasks": [{"name": "n1"}]}}
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "node_start"

    @pytest.mark.asyncio
    async def test_no_type_no_event_defaults_to_debug_custom(self):
        payload = {"payload": {"info": "x"}}
        events = await _collect(_dispatch_stream_chunk("debug", payload, "t1", {}, MagicMock()))
        assert len(events) == 1
        assert events[0].type == "custom"
        assert events[0].data["debug"] == "debug"


# ---------------------------------------------------------------------------
# _dispatch_stream_chunk - 未知 mode
# ---------------------------------------------------------------------------


class TestDispatchUnknownMode:
    """未知 stream_mode 不产出任何事件。"""

    @pytest.mark.asyncio
    async def test_unknown_mode_no_events(self):
        events = await _collect(_dispatch_stream_chunk("unknown", {"x": 1}, "t1", {}, MagicMock()))
        assert events == []

    @pytest.mark.asyncio
    async def test_dispatch_returns_async_iterator(self):
        gen = _dispatch_stream_chunk("updates", {}, "t1", {}, MagicMock())
        assert hasattr(gen, "__aiter__")


# ---------------------------------------------------------------------------
# _is_interrupted
# ---------------------------------------------------------------------------


class TestIsInterrupted:
    """_is_interrupted 中断态检测。"""

    @pytest.mark.asyncio
    async def test_snapshot_none_returns_false(self):
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=None)
        assert await _is_interrupted(graph, {}) is False

    @pytest.mark.asyncio
    async def test_no_tasks_returns_false(self):
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=_make_snapshot(tasks=[]))
        assert await _is_interrupted(graph, {}) is False

    @pytest.mark.asyncio
    async def test_task_with_interrupts_returns_true(self):
        task = _make_task(interrupts=[_make_interrupt()])
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=_make_snapshot(tasks=[task]))
        assert await _is_interrupted(graph, {}) is True

    @pytest.mark.asyncio
    async def test_task_without_interrupts_returns_false(self):
        task = _make_task(interrupts=[])
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=_make_snapshot(tasks=[task]))
        assert await _is_interrupted(graph, {}) is False

    @pytest.mark.asyncio
    async def test_task_interrupts_none_returns_false(self):
        task = _make_task()
        task.interrupts = None
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=_make_snapshot(tasks=[task]))
        assert await _is_interrupted(graph, {}) is False

    @pytest.mark.asyncio
    async def test_exception_returns_false(self):
        graph = MagicMock()
        graph.aget_state = AsyncMock(side_effect=RuntimeError("fail"))
        assert await _is_interrupted(graph, {}) is False


# ---------------------------------------------------------------------------
# _build_interrupt_event
# ---------------------------------------------------------------------------


class TestBuildInterruptEvent:
    """_build_interrupt_event 中断事件构造。"""

    @pytest.mark.asyncio
    async def test_snapshot_none_returns_none(self):
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=None)
        assert await _build_interrupt_event(graph, "t1", {}) is None

    @pytest.mark.asyncio
    async def test_no_tasks_returns_none(self):
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=_make_snapshot(tasks=[]))
        assert await _build_interrupt_event(graph, "t1", {}) is None

    @pytest.mark.asyncio
    async def test_tasks_without_interrupts_returns_none(self):
        task = _make_task(interrupts=[])
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=_make_snapshot(tasks=[task]))
        assert await _build_interrupt_event(graph, "t1", {}) is None

    @pytest.mark.asyncio
    async def test_tasks_with_interrupts_returns_event(self):
        intr = _make_interrupt(interrupt_id="i1", value="need input", resumable=True)
        task = _make_task(task_id="t1", name="human_node", interrupts=[intr])
        snap = _make_snapshot(tasks=[task], next_nodes=("next_node",))
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=snap)

        evt = await _build_interrupt_event(graph, "thread1", {})
        assert evt is not None
        assert evt.type == "interrupt"
        assert evt.thread_id == "thread1"
        assert evt.node_id == "human_node"  # 取自第一个 interrupt 的 node
        assert evt.data["next"] == ["next_node"]
        assert len(evt.data["interrupts"]) == 1
        intr_data = evt.data["interrupts"][0]
        assert intr_data["interrupt_id"] == "i1"
        assert intr_data["value"] == "need input"
        assert intr_data["resumable"] is True
        assert intr_data["task_id"] == "t1"
        assert intr_data["node"] == "human_node"

    @pytest.mark.asyncio
    async def test_multiple_interrupts_collected(self):
        intr1 = _make_interrupt(interrupt_id="i1", value="v1")
        intr2 = _make_interrupt(interrupt_id="i2", value="v2", resumable=False)
        task = _make_task(name="node1", interrupts=[intr1, intr2])
        snap = _make_snapshot(tasks=[task], next_nodes=())
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=snap)

        evt = await _build_interrupt_event(graph, "t1", {})
        assert evt is not None
        assert len(evt.data["interrupts"]) == 2
        assert evt.data["interrupts"][1]["resumable"] is False
        assert evt.data["next"] == []  # 空 next

    @pytest.mark.asyncio
    async def test_exception_returns_none(self):
        graph = MagicMock()
        graph.aget_state = AsyncMock(side_effect=RuntimeError("fail"))
        assert await _build_interrupt_event(graph, "t1", {}) is None


# ---------------------------------------------------------------------------
# stream_agent_execution
# ---------------------------------------------------------------------------


class TestStreamAgentExecution:
    """stream_agent_execution 主入口。"""

    @pytest.mark.asyncio
    async def test_langgraph_unavailable_yields_error_only(self, monkeypatch):
        monkeypatch.setattr(langgraph_stream, "_LANGGRAPH_AVAILABLE", False)
        graph = _make_graph([])
        events = await _collect(stream_agent_execution(graph, "t1", None))
        assert len(events) == 1
        assert events[0].type == "error"
        assert "langgraph" in events[0].data["message"]

    @pytest.mark.asyncio
    async def test_empty_stream_yields_session_and_done(self):
        graph = _make_graph([], snapshot=None)
        events = await _collect(stream_agent_execution(graph, "t1", None))
        types = [e.type for e in events]
        assert types == ["session", "done"]

    @pytest.mark.asyncio
    async def test_session_event_data(self):
        graph = _make_graph([], snapshot=None)
        events = await _collect(stream_agent_execution(
            graph, "t1", {"query": "hello"}, ["updates"]))
        session = events[0]
        assert session.type == "session"
        assert session.data["threadId"] == "t1"
        assert session.data["streamModes"] == ["updates"]
        assert session.data["input"] == {"query": "hello"}

    @pytest.mark.asyncio
    async def test_session_event_input_none(self):
        graph = _make_graph([], snapshot=None)
        events = await _collect(stream_agent_execution(graph, "t1", None))
        assert events[0].data["input"] is None

    @pytest.mark.asyncio
    async def test_done_event_data(self):
        graph = _make_graph([], snapshot=None)
        events = await _collect(stream_agent_execution(graph, "t1", None))
        done = events[-1]
        assert done.type == "done"
        assert done.data["threadId"] == "t1"
        assert done.data["status"] == "completed"

    @pytest.mark.asyncio
    async def test_default_stream_modes_used(self):
        """stream_modes=None 时使用 DEFAULT_STREAM_MODES。"""
        graph = _make_graph([], snapshot=None)
        events = await _collect(stream_agent_execution(graph, "t1", None))
        assert events[0].data["streamModes"] == DEFAULT_STREAM_MODES

    @pytest.mark.asyncio
    async def test_multimode_tuple_chunks(self):
        """多 stream_mode 时,chunk 是 (mode, payload) 元组。"""
        graph = _make_graph(
            chunks=[
                ("updates", {"node1": {"out": 1}}),
                ("values", {"full": "state"}),
            ],
            snapshot=None,
        )
        events = await _collect(stream_agent_execution(
            graph, "t1", None, ["updates", "values"]))
        types = [e.type for e in events]
        assert types == ["session", "state_update", "state_update", "done"]
        assert events[1].data["node"] == "node1"
        assert events[1].data["update"] == {"out": 1}
        assert events[2].data["mode"] == "values"
        assert events[2].data["values"] == {"full": "state"}

    @pytest.mark.asyncio
    async def test_single_mode_non_tuple_chunk(self):
        """单 stream_mode 时,chunk 非 tuple,mode = modes[0]。"""
        graph = _make_graph(
            chunks=[{"node1": {"out": 1}}],
            snapshot=None,
        )
        events = await _collect(stream_agent_execution(
            graph, "t1", None, ["updates"]))
        types = [e.type for e in events]
        assert types == ["session", "state_update", "done"]

    @pytest.mark.asyncio
    async def test_multimode_non_tuple_chunk_defaults_to_updates(self):
        """多 stream_mode 但 chunk 非 tuple 时,mode 默认 'updates'。"""
        graph = _make_graph(
            chunks=[{"node1": {"out": 1}}],
            snapshot=None,
        )
        events = await _collect(stream_agent_execution(
            graph, "t1", None, ["updates", "messages"]))
        types = [e.type for e in events]
        assert types == ["session", "state_update", "done"]

    @pytest.mark.asyncio
    async def test_interrupt_yields_interrupt_and_stops(self):
        """interrupt 检测命中后 yield interrupt 事件并 return(无 done)。"""
        intr = _make_interrupt(interrupt_id="i1", value="need input")
        task = _make_task(name="human_node", interrupts=[intr])
        snap = _make_snapshot(tasks=[task], next_nodes=("next_node",))
        graph = _make_graph(
            chunks=[("updates", {"node1": {"out": 1}})],
            snapshot=snap,
        )
        events = await _collect(stream_agent_execution(graph, "t1", None))
        types = [e.type for e in events]
        assert "session" in types
        assert "state_update" in types
        assert "interrupt" in types
        assert "done" not in types
        # 验证 interrupt 事件内容
        interrupt_evt = next(e for e in events if e.type == "interrupt")
        assert interrupt_evt.node_id == "human_node"
        assert interrupt_evt.data["next"] == ["next_node"]

    @pytest.mark.asyncio
    async def test_interrupt_none_when_no_interrupts_continues_to_done(self):
        """_is_interrupted 返回 False 时,streaming 继续,最终 yield done。"""
        snap = _make_snapshot(tasks=[])
        graph = _make_graph(
            chunks=[("updates", {"node1": {"out": 1}})],
            snapshot=snap,
        )
        events = await _collect(stream_agent_execution(graph, "t1", None))
        types = [e.type for e in events]
        assert types == ["session", "state_update", "done"]

    @pytest.mark.asyncio
    async def test_interrupt_true_but_build_none_stops_without_done(self):
        """_is_interrupted=True 但 _build_interrupt_event=None 时,仍 return(无 done)。

        场景:task.interrupts 为 truthy 但非可迭代(如 True),_build 捕获异常返回 None。
        """
        task = _make_task()
        task.interrupts = True  # truthy 但不可迭代 → _build 抛异常返回 None
        snap = _make_snapshot(tasks=[task])
        graph = _make_graph(
            chunks=[("updates", {"node1": {"out": 1}})],
            snapshot=snap,
        )
        events = await _collect(stream_agent_execution(graph, "t1", None))
        types = [e.type for e in events]
        assert types == ["session", "state_update"]
        assert "interrupt" not in types
        assert "done" not in types

    @pytest.mark.asyncio
    async def test_cancelled_error_yields_custom_and_reraises(self):
        """asyncio.CancelledError → yield custom 事件并重新抛出。"""
        graph = _make_graph(raises=asyncio.CancelledError())
        events: list[SSEEvent] = []
        with pytest.raises(asyncio.CancelledError):
            async for evt in stream_agent_execution(graph, "t1", None):
                events.append(evt)
        assert len(events) == 2
        assert events[0].type == "session"
        assert events[1].type == "custom"
        assert events[1].data["message"] == "streaming cancelled by client"

    @pytest.mark.asyncio
    async def test_exception_yields_error_and_returns(self):
        """普通异常 → yield error 事件并 return(无 done)。"""
        graph = _make_graph(raises=RuntimeError("graph exploded"))
        events = await _collect(stream_agent_execution(graph, "t1", None))
        types = [e.type for e in events]
        assert types == ["session", "error"]
        assert events[1].data["message"] == "graph exploded"
        assert events[1].data["type"] == "RuntimeError"

    @pytest.mark.asyncio
    async def test_invalid_stream_modes_raises_value_error(self):
        """非法 stream_mode 在迭代时抛 ValueError(在 session 事件之前)。"""
        graph = _make_graph([], snapshot=None)
        gen = stream_agent_execution(graph, "t1", None, ["invalid_mode"])
        with pytest.raises(ValueError, match="非法 stream_mode"):
            await gen.__anext__()

    @pytest.mark.asyncio
    async def test_config_merging_without_configurable(self):
        """config 不含 configurable key 时,thread_id 保留 + top-level keys 合并。"""
        captured: list[dict[str, Any]] = []

        async def fake_astream(input_, config, stream_mode):
            captured.append(config)
            return
            yield  # pragma: no cover

        graph = MagicMock()
        graph.astream = fake_astream
        graph.aget_state = AsyncMock(return_value=None)

        config = {"recursion_limit": 10}
        await _collect(stream_agent_execution(graph, "t1", None, ["updates"], config=config))
        assert captured[0]["configurable"]["thread_id"] == "t1"
        assert captured[0]["recursion_limit"] == 10

    @pytest.mark.asyncio
    async def test_config_merging_with_configurable_overwrites_thread_id(self):
        """config 含 configurable key 时,base_config.update 覆盖 configurable dict,
        thread_id 被替换(源码实际行为)。"""
        captured: list[dict[str, Any]] = []

        async def fake_astream(input_, config, stream_mode):
            captured.append(config)
            return
            yield  # pragma: no cover

        graph = MagicMock()
        graph.astream = fake_astream
        graph.aget_state = AsyncMock(return_value=None)

        config = {"configurable": {"user_id": "u1"}}
        await _collect(stream_agent_execution(graph, "t1", None, ["updates"], config=config))
        # 源码行为:base_config.update(config) 覆盖了 configurable dict
        assert captured[0]["configurable"] == {"user_id": "u1"}

    @pytest.mark.asyncio
    async def test_returns_async_generator(self):
        gen = stream_agent_execution(MagicMock(), "t1", None)
        assert hasattr(gen, "__aiter__")
        # 提前关闭避免 never-started 警告
        await gen.aclose()

    @pytest.mark.asyncio
    async def test_all_chunks_processed_when_no_interrupt(self):
        """无 interrupt 时所有 chunk 都被处理。"""
        graph = _make_graph(
            chunks=[
                ("updates", {"n1": {"a": 1}}),
                ("updates", {"n2": {"b": 2}}),
                ("updates", {"n3": {"c": 3}}),
            ],
            snapshot=None,
        )
        events = await _collect(stream_agent_execution(graph, "t1", None))
        types = [e.type for e in events]
        assert types == ["session", "state_update", "state_update", "state_update", "done"]

    @pytest.mark.asyncio
    async def test_messages_mode_token_events_in_full_flow(self):
        """完整流程:messages 模式 token 事件。"""
        chunk = _MockMessageChunk(content="hello")
        graph = _make_graph(
            chunks=[("messages", (chunk, {"langgraph_node": "n1"}))],
            snapshot=None,
        )
        events = await _collect(stream_agent_execution(graph, "t1", None, ["messages"]))
        types = [e.type for e in events]
        assert types == ["session", "token", "done"]
        assert events[1].data["content"] == "hello"
        assert events[1].node_id == "n1"

    @pytest.mark.asyncio
    async def test_events_mode_mapped_event_in_full_flow(self):
        """完整流程:events 模式映射事件。"""
        graph = _make_graph(
            chunks=[("events", {"name": "on_tool_end", "data": {"result": 42}})],
            snapshot=None,
        )
        events = await _collect(stream_agent_execution(graph, "t1", None, ["events"]))
        types = [e.type for e in events]
        assert types == ["session", "tool_result", "done"]

    @pytest.mark.asyncio
    async def test_debug_mode_task_starts_in_full_flow(self):
        """完整流程:debug 模式 task_starts。"""
        graph = _make_graph(
            chunks=[("debug", {
                "type": "task_starts",
                "payload": {"tasks": [{"name": "n1"}]},
            })],
            snapshot=None,
        )
        events = await _collect(stream_agent_execution(graph, "t1", None, ["debug"]))
        types = [e.type for e in events]
        assert types == ["session", "node_start", "done"]
