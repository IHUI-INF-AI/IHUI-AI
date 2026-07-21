"""complete_stream 端点的 AI 主动提问集成测试。

验证:
- LLM 输出含 [[ASK_USER:JSON]] 标记时,SSE 流中正确推送 question 事件
- 标记从 chunk 内容中剥离,不污染对话文本
- 跨 chunk 分片标记能正确累积解析
- 不完整标记 flush 时作为普通文本输出
"""

from __future__ import annotations

import json
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


class TestCompleteStreamQuestionEvents:
    """complete_stream 的 question 事件集成测试。"""

    async def test_question_marker_emits_question_event(self, client: AsyncClient, monkeypatch):
        """LLM 输出含提问标记 → SSE 推送 question 事件,且 chunk 内容已剥离标记。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            """模拟 LLM 输出含标记的内容。"""
            yield {"type": "chunk", "content": "正在处理您的请求[[ASK_USER:{\"prompt\":\"选择语言\",\"options\":[{\"id\":\"py\",\"label\":\"Python\"}]}]]"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        # 应该有 question 事件
        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 1
        q_data = question_events[0]["data"]
        assert q_data["type"] == "question"
        assert q_data["question"]["prompt"] == "选择语言"
        assert q_data["question"]["options"][0]["id"] == "py"

        # chunk 事件内容应已剥离标记
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "[[ASK_USER:" not in chunk_text
        assert "正在处理您的请求" in chunk_text

    async def test_question_marker_split_across_chunks(self, client: AsyncClient, monkeypatch):
        """跨 chunk 分片的标记能正确累积解析。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "开头[[ASK_USER:{\"prompt\":"}
            yield {"type": "chunk", "content": "\"确认继续?\"}]]结尾"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 1
        assert question_events[0]["data"]["question"]["prompt"] == "确认继续?"

        # chunk 内容应剥离标记且前后文本拼接
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "[[ASK_USER:" not in chunk_text
        assert chunk_text == "开头结尾"

    async def test_multiple_questions_in_one_stream(self, client: AsyncClient, monkeypatch):
        """单个流中多个提问标记全部解析。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "[[ASK_USER:{\"prompt\":\"Q1\"}]]中间[[ASK_USER:{\"prompt\":\"Q2\"}]]"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 2
        assert question_events[0]["data"]["question"]["prompt"] == "Q1"
        assert question_events[1]["data"]["question"]["prompt"] == "Q2"

    async def test_no_marker_no_question_event(self, client: AsyncClient, monkeypatch):
        """无标记时不产生 question 事件。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "普通文本无标记"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 0

        chunk_events = [e for e in events if e["event"] == "chunk"]
        assert chunk_events[0]["data"]["content"] == "普通文本无标记"

    async def test_invalid_marker_json_skipped(self, client: AsyncClient, monkeypatch):
        """标记内 JSON 非法 → 标记被丢弃,不推送 question 事件,不阻塞流。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "before[[ASK_USER:not-json]]after"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        # 非法 JSON 不应产生 question 事件
        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 0

        # 标记被丢弃,前后文本拼接
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "beforeafter" in chunk_text
        assert "[[ASK_USER:" not in chunk_text

    async def test_incomplete_marker_flushed_as_text(self, client: AsyncClient, monkeypatch):
        """流结束时未闭合的标记 → flush 时作为普通文本输出(不吞内容)。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "正常文本[[ASK_USER:未闭合"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        # 不完整标记不应产生 question 事件
        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 0

        # 不完整标记作为文本输出(不吞内容)
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "正常文本" in chunk_text
        assert "[[ASK_USER:未闭合" in chunk_text
