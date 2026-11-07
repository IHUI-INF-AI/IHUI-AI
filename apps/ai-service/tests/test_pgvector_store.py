# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""D8 pgvector_store 单元测试(2026-09-19 立)。

不依赖真实 PostgreSQL:mock 共享连接池,验证 SQL 组装/熔断/降级/维度过滤。
"""

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import pgvector_store
from app.services.pgvector_store import (
    PgVectorSchemaUnavailable,
    _ensure_schema,
    _reset_circuit,
    _vec_literal,
    clear_chunks,
    delete_chunk,
    search_chunks,
    upsert_chunk,
)


@pytest.fixture(autouse=True)
def _fresh_state(monkeypatch: pytest.MonkeyPatch) -> Any:
    # 全局 conftest 的 vector_memory 隔离夹具会给**每条**用例设
    # IHUI_PGVECTOR_DISABLE=1(tests/conftest.py:530),而 pgvector_store 的入口把它当
    # "本能力未启用"直接早退 ⇒ 本文件此前 4 条红不是代码坏了,是被上级夹具整片关掉;
    # 另两条(test_extension_missing / circuit_breaker)则是"因为早退才绿"——假绿。
    # 本模块自己判的是 fake pool 的 SQL 形状,必须在这一格里把该 env 撤掉。
    # 同型先例:tests/test_vector_memory.py:939。
    monkeypatch.delenv("IHUI_PGVECTOR_DISABLE", raising=False)
    _reset_circuit()
    yield
    _reset_circuit()


class _DbError(Exception):
    """带 SQLSTATE 的假 DB 异常(模拟 asyncpg / psycopg2 的错误码属性)。"""

    def __init__(self, msg: str, sqlstate: str | None = None) -> None:
        super().__init__(msg)
        self.sqlstate = sqlstate


class _FakeConn:
    def __init__(
        self,
        extension_available: bool = True,
        fail_sql: tuple[str, Exception] | None = None,
    ) -> None:
        self.extension_available = extension_available
        self.fail_sql = fail_sql
        self.executed: list[str] = []

    async def execute(self, sql: str, *args: Any) -> None:
        if self.fail_sql and self.fail_sql[0] in sql:
            raise self.fail_sql[1]
        self.executed.append(sql)

    async def fetchval(self, sql: str, *args: Any) -> Any:
        if "pg_extension" in sql:
            return self.extension_available
        return None


class _FakePool:
    def __init__(
        self,
        extension_available: bool = True,
        fail_sql: tuple[str, Exception] | None = None,
    ) -> None:
        self.conn = _FakeConn(extension_available, fail_sql)
        self.fetch = AsyncMock(return_value=[])
        self.fetchrow = AsyncMock(return_value=None)
        self.execute = AsyncMock()

    def acquire(self) -> Any:
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=self.conn)
        cm.__aexit__ = AsyncMock(return_value=False)
        return cm


def _pool_cm(pool: _FakePool) -> Any:
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=pool.conn)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


def test_vec_literal_formats_floats() -> None:
    assert _vec_literal([1.0, -0.5, 3]) == "[1,-0.5,3]"


async def test_upsert_success_sql_shape() -> None:
    pool = _FakePool()
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        ok = await upsert_chunk("ns", "entries", "e1", "content", [0.1, 0.2], {"a": 1})
    assert ok is True
    assert any("INSERT INTO rag_chunks" in str(c.args[0]) for c in pool.execute.await_args_list)
    assert any("ON CONFLICT" in str(c.args[0]) for c in pool.execute.await_args_list)
    assert any("CREATE TABLE IF NOT EXISTS rag_chunks" in s for s in pool.conn.executed)


async def test_search_dimension_filter_and_threshold() -> None:
    pool = _FakePool()
    pool.fetch = AsyncMock(
        return_value=[
            {"ref_id": "e1", "metadata_json": '{"k":1}', "similarity": 0.9},
            {"ref_id": "e2", "metadata_json": "{}", "similarity": 0.5},
        ]
    )
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        results = await search_chunks("ns", [0.1, 0.2], top_k=5, threshold=0.7)
    # 阈值 0.7:0.9 保留,0.5 过滤
    assert [r[0] for r in results] == ["e1"]
    assert results[0][1] == {"k": 1}
    sql = pool.fetch.await_args[0][0]
    assert "dims = $3" in sql
    assert pool.fetch.await_args[0][3] == 2  # dims 参数 = 查询向量维度


async def test_extension_missing_upsert_fails_search_raises() -> None:
    """扩展不可用:写路径返回 False(调用方降级),读路径必须明确失败,不能返回空。"""
    pool = _FakePool(extension_available=False)
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        assert await upsert_chunk("ns", "s", "e1", "c", [0.1]) is False
        with pytest.raises(PgVectorSchemaUnavailable):
            await search_chunks("ns", [0.1])


async def test_hnsw_index_failure_logs_warning_with_sqlstate(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """HNSW 建索引失败必须可见:warning + SQLSTATE,但不阻断初始化(顺序扫描兜底)。

    修前这里是 ``logger.info``,``column "embedding" does not have dimensions``
    被吞掉,索引从未建成而日志里什么都看不到。
    """
    caplog.set_level(logging.WARNING, logger="app.services.pgvector_store")
    err = _DbError('column "embedding" does not have dimensions', sqlstate="22023")
    pool = _FakePool(fail_sql=("USING hnsw", err))
    assert await _ensure_schema(pool) is True, "索引失败不能让初始化崩掉"
    assert "hnsw 索引创建失败" in caplog.text
    assert "sqlstate=22023" in caplog.text
    assert 'column "embedding" does not have dimensions' in caplog.text


async def test_hnsw_already_exists_is_not_warned(caplog: pytest.LogCaptureFixture) -> None:
    """只有「已存在」(42P07/42710)可以静默,不能把真正的失败也混进这个桶。"""
    caplog.set_level(logging.WARNING, logger="app.services.pgvector_store")
    err = _DbError("relation already exists", sqlstate="42P07")
    pool = _FakePool(fail_sql=("USING hnsw", err))
    assert await _ensure_schema(pool) is True
    assert "hnsw 索引创建失败" not in caplog.text


@pytest.mark.parametrize(
    ("needle", "what"),
    [("CREATE TABLE", "建表"), ("rag_chunks_ns_ref_uidx", "唯一索引")],
)
async def test_required_ddl_failure_is_visible_and_degrades(
    needle: str, what: str, caplog: pytest.LogCaptureFixture
) -> None:
    """必要 DDL(建表 / 唯一索引)失败也要 warning + SQLSTATE,并返回 False 让调用方降级。

    修前这些异常会一路冒到 upsert/search 的 ``logger.debug``,等于静默。
    """
    caplog.set_level(logging.WARNING, logger="app.services.pgvector_store")
    pool = _FakePool(fail_sql=(needle, _DbError("permission denied", sqlstate="42501")))
    assert await _ensure_schema(pool) is False
    assert f"{what}失败" in caplog.text
    assert "sqlstate=42501" in caplog.text


async def test_search_schema_failure_raises_and_counts_separately() -> None:
    """建表失败 ⇒ search 明确失败;「schema 故障」与「真无匹配」必须是两个计数。"""
    from app.services.telemetry_service import telemetry_service

    metric = telemetry_service.registry.get_metric("pgvector_search_total")
    assert metric is not None
    before_bad = metric.get(outcome="schema_unavailable")
    before_empty = metric.get(outcome="empty")

    bad_pool = _FakePool(fail_sql=("CREATE TABLE", _DbError("permission denied", sqlstate="42501")))
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=bad_pool)):
        with pytest.raises(PgVectorSchemaUnavailable):
            await search_chunks("ns", [0.1, 0.2])
    assert metric.get(outcome="schema_unavailable") == before_bad + 1

    # schema 正常但查回 0 行:这是「真的没有匹配」,仍返回 [] 并单独计数。
    ok_pool = _FakePool()
    ok_pool.fetch = AsyncMock(return_value=[])
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=ok_pool)):
        assert await search_chunks("ns", [0.1, 0.2]) == []
    assert metric.get(outcome="empty") == before_empty + 1
    assert metric.get(outcome="schema_unavailable") == before_bad + 1, "两类计数不能混"


async def test_clear_schema_failure_raises_not_zero() -> None:
    """建表失败 ⇒ clear 明确失败,不能返回 0 被读成「本来就没有可删的行」。"""
    from app.services.telemetry_service import telemetry_service

    metric = telemetry_service.registry.get_metric("pgvector_clear_total")
    assert metric is not None
    before = metric.get(outcome="schema_unavailable")
    pool = _FakePool(fail_sql=("CREATE TABLE", _DbError("permission denied", sqlstate="42501")))
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        with pytest.raises(PgVectorSchemaUnavailable):
            await clear_chunks("ns")
    assert metric.get(outcome="schema_unavailable") == before + 1


async def test_circuit_breaker_after_repeated_fatal() -> None:
    pool = _FakePool(extension_available=False)
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        for _ in range(pgvector_store._FATAL_THRESHOLD):
            await upsert_chunk("ns", "s", "e1", "c", [0.1])
        # 熔断后:即使恢复也直接短路(不再触库)
        pool2 = _FakePool(extension_available=True)
        with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool2)):
            assert await upsert_chunk("ns", "s", "e1", "c", [0.1]) is False
            assert not pool2.conn.executed


async def test_clear_by_session_uses_metadata_filter() -> None:
    pool = _FakePool()
    pool.fetchrow = AsyncMock(return_value={"n": 3})
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        n = await clear_chunks("ns", session_id="s-1")
    assert n == 3
    sql = pool.fetchrow.await_args[0][0]
    assert "metadata->>'sessionId'" in sql


async def test_delete_ok() -> None:
    pool = _FakePool()
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        assert await delete_chunk("ns", "entries", "e1") is True
    assert any("DELETE FROM rag_chunks" in str(c.args[0]) for c in pool.execute.await_args_list)


async def test_empty_embedding_short_circuit() -> None:
    assert await upsert_chunk("ns", "s", "e1", "c", []) is False
    assert await search_chunks("ns", []) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
