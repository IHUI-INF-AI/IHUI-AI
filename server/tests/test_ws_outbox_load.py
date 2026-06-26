"""WebSocket 出箱队列压测 (2026-06-26 新增).

验证 _clear_message_queue 锁的正确性:
- 1500+ 消息/秒 入队 (远超正常负载)
- 消费者并发处理时, 清空操作不应丢锁
- queue_full_count 正确递增
- total_messages 计数正确
- 压测后无内存泄漏 (set 全部清空)
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class FakeWebSocket:
    def __init__(self):
        self.sent: list[str] = []
        self.closed = False
        self.client_state = type("S", (), {"name": "CONNECTED"})()

    async def accept(self):
        pass

    async def send_text(self, data: str):
        self.sent.append(data)

    async def close(self, code: int = 1000, reason: str = ""):
        self.closed = True


class TestOutboxQueueBurst:
    """测试出箱队列突发入队 + 锁的清空."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()
        # 改为小容量, 方便测试 "队列满" 路径
        import asyncio as _a
        self.cm.queue_size = 100
        self.cm.message_queue = _a.Queue(maxsize=100)

    @pytest.mark.asyncio
    async def test_1500_messages_per_second(self):
        """1500 条消息/秒入队, 验证 total_messages / queue_full_count 正确."""
        cm = self.cm
        sent = 0
        full = 0
        start = time.time()
        # 持续 1 秒, 1500+ 条
        target_count = 1500
        for i in range(target_count):
            msg_id = await cm.enqueue_message("user", {"i": i, "payload": "x" * 50}, "u1")
            if msg_id is None:
                full += 1
            else:
                sent += 1
        elapsed = time.time() - start
        rate = sent / max(elapsed, 0.001)
        # 验证吞吐量
        assert rate >= 500, f"吞吐量过低: {rate:.0f} msg/s"
        # 验证计数
        assert cm.total_messages == sent
        assert cm.queue_full_count == full
        assert sent + full == target_count
        print(f"\n  [burst] {target_count} msgs in {elapsed:.2f}s = {rate:.0f} msg/s, full={full}")


class TestOutboxQueueWithConsumer:
    """测试 outbox 消费者 + 压测组合."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()
        import asyncio as _a
        self.cm.queue_size = 200
        self.cm.message_queue = _a.Queue(maxsize=200)
        # Mock _publish 避免真实 redis 超时拖慢测试
        async def _noop_publish(channel_suffix, body):
            return None
        self.cm._publish = _noop_publish

    @pytest.mark.asyncio
    async def test_consumer_drains_1500_messages(self):
        """消费者在合理时间内清空 1500 条消息 (mock _publish 避免 redis 超时)."""
        cm = self.cm
        # 启动后台任务 (消费者)
        await cm.start_background_tasks()
        # 启动一个真实连接, 让 send_to_user 有目标
        ws = FakeWebSocket()
        await cm.connect("c1", ws, user_uuid="u1", token_exp=time.time() + 3600)
        # 入队 1500 条
        start = time.time()
        sent = 0
        for i in range(1500):
            msg_id = await cm.enqueue_message("user", {"i": i, "data": "x" * 20}, "u1")
            if msg_id is not None:
                sent += 1
        elapsed = time.time() - start
        # 等待消费者处理 (mock _publish 后会很快)
        await asyncio.sleep(2.0)
        # 队列应清空
        assert cm.message_queue.qsize() == 0, f"队列未清空: {cm.message_queue.qsize()}"
        await cm.stop_background_tasks()
        rate = sent / max(elapsed, 0.001)
        # 验证 ws 收到了消息
        assert len(ws.sent) > 0, f"ws 未收到消息: {len(ws.sent)}"
        print(f"\n  [producer-consumer] {sent} msgs in {elapsed:.2f}s = {rate:.0f} msg/s, ws_sent={len(ws.sent)}")


class TestClearMessageQueueLockSafety:
    """测试 _clear_message_queue 锁的并发安全性."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()
        import asyncio as _a
        self.cm.queue_size = 50
        self.cm.message_queue = _a.Queue(maxsize=50)

    @pytest.mark.asyncio
    async def test_concurrent_clear_no_race(self):
        """多个并发的清空调用应互斥执行."""
        from app.ws import auto_recovery

        auto_recovery._auto_recovery_manager = None
        mgr = auto_recovery.WebSocketAutoRecoveryManager(self.cm)
        # 塞 50 条
        for i in range(50):
            await self.cm.enqueue_message("user", {"i": i}, "u1")
        assert self.cm.message_queue.qsize() == 50

        # 并发 10 个清空, 应互斥 (锁住)
        results = await asyncio.gather(
            *[mgr._clear_message_queue() for _ in range(10)]
        )
        total_dropped = sum(results)
        # 总清空数应 = 50 (锁保证不重复清)
        assert total_dropped == 50
        # 队列应空
        assert self.cm.message_queue.qsize() == 0
        print(f"\n  [concurrent-clear] dropped={total_dropped} (10 concurrent)")


class TestOutboxQueueMemoryLeak:
    """压测后无内存泄漏."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()
        import asyncio as _a
        self.cm.queue_size = 50
        self.cm.message_queue = _a.Queue(maxsize=50)
        # Mock _publish 避免真实 redis 超时
        async def _noop_publish(channel_suffix, body):
            return None
        self.cm._publish = _noop_publish

    @pytest.mark.asyncio
    async def test_long_run_no_memory_leak(self):
        """持续 1.5 秒压测, _pending_tasks / processing_tasks 不应无限增长."""
        cm = self.cm
        await cm.start_background_tasks()
        # 启动一个真实连接, 让消费者有目标
        ws = FakeWebSocket()
        await cm.connect("c1", ws, user_uuid="u1", token_exp=time.time() + 3600)
        start = time.time()
        i = 0
        while time.time() - start < 1.5:
            await cm.enqueue_message("user", {"i": i}, "u1")
            i += 1
        # 压测后统计
        processing_count = len(cm.processing_tasks)
        pending_count = len(cm._pending_tasks)
        await cm.stop_background_tasks()
        # 应该有消费者 + 心跳 reaper = 2 个以内
        assert processing_count <= 2, f"processing_tasks 泄漏: {processing_count}"
        assert pending_count <= 5, f"_pending_tasks 泄漏: {pending_count}"
        # total_messages 不应为零
        assert cm.total_messages > 0
        print(f"\n  [mem-leak] 1.5s burst: total_msgs={cm.total_messages}, processing={processing_count}, pending={pending_count}")


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
