"""SSE 事件缓冲区单元测试。

测试覆盖:
- append 分配递增 event_id
- replay_after 重放缺失事件(断线重连核心)
- replay_after None 时从头重放
- replay_after 未找到 last_event_id 时返回全部
- get_all 获取全部事件
- clear 清除 task 缓冲区
- TTL 过期清理(通过短 TTL 验证)
- 全局 sse_buffer 单例
"""

from __future__ import annotations

import time

from app.core.sse_buffer import SSEEventBuffer, sse_buffer


# =============================================================================
# append
# =============================================================================


def test_append_returns_incremental_event_id():
    """append 返回递增的 event_id。"""
    buf = SSEEventBuffer()
    eid1 = buf.append("task-1", {"type": "chunk", "content": "a"})
    eid2 = buf.append("task-1", {"type": "chunk", "content": "b"})
    eid3 = buf.append("task-1", {"type": "done"})

    assert eid1 == "task-1-1"
    assert eid2 == "task-1-2"
    assert eid3 == "task-1-3"


def test_append_separate_tasks_have_independent_counters():
    """不同 task_id 的计数器独立。"""
    buf = SSEEventBuffer()
    eid_a = buf.append("task-a", {"type": "start"})
    eid_b = buf.append("task-b", {"type": "start"})
    eid_a2 = buf.append("task-a", {"type": "chunk"})

    assert eid_a == "task-a-1"
    assert eid_b == "task-b-1"
    assert eid_a2 == "task-a-2"


def test_append_stores_event_data():
    """append 存储事件数据,可通过 get_all 检索。"""
    buf = SSEEventBuffer()
    buf.append("task-1", {"type": "chunk", "content": "hello"})

    events = buf.get_all("task-1")
    assert len(events) == 1
    assert events[0]["event"]["content"] == "hello"
    assert events[0]["id"] == "task-1-1"


# =============================================================================
# replay_after (断线重连核心)
# =============================================================================


def test_replay_after_none_returns_all_events():
    """last_event_id=None 时从头重放所有事件。"""
    buf = SSEEventBuffer()
    buf.append("task-1", {"type": "start"})
    buf.append("task-1", {"type": "chunk", "content": "a"})
    buf.append("task-1", {"type": "chunk", "content": "b"})
    buf.append("task-1", {"type": "done"})

    missed = buf.replay_after("task-1", None)
    assert len(missed) == 4
    assert missed[0]["event"]["type"] == "start"
    assert missed[-1]["event"]["type"] == "done"


def test_replay_after_specific_event_id():
    """replay_after 返回指定 event_id 之后的事件。"""
    buf = SSEEventBuffer()
    buf.append("task-1", {"type": "start"})
    eid2 = buf.append("task-1", {"type": "chunk", "content": "a"})
    buf.append("task-1", {"type": "chunk", "content": "b"})
    buf.append("task-1", {"type": "done"})

    missed = buf.replay_after("task-1", eid2)
    assert len(missed) == 2
    assert missed[0]["event"]["content"] == "b"
    assert missed[1]["event"]["type"] == "done"


def test_replay_after_last_event_returns_empty():
    """replay_after 传入最后一个 event_id 时返回空列表。"""
    buf = SSEEventBuffer()
    buf.append("task-1", {"type": "start"})
    buf.append("task-1", {"type": "done"})
    last_eid = buf.append("task-1", {"type": "final"})

    missed = buf.replay_after("task-1", last_eid)
    assert missed == []


def test_replay_after_unknown_event_id_returns_all():
    """replay_after 传入不存在的 event_id 时返回全部(保守策略)。"""
    buf = SSEEventBuffer()
    buf.append("task-1", {"type": "start"})
    buf.append("task-1", {"type": "done"})

    missed = buf.replay_after("task-1", "task-1-999")
    assert len(missed) == 2


def test_replay_after_unknown_task_returns_empty():
    """replay_after 传入不存在的 task_id 时返回空列表。"""
    buf = SSEEventBuffer()
    missed = buf.replay_after("nonexistent", None)
    assert missed == []


def test_replay_after_preserves_event_ids():
    """replay_after 返回的事件保留原始 event_id。"""
    buf = SSEEventBuffer()
    eid1 = buf.append("task-1", {"type": "start"})
    eid2 = buf.append("task-1", {"type": "chunk", "content": "a"})
    eid3 = buf.append("task-1", {"type": "done"})

    missed = buf.replay_after("task-1", eid1)
    assert len(missed) == 2
    assert missed[0]["id"] == eid2
    assert missed[1]["id"] == eid3


