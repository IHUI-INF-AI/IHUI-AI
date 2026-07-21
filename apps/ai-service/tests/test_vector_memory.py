"""向量记忆存储单元测试。

测试覆盖:
- _cosine_similarity 余弦相似度计算
- VectorMemoryStore add(生成嵌入)/search(语义检索)/get_all/clear/count
- 跨会话搜索 + 限定会话搜索
- 空存储搜索
- top_k 限制
- 全局 vector_memory 单例
- embed 方法(stub 模式确定性向量)
"""

from __future__ import annotations

import math

import pytest

from app.core.llm_gateway import LLMGateway
from app.services.vector_memory import VectorMemoryStore, _cosine_similarity, vector_memory


# =============================================================================
# _cosine_similarity
# =============================================================================


def test_cosine_similarity_identical_vectors():
    """相同向量的相似度为 1.0。"""
    v = [1.0, 2.0, 3.0]
    assert _cosine_similarity(v, v) == pytest.approx(1.0)


def test_cosine_similarity_orthogonal_vectors():
    """正交向量的相似度为 0.0。"""
    a = [1.0, 0.0]
    b = [0.0, 1.0]
    assert _cosine_similarity(a, b) == pytest.approx(0.0)


def test_cosine_similarity_empty_vectors():
    """空向量返回 0.0。"""
    assert _cosine_similarity([], []) == 0.0


def test_cosine_similarity_different_length():
    """不同长度向量返回 0.0。"""
    assert _cosine_similarity([1.0, 2.0], [1.0]) == 0.0


def test_cosine_similarity_zero_vector():
    """零向量返回 0.0。"""
    assert _cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_cosine_similarity_opposite_vectors():
    """相反向量的相似度为 -1.0。"""
    a = [1.0, 0.0]
    b = [-1.0, 0.0]
    assert _cosine_similarity(a, b) == pytest.approx(-1.0)


# =============================================================================
# VectorMemoryStore - add
# =============================================================================


async def test_vector_memory_add_stores_message():
    """add 存储消息(含嵌入向量)。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "你好世界")

    assert store.count() == 1
    all_msgs = store.get_all()
    assert all_msgs[0]["content"] == "你好世界"
    assert all_msgs[0]["role"] == "user"
    assert all_msgs[0]["session_id"] == "session-1"
    assert "timestamp" in all_msgs[0]


async def test_vector_memory_add_generates_embedding():
    """add 生成嵌入向量(stub 模式 384 维)。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "test")

    # 内部存储含 embedding 字段
    assert len(store._store) == 1
    assert len(store._store[0]["embedding"]) == 384


async def test_vector_memory_add_with_metadata():
    """add 支持 metadata。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "assistant", "回复", metadata={"step": 1})

    all_msgs = store.get_all()
    assert all_msgs[0]["metadata"] == {"step": 1}


async def test_vector_memory_add_multiple_messages():
    """add 多条消息,count 递增。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "消息1")
    await store.add("session-1", "assistant", "回复1")
    await store.add("session-2", "user", "消息2")

    assert store.count() == 3
    assert store.count("session-1") == 2
    assert store.count("session-2") == 1


# =============================================================================
# VectorMemoryStore - search
# =============================================================================


async def test_vector_memory_search_empty_store():
    """空存储搜索返回空列表。"""
    store = VectorMemoryStore(LLMGateway())
    results = await store.search("test")
    assert results == []


async def test_vector_memory_search_returns_results():
    """搜索返回结果列表。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "如何配置 Redis 缓存")
    await store.add("session-1", "assistant", "Redis 配置方法如下...")

    results = await store.search("Redis 配置", top_k=2)
    assert len(results) <= 2
    assert all("score" in r for r in results)
    assert all("content" in r for r in results)
    assert all("session_id" in r for r in results)


async def test_vector_memory_search_results_sorted_by_score():
    """搜索结果按相似度降序排列。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "Redis 配置")
    await store.add("session-1", "user", "完全无关的内容")
    await store.add("session-1", "user", "Redis 缓存设置")

    results = await store.search("Redis", top_k=3)
    scores = [r["score"] for r in results]
    assert scores == sorted(scores, reverse=True)


