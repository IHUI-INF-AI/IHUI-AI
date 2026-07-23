"""LangGraph PostgresSaver wrapper 单元测试(P3 Q1.1,2026-07-23 立)。

覆盖维度(96 cases):
1. 模块常量与导出(_PSYCOPG_AVAILABLE / _LANGGRAPH_AVAILABLE / __all__)(4 tests)
2. _utcnow_iso:ISO8601 时间戳(3 tests)
3. _json_dumps:安全 JSON 序列化(5 tests)
4. LangGraphCheckpointManager 构造:db_url / _pool / _saver(3 tests)
5. _get_pool:降级路径 / 可用路径 / 缓存(5 tests)
6. get_saver:降级路径 / 可用路径 / 缓存 / setup(5 tests)
7. close:生命周期 / 异常处理(5 tests)
8. save_checkpoint:INSERT UPSERT / 参数 / JSON 序列化(5 tests)
9. get_checkpoint:单条查询 / dict 行 / tuple 行 / None(4 tests)
10. get_state_history:列表查询 / 排序 / limit(4 tests)
11. get_latest_checkpoint:最新 checkpoint / DESC LIMIT 1(3 tests)
12. save_write:INSERT / 参数 / JSON 序列化(4 tests)
13. get_graph_state:委托 graph.aget_state / interrupts(6 tests)
14. _row_to_checkpoint:dict / tuple / state None / datetime(5 tests)
15. _safe_json_loads:None / 合法 / 非法 / 非字符串 / 自定义 default(5 tests)
16. _isoformat:datetime / str / int(3 tests)
17. _safe_serialize:dict / None / 循环引用 / str(4 tests)
18. _serialize_interrupts:空 / None / 无 interrupts / 单 / 多(5 tests)
19. trigger_interrupt:HITL 中断事件构造(5 tests)
20. resume_from_interrupt:HITL 恢复命令 + action 校验(6 tests)
21. get_langgraph_checkpoint_manager:全局单例(4 tests)
22. thread_id 隔离:不同 thread_id 传不同参数(2 tests)
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import langgraph_checkpoint as mod
from app.services.langgraph_checkpoint import (
    LangGraphCheckpointManager,
    _isoformat,
    _json_dumps,
    _row_to_checkpoint,
    _safe_json_loads,
    _safe_serialize,
    _serialize_interrupts,
    _utcnow_iso,
    get_langgraph_checkpoint_manager,
    resume_from_interrupt,
    trigger_interrupt,
)


# =============================================================================
# Mock 辅助:Mock psycopg AsyncConnectionPool / AsyncPostgresSaver
# =============================================================================


class _MockCursor:
    """Mock psycopg cursor:fetchone / fetchall async。"""

    def __init__(self, fetchone_return=None, fetchall_return=None):
        self.fetchone = AsyncMock(return_value=fetchone_return)
        self.fetchall = AsyncMock(return_value=fetchall_return)


class _MockConn:
    """Mock psycopg AsyncConnection:execute 返回 cursor。"""

    def __init__(self, cursor=None):
        self._cursor = cursor or _MockCursor()
        self.execute = AsyncMock(return_value=self._cursor)


class _AsyncCtxMgr:
    """简易 async context manager(模拟 pool.connection() 返回值)。"""

    def __init__(self, value):
        self._value = value

    async def __aenter__(self):
        return self._value

    async def __aexit__(self, *args):
        return False


class _MockPool:
    """Mock psycopg AsyncConnectionPool:connection() async ctx mgr + open/close。"""

    def __init__(self, conn=None):
        self._conn = conn or _MockConn()
        self.open = AsyncMock()
        self.close = AsyncMock()
        self.connection_calls = 0

    def connection(self):
        self.connection_calls += 1
        return _AsyncCtxMgr(self._conn)


class _MockSaver:
    """Mock LangGraph AsyncPostgresSaver:setup async。"""

    def __init__(self):
        self.setup = AsyncMock()


def _enable_psycopg(
    monkeypatch,
    *,
    fetchone_return=None,
    fetchall_return=None,
):
    """启用 psycopg 路径(不含 langgraph),返回 (manager, mock_pool)。"""
    monkeypatch.setattr(mod, "_PSYCOPG_AVAILABLE", True)
    cursor = _MockCursor(
        fetchone_return=fetchone_return,
        fetchall_return=fetchall_return,
    )
    conn = _MockConn(cursor=cursor)
    pool = _MockPool(conn=conn)
    monkeypatch.setattr(mod, "AsyncConnectionPool", MagicMock(return_value=pool))
    manager = LangGraphCheckpointManager(db_url="postgresql://test")
    return manager, pool


def _enable_both(
    monkeypatch,
    *,
    fetchone_return=None,
    fetchall_return=None,
):
    """启用 psycopg + langgraph,返回 (manager, mock_pool, mock_saver)。"""
    manager, pool = _enable_psycopg(
        monkeypatch,
        fetchone_return=fetchone_return,
        fetchall_return=fetchall_return,
    )
    monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
    saver = _MockSaver()
    monkeypatch.setattr(mod, "AsyncPostgresSaver", MagicMock(return_value=saver))
    return manager, pool, saver


def _make_snapshot(
    values=None,
    next_nodes=(),
    config=None,
    tasks=(),
):
    """构造 graph StateSnapshot mock。"""
    snap = MagicMock()
    snap.values = values if values is not None else {}
    snap.next = next_nodes
    snap.config = config if config is not None else {}
    snap.tasks = tasks
    return snap


def _make_interrupt(
    interrupt_id="i1",
    value="v",
    resumable=True,
    ns=None,
):
    """构造 interrupt mock。"""
    intr = MagicMock()
    intr.interrupt_id = interrupt_id
    intr.value = value
    intr.resumable = resumable
    intr.ns = ns
    return intr


def _make_task(interrupts=()):
    """构造 task mock。"""
    task = MagicMock()
    task.interrupts = list(interrupts) if interrupts else []
    return task


# =============================================================================
# 1. 模块常量与导出(4 tests)
# =============================================================================


class TestModuleConstants:
    """模块级常量与 __all__ 导出。"""

    def test_psycopg_available_is_bool(self):
        """_PSYCOPG_AVAILABLE 是布尔值(测试环境通常 False)。"""
        assert isinstance(mod._PSYCOPG_AVAILABLE, bool)

    def test_langgraph_available_is_bool(self):
        """_LANGGRAPH_AVAILABLE 是布尔值。"""
        assert isinstance(mod._LANGGRAPH_AVAILABLE, bool)

    def test_all_contains_four_names(self):
        """__all__ 包含 4 个公开 API。"""
        assert set(mod.__all__) == {
            "LangGraphCheckpointManager",
            "get_langgraph_checkpoint_manager",
            "trigger_interrupt",
            "resume_from_interrupt",
        }

    def test_all_names_exist_in_module(self):
        """__all__ 中的名称在模块中均可访问。"""
        for name in mod.__all__:
            assert hasattr(mod, name), f"{name} 不在模块中"


# =============================================================================
# 2. _utcnow_iso(3 tests)
# =============================================================================


class TestUtcnowIso:
    """_utcnow_iso:当前 UTC 时间 ISO8601 字符串。"""

    def test_returns_iso_string(self):
        result = _utcnow_iso()
        parsed = datetime.fromisoformat(result)
        assert parsed.tzinfo is not None

    def test_close_to_current_time(self):
        before = datetime.now(timezone.utc)
        result = _utcnow_iso()
        after = datetime.now(timezone.utc)
        parsed = datetime.fromisoformat(result)
        assert before <= parsed <= after

    def test_contains_timezone_offset(self):
        result = _utcnow_iso()
        assert "+00:00" in result or "Z" in result or "+" in result


# =============================================================================
# 3. _json_dumps(5 tests)
# =============================================================================


class TestJsonDumps:
    """_json_dumps:安全 JSON 序列化(ensure_ascii=False)。"""

    def test_dict_serialized(self):
        result = _json_dumps({"key": "val", "num": 42})
        assert json.loads(result) == {"key": "val", "num": 42}

    def test_chinese_not_escaped(self):
        """ensure_ascii=False → 中文字符原样输出。"""
        result = _json_dumps({"name": "你好世界"})
        assert "你好世界" in result
        assert "\\u" not in result

    def test_non_serializable_uses_str_default(self):
        """不可序列化对象通过 default=str 转 str。"""

        class Foo:
            def __str__(self):
                return "foo-instance"

        result = _json_dumps({"obj": Foo()})
        assert "foo-instance" in result

    def test_none_returns_null_string(self):
        result = _json_dumps(None)
        assert result == "null"

    def test_list_serialized(self):
        result = _json_dumps([1, "two", {"three": 3}])
        assert json.loads(result) == [1, "two", {"three": 3}]


# =============================================================================
# 4. LangGraphCheckpointManager 构造(3 tests)
# =============================================================================


class TestManagerInit:
    """LangGraphCheckpointManager 初始化。"""

    def test_db_url_stored(self):
        m = LangGraphCheckpointManager(db_url="postgresql://custom")
        assert m.db_url == "postgresql://custom"

    def test_pool_initially_none(self):
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        assert m._pool is None

    def test_saver_initially_none(self):
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        assert m._saver is None


# =============================================================================
# 5. _get_pool(5 tests)
# =============================================================================


class TestGetPool:
    """_get_pool:psycopg 降级 / 可用路径 / 缓存。"""

    @pytest.mark.asyncio
    async def test_unavailable_raises_runtime_error(self, monkeypatch):
        """_PSYCOPG_AVAILABLE=False → RuntimeError。"""
        monkeypatch.setattr(mod, "_PSYCOPG_AVAILABLE", False)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        with pytest.raises(RuntimeError, match="psycopg"):
            await m._get_pool()

    @pytest.mark.asyncio
    async def test_available_creates_pool(self, monkeypatch):
        """_PSYCOPG_AVAILABLE=True → 创建 AsyncConnectionPool。"""
        m, pool = _enable_psycopg(monkeypatch)
        result = await m._get_pool()
        assert result is pool

    @pytest.mark.asyncio
    async def test_open_called_on_creation(self, monkeypatch):
        """首次创建时调用 pool.open()。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m._get_pool()
        pool.open.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cached_on_second_call(self, monkeypatch):
        """第二次调用返回缓存,不重复创建 / open。"""
        m, pool = _enable_psycopg(monkeypatch)
        p1 = await m._get_pool()
        p2 = await m._get_pool()
        assert p1 is p2
        pool.open.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_pool_kwargs_correct(self, monkeypatch):
        """AsyncConnectionPool 构造参数正确。"""
        mock_pool = _MockPool()
        pool_cls = MagicMock(return_value=mock_pool)
        monkeypatch.setattr(mod, "_PSYCOPG_AVAILABLE", True)
        monkeypatch.setattr(mod, "AsyncConnectionPool", pool_cls)
        m = LangGraphCheckpointManager(db_url="postgresql://custom")
        await m._get_pool()
        call_kwargs = pool_cls.call_args.kwargs
        assert call_kwargs["conninfo"] == "postgresql://custom"
        assert call_kwargs["max_size"] == 20
        assert call_kwargs["open"] is False
        assert call_kwargs["kwargs"]["autocommit"] is True
        assert call_kwargs["kwargs"]["prepare_threshold"] == 0


