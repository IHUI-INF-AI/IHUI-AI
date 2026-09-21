# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""原生 function calling 的 tools 参数透传链路 e2e 测试(2026-08-31 立)。

背景:CLI(apps/cli runToolLoop)通过 api-client 的 extraBody 把 OpenAI 兼容
tools schema 下发到 /api/llm/complete/stream,期望:
- 请求侧:请求体的 tools/tool_choice 透传到上游 LLM provider(不被丢弃);
- 响应侧:上游返回的 tool_calls 转换为 SSE 'tool-call-start' 事件
  (ToolCallEvent 契约:type/toolCallId/toolName/args),由 onToolCall 回调接收。

此前缺口(本次修复):complete_stream 的 generic 路径(无 agent_tools 时)
未把 req.tools/req.tool_choice 传给 llm_gateway.astream,且 astream 产出的
"tool_calls" 事件被原样透传为 event: tool_calls(不符合前端契约)。

覆盖:
1. router→gateway 边界:mock llm_gateway.astream,断言 tools/tool_choice
   进入上游调用参数,且 SSE 下发 tool-call-start(字段/args 解析/多工具/非法
   arguments 兜底),原生 tool_calls 事件不再外漏。
2. gateway→litellm 全链路:fake litellm.acompletion 捕获 call_kwargs,断言
   tools/tool_choice 到达 litellm(最终上游),SSE 从分片累积的 tool_calls
   转换出 tool-call-start。
"""

from __future__ import annotations

import json
import sys
from types import ModuleType
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """解析 SSE 原始文本为事件列表。

    每个事件格式:event: <type>\ndata: <json>\n\n
    返回 [{"event": "chunk", "data": {...}}, ...]
    """
    events: list[dict[str, Any]] = []
    blocks = raw.split("\n\n")
    for block in blocks:
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


async def _stream_chat(client: AsyncClient, body: dict[str, Any]) -> str:
    """调用 /api/llm/complete/stream 并返回原始 SSE 文本。"""
    resp = await client.post("/api/llm/complete/stream", json=body)
    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.text[:500]}"
    return resp.text


_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "搜索网页",
            "parameters": {
                "type": "object",
                "properties": {"q": {"type": "string"}},
                "required": ["q"],
            },
        },
    }
]


def _force_stub_mode(monkeypatch, *, stub: bool) -> None:
    """显式钉住 _is_stub_mode,避免本机 .env 残留 key(如 CLOUDFLARE_API_TOKEN /
    OPENCODE_ZEN_KEY,conftest _VENDOR_ENV_KEYS 未覆盖)导致 stub 判定随环境翻转:
    - stub=True:mock astream 的测试跳过 pre-flight api_key 检查(否则 422);
    - stub=False:litellm 全链路测试走真实 _resolve(llm_providers JSON 供 key)。
    """
    from app.routers import llm as llm_router

    monkeypatch.setattr(llm_router.llm_gateway, "_is_stub_mode", lambda: stub)


# =============================================================================
# 1. router→gateway 边界:tools/tool_choice 透传 + tool-call-start SSE 转换
# =============================================================================

async def test_generic_path_passes_tools_and_emits_tool_call_start(client: AsyncClient, monkeypatch):
    """generic 路径(无 agent_tools):tools/tool_choice 进入 astream 调用参数;
    上游 tool_calls 事件 → SSE tool-call-start(契约字段 + args 解析 + 非法 arguments 兜底)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured.update(kwargs)
        captured["model"] = model
        yield {"type": "chunk", "content": "让我查一下"}
        yield {
            "type": "tool_calls",
            "tool_calls": [
                {
                    "index": 0,
                    "id": "call_abc",
                    "type": "function",
                    "function": {"name": "web_search", "arguments": '{"q":"北京天气"}'},
                },
                {
                    "index": 1,
                    "id": "call_def",
                    "type": "function",
                    # 非法 JSON arguments → 兜底透传原始字符串,不抛错
                    "function": {"name": "bad_tool", "arguments": "{not-json"},
                },
            ],
        }
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    _force_stub_mode(monkeypatch, stub=True)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "北京今天天气怎么样"}],
        "model": "test-model",
        "tools": _TOOLS_SCHEMA,
        "tool_choice": "auto",
    })
    events = _parse_sse_events(raw)

    # (a) 请求体透传:tools/tool_choice 原样到达上游调用参数
    assert captured.get("tools") == _TOOLS_SCHEMA
    assert captured.get("tool_choice") == "auto"

    # (b) tool-call-start 事件:每个 tool call 一条,字段符合 ToolCallEvent 契约
    tc_events = [e for e in events if e["event"] == "tool-call-start"]
    assert len(tc_events) == 2, f"期望 2 个 tool-call-start,实际 {len(tc_events)}"

    first, second = tc_events[0]["data"], tc_events[1]["data"]
    assert first["type"] == "tool-call-start"
    assert first["toolCallId"] == "call_abc"
    assert first["toolName"] == "web_search"
    # arguments JSON 字符串被解析为 dict
    assert first["args"] == {"q": "北京天气"}

    assert second["toolCallId"] == "call_def"
    assert second["toolName"] == "bad_tool"
    # 非法 JSON 兜底:args 保留原始字符串
    assert second["args"] == "{not-json"

    # 原生 tool_calls 事件不再以 event: tool_calls 外漏(已转换)
    assert not [e for e in events if e["event"] == "tool_calls"]

    # 内容与 done 仍正常
    chunk_text = "".join(e["data"].get("content", "") for e in events if e["event"] == "chunk")
    assert chunk_text == "让我查一下"
    done_events = [e for e in events if e["event"] == "done"]
    assert len(done_events) == 1


