# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSE 流式解析器单元测试 — 同步 + 异步,覆盖跨块断帧。"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Iterator
from typing import Any

from ihui_ai.streaming import (
    parse_agent_stream_async,
    parse_agent_stream_sync,
    parse_chat_stream_async,
    parse_chat_stream_sync,
)


def sse_chunk(id_: str, content: str) -> bytes:
    return (
        "data: "
        + json.dumps(
            {
                "id": id_,
                "object": "chat.completion.chunk",
                "created": 1700000000,
                "model": "gpt-4o",
                "choices": [{"index": 0, "delta": {"content": content}, "finishReason": None}],
            },
            ensure_ascii=False,
        )
        + "\n\n"
    ).encode()


def byte_chunks(*parts: bytes) -> Iterator[bytes]:
    yield from parts


def collect(gen: Iterator[Any] | Any) -> list[Any]:
    return list(gen)


class TestChatStreamSync:
    def test_single_frame(self) -> None:
        out = collect(parse_chat_stream_sync(byte_chunks(sse_chunk("a", "你好"))))
        assert len(out) == 1
        assert out[0]["id"] == "a"
        assert out[0]["choices"][0]["delta"]["content"] == "你好"

    def test_multiple_frames_one_chunk(self) -> None:
        out = collect(parse_chat_stream_sync(byte_chunks(sse_chunk("a", "x") + sse_chunk("b", "y"))))
        assert [c["id"] for c in out] == ["a", "b"]

    def test_cross_chunk_split_mid_json(self) -> None:
        frame = sse_chunk("split", "跨块断帧内容")
        cut = frame.index(b'"created"') + 4
        out = collect(parse_chat_stream_sync(byte_chunks(frame[:cut], frame[cut:])))
        assert len(out) == 1
        assert out[0]["id"] == "split"
        assert out[0]["choices"][0]["delta"]["content"] == "跨块断帧内容"

    def test_cross_chunk_split_mid_utf8_char(self) -> None:
        """在多字节 UTF-8 字符('深' 占 3 字节)中间切开,decode(errors=replace) 后该字符损坏但不崩溃。"""
        frame = sse_chunk("mb", "AB深CD")
        cut = frame.index("深".encode()) + 2  # 切在 '深' 的第 2 字节后
        out = collect(parse_chat_stream_sync(byte_chunks(frame[:cut], frame[cut:])))
        assert len(out) == 1  # 不崩溃,JSON 仍可解析(replace 字符合法)
        assert out[0]["id"] == "mb"

    def test_done_terminates(self) -> None:
        out = collect(parse_chat_stream_sync(byte_chunks(sse_chunk("a", "x"), b"data: [DONE]\n\n", sse_chunk("b", "never"))))
        assert [c["id"] for c in out] == ["a"]

    def test_malformed_line_skipped(self) -> None:
        out = collect(parse_chat_stream_sync(byte_chunks(b"data: {bad json\n\n", sse_chunk("a", "ok"))))
        assert [c["id"] for c in out] == ["a"]

    def test_comments_and_event_lines_skipped(self) -> None:
        payload = b": keep-alive\n\nevent: ping\n\nid: 1\n\n" + sse_chunk("a", "ok")
        out = collect(parse_chat_stream_sync(byte_chunks(payload)))
        assert [c["id"] for c in out] == ["a"]

    def test_crlf_line_endings(self) -> None:
        frame = sse_chunk("a", "x").replace(b"\n", b"\r\n")
        out = collect(parse_chat_stream_sync(byte_chunks(frame)))
        assert [c["id"] for c in out] == ["a"]


class TestAgentStreamSync:
    def test_data_event_raw(self) -> None:
        s = b'data: {"step":1}\n\nevent: tool_call\n\nplain line\n\ndata: [DONE]\n\n'
        out = collect(parse_agent_stream_sync(byte_chunks(s)))
        assert out == [
            {"type": "data", "data": {"step": 1}},
            {"type": "event", "data": {"name": "tool_call"}},
            {"type": "raw", "data": {"text": "plain line"}},
        ]

    def test_non_json_data_falls_back_to_raw(self) -> None:
        out = collect(parse_agent_stream_sync(byte_chunks(b"data: <<heartbeat>>\n\n")))
        assert out == [{"type": "raw", "data": {"text": "<<heartbeat>>"}}]

    def test_cross_chunk_split(self) -> None:
        frame = b'data: {"key":"value"}\n\n'
        out = collect(parse_agent_stream_sync(byte_chunks(frame[:10], frame[10:])))
        assert out == [{"type": "data", "data": {"key": "value"}}]


class TestAsyncParsers:
    def _make_reader(self, *parts: bytes) -> asyncio.StreamReader:
        reader = asyncio.StreamReader()
        for p in parts:
            reader.feed_data(p)
        reader.feed_eof()
        return reader

    def test_chat_stream_async(self) -> None:
        async def run() -> list[Any]:
            reader = self._make_reader(sse_chunk("a", "x"), b"data: [DONE]\n\n")
            return [c async for c in parse_chat_stream_async(reader)]

        out = asyncio.run(run())
        assert [c["id"] for c in out] == ["a"]

    def test_agent_stream_async(self) -> None:
        async def run() -> list[Any]:
            reader = self._make_reader(b'data: {"k":1}\n\nevent: e1\n\n')
            return [c async for c in parse_agent_stream_async(reader)]

        out = asyncio.run(run())
        assert out == [
            {"type": "data", "data": {"k": 1}},
            {"type": "event", "data": {"name": "e1"}},
        ]