# =============================================================================
# 6. get_saver(5 tests)
# =============================================================================


class TestGetSaver:
    """get_saver:langgraph 降级 / 可用路径 / 缓存 / setup。"""

    @pytest.mark.asyncio
    async def test_langgraph_unavailable_raises(self, monkeypatch):
        """_LANGGRAPH_AVAILABLE=False → RuntimeError。"""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", False)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        with pytest.raises(RuntimeError, match="langgraph-checkpoint-postgres"):
            await m.get_saver()

    @pytest.mark.asyncio
    async def test_available_creates_saver(self, monkeypatch):
        """两个依赖都可用时创建 AsyncPostgresSaver。"""
        m, pool, saver = _enable_both(monkeypatch)
        result = await m.get_saver()
        assert result is saver

    @pytest.mark.asyncio
    async def test_setup_called(self, monkeypatch):
        """首次创建时调用 saver.setup()。"""
        m, pool, saver = _enable_both(monkeypatch)
        await m.get_saver()
        saver.setup.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cached_on_second_call(self, monkeypatch):
        """第二次调用返回缓存,不重复创建 / setup。"""
        m, pool, saver = _enable_both(monkeypatch)
        s1 = await m.get_saver()
        s2 = await m.get_saver()
        assert s1 is s2
        saver.setup.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_saver_receives_pool(self, monkeypatch):
        """AsyncPostgresSaver 构造时接收 pool 参数。"""
        m, pool, saver = _enable_both(monkeypatch)
        saver_cls = mod.AsyncPostgresSaver
        await m.get_saver()
        saver_cls.assert_called_once_with(pool)


