# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""索引持久化：重启回灌 / 条目对账 / 失败降级 / 同步调用点不阻塞。

FakePool 真的按 SQL 语义维护两张表（不是「返回固定值」的假桩），因此
「写进去 → 重启 → 读回来」这条链是被完整走通的：分块区间、行号、
文档指纹都从 SQL 行还原，而不是从内存对象直接抄。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.sag2_lexical import Chunk, LexicalIndex, Sag2LexicalService
from app.services.sag2_lexical.pg_persistence import (
    PersistItem,
    PgDocumentStore,
)


# ---------------------------------------------------------------------------
# 一个按 SQL 语义工作的假 asyncpg 池
# ---------------------------------------------------------------------------


class FakeDB:
    def __init__(self) -> None:
        self.docs: dict[str, dict[str, object]] = {}
        self.chunks: dict[tuple[str, int], tuple[object, ...]] = {}
        self.fail_on: set[str] = set()

    # -- SQL 分派 ---------------------------------------------------------
    def execute(self, sql: str, args: tuple[object, ...]) -> str | None:
        if sql in self.fail_on:
            raise RuntimeError("boom")
        if "INSERT INTO sag2_lexical_docs" in sql:
            path, doc_hash, title, content, count = args
            self.docs[str(path)] = {
                "doc_hash": doc_hash,
                "title": title,
                "content": content,
                "chunk_count": count,
            }
            return None
        if "DELETE FROM sag2_lexical_chunks" in sql:
            path = str(args[0])
            self.chunks = {k: v for k, v in self.chunks.items() if k[0] != path}
            return None
        if "DELETE FROM sag2_lexical_docs" in sql:
            self.docs.pop(str(args[0]), None)
            return None
        return None  # DDL

    def executemany(self, sql: str, rows: list[tuple[object, ...]]) -> None:
        assert "INSERT INTO sag2_lexical_chunks" in sql
        for row in rows:
            path, seq = str(row[0]), int(row[1])
            self.chunks[(path, seq)] = row

    def fetch(self, sql: str, args: tuple[object, ...]) -> list[dict[str, object]]:
        if sql in self.fail_on:
            raise RuntimeError("boom")
        if "FROM sag2_lexical_docs" in sql and "path > " in sql:
            cursor, limit = str(args[0]), int(args[1])
            paths = sorted(p for p in self.docs if p > cursor)[:limit]
            return [
                {
                    "path": path,
                    "doc_hash": self.docs[path]["doc_hash"],
                    "title": self.docs[path]["title"],
                    "content": self.docs[path]["content"],
                }
                for path in paths
            ]
        if "FROM sag2_lexical_chunks" in sql:
            wanted = set(args[0])  # type: ignore[arg-type]
            rows = [
                {
                    "path": key[0],
                    "seq": key[1],
                    "title": row[2],
                    "heading": row[3],
                    "content": row[4],
                    "start_off": row[5],
                    "end_off": row[6],
                    "start_line": row[7],
                    "end_line": row[8],
                }
                for key, row in sorted(self.chunks.items())
                if key[0] in wanted
            ]
            return rows
        return []

    def fetchrow(self, sql: str, args: tuple[object, ...]) -> dict[str, object]:
        if sql in self.fail_on:
            raise RuntimeError("boom")
        return {
            "docs": len(self.docs),
            "chunks": sum(int(d["chunk_count"]) for d in self.docs.values()),
        }


class _Ctx:
    async def __aenter__(self) -> _Ctx:
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False


class FakeConn:
    def __init__(self, db: FakeDB) -> None:
        self.db = db

    async def execute(self, sql: str, *args: object) -> str | None:
        return self.db.execute(sql, args)

    async def executemany(self, sql: str, rows: list[tuple[object, ...]]) -> None:
        self.db.executemany(sql, rows)

    async def fetch(self, sql: str, *args: object) -> list[dict[str, object]]:
        return self.db.fetch(sql, args)

    async def fetchrow(self, sql: str, *args: object) -> dict[str, object]:
        return self.db.fetchrow(sql, args)

    def transaction(self) -> _Ctx:
        return _Ctx()


class _Acquire:
    def __init__(self, db: FakeDB) -> None:
        self.db = db

    async def __aenter__(self) -> FakeConn:
        return FakeConn(self.db)

    async def __aexit__(self, *exc: object) -> bool:
        return False


class FakePool:
    def __init__(self, db: FakeDB) -> None:
        self.db = db

    def acquire(self) -> _Acquire:
        return _Acquire(self.db)


def _store(db: FakeDB) -> PgDocumentStore:
    async def provider() -> FakePool:
        return FakePool(db)

    return PgDocumentStore(provider)


