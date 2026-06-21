"""Bug-94: 数据库连接池泄漏检测.

设计:
  - 跟踪每次 checkout / checkin
  - 超 N 分钟未归还视为泄漏
  - 提供 force_release 接口 (后端 worker 自动回收)
  - 配合 SQLAlchemy Pool event hooks
  - 记录泄漏栈 + 调用者

使用:
    from app.utils.pool_leak_detector import pool_leak_detector, install_sa_pool_hook

    install_sa_pool_hook(engine1)
    pool_leak_detector.set_timeout(300)  # 5min
"""

import logging
import threading
import time
import traceback
from collections import deque
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_LEAK_TIMEOUT_SEC = 300.0
DEFAULT_MAX_RECORDS = 200


@dataclass
class CheckOutRecord:
    conn_id: int
    engine: str
    checked_out_at: float
    stack: str
    context: str
    checked_in_at: float = 0.0

    def age_sec(self) -> float:
        if self.checked_in_at:
            return self.checked_in_at - self.checked_out_at
        return time.time() - self.checked_out_at

    def to_dict(self) -> dict:
        return {
            "conn_id": self.conn_id,
            "engine": self.engine,
            "checked_out_at": round(self.checked_out_at, 3),
            "checked_in_at": round(self.checked_in_at, 3) if self.checked_in_at else None,
            "age_sec": round(self.age_sec(), 1),
            "context": self.context[:100],
            "stack": self.stack[:300],
        }


class PoolLeakDetector:
    """DB 连接池泄漏检测器."""

    def __init__(self, leak_timeout_sec: float = DEFAULT_LEAK_TIMEOUT_SEC, max_records: int = DEFAULT_MAX_RECORDS):
        self._lock = threading.Lock()
        self._timeout = leak_timeout_sec
        self._max_records = max_records
        self._outstanding: dict[int, CheckOutRecord] = {}  # conn_id -> record
        self._history: deque[CheckOutRecord] = deque(maxlen=max_records)
        self._leak_warnings: deque[CheckOutRecord] = deque(maxlen=max_records)
        self._next_id = 1
        self._total_checkout = 0
        self._total_checkin = 0
        self._total_leaked = 0
        self._total_force_released = 0

    def set_timeout(self, sec: float) -> None:
        with self._lock:
            self._timeout = max(1.0, float(sec))

    def _new_id(self) -> int:
        with self._lock:
            i = self._next_id
            self._next_id += 1
            return i

    def checkout(self, engine: str, context: str = "") -> int:
        """记录一次 checkout. 返回 conn_id (>=1)."""
        conn_id = self._new_id()
        rec = CheckOutRecord(
            conn_id=conn_id,
            engine=engine,
            checked_out_at=time.time(),
            stack="".join(traceback.format_stack(limit=8)),
            context=context,
        )
        with self._lock:
            self._outstanding[conn_id] = rec
            self._total_checkout += 1
        return conn_id

    def checkin(self, conn_id: int) -> None:
        """归还连接. 若 id 不存在则忽略."""
        with self._lock:
            rec = self._outstanding.pop(conn_id, None)
            if rec is not None:
                rec.checked_in_at = time.time()
                self._history.append(rec)
                self._total_checkin += 1
            else:
                # 可能是 force_released 过了, 静默忽略
                pass

    def scan_leaks(self) -> list[dict[str, Any]]:
        """扫描超时未归还的连接, 记录为 leak. 返回新发现的 leak 列表."""
        now = time.time()
        new_leaks: list[CheckOutRecord] = []
        with self._lock:
            th = self._timeout
            for _cid, rec in list(self._outstanding.items()):
                if now - rec.checked_out_at > th:
                    new_leaks.append(rec)
                    self._leak_warnings.append(rec)
                    self._total_leaked += 1
        for rec in new_leaks:
            logger.warning(
                f"pool_leak: conn_id={rec.conn_id} engine={rec.engine} "
                f"age={now - rec.checked_out_at:.0f}s > {th}s context={rec.context[:80]}"
            )
        return [r.to_dict() for r in new_leaks]

    def force_release(self, conn_id: int) -> bool:
        """强制回收超时连接. True 表示已回收."""
        with self._lock:
            rec = self._outstanding.pop(conn_id, None)
            if rec is None:
                return False
            rec.checked_in_at = time.time()
            self._total_force_released += 1
            self._history.append(rec)
            return True

    def force_release_all_leaked(self) -> int:
        """回收所有超时连接. 返回回收数."""
        ids = [cid for cid, r in self._outstanding.items() if time.time() - r.checked_out_at > self._timeout]
        n = 0
        for cid in ids:
            if self.force_release(cid):
                n += 1
        return n

    def get_outstanding(self) -> list[dict[str, Any]]:
        with self._lock:
            return [r.to_dict() for r in self._outstanding.values()]

    def get_leaks(self) -> list[dict[str, Any]]:
        with self._lock:
            return [r.to_dict() for r in list(self._leak_warnings)[-50:][::-1]]

    def stats(self) -> dict:
        with self._lock:
            return {
                "outstanding": len(self._outstanding),
                "leak_timeout_sec": self._timeout,
                "total_checkout": self._total_checkout,
                "total_checkin": self._total_checkin,
                "total_leaked": self._total_leaked,
                "total_force_released": self._total_force_released,
                "leak_rate": round(self._total_leaked / self._total_checkout, 4) if self._total_checkout else 0.0,
                "kept_history": len(self._history),
            }

    def clear(self) -> None:
        with self._lock:
            self._outstanding.clear()
            self._history.clear()
            self._leak_warnings.clear()
            self._total_checkout = 0
            self._total_checkin = 0
            self._total_leaked = 0
            self._total_force_released = 0


# 全局单例
pool_leak_detector = PoolLeakDetector()


def install_sa_pool_hook(engine, engine_name: str | None = None) -> None:
    """给 SQLAlchemy engine 装 hook."""
    try:
        from sqlalchemy import event
    except Exception as e:
        logger.debug(f"sa pool hook skip: {e!r}")
        return
    name = engine_name or str(getattr(engine, "url", "unknown"))

    @event.listens_for(engine, "checkout")
    def _checkout(dbapi_conn, conn_record, conn_proxy):
        try:
            context = f"pool_size={engine.pool.size()}"
            pool_leak_detector.checkout(name, context=context)
        except Exception as e:
            logger.debug(f"sa pool checkout hook: {e!r}")

    @event.listens_for(engine, "checkin")
    def _checkin(dbapi_conn, conn_record):
        # checkin 没有直接 conn_id, 这里用 conn_record 引用做匹配
        # 简化: 找 outstanding 中第一个匹配的 engine
        try:
            with pool_leak_detector._lock:
                target = None
                for cid, rec in pool_leak_detector._outstanding.items():
                    if rec.engine == name and rec.checked_in_at == 0.0:
                        target = cid
                        break
            if target is not None:
                pool_leak_detector.checkin(target)
        except Exception as e:
            logger.debug(f"sa pool checkin hook: {e!r}")
