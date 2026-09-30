# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-08b 票2:单次请求超时 ⇒ 上抛"连接不可信"事件,由 owner 淘汰该 client。

纯 in-process 桩(不 spawn 真 language server):
- 同一 workspace 的 client 连发两次同方法、桩里让两次都在 timeoutMs 内不返回;
  断言 ① 第二次结束后该 workspace 的条目已从 _instances 移除并打印淘汰原因
  (方法名 + 超时次数),② 第三次请求重新 spawn 一个新 client 而不是继续复用;
- 反向对照:一次成功一次超时 ⇒ 不淘汰(单次抖动不得升级成回收)。
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import pytest

from app.api.v1.lsp import LspClient


def _frame(body: dict[str, Any]) -> bytes:
    """编码一条合法的 Content-Length 帧。"""
    body_bytes = json.dumps(body).encode("utf-8")
    header = f"Content-Length: {len(body_bytes)}\r\n\r\n".encode("ascii")
    return header + body_bytes


class _FakeStdin:
    def __init__(self) -> None:
        self.written: list[bytes] = []

    def write(self, data: bytes) -> int:
        self.written.append(data)
        return len(data)

    async def drain(self) -> None:
        return None


class _FakeProc:
    """不 spawn 真进程的桩:stdin 可写,stdout 由测试用 StreamReader 控制。"""

    def __init__(self, stdout: asyncio.StreamReader | None = None) -> None:
        self.stdin = _FakeStdin()
        self.stdout = stdout
        self.returncode: int | None = None
        self.terminated = False

    def terminate(self) -> None:
        self.terminated = True


async def test_two_consecutive_timeouts_evict_instance(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """连续两次同方法超时 ⇒ ① 从 _instances 淘汰并打印原因,② 下次重新 spawn。"""
    ws = "ws-timeout-evict"
    LspClient._instances.pop(ws, None)
    try:
        client = LspClient(ws)
        client.proc = _FakeProc()
        LspClient._instances[ws] = client
        fired: list[tuple[str, int, float]] = []
        client.onRequestTimeout = lambda method, rid, ms: fired.append((method, rid, ms))

        for _ in range(2):
            with pytest.raises(RuntimeError, match="超时"):
                await client._request("plugins/list", {}, timeout=0.05)

        # ① 第二次结束后该 workspace 的条目已从 _instances 移除
        assert ws not in LspClient._instances
        # onRequestTimeout 事件上抛(带 method/requestId/timeoutMs)
        assert len(fired) == 2
        assert fired[0][0] == "plugins/list"
        assert fired[0][2] == pytest.approx(50.0)
        # 淘汰原因日志点名方法名 + 超时次数
        eviction_logs = [
            r.getMessage()
            for r in caplog.records
            if r.levelno >= logging.WARNING and "淘汰实例" in r.getMessage()
        ]
        assert any(
            "plugins/list" in msg and "连续超时=2" in msg for msg in eviction_logs
        ), eviction_logs

        # ② 第三次请求重新 spawn 一个新 client,而不是继续复用 stale client
        new_client = LspClient.get(ws)
        assert new_client is not client
        assert LspClient._instances[ws] is new_client
    finally:
        LspClient._instances.pop(ws, None)


async def test_success_then_single_timeout_does_not_evict() -> None:
    """反向对照:一次成功一次超时 ⇒ 不淘汰(单次抖动不得升级成回收)。"""
    ws = "ws-timeout-noevict"
    LspClient._instances.pop(ws, None)
    try:
        reader = asyncio.StreamReader()
        client = LspClient(ws)
        client.proc = _FakeProc(stdout=reader)
        LspClient._instances[ws] = client
        fired: list[tuple[str, int, float]] = []
        client.onRequestTimeout = lambda method, rid, ms: fired.append((method, rid, ms))

        read_task = asyncio.create_task(client._read_loop())
        # 第一次请求:桩在 timeoutMs 内返回合法响应。
        # 先等请求把等待中的 future 注册进 _responses,再喂帧 —— 否则读环可能
        # 先消费掉这帧(此刻还没人等待),响应会被静默丢弃。
        req_task = asyncio.create_task(
            client._request("textDocument/hover", {}, timeout=2.0)
        )
        while 1 not in client._responses:
            await asyncio.sleep(0)
        reader.feed_data(_frame({"jsonrpc": "2.0", "id": 1, "result": {"ok": True}}))
        assert await req_task == {"ok": True}

        # 第二次请求:桩不返回 ⇒ 超时(连续超时计数仅 1,不淘汰)
        with pytest.raises(RuntimeError, match="超时"):
            await client._request("textDocument/hover", {}, timeout=0.05)

        assert ws in LspClient._instances
        assert LspClient._instances[ws] is client
        assert client.is_unusable is False
        assert len(fired) == 1  # 超时事件仍上抛,但单次不触发淘汰

        reader.feed_eof()
        await asyncio.wait_for(read_task, timeout=2.0)
    finally:
        LspClient._instances.pop(ws, None)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