# ---------------------------------------------------------------------------
# 单文档写 / 读
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_save_then_load_roundtrips_chunk_geometry():
    db = FakeDB()
    store = _store(db)
    source = "第一句关于预算。第二句关于责任人。"
    index = LexicalIndex()
    index.add_document("docs/a.md", source, title="A")
    chunks = index.snapshot_chunks("docs/a.md")
    assert chunks, "快照不该为空"

    assert await store.save_document(
        "docs/a.md", source, index.document_hash("docs/a.md"), chunks, title="A"
    )
    assert db.docs, "文档行应已写入"
    assert len(db.chunks) == len(chunks)

    fresh = LexicalIndex()
    docs, restored_chunks = await store.load_all(
        lambda path, content, blocks, doc_hash: fresh.restore_document(
            path, content, blocks, doc_hash=doc_hash
        )
    )
    assert (docs, restored_chunks) == (1, len(chunks))
    # 几何必须逐字段一致：引用要靠它锚定原文。
    before = index.citation(index.candidate_query(["预算"], 5)[0])
    after_candidates = fresh.candidate_query(["预算"], 5)
    assert after_candidates, "恢复后应仍能检索到"
    after = fresh.citation(after_candidates[0])
    assert after["byte_range"] == before["byte_range"]
    assert after["start_line"] == before["start_line"]
    assert after["doc_hash"] == before["doc_hash"]
    assert after["passage"] == before["passage"]


@pytest.mark.asyncio
async def test_delete_removes_doc_and_chunks():
    db = FakeDB()
    store = _store(db)
    index = LexicalIndex()
    index.add_document("docs/a.md", "内容足够长以形成至少一个块。")
    await store.save_document(
        "docs/a.md",
        "内容足够长以形成至少一个块。",
        index.document_hash("docs/a.md"),
        index.snapshot_chunks("docs/a.md"),
    )
    assert await store.delete_document("docs/a.md")
    assert db.docs == {}
    assert db.chunks == {}


@pytest.mark.asyncio
async def test_restore_across_multiple_documents_respects_batch_paging():
    """超过一批（200）也要全量恢复：键集分页不能漏也不能重。"""
    db = FakeDB()
    store = _store(db)
    index = LexicalIndex()
    for i in range(205):
        path = f"docs/{i:04d}.md"
        text = f"第 {i} 份文档记录了预算与责任人，编号 {i:04d}。"
        index.add_document(path, text)
        await store.save_document(
            path, text, index.document_hash(path), index.snapshot_chunks(path)
        )
    fresh = LexicalIndex()
    docs, _ = await store.load_all(
        lambda p, c, b, h: fresh.restore_document(p, c, b, doc_hash=h)
    )
    assert docs == 205
    assert fresh.document_count() == 205


@pytest.mark.asyncio
async def test_stats_aligns_with_written_documents():
    db = FakeDB()
    store = _store(db)
    index = LexicalIndex()
    for path in ("a.md", "b.md"):
        index.add_document(path, f"{path} 的正文内容用于测试对账。")
        await store.save_document(
            path,
            f"{path} 的正文内容用于测试对账。",
            index.document_hash(path),
            index.snapshot_chunks(path),
        )
    stats = await store.stats()
    assert stats["documents"] == 2
    assert stats["chunks"] == index.chunk_count()


# ---------------------------------------------------------------------------
# 诚实降级
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_schema_failure_degrades_without_raising():
    db = FakeDB()
    original = db.execute

    def boom(sql: str, args: tuple[object, ...]) -> str | None:
        raise RuntimeError("db down")

    # 让所有 execute 抛错即模拟「库连不上 / 没权限」。
    db.execute = boom  # type: ignore[method-assign]
    store = _store(db)
    try:
        ok = await store.ensure_schema()
        assert ok is False
        assert store.status.durable is False
        assert "db down" in store.status.reason
        # 后续写操作也不该抛，只是返回 False（不假装成功写入）。
        assert await store.save_document("a.md", "x" * 20, "h", []) is False
        assert store.status.durable is False
    finally:
        db.execute = original  # type: ignore[method-assign]


@pytest.mark.asyncio
async def test_load_failure_reports_reason_not_silent_zero():
    db = FakeDB()
    store = _store(db)
    await store.ensure_schema()

    def boom(sql: str, args: tuple[object, ...]) -> list[dict[str, object]]:
        raise RuntimeError("read failed")

    db.fetch = boom  # type: ignore[method-assign]
    docs, chunks = await store.load_all(lambda *a: 0)
    assert (docs, chunks) == (0, 0)
    assert "read failed" in store.status.restore_error
    assert store.status.restoring is False