async def test_vector_memory_search_top_k_limit():
    """top_k 限制返回数量。"""
    store = VectorMemoryStore(LLMGateway())
    for i in range(10):
        await store.add("session-1", "user", f"消息 {i}")

    results = await store.search("消息", top_k=3)
    assert len(results) <= 3


async def test_vector_memory_search_filter_by_session():
    """session_id 过滤:只在指定会话内搜索。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-a", "user", "Redis 配置")
    await store.add("session-b", "user", "Redis 配置")

    results = await store.search("Redis", top_k=5, session_id="session-a")
    assert all(r["session_id"] == "session-a" for r in results)
    assert len(results) == 1


async def test_vector_memory_search_cross_session():
    """无 session_id 时跨所有会话搜索。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-a", "user", "Redis 配置")
    await store.add("session-b", "user", "Redis 缓存")

    results = await store.search("Redis", top_k=5)
    session_ids = {r["session_id"] for r in results}
    assert "session-a" in session_ids
    assert "session-b" in session_ids


async def test_vector_memory_search_results_no_embedding():
    """搜索结果不含 embedding 字段(安全)。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "test")

    results = await store.search("test")
    assert all("embedding" not in r for r in results)


async def test_vector_memory_search_same_query_high_score():
    """相同文本搜索时相似度最高(接近 1.0)。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "如何安装 Python")

    results = await store.search("如何安装 Python", top_k=1)
    assert len(results) == 1
    # stub 模式下相同文本生成相同向量,相似度应为 1.0
    assert results[0]["score"] == pytest.approx(1.0, abs=0.001)


# =============================================================================
# VectorMemoryStore - get_all
# =============================================================================


def test_vector_memory_get_all_empty():
    """空存储 get_all 返回空列表。"""
    store = VectorMemoryStore(LLMGateway())
    assert store.get_all() == []


async def test_vector_memory_get_all_returns_all_without_embeddings():
    """get_all 返回所有消息但不含 embedding。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "消息1")
    await store.add("session-1", "assistant", "回复1")

    all_msgs = store.get_all()
    assert len(all_msgs) == 2
    assert all("embedding" not in m for m in all_msgs)


async def test_vector_memory_get_all_filter_by_session():
    """get_all 支持按 session_id 过滤。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-a", "user", "消息1")
    await store.add("session-b", "user", "消息2")

    result = store.get_all("session-a")
    assert len(result) == 1
    assert result[0]["session_id"] == "session-a"


# =============================================================================
# VectorMemoryStore - clear
# =============================================================================


async def test_vector_memory_clear_all():
    """clear() 无参数清除全部。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "消息1")
    await store.add("session-2", "user", "消息2")

    store.clear()
    assert store.count() == 0


async def test_vector_memory_clear_specific_session():
    """clear(session_id) 只清除指定会话。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "消息1")
    await store.add("session-2", "user", "消息2")

    store.clear("session-1")
    assert store.count() == 1
    assert store.count("session-1") == 0
    assert store.count("session-2") == 1


