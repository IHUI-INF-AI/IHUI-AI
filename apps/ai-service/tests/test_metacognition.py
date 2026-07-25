"""L9 元认知系统测试(2026-07-25 立)。

覆盖 active_forgetter.py + metacognition.py:
- ActiveForgetter:scan_stale_memories / forget_memory / demote_memory /
                   merge_duplicates / cleanup_orphans / 内部工具
- Metacognition:reflect_on_memories / detect_conflicts / get_reflection_history /
                 build_system_prompt_snippet / 内部工具

全部用 monkeypatch mock llm_gateway / asyncpg / active_forgetter,不实际连 DB。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services.active_forgetter import (
    ActiveForgetter,
    active_forgetter,
)
from app.services.metacognition import (
    Metacognition,
    metacognition,
)


# =============================================================================
# 测试辅助:模拟 asyncpg 连接池 / 连接 / 行
# =============================================================================


class FakeConn:
    """模拟 asyncpg.Connection(队列式返回,每次 fetch/execute 弹出第一个)。"""

    def __init__(self) -> None:
        self.fetch_returns: list[list[dict]] = []
        self.fetchrow_returns: list[dict | None] = []
        self.execute_returns: list[str] = []
        self.fetchval_returns: list[Any] = []
        self.fetch_calls: list[tuple] = []
        self.execute_calls: list[tuple] = []
        self.fetchrow_calls: list[tuple] = []

    async def fetch(self, *args: Any) -> list[dict]:
        self.fetch_calls.append(args)
        if self.fetch_returns:
            return self.fetch_returns.pop(0)
        return []

    async def fetchrow(self, *args: Any) -> dict | None:
        self.fetchrow_calls.append(args)
        if self.fetchrow_returns:
            return self.fetchrow_returns.pop(0)
        return None

    async def fetchval(self, *args: Any) -> Any:
        if self.fetchval_returns:
            return self.fetchval_returns.pop(0)
        return None

    async def execute(self, *args: Any) -> str:
        self.execute_calls.append(args)
        if self.execute_returns:
            return self.execute_returns.pop(0)
        return "DELETE 0"


class _FakeCtx:
    """模拟 pool.acquire() 的 async context manager。"""

    def __init__(self, conn: FakeConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> FakeConn:
        return self.conn

    async def __aexit__(self, *args: Any) -> bool:
        return False


class FakePool:
    """模拟 asyncpg.Pool。"""

    def __init__(self, conn: FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> _FakeCtx:
        return _FakeCtx(self.conn)


def make_pool_mock(conn: FakeConn) -> Any:
    """构造 fake_get_pool 协程函数,返回 FakePool。"""

    async def fake_get_pool() -> FakePool:
        return FakePool(conn)

    return fake_get_pool


def make_raising_pool() -> Any:
    """构造 fake_get_pool 协程函数,抛出异常模拟 DB 故障。"""

    async def fake_get_pool() -> Any:
        raise RuntimeError("DB down")

    return fake_get_pool


def make_stale_candidate(
    cid: str = "00000000-0000-0000-0000-000000000001",
    layer: str = "episodic",
    user_id: str = "11111111-1111-1111-1111-111111111111",
    content: str = "stale memory content",
    importance: float = 0.1,
    days_stale: int = 90,
) -> dict[str, Any]:
    """构造 scan_stale_memories 返回的候选字典。"""
    return {
        "id": cid,
        "layer": layer,
        "user_id": user_id,
        "content_preview": content,
        "last_accessed_at": "2025-01-01T00:00:00+00:00",
        "importance_score": importance,
        "days_stale": days_stale,
    }


def make_scan_row(
    rid: str = "00000000-0000-0000-0000-000000000001",
    uid: str = "11111111-1111-1111-1111-111111111111",
    content: str = "content",
    score: float = 0.1,
    last_accessed: datetime | None = None,
) -> dict[str, Any]:
    """构造 asyncpg fetch 返回的行字典(scan_stale_memories 用)。"""
    return {
        "id": rid,
        "uid": uid,
        "content": content,
        "last_accessed": last_accessed or datetime(2025, 1, 1, tzinfo=timezone.utc),
        "score": score,
    }


# =============================================================================
# ActiveForgetter:scan_stale_memories
# =============================================================================


class TestScanStaleMemories:
    """scan_stale_memories:扫描过期记忆候选。"""

    @pytest.mark.asyncio
    async def test_normal_returns_candidates_from_all_tables(self, monkeypatch):
        """3 表各返回 1 行 → 3 候选(含 layer 字段)。"""
        conn = FakeConn()
        # 3 次 fetch(每表 1 次),每次返回 1 行
        conn.fetch_returns = [
            [make_scan_row(rid="00000000-0000-0000-0000-0000000000a1", content="ep1")],
            [make_scan_row(rid="00000000-0000-0000-0000-0000000000a2", content="sm1")],
            [make_scan_row(rid="00000000-0000-0000-0000-0000000000a3", content="pr1")],
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        result = await forgetter.scan_stale_memories()
        assert len(result) == 3
        layers = [r["layer"] for r in result]
        assert "episodic" in layers
        assert "semantic" in layers
        assert "procedural" in layers
        # 验证字段完整
        for r in result:
            assert "id" in r
            assert "layer" in r
            assert "user_id" in r
            assert "content_preview" in r
            assert "last_accessed_at" in r
            assert "importance_score" in r
            assert "days_stale" in r

    @pytest.mark.asyncio
    async def test_db_failure_returns_empty(self, monkeypatch):
        """_get_pool 抛异常 → 返回 []。"""
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_raising_pool()
        )
        forgetter = ActiveForgetter()
        result = await forgetter.scan_stale_memories()
        assert result == []

    @pytest.mark.asyncio
    async def test_user_id_filter_applied(self, monkeypatch):
        """user_id 非空 → fetch 第 4 个参数为 user_id。"""
        conn = FakeConn()
        conn.fetch_returns = [[], [], []]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        await forgetter.scan_stale_memories(user_id="user-123")
        # 每次 fetch 的第 4 个参数(args[3])是 user_id
        for call in conn.fetch_calls:
            assert call[3] == "user-123"

    @pytest.mark.asyncio
    async def test_days_threshold_filter_applied(self, monkeypatch):
        """days_threshold → fetch 第 2 个参数(args[1])。"""
        conn = FakeConn()
        conn.fetch_returns = [[], [], []]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        await forgetter.scan_stale_memories(days_threshold=45)
        # fetch(SQL, days_threshold, min_importance, limit) - args[1] 是 days_threshold
        for call in conn.fetch_calls:
            assert call[1] == 45

    @pytest.mark.asyncio
    async def test_importance_filter_applied(self, monkeypatch):
        """min_importance → fetch 第 3 个参数(args[2])。"""
        conn = FakeConn()
        conn.fetch_returns = [[], [], []]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        await forgetter.scan_stale_memories(min_importance=0.25)
        # fetch(SQL, days_threshold, min_importance, limit) - args[2] 是 min_importance
        for call in conn.fetch_calls:
            assert call[2] == 0.25

    @pytest.mark.asyncio
    async def test_limit_truncates(self, monkeypatch):
        """limit=2 → 最终只返回 2 条(即使 3 表各有数据)。"""
        conn = FakeConn()
        conn.fetch_returns = [
            [make_scan_row(rid="r1"), make_scan_row(rid="r2")],
            [make_scan_row(rid="r3")],
            [],
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        result = await forgetter.scan_stale_memories(limit=2)
        assert len(result) == 2


# =============================================================================
# ActiveForgetter:forget_memory
# =============================================================================


class TestForgetMemory:
    """forget_memory:主动遗忘(DELETE)。"""

    @pytest.mark.asyncio
    async def test_success(self, monkeypatch):
        """execute 返回 "DELETE 1" → True。"""
        conn = FakeConn()
        conn.execute_returns = ["DELETE 1"]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        ok = await forgetter.forget_memory(
            "episodic", "00000000-0000-0000-0000-000000000001"
        )
        assert ok is True

    @pytest.mark.asyncio
    async def test_db_failure_returns_false(self, monkeypatch):
        """_get_pool 抛异常 → False。"""
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_raising_pool()
        )
        forgetter = ActiveForgetter()
        ok = await forgetter.forget_memory(
            "episodic", "00000000-0000-0000-0000-000000000001"
        )
        assert ok is False

    @pytest.mark.asyncio
    async def test_invalid_layer_raises_valueerror(self):
        """layer 无效 → raise ValueError。"""
        forgetter = ActiveForgetter()
        with pytest.raises(ValueError, match="无效 layer"):
            await forgetter.forget_memory("invalid", "00000000-0000-0000-0000-000000000001")

    @pytest.mark.asyncio
    async def test_nonexistent_returns_false(self, monkeypatch):
        """execute 返回 "DELETE 0" → False(记忆不存在)。"""
        conn = FakeConn()
        conn.execute_returns = ["DELETE 0"]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        ok = await forgetter.forget_memory(
            "semantic", "00000000-0000-0000-0000-000000000002"
        )
        assert ok is False

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_false(self):
        """memory_id 非合法 UUID → False。"""
        forgetter = ActiveForgetter()
        ok = await forgetter.forget_memory("episodic", "not-a-uuid")
        assert ok is False


# =============================================================================
# ActiveForgetter:demote_memory
# =============================================================================


class TestDemoteMemory:
    """demote_memory:降级(软遗忘,UPDATE importance_score)。"""

    @pytest.mark.asyncio
    async def test_success(self, monkeypatch):
        """execute 返回 "UPDATE 1" → True。"""
        conn = FakeConn()
        conn.execute_returns = ["UPDATE 1"]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        ok = await forgetter.demote_memory(
            "episodic", "00000000-0000-0000-0000-000000000001", new_score=0.05
        )
        assert ok is True

    @pytest.mark.asyncio
    async def test_db_failure_returns_false(self, monkeypatch):
        """_get_pool 抛异常 → False。"""
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_raising_pool()
        )
        forgetter = ActiveForgetter()
        ok = await forgetter.demote_memory(
            "semantic", "00000000-0000-0000-0000-000000000001"
        )
        assert ok is False

    @pytest.mark.asyncio
    async def test_invalid_layer_raises_valueerror(self):
        """layer 无效 → raise ValueError。"""
        forgetter = ActiveForgetter()
        with pytest.raises(ValueError, match="无效 layer"):
            await forgetter.demote_memory("working", "00000000-0000-0000-0000-000000000001")

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_false(self):
        """memory_id 非合法 UUID → False。"""
        forgetter = ActiveForgetter()
        ok = await forgetter.demote_memory("procedural", "garbage")
        assert ok is False


# =============================================================================
# ActiveForgetter:merge_duplicates
# =============================================================================


class TestMergeDuplicates:
    """merge_duplicates:合并重复记忆。"""

    @pytest.mark.asyncio
    async def test_merges_duplicate_content(self, monkeypatch):
        """同 content 多条 → 保留首条,删除其余。"""
        conn = FakeConn()
        # 第 1 次 fetch(episodic)返回 1 组重复(3 条同 content,均为合法 UUID)
        conn.fetch_returns = [
            [{"content": "dup", "ids": [
                "00000000-0000-0000-0000-0000000000a1",
                "00000000-0000-0000-0000-0000000000a2",
                "00000000-0000-0000-0000-0000000000a3",
            ]}],
            [],
            [],
        ]
        # 删除 2 次(后 2 条)
        conn.execute_returns = ["DELETE 1", "DELETE 1"]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        result = await forgetter.merge_duplicates()
        assert result == 2  # 删除 2 条

    @pytest.mark.asyncio
    async def test_no_duplicates_returns_zero(self, monkeypatch):
        """无重复 → 0。"""
        conn = FakeConn()
        conn.fetch_returns = [[], [], []]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        result = await forgetter.merge_duplicates()
        assert result == 0

    @pytest.mark.asyncio
    async def test_db_failure_returns_zero(self, monkeypatch):
        """_get_pool 抛异常 → 0。"""
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_raising_pool()
        )
        forgetter = ActiveForgetter()
        result = await forgetter.merge_duplicates()
        assert result == 0


# =============================================================================
# ActiveForgetter:cleanup_orphans
# =============================================================================


class TestCleanupOrphans:
    """cleanup_orphans:清理孤儿记忆。"""

    @pytest.mark.asyncio
    async def test_cleans_orphaned_user(self, monkeypatch):
        """指定 user_id 不存在 → 删除该 user_id 的记忆。"""
        conn = FakeConn()
        # fetchval 返回 None(用户不存在)
        conn.fetchval_returns = [None, None, None]
        # 3 表各删 1 行
        conn.execute_returns = ["DELETE 1", "DELETE 1", "DELETE 1"]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        result = await forgetter.cleanup_orphans(user_id="nonexistent-user")
        assert result == 3

    @pytest.mark.asyncio
    async def test_user_exists_no_cleanup(self, monkeypatch):
        """指定 user_id 存在 → 无孤儿可清,返回 0。"""
        conn = FakeConn()
        # fetchval 返回 1(用户存在)
        conn.fetchval_returns = [1, 1, 1]
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_pool_mock(conn)
        )
        forgetter = ActiveForgetter()
        result = await forgetter.cleanup_orphans(user_id="existing-user")
        assert result == 0

    @pytest.mark.asyncio
    async def test_db_failure_returns_zero(self, monkeypatch):
        """_get_pool 抛异常 → 0。"""
        monkeypatch.setattr(
            "app.services.active_forgetter._get_pool", make_raising_pool()
        )
        forgetter = ActiveForgetter()
        result = await forgetter.cleanup_orphans()
        assert result == 0


# =============================================================================
# ActiveForgetter:内部工具方法
# =============================================================================


class TestParseRowcount:
    """_parse_rowcount:解析 asyncpg execute 返回字符串。"""

    def test_delete_n(self):
        assert ActiveForgetter._parse_rowcount("DELETE 5") == 5

    def test_update_n(self):
        assert ActiveForgetter._parse_rowcount("UPDATE 3") == 3

    def test_insert_0_n(self):
        assert ActiveForgetter._parse_rowcount("INSERT 0 1") == 1

    def test_empty_or_invalid(self):
        assert ActiveForgetter._parse_rowcount("") == 0
        assert ActiveForgetter._parse_rowcount("GARBAGE") == 0


class TestComputeDaysStale:
    """_compute_days_stale:计算距今天数。"""

    def test_normal_computation(self):
        now = datetime(2026, 7, 25, tzinfo=timezone.utc)
        old = datetime(2026, 6, 25, tzinfo=timezone.utc)  # 30 天前
        assert ActiveForgetter._compute_days_stale(old, now) == 30

    def test_none_returns_zero(self):
        now = datetime(2026, 7, 25, tzinfo=timezone.utc)
        assert ActiveForgetter._compute_days_stale(None, now) == 0


class TestPreview:
    """_preview:截取内容预览。"""

    def test_short_content(self):
        assert ActiveForgetter._preview("hello") == "hello"

    def test_long_content_truncated(self):
        long = "x" * 100
        preview = ActiveForgetter._preview(long, max_len=20)
        assert len(preview) == 20
        assert preview.endswith("...")


# =============================================================================
# Metacognition:reflect_on_memories
# =============================================================================


class TestReflectOnMemories:
    """reflect_on_memories:记忆自我反思主入口。"""

    @pytest.mark.asyncio
    async def test_llm_returns_valid_json(self, monkeypatch):
        """LLM 返回有效 JSON → 应用 actions + 持久化日志。"""
        meta = Metacognition()
        # mock scan_stale_memories 返回 2 候选
        candidates = [
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000001"),
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000002"),
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=candidates),
        )
        # mock LLM 返回有效 JSON
        llm_response = {
            "content": '{"actions": [{"target_id": "00000000-0000-0000-0000-000000000001", "action": "forget", "reason": "stale"}]}',
            "usage": {"total_tokens": 150},
            "error": False,
        }
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(return_value=llm_response),
        )
        # mock forget_memory 成功
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.forget_memory",
            AsyncMock(return_value=True),
        )
        # mock _persist_reflection_log 的 DB 路径
        conn = FakeConn()
        conn.fetchrow_returns = [{"id": "log-uuid"}]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        result = await meta.reflect_on_memories()
        assert result["reflected_count"] == 2
        assert len(result["actions_taken"]) == 1
        assert result["actions_taken"][0]["action"] == "forget"
        assert result["log_id"] == "log-uuid"

    @pytest.mark.asyncio
    async def test_llm_failure_degrades_to_heuristic(self, monkeypatch):
        """LLM 抛异常 → 降级启发式(days_stale>60 → forget)。"""
        meta = Metacognition()
        candidates = [
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000001", days_stale=90),
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000002", days_stale=10, importance=0.1),
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=candidates),
        )
        # LLM 抛异常
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(side_effect=RuntimeError("LLM down")),
        )
        # mock forget_memory + demote_memory
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.forget_memory",
            AsyncMock(return_value=True),
        )
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.demote_memory",
            AsyncMock(return_value=True),
        )
        # mock _persist_reflection_log DB 失败(降级仅写内存)
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        result = await meta.reflect_on_memories()
        assert result["reflected_count"] == 2
        # days_stale=90>60 → forget;importance=0.1<0.2 → demote
        actions = result["actions_taken"]
        action_types = [a["action"] for a in actions]
        assert "forget" in action_types
        assert "demote" in action_types
        assert result["log_id"] == ""  # DB 失败 → 空 log_id

    @pytest.mark.asyncio
    async def test_json_parse_failure_degrades(self, monkeypatch):
        """LLM 返回非 JSON → 降级启发式。"""
        meta = Metacognition()
        candidates = [
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000001", days_stale=90),
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=candidates),
        )
        # LLM 返回非 JSON 内容
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(return_value={
                "content": "This is not JSON at all",
                "usage": {"total_tokens": 50},
                "error": False,
            }),
        )
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.forget_memory",
            AsyncMock(return_value=True),
        )
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        result = await meta.reflect_on_memories()
        # 启发式:days_stale=90>60 → forget
        assert len(result["actions_taken"]) == 1
        assert result["actions_taken"][0]["action"] == "forget"

    @pytest.mark.asyncio
    async def test_sample_size_limits(self, monkeypatch):
        """sample_size=2 → 只反射 2 条(即使有 5 候选)。"""
        meta = Metacognition()
        candidates = [
            make_stale_candidate(cid=f"00000000-0000-0000-0000-00000000000{i}")
            for i in range(1, 6)
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=candidates),
        )
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(return_value={
                "content": '{"actions": []}',
                "usage": {"total_tokens": 10},
                "error": False,
            }),
        )
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        result = await meta.reflect_on_memories(sample_size=2)
        assert result["reflected_count"] == 2

    @pytest.mark.asyncio
    async def test_forget_action_delegated(self, monkeypatch):
        """forget action → active_forgetter.forget_memory 被调用。"""
        meta = Metacognition()
        candidates = [
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000001", layer="episodic"),
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=candidates),
        )
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(return_value={
                "content": '{"actions": [{"target_id": "00000000-0000-0000-0000-000000000001", "action": "forget", "reason": "test"}]}',
                "usage": {},
                "error": False,
            }),
        )
        forget_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.forget_memory", forget_mock
        )
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        await meta.reflect_on_memories()
        forget_mock.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_demote_action_delegated(self, monkeypatch):
        """demote action → active_forgetter.demote_memory 被调用。"""
        meta = Metacognition()
        candidates = [
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000001", layer="semantic"),
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=candidates),
        )
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(return_value={
                "content": '{"actions": [{"target_id": "00000000-0000-0000-0000-000000000001", "action": "demote", "reason": "low value"}]}',
                "usage": {},
                "error": False,
            }),
        )
        demote_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.demote_memory", demote_mock
        )
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        await meta.reflect_on_memories()
        demote_mock.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_log_persisted_to_db(self, monkeypatch):
        """反思日志写入 agent_metacognition_log 表。"""
        meta = Metacognition()
        candidates = [
            make_stale_candidate(cid="00000000-0000-0000-0000-000000000001"),
        ]
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=candidates),
        )
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(return_value={
                "content": '{"actions": []}',
                "usage": {"total_tokens": 42},
                "error": False,
            }),
        )
        conn = FakeConn()
        conn.fetchrow_returns = [{"id": "persisted-log-id"}]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        result = await meta.reflect_on_memories()
        assert result["log_id"] == "persisted-log-id"
        # 验证 fetchrow 被调(INSERT ... RETURNING)
        assert len(conn.fetchrow_calls) == 1

    @pytest.mark.asyncio
    async def test_token_cost_recorded(self, monkeypatch):
        """token_cost 从 LLM usage.total_tokens 提取。"""
        meta = Metacognition()
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=[
                make_stale_candidate(cid="00000000-0000-0000-0000-000000000001"),
            ]),
        )
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete",
            AsyncMock(return_value={
                "content": '{"actions": []}',
                "usage": {"total_tokens": 999},
                "error": False,
            }),
        )
        conn = FakeConn()
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        await meta.reflect_on_memories()
        # 验证缓存中记录了 token_cost
        assert meta._cache[-1]["token_cost"] == 999

    @pytest.mark.asyncio
    async def test_no_candidates_returns_zero(self, monkeypatch):
        """scan 返回空 → reflected_count=0。"""
        meta = Metacognition()
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=[]),
        )
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        result = await meta.reflect_on_memories()
        assert result["reflected_count"] == 0
        assert result["actions_taken"] == []

    @pytest.mark.asyncio
    async def test_return_fields_complete(self, monkeypatch):
        """返回值包含 reflected_count / actions_taken / log_id 三字段。"""
        meta = Metacognition()
        monkeypatch.setattr(
            "app.services.active_forgetter.active_forgetter.scan_stale_memories",
            AsyncMock(return_value=[]),
        )
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        result = await meta.reflect_on_memories()
        assert "reflected_count" in result
        assert "actions_taken" in result
        assert "log_id" in result


# =============================================================================
# Metacognition:detect_conflicts
# =============================================================================


class TestDetectConflicts:
    """detect_conflicts:冲突检测。"""

    @pytest.mark.asyncio
    async def test_semantic_conflict_detected(self, monkeypatch):
        """semantic 关键词重叠 + importance 差异 > 0.5 → 检出冲突。"""
        meta = Metacognition()
        conn = FakeConn()
        # semantic 返回 2 条(关键词重叠,importance 差 0.6)
        conn.fetch_returns = [
            [
                {"id": "sem-a", "content": "Python 编程语言", "score": 0.9},
                {"id": "sem-b", "content": "Python 编程入门", "score": 0.3},
            ],
            [],  # procedural 无数据
        ]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        result = await meta.detect_conflicts("user-1")
        assert len(result) >= 1
        assert result[0]["layer"] == "semantic"
        assert result[0]["conflict_type"] == "importance_divergence"
        assert "id_a" in result[0]
        assert "id_b" in result[0]

    @pytest.mark.asyncio
    async def test_procedural_conflict_detected(self, monkeypatch):
        """procedural 同 tool_name 不同 pattern → 检出冲突。"""
        meta = Metacognition()
        conn = FakeConn()
        conn.fetch_returns = [
            [],  # semantic 无数据
            [
                {"id": "pr-a", "pattern": "pattern_a", "tool_name": "search", "score": 0.8},
                {"id": "pr-b", "pattern": "pattern_b", "tool_name": "search", "score": 0.5},
            ],
        ]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        result = await meta.detect_conflicts("user-1")
        assert len(result) >= 1
        assert result[0]["layer"] == "procedural"
        assert result[0]["conflict_type"] == "same_tool_diff_pattern"

    @pytest.mark.asyncio
    async def test_db_failure_returns_empty(self, monkeypatch):
        """_get_pool 抛异常 → []。"""
        meta = Metacognition()
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        result = await meta.detect_conflicts("user-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_top_k_limits(self, monkeypatch):
        """top_k=1 → 最多返回 1 条冲突。"""
        meta = Metacognition()
        conn = FakeConn()
        # 4 条 semantic,两两重叠 → 多个冲突,但只返回 1
        conn.fetch_returns = [
            [
                {"id": "s1", "content": "Python 编程", "score": 0.9},
                {"id": "s2", "content": "Python 编程", "score": 0.3},
                {"id": "s3", "content": "Python 编程", "score": 0.95},
                {"id": "s4", "content": "Python 编程", "score": 0.2},
            ],
            [],
        ]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        result = await meta.detect_conflicts("user-1", top_k=1)
        assert len(result) == 1


# =============================================================================
# Metacognition:get_reflection_history
# =============================================================================


class TestGetReflectionHistory:
    """get_reflection_history:反思历史查询。"""

    @pytest.mark.asyncio
    async def test_db_loads_history(self, monkeypatch):
        """DB 返回行 → 解析为字典列表。"""
        meta = Metacognition()
        conn = FakeConn()
        conn.fetch_returns = [[
            {
                "id": "log-1",
                "user_id": "user-1",
                "reflection_type": "memory_audit",
                "target_layer": None,
                "target_id": None,
                "findings": [{"issue": "test"}],
                "actions_taken": [{"action": "forget"}],
                "confidence": 0.8,
                "llm_used": True,
                "token_cost": 100,
                "created_at": datetime(2026, 7, 25, tzinfo=timezone.utc),
            },
        ]]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        result = await meta.get_reflection_history("user-1")
        assert len(result) == 1
        assert result[0]["id"] == "log-1"
        assert result[0]["reflection_type"] == "memory_audit"
        assert result[0]["confidence"] == 0.8
        assert result[0]["llm_used"] is True
        assert result[0]["token_cost"] == 100

    @pytest.mark.asyncio
    async def test_db_failure_returns_empty(self, monkeypatch):
        """_get_pool 抛异常 → []。"""
        meta = Metacognition()
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_raising_pool()
        )
        result = await meta.get_reflection_history("user-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_top_k_limits(self, monkeypatch):
        """top_k=2 → SQL LIMIT $1=2,模拟 DB 只返回 2 条。"""
        meta = Metacognition()
        conn = FakeConn()
        # mock 模拟 DB 的 LIMIT 行为:user_id=None 时 SQL 是 LIMIT $1=top_k=2
        # 所以只返回 2 行(模拟真实 DB 的 LIMIT 截断)
        rows = [
            {
                "id": f"log-{i}",
                "user_id": None,
                "reflection_type": "memory_audit",
                "target_layer": None,
                "target_id": None,
                "findings": [],
                "actions_taken": [],
                "confidence": 0.5,
                "llm_used": False,
                "token_cost": 0,
                "created_at": datetime(2026, 7, 25, tzinfo=timezone.utc),
            }
            for i in range(2)
        ]
        conn.fetch_returns = [rows]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        result = await meta.get_reflection_history(top_k=2)
        assert len(result) == 2
        # 验证 SQL 参数 top_k 传给 LIMIT $1
        assert conn.fetch_calls[0][1] == 2

    @pytest.mark.asyncio
    async def test_user_id_filter(self, monkeypatch):
        """user_id 非空 → fetch 第 2 个参数(args[1])为 user_id。"""
        meta = Metacognition()
        conn = FakeConn()
        conn.fetch_returns = [[]]
        monkeypatch.setattr(
            "app.services.metacognition._get_pool", make_pool_mock(conn)
        )
        await meta.get_reflection_history("user-xyz")
        # fetch(SQL, user_id, top_k) - args[1] 是 user_id
        assert conn.fetch_calls[0][1] == "user-xyz"


# =============================================================================
# Metacognition:build_system_prompt_snippet
# =============================================================================


class TestBuildSystemPromptSnippet:
    """build_system_prompt_snippet:system prompt 注入。"""

    def test_format_correct(self):
        """缓存有 entries → 返回正确格式。"""
        meta = Metacognition()
        meta._cache = [{
            "findings": [{"issue": "forgot 3 stale memories", "severity": "medium"}],
        }]
        snippet = meta.build_system_prompt_snippet(max_findings=3)
        assert "## 元认知提示" in snippet
        assert "基于最近反思,请注意:" in snippet
        assert "- forgot 3 stale memories" in snippet

    def test_max_findings_limits(self):
        """max_findings=1 → 只 1 条 finding。"""
        meta = Metacognition()
        meta._cache = [{
            "findings": [
                {"issue": "finding-1"},
                {"issue": "finding-2"},
                {"issue": "finding-3"},
            ],
        }]
        snippet = meta.build_system_prompt_snippet(max_findings=1)
        assert "- finding-1" in snippet
        assert "finding-2" not in snippet
        assert "finding-3" not in snippet

    def test_empty_cache_returns_empty(self):
        """空缓存 → 空字符串。"""
        meta = Metacognition()
        meta._cache = []
        assert meta.build_system_prompt_snippet() == ""

    def test_zero_max_findings_returns_empty(self):
        """max_findings=0 → 空字符串。"""
        meta = Metacognition()
        meta._cache = [{"findings": [{"issue": "x"}]}]
        assert meta.build_system_prompt_snippet(max_findings=0) == ""


# =============================================================================
# Metacognition:内部工具
# =============================================================================


class TestParseActionsJson:
    """_parse_actions_json:解析 LLM 返回的 JSON。"""

    def test_pure_json(self):
        meta = Metacognition()
        content = '{"actions": [{"target_id": "abc", "action": "forget", "reason": "r"}]}'
        actions = meta._parse_actions_json(content)
        assert len(actions) == 1
        assert actions[0]["target_id"] == "abc"
        assert actions[0]["action"] == "forget"

    def test_code_block(self):
        meta = Metacognition()
        content = '```json\n{"actions": [{"target_id": "xyz", "action": "demote", "reason": "r"}]}\n```'
        actions = meta._parse_actions_json(content)
        assert len(actions) == 1
        assert actions[0]["target_id"] == "xyz"

    def test_invalid_returns_empty(self):
        meta = Metacognition()
        assert meta._parse_actions_json("not json") == []
        assert meta._parse_actions_json("") == []
        assert meta._parse_actions_json('{"wrong": 1}') == []


class TestHeuristicActions:
    """_heuristic_actions:启发式规则生成 actions。"""

    def test_days_stale_gt_60_forgets(self):
        meta = Metacognition()
        sample = [make_stale_candidate(cid="id-1", days_stale=90)]
        actions = meta._heuristic_actions(sample)
        assert len(actions) == 1
        assert actions[0]["action"] == "forget"
        assert "days_stale=90" in actions[0]["reason"]

    def test_importance_lt_02_demotes(self):
        meta = Metacognition()
        sample = [make_stale_candidate(cid="id-2", days_stale=10, importance=0.1)]
        actions = meta._heuristic_actions(sample)
        assert len(actions) == 1
        assert actions[0]["action"] == "demote"
        assert "importance=0.1" in actions[0]["reason"]

    def test_keep_not_in_actions(self):
        """days_stale<=60 且 importance>=0.2 → keep,不产生 action。"""
        meta = Metacognition()
        sample = [make_stale_candidate(cid="id-3", days_stale=30, importance=0.5)]
        actions = meta._heuristic_actions(sample)
        assert len(actions) == 0


# =============================================================================
# 单例验证
# =============================================================================


class TestSingletons:
    """验证单例存在。"""

    def test_active_forgetter_singleton(self):
        assert active_forgetter is not None
        assert isinstance(active_forgetter, ActiveForgetter)

    def test_metacognition_singleton(self):
        assert metacognition is not None
        assert isinstance(metacognition, Metacognition)
