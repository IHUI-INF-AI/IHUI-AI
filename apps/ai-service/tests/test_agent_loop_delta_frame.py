# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""agent 工具循环逐分片直推(2026-11-05 立)回归钉子。

锁定 llm.py 的 agent 工具循环(首轮 `_tool_iter == 0` / 后续轮)调用
`llm_gateway.astream` 时**必须**带 `tool_call_args_stream=True`,且 astream
产出的 `tool-call-args-delta` 逐片帧必须被原样上 wire —— 此前 agent 循环分支
的事件 `elif` 链无该分支,帧被静默丢弃 ⇒ 前端 ToolCallCard 在 agent 场景下
拿不到渐进渲染入参。本测试捕获调用参数并断言端到端透传,防止该开关被误删。
"""

from __future__ import annotations

import json
from typing import Any

from app.routers import llm as llm_router
from app.services.mcp_server import mcp_server as _mcp_inst


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """解析 SSE 原始文本为事件列表(每项为 {"event": <type>, "data": <json|str>})。"""
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
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


async def _stream_chat(client, body: dict[str, Any]) -> str:
    """调用 /api/llm/complete/stream 并返回原始 SSE 文本。"""
    resp = await client.post("/api/llm/complete/stream", json=body)
    assert resp.status_code == 200
    return resp.text


async def test_agent_tool_loop_emits_tool_call_args_delta(client, monkeypatch):
    """agent 循环打开逐分片直推 ⇒ 开关透传到 astream,且逐片帧到达 wire。"""
    captured = {"tool_call_args_stream": None}
    astream_call_count = {"n": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        # 捕获调用参数:锁定 llm.py 确实带上了开关。
        captured["tool_call_args_stream"] = kwargs.get("tool_call_args_stream", False)
        astream_call_count["n"] += 1
        if astream_call_count["n"] == 1:
            # 模拟真实 astream 在 tool_call_args_stream=True 时的产出:
            # 逐片产 tool-call-args-delta(首片 partial)+ 末尾聚合 tool_calls。
            yield {
                "type": "tool-call-args-delta",
                "index": 0,
                "id": "c1",
                "name": "web_search",
                "args": {"q": "te"},
                "argsComplete": False,
                "argsPartial": True,
            }
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
            yield {"type": "chunk", "content": "已搜索"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        # 回归守卫:W7 #10 后任何轮次都不得再走非流式 complete()。
        raise AssertionError("W7 #10:tool loop 后续轮不得再调用非流式 complete()")

    async def mock_call_tool(name, arguments, **kwargs):
        return {"tool": name, "ok": True, "mock": True, "message": f"mock execution of {name}"}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "搜索 test"}],
        "model": "test-model",
        "agent_tools": ["web_search"],
    })
    events = _parse_sse_events(raw)

    # 锁定 1:开关确实透传到 astream(否则前端永远收不到逐片帧)。
    assert captured["tool_call_args_stream"] is True, \
        "llm.py 的 agent 工具循环必须带 tool_call_args_stream=True"

    # 锁定 2:逐片帧原样上 wire(此前 agent 循环 elif 链缺该分支,被静默丢弃)。
    delta_events = [e for e in events if e["event"] == "tool-call-args-delta"]
    assert len(delta_events) >= 1, "agent 循环必须透传 tool-call-args-delta 帧"
    assert delta_events[0]["data"]["id"] == "c1"
    assert delta_events[0]["data"]["name"] == "web_search"
    assert delta_events[0]["data"]["argsPartial"] is True

    # 工具循环仍正常闭环:聚合 tool-call-start + 执行 tool-result。
    assert len([e for e in events if e["event"] == "tool-call-start"]) == 1
    assert len([e for e in events if e["event"] == "tool-result"]) == 1
    # 流正常收尾:llm.py 吸收各轮 astream 的 done 后统一产 1 个最终 done
    # (与 test_first_round_streaming_with_tool_calls 行为一致,非逐轮透传 done)。
    assert len([e for e in events if e["event"] == "done"]) == 1
    # 两轮 astream 都被调用(首轮决策工具 + 续轮产出最终回复),闭环未中断。
    assert astream_call_count["n"] == 2


async def test_second_round_agent_loop_emits_tool_call_args_delta(client, monkeypatch):
    """后续轮(第二轮)逐分片直推同样必须上 wire —— BUG-0006 回归钉子。

    修复前:首轮分支用事件类型串兜底,后续轮却引用了未导入的
    ``SSE_TOOL_CALL_ARGS_DELTA``,第二轮一旦收到 ``tool-call-args-delta``
    就抛 NameError,整条 SSE 流退化为 error 帧。本用例让两轮都产逐片帧,
    断言第二轮那一片确实到达 wire。
    """
    rounds: list[bool] = []
    astream_call_count = {"n": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        rounds.append(bool(kwargs.get("tool_call_args_stream", False)))
        astream_call_count["n"] += 1
        if astream_call_count["n"] == 1:
            yield {
                "type": "tool-call-args-delta",
                "index": 0,
                "id": "c1",
                "name": "web_search",
                "args": {"q": "te"},
                "argsComplete": False,
                "argsPartial": True,
            }
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
            # 第二轮也产逐片帧(修复前这里会触发 NameError)。
            yield {
                "type": "tool-call-args-delta",
                "index": 0,
                "id": "c2",
                "name": "web_search",
                "args": {"q": "test"},
                "argsComplete": True,
                "argsPartial": False,
            }
            yield {"type": "chunk", "content": "已搜索"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        raise AssertionError("W7 #10:tool loop 后续轮不得再调用非流式 complete()")

    async def mock_call_tool(name, arguments, **kwargs):
        return {"tool": name, "ok": True, "mock": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

    raw = await _stream_chat(client, {
        "messages": [{"role": "user", "content": "搜索 test"}],
        "model": "test-model",
        "agent_tools": ["web_search"],
    })
    events = _parse_sse_events(raw)

    assert astream_call_count["n"] == 2
    assert all(rounds), "两轮 astream 都必须带 tool_call_args_stream=True"

    delta_ids = [e["data"]["id"] for e in events if e["event"] == "tool-call-args-delta"]
    assert "c1" in delta_ids, "首轮逐片帧必须上 wire"
    assert "c2" in delta_ids, "第二轮逐片帧必须上 wire(BUG-0006:不得 NameError)"
    assert "error" not in [e["event"] for e in events]
    # 工具循环仍正常闭环。
    assert len([e for e in events if e["event"] == "tool-call-start"]) == 1
    assert len([e for e in events if e["event"] == "tool-result"]) == 1

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
