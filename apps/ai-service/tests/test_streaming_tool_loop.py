# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""tool loop 第一轮流式化 + tool_calls 分片累积测试(2026-08-29 修复)。

背景:此前 ai-service chat 流"内容一次性全出"根因是 tool loop 第一轮用非流式
complete(),LLM 无 tool_calls 直接回复时整个 content 一次性 yield。修复后:
- 第一轮改调带 tools 的 astream,逐 token 输出 content/reasoning,同时收集 tool_calls;
- llm_gateway.astream 统一把 tool_calls 分片累积为完整列表,tool_calls 事件在流结束前产出;
- 后续轮次 complete 无 tool_calls 时按 8 字符/块拆块流式兜底。

覆盖(与 test_tool_loop_e2e.py / test_complete_stream_question.py 同模式):
1. 第一轮流式无工具调用:chunk×N 逐块透传 + done,无一次性大块
2. 第一轮流式有工具调用:tool_calls 触发工具执行,最终 done
3. 后续轮次 complete 无工具调用 → 8 字符拆块流式兜底
4. llm_gateway.astream(litellm 路径)tool_calls 分片累积为完整列表
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
    assert resp.status_code == 200
    return resp.text


# =============================================================================
# 1. 第一轮流式无工具调用 → 逐块透传,无一次性大块
# =============================================================================

async def test_first_round_streaming_no_tool_calls(client: AsyncClient, monkeypatch):
    """第一轮流式:LLM 无 tool_calls 直接回复,内容逐 token 透传(≥2 个 chunk),非一次性大块。"""
    from app.routers import llm as llm_router

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        """模拟流式回复:逐 token 输出,无 tool_calls。"""
        yield {"type": "chunk", "content": "你好"}
        yield {"type": "chunk", "content": "世界"}
        yield {"type": "chunk", "content": "!"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "你好"}],
        "model": "test-model",
        "agent_tools": ["web_search"],
    })
    events = _parse_sse_events(raw)

    chunk_events = [e for e in events if e["event"] == "chunk"]
    # 关键断言:逐块透传,不是单个大块
    assert len(chunk_events) >= 2, f"期望 ≥2 个 chunk,实际 {len(chunk_events)}"

    # 内容完整拼接
    chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
    assert chunk_text == "你好世界!"

    # done 事件存在且 stub 透传
    done_events = [e for e in events if e["event"] == "done"]
    assert len(done_events) == 1
    assert done_events[0]["data"]["stub"] is True

    # 未触发任何工具执行
    tool_start_events = [e for e in events if e["event"] == "tool-call-start"]
    assert len(tool_start_events) == 0


# =============================================================================
# 2. 第一轮流式有工具调用 → 工具执行路径被触发,最终 done
# =============================================================================

async def test_first_round_streaming_with_tool_calls(client: AsyncClient, monkeypatch):
    """第一轮流式携带 tool_calls → 工具执行 → 后续轮 astream 真流式回复 → done(W7 #10)。"""
    from app.routers import llm as llm_router
    from app.services.mcp_server import mcp_server as _mcp_inst

    astream_call_count = {"n": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        """状态化 mock:第一轮流式输出内容 + tool_calls;第二轮(工具结果回灌后)流式回复。"""
        astream_call_count["n"] += 1
        if astream_call_count["n"] == 1:
            yield {"type": "chunk", "content": "好的"}
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "web_search", "arguments": '{"q":"test"}'},
                    }
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "已为您"}
            yield {"type": "chunk", "content": "搜索完成"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        """回归守卫:W7 #10 后任何轮次都不得再走非流式 complete()。"""
        raise AssertionError("W7 #10:tool loop 后续轮次不得再调用非流式 complete()")

    async def mock_call_tool(name, arguments, **kwargs):
        """模拟 web_search 工具执行成功。"""
        return {
            "tool": name,
            "ok": True,
            "mock": True,
            "message": f"mock execution of {name}",
        }

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "搜索 test"}],
        "model": "test-model",
        "agent_tools": ["web_search"],
    })
    events = _parse_sse_events(raw)

    # 工具执行路径被触发(仅一次,不因后续轮重复 astream 而重复)
    tool_start_events = [e for e in events if e["event"] == "tool-call-start"]
    assert len(tool_start_events) == 1
    assert tool_start_events[0]["data"]["toolName"] == "web_search"

    tool_result_events = [e for e in events if e["event"] == "tool-result"]
    assert len(tool_result_events) == 1
    assert tool_result_events[0]["data"]["isError"] is False

    # 第二轮走了 astream 真流式(W7 #10)
    assert astream_call_count["n"] == 2

    # 全部 chunk 拼接 = 第一轮流式内容 + 第二轮流式内容
    chunk_events = [e for e in events if e["event"] == "chunk"]
    chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
    assert chunk_text == "好的已为您搜索完成"

    # 最终 done
    done_events = [e for e in events if e["event"] == "done"]
    assert len(done_events) == 1