async def test_vector_memory_clear_nonexistent_session():
    """clear 不存在的 session 不报错。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-1", "user", "消息1")

    store.clear("nonexistent")
    assert store.count() == 1


# =============================================================================
# VectorMemoryStore - count
# =============================================================================


def test_vector_memory_count_empty():
    """空存储 count 返回 0。"""
    store = VectorMemoryStore(LLMGateway())
    assert store.count() == 0


async def test_vector_memory_count_with_session_filter():
    """count 支持按 session_id 过滤。"""
    store = VectorMemoryStore(LLMGateway())
    await store.add("session-a", "user", "消息1")
    await store.add("session-a", "user", "消息2")
    await store.add("session-b", "user", "消息3")

    assert store.count() == 3
    assert store.count("session-a") == 2
    assert store.count("session-b") == 1
    assert store.count("nonexistent") == 0


# =============================================================================
# 全局单例
# =============================================================================


def test_global_vector_memory_instance():
    """全局 vector_memory 实例存在且为 VectorMemoryStore 类型。"""
    assert vector_memory is not None
    assert isinstance(vector_memory, VectorMemoryStore)


def test_global_vector_memory_shared():
    """多次引用 vector_memory 返回同一实例。"""
    from app.services.vector_memory import vector_memory as vm1
    from app.services.vector_memory import vector_memory as vm2
    assert vm1 is vm2


# =============================================================================
# LLMGateway.embed
# =============================================================================


async def test_embed_stub_returns_deterministic_vector(monkeypatch):
    """stub 模式 embed 返回确定性向量(相同文本相同向量)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    gw = LLMGateway()
    v1 = await gw.embed("hello")
    v2 = await gw.embed("hello")

    assert len(v1) == 384
    assert v1 == v2  # 确定性
    assert all(isinstance(x, float) for x in v1)


async def test_embed_stub_different_text_different_vector(monkeypatch):
    """stub 模式不同文本生成不同向量。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    gw = LLMGateway()
    v1 = await gw.embed("hello")
    v2 = await gw.embed("world")

    assert v1 != v2


async def test_embed_stub_vector_values_in_range(monkeypatch):
    """stub 模式向量值在 [0, 1) 范围内。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    gw = LLMGateway()
    v = await gw.embed("test")
    assert all(0.0 <= x < 1.0 for x in v)


# =============================================================================
# Redis 持久化(G4 — 进程重启不丢)
# =============================================================================


class _FakeRedis:
    """最小可用的 Redis 替身,仅支持本测试用例用到的子集。

    方法用 sync 形式(内部用 sync 容器),与真 redis.asyncio 接口兼容
    (测试代码可 await 它们,因 sync 函数的返回值是普通值不是 coroutine,
    实际 await 的是 _FakePipeline.execute 这种 async 函数)。
    """

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.sets: dict[str, set[str]] = {}

    async def ping(self) -> bool:
        return True

    async def smembers(self, key: str) -> set[str]:
        return set(self.sets.get(key, set()))

    async def mget(self, keys: list[str]) -> list[str | None]:
        return [self.store.get(k) for k in keys]

    def delete(self, *keys: str) -> int:
        n = 0
        for k in keys:
            if k in self.sets:
                del self.sets[k]
                n += 1
            if k in self.store:
                del self.store[k]
                n += 1
        return n

    # 下列方法供 _FakePipeline 内部同步调用,接口签名与 redis-py 一致
    def sadd(self, key: str, *values: str) -> int:
        before = len(self.sets.get(key, set()))
        self.sets.setdefault(key, set()).update(values)
        return len(self.sets[key]) - before

    def srem(self, key: str, *values: str) -> int:
        before = len(self.sets.get(key, set()))
        for v in values:
            self.sets.get(key, set()).discard(v)
        return before - len(self.sets.get(key, set()))

    def set(self, key: str, value: str) -> bool:
        self.store[key] = value
        return True

    def pipeline(self) -> "_FakePipeline":
        return _FakePipeline(self)


class _FakePipeline:
    def __init__(self, redis: "_FakeRedis") -> None:
        self._redis = redis
        self._ops: list[tuple[str, tuple]] = []

    def sadd(self, key: str, *values: str) -> "_FakePipeline":
        self._ops.append(("sadd", (key, *values)))
        return self

    def srem(self, key: str, *values: str) -> "_FakePipeline":
        self._ops.append(("srem", (key, *values)))
        return self

    def set(self, key: str, value: str) -> "_FakePipeline":
        self._ops.append(("set", (key, value)))
        return self

    def delete(self, key: str) -> "_FakePipeline":
        self._ops.append(("delete", (key,)))
        return self

    async def execute(self) -> list:
        # 同步执行所有 op(redis pipeline 行为:在一次 round-trip 内串行执行并返回结果数组)
        results = []
        for op, args in self._ops:
            method = getattr(self._redis, op)
            results.append(method(*args))
        self._ops.clear()
        return results


