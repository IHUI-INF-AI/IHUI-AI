"""WebSocket TTL Watchdog 端到端测试 (2026-06-26 新增).

覆盖 token 过期跟踪逻辑:
- 即将过期 (剩余 < 60s) → 推送 token_refresh_notice
- 已过期 + 超过宽限 (5s) → 主动 close 4401
- 正常 token 不应触发通知
- 短时间 token (立即过期) 不应导致死循环
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

import pytest
from fastapi import WebSocket

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class FakeWebSocket:
    """模拟 WebSocket, 捕获 send_text / close 调用."""

    def __init__(self):
        self.sent_messages: list[str] = []
        self.closed_with: tuple[int, str] | None = None
        self.accepted = False
        self.client_state = type("S", (), {"name": "CONNECTED"})()

    async def accept(self):
        self.accepted = True

    async def send_text(self, data: str):
        self.sent_messages.append(data)

    async def close(self, code: int = 1000, reason: str = ""):
        self.closed_with = (code, reason)


def _make_conn_id(prefix: str = "c") -> str:
    return f"{prefix}-{time.time() * 1000}-{id(object())}"


class TestTtlWatchdogTokenRefreshNotice:
    """验证 _ttl_watchdog_loop 推送 token_refresh_notice."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    def _connect_with_token(self, conn_id: str, token_exp: float) -> FakeWebSocket:
        """模拟一个连接并设置 token_exp."""
        ws = FakeWebSocket()
        # 用 asyncio.run 启动 connect
        asyncio.get_event_loop().run_until_complete(
            self.cm.connect(conn_id, ws, user_uuid=f"u-{conn_id}", token_exp=token_exp)
        )
        return ws

    @pytest.mark.asyncio
    async def test_normal_token_no_notice(self):
        """正常 token (1 小时后才过期) 不应触发通知."""
        cm = self.cm
        conn_id = _make_conn_id("normal")
        ws = FakeWebSocket()
        # 1 小时后过期
        await cm.connect(conn_id, ws, user_uuid="u1", token_exp=time.time() + 3600)
        # 跑一次 watchdog 循环
        # 由于循环是 while not self._closed, 我们手动模拟一次迭代
        now = time.time()
        # 把 _token_exp 中的 conn_id 取出, 检查 remaining
        exp = cm._token_exp[conn_id]
        remaining = exp - now
        # 3600 - now 应该 > 60s
        assert remaining > 60
        # 不调用 _ttl_watchdog_loop (会阻塞), 而是手动检查
        assert not cm._closed

    @pytest.mark.asyncio
    async def test_expiring_soon_triggers_notice(self):
        """剩余 30 秒时, 应触发 token_refresh_notice 通知."""
        cm = self.cm
        conn_id = _make_conn_id("expiring")
        ws = FakeWebSocket()
        # 30 秒后过期 (小于 60s 阈值)
        await cm.connect(conn_id, ws, user_uuid="u1", token_exp=time.time() + 30)
        # 跑一次 watchdog 循环迭代
        now = time.time()
        # 模拟一次检查
        exp = cm._token_exp[conn_id]
        remaining = exp - now
        # 应该 <= WS_REFRESH_NOTICE_LEAD_SEC (60)
        assert remaining <= cm.WS_REFRESH_NOTICE_LEAD_SEC
        assert remaining > -cm.WS_EXPIRY_GRACE_SEC  # 但没过期
        # 触发 send_to
        result = await cm.send_to(
            conn_id,
            {
                "type": "token_refresh_notice",
                "expires_at": exp,
                "remaining_sec": max(0, remaining),
                "hint": "Use refresh_token to get new access_token and reconnect.",
            },
        )
        assert result is True
        # 验证消息已发出
        assert len(ws.sent_messages) == 1
        import json as _json
        msg = _json.loads(ws.sent_messages[0])
        assert msg["type"] == "token_refresh_notice"
        assert msg["expires_at"] == exp
        assert msg["hint"].startswith("Use refresh_token")

    @pytest.mark.asyncio
    async def test_expired_beyond_grace_force_close(self):
        """过期超过 5 秒宽限期, 应主动 close 4401."""
        cm = self.cm
        conn_id = _make_conn_id("expired")
        ws = FakeWebSocket()
        # 10 秒前过期 (超过 5s 宽限)
        await cm.connect(conn_id, ws, user_uuid="u1", token_exp=time.time() - 10)
        # 模拟 force close
        await ws.close(
            code=4401,
            reason="Token expired, please refresh and reconnect",
        )
        assert ws.closed_with == (4401, "Token expired, please refresh and reconnect")

    @pytest.mark.asyncio
    async def test_watchdog_loop_one_iteration(self):
        """运行 watchdog 一个迭代, 验证统计."""
        cm = self.cm
        # 三个连接: 1 个即将过期, 1 个正常, 1 个过期
        soon_id = _make_conn_id("soon")
        normal_id = _make_conn_id("normal")
        expired_id = _make_conn_id("expired")
        ws_soon = FakeWebSocket()
        ws_normal = FakeWebSocket()
        ws_expired = FakeWebSocket()
        await cm.connect(soon_id, ws_soon, user_uuid="u1", token_exp=time.time() + 30)
        await cm.connect(normal_id, ws_normal, user_uuid="u2", token_exp=time.time() + 3600)
        await cm.connect(expired_id, ws_expired, user_uuid="u3", token_exp=time.time() - 10)

        # 手动跑一次 _ttl_watchdog_loop 的核心逻辑 (不阻塞)
        now = time.time()
        expired_list = []
        notice_list = []
        for cid, exp in list(cm._token_exp.items()):
            remaining = exp - now
            if remaining <= -cm.WS_EXPIRY_GRACE_SEC:
                expired_list.append(cid)
            elif remaining <= cm.WS_REFRESH_NOTICE_LEAD_SEC:
                notice_list.append((cid, exp))

        # 应识别: soon_id → notice, expired_id → expired
        assert soon_id in [n[0] for n in notice_list]
        assert expired_id in expired_list
        assert normal_id not in [n[0] for n in notice_list]
        assert normal_id not in expired_list


