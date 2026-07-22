"""四层记忆服务测试(P3 深度层 — 记忆系统三件套之三)。

覆盖 memory_service.py:
- 模块级函数:_cosine_similarity / _compute_importance / _parse_pgvector_text / _parse_jsonb
- working memory(内存层):add / get / clear / LRU 50 / 多 session 隔离
- episodic memory(PostgreSQL):add / list / update_decay / mark_consolidated / delete
- semantic memory(pgvector):add / recall / recall_fallback / list
- procedural memory(工具模式):add / list / get_stats
- save 统一入口:按 layer 分发
- 行转换:_row_to_episodic / _row_to_semantic / _row_to_procedural
"""

import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import memory_service as ms_module
from app.services.memory_service import (
    MemoryService,
    _compute_importance,
    _cosine_similarity,
    _parse_jsonb,
    _parse_pgvector_text,
)


# =============================================================================
# Mock 工具
# =============================================================================


class FakeRecord:
    """模拟 asyncpg.Record(支持 __getitem__)。"""

    def __init__(self, data: dict) -> None:
        self._data = data

    def __getitem__(self, key: str):
        return self._data[key]


def _episodic_row(**overrides) -> FakeRecord:
    """构造 episodic 行(字段值模拟 SQL ::text 转换)。"""
    base = {
        "id": "ep-001",
        "session_id": "sess-1",
        "user_id": "user-1",
        "content": "测试内容",
        "summary": "摘要",
        "importance_score": "0.5",  # SQL ::text → str
        "decay_factor": "1.0",
        "metadata": '{"key": "val"}',
        "created_at": datetime(2026, 7, 22, 10, 0, 0, tzinfo=timezone.utc),
        "expires_at": None,
        "last_accessed_at": datetime(2026, 7, 22, 10, 0, 0, tzinfo=timezone.utc),
    }
    base.update(overrides)
    return FakeRecord(base)


def _semantic_row(**overrides) -> FakeRecord:
    """构造 semantic 行。"""
    base = {
        "id": "sem-001",
        "user_id": "user-1",
        "content": "语义记忆",
        "importance_score": "0.8",
        "metadata": "{}",
        "created_at": datetime(2026, 7, 22, 10, 0, 0, tzinfo=timezone.utc),
        "last_accessed_at": datetime(2026, 7, 22, 10, 0, 0, tzinfo=timezone.utc),
    }
    base.update(overrides)
    return FakeRecord(base)


def _procedural_row(**overrides) -> FakeRecord:
    """构造 procedural 行。"""
    base = {
        "id": "proc-001",
        "user_id": "user-1",
        "pattern": "read_file",
        "tool_name": "Read",
        "success_count": 5,
        "failure_count": 1,
        "importance_score": "0.7",
        "metadata": "{}",
        "last_used_at": datetime(2026, 7, 22, 10, 0, 0, tzinfo=timezone.utc),
        "created_at": datetime(2026, 7, 22, 10, 0, 0, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 7, 22, 10, 0, 0, tzinfo=timezone.utc),
    }
    base.update(overrides)
    return FakeRecord(base)


@pytest.fixture
def mock_conn():
    """Mock asyncpg Connection。"""
    return AsyncMock()


@pytest.fixture
def mock_pool(mock_conn):
    """Mock asyncpg Pool(async context manager)。"""
    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    return pool


@pytest.fixture(autouse=True)
def patch_get_pool(mock_pool):
    """替换模块级 _get_pool(autouse,所有测试自动生效)。"""
    with patch.object(ms_module, "_get_pool", return_value=mock_pool):
        yield


@pytest.fixture
def mock_gateway():
    """Mock LLM gateway(embed 返回 1536 维向量)。"""
    gw = AsyncMock()
    gw.embed = AsyncMock(return_value=[0.1] * 1536)
    return gw


@pytest.fixture
def service(mock_gateway):
    """MemoryService 实例(使用 mock gateway)。"""
    return MemoryService(gateway=mock_gateway)


# =============================================================================
# _cosine_similarity:余弦相似度
# =============================================================================


