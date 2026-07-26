"""向量记忆存储单元测试(匹配新 API:persist_path 构造 + _entries/_vectors dict + async 操作)。

测试覆盖:
- _cosine_similarity 余弦相似度计算(相同/正交/空/不同长度/零向量/相反)
- _hash_embedding 确定性 hash 伪向量(同文本同向量/维度/值域 [-1,1]/不同文本)
- _AsyncLRUCache 异步 LRU 缓存(L1 命中/L1 未命中/LRU 淘汰/maxsize 限制/L1 命中提升 MRU/L2 Redis 回填)
- VectorMemoryStore 构造(默认 persist_path/自定义 persist_path)
- add_entry 存储 entry + vector/触发 dirty/同 entry_id 覆盖
- search 空存储/有结果/按相似度降序/top_k 限制/threshold 过滤/空 query_embedding
- update_embedding 更新已有/entry 不存在时不创建
- delete 删除已有/删除不存在不报错
- clear 无参数清空全部/clear(session_id) 只清匹配/不匹配 session_id 不清空/保留无 session_id 字段的 entry
- embed LLM 成功返回向量/LLM 失败降级 hash/LLM 返回空降级 hash/缓存命中
- hydrate 空文件/有数据/损坏文件/已 hydrate 不重复加载/数据一致性过滤(只加载 entries ∩ vectors)
- list_entry_ids / list_entries(浅拷贝) / __len__
- 持久化 _persist_sync 写盘 + 重置 dirty/_persist_async 异步写盘/dirty 标志控制
- 全局单例 vector_memory
- _get_redis 降级(redis_url 为空/连接失败 → None 永久降级)
"""

from __future__ import annotations

import json
import os
from typing import Any

import pytest

from app.services import vector_memory as vm_mod
from app.services.vector_memory import (
    VectorMemoryStore,
    _AsyncLRUCache,
    _cosine_similarity,
    _hash_embedding,
    vector_memory,
)


# =============================================================================
# 共享 fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_cache_and_redis(monkeypatch: pytest.MonkeyPatch) -> Any:
    """每个测试前清空 embedding 缓存 + 重置 Redis 全局状态(纯内存模式)。

    设置 _redis_checked=True + _redis_client=None,使 _get_redis 直接返回 None,
    避免每个测试都尝试连接真实 Redis 导致超时。
    """
    vm_mod._embedding_cache._data.clear()
    monkeypatch.setattr(vm_mod, "_redis_checked", True)
    monkeypatch.setattr(vm_mod, "_redis_client", None)
    yield
    vm_mod._embedding_cache._data.clear()


@pytest.fixture
def store(tmp_path) -> VectorMemoryStore:
    """VectorMemoryStore 实例,使用 tmp_path 隔离持久化文件(不写真实 .data/)。"""
    return VectorMemoryStore(persist_path=str(tmp_path / "memory.json"))


class _FakeRedis:
    """最小可用 async Redis 替身,仅支持 embedding 缓存用到的 get/set。"""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self._data.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._data[key] = value


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
    assert _cosine_similarity([1.0], []) == 0.0
    assert _cosine_similarity([], [1.0]) == 0.0


def test_cosine_similarity_different_length():
    """不同长度向量按 min(len(a), len(b)) 计算(不返回 0.0)。"""
    # [1.0, 2.0] 与 [1.0]:取第 0 维,1*1/(1*1)=1.0
    assert _cosine_similarity([1.0, 2.0], [1.0]) == pytest.approx(1.0)
    # [1.0, 0.0] 与 [1.0, 1.0, 1.0]:取前 2 维,dot=1, norm_a=1, norm_b=2 → 1/sqrt(2)
    assert _cosine_similarity([1.0, 0.0], [1.0, 1.0, 1.0]) == pytest.approx(1.0 / (2 ** 0.5))


def test_cosine_similarity_zero_vector():
    """零向量返回 0.0(norm=0 时短路)。"""
    assert _cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0
    assert _cosine_similarity([1.0, 1.0], [0.0, 0.0]) == 0.0


def test_cosine_similarity_opposite_vectors():
    """相反向量的相似度为 -1.0。"""
    a = [1.0, 0.0]
    b = [-1.0, 0.0]
    assert _cosine_similarity(a, b) == pytest.approx(-1.0)


# =============================================================================
# _hash_embedding
# =============================================================================


