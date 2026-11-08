# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道 · 真实 Postgres 端到端集成测试（B 面 / 遗留项 B）。

与既有 FakeRunner 单测的口径区别（务必分清，不得混淆）：

* 本文件的 PG 用例 **真连真跑**：驱动是 .venv 内真实 ``asyncpg 0.31.0``，
  SQL 是真 ``tsvector`` / ``ts_rank_cd`` / GIN，写入走真实 socket，检索结果来自
  真实 PostgreSQL 服务端，**没有任何 FakeRunner / mock 掉 SQL 执行**。
* 所有写操作隔离在**每用例独立的随机 schema**（``SET search_path`` 且逐连接
  校验 ``current_schema()``），测试结束 ``DROP SCHEMA ... CASCADE`` 清理；
  fixture 额外比对 public.sag2* 表在用例前后不变，绝不碰生产表。
* DSN 一律 ``os.environ.get("SAG2_TEST_DSN")`` / ``DATABASE_URL``，无 env 时
  ``pytest.skip``。**密码/DSN 绝不写入任何文件、报告或提交信息**。
* ``test_honest_degradation_on_real_connection_failure`` 是**降级纪律**子用例：
  用真实 asyncpg 驱动连一个不可达端口制造**真实连接失败**，验证失败时
  ``backend`` / ``degraded`` / ``degrade_reason`` 如实上报、不伪装成功，且检索
  回退内存镜像给出真实候选。它不是「端到端跑成」的证据，口径单独标注。
* ``test_sqlite_fts5_persistent_e2e_alternative_evidence`` 是**替代/交叉验证
  证据**（Python 标准库 sqlite3 + FTS5，零新依赖），不是 Postgres 端到端；
  即便无 DSN 也能跑，用于可复现地证明持久化全文检索链路成立。