class TestCosineSimilarity:
    """_cosine_similarity:向量余弦相似度计算。"""

    def test_identical_vectors(self):
        """相同向量 → 1.0。"""
        v = [1.0, 2.0, 3.0]
        assert _cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        """正交向量 → 0.0。"""
        assert _cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0)

    def test_empty_vectors(self):
        """空向量 → 0.0。"""
        assert _cosine_similarity([], []) == 0.0

    def test_different_length(self):
        """不等长 → 0.0。"""
        assert _cosine_similarity([1, 2], [1, 2, 3]) == 0.0

    def test_zero_vectors(self):
        """零向量 → 0.0。"""
        assert _cosine_similarity([0, 0, 0], [1, 2, 3]) == 0.0

    def test_opposite_vectors(self):
        """反向向量 → -1.0。"""
        assert _cosine_similarity([1, 0], [-1, 0]) == pytest.approx(-1.0)


# =============================================================================
# _compute_importance:重要性评分
# =============================================================================


class TestComputeImportance:
    """_compute_importance:综合重要性评分(0-1)。"""

    def test_default_values(self):
        """默认值(user_feedback=0.5, tool_success=0.5, freq=0, recency=0)。"""
        score = _compute_importance()
        # 0.35*0.5 + 0.25*0.5 + 0.20*0 + 0.20*1.0 = 0.175 + 0.125 + 0 + 0.2 = 0.5
        assert score == pytest.approx(0.5)

    def test_all_max(self):
        """满分输入 → 接近 1.0(freq_score 受 log1p 压缩,不恰好 1.0)。"""
        score = _compute_importance(
            user_feedback=1.0, tool_success_rate=1.0, access_frequency=100, recency_days=0
        )
        # 0.35*1 + 0.25*1 + 0.20*(log1p(100)/5≈0.923) + 0.20*1 ≈ 0.985
        assert score >= 0.98

    def test_all_zero(self):
        """零分输入(freq=0, recency 大)。"""
        score = _compute_importance(
            user_feedback=0.0, tool_success_rate=0.0, access_frequency=0, recency_days=365
        )
        assert score < 0.01

    def test_clipped_to_0_1(self):
        """超出范围的输入被 clip 到 [0, 1]。"""
        score = _compute_importance(user_feedback=5.0, tool_success_rate=-1.0)
        assert 0.0 <= score <= 1.0

    def test_recency_decay(self):
        """recency_days 越大 → score 越小(30 天半衰期)。"""
        recent = _compute_importance(recency_days=0)
        old = _compute_importance(recency_days=60)
        assert recent > old


# =============================================================================
# _parse_pgvector_text:pgvector 文本解析
# =============================================================================


class TestParsePgvectorText:
    """_parse_pgvector_text:'[0.1,0.2,...]' → list[float]。"""

    def test_normal(self):
        assert _parse_pgvector_text("[0.1,0.2,0.3]") == [0.1, 0.2, 0.3]

    def test_empty_string(self):
        assert _parse_pgvector_text("") == []

    def test_none(self):
        assert _parse_pgvector_text(None) == []

    def test_empty_brackets(self):
        assert _parse_pgvector_text("[]") == []

    def test_invalid_values(self):
        assert _parse_pgvector_text("[abc,def]") == []

    def test_with_spaces(self):
        assert _parse_pgvector_text("[ 0.1 , 0.2 ]") == [0.1, 0.2]


# =============================================================================
# _parse_jsonb:JSONB 解析
# =============================================================================


class TestParseJsonb:
    """_parse_jsonb:解析 jsonb 字段(asyncpg 返回 str)。"""

    def test_dict_passthrough(self):
        """dict 直接返回。"""
        d = {"key": "val"}
        assert _parse_jsonb(d) == d

    def test_valid_json_string(self):
        """有效 JSON 字符串 → 解析。"""
        assert _parse_jsonb('{"a": 1}') == {"a": 1}

    def test_none(self):
        """None → {}。"""
        assert _parse_jsonb(None) == {}

    def test_invalid_json_string(self):
        """非法 JSON 字符串 → {}。"""
        assert _parse_jsonb("not json") == {}

    def test_non_dict_json(self):
        """非 dict 的 JSON(如数组)→ {}。"""
        assert _parse_jsonb("[1,2,3]") == {}

    def test_other_type(self):
        """其他类型 → {}。"""
        assert _parse_jsonb(42) == {}