def test_hash_embedding_deterministic():
    """同文本生成同向量(确定性)。"""
    v1 = _hash_embedding("hello world")
    v2 = _hash_embedding("hello world")
    assert v1 == v2


def test_hash_embedding_dimension():
    """dim 参数控制向量维度,默认 128。"""
    assert len(_hash_embedding("test")) == 128
    assert len(_hash_embedding("test", dim=64)) == 64
    assert len(_hash_embedding("test", dim=256)) == 256


def test_hash_embedding_values_in_range():
    """向量值归一化到 [-1, 1] 范围。"""
    v = _hash_embedding("any text content")
    assert all(-1.0 <= x <= 1.0 for x in v)


def test_hash_embedding_different_text_different_vector():
    """不同文本生成不同向量。"""
    v1 = _hash_embedding("hello")
    v2 = _hash_embedding("world")
    assert v1 != v2


# =============================================================================
# _AsyncLRUCache
# =============================================================================


async def test_lru_cache_l1_hit():
    """L1 命中直接返回值(不查 Redis)。"""
    cache = _AsyncLRUCache(maxsize=10)
    await cache.set("k1", [0.1, 0.2])
    result = await cache.get("k1")
    assert result == [0.1, 0.2]


async def test_lru_cache_l1_miss_returns_none():
    """L1 未命中且无 Redis 时返回 None。"""
    cache = _AsyncLRUCache(maxsize=10)
    result = await cache.get("nonexistent")
    assert result is None


async def test_lru_cache_lru_eviction():
    """超过 maxsize 时淘汰最久未访问的项(LRU)。"""
    cache = _AsyncLRUCache(maxsize=3)
    await cache.set("k1", "v1")
    await cache.set("k2", "v2")
    await cache.set("k3", "v3")
    await cache.set("k4", "v4")  # 超过 maxsize,k1 被淘汰

    assert await cache.get("k1") is None
    assert await cache.get("k2") == "v2"
    assert await cache.get("k3") == "v3"
    assert await cache.get("k4") == "v4"


async def test_lru_cache_maxsize_limit():
    """L1 数据量永不超过 maxsize。"""
    cache = _AsyncLRUCache(maxsize=5)
    for i in range(20):
        await cache.set(f"k{i}", i)
    assert len(cache._data) <= 5


async def test_lru_cache_l1_hit_moves_to_mru():
    """L1 命中后提升为 MRU,避免被淘汰。"""
    cache = _AsyncLRUCache(maxsize=3)
    await cache.set("k1", "v1")
    await cache.set("k2", "v2")
    await cache.set("k3", "v3")
    # 访问 k1,提升为 MRU(顺序变 [k2, k3, k1])
    await cache.get("k1")
    # 插入 k4,淘汰最久未访问的 k2(k1 已提升不在头部)
    await cache.set("k4", "v4")

    assert await cache.get("k1") == "v1"  # k1 仍在
    assert await cache.get("k2") is None  # k2 被淘汰


async def test_lru_cache_l2_redis_hit_backfills_l1(monkeypatch: pytest.MonkeyPatch):
    """L1 未命中 → L2 Redis 命中 → 回填 L1 → 返回值。"""
    cache = _AsyncLRUCache(maxsize=10)
    fake = _FakeRedis()
    test_key = "model:text"
    test_value = [0.1, 0.2, 0.3]
    # 预置 L2 Redis 数据(JSON 字符串)
    fake._data[vm_mod._redis_cache_key(test_key)] = json.dumps(test_value)
    # 让 _get_redis 返回 fake client
    monkeypatch.setattr(vm_mod, "_redis_client", fake)
    monkeypatch.setattr(vm_mod, "_redis_checked", True)

    # L1 未命中,从 L2 读取并回填
    result = await cache.get(test_key)
    assert result == test_value
    assert test_key in cache._data  # L1 已回填


async def test_lru_cache_set_writes_to_l2_redis(monkeypatch: pytest.MonkeyPatch):
    """set 时同步写 L1 + 异步写 L2 Redis。"""
    cache = _AsyncLRUCache(maxsize=10)
    fake = _FakeRedis()
    monkeypatch.setattr(vm_mod, "_redis_client", fake)
    monkeypatch.setattr(vm_mod, "_redis_checked", True)

    await cache.set("k1", [0.5, 0.6])
    # L2 Redis 应有对应 key
    redis_key = vm_mod._redis_cache_key("k1")
    assert redis_key in fake._data
    assert json.loads(fake._data[redis_key]) == [0.5, 0.6]