# =============================================================================
# 7. close(5 tests)
# =============================================================================


class TestClose:
    """close:连接池 + saver 生命周期清理。"""

    @pytest.mark.asyncio
    async def test_both_none_noop(self):
        """_pool 和 _saver 都 None → close 不报错。"""
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        await m.close()
        assert m._pool is None
        assert m._saver is None

    @pytest.mark.asyncio
    async def test_pool_closed(self, monkeypatch):
        """有 pool 时 close 调用 pool.close()。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m._get_pool()
        await m.close()
        pool.close.assert_awaited_once()
        assert m._pool is None

    @pytest.mark.asyncio
    async def test_saver_cleared(self, monkeypatch):
        """有 saver 时 close 清空 _saver + 关闭 pool。"""
        m, pool, saver = _enable_both(monkeypatch)
        await m.get_saver()
        await m.close()
        assert m._saver is None
        assert m._pool is None
        pool.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_pool_close_exception_handled(self, monkeypatch):
        """pool.close() 抛异常时被捕获,_pool 仍重置为 None。"""
        m, pool = _enable_psycopg(monkeypatch)
        pool.close = AsyncMock(side_effect=RuntimeError("close failed"))
        await m._get_pool()
        await m.close()  # 不应抛异常
        assert m._pool is None

    @pytest.mark.asyncio
    async def test_saver_none_pool_set_only_pool_closed(self, monkeypatch):
        """_saver=None + _pool 有值 → 只关闭 pool。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m._get_pool()
        assert m._saver is None
        await m.close()
        pool.close.assert_awaited_once()
        assert m._pool is None
        assert m._saver is None