# =============================================================================
# working memory(内存层)
# =============================================================================


class TestWorkingMemory:
    """working memory:内存 LRU(上限 50 条)。"""

    async def test_add_and_get(self, service):
        """add_working + get_working:写入读取。"""
        msg = await service.add_working("s1", "user", "hello")
        assert msg["role"] == "user"
        assert msg["content"] == "hello"
        assert msg["sessionId"] == "s1"
        result = await service.get_working("s1")
        assert len(result) == 1
        assert result[0]["content"] == "hello"

    async def test_lru_limit_50(self, service):
        """LRU 上限:写 10 条(改小 LRU=5),只保留最近 5 条。"""
        service.WORKING_LRU_LIMIT = 5  # 临时改小,避免 Windows timestamp 碰撞
        for i in range(10):
            await service.add_working("s1", "user", f"msg-{i}")
            await asyncio.sleep(0.02)  # 确保 timestamp 唯一
        result = await service.get_working("s1")
        assert len(result) == 5
        # 最旧的 msg-0 ~ msg-4 被丢弃
        assert result[0]["content"] == "msg-5"
        assert result[-1]["content"] == "msg-9"

    async def test_clear_working(self, service):
        """clear_working:清除 + 返回条数。"""
        await service.add_working("s1", "user", "a")
        await asyncio.sleep(0.02)
        await service.add_working("s1", "user", "b")
        count = await service.clear_working("s1")
        assert count == 2
        result = await service.get_working("s1")
        assert result == []

    async def test_clear_nonexistent_session(self, service):
        """clear 不存在的 session → 0。"""
        count = await service.clear_working("nonexistent")
        assert count == 0

    async def test_multiple_sessions_isolated(self, service):
        """多 session 隔离。"""
        await service.add_working("s1", "user", "in-s1")
        await service.add_working("s2", "user", "in-s2")
        r1 = await service.get_working("s1")
        r2 = await service.get_working("s2")
        assert len(r1) == 1
        assert len(r2) == 1
        assert r1[0]["content"] == "in-s1"
        assert r2[0]["content"] == "in-s2"

    async def test_get_nonexistent_session(self, service):
        """get 不存在的 session → []。"""
        assert await service.get_working("nope") == []

    async def test_get_with_limit(self, service):
        """get_working limit 参数。"""
        for i in range(5):
            await service.add_working("s1", "user", f"m{i}")
            await asyncio.sleep(0.02)
        result = await service.get_working("s1", limit=3)
        assert len(result) == 3
        assert result[0]["content"] == "m2"
        assert result[-1]["content"] == "m4"

    async def test_metadata_passed(self, service):
        """metadata 正确传递。"""
        msg = await service.add_working("s1", "user", "hi", metadata={"lang": "zh"})
        assert msg["metadata"] == {"lang": "zh"}

    async def test_metadata_default_empty(self, service):
        """metadata 默认空字典。"""
        msg = await service.add_working("s1", "user", "hi")
        assert msg["metadata"] == {}


# =============================================================================
# episodic memory(PostgreSQL)
# =============================================================================


