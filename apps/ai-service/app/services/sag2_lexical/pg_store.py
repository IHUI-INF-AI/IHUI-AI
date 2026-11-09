# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道 · Postgres tsvector 存储适配器（独立新模块，零新增依赖）。

定位：公开方法签名与 ``LexicalIndex`` 对齐的可替换后端，使
``retrieval.retrieve(index, ...)`` 能 duck-type 直接换通道，主循环零改动。
索引阶段仍零 embedding / 零 LLM，只提供通用词法访问能力。

设计要点
--------
* **runner 注入**：SQL 由构造参数注入的同步 ``runner(sql, params_tuple)``
  执行；不 import asyncpg / psycopg，FakeRunner 即可跑全量单测。规范 SQL
  用 ``?`` 占位（与 ``to_tsvector('simple', ?)`` 一致），**全部用户输入走参数绑定**。
* **DDL**：``sag2_chunks`` 存分块 + ``tsvector``，GIN 索引；
  ``sag2_documents`` 存文档指纹；``ts_rank_cd`` 排序。
* **中文**：用 ``text.casefold_tokens`` 生成「空格分隔的 CJK 单字 + bigram +
  拉丁/数字整词」token 串，作为参数喂给 ``to_tsvector('simple', ?)``；
  title/heading 用 ``setweight(..., 'A')``、正文用 ``'D'`` 做字段加权。
* **查询**：``to_tsquery('simple', ?)`` 构造宽松 OR 词项表达式（每个词元
  单引号包裹 + 逐字符白名单过滤，杜绝 tsquery 操作符注入）；``excluded``
  用 ``<> ALL(?::text[])`` 参数化放进 WHERE，**先排除后 LIMIT**，与内存版
  ``candidate_query`` 同一语义边界（先 LIMIT 再过滤会把桥接词误判为无新命中）。
* **增量**：``sha256_text`` 指纹写 ``sag2_documents``；hash 未变跳过重建并返回
  与 ``AddOutcome`` 同形的 ``unchanged``；删除清干净 chunks 与指纹。
* **诚实降级**：runner 抛错 / 返回畸形 / DB 不可用时设置 ``degraded=True``
  与 ``degrade_reason``，并在 ``status()`` 报出；**绝不把空结果当成「无匹配」**
  —— 检索失败回退注入的内存镜像 ``LexicalIndex``，返回真实候选（即便镜像
  恰为空，降级标记也保留可自证，不会伪装成检索成功）。
* **SQL 侧无法等价实现、显式文档化并回退内存镜像的方法**：
  ``frequency`` / ``bm25_idf`` / ``corpus_idf`` / ``has_match`` /
  ``chunk_count`` / ``document_count`` / ``hydrate`` / ``citation`` /
  ``version``。它们依赖 ``casefold_tokens`` 的 CJK 单字 + bigram 倒排词表、
  BM25 的 dl/avgdl 统计与原文指纹校验；在 tsvector 侧要么语义不等价
  （bigram posting ≠ lexeme），要么需 N+1 次往返且仍拿不到原文区间。
  故统一由构造参数注入的 ``mirror``（默认 ``LexicalIndex()``）承接，
  **绝不静默返回空或伪造统计值**。

异步接线（async 适配说明）
--------------------------
``PgTsVectorStore.from_async_runner(fetch)`` 把 asyncpg 风格
``fetch(sql, *args)`` 适配成同步 runner：把规范 SQL 的 ``?`` 按出现顺序改写为
``$1..$n``（与本仓 ``pgvector_store.py`` / asyncpg 风格一致），params 展开为
位置参数，再用 ``asyncio.run`` 同步驱动。注意 ``retrieve`` 是协程但内部同步调
``candidate_query``：在 FastAPI 请求里请注入原生同步 runner（psycopg）或用
``await asyncio.to_thread(store.candidate_query, ...)``，不要在已运行的事件
循环里直接调 ``asyncio.run``。核心路径保持同步可组合，便于离线建库与单测。
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine, Sequence
from typing import Any, Final

from .index import (
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    AddOutcome,
    Chunk,
    LexicalIndex,
    ScoredChunk,
    sha256_text,
)
from .text import casefold_tokens

