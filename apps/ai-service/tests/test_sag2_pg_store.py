# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""PgTsVectorStore 回归测试（FakeRunner 记录 SQL 与参数，不连真实数据库）。

覆盖：DDL、登记分块、hash 增量、删除清理、ts_rank_cd 结果映射、excluded
先排除后截断、中文 bigram token 串、参数绑定防注入、runner 异常/畸形时的
诚实降级、status 形状、与 retrieve() 的 duck-type 可组合性、异步适配。
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

from app.services.sag2_lexical.index import sha256_text
from app.services.sag2_lexical.judge import LexicalOnlyJudge
from app.services.sag2_lexical.pg_store import PgTsVectorStore
from app.services.sag2_lexical.retrieval import (
    STATUS_OK,
    Sag2Options,
    retrieve,
)

_CHUNK_KEYS = (
    "path", "chunk_id", "title", "heading", "seq", "content", "hash",
    "doc_hash", "start_offset", "end_offset", "start_line", "end_line",
    "chunk_key", "title_tokens", "heading_tokens", "content_tokens",
)


def make_row(
    *,
    path: str = "kb/a.txt",
    chunk_id: int = 1,
    content: str = "收购了B公司",
    rank: float = 0.5,
    start: int = 0,
    chunk_key: str | None = None,
) -> dict[str, Any]:
    """构造一条 ts_rank_cd 结果行（列集合与 PgTsVectorStore 的 SELECT 对齐）。"""
    end = start + len(content)
    key = chunk_key or f"{path}#{chunk_id}:{start}-{end}"
    return {
        "path": path,
        "chunk_id": chunk_id,
        "title": path,
        "heading": "",
        "seq": 0,
        "content": content,
        "hash": "chunk-hash",
        "doc_hash": "doc-hash",
        "start_offset": start,
        "end_offset": end,
        "start_line": 1,
        "end_line": 1,
        "chunk_key": key,
        "rank": rank,
    }