class TestEpisodicMemory:
    """episodic memory:历史会话片段。"""

    async def test_add_episodic(self, service, mock_conn):
        """add_episodic:INSERT RETURNING。"""
        mock_conn.fetchrow.return_value = _episodic_row()
        result = await service.add_episodic("u1", "s1", "内容", summary="摘要")
        assert result["id"] == "ep-001"
        assert result["layer"] == "episodic"
        assert result["content"] == "测试内容"
        assert result["importanceScore"] == 0.5
        mock_conn.fetchrow.assert_awaited_once()

    async def test_list_episodic_with_session(self, service, mock_conn):
        """list_episodic:按 session_id 过滤。"""
        mock_conn.fetch.return_value = [_episodic_row(), _episodic_row(id="ep-002")]
        result = await service.list_episodic("u1", session_id="s1")
        assert len(result) == 2
        # 验证 SQL 参数(session_id 在 WHERE 中)
        call_args = mock_conn.fetch.call_args
        assert call_args[0][1] == "u1"  # user_id
        assert call_args[0][2] == "s1"  # session_id

    async def test_list_episodic_without_session(self, service, mock_conn):
        """list_episodic:不带 session_id。"""
        mock_conn.fetch.return_value = []
        result = await service.list_episodic("u1")
        assert result == []

    async def test_update_episodic_decay_with_importance(self, service, mock_conn):
        """update_episodic_decay:带 importance_score。"""
        await service.update_episodic_decay("ep-1", 0.5, importance_score=0.9)
        mock_conn.execute.assert_awaited_once()
        sql = mock_conn.execute.call_args[0][0]
        assert "importance_score = $2" in sql

    async def test_update_episodic_decay_without_importance(self, service, mock_conn):
        """update_episodic_decay:不带 importance_score。"""
        await service.update_episodic_decay("ep-1", 0.3)
        mock_conn.execute.assert_awaited_once()
        sql = mock_conn.execute.call_args[0][0]
        assert "importance_score" not in sql

    async def test_mark_episodic_consolidated(self, service, mock_conn):
        """mark_episodic_consolidated:更新 metadata。"""
        await service.mark_episodic_consolidated("ep-1")
        mock_conn.execute.assert_awaited_once()
        sql = mock_conn.execute.call_args[0][0]
        assert "consolidated" in sql

    async def test_delete_episodic(self, service, mock_conn):
        """delete_episodic:DELETE。"""
        await service.delete_episodic("ep-1")
        mock_conn.execute.assert_awaited_once()
        sql = mock_conn.execute.call_args[0][0]
        assert "DELETE" in sql.upper()


# =============================================================================
# semantic memory(pgvector)
# =============================================================================


class TestSemanticMemory:
    """semantic memory:向量检索知识。"""

    async def test_add_semantic_with_embedding(self, service, mock_conn, mock_gateway):
        """add_semantic:提供 embedding。"""
        mock_conn.fetchrow.return_value = _semantic_row()
        embedding = [0.1] * 1536
        result = await service.add_semantic("u1", "内容", embedding=embedding)
        assert result["id"] == "sem-001"
        assert result["layer"] == "semantic"
        mock_gateway.embed.assert_not_called()  # 提供了 embedding,不调 gateway

    async def test_add_semantic_auto_generate_embedding(self, service, mock_conn, mock_gateway):
        """add_semantic:未提供 embedding → 调 gateway.embed。"""
        mock_conn.fetchrow.return_value = _semantic_row()
        await service.add_semantic("u1", "内容")
        mock_gateway.embed.assert_awaited_once_with("内容")

    async def test_add_semantic_wrong_dimension(self, service, mock_gateway):
        """add_semantic:embedding 维度 != 1536 → ValueError。"""
        with pytest.raises(ValueError, match="1536"):
            await service.add_semantic("u1", "内容", embedding=[0.1] * 768)

    async def test_recall_pgvector_success(self, service, mock_conn, mock_gateway):
        """recall:pgvector 成功路径。"""
        mock_conn.fetch.return_value = [_semantic_row(score=0.95)]
        # recall 查询返回的 row 需要 score 字段
        row = _semantic_row()
        row._data["score"] = 0.95
        mock_conn.fetch.return_value = [row]
        result = await service.recall("u1", "query", top_k=5)
        assert len(result) == 1
        assert result[0]["score"] == 0.95
        mock_gateway.embed.assert_awaited_once_with("query")

    async def test_recall_fallback_on_exception(self, service, mock_conn, mock_gateway):
        """recall:pgvector SQL 失败 → 降级 _recall_fallback。"""
        # 第一次 fetch(pgvector SQL)抛异常
        call_count = 0

        async def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("pgvector not installed")
            # fallback 的 fetch 返回 embedding::text
            row = _semantic_row()
            row._data["embedding"] = "[0.1,0.2,0.3]"
            return [row]

        mock_conn.fetch.side_effect = side_effect
        result = await service.recall("u1", "query")
        assert len(result) == 1
        assert "score" in result[0]

    async def test_list_semantic(self, service, mock_conn):
        """list_semantic:不含 embedding。"""
        mock_conn.fetch.return_value = [_semantic_row(), _semantic_row(id="sem-002")]
        result = await service.list_semantic("u1")
        assert len(result) == 2
        assert "embedding" not in result[0]


