# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-08b 票1:帧解析失败必须判整条连接关闭,而不是"跳过该消息"继续读。

纯 in-process 喂字节(不需 DB、不需真起 language server):
- 向 LspClient._read_loop 喂「坏 header 帧 + 一条合法响应帧」,
  断言读到坏帧后 client 被置为不可用(is_unusable is True)、读环退出;
- 断言后续合法帧不再被分发给等待中的请求;
- 反向对照:喂两条全合法帧时两条都正常分发且连接不判死。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from app.api.v1.lsp import LspClient


def _frame(body: dict[str, Any]) -> bytes:
    """编码一条合法的 Content-Length 帧。"""
    body_bytes = json.dumps(body).encode("utf-8")
    header = f"Content-Length: {len(body_bytes)}\r\n\r\n".encode("ascii")
    return header + body_bytes


class _FakeProc:
    """不 spawn 真进程的桩:stdout 由测试用 StreamReader 控制,terminate 可观测。"""

    def __init__(self, stdout: asyncio.StreamReader) -> None:
        self.stdout = stdout
        self.returncode: int | None = None
        self.terminated = False

    def terminate(self) -> None:
        self.terminated = True


async def _feed_and_wait(
    client: LspClient, chunks: list[bytes]
) -> asyncio.Task[None]:
    """启动读环,喂入字节后 EOF,等待读环退出。"""
    task = asyncio.create_task(client._read_loop())
    for chunk in chunks:
        assert client.proc is not None
        client.proc.stdout.feed_data(chunk)  # type: ignore[union-attr]
    assert client.proc is not None
    client.proc.stdout.feed_eof()  # type: ignore[union-attr]
    await asyncio.wait_for(task, timeout=2.0)
    return task


async def test_bad_header_frame_marks_client_unusable() -> None:
    """① 坏 header 帧(Content-Length 无法解析)⇒ client 置为不可用、读环退出。"""
    reader = asyncio.StreamReader()
    client = LspClient("ws-desync-bad-header")
    client.proc = _FakeProc(reader)

    await _feed_and_wait(
        client,
        [
            # 坏 header 帧:长度值不是数字
            b"Content-Length: not-a-number\r\n\r\n",
            # 坏帧之后跟着的一条合法响应帧(不应再被处理)
            _frame({"jsonrpc": "2.0", "id": 1, "result": {"ok": True}}),
        ],
    )

    assert client.is_unusable is True
    assert client.proc.terminated is True  # 判死连带终止子进程,不再有人读帧


async def test_valid_frame_after_bad_header_is_not_dispatched() -> None:
    """② 后续合法帧不再被分发给等待中的请求(等待者只收到判死异常)。"""
    reader = asyncio.StreamReader()
    client = LspClient("ws-desync-no-dispatch")
    client.proc = _FakeProc(reader)
    fut: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    client._responses[1] = fut  # 模拟一个等待 id=1 响应的请求

    await _feed_and_wait(
        client,
        [
            b"Content-Length: not-a-number\r\n\r\n",
            _frame({"jsonrpc": "2.0", "id": 1, "result": {"ok": True}}),
        ],
    )

    assert fut.done()
    with pytest.raises(RuntimeError, match="closed"):
        fut.result()  # 拿到的是 transport is closed,而不是那条合法响应


async def test_all_valid_frames_dispatched_and_connection_alive() -> None:
    """③ 反向对照:两条全合法帧都正常分发,连接不判死。"""
    reader = asyncio.StreamReader()
    client = LspClient("ws-desync-control")
    client.proc = _FakeProc(reader)
    fut1: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    fut2: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    client._responses[1] = fut1
    client._responses[2] = fut2

    await _feed_and_wait(
        client,
        [
            _frame({"jsonrpc": "2.0", "id": 1, "result": "r1"}),
            _frame({"jsonrpc": "2.0", "id": 2, "result": "r2"}),
        ],
    )

    assert fut1.result() == "r1"
    assert fut2.result() == "r2"
    assert client.is_unusable is False
    assert client.proc.terminated is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