class FakeRunner:
    """记录 (sql, params)，并用最小内存表模拟 DDL / DML / 候选 SELECT。

    ``fail_on`` / ``malformed_on`` 按 SQL 子串触发故障；``rank_rows`` 可让
    候选 SELECT 直接返回预置的、按 ts_rank_cd 排序语义解释的行。
    """

    def __init__(
        self,
        *,
        fail_on: str | None = None,
        malformed_on: str | None = None,
        rank_rows: list[dict[str, Any]] | None = None,
    ) -> None:
        self.calls: list[tuple[str, tuple[Any, ...]]] = []
        self.documents: dict[str, dict[str, Any]] = {}
        self.chunks: list[dict[str, Any]] = []
        self.fail_on = fail_on
        self.malformed_on = malformed_on
        self.rank_rows = rank_rows

    def __call__(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        self.calls.append((sql, params))
        if self.fail_on and self.fail_on in sql:
            raise RuntimeError("simulated DB failure")
        if self.malformed_on and self.malformed_on in sql:
            return [{"broken": "row"}]
        head = sql.strip().upper()
        if head.startswith("CREATE"):
            return []
        if head.startswith("SELECT") and "FROM SAG2_DOCUMENTS" in head:
            row = self.documents.get(str(params[0]))
            return [dict(row)] if row else []
        if head.startswith("DELETE FROM SAG2_CHUNKS"):
            self.chunks = [c for c in self.chunks if c["path"] != str(params[0])]
            return []
        if head.startswith("DELETE FROM SAG2_DOCUMENTS"):
            self.documents.pop(str(params[0]), None)
            return []
        if head.startswith("INSERT INTO SAG2_CHUNKS"):
            self.chunks.append(dict(zip(_CHUNK_KEYS, params, strict=True)))
            return []
        if head.startswith("INSERT INTO SAG2_DOCUMENTS"):
            self.documents[str(params[0])] = {
                "path": params[0],
                "doc_hash": params[1],
                "chunk_count": params[2],
                "version": params[3],
            }
            return []
        if "TS_RANK_CD" in head:
            return self._rank(params)
        return []

    def _rank(self, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        excluded = {str(item) for item in params[1]}
        limit = int(params[2])
        if self.rank_rows is not None:
            rows = [dict(row) for row in self.rank_rows]
        else:
            terms = re.findall(r"'([^']*)'", str(params[0]))
            rows = []
            for chunk in self.chunks:
                tokens = str(chunk["content_tokens"]).split()
                tf = sum(tokens.count(term) for term in terms)
                if tf > 0:
                    row = dict(chunk)
                    row["rank"] = float(tf)
                    rows.append(row)
        # 与真实 SQL 一致：WHERE 先排除，再 ORDER BY rank，最后 LIMIT。
        rows = [r for r in rows if str(r["chunk_key"]) not in excluded]
        rows.sort(key=lambda r: (-float(r["rank"]), str(r["chunk_key"])))
        return rows[:limit]


class AlwaysFailRunner:
    """所有调用都抛错：模拟 DB 完全不可用。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    def __call__(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        self.calls.append((sql, params))
        raise RuntimeError("DB is down")


def make_store(**kwargs: Any) -> tuple[PgTsVectorStore, FakeRunner]:
    runner = FakeRunner(**kwargs)
    return PgTsVectorStore(runner), runner


def count_chunk_inserts(runner: FakeRunner) -> int:
    return sum(
        1 for sql, _ in runner.calls if sql.startswith("INSERT INTO sag2_chunks")
    )


# ---------------------------------------------------------------------------
# DDL / 写入 / 增量 / 删除
# ---------------------------------------------------------------------------


def test_ddl_is_emitted_with_gin_and_fingerprint_table():
    store, runner = make_store()
    ddl = [sql for sql, _ in runner.calls[:3]]
    assert any("CREATE TABLE IF NOT EXISTS sag2_chunks" in s for s in ddl)
    assert any("tsvector" in s and "tokens" in s for s in ddl)
    assert any("USING gin" in s for s in ddl)
    assert any("sag2_documents" in s for s in ddl)
    assert all(params == () for _, params in runner.calls[:3])
    assert store.degraded is False


def test_add_document_inserts_chunks_and_fingerprint_row():
    store, runner = make_store()
    content = "A公司收购了B公司。A公司总部设在深圳。"
    outcome = store.add_document("kb/a.txt", content)
    assert outcome.changed is True
    assert outcome.doc_hash == sha256_text(content)
    assert count_chunk_inserts(runner) == outcome.chunk_count >= 1
    upserts = [
        (sql, params)
        for sql, params in runner.calls
        if sql.startswith("INSERT INTO sag2_documents")
    ]
    assert len(upserts) == 1
    assert upserts[0][1][0] == "kb/a.txt"
    assert upserts[0][1][1] == outcome.doc_hash
    assert runner.documents["kb/a.txt"]["chunk_count"] == outcome.chunk_count


def test_unchanged_hash_skips_rebuild_and_sql_writes():
    store, runner = make_store()
    store.add_document("kb/a.txt", "内容不变")
    before = count_chunk_inserts(runner)
    second = store.add_document("kb/a.txt", "内容不变")
    assert second.changed is False
    assert "unchanged" in second.reason
    assert count_chunk_inserts(runner) == before
    assert store.degraded is False


def test_remove_document_cleans_chunks_and_fingerprint():
    store, runner = make_store()
    store.add_document("kb/a.txt", "待删除内容")
    assert "kb/a.txt" in runner.documents
    assert runner.chunks
    assert store.remove_document("kb/a.txt") is True
    assert "kb/a.txt" not in runner.documents
    assert runner.chunks == []
    assert any(s.startswith("DELETE FROM sag2_chunks") for s, _ in runner.calls)
    assert any(s.startswith("DELETE FROM sag2_documents") for s, _ in runner.calls)
    deletes = [(s, p) for s, p in runner.calls if s.startswith("DELETE")]
    assert deletes
    assert all(p == ("kb/a.txt",) for _, p in deletes)


# ---------------------------------------------------------------------------
# 检索：排序映射 / excluded / 中文 token / 参数安全
# ---------------------------------------------------------------------------


def test_ts_rank_cd_rows_map_to_scored_chunk():
    top = make_row(chunk_id=1, rank=0.9, path="kb/a.txt")
    low = make_row(chunk_id=2, rank=0.4, path="kb/b.txt")
    store, runner = make_store(rank_rows=[top, low])
    hits = store.candidate_query(["收购"], 10)
    assert [h.chunk.chunk_id for h in hits] == [1, 2]
    assert hits[0].bm25 == 0.9
    assert hits[1].bm25 == 0.4
    assert [h.order for h in hits] == [0, 1]
    assert hits[0].key.startswith("kb/a.txt#1:")
    sql = runner.calls[-1][0]
    assert "ts_rank_cd" in sql
    assert "to_tsquery('simple', ?)" in sql
    assert "ORDER BY rank DESC" in sql
    assert "LIMIT ?" in sql


def test_excluded_is_filtered_before_limit():
    """与内存版 test_candidate_query_excludes_before_limiting 同一语义边界。

    limit=1 探测「还有没有新命中」时，若先 LIMIT 再过滤，排第一的已见段落
    会把真正的桥接候选吃掉，误判成「无新命中」。这里钉死排除在 LIMIT 之前。
    """
    top = make_row(chunk_id=1, rank=0.9, path="kb/a.txt")
    bridge = make_row(chunk_id=2, rank=0.5, path="kb/b.txt")
    store, runner = make_store(rank_rows=[top, bridge])

    without_excluded = store.candidate_query(["收购"], 1)
    assert [h.chunk.chunk_id for h in without_excluded] == [1]

    hits = store.candidate_query(["收购"], 1, {top["chunk_key"]})
    assert [h.chunk.chunk_id for h in hits] == [2]
    sql, params = runner.calls[-1]
    assert "<> ALL(?::text[])" in sql
    assert params[1] == [top["chunk_key"]]
    assert params[2] == 1
    assert top["chunk_key"] not in sql  # 参数化，未拼进 SQL 字面量


def test_cjk_bigram_token_string_is_bound_to_tsvector():
    store, runner = make_store()
    store.add_document("kb/cjk.txt", "公司收购了B公司")
    inserts = [
        (sql, params)
        for sql, params in runner.calls
        if sql.startswith("INSERT INTO sag2_chunks")
    ]
    assert inserts
    sql, params = inserts[0]
    assert "to_tsvector('simple', ?)" in sql
    content_tokens = params[15]
    assert isinstance(content_tokens, str)
    tokens = content_tokens.split()
    assert "公司" in tokens and "收购" in tokens  # CJK bigram
    assert "公" in tokens and "司" in tokens  # CJK 单字
    assert "b" in tokens  # 拉丁整词保留
    assert all("'" not in token for token in tokens)


def test_path_with_single_quote_is_bound_not_concatenated():
    store, runner = make_store()
    evil = "kb/O'Brien; DROP TABLE sag2_chunks;--.txt"
    store.add_document(evil, "安全内容")
    for sql, _params in runner.calls:
        assert evil not in sql  # 绝不进 SQL 字面量
    inserts = [
        (sql, params)
        for sql, params in runner.calls
        if sql.startswith("INSERT INTO sag2_chunks")
    ]
    assert inserts
    for sql, params in inserts:
        assert params[0] == evil  # 只走参数绑定
        assert sql.count("?") == len(params) == 16
    upsert = [
        params
        for sql, params in runner.calls
        if sql.startswith("INSERT INTO sag2_documents")
    ]
    assert upsert and upsert[0][0] == evil


# ---------------------------------------------------------------------------
# 诚实降级 / status
# ---------------------------------------------------------------------------


def test_runner_exception_sets_degraded_and_does_not_fake_empty():
    runner = AlwaysFailRunner()
    store = PgTsVectorStore(runner)
    assert store.degraded is True
    assert store.degrade_reason
    store.add_document("kb/a.txt", "降级内容")
    hits = store.candidate_query(["降级"], 10)
    assert hits, "DB 挂掉必须回退注入的内存镜像，而不是静默返回空结果"
    assert store.degraded is True
    assert store.degrade_reason
    assert store.status()["degraded"] is True
    assert store.status()["degrade_reason"]
    assert runner.calls
    assert any("ts_rank_cd" in sql for sql, _ in runner.calls)


def test_malformed_rows_set_degraded_and_fall_back():
    store, _runner = make_store(malformed_on="ts_rank_cd")
    store.add_document("kb/a.txt", "畸形返回内容")
    hits = store.candidate_query(["畸形"], 10)
    assert store.degraded is True
    assert "畸形" in store.degrade_reason
    assert hits, "畸形行必须回退内存镜像"
    assert store.status()["degraded"] is True


def test_status_shape_reports_backend_and_degradation():
    store, _runner = make_store()
    store.add_document("kb/a.txt", "状态内容")
    payload = store.status()
    for key in (
        "version", "documents", "chunks", "terms", "avg_chunk_length",
        "ready", "backend", "channel", "degraded", "degrade_reason",
    ):
        assert key in payload
    assert payload["backend"] == "postgres-tsvector"
    assert payload["degraded"] is False
    assert payload["degrade_reason"] == ""
    assert payload["documents"] == 1
    assert payload["chunks"] >= 1
    assert payload["ready"] is True


# ---------------------------------------------------------------------------
# duck type / 其它公开方法
# ---------------------------------------------------------------------------


def test_duck_type_composes_with_retrieve_and_lexical_only_judge():
    store, runner = make_store()
    store.add_document("kb/a.txt", "A公司收购了B公司。A公司总部设在深圳。")
    store.add_document("kb/b.txt", "张三负责技术战略。")
    result = asyncio.run(
        retrieve(
            store,
            "收购",
            LexicalOnlyJudge(),
            Sag2Options(max_hops=1, top_k=5),
        )
    )
    assert result.status == STATUS_OK
    assert result.results
    assert result.citations
    assert result.judge_executed is False
    assert result.degraded is False
    assert any("ts_rank_cd" in sql for sql, _ in runner.calls)


def test_candidate_queries_fans_out_per_term():
    row = make_row(chunk_id=7, rank=0.7)
    store, runner = make_store(rank_rows=[row])
    groups = store.candidate_queries(["收购", "cto"], 5)
    assert len(groups) == 2
    assert all(group[0].chunk.chunk_id == 7 for group in groups)
    selects = [sql for sql, _ in runner.calls if "TS_RANK_CD" in sql.upper()]
    assert len(selects) == 2


def test_idf_statistics_delegate_to_injected_mirror():
    store, _runner = make_store()
    store.add_document("kb/a.txt", "公司收购了B公司")
    store.add_document("kb/b.txt", "公司食堂菜谱")
    assert store.chunk_count() >= 2
    assert store.document_count() == 2
    assert store.frequency("公司") >= 2
    assert store.bm25_idf("公司") >= 0.0
    assert store.corpus_idf("公司") >= 1.0
    assert store.has_match("公司") is True
    assert store.version >= 2


def test_from_async_runner_translates_placeholders_to_asyncpg():
    seen: list[str] = []

    async def fetch(sql: str, *args: Any) -> list[dict[str, Any]]:
        seen.append(sql)
        return []

    store = PgTsVectorStore.from_async_runner(fetch)
    store.candidate_query(["收购"], 3, {"excluded-key"})
    assert any("to_tsquery('simple', $1)" in sql for sql in seen)
    assert all("?" not in sql for sql in seen)
    assert store.status()["backend"] == "postgres-tsvector"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