__all__ = [
    "AsyncSqlRunner",
    "PgTsVectorStore",
    "SqlParams",
    "SqlRow",
    "SqlRunner",
    "asyncpg_runner",
]

SqlParams = tuple[Any, ...]
SqlRow = dict[str, Any]
SqlRunner = Callable[[str, SqlParams], list[SqlRow]]
AsyncSqlRunner = Callable[..., Coroutine[Any, Any, list[SqlRow]]]

# ---------------------------------------------------------------------------
# DDL（幂等；tokens 由 INSERT 时用 to_tsvector('simple', ?) 生成）
# 补充字段说明：任务清单给出 path/title/heading/seq/content/hash/tokens；
# 这里额外存 chunk_id、doc_hash、start_offset/end_offset/start_line/end_line、
# chunk_key，用于把 SQL 行还原为 Chunk（citation/hydrate 锚点）与参数化排除。
# ---------------------------------------------------------------------------

_DDL_CHUNKS: Final = """
CREATE TABLE IF NOT EXISTS sag2_chunks (
    path          text NOT NULL,
    chunk_id      integer NOT NULL,
    title         text NOT NULL,
    heading       text NOT NULL,
    seq           integer NOT NULL,
    content       text NOT NULL,
    hash          text NOT NULL,
    doc_hash      text NOT NULL,
    start_offset  integer NOT NULL,
    end_offset    integer NOT NULL,
    start_line    integer NOT NULL,
    end_line      integer NOT NULL,
    chunk_key     text NOT NULL,
    tokens        tsvector,
    PRIMARY KEY (path, chunk_id)
)
"""

_DDL_GIN: Final = (
    "CREATE INDEX IF NOT EXISTS sag2_chunks_tokens_gin "
    "ON sag2_chunks USING gin (tokens)"
)

_DDL_DOCUMENTS: Final = """
CREATE TABLE IF NOT EXISTS sag2_documents (
    path         text PRIMARY KEY,
    doc_hash     text NOT NULL,
    chunk_count  integer NOT NULL,
    version      integer NOT NULL
)
"""

_SQL_SELECT_DOC: Final = (
    "SELECT path, doc_hash, chunk_count, version "
    "FROM sag2_documents WHERE path = ?"
)
_SQL_DELETE_CHUNKS: Final = "DELETE FROM sag2_chunks WHERE path = ?"
_SQL_DELETE_DOC: Final = "DELETE FROM sag2_documents WHERE path = ?"
_SQL_UPSERT_DOC: Final = (
    "INSERT INTO sag2_documents (path, doc_hash, chunk_count, version) "
    "VALUES (?, ?, ?, ?) "
    "ON CONFLICT (path) DO UPDATE SET "
    "doc_hash = EXCLUDED.doc_hash, chunk_count = EXCLUDED.chunk_count, "
    "version = EXCLUDED.version"
)
_SQL_INSERT_CHUNK: Final = (
    "INSERT INTO sag2_chunks ("
    "path, chunk_id, title, heading, seq, content, hash, doc_hash, "
    "start_offset, end_offset, start_line, end_line, chunk_key, tokens"
    ") VALUES ("
    "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
    "setweight(to_tsvector('simple', ?), 'A') || "
    "setweight(to_tsvector('simple', ?), 'A') || "
    "setweight(to_tsvector('simple', ?), 'D')"
    ")"
)
# 排除放在 WHERE 里、LIMIT 在最后：与内存版 candidate_query 一样「先排除后截断」。
_SQL_CANDIDATE: Final = """
WITH q AS (SELECT to_tsquery('simple', ?) AS query)
SELECT c.path, c.chunk_id, c.title, c.heading, c.seq, c.content, c.hash,
       c.doc_hash, c.start_offset, c.end_offset, c.start_line, c.end_line,
       c.chunk_key,
       ts_rank_cd(c.tokens, q.query, 32) AS rank
FROM sag2_chunks c, q
WHERE c.tokens @@ q.query
  AND c.chunk_key <> ALL(?::text[])
ORDER BY rank DESC, c.chunk_key ASC
LIMIT ?
"""

# runner 返回的候选行必须具备的列（缺列 = 畸形，触发降级而非当成 0 行）。
_ROW_COLUMNS: Final = (
    "path", "chunk_id", "title", "heading", "content", "doc_hash",
    "start_offset", "end_offset", "start_line", "end_line", "rank",
)


