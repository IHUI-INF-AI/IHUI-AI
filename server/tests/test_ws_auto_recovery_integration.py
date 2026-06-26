"""WebSocket 自动恢复集成测试 (2026-06-26 新增).

覆盖:
- ConnectionManager 缺失属性: message_queue, total_messages, active_api_calls, processing_tasks
- _ensure_tasks_started 幂等性
- enqueue_message 行为 (正常入队 + 队列满)
- register_api_call / complete_api_call
- 队列清空 (带锁, 线程安全)
- auto_recovery 启动 / 状态报告
- _pending_tasks 任务跟踪 (项目记忆: 防止 GC 丢异常)
- active_connections / is_client_connected / remove_connection 兼容接口
- stats() 新增字段
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class TestConnectionManagerAttributes:
    """验证 ConnectionManager 暴露 auto_recovery 所需的全部属性."""

    def setup_method(self):
        # 重置单例
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    def test_has_message_queue(self):
        """必须存在 message_queue (asyncio.Queue)."""
        import asyncio as _a

        assert hasattr(self.cm, "message_queue")
        assert isinstance(self.cm.message_queue, _a.Queue)

    def test_has_total_messages_counter(self):
        assert hasattr(self.cm, "total_messages")
        assert self.cm.total_messages == 0

    def test_has_active_api_calls_dict(self):
        assert hasattr(self.cm, "active_api_calls")
        assert isinstance(self.cm.active_api_calls, dict)
        assert len(self.cm.active_api_calls) == 0

    def test_has_processing_tasks_set(self):
        assert hasattr(self.cm, "processing_tasks")
        assert isinstance(self.cm.processing_tasks, set)

    def test_has_tasks_started_flag(self):
        assert hasattr(self.cm, "_tasks_started")
        assert self.cm._tasks_started is False

    def test_has_pending_tasks_set(self):
        """项目记忆: _pending_tasks 集合防止 GC 丢异常."""
        assert hasattr(self.cm, "_pending_tasks")
        assert isinstance(self.cm._pending_tasks, set)

    def test_active_connections_property(self):
        """auto_recovery 兼容接口: active_connections 返回 _connections 字典."""
        assert isinstance(self.cm.active_connections, dict)
        assert self.cm.active_connections is self.cm._connections

    def test_is_client_connected_returns_false_for_unknown(self):
        assert self.cm.is_client_connected("nonexistent") is False

    def test_remove_connection_for_unknown(self):
        """不存在的 conn_id 移除不应抛异常."""
        import asyncio

        async def _run():
            await self.cm.remove_connection("nonexistent")

        asyncio.run(_run())


class TestEnqueueMessage:
    """测试 enqueue_message 入队逻辑."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()
        # 把 message_queue 替换为小容量队列, 加快 "满" 场景测试
        import asyncio as _a
        self.cm.queue_size = 5
        self.cm.message_queue = _a.Queue(maxsize=5)

    @pytest.mark.asyncio
    async def test_enqueue_returns_message_id(self):
        msg_id = await self.cm.enqueue_message("user", {"hello": "world"}, "u1")
        assert msg_id is not None
        assert isinstance(msg_id, str)
        assert len(msg_id) == 32  # uuid hex

    @pytest.mark.asyncio
    async def test_enqueue_increments_total(self):
        assert self.cm.total_messages == 0
        await self.cm.enqueue_message("user", {}, "u1")
        assert self.cm.total_messages == 1
        await self.cm.enqueue_message("room", {}, "r1")
        assert self.cm.total_messages == 2

    @pytest.mark.asyncio
    async def test_enqueue_message_added_to_queue(self):
        await self.cm.enqueue_message("user", {"x": 1}, "u1")
        assert self.cm.message_queue.qsize() == 1

    @pytest.mark.asyncio
    async def test_enqueue_increments_full_count_when_full(self):
        # asyncio.Queue 的 maxsize 在创建时已固定, 不能动态改.
        # 直接在队列里塞占位符达到容量上限, 再测 enqueue_message 行为.
        # 取当前 maxsize, 填满它.
        maxsize = self.cm.message_queue.maxsize
        # 同步塞入占位符 (不放进有效 enqueue, 避免消费者处理)
        for i in range(maxsize):
            self.cm.message_queue.put_nowait({"_filler": True, "i": i})
        # 队列已满, 再 enqueue 应该返回 None 且 queue_full_count 递增
        msg_id = await self.cm.enqueue_message("user", {"i": 99}, "u1")
        assert msg_id is None
        assert self.cm.queue_full_count >= 1