# =============================================================================
# procedural memory(工具模式)
# =============================================================================


class TestProceduralMemory:
    """procedural memory:技能/工具用法模式。"""

    async def test_add_procedural_success(self, service, mock_conn):
        """add_procedural:成功模式。"""
        mock_conn.fetchrow.return_value = _procedural_row()
        result = await service.add_procedural("u1", "read_file", tool_name="Read", success=True)
        assert result["pattern"] == "read_file"
        assert result["toolName"] == "Read"
        # 验证 SQL 用了 ON CONFLICT(upsberg)
        sql = mock_conn.fetchrow.call_args[0][0]
        assert "ON CONFLICT" in sql.upper()

    async def test_add_procedural_failure(self, service, mock_conn):
        """add_procedural:失败模式。"""
        mock_conn.fetchrow.return_value = _procedural_row()
        await service.add_procedural("u1", "read_file", tool_name="Read", success=False)
        # 验证参数:success=False → success_count=0, failure_count=1
        args = mock_conn.fetchrow.call_args[0]
        assert args[4] == 0  # success_count
        assert args[5] == 1  # failure_count

    async def test_list_procedural(self, service, mock_conn):
        """list_procedural:按最近使用倒序。"""
        mock_conn.fetch.return_value = [_procedural_row(), _procedural_row(id="proc-002")]
        result = await service.list_procedural("u1")
        assert len(result) == 2
        assert result[0]["layer"] == "procedural"

    async def test_get_procedural_stats_with_tool(self, service, mock_conn):
        """get_procedural_stats:按 tool_name 过滤。"""
        mock_conn.fetchrow.return_value = FakeRecord({
            "success_total": 10,
            "failure_total": 2,
            "avg_importance": 0.75,
            "total": 5,
        })
        result = await service.get_procedural_stats("u1", tool_name="Read")
        assert result["success_total"] == 10
        assert result["failure_total"] == 2
        assert result["success_rate"] == pytest.approx(10 / 12)
        assert result["total"] == 5

    async def test_get_procedural_stats_without_tool(self, service, mock_conn):
        """get_procedural_stats:不带 tool_name。"""
        mock_conn.fetchrow.return_value = FakeRecord({
            "success_total": 0,
            "failure_total": 0,
            "avg_importance": 0.0,
            "total": 0,
        })
        result = await service.get_procedural_stats("u1")
        assert result["success_rate"] == 0.0
        assert result["total"] == 0

    async def test_get_procedural_stats_all_zero(self):
        """success_total + failure_total = 0 → success_rate = 0.0(不除零)。"""
        # 用独立实例避免 fixture 污染
        svc = MemoryService(gateway=AsyncMock())
        with patch.object(ms_module, "_get_pool", return_value=MagicMock(
            acquire=MagicMock(return_value=MagicMock(
                __aenter__=AsyncMock(return_value=AsyncMock(
                    fetchrow=AsyncMock(return_value=FakeRecord({
                        "success_total": 0,
                        "failure_total": 0,
                        "avg_importance": 0.0,
                        "total": 0,
                    }))
                )),
                __aexit__=AsyncMock(return_value=None),
            ))
        )):
            result = await svc.get_procedural_stats("u1")
        assert result["success_rate"] == 0.0


# =============================================================================
# save 统一入口
# =============================================================================


