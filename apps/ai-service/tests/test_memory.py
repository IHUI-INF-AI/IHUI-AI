"""memory.py 单元测试:MemoryStore 内存模式(Redis 不可用时降级)。

测试覆盖: add/get/clear/list_sessions + limit 边界 + 多会话隔离。
测试环境无 Redis,强制使用内存模式。
"""

import pytest

from app.services.memory import MemoryStore


@pytest.fixture
def store():
    """每个测试用例使用独立的 MemoryStore 实例(强制内存模式)。

    config.py 默认 redis_url="redis://localhost:6379",测试环境无 Redis,
    首次 _get_redis 会尝试连接并降级。这里直接强制内存模式,避免连接超时。
    """
    m = MemoryStore()
    m._use_redis = False
    m._redis = None
    return m


async def test_add_and_get_single_message(store):
    """add 追加一条消息,get 返回该消息。"""
    await store.add("s1", "user", "hello")
    msgs = await store.get("s1")
    assert len(msgs) == 1
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "hello"
    assert "timestamp" in msgs[0]
    assert msgs[0]["metadata"] == {}


async def test_add_with_metadata(store):
    """add 携带 metadata 时存入消息。"""
    await store.add("s1", "assistant", "hi", metadata={"model": "gpt-4"})
    msgs = await store.get("s1")
    assert msgs[0]["metadata"] == {"model": "gpt-4"}


async def test_add_multiple_messages_preserves_order(store):
    """add 多条消息,get 按追加顺序返回。"""
    await store.add("s1", "user", "first")
    await store.add("s1", "assistant", "second")
    await store.add("s1", "user", "third")
    msgs = await store.get("s1")
    assert [m["content"] for m in msgs] == ["first", "second", "third"]


async def test_get_empty_session_returns_empty_list(store):
    """get 不存在的会话返回空列表。"""
    assert await store.get("nonexistent") == []


async def test_get_with_limit_returns_last_n(store):
    """get limit=N 返回最近 N 条消息。"""
    for i in range(10):
        await store.add("s1", "user", f"msg-{i}")
    msgs = await store.get("s1", limit=3)
    assert len(msgs) == 3
    assert [m["content"] for m in msgs] == ["msg-7", "msg-8", "msg-9"]


async def test_get_limit_larger_than_count_returns_all(store):
    """get limit 大于消息总数时返回全部。"""
    await store.add("s1", "user", "a")
    await store.add("s1", "user", "b")
    msgs = await store.get("s1", limit=100)
    assert len(msgs) == 2


async def test_get_default_limit_100(store):
    """get 默认 limit=100。"""
    for i in range(105):
        await store.add("s1", "user", f"m{i}")
    msgs = await store.get("s1")
    assert len(msgs) == 100
    # 返回最近 100 条(即 m5..m104)
    assert msgs[0]["content"] == "m5"
    assert msgs[-1]["content"] == "m104"


async def test_clear_removes_session(store):
    """clear 删除指定会话的全部消息。"""
    await store.add("s1", "user", "a")
    await store.add("s1", "user", "b")
    await store.clear("s1")
    assert await store.get("s1") == []


async def test_clear_nonexistent_session_no_error(store):
    """clear 不存在的会话不报错。"""
    await store.clear("nonexistent")  # 不应抛异常


async def test_clear_does_not_affect_other_sessions(store):
    """clear 一个会话不影响其他会话。"""
    await store.add("s1", "user", "a")
    await store.add("s2", "user", "b")
    await store.clear("s1")
    assert await store.get("s1") == []
    assert len(await store.get("s2")) == 1


async def test_list_sessions_empty(store):
    """无消息时 list_sessions 返回空列表。"""
    assert await store.list_sessions() == []


async def test_list_sessions_returns_all(store):
    """list_sessions 返回所有有消息的会话 ID。"""
    await store.add("s1", "user", "a")
    await store.add("s2", "user", "b")
    await store.add("s3", "user", "c")
    sessions = await store.list_sessions()
    assert set(sessions) == {"s1", "s2", "s3"}


async def test_list_sessions_excludes_cleared(store):
    """clear 后 list_sessions 不再包含该会话。"""
    await store.add("s1", "user", "a")
    await store.add("s2", "user", "b")
    await store.clear("s1")
    sessions = await store.list_sessions()
    assert sessions == ["s2"]


async def test_multiple_sessions_isolated(store):
    """多会话消息互不干扰。"""
    await store.add("s1", "user", "from-s1")
    await store.add("s2", "user", "from-s2")
    assert len(await store.get("s1")) == 1
    assert len(await store.get("s2")) == 1
    assert (await store.get("s1"))[0]["content"] == "from-s1"
    assert (await store.get("s2"))[0]["content"] == "from-s2"


async def test_message_has_timestamp_isoformat(store):
    """每条消息含 timestamp 字段(ISO 格式字符串)。"""
    await store.add("s1", "user", "a")
    msgs = await store.get("s1")
    ts = msgs[0]["timestamp"]
    assert isinstance(ts, str)
    # ISO 8601 格式包含 'T'
    assert "T" in ts


async def test_get_redis_returns_none_in_memory_mode(store):
    """内存模式下 _get_redis 返回 None。"""
    assert await store._get_redis() is None
    assert store._use_redis is False