def _tsquery_expr(terms: Sequence[str]) -> str:
    """把词项列表拼成 ``to_tsquery`` 的宽松 OR 表达式（整体作为参数绑定）。

    每个词元逐字符过滤只保留字母/数字/CJK，再用单引号包成 lexeme 字面量，
    ``|`` 连接。这样即使调用方把 ``' & ! ( )`` 之类的 tsquery 操作符塞进
    terms，也只能落在「参数值」里、且被白名单削掉，无法改变查询结构。
    """
    parts: list[str] = []
    seen: set[str] = set()
    for term in terms:
        safe = "".join(ch for ch in term if ch.isalnum())
        if safe and safe not in seen:
            seen.add(safe)
            parts.append(f"'{safe}'")
    return " | ".join(parts)


def _chunk_from_row(row: SqlRow) -> Chunk:
    """把 SQL 行还原成 ``Chunk``；缺列/类型错误由调用方捕获并判为畸形。"""
    return Chunk(
        chunk_id=int(row["chunk_id"]),
        path=str(row["path"]),
        title=str(row["title"]),
        heading=str(row["heading"]),
        content=str(row["content"]),
        start=int(row["start_offset"]),
        end=int(row["end_offset"]),
        start_line=int(row["start_line"]),
        end_line=int(row["end_line"]),
        doc_hash=str(row["doc_hash"]),
    )


def asyncpg_runner(fetch: AsyncSqlRunner) -> SqlRunner:
    """asyncpg 风格 ``fetch(sql, *args)`` → 同步 ``runner(sql, params)``。

    规范 SQL 用 ``?`` 占位（便于零 DB 单测）；这里按出现顺序改写为 asyncpg
    的 ``$1..$n``，并把 params 展开。仅在同步上下文调用（离线建库 / 单测）；
    FastAPI 协程内请注入原生同步 runner 或用 ``asyncio.to_thread``。
    """
    def runner(sql: str, params: SqlParams) -> list[SqlRow]:
        pieces: list[str] = []
        index = 0
        for ch in sql:
            if ch == "?":
                index += 1
                pieces.append(f"${index}")
            else:
                pieces.append(ch)
        return asyncio.run(fetch("".join(pieces), *params))

    return runner