# =============================================================================
# VectorMemoryStore - 构造
# =============================================================================


def test_constructor_default_persist_path():
    """不传 persist_path 时使用模块级 _PERSIST_PATH。"""
    s = VectorMemoryStore()
    assert s._persist_path == vm_mod._PERSIST_PATH
    assert s._entries == {}
    assert s._vectors == {}
    assert s._dirty is False
    assert s._hydrated is False


def test_constructor_custom_persist_path(tmp_path):
    """传 persist_path 时使用自定义路径。"""
    custom = str(tmp_path / "custom.json")
    s = VectorMemoryStore(persist_path=custom)
    assert s._persist_path == custom


# =============================================================================
# VectorMemoryStore - add_entry
# =============================================================================


async def test_add_entry_stores_entry_and_vector(store: VectorMemoryStore):
    """add_entry 存储 entry 和 embedding 向量。"""
    entry = {"content": "你好世界", "role": "user"}
    vec = [0.1, 0.2, 0.3]
    await store.add_entry("e1", entry, vec)

    assert store._entries["e1"] == entry
    assert store._vectors["e1"] == vec
    assert len(store) == 1


async def test_add_entry_sets_dirty(store: VectorMemoryStore):
    """add_entry 后 _dirty 标记为 True(并已异步写盘重置)。"""
    # add_entry 内部调用 _persist_async,完成后 _dirty 重置为 False
    await store.add_entry("e1", {"content": "a"}, [0.1])
    # _persist_sync 完成后 _dirty = False
    assert store._dirty is False
    # 但写盘前 _dirty 应为 True(无法直接观测,改为验证文件已写入)
    assert os.path.isfile(store._persist_path)


async def test_add_entry_same_id_overwrites(store: VectorMemoryStore):
    """同 entry_id 重复 add 时覆盖旧数据。"""
    await store.add_entry("e1", {"content": "old"}, [0.1, 0.2])
    await store.add_entry("e1", {"content": "new"}, [0.3, 0.4])

    assert len(store) == 1
    assert store._entries["e1"]["content"] == "new"
    assert store._vectors["e1"] == [0.3, 0.4]


# =============================================================================
# VectorMemoryStore - search
# =============================================================================


async def test_search_empty_store(store: VectorMemoryStore):
    """空存储搜索返回空列表。"""
    results = await store.search([0.1, 0.2, 0.3])
    assert results == []


async def test_search_empty_query_embedding(store: VectorMemoryStore):
    """空 query_embedding 返回空列表(不报错)。"""
    await store.add_entry("e1", {"content": "a"}, [0.1, 0.2])
    assert await store.search([]) == []


async def test_search_returns_results(store: VectorMemoryStore):
    """搜索返回 (entry_id, entry, similarity) 元组列表。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0])
    await store.add_entry("e2", {"content": "b"}, [0.0, 1.0])

    results = await store.search([1.0, 0.0], top_k=5, threshold=0.5)
    assert len(results) == 1
    eid, entry, sim = results[0]
    assert eid == "e1"
    assert entry["content"] == "a"
    assert sim == pytest.approx(1.0)


async def test_search_sorted_by_similarity_desc(store: VectorMemoryStore):
    """搜索结果按相似度降序排列。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0])
    await store.add_entry("e2", {"content": "b"}, [0.707, 0.707])
    await store.add_entry("e3", {"content": "c"}, [0.0, 1.0])

    results = await store.search([1.0, 0.0], top_k=5, threshold=0.0)
    sims = [r[2] for r in results]
    assert sims == sorted(sims, reverse=True)
    assert results[0][0] == "e1"  # 最相似


async def test_search_top_k_limit(store: VectorMemoryStore):
    """top_k 限制返回数量。"""
    for i in range(10):
        await store.add_entry(f"e{i}", {"idx": i}, [float(i), 0.0])

    results = await store.search([5.0, 0.0], top_k=3, threshold=0.0)
    assert len(results) == 3