class TestSave:
    """save:按 layer 分发到对应层。"""

    async def test_save_working(self, service):
        """save → working 层。"""
        msg = await service.save("u1", "内容", "working", session_id="s1")
        assert msg["layer"] == "working"
        assert msg["userId"] == "u1"

    async def test_save_working_without_session_raises(self, service):
        """save working 缺 session_id → ValueError。"""
        with pytest.raises(ValueError, match="session_id"):
            await service.save("u1", "内容", "working")

    async def test_save_episodic(self, service, mock_conn):
        """save → episodic 层。"""
        mock_conn.fetchrow.return_value = _episodic_row()
        result = await service.save("u1", "内容", "episodic", session_id="s1")
        assert result["layer"] == "episodic"

    async def test_save_episodic_without_session_raises(self, service):
        """save episodic 缺 session_id → ValueError。"""
        with pytest.raises(ValueError, match="session_id"):
            await service.save("u1", "内容", "episodic")

    async def test_save_semantic(self, service, mock_conn, mock_gateway):
        """save → semantic 层(自动生成 embedding)。"""
        mock_conn.fetchrow.return_value = _semantic_row()
        result = await service.save("u1", "内容", "semantic")
        assert result["layer"] == "semantic"
        mock_gateway.embed.assert_awaited_once()

    async def test_save_procedural(self, service, mock_conn):
        """save → procedural 层。"""
        mock_conn.fetchrow.return_value = _procedural_row()
        result = await service.save(
            "u1", "read_file", "procedural",
            metadata={"pattern": "read_file", "tool_name": "Read", "success": True},
        )
        assert result["layer"] == "procedural"

    async def test_save_procedural_uses_content_as_pattern(self, service, mock_conn):
        """save procedural:metadata 无 pattern → 用 content。"""
        mock_conn.fetchrow.return_value = _procedural_row()
        await service.save("u1", "fallback_pattern", "procedural", metadata={})
        args = mock_conn.fetchrow.call_args[0]
        assert args[2] == "fallback_pattern"  # pattern = content

    async def test_save_unknown_layer_raises(self, service):
        """save 未知 layer → ValueError。"""
        with pytest.raises(ValueError, match="未知 layer"):
            await service.save("u1", "内容", "unknown_layer")

    async def test_save_default_importance(self, service, mock_conn):
        """save 未传 importance_score → 默认 0.5。"""
        mock_conn.fetchrow.return_value = _episodic_row()
        await service.save("u1", "内容", "episodic", session_id="s1")
        args = mock_conn.fetchrow.call_args[0]
        # INSERT VALUES 参数:importance_score 是第 5 个参数(index 4)
        assert args[5] == 0.5


# =============================================================================
# 行转换工具
# =============================================================================


class TestRowConverters:
    """_row_to_episodic / _row_to_semantic / _row_to_procedural。"""

    def test_row_to_episodic(self):
        """episodic 行转换。"""
        row = _episodic_row()
        result = MemoryService._row_to_episodic(row)
        assert result["id"] == "ep-001"
        assert result["layer"] == "episodic"
        assert result["sessionId"] == "sess-1"
        assert result["userId"] == "user-1"
        assert result["content"] == "测试内容"
        assert result["importanceScore"] == 0.5
        assert result["decayFactor"] == 1.0
        assert result["metadata"] == {"key": "val"}
        assert result["createdAt"] is not None

    def test_row_to_semantic(self):
        """semantic 行转换(不含 embedding)。"""
        row = _semantic_row()
        result = MemoryService._row_to_semantic(row)
        assert result["id"] == "sem-001"
        assert result["layer"] == "semantic"
        assert result["userId"] == "user-1"
        assert result["importanceScore"] == 0.8
        assert "embedding" not in result

    def test_row_to_procedural(self):
        """procedural 行转换。"""
        row = _procedural_row()
        result = MemoryService._row_to_procedural(row)
        assert result["id"] == "proc-001"
        assert result["layer"] == "procedural"
        assert result["pattern"] == "read_file"
        assert result["toolName"] == "Read"
        assert result["successCount"] == 5
        assert result["failureCount"] == 1

    def test_row_to_episodic_null_fields(self):
        """episodic 行:null 字段安全转换。"""
        row = _episodic_row(
            summary=None,
            expires_at=None,
            last_accessed_at=None,
            created_at=None,
        )
        result = MemoryService._row_to_episodic(row)
        assert result["summary"] is None
        assert result["expiresAt"] is None
        assert result["lastAccessedAt"] is None
        assert result["createdAt"] is None