class PgTsVectorStore:
    """Postgres tsvector 后端，公开方法与 ``LexicalIndex`` 对齐（duck type）。

    ``degraded`` / ``degrade_reason`` 是公开状态：任一 runner 调用失败或返回
    畸形即置位并保持（sticky），直到主会话显式 ``reset_degraded()``。
    ``status()`` 同时报出这两个字段，调用方不会把「检索失败」误读成「无匹配」。
    """

    def __init__(
        self,
        runner: SqlRunner,
        *,
        mirror: LexicalIndex | None = None,
        ensure_schema: bool = True,
    ) -> None:
        self._runner = runner
        self._mirror = mirror if mirror is not None else LexicalIndex()
        self._schema_ready = False
        self.degraded = False
        self.degrade_reason = ""
        if ensure_schema:
            self.ensure_schema()

    @classmethod
    def from_async_runner(
        cls,
        fetch: AsyncSqlRunner,
        *,
        mirror: LexicalIndex | None = None,
    ) -> PgTsVectorStore:
        """用 asyncpg 风格的异步 fetch 构造（``?`` → ``$n`` + 同步适配）。"""
        return cls(asyncpg_runner(fetch), mirror=mirror)

    # -- 降级状态 -----------------------------------------------------------

    def _degrade(self, reason: str) -> None:
        self.degraded = True
        self.degrade_reason = reason

    def reset_degraded(self) -> None:
        """DB 恢复后由主会话显式清除降级标记。"""
        self.degraded = False
        self.degrade_reason = ""

    def _run(self, sql: str, params: SqlParams) -> list[SqlRow] | None:
        """执行 SQL 并做形状校验；``None`` = 明确失败（调用方须回退，不得当空结果）。"""
        try:
            raw: object = self._runner(sql, params)
        except Exception as exc:  # noqa: BLE001 - 降级必须响，不得静默
            self._degrade(f"runner 执行失败({type(exc).__name__}): {exc}")
            return None
        if not isinstance(raw, list):
            self._degrade(f"runner 返回畸形:期望 list[dict],实际 {type(raw).__name__}")
            return None
        rows: list[SqlRow] = []
        for item in raw:
            if not isinstance(item, dict):
                self._degrade("runner 返回畸形:行不是 dict")
                return None
            rows.append(item)
        return rows

    def _exec(self, sql: str, params: SqlParams) -> bool:
        return self._run(sql, params) is not None

    # -- DDL ----------------------------------------------------------------

    def ensure_schema(self) -> bool:
        """幂等建表 + GIN 索引；任一语句失败返回 False 并已置降级标记。"""
        if self._schema_ready:
            return True
        for statement in (_DDL_CHUNKS, _DDL_GIN, _DDL_DOCUMENTS):
            if not self._exec(statement, ()):
                return False
        self._schema_ready = True
        return True

    # -- 写入 / 增量 ---------------------------------------------------------

    def _chunks_for(self, path: str) -> list[Chunk]:
        """从内存镜像读该文档的分块，使 SQL 行与 BM25 统计严格同源。

        ``LexicalIndex`` 未公开「枚举块」的 API；此处是同包内对内部结构的
        **窄读取**（只读不写），避免把 ``_build_blocks`` 再抄一份导致分块漂移。
        """
        mirror = self._mirror
        ids = mirror._doc_chunks.get(path, [])
        return [mirror._chunks[cid] for cid in ids if cid in mirror._chunks]

    def add_document(
        self,
        path: str,
        content: str,
        *,
        title: str | None = None,
        heading: str = "",
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_CHUNK_OVERLAP,
    ) -> AddOutcome:
        """登记文档；PG 指纹未变则跳过重建，返回 ``unchanged`` 的 ``AddOutcome``。

        内存镜像始终同步写入：它既提供 SQL 侧拿不到的统计/校验，也是 runner
        故障时的诚实回退（不返回空列表）。
        """
        fingerprint = sha256_text(content)
        mirror_outcome = self._mirror.add_document(
            path,
            content,
            title=title,
            heading=heading,
            chunk_size=chunk_size,
            overlap=overlap,
        )
        if not self._schema_ready:
            self.ensure_schema()

        rows = self._run(_SQL_SELECT_DOC, (path,))
        if rows is None:
            # PG 不可用：内存镜像已写入，带降级标记返回真实结果，不冒充成功写入。
            return mirror_outcome

        stored = rows[0] if rows else None
        stored_hash = str(stored.get("doc_hash", "")) if stored is not None else ""
        if stored is not None and stored_hash == fingerprint:
            return AddOutcome(
                changed=False,
                reason="unchanged:文件 hash 未变,跳过重建",
                doc_hash=fingerprint,
                chunk_count=int(stored.get("chunk_count", mirror_outcome.chunk_count)),
                version=self.version,
            )

        blocks = self._chunks_for(path)
        ok = self._exec(_SQL_DELETE_CHUNKS, (path,))
        ok = self._exec(_SQL_DELETE_DOC, (path,)) and ok
        for seq, chunk in enumerate(blocks):
            chunk_key = f"{chunk.path}#{chunk.chunk_id}:{chunk.start}-{chunk.end}"
            params: SqlParams = (
                chunk.path,
                chunk.chunk_id,
                chunk.title,
                chunk.heading,
                seq,
                chunk.content,
                sha256_text(chunk.content),
                fingerprint,
                chunk.start,
                chunk.end,
                chunk.start_line,
                chunk.end_line,
                chunk_key,
                " ".join(casefold_tokens(chunk.title)),
                " ".join(casefold_tokens(chunk.heading)),
                " ".join(casefold_tokens(chunk.content)),
            )
            if not self._exec(_SQL_INSERT_CHUNK, params):
                ok = False
                break
        if ok:
            ok = self._exec(
                _SQL_UPSERT_DOC, (path, fingerprint, len(blocks), self.version)
            )
        if not ok:
            self._degrade("PG 写入未全部确认;本次以内存镜像为准并标记降级")
        return AddOutcome(
            changed=True,
            reason="rebuilt:文件新增或 hash 变化",
            doc_hash=fingerprint,
            chunk_count=len(blocks),
            version=self.version,
        )

    def remove_document(self, path: str) -> bool:
        """清干净 chunks 与 documents 指纹，并同步移除内存镜像。"""
        if not self._schema_ready:
            self.ensure_schema()
        rows = self._run(_SQL_SELECT_DOC, (path,))
        pg_had = rows is not None and len(rows) > 0
        removed = self._mirror.remove_document(path)
        ok = self._exec(_SQL_DELETE_CHUNKS, (path,))
        ok = self._exec(_SQL_DELETE_DOC, (path,)) and ok
        if not ok:
            self._degrade("PG 删除未全部确认;内存镜像已移除并标记降级")
        return removed or pg_had

    # -- 检索 ---------------------------------------------------------------

    def candidate_query(
        self,
        terms: Sequence[str],
        limit: int,
        excluded: set[str] | None = None,
    ) -> list[ScoredChunk]:
        """``ts_rank_cd`` 粗筛；失败回退内存镜像并保留降级标记。"""
        if not self._schema_ready:
            self.ensure_schema()
        expr = _tsquery_expr(terms)
        if not expr:
            return []
        params: SqlParams = (
            expr,
            sorted(excluded or set()),
            max(1, int(limit)),
        )
        rows = self._run(_SQL_CANDIDATE, params)
        if rows is None:
            # 诚实降级：绝不返回 [] 伪装成「无匹配」。
            return self._mirror.candidate_query(list(terms), limit, excluded)
        out: list[ScoredChunk] = []
        try:
            for row in rows:
                for column in _ROW_COLUMNS:
                    if column not in row:
                        raise KeyError(column)
                chunk = _chunk_from_row(row)
                out.append(
                    ScoredChunk(
                        chunk=chunk,
                        bm25=float(row["rank"]),
                        order=len(out),
                    )
                )
        except (KeyError, TypeError, ValueError) as exc:
            self._degrade(f"runner 返回畸形行:{type(exc).__name__}: {exc}")
            return self._mirror.candidate_query(list(terms), limit, excluded)
        return out

    def candidate_queries(
        self,
        required_terms: list[str],
        limit: int,
        excluded: set[str] | None = None,
    ) -> list[list[ScoredChunk]]:
        """每个扩展词一组候选，供 ``interleave`` 按 rank 轮询合并。"""
        return [
            self.candidate_query([term], limit, excluded)
            for term in required_terms
        ]

    # -- 显式回退到注入的内存镜像（见模块 docstring「SQL 侧无法等价实现」） ----

    @property
    def version(self) -> int:
        return self._mirror.version

    def chunk_count(self) -> int:
        return self._mirror.chunk_count()

    def document_count(self) -> int:
        return self._mirror.document_count()

    def document_hash(self, path: str) -> str:
        """该路径已入索引的正文 hash（与 LexicalIndex 同一判据，走 mirror）。"""
        return self._mirror.document_hash(path)

    def frequency(self, term: str) -> int:
        return self._mirror.frequency(term)

    def has_match(self, term: str) -> bool:
        return self._mirror.has_match(term)

    def has_new_candidate(self, terms: Sequence[str], excluded: set[str]) -> bool:
        """扩展词预算的「还能不能带来新段落」判定走 mirror（与 has_match 同源）。

        纯内存镜像上的判定不产生 SQL,也就不存在"SQL 侧无法等价实现"的问题;
        不代理会让 ``retrieve()`` 的鸭子类型在 PG 后端上直接 AttributeError。
        """
        return self._mirror.has_new_candidate(terms, excluded)

    def bm25_idf(self, term: str) -> float:
        return self._mirror.bm25_idf(term)

    def corpus_idf(self, term: str) -> float:
        return self._mirror.corpus_idf(term)

    def hydrate(self, candidate: ScoredChunk) -> bool:
        return self._mirror.hydrate(candidate)

    def citation(self, candidate: ScoredChunk) -> dict[str, Any]:
        return self._mirror.citation(candidate)

    # -- 状态 ---------------------------------------------------------------

    def status(self) -> dict[str, Any]:
        """索引状态 + 后端标识 + 诚实降级自证字段。"""
        data: dict[str, Any] = dict(self._mirror.status())
        data["backend"] = "postgres-tsvector"
        data["channel"] = "pg-tsvector"
        data["degraded"] = self.degraded
        data["degrade_reason"] = self.degrade_reason
        return data
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
