# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""D8 pgvector 向量存储层(2026-09-19 立,对标 Cursor/Qoder 专业 RAG 存储)。

- 复用共享连接池 app/core/db_pool.get_shared_pool()(asyncpg,不新增依赖)。
- 表 rag_chunks 幂等自建(CREATE EXTENSION IF NOT EXISTS vector + CREATE TABLE IF NOT
  EXISTS),零 drizzle journal 状态风险;正式 drizzle 迁移可后续由 drizzle-kit 生成收编。
- pgvector 原生 SQL 字面量('[1,2,3]'::vector)存取,兼容混合维度(dims 列过滤)。
- 全方法静默降级:连接失败/扩展缺失返回空结果,由调用方回落内存 hash 检索;
  连续 3 次致命错误后熔断(进程内禁用),可用 IHUI_PGVECTOR_DISABLE=1 全局关闭。
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_NAMESPACE = "rag_chunks_default"
_FATAL_THRESHOLD = 3

_schema_ensured = False
_consecutive_failures = 0
_disabled = False


def _is_disabled() -> bool:
    if os.environ.get("IHUI_PGVECTOR_DISABLE") == "1":
        return True
    return _disabled


def _reset_circuit() -> None:
    global _consecutive_failures, _disabled, _schema_ensured
    _consecutive_failures = 0
    _disabled = False
    _schema_ensured = False


class PgVectorSchemaUnavailable(RuntimeError):
    """pgvector schema 未就绪(建表/索引没建成功)。

    与「查询成功但确实没有匹配」必须可区分:前者是故障,后者是空结果。
    ``search_chunks`` / ``clear_chunks`` 在 schema 不可用时抛本异常,不再返回空。
    """


_SEARCH_METRIC = "pgvector_search_total"
_CLEAR_METRIC = "pgvector_clear_total"


def _record_pg_metric(name: str, outcome: str) -> None:
    """把调用结果记到统一遥测;遥测不可用不影响主链路。"""
    try:
        from .telemetry_service import Counter, telemetry_service
    except ImportError:
        return
    metric = telemetry_service.registry.get_metric(name)
    if isinstance(metric, Counter):
        metric.inc(1, outcome=outcome)


def _vec_literal(embedding: list[float]) -> str:
    """把向量序列化为 pgvector 字面量(不依赖 pgvector Python 包)。"""
    return "[" + ",".join(f"{float(x):.7g}" for x in embedding) + "]"


# 只有「对象已存在」才允许静默:42P07 = duplicate_table,42710 = duplicate_object。
# 其余任何建表 / 建索引失败都必须可见(尤其 HNSW 因列无维度而失败时,检索会悄悄
# 退化成顺序扫描 —— 「优化看起来做了,实际没做」是比报错更难发现的事故)。
_ALREADY_EXISTS_SQLSTATES = frozenset({"42P07", "42710"})
_ALREADY_EXISTS_NAMES = frozenset({"DuplicateTableError", "DuplicateObjectError"})


def _sqlstate(err: BaseException) -> str | None:
    """取 SQLSTATE;asyncpg 挂 ``sqlstate``,psycopg2 挂 ``pgcode``。"""
    code = getattr(err, "sqlstate", None) or getattr(err, "pgcode", None)
    return code if isinstance(code, str) else None


def _is_already_exists(err: BaseException) -> bool:
    """仅「已存在」类错误可静默(按 SQLSTATE 或 asyncpg 异常类名判定)。"""
    return _sqlstate(err) in _ALREADY_EXISTS_SQLSTATES or type(err).__name__ in _ALREADY_EXISTS_NAMES


async def _execute_ddl(conn: Any, sql: str, what: str) -> bool:
    """执行一条必要 DDL:成功返回 True;失败记 warning(含 SQLSTATE)并返回 False。

    失败不向上抛(不能因为 DDL 失败拖垮启动 / 主链路),但也**不能静默** ——
    调用方据此降级,日志里必须留下原因。
    """
    try:
        await conn.execute(sql)
        return True
    except Exception as e:  # noqa: BLE001
        if _is_already_exists(e):
            logger.info("pgvector %s已存在,跳过", what)
            return True
        logger.warning(
            "pgvector %s失败(sqlstate=%s, %s): %s",
            what,
            _sqlstate(e) or "unknown",
            type(e).__name__,
            e,
        )
        return False