async def test_generic_path_without_tools_omits_kwargs(client: AsyncClient, monkeypatch):
    """不带 tools 的普通流式请求:astream 不收到 tools/tool_choice(保持旧行为,回归保护)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured.update(kwargs)
        yield {"type": "chunk", "content": "普通回复"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    _force_stub_mode(monkeypatch, stub=True)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "你好"}],
        "model": "test-model",
    })
    events = _parse_sse_events(raw)

    assert "tools" not in captured
    assert "tool_choice" not in captured
    assert not [e for e in events if e["event"] == "tool-call-start"]
    done_events = [e for e in events if e["event"] == "done"]
    assert len(done_events) == 1


# =============================================================================
# 2. gateway→litellm 全链路:tools 到达 litellm.acompletion + SSE 转换
# =============================================================================

async def test_full_chain_litellm_receives_tools(client: AsyncClient, monkeypatch):
    """全链路(HTTP → router → gateway → litellm):fake litellm.acompletion 捕获
    call_kwargs,断言 tools/tool_choice 透传到最终上游调用;上游分片 tool_calls
    经 gateway 累积 → router 转换为 SSE tool-call-start。"""
    from app.core.config import settings
    from app.routers import llm as llm_router

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "agnes": {"api_key": "sk-test-agnes", "api_base": "https://apihub.agnes-ai.com/v1"}
    }))

    # 非 stub 模式:走真实 _resolve(llm_providers JSON 供 key)+ LiteLLM 路径
    _force_stub_mode(monkeypatch, stub=False)

    # agnes/* 属受限模型(仅管理员):测试无 JWT,patch 掉访问检查(与本次验证目标无关)
    monkeypatch.setattr(llm_router, "_is_restricted_model", lambda m: False)

    # 跳过厂商原生适配器(带 tools 时优先走原生路径),强制走 LiteLLM 路径验证透传
    async def _no_provider(model, owner_uuid=None):
        return None

    monkeypatch.setattr(llm_router.llm_gateway, "_get_provider", _no_provider)

    litellm_captured: dict[str, Any] = {}

    class FakeFn:
        def __init__(self, name=None, arguments=None):
            self.name = name
            self.arguments = arguments

    class FakeToolCall:
        def __init__(self, index, id=None, type=None, function=None):
            self.index = index
            self.id = id
            self.type = type
            self.function = function

    class FakeDelta:
        def __init__(self, content=None, tool_calls=None):
            self.content = content
            self.tool_calls = tool_calls

    class FakeStreamChoice:
        def __init__(self, delta):
            self.delta = delta

    class FakeStreamChunk:
        def __init__(self, delta, model=None):
            self.choices = [FakeStreamChoice(delta)]
            self.model = model
            self.usage = None

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        litellm_captured.update(kwargs)

        async def _gen():
            # 分片 1:tool call 首片(id/type/name + arguments 首段)
            yield FakeStreamChunk(FakeDelta(
                content=None,
                tool_calls=[
                    FakeToolCall(
                        0, id="call_full_1", type="function",
                        function=FakeFn(name="web_search", arguments='{"q":"'),
                    )
                ],
            ), model="gpt-4o")
            # 分片 2:arguments 增量片段
            yield FakeStreamChunk(FakeDelta(
                content=None,
                tool_calls=[FakeToolCall(0, function=FakeFn(arguments='上海天气"}'))],
            ), model="gpt-4o")
            # 分片 3:普通 content
            yield FakeStreamChunk(FakeDelta(content="正在查询"), model="gpt-4o")

        return _gen()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "上海天气"}],
        "model": "agnes/gpt-4o",
        "tools": _TOOLS_SCHEMA,
        "tool_choice": "auto",
    })
    events = _parse_sse_events(raw)

    # (a) tools/tool_choice 到达最终上游调用 litellm.acompletion
    assert litellm_captured.get("tools") == _TOOLS_SCHEMA
    assert litellm_captured.get("tool_choice") == "auto"

    # (b) 分片累积后的 tool_calls 转换为 tool-call-start,arguments 完整解析
    tc_events = [e for e in events if e["event"] == "tool-call-start"]
    assert len(tc_events) == 1, f"期望 1 个 tool-call-start,实际 {len(tc_events)}"
    data = tc_events[0]["data"]
    assert data["type"] == "tool-call-start"
    assert data["toolCallId"] == "call_full_1"
    assert data["toolName"] == "web_search"
    assert data["args"] == {"q": "上海天气"}

    # content 分片与 done 正常
    chunk_text = "".join(e["data"].get("content", "") for e in events if e["event"] == "chunk")
    assert chunk_text == "正在查询"
    assert not [e for e in events if e["event"] == "tool_calls"]
    assert len([e for e in events if e["event"] == "done"]) == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