# =============================================================================
# 8. save_checkpoint(5 tests)
# =============================================================================


class TestSaveCheckpoint:
    """save_checkpoint:写 langgraph_checkpoints 表(UPSERT)。"""

    @pytest.mark.asyncio
    async def test_executes_insert(self, monkeypatch):
        """执行 INSERT 语句。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m.save_checkpoint("t1", "c1", "n1", {"key": "val"}, parent_id="p1")
        pool._conn.execute.assert_awaited_once()
        sql = pool._conn.execute.call_args.args[0]
        assert "INSERT INTO langgraph_checkpoints" in sql

    @pytest.mark.asyncio
    async def test_parent_id_none_passed(self, monkeypatch):
        """parent_id=None 时传 None。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m.save_checkpoint("t1", "c1", "n1", {}, parent_id=None)
        args = pool._conn.execute.call_args.args
        assert args[3] is None

    @pytest.mark.asyncio
    async def test_state_json_serialized(self, monkeypatch):
        """state 被 JSON 序列化为字符串。"""
        m, pool = _enable_psycopg(monkeypatch)
        state = {"key": "val", "num": 42}
        await m.save_checkpoint("t1", "c1", "n1", state)
        args = pool._conn.execute.call_args.args
        assert isinstance(args[5], str)
        assert json.loads(args[5]) == state

    @pytest.mark.asyncio
    async def test_all_params_passed(self, monkeypatch):
        """所有参数按顺序传递。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m.save_checkpoint("t1", "c1", "n1", {"a": 1}, parent_id="p1")
        args = pool._conn.execute.call_args.args
        assert args[1] == "t1"
        assert args[2] == "c1"
        assert args[3] == "p1"
        assert args[4] == "n1"
        assert json.loads(args[5]) == {"a": 1}
        datetime.fromisoformat(args[6])

    @pytest.mark.asyncio
    async def test_on_conflict_upsert_sql(self, monkeypatch):
        """SQL 包含 ON CONFLICT DO UPDATE(UPSERT)。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m.save_checkpoint("t1", "c1", "n1", {})
        sql = pool._conn.execute.call_args.args[0]
        assert "ON CONFLICT" in sql
        assert "DO UPDATE" in sql
        assert "thread_id" in sql
        assert "checkpoint_id" in sql


# =============================================================================
# 9. get_checkpoint(4 tests)
# =============================================================================


class TestGetCheckpoint:
    """get_checkpoint:单条 checkpoint 查询。"""

    @pytest.mark.asyncio
    async def test_row_found_returns_dict(self, monkeypatch):
        """查到 tuple 行 → 返回 camelCase dict。"""
        row = ("t1", "c1", "p1", "n1", '{"x": 1}', "2026-01-01T00:00:00+00:00")
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=row)
        result = await m.get_checkpoint("t1", "c1")
        assert result is not None
        assert result["threadId"] == "t1"
        assert result["checkpointId"] == "c1"
        assert result["parentId"] == "p1"
        assert result["nodeId"] == "n1"
        assert result["state"] == {"x": 1}
        assert result["createdAt"] == "2026-01-01T00:00:00+00:00"

    @pytest.mark.asyncio
    async def test_row_none_returns_none(self, monkeypatch):
        """查询无结果 → None。"""
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=None)
        result = await m.get_checkpoint("t1", "c1")
        assert result is None

    @pytest.mark.asyncio
    async def test_dict_row_handled(self, monkeypatch):
        """dict 行(psycopg dict_row)也能处理。"""
        row = {
            "thread_id": "t1",
            "checkpoint_id": "c1",
            "parent_id": None,
            "node_id": "n1",
            "state": '{"y": 2}',
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=row)
        result = await m.get_checkpoint("t1", "c1")
        assert result["threadId"] == "t1"
        assert result["state"] == {"y": 2}
        assert result["parentId"] is None

    @pytest.mark.asyncio
    async def test_sql_contains_where_clause(self, monkeypatch):
        """SQL 包含 WHERE thread_id + checkpoint_id。"""
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=None)
        await m.get_checkpoint("t1", "c1")
        sql = pool._conn.execute.call_args.args[0]
        assert "WHERE thread_id = %s AND checkpoint_id = %s" in sql
        assert "FROM langgraph_checkpoints" in sql


# =============================================================================
# 10. get_state_history(4 tests)
# =============================================================================