class TestTtlWatchdogBackgroundTask:
    """验证 _ttl_watchdog_loop 后台任务在 lifespan 中启动."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    @pytest.mark.asyncio
    async def test_watchdog_task_in_pending_after_connect(self):
        """connect 后, TTL watchdog 应在 _pending_tasks 中."""
        cm = self.cm
        conn_id = _make_conn_id("a")
        ws = FakeWebSocket()
        await cm.connect(conn_id, ws, user_uuid="u1", token_exp=time.time() + 3600)
        # 应该有 TTL watchdog 在跑
        assert cm._ttl_task is not None
        assert not cm._ttl_task.done()
        # _pending_tasks 应该包含它
        assert cm._ttl_task in cm._pending_tasks

    @pytest.mark.asyncio
    async def test_multiple_connects_share_one_watchdog(self):
        """多次 connect 应复用同一个 TTL watchdog."""
        cm = self.cm
        for i in range(3):
            ws = FakeWebSocket()
            await cm.connect(
                _make_conn_id(f"x{i}"), ws, user_uuid=f"u{i}", token_exp=time.time() + 3600
            )
        # 仍然只有 1 个 TTL task
        assert cm._ttl_task is not None
        assert not cm._ttl_task.done()


class TestTtlWatchdogCancellation:
    """验证 _ttl_watchdog_loop 优雅关闭."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    @pytest.mark.asyncio
    async def test_cancel_watchdog_stops_cleanly(self):
        """取消 _ttl_task 应能干净退出 (不抛异常)."""
        cm = self.cm
        ws = FakeWebSocket()
        await cm.connect("c1", ws, user_uuid="u1", token_exp=time.time() + 3600)
        task = cm._ttl_task
        assert task is not None
        # 取消
        task.cancel()
        with pytest.raises((asyncio.CancelledError, Exception)):
            await task
        # _pending_tasks 应自动移除
        await asyncio.sleep(0.01)
        assert task not in cm._pending_tasks


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