def _make_redis_store(monkeypatch) -> tuple[VectorMemoryStore, _FakeRedis]:
    """构造一个使用 _FakeRedis 持久化的 store。"""
    fake = _FakeRedis()
    from app.services import vector_memory as vm_mod
    monkeypatch.setattr(vm_mod.aioredis, "from_url", lambda *a, **kw: fake)
    store = VectorMemoryStore(LLMGateway(), redis_url="redis://fake:6379/0")
    return store, fake


def test_redis_url_unset_uses_settings_default(monkeypatch):
    """不传 redis_url 时,使用 settings.redis_url(正常持久化模式)。"""
    from app.services import vector_memory as vm_mod
    fake = _FakeRedis()
    monkeypatch.setattr(vm_mod.aioredis, "from_url", lambda *a, **kw: fake)
    from app.core.config import settings
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379/0")

    store = VectorMemoryStore(LLMGateway())
    assert store._redis_url == "redis://localhost:6379/0"
    assert store._use_redis is True


def test_redis_url_explicit_none_forces_memory_mode():
    """显式传 None 时强制纯内存模式(测试/临时禁用)。"""
    store = VectorMemoryStore(LLMGateway(), redis_url=None)
    assert store._redis_url is None
    assert store._use_redis is False


def test_redis_url_explicit_string_uses_that_url():
    """显式传字符串时使用该 URL。"""
    store = VectorMemoryStore(LLMGateway(), redis_url="redis://other:6380/1")
    assert store._redis_url == "redis://other:6380/1"
    assert store._use_redis is True


async def test_redis_add_flushes_to_redis(monkeypatch):
    """add 时同步写入 Redis(set + sadd)。"""
    store, fake = _make_redis_store(monkeypatch)
    await store.add("s1", "user", "hello")

    # 内存写入
    assert store.count() == 1
    # Redis 同步刷新
    assert "1" in fake.sets.get("vec:memory:ids", set())
    assert "vec:memory:entry:1" in fake.store
    payload = fake.store["vec:memory:entry:1"]
    import json as _json
    parsed = _json.loads(payload)
    assert parsed["content"] == "hello"
    assert parsed["session_id"] == "s1"
    assert isinstance(parsed["embedding"], list)


async def test_redis_hydrate_loads_existing_entries(monkeypatch):
    """hydrate 从 Redis 加载历史 entry,新 store 实例能续上数据。"""
    fake = _FakeRedis()
    from app.services import vector_memory as vm_mod
    monkeypatch.setattr(vm_mod.aioredis, "from_url", lambda *a, **kw: fake)

    store1 = VectorMemoryStore(LLMGateway(), redis_url="redis://fake:6379/0")
    await store1.add("s1", "user", "first")
    await store1.add("s1", "user", "second")

    store2 = VectorMemoryStore(LLMGateway(), redis_url="redis://fake:6379/0")
    count = await store2.hydrate()
    assert count == 2
    assert store2.count() == 2
    contents = [m["content"] for m in store2.get_all()]
    assert "first" in contents
    assert "second" in contents


async def test_redis_hydrate_continues_id_counter(monkeypatch):
    """hydrate 后新 add 的 id 从 max+1 续上,不与历史 id 冲突。"""
    fake = _FakeRedis()
    from app.services import vector_memory as vm_mod
    monkeypatch.setattr(vm_mod.aioredis, "from_url", lambda *a, **kw: fake)

    store1 = VectorMemoryStore(LLMGateway(), redis_url="redis://fake:6379/0")
    await store1.add("s1", "user", "msg-1")
    await store1.add("s1", "user", "msg-2")
    # next_id 此时是 3

    store2 = VectorMemoryStore(LLMGateway(), redis_url="redis://fake:6379/0")
    await store2.hydrate()
    assert store2._next_id == 3
    await store2.add("s1", "user", "msg-3")
    assert store2._store[2]["id"] == 3
    assert "3" in fake.sets.get("vec:memory:ids", set())