async def test_search_threshold_filter(store: VectorMemoryStore):
    """threshold 过滤掉低相似度结果。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0])
    await store.add_entry("e2", {"content": "b"}, [0.0, 1.0])

    # query=[1,0] 与 e1 相似度=1.0,与 e2 相似度=0.0
    high = await store.search([1.0, 0.0], top_k=5, threshold=0.9)
    assert len(high) == 1
    assert high[0][0] == "e1"

    # threshold=0.0 时两个都返回
    all_results = await store.search([1.0, 0.0], top_k=5, threshold=0.0)
    assert len(all_results) == 2


async def test_search_identical_vector_highest_score(store: VectorMemoryStore):
    """相同向量的相似度为 1.0(最高分)。"""
    vec = [0.5, 0.5, 0.5]
    await store.add_entry("e1", {"content": "a"}, vec)

    results = await store.search(vec, top_k=1, threshold=0.99)
    assert len(results) == 1
    assert results[0][2] == pytest.approx(1.0)


# =============================================================================
# VectorMemoryStore - update_embedding
# =============================================================================


async def test_update_embedding_existing(store: VectorMemoryStore):
    """更新已有 entry 的向量。"""
    await store.add_entry("e1", {"content": "a"}, [0.1, 0.2])
    await store.update_embedding("e1", [0.9, 0.8])

    assert store._vectors["e1"] == [0.9, 0.8]
    assert store._entries["e1"] == {"content": "a"}  # entry 不变


async def test_update_embedding_nonexistent_noop(store: VectorMemoryStore):
    """entry 不存在时 update_embedding 不创建新条目。"""
    await store.update_embedding("nonexistent", [0.1, 0.2])
    assert len(store) == 0
    assert "nonexistent" not in store._vectors


# =============================================================================
# VectorMemoryStore - delete
# =============================================================================


async def test_delete_existing(store: VectorMemoryStore):
    """删除已有 entry。"""
    await store.add_entry("e1", {"content": "a"}, [0.1, 0.2])
    await store.add_entry("e2", {"content": "b"}, [0.3, 0.4])

    await store.delete("e1")
    assert len(store) == 1
    assert "e1" not in store._entries
    assert "e1" not in store._vectors
    assert "e2" in store._entries


async def test_delete_nonexistent_noop(store: VectorMemoryStore):
    """删除不存在的 entry 不报错。"""
    await store.add_entry("e1", {"content": "a"}, [0.1, 0.2])
    # 不报错
    await store.delete("nonexistent")
    assert len(store) == 1


# =============================================================================
# VectorMemoryStore - clear
# =============================================================================


async def test_clear_all(store: VectorMemoryStore):
    """clear() 无参数清空全部。"""
    await store.add_entry("e1", {"session_id": "s1"}, [0.1])
    await store.add_entry("e2", {"session_id": "s2"}, [0.2])

    await store.clear()
    assert len(store) == 0
    assert store._entries == {}
    assert store._vectors == {}


async def test_clear_by_session_id(store: VectorMemoryStore):
    """clear(session_id) 只清匹配的 entry。"""
    await store.add_entry("e1", {"session_id": "s1", "content": "a"}, [0.1])
    await store.add_entry("e2", {"session_id": "s2", "content": "b"}, [0.2])
    await store.add_entry("e3", {"session_id": "s1", "content": "c"}, [0.3])

    await store.clear(session_id="s1")
    assert len(store) == 1
    assert "e2" in store.list_entry_ids()
    assert "e1" not in store._entries
    assert "e3" not in store._entries


async def test_clear_nonmatching_session_keeps_entries(store: VectorMemoryStore):
    """clear(session_id) 不匹配任何 entry 时不清空(保留全部)。"""
    await store.add_entry("e1", {"session_id": "s1"}, [0.1])
    await store.add_entry("e2", {"session_id": "s2"}, [0.2])

    await store.clear(session_id="nonexistent")
    assert len(store) == 2


async def test_clear_by_session_keeps_entries_without_session_id(store: VectorMemoryStore):
    """clear(session_id) 保留没有 session_id 字段的 entry。"""
    await store.add_entry("e1", {"content": "a"}, [0.1])  # 无 session_id 字段
    await store.add_entry("e2", {"session_id": "s1", "content": "b"}, [0.2])

    await store.clear(session_id="s1")
    assert len(store) == 1
    assert "e1" in store.list_entry_ids()


# =============================================================================
# VectorMemoryStore - embed
# =============================================================================


async def test_embed_llm_success(store: VectorMemoryStore, monkeypatch: pytest.MonkeyPatch):
    """llm_gateway.embed 成功时返回 LLM embedding。"""
    expected = [0.1, 0.2, 0.3, 0.4]

    async def mock_embed(text: str, model: str | None = None) -> list[float]:
        return expected

    monkeypatch.setattr("app.core.llm_gateway.llm_gateway.embed", mock_embed)

    result = await store.embed("hello")
    assert result == expected


async def test_embed_llm_failure_fallback_to_hash(
    store: VectorMemoryStore, monkeypatch: pytest.MonkeyPatch
):
    """llm_gateway.embed 抛异常时降级为 hash 伪向量。"""

    async def mock_embed(text: str, model: str | None = None) -> list[float]:
        raise RuntimeError("LLM unavailable")

    monkeypatch.setattr("app.core.llm_gateway.llm_gateway.embed", mock_embed)

    result = await store.embed("hello")
    expected = _hash_embedding("hello")
    assert result == expected


async def test_embed_llm_returns_empty_fallback_to_hash(
    store: VectorMemoryStore, monkeypatch: pytest.MonkeyPatch
):
    """llm_gateway.embed 返回空列表时降级为 hash 伪向量。"""

    async def mock_embed(text: str, model: str | None = None) -> list[float]:
        return []

    monkeypatch.setattr("app.core.llm_gateway.llm_gateway.embed", mock_embed)

    result = await store.embed("hello")
    expected = _hash_embedding("hello")
    assert result == expected


async def test_embed_cache_hit(store: VectorMemoryStore, monkeypatch: pytest.MonkeyPatch):
    """相同文本第二次调用命中缓存(llm_gateway.embed 只调一次)。"""
    call_count = 0

    async def mock_embed(text: str, model: str | None = None) -> list[float]:
        nonlocal call_count
        call_count += 1
        return [0.1, 0.2, 0.3]

    monkeypatch.setattr("app.core.llm_gateway.llm_gateway.embed", mock_embed)

    r1 = await store.embed("hello")
    r2 = await store.embed("hello")
    assert r1 == r2 == [0.1, 0.2, 0.3]
    assert call_count == 1  # 第二次命中缓存


async def test_embed_different_model_different_cache(
    store: VectorMemoryStore, monkeypatch: pytest.MonkeyPatch
):
    """不同 model 使用不同缓存 key(避免维度污染)。"""
    calls: list[tuple[str, str | None]] = []

    async def mock_embed(text: str, model: str | None = None) -> list[float]:
        calls.append((text, model))
        return [0.1] if model == "model-a" else [0.2]

    monkeypatch.setattr("app.core.llm_gateway.llm_gateway.embed", mock_embed)

    r1 = await store.embed("hello", model="model-a")
    r2 = await store.embed("hello", model="model-b")
    assert r1 == [0.1]
    assert r2 == [0.2]
    assert len(calls) == 2  # 不同 model 各调一次


# =============================================================================
# VectorMemoryStore - hydrate
# =============================================================================


async def test_hydrate_no_file(store: VectorMemoryStore):
    """持久化文件不存在时 hydrate 返回 0。"""
    count = await store.hydrate()
    assert count == 0
    assert len(store) == 0
    assert store._hydrated is True


async def test_hydrate_loads_data(tmp_path):
    """hydrate 从 JSON 文件加载历史 entry + vector。"""
    path = str(tmp_path / "mem.json")
    entries = {"e1": {"content": "a"}, "e2": {"content": "b"}}
    vectors = {"e1": [0.1, 0.2], "e2": [0.3, 0.4]}
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"entries": entries, "vectors": vectors}, f)

    store = VectorMemoryStore(persist_path=path)
    count = await store.hydrate()
    assert count == 2
    assert len(store) == 2
    assert store._entries["e1"]["content"] == "a"
    assert store._vectors["e2"] == [0.3, 0.4]


async def test_hydrate_corrupted_file(tmp_path):
    """hydrate 损坏 JSON 文件时返回 0,不抛异常。"""
    path = str(tmp_path / "mem.json")
    with open(path, "w", encoding="utf-8") as f:
        f.write("{ not valid json }")

    store = VectorMemoryStore(persist_path=path)
    count = await store.hydrate()
    assert count == 0
    assert len(store) == 0


async def test_hydrate_already_hydrated_no_reload(tmp_path):
    """已 hydrate 的 store 再次调用不重复加载(返回当前条数)。"""
    path = str(tmp_path / "mem.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {"entries": {"e1": {"content": "a"}}, "vectors": {"e1": [0.1]}},
            f,
        )

    store = VectorMemoryStore(persist_path=path)
    count1 = await store.hydrate()
    assert count1 == 1

    # 修改文件(模拟外部写入),再次 hydrate 不应重新加载
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {"entries": {"e1": {"content": "a"}, "e2": {"content": "b"}},
             "vectors": {"e1": [0.1], "e2": [0.2]}},
            f,
        )
    count2 = await store.hydrate()
    assert count2 == 1  # 仍是 1,未重新加载
    assert len(store) == 1


async def test_hydrate_consistency_filter(tmp_path):
    """hydrate 只加载 entries ∩ vectors(数据一致性过滤)。"""
    path = str(tmp_path / "mem.json")
    # e3 在 entries 但不在 vectors,e4 在 vectors 但不在 entries
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "entries": {
                    "e1": {"content": "a"},
                    "e2": {"content": "b"},
                    "e3": {"content": "c"},  # 无对应 vector
                },
                "vectors": {
                    "e1": [0.1],
                    "e2": [0.2],
                    "e4": [0.4],  # 无对应 entry
                },
            },
            f,
        )

    store = VectorMemoryStore(persist_path=path)
    count = await store.hydrate()
    assert count == 2  # 只加载 e1, e2
    assert set(store.list_entry_ids()) == {"e1", "e2"}


# =============================================================================
# VectorMemoryStore - list / __len__
# =============================================================================


def test_list_entry_ids_empty(store: VectorMemoryStore):
    """空存储 list_entry_ids 返回空列表。"""
    assert store.list_entry_ids() == []


async def test_list_entry_ids_returns_all_ids(store: VectorMemoryStore):
    """list_entry_ids 返回所有 entry_id。"""
    await store.add_entry("e1", {"content": "a"}, [0.1])
    await store.add_entry("e2", {"content": "b"}, [0.2])

    ids = store.list_entry_ids()
    assert set(ids) == {"e1", "e2"}


def test_list_entries_empty(store: VectorMemoryStore):
    """空存储 list_entries 返回空列表。"""
    assert store.list_entries() == []


async def test_list_entries_returns_shallow_copy(store: VectorMemoryStore):
    """list_entries 返回浅拷贝(dict(e)),修改顶层 key 不影响 store 内部状态。"""
    await store.add_entry("e1", {"content": "a", "role": "user"}, [0.1])

    entries = store.list_entries()
    assert len(entries) == 1
    assert entries[0] is not store._entries["e1"]  # 不同对象(浅拷贝)
    # 修改返回值的顶层 key 不影响内部
    entries[0]["content"] = "modified"
    assert store._entries["e1"]["content"] == "a"


def test_len_empty(store: VectorMemoryStore):
    """空存储 len() == 0。"""
    assert len(store) == 0


async def test_len_with_entries(store: VectorMemoryStore):
    """有 entry 时 len() 返回正确数量。"""
    await store.add_entry("e1", {"content": "a"}, [0.1])
    await store.add_entry("e2", {"content": "b"}, [0.2])
    await store.add_entry("e3", {"content": "c"}, [0.3])
    assert len(store) == 3


# =============================================================================
# VectorMemoryStore - 持久化
# =============================================================================


def test_persist_sync_writes_file(store: VectorMemoryStore):
    """_persist_sync 写入 JSON 文件(含 entries + vectors)。"""
    store._entries = {"e1": {"content": "a"}}
    store._vectors = {"e1": [0.1, 0.2]}
    store._dirty = True

    store._persist_sync()

    assert os.path.isfile(store._persist_path)
    with open(store._persist_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data["entries"] == {"e1": {"content": "a"}}
    assert data["vectors"] == {"e1": [0.1, 0.2]}


def test_persist_sync_resets_dirty(store: VectorMemoryStore):
    """_persist_sync 完成后 _dirty 重置为 False。"""
    store._entries = {"e1": {"content": "a"}}
    store._vectors = {"e1": [0.1]}
    store._dirty = True

    store._persist_sync()
    assert store._dirty is False


def test_persist_sync_creates_parent_dir(tmp_path):
    """_persist_sync 自动创建父目录(不报错)。"""
    path = str(tmp_path / "subdir" / "nested" / "mem.json")
    store = VectorMemoryStore(persist_path=path)
    store._entries = {"e1": {"content": "a"}}
    store._vectors = {"e1": [0.1]}
    store._dirty = True

    store._persist_sync()
    assert os.path.isfile(path)


async def test_persist_async_writes_when_dirty(store: VectorMemoryStore):
    """_persist_async 在 _dirty=True 时写盘。"""
    store._entries = {"e1": {"content": "a"}}
    store._vectors = {"e1": [0.1]}
    store._dirty = True

    await store._persist_async()
    assert os.path.isfile(store._persist_path)
    assert store._dirty is False


async def test_persist_async_skips_when_not_dirty(store: VectorMemoryStore):
    """_persist_async 在 _dirty=False 时跳过(不写盘)。"""
    store._dirty = False
    await store._persist_async()
    assert not os.path.isfile(store._persist_path)


async def test_add_entry_triggers_persist(store: VectorMemoryStore):
    """add_entry 触发异步持久化(文件已写入)。"""
    await store.add_entry("e1", {"content": "a"}, [0.1, 0.2])
    assert os.path.isfile(store._persist_path)
    with open(store._persist_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "e1" in data["entries"]
    assert "e1" in data["vectors"]


# =============================================================================
# 全局单例
# =============================================================================


def test_global_vector_memory_instance():
    """全局 vector_memory 实例存在且为 VectorMemoryStore 类型。"""
    assert vector_memory is not None
    assert isinstance(vector_memory, VectorMemoryStore)


def test_global_vector_memory_shared():
    """多次导入 vector_memory 返回同一实例(模块级单例)。"""
    from app.services.vector_memory import vector_memory as vm1
    from app.services.vector_memory import vector_memory as vm2
    assert vm1 is vm2


# =============================================================================
# _get_redis 降级
# =============================================================================


async def test_get_redis_no_url_returns_none(monkeypatch: pytest.MonkeyPatch):
    """_get_redis 在 redis_url 为空时返回 None 并永久降级。"""
    monkeypatch.setattr(vm_mod, "_redis_checked", False)
    monkeypatch.setattr(vm_mod, "_redis_client", None)
    monkeypatch.setattr("app.core.config.settings.redis_url", "")

    result = await vm_mod._get_redis()
    assert result is None
    assert vm_mod._redis_checked is True  # 永久降级


async def test_get_redis_connection_failure_returns_none(
    monkeypatch: pytest.MonkeyPatch,
):
    """_get_redis 在 Redis 连接失败时返回 None 并永久降级。"""
    monkeypatch.setattr(vm_mod, "_redis_checked", False)
    monkeypatch.setattr(vm_mod, "_redis_client", None)
    monkeypatch.setattr("app.core.config.settings.redis_url", "redis://broken:8811/0")

    def _broken_from_url(*a, **kw):
        raise ConnectionError("redis not available")

    if vm_mod.aioredis is not None:
        monkeypatch.setattr(vm_mod.aioredis, "from_url", _broken_from_url)

    result = await vm_mod._get_redis()
    assert result is None
    assert vm_mod._redis_checked is True


async def test_get_redis_cached_returns_cached_client(
    monkeypatch: pytest.MonkeyPatch,
):
    """_get_redis 在 _redis_checked=True 时直接返回缓存的 _redis_client(不重连)。"""
    fake = _FakeRedis()
    monkeypatch.setattr(vm_mod, "_redis_checked", True)
    monkeypatch.setattr(vm_mod, "_redis_client", fake)

    result = await vm_mod._get_redis()
    assert result is fake


# =============================================================================
# _redis_cache_key
# =============================================================================


def test_redis_cache_key_format():
    """_redis_cache_key 返回 embedding:cache:{sha256(key)} 格式。"""
    key = "test-key"
    cache_key = vm_mod._redis_cache_key(key)
    assert cache_key.startswith(vm_mod._EMBEDDING_CACHE_KEY_PREFIX)
    # 去掉前缀后应为 sha256 hex(64 字符)
    suffix = cache_key[len(vm_mod._EMBEDDING_CACHE_KEY_PREFIX):]
    assert len(suffix) == 64
    assert all(c in "0123456789abcdef" for c in suffix)


def test_redis_cache_key_deterministic():
    """同 key 生成同 cache key(确定性)。"""
    k1 = vm_mod._redis_cache_key("hello")
    k2 = vm_mod._redis_cache_key("hello")
    assert k1 == k2