class TestGetStateHistory:
    """get_state_history:线程历史查询(Time Travel)。"""

    @pytest.mark.asyncio
    async def test_empty_list(self, monkeypatch):
        """无历史 → 空列表。"""
        m, pool = _enable_psycopg(monkeypatch, fetchall_return=[])
        result = await m.get_state_history("t1")
        assert result == []

    @pytest.mark.asyncio
    async def test_multiple_rows(self, monkeypatch):
        """多行历史 → list[dict]。"""
        rows = [
            ("t1", "c1", None, "n1", '{"s": 1}', "2026-01-01T00:00:00+00:00"),
            ("t1", "c2", "c1", "n2", '{"s": 2}', "2026-01-01T01:00:00+00:00"),
        ]
        m, pool = _enable_psycopg(monkeypatch, fetchall_return=rows)
        result = await m.get_state_history("t1")
        assert len(result) == 2
        assert result[0]["checkpointId"] == "c1"
        assert result[1]["checkpointId"] == "c2"
        assert result[1]["parentId"] == "c1"

    @pytest.mark.asyncio
    async def test_limit_passed_to_sql(self, monkeypatch):
        """limit 参数传递给 SQL。"""
        m, pool = _enable_psycopg(monkeypatch, fetchall_return=[])
        await m.get_state_history("t1", limit=50)
        args = pool._conn.execute.call_args.args
        assert args[2] == 50

    @pytest.mark.asyncio
    async def test_sql_order_by_asc(self, monkeypatch):
        """SQL 包含 ORDER BY created_at ASC。"""
        m, pool = _enable_psycopg(monkeypatch, fetchall_return=[])
        await m.get_state_history("t1")
        sql = pool._conn.execute.call_args.args[0]
        assert "ORDER BY created_at ASC" in sql
        assert "LIMIT %s" in sql


# =============================================================================
# 11. get_latest_checkpoint(3 tests)
# =============================================================================


class TestGetLatestCheckpoint:
    """get_latest_checkpoint:线程最新 checkpoint。"""

    @pytest.mark.asyncio
    async def test_found_returns_dict(self, monkeypatch):
        """查到 → 返回 dict。"""
        row = ("t1", "c2", "c1", "n2", '{"latest": true}', "2026-01-01T02:00:00+00:00")
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=row)
        result = await m.get_latest_checkpoint("t1")
        assert result is not None
        assert result["checkpointId"] == "c2"
        assert result["state"] == {"latest": True}

    @pytest.mark.asyncio
    async def test_not_found_returns_none(self, monkeypatch):
        """无结果 → None。"""
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=None)
        result = await m.get_latest_checkpoint("t1")
        assert result is None

    @pytest.mark.asyncio
    async def test_sql_order_by_desc_limit_1(self, monkeypatch):
        """SQL 包含 ORDER BY created_at DESC LIMIT 1。"""
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=None)
        await m.get_latest_checkpoint("t1")
        sql = pool._conn.execute.call_args.args[0]
        assert "ORDER BY created_at DESC" in sql
        assert "LIMIT 1" in sql


# =============================================================================
# 12. save_write(4 tests)
# =============================================================================


class TestSaveWrite:
    """save_write:写 langgraph_writes 表。"""

    @pytest.mark.asyncio
    async def test_executes_insert(self, monkeypatch):
        """执行 INSERT 语句。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m.save_write("t1", "c1", "task1", "channel1", {"v": 1})
        pool._conn.execute.assert_awaited_once()
        sql = pool._conn.execute.call_args.args[0]
        assert "INSERT INTO langgraph_writes" in sql

    @pytest.mark.asyncio
    async def test_value_json_serialized(self, monkeypatch):
        """value 被 JSON 序列化。"""
        m, pool = _enable_psycopg(monkeypatch)
        value = {"output": "result", "count": 3}
        await m.save_write("t1", "c1", "task1", "channel1", value)
        args = pool._conn.execute.call_args.args
        assert isinstance(args[5], str)
        assert json.loads(args[5]) == value

    @pytest.mark.asyncio
    async def test_all_params_passed(self, monkeypatch):
        """所有参数按顺序传递。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m.save_write("t1", "c1", "task1", "channel1", "raw-value")
        args = pool._conn.execute.call_args.args
        assert args[1] == "t1"
        assert args[2] == "c1"
        assert args[3] == "task1"
        assert args[4] == "channel1"
        assert args[5] == '"raw-value"'
        datetime.fromisoformat(args[6])

    @pytest.mark.asyncio
    async def test_sql_contains_all_columns(self, monkeypatch):
        """SQL 包含所有列名。"""
        m, pool = _enable_psycopg(monkeypatch)
        await m.save_write("t1", "c1", "task1", "ch", "val")
        sql = pool._conn.execute.call_args.args[0]
        for col in ("thread_id", "checkpoint_id", "task_id", "channel", "value", "created_at"):
            assert col in sql


# =============================================================================
# 13. get_graph_state(6 tests)
# =============================================================================


