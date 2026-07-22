"""知识图谱服务测试(G5 - 2026-07-21,G5+ 2026-07-22 加 DrizzleGraphStore)。

覆盖:
- _parse_json_object(JSON 提取)
- _stub_extract(无 LLM 时的关键词 NER)
- KnowledgeGraphService.extract(stub 模式 + LLM 失败回退)
- InMemoryGraphStore.upsert_entity / upsert_relation / get_graph / clear(async)
- DrizzleGraphStore 同上(async,asyncpg mock 测试并发安全)
- _create_graph_store 工厂(根据环境变量选择后端)
- 重复实体频次累加 + 关系权重累加

所有 store 方法在 2026-07-22 统一为 async 接口(便于 Protocol 多态),
测试用 pytest-asyncio 运行,`graph_store` 模块级 fixture 隔离。
"""

from __future__ import annotations

import os
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.knowledge_graph import (
    DrizzleGraphStore,
    InMemoryGraphStore,
    KnowledgeGraphService,
    _create_graph_store,
    graph_store,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture(autouse=True)
async def _clear_graph_store():
    """每个测试前清空 graph_store(异步),避免跨测试污染。"""
    await graph_store.clear()
    yield
    await graph_store.clear()


# =============================================================================
# _parse_json_object
# =============================================================================


class TestParseJsonObject:
    def test_parse_valid_json(self):
        text = '{"entities": [], "relations": []}'
        result = KnowledgeGraphService._parse_json_object(text)
        assert result == {"entities": [], "relations": []}

    def test_parse_json_with_surrounding_text(self):
        text = '结果是: {"entities": [{"name": "A"}], "relations": []} 完毕'
        result = KnowledgeGraphService._parse_json_object(text)
        assert result is not None
        assert result["entities"] == [{"name": "A"}]

    def test_parse_markdown_fenced(self):
        text = "```json\n{\"entities\": [], \"relations\": []}\n```"
        result = KnowledgeGraphService._parse_json_object(text)
        assert result == {"entities": [], "relations": []}

    def test_parse_invalid_returns_none(self):
        assert KnowledgeGraphService._parse_json_object("") is None
        assert KnowledgeGraphService._parse_json_object("not json") is None
        assert KnowledgeGraphService._parse_json_object("[1, 2, 3]") is None

    def test_parse_truncated_returns_none(self):
        """截断的 JSON 返回 None,不让上游崩溃。"""
        text = '{"entities": [{"name": "'
        assert KnowledgeGraphService._parse_json_object(text) is None


# =============================================================================
# _stub_extract
# =============================================================================


class TestStubExtract:
    def test_chinese_phrase_extracted(self):
        """中文 2-6 字连续片段被识别为实体。"""
        svc = KnowledgeGraphService()
        # 用 1-2 字短词避免贪婪匹配吞并
        result = svc._stub_extract("北京是首都,上海也很繁华")
        names = [e["name"] for e in result["entities"]]
        assert "北京" in names
        assert "上海" in names

    def test_english_capitalized_extracted(self):
        """英文大写开头的词被识别为实体。"""
        svc = KnowledgeGraphService()
        result = svc._stub_extract("Apple Inc was founded by Steve Jobs in California")
        names = [e["name"] for e in result["entities"]]
        assert any("Apple" in n for n in names)
        assert any("Steve" in n for n in names)

    def test_stopword_skipped(self):
        """停用词开头的片段跳过。"""
        svc = KnowledgeGraphService()
        result = svc._stub_extract("的 了我们")
        # 都是停用词开头,应该被过滤
        assert result["entities"] == []

    def test_relations_created_for_cooccurring(self):
        """相邻实体间创建 related_to 关系。"""
        svc = KnowledgeGraphService()
        result = svc._stub_extract("阿里 腾讯 字节跳动")
        assert len(result["relations"]) >= 1
        for r in result["relations"]:
            assert r["type"] == "related_to"

    def test_empty_text(self):
        svc = KnowledgeGraphService()
        result = svc._stub_extract("")
        assert result["entities"] == []
        assert result["relations"] == []

    def test_max_30_entities(self):
        """超过 30 个实体时截断,避免图谱爆炸。"""
        svc = KnowledgeGraphService()
        text = " ".join(f"实体{i}" for i in range(50))
        result = svc._stub_extract(text)
        assert len(result["entities"]) <= 30


# =============================================================================
# KnowledgeGraphService.extract
# =============================================================================


class TestExtract:
    async def test_stub_mode_returns_entities(self):
        """stub 模式返回关键词 NER 结果 + stub=True。"""
        svc = KnowledgeGraphService()
        result = await svc.extract("阿里巴巴是一家科技公司,总部位于杭州")
        assert result["stub"] is True
        assert isinstance(result["entities"], list)
        assert isinstance(result["relations"], list)

    async def test_empty_text_returns_empty(self):
        svc = KnowledgeGraphService()
        result = await svc.extract("")
        assert result["entities"] == []
        assert result["relations"] == []

    async def test_filter_invalid_entity_types(self):
        """LLM 返回非法 type 时被过滤。"""
        svc = KnowledgeGraphService()
        # 模拟 LLM 输出
        async def _fake_complete(messages, **kw):
            return {
                "content": '{"entities": [{"name": "X", "type": "invalid_type"}, {"name": "Y", "type": "person"}], "relations": []}',
                "stub": False,
            }
        svc._gateway.complete = _fake_complete  # type: ignore[assignment]

        # 强制非 stub
        from app.core.llm_gateway import LLMGateway
        original = LLMGateway._is_stub_mode
        LLMGateway._is_stub_mode = staticmethod(lambda: False)
        try:
            result = await svc.extract("任意文本")
        finally:
            LLMGateway._is_stub_mode = staticmethod(original)

        # 只有 Y(person 合法)被保留
        names = [e["name"] for e in result["entities"]]
        assert "Y" in names
        assert "X" not in names

    async def test_filter_invalid_relation_types(self):
        svc = KnowledgeGraphService()
        async def _fake_complete(messages, **kw):
            return {
                "content": '{"entities": [{"name": "A", "type": "person"}, {"name": "B", "type": "org"}], "relations": [{"source": "A", "target": "B", "type": "invalid_rel"}]}',
                "stub": False,
            }
        svc._gateway.complete = _fake_complete  # type: ignore[assignment]

        from app.core.llm_gateway import LLMGateway
        original = LLMGateway._is_stub_mode
        LLMGateway._is_stub_mode = staticmethod(lambda: False)
        try:
            result = await svc.extract("test")
        finally:
            LLMGateway._is_stub_mode = staticmethod(original)

        assert result["relations"] == []

    async def test_llm_failure_fallback_to_stub(self):
        """LLM 抛异常时返回空结果(stub extract 走的是另一路径,这里只验证不崩溃)。"""
        svc = KnowledgeGraphService()
        async def _broken_complete(messages, **kw):
            raise RuntimeError("LLM down")
        svc._gateway.complete = _broken_complete  # type: ignore[assignment]

        from app.core.llm_gateway import LLMGateway
        original = LLMGateway._is_stub_mode
        LLMGateway._is_stub_mode = staticmethod(lambda: False)
        try:
            # 不应抛异常,异常会被 _parse_json_object 返回 None 兜住
            result = await svc.extract("test")
        finally:
            LLMGateway._is_stub_mode = staticmethod(original)

        assert result["entities"] == []
        assert result["relations"] == []


# =============================================================================
# InMemoryGraphStore(async 接口)
# =============================================================================


class TestInMemoryGraphStore:
    async def test_upsert_entity_creates_new(self):
        store = InMemoryGraphStore()
        e = await store.upsert_entity("owner-1", "Apple", "org", description="科技公司")
        assert e["id"] == 1
        assert e["name"] == "Apple"
        assert e["frequency"] == 1
        assert e["doc_ids"] == []

    async def test_upsert_entity_increments_frequency(self):
        store = InMemoryGraphStore()
        e1 = await store.upsert_entity("owner-1", "Apple", "org")
        e2 = await store.upsert_entity("owner-1", "Apple", "org")
        assert e1["id"] == e2["id"]
        assert e2["frequency"] == 2

    async def test_upsert_entity_accumulates_doc_ids(self):
        store = InMemoryGraphStore()
        e1 = await store.upsert_entity("owner-1", "Apple", "org", doc_id=10)
        e2 = await store.upsert_entity("owner-1", "Apple", "org", doc_id=20)
        assert sorted(e2["doc_ids"]) == [10, 20]

    async def test_upsert_entity_different_type_treated_separately(self):
        store = InMemoryGraphStore()
        e1 = await store.upsert_entity("owner-1", "Apple", "org")
        e2 = await store.upsert_entity("owner-1", "Apple", "product")
        assert e1["id"] != e2["id"]
        assert e1["frequency"] == 1
        assert e2["frequency"] == 1

    async def test_upsert_entity_isolated_by_owner(self):
        store = InMemoryGraphStore()
        e1 = await store.upsert_entity("owner-1", "Apple", "org")
        e2 = await store.upsert_entity("owner-2", "Apple", "org")
        assert e1["id"] != e2["id"]

    async def test_upsert_relation_creates_new(self):
        store = InMemoryGraphStore()
        e1 = await store.upsert_entity("o", "A", "person")
        e2 = await store.upsert_entity("o", "B", "org")
        r = await store.upsert_relation("o", e1["id"], e2["id"], "works_for")
        assert r["weight"] == 1

    async def test_upsert_relation_increments_weight(self):
        store = InMemoryGraphStore()
        e1 = await store.upsert_entity("o", "A", "person")
        e2 = await store.upsert_entity("o", "B", "org")
        r1 = await store.upsert_relation("o", e1["id"], e2["id"], "works_for")
        r2 = await store.upsert_relation("o", e1["id"], e2["id"], "works_for")
        assert r1["id"] == r2["id"]
        assert float(r2["weight"]) == 2.0

    async def test_get_graph_filters_by_owner(self):
        store = InMemoryGraphStore()
        await store.upsert_entity("o1", "A", "person")
        await store.upsert_entity("o2", "B", "person")
        graph = await store.get_graph("o1")
        names = [e["name"] for e in graph["entities"]]
        assert "A" in names
        assert "B" not in names

    async def test_clear_owner(self):
        store = InMemoryGraphStore()
        await store.upsert_entity("o1", "A", "person")
        await store.upsert_entity("o2", "B", "person")
        await store.clear("o1")
        assert (await store.get_graph("o1"))["entities"] == []
        assert len((await store.get_graph("o2"))["entities"]) == 1

    async def test_clear_all(self):
        store = InMemoryGraphStore()
        await store.upsert_entity("o1", "A", "person")
        await store.upsert_entity("o2", "B", "person")
        await store.clear()
        assert (await store.get_graph("o1"))["entities"] == []
        assert (await store.get_graph("o2"))["entities"] == []


# =============================================================================
# DrizzleGraphStore(asyncpg mock 测试)
# =============================================================================


def _make_mock_pool(entity_row: dict[str, Any] | None, relation_row: dict[str, Any] | None) -> MagicMock:
    """构造 asyncpg pool mock,模拟 upsert 场景。

    - 第一次 SELECT 现有行 → 返回 entity_row(可能为 None)
    - 第二次 UPSERT/INSERT → 返回新行
    - 并发场景:用 side_effect 区分 select/insert
    """
    pool = MagicMock()
    conn = MagicMock()
    # 用 AsyncMock 包装 fetchrow/fetch/execute
    conn.fetchrow = AsyncMock(side_effect=[entity_row, entity_row])  # select 1, upsert 1
    conn.fetch = AsyncMock(return_value=[])
    conn.execute = AsyncMock(return_value="DELETE 1")

    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_cm)
    return pool