# =============================================================================
# 3. 后续轮次 complete 无工具调用 → 8 字符拆块流式兜底
# =============================================================================

async def test_subsequent_round_astream_streaming(client: AsyncClient, monkeypatch):
    """W7 #10(2026-09-18):后续轮次改 astream 真流式 — 第二轮 content 以多 chunk
    逐 token 到达,8 字符打字机模拟与非流式 complete() 全部废除(回归守卫)。"""
    from app.routers import llm as llm_router
    from app.services.mcp_server import mcp_server as _mcp_inst

    long_content = "这是一段用于验证后续轮次真实流式输出的较长的中文测试内容。"
    _mid = len(long_content) // 3
    _parts = (long_content[:_mid], long_content[_mid:2 * _mid], long_content[2 * _mid:])

    call_counter = {"n": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        """状态化 mock:第一轮仅产出 tool_calls;第二轮分 3 块逐 token 流式 content。"""
        call_counter["n"] += 1
        if call_counter["n"] == 1:
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "c2",
                        "type": "function",
                        "function": {"name": "web_search", "arguments": '{"q":"代码"}'},
                    }
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            for seg in _parts:
                yield {"type": "chunk", "content": seg}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        """回归守卫:W7 #10 后任何轮次都不得再走非流式 complete()。"""
        raise AssertionError("W7 #10:tool loop 后续轮次不得再调用非流式 complete()")

    async def mock_call_tool(name, arguments, **kwargs):
        return {"tool": name, "ok": True, "mock": True, "message": f"mock execution of {name}"}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "帮我搜代码"}],
        "model": "test-model",
        "agent_tools": ["web_search"],
    })
    events = _parse_sse_events(raw)

    # 第一轮触发了工具执行
    tool_result_events = [e for e in events if e["event"] == "tool-result"]
    assert len(tool_result_events) == 1

    # 关键断言 1:第二轮 content 以 ≥2 个 chunk 逐 token 到达(真流式,非单块大内容)
    chunk_events = [e for e in events if e["event"] == "chunk"]
    assert len(chunk_events) >= 2, f"期望 ≥2 个 chunk(真流式),实际 {len(chunk_events)}"

    # 关键断言 2:累计 content 完整(流式不丢字)
    chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
    assert chunk_text == long_content

    # 流正常收尾
    done_events = [e for e in events if e["event"] == "done"]
    assert len(done_events) == 1
    # astream 恰好被调用两轮
    assert call_counter["n"] == 2


# =============================================================================
# 4. llm_gateway.astream(litellm 路径)tool_calls 分片累积
# =============================================================================