class TestGetGraphState:
    """get_graph_state:委托 graph.aget_state 读取状态快照。"""

    @pytest.mark.asyncio
    async def test_langgraph_unavailable_raises(self, monkeypatch):
        """_LANGGRAPH_AVAILABLE=False → RuntimeError。"""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", False)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        graph = MagicMock()
        with pytest.raises(RuntimeError, match="langgraph"):
            await m.get_graph_state(graph, "t1")

    @pytest.mark.asyncio
    async def test_snapshot_none_returns_none(self, monkeypatch):
        """snapshot 为 None → None。"""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=None)
        result = await m.get_graph_state(graph, "t1")
        assert result is None

    @pytest.mark.asyncio
    async def test_full_snapshot(self, monkeypatch):
        """完整 snapshot → dict(values/next/config/interrupts)。"""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        snap = _make_snapshot(
            values={"key": "val"},
            next_nodes=("node1",),
            config={"configurable": {"thread_id": "t1"}},
            tasks=(),
        )
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=snap)
        result = await m.get_graph_state(graph, "t1")
        assert result["values"] == {"key": "val"}
        assert result["next"] == ["node1"]
        assert result["config"] == {"configurable": {"thread_id": "t1"}}
        assert result["interrupts"] == []

    @pytest.mark.asyncio
    async def test_empty_next_returns_empty_list(self, monkeypatch):
        """next 为空元组 → []."""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        snap = _make_snapshot(next_nodes=())
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=snap)
        result = await m.get_graph_state(graph, "t1")
        assert result["next"] == []

    @pytest.mark.asyncio
    async def test_tasks_with_interrupts(self, monkeypatch):
        """tasks 含 interrupts → 提取为 list[dict]。"""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        intr = _make_interrupt(
            interrupt_id="i1", value="need input", resumable=True, ns=["ns1"],
        )
        task = _make_task(interrupts=[intr])
        snap = _make_snapshot(tasks=(task,))
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=snap)
        result = await m.get_graph_state(graph, "t1")
        assert len(result["interrupts"]) == 1
        assert result["interrupts"][0]["interrupt_id"] == "i1"
        assert result["interrupts"][0]["value"] == "need input"
        assert result["interrupts"][0]["resumable"] is True
        assert result["interrupts"][0]["ns"] == ["ns1"]

    @pytest.mark.asyncio
    async def test_config_passed_correctly(self, monkeypatch):
        """graph.aget_state 收到正确的 config(thread_id)。"""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        m = LangGraphCheckpointManager(db_url="postgresql://test")
        snap = _make_snapshot()
        graph = MagicMock()
        graph.aget_state = AsyncMock(return_value=snap)
        await m.get_graph_state(graph, "my-thread")
        call_args = graph.aget_state.call_args
        assert call_args.args[0] == {"configurable": {"thread_id": "my-thread"}}


# =============================================================================
# 14. _row_to_checkpoint(5 tests)
# =============================================================================


class TestRowToCheckpoint:
    """_row_to_checkpoint:psycopg 行 → camelCase dict。"""

    def test_tuple_row(self):
        """tuple 行:6 元组按位置解包。"""
        row = ("t1", "c1", "p1", "n1", '{"x": 1}', "2026-01-01T00:00:00+00:00")
        result = _row_to_checkpoint(row)
        assert result["threadId"] == "t1"
        assert result["checkpointId"] == "c1"
        assert result["parentId"] == "p1"
        assert result["nodeId"] == "n1"
        assert result["state"] == {"x": 1}
        assert result["createdAt"] == "2026-01-01T00:00:00+00:00"

    def test_dict_row(self):
        """dict 行:按键名取值。"""
        row = {
            "thread_id": "t2",
            "checkpoint_id": "c2",
            "parent_id": None,
            "node_id": "n2",
            "state": '{"y": 2}',
            "created_at": "2026-02-01T00:00:00+00:00",
        }
        result = _row_to_checkpoint(row)
        assert result["threadId"] == "t2"
        assert result["parentId"] is None
        assert result["state"] == {"y": 2}

    def test_state_none_returns_default_empty_dict(self):
        """state=None → 默认 {}。"""
        row = ("t1", "c1", None, "n1", None, "2026-01-01T00:00:00+00:00")
        result = _row_to_checkpoint(row)
        assert result["state"] == {}

    def test_created_at_datetime_converted_to_iso(self):
        """created_at 为 datetime → isoformat 字符串。"""
        dt = datetime(2026, 7, 23, 12, 0, 0, tzinfo=timezone.utc)
        row = ("t1", "c1", None, "n1", "{}", dt)
        result = _row_to_checkpoint(row)
        assert result["createdAt"] == dt.isoformat()

    def test_all_fields_camelcase(self):
        """所有字段名为 camelCase。"""
        row = ("t1", "c1", "p1", "n1", "{}", "2026-01-01T00:00:00+00:00")
        result = _row_to_checkpoint(row)
        expected_keys = {"threadId", "checkpointId", "parentId", "nodeId", "state", "createdAt"}
        assert set(result.keys()) == expected_keys


# =============================================================================
# 15. _safe_json_loads(5 tests)
# =============================================================================