async def _ensure_schema(pool: Any) -> bool:
    """幂等建扩展与表;必要 DDL 失败返回 False(调用方降级)。"""
    global _schema_ensured
    if _schema_ensured:
        return True
    async with pool.acquire() as conn:
        # CREATE EXTENSION 需超管,包 DO 块失败不阻塞建表(超管已装过则直接可用)。
        # 这一处**不是**静默吞掉:紧接着的 pg_extension 探测决定了能力是否真的可用,
        # 不可用时 _ensure_schema 返回 False、由调用方计入失败计数并熔断。
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        except Exception as e:  # noqa: BLE001 - 权限不足等场景静默降级
            logger.info("pgvector 扩展创建跳过(可能已存在或无权限): %s", e)
        # 先探扩展是否真的可用
        avail = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector')")
        if not avail:
            return False
        table_ok = await _execute_ddl(
            conn,
            """
            CREATE TABLE IF NOT EXISTS rag_chunks (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                namespace text NOT NULL,
                source text,
                ref_id text NOT NULL,
                content text NOT NULL,
                embedding vector,
                dims integer NOT NULL DEFAULT 0,
                metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at timestamptz NOT NULL DEFAULT now()
            )
            """,
            "建表",
        )
        if not table_ok:
            return False
        if not await _execute_ddl(
            conn,
            "CREATE UNIQUE INDEX IF NOT EXISTS rag_chunks_ns_ref_uidx ON rag_chunks (namespace, source, ref_id)",
            "唯一索引",
        ):
            return False
        # ANN 索引:hnsw(pgvector>=0.5)。它只是检索优化:失败不阻断功能(顺序扫描兜底),
        # 但必须按 warning 暴露 —— 修前用 info 吞掉,线上 HNSW 从未建成也无人可见。
        try:
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw_idx ON rag_chunks USING hnsw (embedding vector_cosine_ops)"
            )
        except Exception as e:  # noqa: BLE001
            if _is_already_exists(e):
                logger.info("pgvector hnsw 索引已存在,跳过重建")
            else:
                logger.warning(
                    "pgvector hnsw 索引创建失败(sqlstate=%s, %s): %s;检索将走顺序扫描",
                    _sqlstate(e) or "unknown",
                    type(e).__name__,
                    e,
                )
    _schema_ensured = True
    return True


def _note_failure() -> None:
    global _consecutive_failures, _disabled
    _consecutive_failures += 1
    if _consecutive_failures >= _FATAL_THRESHOLD:
        _disabled = True
        logger.warning("pgvector 连续失败 %d 次,进程内熔断,回落内存检索", _consecutive_failures)


def _note_success() -> None:
    global _consecutive_failures
    _consecutive_failures = 0


async def upsert_chunk(
    namespace: str,
    source: str,
    ref_id: str,
    content: str,
    embedding: list[float],
    metadata: dict[str, Any] | None = None,
) -> bool:
    """写入/更新一个向量块。失败返回 False(调用方降级)。"""
    if _is_disabled() or not embedding:
        return False
    try:
        from ..core.db_pool import get_shared_pool

        pool = await get_shared_pool()
        if not await _ensure_schema(pool):
            _note_failure()
            return False
        await pool.execute(
            """
            INSERT INTO rag_chunks (namespace, source, ref_id, content, embedding, dims, metadata)
            VALUES ($1, $2, $3, $4, $5::vector, $6, $7::jsonb)
            ON CONFLICT (namespace, source, ref_id)
            DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding,
                          dims = EXCLUDED.dims, metadata = EXCLUDED.metadata
            """,
            namespace,
            source,
            ref_id,
            content,
            _vec_literal(embedding),
            len(embedding),
            json.dumps(metadata or {}, ensure_ascii=False),
        )
        _note_success()
        return True
    except Exception as e:  # noqa: BLE001
        logger.debug("pgvector upsert 失败(降级): %s", e)
        _note_failure()
        return False


