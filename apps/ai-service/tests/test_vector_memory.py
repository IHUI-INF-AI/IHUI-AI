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