class TestSafeJsonLoads:
    """_safe_json_loads:安全 JSON 反序列化。"""

    def test_none_returns_default(self):
        assert _safe_json_loads(None, default={}) == {}

    def test_valid_json_string(self):
        assert _safe_json_loads('{"key": "val"}') == {"key": "val"}

    def test_invalid_json_string_returns_default(self):
        assert _safe_json_loads("not json", default={}) == {}

    def test_non_string_passthrough(self):
        """非字符串(如 dict / list)原样返回。"""
        obj = {"already": "dict"}
        assert _safe_json_loads(obj) is obj

    def test_custom_default(self):
        assert _safe_json_loads(None, default=None) is None
        assert _safe_json_loads("bad", default=[]) == []


# =============================================================================
# 16. _isoformat(3 tests)
# =============================================================================


class TestIsoformat:
    """_isoformat:datetime / str 统一为 ISO 字符串。"""

    def test_datetime_returns_isoformat(self):
        dt = datetime(2026, 7, 23, 12, 0, 0, tzinfo=timezone.utc)
        assert _isoformat(dt) == dt.isoformat()

    def test_str_returns_as_is(self):
        assert _isoformat("2026-01-01T00:00:00+00:00") == "2026-01-01T00:00:00+00:00"

    def test_int_returns_str(self):
        assert _isoformat(42) == "42"


# =============================================================================
# 17. _safe_serialize(4 tests)
# =============================================================================


class TestSafeSerialize:
    """_safe_serialize:JSON 可序列化 → 原值,否则 str 兜底。"""

    def test_dict_returns_as_is(self):
        d = {"key": "val"}
        assert _safe_serialize(d) is d

    def test_none_returns_none(self):
        assert _safe_serialize(None) is None

    def test_circular_reference_returns_str(self):
        """循环引用触发 ValueError → 返回 str(value)。"""
        a = []
        a.append(a)
        result = _safe_serialize(a)
        assert isinstance(result, str)

    def test_str_returns_as_is(self):
        assert _safe_serialize("hello") == "hello"


# =============================================================================
# 18. _serialize_interrupts(5 tests)
# =============================================================================


class TestSerializeInterrupts:
    """_serialize_interrupts:从 tasks 提取 interrupt 信息。"""

    def test_empty_tasks(self):
        assert _serialize_interrupts(()) == []

    def test_none_tasks(self):
        assert _serialize_interrupts(None) == []

    def test_task_no_interrupts_attr(self):
        """task 无 interrupts 属性 → getattr 默认 () → 空列表。"""
        task = object()
        assert _serialize_interrupts([task]) == []

    def test_task_with_one_interrupt(self):
        intr = MagicMock()
        intr.interrupt_id = "i1"
        intr.value = "need input"
        intr.resumable = True
        intr.ns = ["ns1"]
        task = MagicMock()
        task.interrupts = [intr]
        result = _serialize_interrupts([task])
        assert len(result) == 1
        assert result[0]["interrupt_id"] == "i1"
        assert result[0]["value"] == "need input"
        assert result[0]["resumable"] is True
        assert result[0]["ns"] == ["ns1"]

    def test_multiple_tasks_multiple_interrupts(self):
        """多个 task 各含多个 interrupt → 全部收集。"""
        intr1 = MagicMock()
        intr1.interrupt_id = "i1"
        intr1.value = "v1"
        intr1.resumable = True
        intr1.ns = None

        intr2 = MagicMock()
        intr2.interrupt_id = "i2"
        intr2.value = "v2"
        intr2.resumable = False
        intr2.ns = ["n"]

        task1 = MagicMock()
        task1.interrupts = [intr1]
        task2 = MagicMock()
        task2.interrupts = [intr2, intr1]

        result = _serialize_interrupts([task1, task2])
        assert len(result) == 3
        assert result[0]["interrupt_id"] == "i1"
        assert result[1]["interrupt_id"] == "i2"
        assert result[1]["resumable"] is False
        assert result[2]["interrupt_id"] == "i1"


# =============================================================================
# 19. trigger_interrupt(5 tests)
# =============================================================================


