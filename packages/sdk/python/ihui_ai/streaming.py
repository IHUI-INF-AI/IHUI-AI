"""SSE 流式响应解析器 — 同步 + asyncio 双版本。

支持两种流式端点:
- POST /v1/chat/completions(stream:true)→ OpenAI 兼容 ``data: {json}\\n\\n`` + ``data: [DONE]``
- POST /v1/agents/execute/stream → 逐行透传 SSE 事件
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterator
from typing import Any

from .types import AgentStreamEvent, ChatStreamChunk, JsonObject


# =============================================================================
# 同步解析器(读取 bytes 流,逐行 yield)
# =============================================================================


def _iter_lines_sync(byte_iter: Iterator[bytes]) -> Iterator[str]:
    """从 bytes 块迭代器中逐行 yield 文本行(处理跨块边界)。"""
    buffer = ""
    for chunk in byte_iter:
        if isinstance(chunk, bytes):
            text = chunk.decode("utf-8", errors="replace")
        else:
            text = str(chunk)
        buffer += text
        # 按换行分割,保留最后一段(可能不完整)
        parts = buffer.split("\n")
        buffer = parts.pop()
        for line in parts:
            yield line
    # 刷出剩余
    if buffer:
        yield buffer


def parse_chat_stream_sync(byte_iter: Iterator[bytes]) -> Iterator[ChatStreamChunk]:
    """解析 chat.completions SSE 流(OpenAI 兼容)。

    遇到 ``data: [DONE]`` 时结束。无法解析的行(心跳/注释)跳过。

    Args:
        byte_iter: bytes 块迭代器(来自 urllib 响应的 iter_content)。

    Yields:
        ChatStreamChunk dict 对象。
    """
    for line in _iter_lines_sync(byte_iter):
        trimmed = line.strip()
        if not trimmed or not trimmed.startswith("data:"):
            continue
        payload = trimmed[5:].strip()
        if payload == "[DONE]":
            return
        try:
            yield json.loads(payload)
        except json.JSONDecodeError:
            # 跳过无法解析的行(心跳/注释)
            continue


def parse_agent_stream_sync(byte_iter: Iterator[bytes]) -> Iterator[AgentStreamEvent]:
    """解析 Agent 执行 SSE 流(逐行透传 data/event/raw)。

    Args:
        byte_iter: bytes 块迭代器。

    Yields:
        AgentStreamEvent dict 对象,``type`` 字段为 ``'data'`` / ``'event'`` / ``'raw'``。
    """
    for line in _iter_lines_sync(byte_iter):
        trimmed = line.strip()
        if not trimmed:
            continue
        if trimmed.startswith("data:"):
            payload = trimmed[5:].strip()
            if payload == "[DONE]":
                return
            try:
                yield {"type": "data", "data": json.loads(payload)}
            except json.JSONDecodeError:
                yield {"type": "raw", "data": {"text": payload}}
        elif trimmed.startswith("event:"):
            yield {"type": "event", "data": {"name": trimmed[6:].strip()}}
        else:
            yield {"type": "raw", "data": {"text": trimmed}}


# =============================================================================
# 异步解析器(读取 asyncio StreamReader,逐行 yield)
# =============================================================================


async def _aiter_lines_async(reader: Any) -> AsyncIterator[str]:
    """从 asyncio StreamReader 中逐行 yield 文本行。

    reader 需提供 ``readline()`` 协程,返回 bytes(含换行符)或空 bytes(EOF)。
    """
    while True:
        line_bytes = await reader.readline()
        if not line_bytes:
            break
        yield line_bytes.decode("utf-8", errors="replace").rstrip("\r\n")


async def parse_chat_stream_async(reader: Any) -> AsyncIterator[ChatStreamChunk]:
    """异步解析 chat.completions SSE 流。

    Args:
        reader: asyncio StreamReader(或任何提供 ``readline()`` 协程的对象)。

    Yields:
        ChatStreamChunk dict 对象。
    """
    async for line in _aiter_lines_async(reader):
        trimmed = line.strip()
        if not trimmed or not trimmed.startswith("data:"):
            continue
        payload = trimmed[5:].strip()
        if payload == "[DONE]":
            return
        try:
            yield json.loads(payload)
        except json.JSONDecodeError:
            continue


async def parse_agent_stream_async(reader: Any) -> AsyncIterator[AgentStreamEvent]:
    """异步解析 Agent 执行 SSE 流。

    Args:
        reader: asyncio StreamReader。

    Yields:
        AgentStreamEvent dict 对象。
    """
    async for line in _aiter_lines_async(reader):
        trimmed = line.strip()
        if not trimmed:
            continue
        if trimmed.startswith("data:"):
            payload = trimmed[5:].strip()
            if payload == "[DONE]":
                return
            try:
                yield {"type": "data", "data": json.loads(payload)}
            except json.JSONDecodeError:
                yield {"type": "raw", "data": {"text": payload}}
        elif trimmed.startswith("event:"):
            yield {"type": "event", "data": {"name": trimmed[6:].strip()}}
        else:
            yield {"type": "raw", "data": {"text": trimmed}}


__all__ = [
    "parse_chat_stream_sync",
    "parse_agent_stream_sync",
    "parse_chat_stream_async",
    "parse_agent_stream_async",
]
