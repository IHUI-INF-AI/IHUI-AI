"""SSE 事件缓冲区。

为 SSE 流式端点提供断线重连支持:
- 每个 task_id 维护一个有序事件列表(带自增 event_id)
- 客户端重连时通过 Last-Event-ID 获取缺失事件并重放
- TTL 自动过期清理(默认 5 分钟),防止内存泄漏
- 进程内内存存储(单实例足够;多实例需 Redis 替换)

用法:
    buffer = SSEEventBuffer()
    # 生产端: 写入事件
    eid = buffer.append("task-1", {"type": "chunk", "content": "hello"})
    # 消费端: 重连时重放
    missed = buffer.replay_after("task-1", last_event_id)
"""

import time
from typing import Any


class SSEEventBuffer:
    """SSE 事件缓冲区(内存 + TTL)。"""

    def __init__(self, ttl_seconds: int = 300, cleanup_interval: int = 60):
        """初始化缓冲区。

        Args:
            ttl_seconds: 事件 TTL,超过则可被清理(默认 300 秒 / 5 分钟)。
            cleanup_interval: 自动清理间隔秒数。
        """
        self._buffers: dict[str, list[dict[str, Any]]] = {}
        self._counters: dict[str, int] = {}
        self._timestamps: dict[str, float] = {}  # task_id -> 最后更新时间
        self._ttl = ttl_seconds
        self._cleanup_interval = cleanup_interval
        self._last_cleanup = time.monotonic()

    def append(self, task_id: str, event: dict[str, Any]) -> str:
        """追加事件到缓冲区,返回分配的 event_id。

        Args:
            task_id: 任务/会话标识。
            event: 事件数据(不含 event_id,内部自动分配)。

        Returns:
            分配的 event_id 字符串(格式 "{task_id}-{seq}")。
        """
        now = time.monotonic()
        # 惰性清理: 超过间隔则清理过期 task
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup()

        seq = self._counters.get(task_id, 0) + 1
        self._counters[task_id] = seq
        event_id = f"{task_id}-{seq}"

        if task_id not in self._buffers:
            self._buffers[task_id] = []
        self._buffers[task_id].append({"id": event_id, "event": event, "ts": now})
        self._timestamps[task_id] = now
        return event_id

    def replay_after(self, task_id: str, last_event_id: str | None) -> list[dict[str, Any]]:
        """获取指定 task 在 last_event_id 之后的所有事件(用于断线重连重放)。

        Args:
            task_id: 任务/会话标识。
            last_event_id: 客户端最后收到的事件 ID(Last-Event-ID header)。
                           None 表示从头重放。

        Returns:
            事件列表,每个元素为 {"id": ..., "event": ...}。
            若 task_id 不存在或已过期,返回空列表。
        """
        events = self._buffers.get(task_id, [])
        if not last_event_id:
            return [{"id": e["id"], "event": e["event"]} for e in events]

        # 找到 last_event_id 的位置,返回其后的所有事件
        for i, e in enumerate(events):
            if e["id"] == last_event_id:
                return [{"id": e2["id"], "event": e2["event"]} for e2 in events[i + 1 :]]
        # last_event_id 未找到,返回全部(保守策略)
        return [{"id": e["id"], "event": e["event"]} for e in events]

    def get_all(self, task_id: str) -> list[dict[str, Any]]:
        """获取指定 task 的全部缓冲事件。"""
        return [{"id": e["id"], "event": e["event"]} for e in self._buffers.get(task_id, [])]

    def clear(self, task_id: str) -> None:
        """清除指定 task 的缓冲区。"""
        self._buffers.pop(task_id, None)
        self._counters.pop(task_id, None)
        self._timestamps.pop(task_id, None)

    def _cleanup(self) -> None:
        """清理过期的 task 缓冲区。"""
        now = time.monotonic()
        self._last_cleanup = now
        expired = [
            tid for tid, ts in self._timestamps.items()
            if now - ts > self._ttl
        ]
        for tid in expired:
            self.clear(tid)


# 全局单例
sse_buffer = SSEEventBuffer()