# =============================================================================
# get_all
# =============================================================================


def test_get_all_empty_task():
    """get_all 不存在的 task 返回空列表。"""
    buf = SSEEventBuffer()
    assert buf.get_all("nonexistent") == []


def test_get_all_returns_all_events_with_ids():
    """get_all 返回所有事件含 id 和 event 字段。"""
    buf = SSEEventBuffer()
    buf.append("task-1", {"type": "start"})
    buf.append("task-1", {"type": "done"})

    events = buf.get_all("task-1")
    assert len(events) == 2
    assert "id" in events[0]
    assert "event" in events[0]
    assert events[0]["event"]["type"] == "start"
    assert events[1]["event"]["type"] == "done"


# =============================================================================
# clear
# =============================================================================


def test_clear_removes_task():
    """clear 清除指定 task 的所有事件。"""
    buf = SSEEventBuffer()
    buf.append("task-1", {"type": "start"})
    buf.append("task-1", {"type": "done"})

    buf.clear("task-1")

    assert buf.get_all("task-1") == []
    # clear 后 append 从 1 重新计数
    eid = buf.append("task-1", {"type": "start"})
    assert eid == "task-1-1"


def test_clear_nonexistent_task_no_error():
    """clear 不存在的 task 不报错。"""
    buf = SSEEventBuffer()
    buf.clear("nonexistent")  # 不应抛异常


# =============================================================================
# TTL 过期清理
# =============================================================================


def test_ttl_cleanup_removes_expired_tasks():
    """TTL 过期后 append 触发清理,移除过期 task。"""
    buf = SSEEventBuffer(ttl_seconds=1, cleanup_interval=0)  # 立即触发清理
    buf.append("task-old", {"type": "start"})

    # 等待 TTL 过期
    time.sleep(1.1)

    # 再次 append 触发惰性清理
    buf.append("task-new", {"type": "start"})

    # task-old 应被清理
    assert buf.get_all("task-old") == []
    # task-new 仍在
    assert len(buf.get_all("task-new")) == 1


def test_ttl_keeps_recent_tasks():
    """TTL 未过期的 task 不被清理。"""
    buf = SSEEventBuffer(ttl_seconds=10, cleanup_interval=0)
    buf.append("task-recent", {"type": "start"})

    time.sleep(0.1)

    # append 另一个 task 触发清理
    buf.append("task-other", {"type": "start"})

    # task-recent 仍在(TTL 未过期)
    assert len(buf.get_all("task-recent")) == 1


# =============================================================================
# 全局单例
# =============================================================================


def test_global_sse_buffer_instance():
    """全局 sse_buffer 实例存在且为 SSEEventBuffer 类型。"""
    assert sse_buffer is not None
    assert isinstance(sse_buffer, SSEEventBuffer)


def test_global_sse_buffer_shared():
    """多次引用 sse_buffer 返回同一实例。"""
    from app.core.sse_buffer import sse_buffer as buf1
    from app.core.sse_buffer import sse_buffer as buf2
    assert buf1 is buf2


# =============================================================================
# 集成场景:模拟断线重连流程
# =============================================================================


def test_integration_reconnect_replay_scenario():
    """集成测试:模拟完整的断线重连重放流程。

    场景:
    1. 客户端连接,服务端发送 4 个事件(start, chunk, chunk, done)
    2. 客户端在第 2 个事件后断线(收到 task-1-2)
    3. 客户端重连,发送 Last-Event-ID: task-1-2
    4. 服务端重放 task-1-3 和 task-1-4
    """
    buf = SSEEventBuffer()

    # 1. 服务端发送事件
    eid1 = buf.append("task-1", {"type": "start", "task_id": "task-1"})
    eid2 = buf.append("task-1", {"type": "chunk", "content": "Hello"})
    eid3 = buf.append("task-1", {"type": "chunk", "content": " world"})
    eid4 = buf.append("task-1", {"type": "done", "task_id": "task-1"})

    assert eid1 == "task-1-1"
    assert eid2 == "task-1-2"
    assert eid3 == "task-1-3"
    assert eid4 == "task-1-4"

    # 2. 客户端在 eid2 后断线,重连时传入 Last-Event-ID: task-1-2
    missed = buf.replay_after("task-1", "task-1-2")

    # 3. 应收到 task-1-3 和 task-1-4
    assert len(missed) == 2
    assert missed[0]["id"] == "task-1-3"
    assert missed[0]["event"]["content"] == " world"
    assert missed[1]["id"] == "task-1-4"
    assert missed[1]["event"]["type"] == "done"