async def test_astream_litellm_accumulates_tool_call_fragments(monkeypatch):
    """litellm 路径:tool_calls 分片按 index 累积,流结束前产出完整事件。"""
    from app.core.config import settings
    from app.core.llm_gateway import LLMGateway

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "agnes": {"api_key": "sk-test-agnes", "api_base": "https://apihub.agnes-ai.com/v1"}
    }))

    gw = LLMGateway()

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

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        async def _gen():
            # 分片 1:首个分片带 id/type/name + arguments 首段
            yield FakeStreamChunk(FakeDelta(
                content=None,
                tool_calls=[
                    FakeToolCall(
                        0, id="call_123", type="function",
                        function=FakeFn(name="web_search", arguments='{"q":"te'),
                    )
                ],
            ), model="gpt-4o")
            # 分片 2:同 index 仅 arguments 增量片段
            yield FakeStreamChunk(FakeDelta(
                content=None,
                tool_calls=[FakeToolCall(0, function=FakeFn(arguments='st"}'))],
            ), model="gpt-4o")
            # 分片 3:普通 content,无 tool_calls
            yield FakeStreamChunk(FakeDelta(content="结果"), model="gpt-4o")

        return _gen()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    events = [e async for e in gw.astream(
        [{"role": "user", "content": "hi"}],
        model="agnes/gpt-4o",
    )]

    # 分片事件不透传,统一产出 1 个完整 tool_calls 事件
    tool_call_events = [e for e in events if e["type"] == "tool_calls"]
    assert len(tool_call_events) == 1, f"期望 1 个 tool_calls 事件,实际 {len(tool_call_events)}"

    merged = tool_call_events[0]["tool_calls"]
    assert merged == [
        {
            "index": 0,
            "id": "call_123",
            "type": "function",
            "function": {"name": "web_search", "arguments": '{"q":"test"}'},
        }
    ]

    # content 分片仍逐块透传
    chunk_events = [e for e in events if e["type"] == "chunk"]
    assert len(chunk_events) == 1
    assert chunk_events[0]["content"] == "结果"

    # done 为最后一个事件
    assert events[-1]["type"] == "done"


# =============================================================================
# 5. 工具循环后续轮 complete 空 content → 不再插入"抱歉"假文案(2026-09-03 修复)
# =============================================================================

FALLBACK_TEXT = "抱歉,未能生成有效回复,请换个说法重试一下。"


async def test_subsequent_round_empty_content_no_fallback_after_tools(
    client: AsyncClient, monkeypatch
):
    """工具已执行(tool_calls_history 非空)后 complete 返回空 content → 流中不出现假文案 chunk。

    2026-09-03 修复(llm.py tool loop 兜底):此前无条件插入"抱歉,未能生成有效回复"假文案,
    会被 CLI 拼接进 assistantText 存入 assistant 消息回传 provider,污染对话上下文。
    修复后仅当本轮循环未执行过任何工具时才兜底(对齐 generic astream 的 _had_tools 模式)。
    """
    from app.routers import llm as llm_router
    from app.services.mcp_server import mcp_server as _mcp_inst

    call_counter = {"n": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        """状态化 mock:第一轮仅产出 tool_calls;第二轮空流(仅 done,agent 场景正常形态)。"""
        call_counter["n"] += 1
        if call_counter["n"] == 1:
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "c3",
                        "type": "function",
                        "function": {"name": "web_search", "arguments": '{"q":"空回复"}'},
                    }
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        """回归守卫:W7 #10 后任何轮次都不得再走非流式 complete()。"""
        raise AssertionError("W7 #10:tool loop 后续轮次不得再调用非流式 complete()")

    async def mock_call_tool(name, arguments, **kwargs):
        return {"tool": name, "ok": True, "mock": True, "message": f"mock execution of {name}"}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "搜索后空回复"}],
        "model": "test-model",
        "agent_tools": ["web_search"],
    })
    events = _parse_sse_events(raw)

    # 工具确实执行过(前置条件:tool_calls_history 非空)
    tool_result_events = [e for e in events if e["event"] == "tool-result"]
    assert len(tool_result_events) == 1

    # 关键断言:流中不出现假文案(既无完全匹配,也无任何 chunk 拼出该文案)
    chunk_text = "".join(
        e["data"].get("content", "") for e in events if e["event"] == "chunk"
    )
    assert FALLBACK_TEXT not in chunk_text
    assert "未能生成有效回复" not in chunk_text

    # 流正常收尾(仍产出 done,不因空 content 中断)
    done_events = [e for e in events if e["event"] == "done"]
    assert len(done_events) == 1


async def test_empty_content_fallback_when_no_tools_executed(
    client: AsyncClient, monkeypatch
):
    """未执行任何工具 + LLM 真正空回复 → 兜底假文案仍然生效(用户不至于收到空消息)。"""
    from app.routers import llm as llm_router

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        """第一轮流式:既无 content 也无 tool_calls(真正空输出)。"""
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "你好"}],
        "model": "test-model",
        "agent_tools": ["web_search"],
    })
    events = _parse_sse_events(raw)

    # 关键断言:无工具执行的空回复仍走兜底,用户能收到提示文案
    chunk_text = "".join(
        e["data"].get("content", "") for e in events if e["event"] == "chunk"
    )
    assert FALLBACK_TEXT in chunk_text

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