class TestTriggerInterrupt:
    """trigger_interrupt:HITL 中断事件构造。"""

    @pytest.mark.asyncio
    async def test_langgraph_unavailable_raises(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", False)
        with pytest.raises(RuntimeError, match="langgraph"):
            await trigger_interrupt("t1", "n1", "need input")

    @pytest.mark.asyncio
    async def test_returns_event_with_all_fields(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        event = await trigger_interrupt("t1", "n1", "need input", payload={"data": 1})
        assert event["threadId"] == "t1"
        assert event["nodeId"] == "n1"
        assert event["reason"] == "need input"
        assert event["payload"] == {"data": 1}
        assert "interruptId" in event
        assert "createdAt" in event

    @pytest.mark.asyncio
    async def test_interrupt_id_is_uuid_hex(self, monkeypatch):
        """interruptId 是 uuid4().hex(32 位十六进制)。"""
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        event = await trigger_interrupt("t1", "n1", "r")
        assert len(event["interruptId"]) == 32
        int(event["interruptId"], 16)

    @pytest.mark.asyncio
    async def test_payload_none(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        event = await trigger_interrupt("t1", "n1", "r", payload=None)
        assert event["payload"] is None

    @pytest.mark.asyncio
    async def test_created_at_is_iso(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        event = await trigger_interrupt("t1", "n1", "r")
        datetime.fromisoformat(event["createdAt"])


# =============================================================================
# 20. resume_from_interrupt(6 tests)
# =============================================================================


class TestResumeFromInterrupt:
    """resume_from_interrupt:HITL 恢复命令 + action 校验。"""

    @pytest.mark.asyncio
    async def test_langgraph_unavailable_raises(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", False)
        with pytest.raises(RuntimeError, match="langgraph"):
            await resume_from_interrupt("t1", "i1", "val")

    @pytest.mark.asyncio
    async def test_resume_action(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        cmd = await resume_from_interrupt("t1", "i1", "resume-val", action="resume")
        assert cmd["threadId"] == "t1"
        assert cmd["interruptId"] == "i1"
        assert cmd["resumeValue"] == "resume-val"
        assert cmd["action"] == "resume"

    @pytest.mark.asyncio
    async def test_rollback_action(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        cmd = await resume_from_interrupt("t1", "i1", None, action="rollback")
        assert cmd["action"] == "rollback"
        assert cmd["resumeValue"] is None

    @pytest.mark.asyncio
    async def test_cancel_action(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        cmd = await resume_from_interrupt("t1", "i1", "cancel-val", action="cancel")
        assert cmd["action"] == "cancel"

    @pytest.mark.asyncio
    async def test_invalid_action_raises_value_error(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        with pytest.raises(ValueError, match="非法 action"):
            await resume_from_interrupt("t1", "i1", "val", action="invalid")

    @pytest.mark.asyncio
    async def test_default_action_is_resume(self, monkeypatch):
        monkeypatch.setattr(mod, "_LANGGRAPH_AVAILABLE", True)
        cmd = await resume_from_interrupt("t1", "i1", "val")
        assert cmd["action"] == "resume"


# =============================================================================
# 21. get_langgraph_checkpoint_manager(4 tests)
# =============================================================================


@pytest.fixture
def _reset_manager(monkeypatch):
    """每个测试前重置模块级 _manager 单例。"""
    monkeypatch.setattr(mod, "_manager", None)


class TestGetManager:
    """get_langgraph_checkpoint_manager:全局单例工厂。"""

    def test_returns_manager_instance(self, _reset_manager):
        m = get_langgraph_checkpoint_manager()
        assert isinstance(m, LangGraphCheckpointManager)

    def test_singleton_same_instance(self, _reset_manager):
        m1 = get_langgraph_checkpoint_manager()
        m2 = get_langgraph_checkpoint_manager()
        assert m1 is m2

    def test_reads_database_url(self, _reset_manager, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "database_url", "postgresql://custom-db")
        m = get_langgraph_checkpoint_manager()
        assert m.db_url == "postgresql://custom-db"

    def test_lazy_init_only_creates_once(self, _reset_manager):
        assert mod._manager is None
        m = get_langgraph_checkpoint_manager()
        assert mod._manager is m
        m2 = get_langgraph_checkpoint_manager()
        assert mod._manager is m2


# =============================================================================
# 22. thread_id 隔离(2 tests)
# =============================================================================


class TestThreadIdIsolation:
    """thread_id 隔离:不同 thread_id 传不同参数,SQL WHERE 正确。"""

    @pytest.mark.asyncio
    async def test_different_thread_ids_pass_different_params(self, monkeypatch):
        """不同 thread_id 调用 get_checkpoint → 传不同参数。"""
        m, pool = _enable_psycopg(monkeypatch, fetchone_return=None)
        await m.get_checkpoint("thread-A", "c1")
        await m.get_checkpoint("thread-B", "c1")
        assert pool._conn.execute.call_count == 2
        first_call = pool._conn.execute.call_args_list[0]
        second_call = pool._conn.execute.call_args_list[1]
        assert first_call.args[1] == "thread-A"
        assert second_call.args[1] == "thread-B"

    @pytest.mark.asyncio
    async def test_state_history_filters_by_thread_id(self, monkeypatch):
        """get_state_history SQL 包含 WHERE thread_id = %s。"""
        m, pool = _enable_psycopg(monkeypatch, fetchall_return=[])
        await m.get_state_history("isolated-thread")
        sql = pool._conn.execute.call_args.args[0]
        assert "WHERE thread_id = %s" in sql
        assert pool._conn.execute.call_args.args[1] == "isolated-thread"