class TestDrizzleGraphStore:
    """用 mock asyncpg 验证 DrizzleGraphStore 的 SQL 调用序列和 upsert 行为。"""

    async def test_upsert_entity_inserts_new(self):
        """实体不存在 → SELECT None → INSERT → 返回新行。"""
        store = DrizzleGraphStore()

        entity_row = {
            "id": 42,
            "owner_uuid": "owner-1",
            "name": "Apple",
            "type": "org",
            "description": None,
            "frequency": 1,
            "doc_ids": [],
        }
        # side_effect 顺序:SELECT 现有 → INSERT 返回
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[None, entity_row])
        conn.execute = AsyncMock(return_value="")

        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=None)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acquire_cm)

        # mock _get_pool
        store._get_pool = AsyncMock(return_value=pool)  # type: ignore[method-assign]

        result = await store.upsert_entity("owner-1", "Apple", "org")
        assert result["id"] == 42
        assert result["name"] == "Apple"
        # 验证 SQL 序列:SELECT 1 次 + INSERT 1 次
        assert conn.fetchrow.call_count == 2

    async def test_upsert_entity_updates_existing(self):
        """实体已存在 → SELECT 现有 → UPDATE → frequency 累加。"""
        store = DrizzleGraphStore()

        existing = {
            "id": 5,
            "owner_uuid": "owner-1",
            "name": "Apple",
            "type": "org",
            "description": None,
            "frequency": 3,
            "doc_ids": [10],
        }
        updated = {
            "id": 5,
            "owner_uuid": "owner-1",
            "name": "Apple",
            "type": "org",
            "description": None,
            "frequency": 4,
            "doc_ids": [10, 20],
        }
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[existing, updated])
        conn.execute = AsyncMock(return_value="")

        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=None)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acquire_cm)

        store._get_pool = AsyncMock(return_value=pool)  # type: ignore[method-assign]

        result = await store.upsert_entity("owner-1", "Apple", "org", doc_id=20)
        assert result["id"] == 5
        assert result["frequency"] == 4  # 3+1
        assert 20 in result["doc_ids"]

    async def test_upsert_relation_inserts_new(self):
        store = DrizzleGraphStore()

        relation_row = {
            "id": 100,
            "owner_uuid": "owner-1",
            "source_entity_id": 1,
            "target_entity_id": 2,
            "relation_type": "works_for",
            "description": None,
            "weight": 1,
        }
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[None, relation_row])
        conn.execute = AsyncMock(return_value="")

        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=None)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acquire_cm)

        store._get_pool = AsyncMock(return_value=pool)  # type: ignore[method-assign]

        result = await store.upsert_relation("owner-1", 1, 2, "works_for")
        assert result["id"] == 100
        assert result["weight"] == 1

    async def test_upsert_relation_updates_existing(self):
        store = DrizzleGraphStore()

        existing = {
            "id": 100,
            "owner_uuid": "owner-1",
            "source_entity_id": 1,
            "target_entity_id": 2,
            "relation_type": "works_for",
            "description": None,
            "weight": 2,
        }
        updated = {
            "id": 100,
            "owner_uuid": "owner-1",
            "source_entity_id": 1,
            "target_entity_id": 2,
            "relation_type": "works_for",
            "description": None,
            "weight": 3,
        }
        conn = MagicMock()
        conn.fetchrow = AsyncMock(side_effect=[existing, updated])
        conn.execute = AsyncMock(return_value="")

        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=None)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acquire_cm)

        store._get_pool = AsyncMock(return_value=pool)  # type: ignore[method-assign]

        result = await store.upsert_relation("owner-1", 1, 2, "works_for")
        assert result["weight"] == 3  # 2+1

    async def test_get_graph_returns_entities_and_relations(self):
        store = DrizzleGraphStore()

        entity_rows = [
            {"id": 1, "owner_uuid": "o1", "name": "A", "type": "person",
             "description": None, "frequency": 1, "doc_ids": []},
            {"id": 2, "owner_uuid": "o1", "name": "B", "type": "org",
             "description": "test", "frequency": 2, "doc_ids": [5]},
        ]
        relation_rows = [
            {"id": 1, "owner_uuid": "o1", "source_entity_id": 1, "target_entity_id": 2,
             "relation_type": "works_for", "description": None, "weight": 3},
        ]
        conn = MagicMock()
        # 第一次 fetch: entities, 第二次 fetch: relations
        conn.fetch = AsyncMock(side_effect=[entity_rows, relation_rows])
        conn.fetchrow = AsyncMock(return_value=None)
        conn.execute = AsyncMock(return_value="")

        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=None)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acquire_cm)

        store._get_pool = AsyncMock(return_value=pool)  # type: ignore[method-assign]

        graph = await store.get_graph("o1")
        assert len(graph["entities"]) == 2
        assert len(graph["relations"]) == 1
        assert graph["entities"][0]["name"] == "A"
        assert graph["relations"][0]["weight"] == 3.0  # Decimal → float 转换

    async def test_clear_owner_executes_delete(self):
        store = DrizzleGraphStore()

        conn = MagicMock()
        conn.execute = AsyncMock(return_value="DELETE 5")
        conn.fetchrow = AsyncMock(return_value=None)
        conn.fetch = AsyncMock(return_value=[])

        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=None)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acquire_cm)

        store._get_pool = AsyncMock(return_value=pool)  # type: ignore[method-assign]

        await store.clear("owner-1")
        # 验证执行了 2 次 DELETE(relations + entities)
        assert conn.execute.call_count == 2
        # 检查 SQL 包含 owner_uuid 参数
        calls = conn.execute.call_args_list
        for call in calls:
            sql = call.args[0]
            assert "DELETE FROM zhs_knowledge" in sql
            assert "owner_uuid" in sql

    async def test_init_raises_when_no_database_url(self, monkeypatch):
        """DATABASE_URL 未配置时,DrizzleGraphStore 初始化抛 ValueError。"""
        from app.core import config
        from app.services import knowledge_graph

        monkeypatch.setattr(config.settings, "database_url", "")
        with pytest.raises(ValueError, match="DATABASE_URL"):
            DrizzleGraphStore()

    async def test_close_resets_pool(self):
        store = DrizzleGraphStore()
        # 模拟已创建的 pool
        fake_pool = MagicMock()
        fake_pool.close = AsyncMock()
        store._pool = fake_pool

        await store.close()
        fake_pool.close.assert_awaited_once()
        assert store._pool is None

    async def test_upsert_entity_handles_unique_violation_fallback(self):
        """并发场景:INSERT 触发 UniqueViolation,降级到 SELECT → UPDATE 路径。"""
        store = DrizzleGraphStore()

        existing = {
            "id": 5,
            "owner_uuid": "owner-1",
            "name": "Apple",
            "type": "org",
            "description": None,
            "frequency": 1,
            "doc_ids": [],
        }
        updated = {
            "id": 5,
            "owner_uuid": "owner-1",
            "name": "Apple",
            "type": "org",
            "description": None,
            "frequency": 2,
            "doc_ids": [],
        }
        conn = MagicMock()
        # 序列:SELECT 现有(None)→ INSERT 抛 UniqueViolation → SELECT 现有(5)→ UPDATE
        import asyncpg

        conn.fetchrow = AsyncMock(side_effect=[
            None,  # 第一次 SELECT:实体不存在
            existing,  # UniqueViolation 后 SELECT
            updated,  # UPDATE
        ])
        # 让 INSERT 抛 UniqueViolation
        # 用 side_effect 在 fetchrow 的第 2 次调用(INSERT 路径)时抛异常
        # 实际实现:第一次 fetchrow 是 SELECT(返回 None),
        #          第二次 fetchrow 应该是 INSERT 但我们用 mock 改成抛 UniqueViolation
        # 这里更简洁:用 separate mock 让 INSERT 抛错,SELECT/UPDATE 用 fetchrow
        # 但 fetchrow 都是同一个 mock,所以用 side_effect 列表中插入异常

        # 改用更直接的方式:第一次 fetchrow 返回 None,
        # 第二次 fetchrow (INSERT 路径) 抛 UniqueViolation,
        # 第三次 fetchrow (降级 SELECT) 返回 existing,
        # 第四次 fetchrow (降级 UPDATE) 返回 updated
        conn.fetchrow = AsyncMock(side_effect=[
            None,  # SELECT 1: 不存在
            asyncpg.UniqueViolationError("duplicate"),  # INSERT: 抛错
            existing,  # 降级 SELECT
            updated,  # 降级 UPDATE
        ])

        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=None)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acquire_cm)

        store._get_pool = AsyncMock(return_value=pool)  # type: ignore[method-assign]

        result = await store.upsert_entity("owner-1", "Apple", "org")
        assert result["id"] == 5
        assert result["frequency"] == 2
        # 调用 4 次:SELECT + INSERT(失败) + SELECT + UPDATE
        assert conn.fetchrow.call_count == 4


