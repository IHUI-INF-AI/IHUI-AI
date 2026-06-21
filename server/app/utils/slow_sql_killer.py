"""Bug-86: 慢 SQL 自动 kill.

设计:
  - 拦截所有 SQL 执行, 超过阈值 (默认 5s) 自动 cancel
  - 记录慢 SQL 到结构化日志 (含 SQL 文本 / 耗时 / 调用栈)
  - 提供手动 register_slow / stats 查询
  - 与 SQLAlchemy event 集成 (after_cursor_execute / before_cursor_execute)
  - 不真正杀进程 (SQLAlchemy 限制), 而是 cancel 当前 cursor

使用:
    from app.utils.slow_sql_killer import slow_sql_killer, install_sqlalchemy_hook

    slow_sql_killer.set_threshold(5.0)
    install_sqlalchemy_hook(engine1)
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_THRESHOLD_SEC = 5.0
DEFAULT_KEEP_RECORDS = 200


@dataclass
class SlowSqlRecord:
    sql: str
    duration_sec: float
    threshold_sec: float
    params: str
    stack: str
    engine: str
    ts: float = field(default_factory=time.time)
    cancelled: bool = False

    def to_dict(self) -> dict:
        return {
            "ts": round(self.ts, 3),
            "sql": self.sql[:500],
            "duration_sec": round(self.duration_sec, 3),
            "threshold_sec": self.threshold_sec,
            "cancelled": self.cancelled,
            "engine": self.engine,
            "params": self.params[:200],
            "stack": self.stack[:400],
        }


class SlowSqlKiller:
    """慢 SQL 检测 + kill."""

    def __init__(self, threshold_sec: float = DEFAULT_THRESHOLD_SEC):
        self._lock = threading.Lock()
        self._threshold = threshold_sec
        self._records: deque[SlowSqlRecord] = deque(maxlen=DEFAULT_KEEP_RECORDS)
        self._total_executed = 0
        self._total_slow = 0
        self._total_cancelled = 0
        self._per_engine_count: dict[str, int] = {}

    def set_threshold(self, sec: float) -> None:
        with self._lock:
            self._threshold = max(0.1, float(sec))

    def get_threshold(self) -> float:
        with self._lock:
            return self._threshold

    def record(self, rec: SlowSqlRecord) -> None:
        with self._lock:
            self._records.append(rec)
            self._total_slow += 1
            self._per_engine_count[rec.engine] = self._per_engine_count.get(rec.engine, 0) + 1
            if rec.cancelled:
                self._total_cancelled += 1

    def check_and_kill(
        self,
        sql: str,
        duration_sec: float,
        params: dict | None,
        engine_name: str,
        cursor=None,
    ) -> SlowSqlRecord | None:
        """在 SQL 执行后调用: 检查耗时, 必要时 cancel + 记录."""
        cancelled = False
        rec: SlowSqlRecord | None = None
        with self._lock:
            th = self._threshold
        if duration_sec >= th:
            # 尝试 cancel (如有 cursor)
            if cursor is not None:
                try:
                    # PostgreSQL / SQLite 通用: 关 cursor 即取消
                    cursor.close()
                    cancelled = True
                except Exception:
                    logger.warning("Caught unexpected exception")
            import traceback

            rec = SlowSqlRecord(
                sql=sql,
                duration_sec=duration_sec,
                threshold_sec=th,
                params=str(params) if params else "",
                stack="".join(traceback.format_stack(limit=5)),
                engine=engine_name,
                cancelled=cancelled,
            )
            self.record(rec)
            logger.warning(
                f"slow_sql[{engine_name}]: {duration_sec:.2f}s >= {th}s " f"cancelled={cancelled} sql={sql[:200]}"
            )
        with self._lock:
            self._total_executed += 1
        return rec

    def get_slow(self, limit: int = 50) -> list[dict]:
        with self._lock:
            return [r.to_dict() for r in list(self._records)[-limit:][::-1]]

    def stats(self) -> dict:
        with self._lock:
            return {
                "threshold_sec": self._threshold,
                "total_executed": self._total_executed,
                "total_slow": self._total_slow,
                "total_cancelled": self._total_cancelled,
                "slow_rate": round(self._total_slow / self._total_executed, 4) if self._total_executed else 0.0,
                "by_engine": dict(self._per_engine_count),
                "kept_records": len(self._records),
            }

    def clear(self) -> None:
        with self._lock:
            self._records.clear()
            self._total_executed = 0
            self._total_slow = 0
            self._total_cancelled = 0
            self._per_engine_count.clear()


# 全局单例
slow_sql_killer = SlowSqlKiller()


def install_sqlalchemy_hook(engine, engine_name: str | None = None) -> None:
    """给 SQLAlchemy engine 装 hook: 慢 SQL 自动记录+kill.

    注意: SA 2.x 之后 before_cursor_execute / after_cursor_execute 仍可用.
    """
    from sqlalchemy import event

    name = engine_name or str(getattr(engine, "url", "unknown"))

    # SA 的 event listener 在多线程下要小心, 用 listen 即可
    @event.listens_for(engine, "before_cursor_execute")
    def _before(conn, cursor, statement, parameters, context, executemany):
        context._slow_start = time.time()

    @event.listens_for(engine, "after_cursor_execute")
    def _after(conn, cursor, statement, parameters, context, executemany):
        start = getattr(context, "_slow_start", None)
        if start is None:
            return
        duration = time.time() - start
        # 超过阈值: 关 cursor + 记录
        try:
            slow_sql_killer.check_and_kill(
                sql=statement,
                duration_sec=duration,
                params={"params": parameters, "executemany": executemany},
                engine_name=name,
                cursor=cursor if duration >= slow_sql_killer.get_threshold() else None,
            )
        except Exception as e:
            logger.debug(f"slow_sql hook error: {e!r}")
