# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道 · Postgres 持久化层（**只做持久化，不做检索**）。

职责边界（与 ``pg_store.PgTsVectorStore`` 严格区分，两者可并存、表名不冲突）：

* ``PgTsVectorStore`` = 可选的「PG 检索后端」，需要注入**同步** SQL runner，
  检索走 ``tsvector``。本仓只有 asyncpg（异步），在已有事件循环里跑同步 runner
  会撞 ``Event loop is closed`` / 池绑定 loop 的问题，故它保持为「需要调用方
  自带同步驱动」的可选件，默认不启用。
* ``PgDocumentStore``（本模块）= 默认启用的「持久化」，用 asyncpg 共享池，
  **只回答一个问题：进程重启后索引还能不能回来**。

为什么必须有它
--------------
内存倒排索引是 SAG2 的性能来源，也是它的单点：进程一重启、索引归零，
用户辛苦登记的文件夹白扫（实测 20k 文档建库 850s，重扫不可接受）。
本模块把「原文 + 分块快照」写穿到 PG，重启后按 ``restore_document`` 灌回内存
—— 分块边界与引用区间原样保留，**重启前后 citation 逐字节一致**。

三条纪律（与全仓「诚实降级」一致）
----------------------------------
1. 写失败绝不影响本次内存索引结果：内存先写入成功，持久化失败只置
   ``last_error`` 并累加 ``failed``，``status()`` 读得到；
2. 同步调用点（``add_document`` / 文件夹扫描在 thread 里跑）**不允许阻塞**：
   写库通过线程安全队列投递，由单个 consumer 协程按序落库；
3. 没有 DATABASE_URL ⇒ ``durable=False`` + 具名 reason，绝不假装"已持久化"。
"""

from __future__ import annotations

import asyncio
import logging
import queue
import threading
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Final

from .index import Chunk

logger = logging.getLogger(__name__)

__all__ = [
    "ENV_DATABASE_URL",
    "PgDocumentStore",
    "PersistItem",
    "PersistenceStatus",
    "PoolProvider",
]

ENV_DATABASE_URL: Final = "DATABASE_URL"

#: 一批读出多少文档（恢复阶段分批，避免一次把 20k 文档的正文全压进内存峰值）。
LOAD_BATCH: Final = 200
#: 队列上限。超限时**丢弃最旧**而不是无限堆积：持久化是尽力而为，
#: 内存索引才是当下的真相；堆积到几个 G 只会把进程拖死。
QUEUE_MAX: Final = 4096

PoolProvider = Callable[[], Awaitable[Any]]

_DDL_DOCS: Final = """
CREATE TABLE IF NOT EXISTS sag2_lexical_docs (
    path        text PRIMARY KEY,
    doc_hash    text NOT NULL,
    title       text NOT NULL,
    content     text NOT NULL,
    chunk_count integer NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
)
"""

_DDL_CHUNKS: Final = """
CREATE TABLE IF NOT EXISTS sag2_lexical_chunks (
    path       text NOT NULL,
    seq        integer NOT NULL,
    title      text NOT NULL,
    heading    text NOT NULL,
    content    text NOT NULL,
    start_off  integer NOT NULL,
    end_off    integer NOT NULL,
    start_line integer NOT NULL,
    end_line   integer NOT NULL,
    PRIMARY KEY (path, seq)
)
"""

_DDL_UPDATED_INDEX: Final = (
    "CREATE INDEX IF NOT EXISTS sag2_lexical_docs_updated "
    "ON sag2_lexical_docs (updated_at DESC)"
)

_SQL_UPSERT_DOC: Final = """
INSERT INTO sag2_lexical_docs (path, doc_hash, title, content, chunk_count, updated_at)
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT (path) DO UPDATE SET
    doc_hash = EXCLUDED.doc_hash,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    chunk_count = EXCLUDED.chunk_count,
    updated_at = now()