def test_unavailable_store_does_not_enqueue():
    store = PgDocumentStore()
    store.mark_unavailable("no-dsn")
    store.enqueue(PersistItem(path="a.md", title="", content="", doc_hash=""))
    assert store.status.pending == 0
    assert store.status.durable is False
    assert store.status.reason == "no-dsn"


# ---------------------------------------------------------------------------
# 队列 + consumer（同步调用点不阻塞）
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_enqueue_drains_to_store_and_never_raises():
    db = FakeDB()
    store = _store(db)
    await store.ensure_schema()
    index = LexicalIndex()
    index.add_document("docs/q.md", "队列投递的文档正文，长度足够。")
    store.start_consumer()
    store.enqueue_save(
        "docs/q.md",
        "队列投递的文档正文，长度足够。",
        index.document_hash("docs/q.md"),
        index.snapshot_chunks("docs/q.md"),
    )
    remaining = await store.drain(timeout_s=5.0)
    await store.aclose()
    assert remaining == 0
    assert store.status.saved >= 1
    assert "docs/q.md" in db.docs


# ---------------------------------------------------------------------------
# 服务层：重启后索引还在
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_survives_restart_via_persistence():
    """核心承诺：进程重启（换一个 service 实例）后，文档与检索都还在。"""
    db = FakeDB()

    first = Sag2LexicalService(index=LexicalIndex(), gateway=None)
    first.attach_persistence(_store(db))
    first.persistence.start_consumer()
    first.add_document(
        "docs/decision.md",
        "董事会决议：2025 年研发预算 800 万，责任人王工。"
        "后续王工把向量检索项目的支出推到 940 万。",
    )
    assert await first.persistence.drain(5.0) == 0

    second = Sag2LexicalService(index=LexicalIndex(), gateway=None)
    second.attach_persistence(_store(db))
    result = await second.ensure_restored()
    assert result["restored"] is True
    assert result["documents"] == 1
    assert second.index.document_count() == 1
    hits = second.search("预算")
    assert hits["total_files"] == 1
    assert hits["items"][0]["path"] == "docs/decision.md"
    # 多跳检索在恢复后的索引上同样可用。
    deep = await second.retrieve("董事会定的预算后来谁用超了")
    assert deep.status == "ok"
    assert [c["path"] for c in deep.citations] == ["docs/decision.md"]


@pytest.mark.asyncio
async def test_ensure_restored_is_idempotent():
    db = FakeDB()
    service = Sag2LexicalService(index=LexicalIndex(), gateway=None)
    service.attach_persistence(_store(db))
    first = await service.ensure_restored()
    second = await service.ensure_restored()
    assert first == second, "重复调用必须返回同一份结果（幂等）"


@pytest.mark.asyncio
async def test_ensure_restored_without_persistence_states_reason():
    service = Sag2LexicalService(index=LexicalIndex(), gateway=None)
    result = await service.ensure_restored()
    assert result["restored"] is False
    assert "未启用持久化" in result["reason"]
    status = service.status()["persistence"]
    assert status["durable"] is False
    assert status["backend"] == "none"


@pytest.mark.asyncio
async def test_remove_document_enqueues_delete():
    db = FakeDB()
    service = Sag2LexicalService(index=LexicalIndex(), gateway=None)
    service.attach_persistence(_store(db))
    service.persistence.start_consumer()
    service.add_document("docs/x.md", "这份文档稍后会被移除，正文要够长。")
    await service.persistence.drain(5.0)
    assert "docs/x.md" in db.docs
    service.remove_document("docs/x.md")
    await service.persistence.drain(5.0)
    assert "docs/x.md" not in db.docs
    assert not any(k[0] == "docs/x.md" for k in db.chunks)


@pytest.mark.asyncio
async def test_unchanged_document_is_not_rewritten():
    """hash 未变 ⇒ 不投递第二次落库（与增量语义一致，不做无谓写）。"""
    db = FakeDB()
    service = Sag2LexicalService(index=LexicalIndex(), gateway=None)
    service.attach_persistence(_store(db))
    service.persistence.start_consumer()
    service.add_document("docs/same.md", "内容完全不变的一份文档，长度足够。")
    await service.persistence.drain(5.0)
    saved = service.persistence.status.saved
    again = service.add_document("docs/same.md", "内容完全不变的一份文档，长度足够。")
    assert again["changed"] is False
    await asyncio.sleep(0.05)
    assert service.persistence.status.saved == saved, "未变化不该再次落库"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