async def search_chunks(
    namespace: str,
    query_embedding: list[float],
    top_k: int = 10,
    threshold: float = 0.7,
) -> list[tuple[str, dict[str, Any], float]]:
    """pgvector 余弦检索。返回 [(ref_id, metadata, similarity)]。

    schema 不可用(建表/索引失败)时抛 :class:`PgVectorSchemaUnavailable`,**不返回
    空列表** —— 否则「表建不出来」会被上层读成「没有匹配内容」。真实无匹配仍返回 ``[]``,
    两者在遥测里分别记为 ``schema_unavailable`` / ``empty``。
    其余运行时查询失败(超时等)保持 fail-open 返回 ``[]``,记为 ``error``。
    """
    if _is_disabled() or not query_embedding:
        _record_pg_metric(_SEARCH_METRIC, "skipped")
        return []
    try:
        from ..core.db_pool import get_shared_pool

        pool = await get_shared_pool()
        if not await _ensure_schema(pool):
            _note_failure()
            _record_pg_metric(_SEARCH_METRIC, "schema_unavailable")
            raise PgVectorSchemaUnavailable("pgvector schema 未就绪,检索不可用")
        rows = await pool.fetch(
            """
            SELECT ref_id, metadata::text AS metadata_json,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM rag_chunks
            WHERE namespace = $2 AND dims = $3 AND embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            _vec_literal(query_embedding),
            namespace,
            len(query_embedding),
            max(1, int(top_k)),
        )
        _note_success()
        results: list[tuple[str, dict[str, Any], float]] = []
        for row in rows:
            sim = float(row["similarity"])
            if sim < threshold:
                continue
            try:
                meta = json.loads(row["metadata_json"] or "{}")
            except Exception:  # noqa: BLE001
                meta = {}
            results.append((str(row["ref_id"]), meta, sim))
        _record_pg_metric(_SEARCH_METRIC, "hit" if results else "empty")
        return results
    except PgVectorSchemaUnavailable:
        raise
    except Exception as e:  # noqa: BLE001
        logger.debug("pgvector search 失败(降级): %s", e)
        _note_failure()
        _record_pg_metric(_SEARCH_METRIC, "error")
        return []


async def delete_chunk(namespace: str, source: str, ref_id: str) -> bool:
    if _is_disabled():
        return False
    try:
        from ..core.db_pool import get_shared_pool

        pool = await get_shared_pool()
        if not await _ensure_schema(pool):
            return False
        await pool.execute(
            "DELETE FROM rag_chunks WHERE namespace = $1 AND source = $2 AND ref_id = $3",
            namespace,
            source,
            ref_id,
        )
        return True
    except Exception as e:  # noqa: BLE001
        logger.debug("pgvector delete 失败(忽略): %s", e)
        return False


async def clear_chunks(namespace: str, session_id: str | None = None) -> int:
    """清空 namespace(或其中某 session)的向量块,返回删除行数。

    schema 不可用时抛 :class:`PgVectorSchemaUnavailable`,与「确实没有可删的行」
    (返回 0)区分开;遥测分别记 ``schema_unavailable`` / ``ok`` / ``error``。
    """
    if _is_disabled():
        _record_pg_metric(_CLEAR_METRIC, "skipped")
        return 0
    try:
        from ..core.db_pool import get_shared_pool

        pool = await get_shared_pool()
        if not await _ensure_schema(pool):
            _record_pg_metric(_CLEAR_METRIC, "schema_unavailable")
            raise PgVectorSchemaUnavailable("pgvector schema 未就绪,清空不可用")
        if session_id:
            row = await pool.fetchrow(
                """
                WITH del AS (
                    DELETE FROM rag_chunks
                    WHERE namespace = $1 AND metadata->>'sessionId' = $2
                    RETURNING 1
                ) SELECT count(*)::int AS n FROM del
                """,
                namespace,
                session_id,
            )
        else:
            row = await pool.fetchrow(
                "WITH del AS (DELETE FROM rag_chunks WHERE namespace = $1 RETURNING 1) SELECT count(*)::int AS n FROM del",
                namespace,
            )
        _record_pg_metric(_CLEAR_METRIC, "ok")
        return int(row["n"]) if row else 0
    except PgVectorSchemaUnavailable:
        raise
    except Exception as e:  # noqa: BLE001
        logger.debug("pgvector clear 失败(忽略): %s", e)
        _record_pg_metric(_CLEAR_METRIC, "error")
        return 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