async def test_redis_hydrate_empty_returns_zero(monkeypatch):
    """Redis 空时 hydrate 返回 0,store 保持空状态。"""
    fake = _FakeRedis()
    from app.services import vector_memory as vm_mod
    monkeypatch.setattr(vm_mod.aioredis, "from_url", lambda *a, **kw: fake)

    store = VectorMemoryStore(LLMGateway(), redis_url="redis://fake:6379/0")
    count = await store.hydrate()
    assert count == 0
    assert store.count() == 0


async def test_redis_hydrate_skips_corrupted_entries(monkeypatch):
    """hydrate 时损坏的 entry(非 JSON 或缺字段)跳过,不影响其他 entry。"""
    fake = _FakeRedis()
    fake.sets["vec:memory:ids"] = {"1", "2", "3"}
    fake.store["vec:memory:entry:1"] = "not json"
    fake.store["vec:memory:entry:2"] = '{"id": 2, "embedding": [0.1, 0.2]}'  # OK
    fake.store["vec:memory:entry:3"] = '{"embedding": [0.3]}'  # 缺 id

    from app.services import vector_memory as vm_mod
    monkeypatch.setattr(vm_mod.aioredis, "from_url", lambda *a, **kw: fake)
    store = VectorMemoryStore(LLMGateway(), redis_url="redis://fake:6379/0")
    count = await store.hydrate()
    assert count == 1  # 只有 entry 2 成功
    assert store._store[0]["id"] == 2


async def test_redis_clear_session_flushes_delete(monkeypatch):
    """clear(session) 同步删 Redis 里的 entry(fire-and-forget)。"""
    import asyncio
    store, fake = _make_redis_store(monkeypatch)
    await store.add("s1", "user", "a")
    await store.add("s2", "user", "b")
    assert "1" in fake.sets.get("vec:memory:ids", set())
    assert "2" in fake.sets.get("vec:memory:ids", set())

    store.clear("s1")
    # 等 fire-and-forget task 完成
    await asyncio.sleep(0.05)

    assert "1" not in fake.sets.get("vec:memory:ids", set())
    assert "2" in fake.sets.get("vec:memory:ids", set())
    assert "vec:memory:entry:1" not in fake.store
    assert "vec:memory:entry:2" in fake.store


async def test_redis_clear_all_flushes_all_keys(monkeypatch):
    """clear() 全部时 fire-and-forget 清空 Redis 所有 vec:memory:* key。"""
    import asyncio
    store, fake = _make_redis_store(monkeypatch)
    await store.add("s1", "user", "a")
    await store.add("s2", "user", "b")

    store.clear()
    await asyncio.sleep(0.05)

    # ids set 和所有 entry:key 都被清空
    assert "vec:memory:ids" not in fake.sets
    assert "vec:memory:entry:1" not in fake.store
    assert "vec:memory:entry:2" not in fake.store


async def test_redis_get_redis_connect_failure_degrades(monkeypatch):
    """Redis 连接失败时,_use_redis 永久置 False,降级为内存模式。"""
    from app.services import vector_memory as vm_mod

    def _broken_from_url(*a, **kw):
        raise ConnectionError("redis not available")

    monkeypatch.setattr(vm_mod.aioredis, "from_url", _broken_from_url)
    store = VectorMemoryStore(LLMGateway(), redis_url="redis://broken:6379/0")
    redis = await store._get_redis()
    assert redis is None
    assert store._use_redis is False
    # 后续 _get_redis 不再尝试重连
    redis2 = await store._get_redis()
    assert redis2 is None