# =============================================================================
# _create_graph_store 工厂
# =============================================================================


class TestCreateGraphStore:
    def test_default_memory_backend(self, monkeypatch):
        """未设置环境变量 → 默认 InMemoryGraphStore。"""
        monkeypatch.delenv("KNOWLEDGE_GRAPH_STORE", raising=False)
        store = _create_graph_store()
        assert isinstance(store, InMemoryGraphStore)

    def test_explicit_memory_backend(self, monkeypatch):
        monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", "memory")
        store = _create_graph_store()
        assert isinstance(store, InMemoryGraphStore)

    def test_unknown_backend_falls_back_to_memory(self, monkeypatch):
        """未知后端值 → 降级到 InMemoryGraphStore(不打异常)。"""
        monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", "neo4j")
        store = _create_graph_store()
        assert isinstance(store, InMemoryGraphStore)

    def test_drizzle_backend_when_database_url_set(self, monkeypatch):
        """设置 KNOWLEDGE_GRAPH_STORE=drizzle 且 DATABASE_URL 有值 → DrizzleGraphStore。"""
        from app.core import config
        from app.services import knowledge_graph

        monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", "drizzle")
        # 不实际创建 pool,只验证类型
        monkeypatch.setattr(config.settings, "database_url", "postgres://fake:fake@localhost:8810/fake")
        store = _create_graph_store()
        assert isinstance(store, DrizzleGraphStore)

    def test_drizzle_backend_falls_back_when_no_database_url(self, monkeypatch):
        """drizzle 后端但 DATABASE_URL 为空 → 降级到 InMemoryGraphStore。"""
        from app.core import config

        monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", "drizzle")
        monkeypatch.setattr(config.settings, "database_url", "")
        store = _create_graph_store()
        assert isinstance(store, InMemoryGraphStore)


# =============================================================================
# graph_store 全局单例
# =============================================================================


def test_global_graph_store_exists():
    assert graph_store is not None
    # 默认后端是 InMemoryGraphStore(测试环境)
    assert isinstance(graph_store, InMemoryGraphStore)


async def test_global_graph_store_async_api():
    """验证 graph_store 全局单例支持 async 接口(Protocol 多态)。"""
    e = await graph_store.upsert_entity("test-owner", "TestEntity", "concept")
    assert e["name"] == "TestEntity"
    graph = await graph_store.get_graph("test-owner")
    assert len(graph["entities"]) == 1
    await graph_store.clear("test-owner")
    graph_after = await graph_store.get_graph("test-owner")
    assert graph_after["entities"] == []