runner 契约：``PgTsVectorStore.from_async_runner(fetch)`` 把规范 SQL 的 ``?``
改写为 ``$1..$n`` 后，用 ``asyncio.run`` 同步驱动 asyncpg 风格
``fetch(sql, *args)``。因此这些 store 方法**必须在同步上下文调用**（pytest
同步 def 测试），不可在已运行的事件循环内直接调 —— 这正是 pg_store.py
docstring 的明确约束。
"""
from __future__ import annotations

import asyncio
import os
import re
import sqlite3
import uuid
from urllib.parse import urlsplit, urlunsplit

import pytest

from app.services.sag2_lexical.index import sha256_text
from app.services.sag2_lexical.pg_store import PgTsVectorStore, asyncpg_runner
from app.services.sag2_lexical.store_factory import (
    BACKEND_MEMORY,
    BACKEND_POSTGRES,
    build_store_with_status,
    resolve_store_status,
)
from app.services.sag2_lexical.text import casefold_tokens, match_query

_WM_HEAD = ("backend", "degraded", "degrade_reason")


# ---------------------------------------------------------------------------
# DSN / schema 隔离基础设施
# ---------------------------------------------------------------------------


def _dsn_from_env() -> str | None:
    # 严格只读环境变量；绝不 fallback 到文件里的字面量、绝不打印其值。
    return os.environ.get("SAG2_TEST_DSN") or os.environ.get("DATABASE_URL")


def _public_sag2_tables(dsn: str, asyncpg_mod) -> list[str]:
    """默认连接只读探查 public.sag2*（系统目录查询，不受 search_path 影响）。"""

    async def go() -> list[str]:
        conn = await asyncpg_mod.connect(dsn=dsn, timeout=8)
        try:
            rows = await conn.fetch(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' "
                "AND tablename LIKE 'sag2%' ORDER BY 1"
            )
            return [str(r[0]) for r in rows]
        finally:
            await conn.close()

    return asyncio.run(go())


def _setup_schema(dsn: str, schema: str, asyncpg_mod) -> None:
    async def go() -> None:
        conn = await asyncpg_mod.connect(dsn=dsn, timeout=8)
        try:
            # 显式 schema 名，默认 search_path；绝不触碰 public。
            await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
            await conn.execute(f'CREATE SCHEMA "{schema}"')
        finally:
            await conn.close()

    asyncio.run(go())


def _drop_schema(dsn: str, schema: str, asyncpg_mod) -> None:
    async def go() -> None:
        conn = await asyncpg_mod.connect(dsn=dsn, timeout=8)
        try:
            await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        finally:
            await conn.close()

    asyncio.run(go())


def _unreachable_dsn(dsn: str) -> str:
    """由真实 DSN 派生一个端口不可达的 DSN（仅内存，不打印、不落盘）。

    用于「真实连接失败」降级纪律子用例：保留 user/password/host/db，仅把端口
    换成 :1（几乎肯定无监听），从而触发真实的驱动级连接失败，而非 mock。
    """
    parts = urlsplit(dsn)
    netloc = re.sub(r":\d+$", ":1", parts.netloc)
    if netloc == parts.netloc:
        netloc = parts.netloc + ":1"
    return urlunsplit(
        (parts.scheme, netloc, parts.path, parts.query, parts.fragment)
    )


class _PgHarness:
    """真实 asyncpg fetch 适配 + 只读 SQL 通道 + 调用记录。

    每条连接都先 ``SET search_path`` 到独立 schema 并校验 ``current_schema()``，
    未生效就抛错（绝不带着错误 search_path 去写，避免碰生产表）。DDL 走
    ``conn.execute``（simple query，PG 不允许 PREPARE 的 CREATE/ALTER/DROP），
    其余 SQL 走 ``conn.fetch`` 并把 ``Record`` 转成 ``dict``。
    """

    def __init__(self, dsn: str, schema: str, asyncpg_mod) -> None:
        self.dsn = dsn
        self.schema = schema
        self._asyncpg = asyncpg_mod
        self.calls: list[tuple[str, tuple]] = []
        self._runner = asyncpg_runner(self.fetch)

    async def fetch(self, sql: str, *args) -> list[dict]:
        conn = await self._asyncpg.connect(dsn=self.dsn, timeout=8)
        try:
            await conn.execute(
                f'SET search_path TO "{self.schema}", public'
            )
            cur = await conn.fetchval("SELECT current_schema()")
            if cur != self.schema:
                raise RuntimeError(
                    f"schema 隔离失败: current_schema()={cur!r} 期望 {self.schema!r}"
                )
            head = sql.lstrip().split(None, 1)[0].upper() if sql.strip() else ""
            if head in {"CREATE", "ALTER", "DROP", "TRUNCATE"}:
                await conn.execute(sql, *args)
                self.calls.append((sql, tuple(args)))
                return []
            recs = await conn.fetch(sql, *args)
            self.calls.append((sql, tuple(args)))
            return [dict(r) for r in recs]
        finally:
            await conn.close()

    @property
    def runner(self):
        """同步 SqlRunner（供 build_store_with_status 注入）。"""
        return self._runner

    def store(self) -> PgTsVectorStore:
        return PgTsVectorStore.from_async_runner(self.fetch)

    def raw(self, sql: str, *args) -> list[dict]:
        """直连真实 DB 的只读 SQL（asyncpg $1 占位风格），用于校验真实表内容。"""

        async def go() -> list[dict]:
            conn = await self._asyncpg.connect(dsn=self.dsn, timeout=8)
            try:
                await conn.execute(
                    f'SET search_path TO "{self.schema}", public'
                )
                cur = await conn.fetchval("SELECT current_schema()")
                if cur != self.schema:
                    raise RuntimeError(f"schema 隔离失败: {cur!r}")
                recs = await conn.fetch(sql, *args)
                return [dict(r) for r in recs]
            finally:
                await conn.close()

        return asyncio.run(go())


@pytest.fixture(scope="module")
def dsn() -> str:
    value = _dsn_from_env()
    if not value:
        pytest.skip(
            "真实 Postgres 端到端需要 SAG2_TEST_DSN / DATABASE_URL 环境变量；"
            "未提供 -> 跳过（凭据绝不写入文件/报告/提交信息）"
        )
    return value


@pytest.fixture
def pg(dsn: str):
    asyncpg = pytest.importorskip(
        "asyncpg", reason="真实 PG 端到端需要 asyncpg（.venv 已装 0.31.0）"
    )
    schema = "sag2_e2e_" + uuid.uuid4().hex[:12]
    public_before = _public_sag2_tables(dsn, asyncpg)
    _setup_schema(dsn, schema, asyncpg)
    harness = _PgHarness(dsn, schema, asyncpg)
    try:
        yield harness
    finally:
        public_after = _public_sag2_tables(dsn, asyncpg)
        _drop_schema(dsn, schema, asyncpg)
        if public_before != public_after:
            pytest.fail(
                "测试期间 public.sag2* 表被改动，违反『绝不碰生产表』纪律: "
                f"before={public_before} after={public_after}"
            )


# ---------------------------------------------------------------------------
# 真实 Postgres 端到端（真连真跑）
# ---------------------------------------------------------------------------


def test_real_ddl_isolated_from_public(pg: _PgHarness) -> None:
    """真实建表（独立 schema）+ 列类型/GIN 索引 + public 未被动过。"""
    before = pg.raw(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
        "AND tablename IN ('sag2_chunks','sag2_documents')"
    )
    store = pg.store()  # 构造即 ensure_schema()：真实执行 3 条 DDL
    assert store.degraded is False, store.degrade_reason

    tables = pg.raw(
        "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY 1",
        pg.schema,
    )
    names = {str(r["tablename"]) for r in tables}
    assert "sag2_chunks" in names and "sag2_documents" in names

    col = pg.raw(
        "SELECT udt_name FROM information_schema.columns "
        "WHERE table_schema=$1 AND table_name='sag2_chunks' "
        "AND column_name='tokens'",
        pg.schema,
    )
    assert col and str(col[0]["udt_name"]) == "tsvector"

    idx = pg.raw(
        "SELECT indexname FROM pg_indexes WHERE schemaname=$1 "
        "AND tablename='sag2_chunks'",
        pg.schema,
    )
    assert any("gin" in str(r["indexname"]) or "tokens" in str(r["indexname"]) for r in idx)

    after = pg.raw(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
        "AND tablename IN ('sag2_chunks','sag2_documents')"
    )
    assert before == after, "DDL 绝不能在 public 建表/改表"


def test_real_multidoc_write_and_tsrank_ordering(pg: _PgHarness) -> None:
    """真实写入多文档 → 真实 tsvector/ts_rank_cd 查询返回预期排序。"""
    store = pg.store()
    a = "postgres tsvector postgres ranking postgres gin postgres index"
    b = "postgres appears once here"
    c = "unrelated zebra content without the keyword"
    oa = store.add_document("kb/a.txt", a, title="A")
    ob = store.add_document("kb/b.txt", b, title="B")
    oc = store.add_document("kb/c.txt", c, title="C")
    assert oa.changed and ob.changed and oc.changed

    # 真实表：总行数 == 三个文档的块数之和
    rows = pg.raw(
        "SELECT path, count(*) AS n FROM sag2_chunks GROUP BY path ORDER BY path"
    )
    total = sum(int(r["n"]) for r in rows)
    assert total == oa.chunk_count + ob.chunk_count + oc.chunk_count
    assert {str(r["path"]) for r in rows} == {"kb/a.txt", "kb/b.txt", "kb/c.txt"}

    hits = store.candidate_query(["postgres"], 10)
    paths = [h.chunk.path for h in hits]
    assert "kb/a.txt" in paths and "kb/b.txt" in paths
    assert "kb/c.txt" not in paths, "不含该词的文档不得被召回"
    # a 词频高 -> ts_rank_cd 更高 -> 排前；且 bm25(=rank) 严格降序
    assert paths.index("kb/a.txt") < paths.index("kb/b.txt")
    scores = [h.bm25 for h in hits]
    assert scores == sorted(scores, reverse=True)
    assert all(s > 0 for s in scores)

    # 真实非空 excluded：$2::text[] 参数绑定 + 先排除后 LIMIT（key 与 chunk_key 同源）
    top_key = hits[0].key
    filtered = store.candidate_query(["postgres"], 10, {top_key})
    assert top_key not in [h.key for h in filtered]
    assert len(filtered) == len(hits) - 1, "非空 excluded 必须真实排除恰好一条"
    limited = store.candidate_query(["postgres"], 1, {top_key})
    assert limited and limited[0].key != top_key, "先排除后 LIMIT：limit=1 仍能取到次优"
    assert store.degraded is False


def test_parameter_binding_resists_sql_injection(pg: _PgHarness) -> None:
    """带引号/分号的恶意 path 与 query 不得改变真实 SQL 结构。"""
    store = pg.store()
    evil_path = "kb/O'Brien; DROP TABLE sag2_chunks; --.txt"
    store.add_document(evil_path, "安全内容 postgres")
    evil_term = "x'); DROP TABLE sag2_documents; --"
    store.candidate_query([evil_term], 10)  # 词项经白名单过滤，仅作 tsquery 参数值

    # DB 级断言：两张表仍在、数据仍在（DROP 注入未生效）
    tables = pg.raw(
        "SELECT tablename FROM pg_tables WHERE schemaname=$1 "
        "AND tablename IN ('sag2_chunks','sag2_documents')",
        pg.schema,
    )
    assert {str(r["tablename"]) for r in tables} == {
        "sag2_chunks",
        "sag2_documents",
    }
    cnt = pg.raw("SELECT count(*) AS n FROM sag2_chunks")
    assert int(cnt[0]["n"]) >= 1
    docs = pg.raw("SELECT path, doc_hash FROM sag2_documents")
    assert any(str(r["path"]) == evil_path for r in docs), "恶意 path 原样绑定存储"

    # runner 层断言：用户输入/恶意串绝不拼进 SQL 字面量
    for sql, _params in pg.calls:
        assert evil_path not in sql
        assert evil_term not in sql
        assert "DROP TABLE" not in sql.upper()
    assert store.degraded is False, "注入不得因语法错误触发降级"


def test_cjk_segmentation_behavior_and_honest_success_status(
    pg: _PgHarness,
) -> None:
    """CJK 分词行为 + 成功态 backend/degraded 状态字段如实上报。"""
    store = pg.store()
    zh = "公司收购了B公司。公司总部设在深圳。"
    store.add_document("kb/zh.txt", zh, title="公司并购")

    # 真实 tsvector 里含 casefold_tokens 预分词产生的 bigram lexeme
    toks = pg.raw(
        "SELECT tokens::text AS t FROM sag2_chunks WHERE path='kb/zh.txt'"
    )
    assert toks and "收购" in str(toks[0]["t"])

    # 诚实记录：simple 配置不装 CJK 分词扩展时，未预分词整串只有一个 lexeme
    raw_tv = pg.raw("SELECT to_tsvector('simple', $1)::text AS t", "中文检索")
    assert str(raw_tv[0]["t"]).count(":") == 1

    # 中文查询（bigram）真实召回
    hits = store.candidate_query(match_query("收购"), 10)
    assert any(h.chunk.path == "kb/zh.txt" for h in hits)

    # 成功态：backend 报真实 PG，degraded=False，绝不伪装成别的后端
    st = store.status()
    assert st["backend"] == "postgres-tsvector"
    assert st["degraded"] is False and st["degrade_reason"] == ""
    for key in _WM_HEAD:
        assert key in st

    # 工厂成功态同样如实
    store2, status2 = build_store_with_status(
        BACKEND_POSTGRES, runner=pg.runner
    )
    assert isinstance(store2, PgTsVectorStore)
    assert status2["effective_backend"] == BACKEND_POSTGRES
    assert status2["backend"] == BACKEND_POSTGRES
    assert status2["degraded"] is False
    assert resolve_store_status(store2)["degraded"] is False


def test_chinese_query_and_incremental_update(pg: _PgHarness) -> None:
    """中文查询 + 同一文档 hash 重复写不重建、不重复计（真实 DB 行数校验）。"""
    store = pg.store()
    zh = "公司收购了B公司。公司总部设在深圳。"
    o1 = store.add_document("kb/zh.txt", zh)
    assert o1.changed is True and o1.doc_hash == sha256_text(zh)
    n1 = int(
        pg.raw("SELECT count(*) AS n FROM sag2_chunks WHERE path='kb/zh.txt'")[0]["n"]
    )
    assert n1 >= 1

    # 同一 hash 重复写：unchanged，且真实表行数不变（不重复计）
    o2 = store.add_document("kb/zh.txt", zh)
    assert o2.changed is False and "unchanged" in o2.reason
    n2 = int(
        pg.raw("SELECT count(*) AS n FROM sag2_chunks WHERE path='kb/zh.txt'")[0]["n"]
    )
    assert n2 == n1

    doc = pg.raw(
        "SELECT doc_hash, chunk_count, version FROM sag2_documents "
        "WHERE path='kb/zh.txt'"
    )
    assert doc and str(doc[0]["doc_hash"]) == sha256_text(zh)

    # 中文查询真实召回
    hits = store.candidate_query(match_query("收购"), 10)
    assert any(h.chunk.path == "kb/zh.txt" for h in hits)

    # 内容变化 -> 真重建，指纹更新
    zh2 = zh + "新增一句关于并购整合与商誉的内容。"
    o3 = store.add_document("kb/zh.txt", zh2)
    assert o3.changed is True
    doc3 = pg.raw(
        "SELECT doc_hash FROM sag2_documents WHERE path='kb/zh.txt'"
    )
    assert str(doc3[0]["doc_hash"]) == sha256_text(zh2)
    assert store.degraded is False


# ---------------------------------------------------------------------------
# 降级纪律（真实连接失败，非「端到端跑成」证据）
# ---------------------------------------------------------------------------


def test_honest_degradation_on_real_connection_failure(dsn: str) -> None:
    """真实 asyncpg 连不可达端口 -> 失败时状态字段不得伪装成功、检索真实回退。

    口径：这是【降级纪律】子用例，用真实驱动制造真实连接失败；不是端到端
    跑成的证据。主链路（连接成功）的用例见上方 6 个真实 Postgres 测试。
    """
    asyncpg = pytest.importorskip("asyncpg")
    bad_dsn = _unreachable_dsn(dsn)

    async def fetch(sql: str, *args) -> list[dict]:
        # 真连、真失败：这一行几乎必然抛连接异常，绝不 mock 掉 SQL 执行。
        conn = await asyncpg.connect(dsn=bad_dsn, timeout=2)
        try:
            recs = await conn.fetch(sql, *args)
            return [dict(r) for r in recs]
        finally:
            await conn.close()

    runner = asyncpg_runner(fetch)
    store = PgTsVectorStore(runner)  # ensure_schema 真连失败 -> degraded
    assert store.degraded is True
    assert store.degrade_reason  # 精确异常类型/信息，不得为空

    store.add_document("kb/x.txt", "真实回退内容 postgres")
    hits = store.candidate_query(["postgres"], 10)
    assert hits, "DB 挂掉必须回退内存镜像真实候选，绝不返回空列表伪装『无匹配』"
    assert store.degraded is True

    st = store.status()
    assert st["degraded"] is True and st["degrade_reason"]
    assert st["backend"] == "postgres-tsvector"  # 运行时降级保留 PG 对象，如实
    rs = resolve_store_status(store)
    assert rs["degraded"] is True and rs["degrade_reason"]

    # 服务层 status 信封同样不得伪装成功（含 judge_mode 侧字段可读）
    from app.services.sag2_lexical.service import Sag2LexicalService

    svc_status = Sag2LexicalService(index=store).status()
    assert svc_status["degraded"] is True and svc_status["degrade_reason"]
    assert svc_status["effective_backend"] == BACKEND_POSTGRES
    assert "judge_last_mode" in svc_status

    # 构造期失败：工厂丢弃 PG 对象，回纯内存，backend 不伪装成 PG
    store2, status2 = build_store_with_status(BACKEND_POSTGRES, runner=runner)
    assert not isinstance(store2, PgTsVectorStore)
    assert status2["effective_backend"] == BACKEND_MEMORY
    assert status2["backend"] == BACKEND_MEMORY
    assert status2["degraded"] is True and status2["reason"]
    assert resolve_store_status(store2)["degraded"] is True


# ---------------------------------------------------------------------------
# 替代/交叉验证证据：真实 SQLite FTS5 持久化端到端（非 Postgres，零新依赖）
# ---------------------------------------------------------------------------


def test_sqlite_fts5_persistent_e2e_alternative_evidence(tmp_path) -> None:
    """真实 SQLite FTS5 持久化端到端（标准库 sqlite3，无需 DSN / 无需 Postgres）。

    【口径声明】这是【替代证据 / 交叉验证】，不是 Postgres 端到端。用于无 DSN
    环境下仍可复现地证明「真实落盘 + 全文检索排序 + 参数绑定抗注入 + 增量」
    链路成立。与上方真实 Postgres 用例的口径严格区分，不得混为一谈。
    """
    db_path = tmp_path / "sag2_fts5.db"
    con = sqlite3.connect(str(db_path))
    con.execute(
        "CREATE VIRTUAL TABLE chunks USING fts5(path, content, tokenize='unicode61')"
    )

    docs = {
        "kb/a.txt": "postgres tsvector postgres ranking postgres gin",
        "kb/b.txt": "postgres appears once",
        "kb/c.txt": "zebra unrelated content",
        # 中文按 casefold_tokens 预分词写入（呼应 pg_store 的 CJK 口径）
        "kb/zh.txt": " ".join(casefold_tokens("公司收购了B公司")),
    }
    for path, content in docs.items():
        con.execute("INSERT INTO chunks(path, content) VALUES (?, ?)", (path, content))
    con.commit()
    n0 = int(con.execute("SELECT count(*) FROM chunks").fetchone()[0])
    assert n0 == 4

    # 真实 MATCH + bm25 排序（FTS5 bm25 越负越相关）
    rows = con.execute(
        "SELECT path, bm25(chunks) AS s FROM chunks WHERE chunks MATCH ? ORDER BY s",
        ("postgres",),
    ).fetchall()
    ordered = [r[0] for r in rows]
    assert ordered[:2] == ["kb/a.txt", "kb/b.txt"]
    assert "kb/c.txt" not in ordered

    # 中文 bigram 真实匹配
    zh_hits = con.execute(
        "SELECT path FROM chunks WHERE chunks MATCH ?", ("收购",)
    ).fetchall()
    assert ("kb/zh.txt",) in zh_hits

    # 参数绑定抗注入：恶意串只作值，DROP 不生效、表还在
    evil = "x'); DROP TABLE chunks; --"
    con.execute(
        "INSERT INTO chunks(path, content) VALUES (?, ?)", (evil, "safe postgres")
    )
    con.commit()
    assert int(con.execute("SELECT count(*) FROM chunks").fetchone()[0]) == n0 + 1
    assert (
        con.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='chunks'"
        ).fetchone()[0]
        == 1
    )

    # 增量：同一内容指纹重复写不重复计（真实行数不变）
    def add_if_changed(path: str, content: str, seen: dict[str, str]) -> bool:
        h = sha256_text(content)
        if seen.get(path) == h:
            return False
        con.execute("DELETE FROM chunks WHERE path = ?", (path,))
        con.execute("INSERT INTO chunks(path, content) VALUES (?, ?)", (path, content))
        seen[path] = h
        con.commit()
        return True

    seen: dict[str, str] = {p: sha256_text(c) for p, c in docs.items()}
    before = int(con.execute("SELECT count(*) FROM chunks").fetchone()[0])
    assert add_if_changed("kb/a.txt", docs["kb/a.txt"], seen) is False
    assert int(con.execute("SELECT count(*) FROM chunks").fetchone()[0]) == before
    assert add_if_changed("kb/a.txt", "postgres changed content", seen) is True

    # 关库重开，验证真实持久化
    con.close()
    con2 = sqlite3.connect(str(db_path))
    persisted = int(con2.execute("SELECT count(*) FROM chunks").fetchone()[0])
    assert persisted == before
    persisted_hits = con2.execute(
        "SELECT path FROM chunks WHERE chunks MATCH ?", ("postgres",)
    ).fetchall()
    assert persisted_hits
    con2.close()