class TestApiCallTracking:
    """测试 register_api_call / complete_api_call."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    @pytest.mark.asyncio
    async def test_register_generates_call_id(self):
        call_id = await self.cm.register_api_call()
        assert isinstance(call_id, str)
        assert len(call_id) == 32
        assert call_id in self.cm.active_api_calls

    @pytest.mark.asyncio
    async def test_register_with_explicit_id(self):
        call_id = await self.cm.register_api_call("custom-id-123")
        assert call_id == "custom-id-123"
        assert "custom-id-123" in self.cm.active_api_calls

    @pytest.mark.asyncio
    async def test_complete_removes_call(self):
        call_id = await self.cm.register_api_call()
        await self.cm.complete_api_call(call_id)
        assert call_id not in self.cm.active_api_calls

    @pytest.mark.asyncio
    async def test_complete_unknown_id_is_noop(self):
        # 不存在的 call_id 不会抛异常
        await self.cm.complete_api_call("never-existed")


class TestBackgroundTasksLifecycle:
    """测试 start_background_tasks / stop_background_tasks 生命周期."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    @pytest.mark.asyncio
    async def test_start_sets_flag_and_creates_tasks(self):
        await self.cm.start_background_tasks()
        assert self.cm._tasks_started is True
        assert len(self.cm.processing_tasks) >= 1
        assert len(self.cm._pending_tasks) >= 1  # 心跳 reaper 也被跟踪

    @pytest.mark.asyncio
    async def test_start_is_idempotent(self):
        await self.cm.start_background_tasks()
        first_count = len(self.cm.processing_tasks)
        await self.cm.start_background_tasks()
        # 二次启动不应创建额外 task
        assert len(self.cm.processing_tasks) == first_count

    @pytest.mark.asyncio
    async def test_stop_clears_processing_tasks(self):
        await self.cm.start_background_tasks()
        await self.cm.stop_background_tasks()
        assert self.cm._tasks_started is False
        assert len(self.cm.processing_tasks) == 0

    @pytest.mark.asyncio
    async def test_ensure_tasks_started_returns_awaitable(self):
        # 返回的是 Task, await 不会出错
        task = self.cm._ensure_tasks_started()
        await task
        assert self.cm._tasks_started is True

    @pytest.mark.asyncio
    async def test_ensure_tasks_started_idempotent(self):
        await self.cm._ensure_tasks_started()
        # 第二次调用应该立即返回
        task2 = self.cm._ensure_tasks_started()
        await task2
        assert self.cm._tasks_started is True


class TestOutboxConsumer:
    """测试 _outbox_consumer 真正消费消息."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    @pytest.mark.asyncio
    async def test_consumer_drains_queue(self):
        await self.cm.start_background_tasks()
        # 入队 3 条
        for i in range(3):
            await self.cm.enqueue_message("user", {"i": i}, f"u{i}")
        # 轮询等待消费者处理完 (SLA 监控增加了处理耗时, 固定 sleep 不再可靠)
        for _ in range(50):  # 最多等 5 秒
            if self.cm.message_queue.qsize() == 0:
                break
            await asyncio.sleep(0.1)
        # 队列应清空 (target=user 但无连接, send_to 失败不影响队列)
        assert self.cm.message_queue.qsize() == 0
        await self.cm.stop_background_tasks()


class TestTrackTask:
    """测试 _track_task 任务跟踪 (项目记忆要求)."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    @pytest.mark.asyncio
    async def test_track_task_adds_to_pending(self):

        async def _noop():
            await asyncio.sleep(0.01)

        task = asyncio.create_task(_noop())
        self.cm._track_task(task)
        assert task in self.cm._pending_tasks
        await task
        # 任务完成后应被自动移除 (done_callback)
        await asyncio.sleep(0.01)
        assert task not in self.cm._pending_tasks

    @pytest.mark.asyncio
    async def test_wait_pending_tasks_returns_count(self):

        async def _long():
            await asyncio.sleep(10)

        task = asyncio.create_task(_long())
        self.cm._track_task(task)
        completed = await self.cm._wait_pending_tasks(timeout=0.5)
        assert completed == 1
        assert task not in self.cm._pending_tasks


