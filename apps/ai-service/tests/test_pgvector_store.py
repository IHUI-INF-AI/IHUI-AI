# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""D8 pgvector_store 单元测试(2026-09-19 立)。

不依赖真实 PostgreSQL:mock 共享连接池,验证 SQL 组装/熔断/降级/维度过滤。
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import pgvector_store
from app.services.pgvector_store import (
    _reset_circuit,
    _vec_literal,
    clear_chunks,
    delete_chunk,
    search_chunks,
    upsert_chunk,
)


@pytest.fixture(autouse=True)
def _fresh_state() -> Any:
    _reset_circuit()
    yield
    _reset_circuit()


class _FakeConn:
    def __init__(self, extension_available: bool = True) -> None:
        self.extension_available = extension_available
        self.executed: list[str] = []

    async def execute(self, sql: str, *args: Any) -> None:
        self.executed.append(sql)

    async def fetchval(self, sql: str, *args: Any) -> Any:
        if "pg_extension" in sql:
            return self.extension_available
        return None


class _FakePool:
    def __init__(self, extension_available: bool = True) -> None:
        self.conn = _FakeConn(extension_available)
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


async def test_extension_missing_falls_back() -> None:
    pool = _FakePool(extension_available=False)
    with patch("app.core.db_pool.get_shared_pool", new=AsyncMock(return_value=pool)):
        assert await upsert_chunk("ns", "s", "e1", "c", [0.1]) is False
        assert await search_chunks("ns", [0.1]) == []


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