"""

_SQL_DELETE_CHUNKS: Final = "DELETE FROM sag2_lexical_chunks WHERE path = $1"
_SQL_DELETE_DOC: Final = "DELETE FROM sag2_lexical_docs WHERE path = $1"

_SQL_INSERT_CHUNK: Final = """
INSERT INTO sag2_lexical_chunks (
    path, seq, title, heading, content, start_off, end_off, start_line, end_line
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
"""

# 键集分页：不依赖 OFFSET，恢复途中新写入的文档不会被跳过或重复。
_SQL_LOAD_DOCS: Final = """
SELECT path, doc_hash, title, content
FROM sag2_lexical_docs
WHERE path > $1
ORDER BY path
LIMIT $2
"""

_SQL_LOAD_CHUNKS: Final = """
SELECT path, seq, title, heading, content, start_off, end_off, start_line, end_line
FROM sag2_lexical_chunks
WHERE path = ANY($1::text[])
ORDER BY path, seq
"""

_SQL_COUNT: Final = (
    "SELECT count(*) AS docs, coalesce(sum(chunk_count), 0) AS chunks "
    "FROM sag2_lexical_docs"
)


@dataclass
class PersistItem:
    """一次待落库的文档快照（含分块，避免 consumer 再去读内存索引）。"""

    path: str
    title: str
    content: str
    doc_hash: str
    chunks: list[Chunk] = field(default_factory=list)
    kind: str = "upsert"  # upsert | delete


@dataclass
class PersistenceStatus:
    """持久化自证：调用方一眼看出「这次重启会不会丢索引」。"""

    backend: str = "none"
    durable: bool = False
    available: bool = False
    reason: str = ""
    pending: int = 0
    saved: int = 0
    failed: int = 0
    dropped: int = 0
    last_error: str = ""
    restored_documents: int = 0
    restored_chunks: int = 0
    restoring: bool = False
    restore_error: str = ""
    restore_ms: float = 0.0
    schema_ready: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "backend": self.backend,
            "durable": self.durable,
            "available": self.available,
            "reason": self.reason,
            "pending": self.pending,
            "saved": self.saved,
            "failed": self.failed,
            "dropped": self.dropped,
            "last_error": self.last_error,
            "restored_documents": self.restored_documents,
            "restored_chunks": self.restored_chunks,
            "restoring": self.restoring,
            "restore_error": self.restore_error,
            "restore_ms": round(self.restore_ms, 3),
            "schema_ready": self.schema_ready,
        }


async def _default_pool_provider() -> Any:
    """默认池：懒导入项目共享 asyncpg 池（单测注入 Fake 即可绕开）。"""
    from app.core.db_pool import get_shared_pool

    return await get_shared_pool()


class PgDocumentStore:
    """SAG2 索引的 PG 持久化。**全部方法都不抛异常**，失败一律落到 status。"""

    def __init__(
        self,
        pool_provider: PoolProvider | None = None,
        *,
        queue_max: int = QUEUE_MAX,
    ) -> None:
        self._pool_provider: PoolProvider = pool_provider or _default_pool_provider
        self._pool: Any = None
        self._queue: queue.Queue[PersistItem] = queue.Queue(maxsize=queue_max)
        self._consumer: asyncio.Task[None] | None = None
        self._lock = threading.Lock()
        #: consumer 已取出但还没写完的条数。``drain`` 必须等它归零，
        #: 否则「队列空了」不等于「落库完了」（qsize 在 get 的瞬间就归零）。
        self._in_flight = 0
        self.status = PersistenceStatus(
            backend="postgres", reason="pending:尚未确认 schema"
        )

    # -- 连接 / DDL ---------------------------------------------------------

    async def _get_pool(self) -> Any:
        if self._pool is None:
            self._pool = await self._pool_provider()
        return self._pool

    async def ensure_schema(self) -> bool:
        """幂等建表；失败返回 False 并写 reason（不抛）。"""
        if self.status.schema_ready:
            return True
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                for statement in (_DDL_DOCS, _DDL_CHUNKS, _DDL_UPDATED_INDEX):
                    await conn.execute(statement)
        except Exception as exc:  # noqa: BLE001 - 持久化不可用不得影响主链路
            self.status.reason = f"schema-failed:{type(exc).__name__}: {exc}"
            self.status.durable = False
            return False
        self.status.schema_ready = True
        self.status.available = True
        self.status.durable = True
        self.status.reason = ""
        return True

    def mark_unavailable(self, reason: str) -> None:
        """显式标记不可持久化（如没配 DATABASE_URL），status 可读，不假装成功。"""
        self.status.available = False
        self.status.durable = False
        self.status.reason = reason
        self.status.backend = "none"

    # -- 写入（同步调用点用 enqueue，异步调用点可直接 save） ------------------

    @property
    def configured(self) -> bool:
        """是否**配置了**持久化后端（与「schema 是否已确认」解耦）。

        这两件事必须分开：schema 是懒确认的（第一次写才建表），如果拿
        ``available`` 当投递开关，「建表完成前到达的每一份文档」都会被静默
        丢弃 —— 实测重启后一条都回不来。只有 ``mark_unavailable``（明确没配
        DATABASE_URL / 明确不可用）才该关掉投递。
        """
        return self.status.backend != "none"

    def enqueue(self, item: PersistItem) -> None:
        """线程安全投递；队列满则丢弃最旧并计数（绝不阻塞调用方）。"""
        if not self.configured:
            return
        try:
            self._queue.put_nowait(item)
        except queue.Full:
            try:
                self._queue.get_nowait()
                self.status.dropped += 1
                self._queue.put_nowait(item)
            except (queue.Empty, queue.Full):
                self.status.dropped += 1

    def enqueue_save(
        self,
        path: str,
        content: str,
        doc_hash: str,
        chunks: Sequence[Chunk],
        *,
        title: str = "",
    ) -> None:
        self.enqueue(
            PersistItem(
                path=path,
                title=title or path.rsplit("/", 1)[-1],
                content=content,
                doc_hash=doc_hash,
                chunks=list(chunks),
                kind="upsert",
            )
        )

    def enqueue_delete(self, path: str) -> None:
        self.enqueue(
            PersistItem(path=path, title="", content="", doc_hash="", kind="delete")
        )

    async def save_document(
        self,
        path: str,
        content: str,
        doc_hash: str,
        chunks: Sequence[Chunk],
        *,
        title: str = "",
    ) -> bool:
        """同步落库一份文档（doc + chunks 同一事务）。失败返回 False。"""
        if not await self.ensure_schema():
            return False
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        _SQL_UPSERT_DOC,
                        path,
                        doc_hash,
                        title or path.rsplit("/", 1)[-1],
                        content,
                        len(chunks),
                    )
                    await conn.execute(_SQL_DELETE_CHUNKS, path)
                    if chunks:
                        await conn.executemany(
                            _SQL_INSERT_CHUNK,
                            [
                                (
                                    path,
                                    seq,
                                    chunk.title,
                                    chunk.heading,
                                    chunk.content,
                                    chunk.start,
                                    chunk.end,
                                    chunk.start_line,
                                    chunk.end_line,
                                )
                                for seq, chunk in enumerate(chunks)
                            ],
                        )
        except Exception as exc:  # noqa: BLE001
            self.status.failed += 1
            self.status.last_error = f"save:{type(exc).__name__}: {exc}"
            return False
        self.status.saved += 1
        return True

    async def delete_document(self, path: str) -> bool:
        if not await self.ensure_schema():
            return False
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(_SQL_DELETE_CHUNKS, path)
                    await conn.execute(_SQL_DELETE_DOC, path)
        except Exception as exc:  # noqa: BLE001
            self.status.failed += 1
            self.status.last_error = f"delete:{type(exc).__name__}: {exc}"
            return False
        return True

    # -- consumer：把队列按序落库 -------------------------------------------

    async def _consume(self) -> None:
        """轮询队列落库。

        刻意**不用** ``run_in_executor(self._queue.get)`` 做阻塞等待：那样
        「取消 task」不会打断已经挂在默认线程池里的那次 get，进程退出时
        executor shutdown 会一直等（实测直接把测试进程挂到超时被 SIGTERM）。
        50ms 轮询的代价换来的是可取消、可退出 —— 持久化本来就不要求实时。
        """
        while True:
            try:
                item = self._queue.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.05)
                continue
            self._in_flight += 1
            try:
                if item.kind == "delete":
                    await self.delete_document(item.path)
                else:
                    await self.save_document(
                        item.path,
                        item.content,
                        item.doc_hash,
                        item.chunks,
                        title=item.title,
                    )
            except Exception as exc:  # noqa: BLE001 - consumer 绝不因单条退出
                self.status.failed += 1
                self.status.last_error = f"consumer:{type(exc).__name__}: {exc}"
            finally:
                self._in_flight -= 1
                self._queue.task_done()

    def start_consumer(self) -> bool:
        """启动 consumer 协程（幂等）。无事件循环时返回 False。"""
        if self._consumer is not None and not self._consumer.done():
            return True
        if not self.configured:
            return False
        try:
            self._consumer = asyncio.get_running_loop().create_task(self._consume())
        except RuntimeError:
            return False
        return True

    async def drain(self, timeout_s: float = 5.0) -> int:
        """等队列与在途项都写完，返回仍未完成的条数（0 = 全落库）。"""
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if self._queue.empty() and self._in_flight == 0:
                return 0
            await asyncio.sleep(0.02)
        return self._queue.qsize() + self._in_flight

    async def aclose(self) -> None:
        await self.drain()
        if self._consumer is not None:
            self._consumer.cancel()
            try:
                await self._consumer
            except asyncio.CancelledError:
                pass
            except Exception as exc:  # noqa: BLE001 - 关闭路径不抛
                self.status.last_error = f"close:{type(exc).__name__}: {exc}"
            self._consumer = None

    # -- 恢复：把 PG 里的索引灌回内存 ---------------------------------------

    async def load_all(
        self,
        restore: Callable[[str, str, list[Chunk], str], int],
    ) -> tuple[int, int]:
        """分批读出全部文档并调用 ``restore(path, content, chunks, doc_hash)``。

        返回 ``(文档数, 块数)``。``restore`` 返回 0（快照不可用）时回落为
        「只给原文、让调用方重新分块」——由调用方在 restore 内部处理。
        单批失败只记错误并继续下一批，不整轮放弃（部分恢复好过完全不可用）。
        """
        if not await self.ensure_schema():
            self.status.restore_error = self.status.reason or "schema 未就绪"
            return 0, 0
        started = time.perf_counter()
        self.status.restoring = True
        docs = 0
        chunks = 0
        cursor = ""
        try:
            pool = await self._get_pool()
            while True:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(_SQL_LOAD_DOCS, cursor, LOAD_BATCH)
                    if not rows:
                        break
                    paths = [str(row["path"]) for row in rows]
                    chunk_rows = await conn.fetch(_SQL_LOAD_CHUNKS, paths)
                by_path: dict[str, list[Chunk]] = {}
                for row in chunk_rows:
                    by_path.setdefault(str(row["path"]), []).append(
                        Chunk(
                            chunk_id=0,
                            path=str(row["path"]),
                            title=str(row["title"]),
                            heading=str(row["heading"]),
                            content=str(row["content"]),
                            start=int(row["start_off"]),
                            end=int(row["end_off"]),
                            start_line=int(row["start_line"]),
                            end_line=int(row["end_line"]),
                            # 分块表不存 doc_hash（它在 docs 表），由 restore 的
                            # 入参覆盖 —— 这里留空代表「以文档级指纹为准」。
                            doc_hash="",
                        )
                    )
                for row in rows:
                    path = str(row["path"])
                    restored = restore(
                        path,
                        str(row["content"]),
                        by_path.get(path, []),
                        str(row["doc_hash"]),
                    )
                    if restored:
                        docs += 1
                        chunks += restored
                        self.status.restored_documents = docs
                        self.status.restored_chunks = chunks
                cursor = str(rows[-1]["path"])
        except Exception as exc:  # noqa: BLE001
            self.status.restore_error = f"load:{type(exc).__name__}: {exc}"
            logger.warning("[sag2-persist] 恢复中断: %s", self.status.restore_error)
        finally:
            self.status.restoring = False
            self.status.restore_ms = (time.perf_counter() - started) * 1000.0
        return docs, chunks

    async def stats(self) -> dict[str, Any]:
        """PG 侧的真实条数（与内存 count 对账用；失败返回 error 字段）。"""
        if not await self.ensure_schema():
            return {"error": self.status.reason}
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(_SQL_COUNT)
        except Exception as exc:  # noqa: BLE001
            return {"error": f"{type(exc).__name__}: {exc}"}
        if row is None:
            return {"documents": 0, "chunks": 0}
        return {
            "documents": int(row["docs"]),
            "chunks": int(row["chunks"]),
        }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