class TestStatsExtended:
    """测试 stats() 新增字段."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    def test_stats_has_queue_fields(self):
        s = self.cm.stats()
        assert "queue_size" in s
        assert "queue_capacity" in s
        assert "queue_full_count" in s
        assert "total_messages_queued" in s

    def test_stats_has_task_fields(self):
        s = self.cm.stats()
        assert "processing_tasks" in s
        assert "pending_tasks" in s
        assert "active_api_calls" in s
        assert "background_tasks_started" in s

    def test_stats_initial_zero(self):
        s = self.cm.stats()
        assert s["queue_size"] == 0
        assert s["queue_capacity"] > 0
        assert s["processing_tasks"] == 0
        assert s["pending_tasks"] == 0
        assert s["active_api_calls"] == 0


class TestAutoRecoveryIntegration:
    """测试 auto_recovery 与 ConnectionManager 协同."""

    def setup_method(self):
        from app.ws.manager import ConnectionManager

        ConnectionManager._instance = None
        self.cm = ConnectionManager()

    @pytest.mark.asyncio
    async def test_initialize_returns_manager(self):
        from app.ws import auto_recovery

        # 重置全局状态
        auto_recovery._auto_recovery_manager = None
        mgr = await auto_recovery.initialize_auto_recovery(self.cm)
        assert mgr is not None
        # 验证 ws_manager 已启动后台任务
        assert self.cm._tasks_started is True
        # 清理
        await auto_recovery.shutdown_auto_recovery()
        auto_recovery._auto_recovery_manager = None

    @pytest.mark.asyncio
    async def test_initialize_is_idempotent(self):
        from app.ws import auto_recovery

        auto_recovery._auto_recovery_manager = None
        mgr1 = await auto_recovery.initialize_auto_recovery(self.cm)
        mgr2 = await auto_recovery.initialize_auto_recovery(self.cm)
        assert mgr1 is mgr2
        await auto_recovery.shutdown_auto_recovery()
        auto_recovery._auto_recovery_manager = None

    @pytest.mark.asyncio
    async def test_status_report_structure(self):
        from app.ws import auto_recovery

        auto_recovery._auto_recovery_manager = None
        await auto_recovery.initialize_auto_recovery(self.cm)
        status = auto_recovery.get_recovery_status()
        assert "auto_recovery" in status
        s = status["auto_recovery"]
        assert s["is_running"] is True
        assert "queue_size" in s
        assert "active_connections" in s
        assert "processing_tasks" in s
        assert "pending_tasks" in s
        await auto_recovery.shutdown_auto_recovery()
        auto_recovery._auto_recovery_manager = None

    @pytest.mark.asyncio
    async def test_clear_message_queue_thread_safe(self):
        """带锁的清空操作不应与消费者冲突."""
        from app.ws import auto_recovery

        auto_recovery._auto_recovery_manager = None
        await auto_recovery.initialize_auto_recovery(self.cm)
        # 填满队列
        for i in range(5):
            await self.cm.enqueue_message("user", {"i": i}, "u1")
        assert self.cm.message_queue.qsize() == 5
        # 触发清空
        mgr = auto_recovery._auto_recovery_manager
        dropped = await mgr._clear_message_queue()
        assert dropped == 5
        assert self.cm.message_queue.qsize() == 0
        await auto_recovery.shutdown_auto_recovery()
        auto_recovery._auto_recovery_manager = None


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
