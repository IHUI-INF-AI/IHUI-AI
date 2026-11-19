# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""把 asyncpg 连接暴露成同步调用的桥 —— 机主定档「数据层只允许 PostgreSQL」后的

本项目 ai-service 里有一族**同步**存储口(工单账、记忆清理、审批落盘、会话库、SSO 身份),
它们的调用方都是同步代码;而本仓唯一的 PG 客户端是 asyncpg(异步)。四五个模块各写一份
「另起 event loop + 跨线程提交」的桥,必然漂移,所以只留这一份。

形态:一条私有连接 + 一个私有 loop 线程;调用方拿到的仍是同步方法。
不做连接池:这些存储口的并发度都是串行化过的(各自一把 `threading.Lock`),一条连接足够,
且避免把服务进程的共享池(`app.core.db_pool`)跨 loop 借用 —— 那条路 asyncpg 明确不支持。

红线:
- **不得在 loop 线程里调用本类的方法**(会自锁):`_submit` 先判当前线程。
- 连接建不起来 / DDL 失败 ⇒ 抛异常,由调用方 fail-closed;不吞成"空账"。
"""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable, Coroutine, Sequence
from typing import Any, TypeVar

import asyncpg

_DEFAULT_TIMEOUT = 30.0

_T = TypeVar("_T")

USAGE = (
    "sync = SyncPgSession(dsn, schema=(DDL_1, DDL_2))",
    "sync.execute(SQL, params)",
    "sync.fetchrow / fetchval / fetchall",
    "sync.close()",
)


class SyncPgError(RuntimeError):
    """桥自身的用法错(在 loop 线程里重入、已关闭后调用)。"""


class SyncPgSession:
    """一条 asyncpg 连接 + 一个私有 loop 线程,对上层呈现同步接口。"""

    def __init__(
        self,
        dsn: str,
        *,
        schema: Sequence[str] = (),
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        if not dsn or not dsn.strip():
            raise SyncPgError("SyncPgSession 需要非空 DSN(fail-closed,不回落 sqlite)")
        self._dsn = dsn
        self._schema = tuple(schema)
        self._timeout = timeout
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._conn: asyncpg.Connection | None = None
        self._closed = False

    # ---------------- 同步门面 ----------------

    def execute(self, sql: str, params: Sequence[Any] = ()) -> str:
        return str(self._call(lambda conn: conn.execute(sql, *params)))

    def fetchrow(self, sql: str, params: Sequence[Any] = ()) -> asyncpg.Record | None:
        return self._call(lambda conn: conn.fetchrow(sql, *params))

    def fetchval(self, sql: str, params: Sequence[Any] = ()) -> Any:
        return self._call(lambda conn: conn.fetchval(sql, *params))

    def fetchall(self, sql: str, params: Sequence[Any] = ()) -> list[asyncpg.Record]:
        return self._call(lambda conn: conn.fetch(sql, *params))

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            conn, loop, thread = self._conn, self._loop, self._thread
            self._conn = None
        if conn is not None and loop is not None:
            try:
                asyncio.run_coroutine_threadsafe(conn.close(), loop).result(self._timeout)
            except Exception:  # noqa: BLE001 - 关闭失败不改变"已关闭"这一事实
                pass
        if loop is not None:
            loop.call_soon_threadsafe(loop.stop)
        if thread is not None:
            thread.join(timeout=self._timeout)
        if loop is not None:
            loop.close()

    # ---------------- 内部 ----------------

    def _call(self, run: Callable[[asyncpg.Connection], Coroutine[Any, Any, _T]]) -> _T:
        conn = self._ensure()
        return self._submit(run(conn))

    def _ensure(self) -> asyncpg.Connection:
        with self._lock:
            if self._closed:
                raise SyncPgError("SyncPgSession 已关闭")
            if self._conn is not None:
                if threading.current_thread() is self._thread:
                    raise SyncPgError("禁止在桥自己的 loop 线程里调用同步方法(会自锁)")
                return self._conn
            loop = asyncio.new_event_loop()
            thread = threading.Thread(
                target=loop.run_forever, name="pg-sync-loop", daemon=True
            )
            thread.start()
            self._loop, self._thread = loop, thread
        try:
            conn = self._submit(self._open())
        except Exception:
            with self._lock:
                self._closed = True
            if loop is not None:
                loop.call_soon_threadsafe(loop.stop)
            raise
        with self._lock:
            self._conn = conn
        return conn

    async def _open(self) -> asyncpg.Connection:
        conn = await asyncpg.connect(self._dsn, timeout=self._timeout)
        for ddl in self._schema:
            await conn.execute(ddl)
        return conn

    def _submit(self, coro: Coroutine[Any, Any, _T]) -> _T:
        loop = self._loop
        if loop is None:
            raise SyncPgError("桥尚未建立 loop")
        if threading.current_thread() is self._thread:
            raise SyncPgError("禁止在桥自己的 loop 线程里调用同步方法(会自锁)")
        return asyncio.run_coroutine_threadsafe(coro, loop).result(self._timeout)


# 类型别名只为可读;运行时不需要。
__test__ = {"SyncPgSession": SyncPgSession, "SyncPgError": SyncPgError, "USAGE": USAGE}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
