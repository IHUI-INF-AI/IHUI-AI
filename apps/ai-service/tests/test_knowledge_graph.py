"""知识图谱服务测试(G5 - 2026-07-21)。

覆盖:
- _parse_json_object(JSON 提取)
- _stub_extract(无 LLM 时的关键词 NER)
- KnowledgeGraphService.extract(stub 模式 + LLM 失败回退)
- InMemoryGraphStore.upsert_entity / upsert_relation / get_graph / clear
- 重复实体频次累加 + 关系权重累加
"""

from __future__ import annotations

import pytest

from app.services.knowledge_graph import (
    InMemoryGraphStore,
    KnowledgeGraphService,
    graph_store,
)


@pytest.fixture(autouse=True)
def _clear_graph_store():
    """每个测试前清空 graph_store,避免跨测试污染。"""
    graph_store.clear()
    yield
    graph_store.clear()


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
# InMemoryGraphStore
# =============================================================================


class TestInMemoryGraphStore:
    def test_upsert_entity_creates_new(self):
        store = InMemoryGraphStore()
        e = store.upsert_entity("owner-1", "Apple", "org", description="科技公司")
        assert e["id"] == 1
        assert e["name"] == "Apple"
        assert e["frequency"] == 1
        assert e["doc_ids"] == []

    def test_upsert_entity_increments_frequency(self):
        store = InMemoryGraphStore()
        e1 = store.upsert_entity("owner-1", "Apple", "org")
        e2 = store.upsert_entity("owner-1", "Apple", "org")
        assert e1["id"] == e2["id"]
        assert e2["frequency"] == 2

    def test_upsert_entity_accumulates_doc_ids(self):
        store = InMemoryGraphStore()
        e1 = store.upsert_entity("owner-1", "Apple", "org", doc_id=10)
        e2 = store.upsert_entity("owner-1", "Apple", "org", doc_id=20)
        assert sorted(e2["doc_ids"]) == [10, 20]

    def test_upsert_entity_different_type_treated_separately(self):
        store = InMemoryGraphStore()
        e1 = store.upsert_entity("owner-1", "Apple", "org")
        e2 = store.upsert_entity("owner-1", "Apple", "product")
        assert e1["id"] != e2["id"]
        assert e1["frequency"] == 1
        assert e2["frequency"] == 1

    def test_upsert_entity_isolated_by_owner(self):
        store = InMemoryGraphStore()
        e1 = store.upsert_entity("owner-1", "Apple", "org")
        e2 = store.upsert_entity("owner-2", "Apple", "org")
        assert e1["id"] != e2["id"]

    def test_upsert_relation_creates_new(self):
        store = InMemoryGraphStore()
        e1 = store.upsert_entity("o", "A", "person")
        e2 = store.upsert_entity("o", "B", "org")
        r = store.upsert_relation("o", e1["id"], e2["id"], "works_for")
        assert r["weight"] == 1

    def test_upsert_relation_increments_weight(self):
        store = InMemoryGraphStore()
        e1 = store.upsert_entity("o", "A", "person")
        e2 = store.upsert_entity("o", "B", "org")
        r1 = store.upsert_relation("o", e1["id"], e2["id"], "works_for")
        r2 = store.upsert_relation("o", e1["id"], e2["id"], "works_for")
        assert r1["id"] == r2["id"]
        assert float(r2["weight"]) == 2.0

    def test_get_graph_filters_by_owner(self):
        store = InMemoryGraphStore()
        store.upsert_entity("o1", "A", "person")
        store.upsert_entity("o2", "B", "person")
        graph = store.get_graph("o1")
        names = [e["name"] for e in graph["entities"]]
        assert "A" in names
        assert "B" not in names

    def test_clear_owner(self):
        store = InMemoryGraphStore()
        store.upsert_entity("o1", "A", "person")
        store.upsert_entity("o2", "B", "person")
        store.clear("o1")
        assert store.get_graph("o1")["entities"] == []
        assert len(store.get_graph("o2")["entities"]) == 1

    def test_clear_all(self):
        store = InMemoryGraphStore()
        store.upsert_entity("o1", "A", "person")
        store.upsert_entity("o2", "B", "person")
        store.clear()
        assert store.get_graph("o1")["entities"] == []
        assert store.get_graph("o2")["entities"] == []


# =============================================================================
# graph_store 全局单例
# =============================================================================


def test_global_graph_store_exists():
    assert graph_store is not None
    assert isinstance(graph_store, InMemoryGraphStore)
