"""Backfill 进度广播器 (建议 145) - app/backfill_broadcaster.py.

设计:
  - 内存中保存当前 backfill 状态 + 进度
  - 支持多个 SSE 订阅者同时拉取
  - 每秒推送一次最新进度
  - 用 threading.Lock 保证并发安全
  - 历史事件保留最近 1000 条

用法:
    from app.backfill_broadcaster import (
        get_broadcaster, BackfillEvent, BackfillEventType,
    )
    bc = get_broadcaster()
    bc.publish_started(table="users", total=10000)
    bc.publish_tenant_progress(table="users", tenant_id=1, processed=500, total=2000)
    ...
    bc.publish_complete(table="users", processed=10000)
"""

from __future__ import annotations

import contextlib
import logging
import queue
import threading
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.backfill_event import BackfillEvent, BackfillEventType

if TYPE_CHECKING:
    from app.backfill_persister import BackfillPersister


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 事件 (定义见 app/backfill_event.py, 避免循环依赖)
# ---------------------------------------------------------------------------
# BackfillEvent / BackfillEventType 在 backfill_event 模块中定义
# 这里 re-export 以保持向后兼容

# ---------------------------------------------------------------------------
# 状态
# ---------------------------------------------------------------------------


@dataclass
class BackfillTableState:
    table: str
    status: str = "idle"  # idle / running / done / error
    started_at: float = 0.0
    finished_at: float = 0.0
    total: int = 0
    processed: int = 0
    tenant_states: dict = field(default_factory=dict)  # tenant_id -> {processed, total, status, ...}


# ---------------------------------------------------------------------------
# 广播器
# ---------------------------------------------------------------------------

HISTORY_LIMIT = 1000


class BackfillBroadcaster:
    """单进程内 backfill 进度广播.

    - publish_* 会被 backfill_runner 调用
    - subscribe 返回 queue.Queue, SSE 端点用 get(timeout) 拉事件
    - get_snapshot 返回当前状态 (用于 status 端点)
    - 建议 148: 支持 persister, 重启可恢复
    """

    def __init__(self, persister: BackfillPersister | None = None):
        self._lock = threading.Lock()
        self._tables: dict[str, BackfillTableState] = {}
        self._subscribers: list[queue.Queue] = []
        self._history: list[BackfillEvent] = []
        self._global_status: str = "idle"  # idle / running / done / error
        self._persister = persister
        # 自动恢复
        if persister is not None:
            self._load_from_persister_internal()

    def _load_from_persister_internal(self) -> None:
        """从 persister 恢复 snapshot + history (内部)."""
        if self._persister is None:
            return
        try:
            snap = self._persister.load_snapshot()
            if snap and "tables" in snap:
                with self._lock:
                    self._global_status = snap.get("global_status", "idle")
                    for t, ts in snap["tables"].items():
                        st = BackfillTableState(
                            table=t,
                            status=ts.get("status", "idle"),
                            started_at=ts.get("started_at", 0.0),
                            finished_at=ts.get("finished_at", 0.0),
                            total=ts.get("total", 0),
                            processed=ts.get("processed", 0),
                            tenant_states=ts.get("tenants", {}),
                        )
                        self._tables[t] = st
            events = self._persister.load_events(limit=200)
            with self._lock:
                self._history = events
            logger.info(f"[broadcaster] 从 persister 恢复: {len(events)} events, {len(self._tables)} tables")
        except Exception as e:
            logger.warning(f"[broadcaster] 从 persister 恢复失败: {e}")

    # ----- 订阅 -----

    def subscribe(self, maxsize: int = 100) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=maxsize)
        with self._lock:
            self._subscribers.append(q)
        logger.info(f"[broadcaster] 新订阅, 总 {len(self._subscribers)} 个")
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)
        logger.info(f"[broadcaster] 退订, 余 {len(self._subscribers)} 个")

    def _publish_to_subscribers(self, event: BackfillEvent) -> None:
        with self._lock:
            subs = list(self._subscribers)
        for q in subs:
            # 慢消费者, 丢弃此事件, 避免阻塞发布者
            with contextlib.suppress(queue.Full):
                q.put_nowait(event)

    # ----- 发布 -----

    def publish_started(self, table: str, total: int) -> None:
        with self._lock:
            st = BackfillTableState(
                table=table,
                status="running",
                started_at=time.time(),
                total=total,
                processed=0,
            )
            self._tables[table] = st
            self._global_status = "running"
        ev = BackfillEvent(
            event_type=BackfillEventType.STARTED,
            table=table,
            total=total,
            percent=0.0,
        )
        self._record_and_publish(ev)

    def publish_tenant_progress(self, table: str, tenant_id: int, processed: int, total: int) -> None:
        elapsed = 0.0
        with self._lock:
            st = self._tables.get(table)
            if st is None:
                return
            st.processed += processed  # 累加
            st.tenant_states[tenant_id] = {
                "tenant_id": tenant_id,
                "processed": processed,
                "total": total,
                "status": "running",
            }
            elapsed = time.time() - st.started_at
        pct = (st.processed / st.total * 100) if st.total else 0
        eta = (elapsed / st.processed * (st.total - st.processed)) if st.processed else 0
        ev = BackfillEvent(
            event_type=BackfillEventType.TENANT_PROGRESS,
            table=table,
            tenant_id=tenant_id,
            processed=processed,
            total=total,
            percent=pct,
            eta_seconds=eta,
        )
        self._record_and_publish(ev)

    def publish_tenant_done(self, table: str, tenant_id: int, processed: int, duration: float) -> None:
        with self._lock:
            st = self._tables.get(table)
            if st is None:
                return
            st.tenant_states[tenant_id] = {
                "tenant_id": tenant_id,
                "processed": processed,
                "status": "done",
                "duration": duration,
            }
        ev = BackfillEvent(
            event_type=BackfillEventType.TENANT_DONE,
            table=table,
            tenant_id=tenant_id,
            processed=processed,
        )
        self._record_and_publish(ev)

    def publish_table_done(self, table: str, processed: int) -> None:
        with self._lock:
            st = self._tables.get(table)
            if st is not None:
                st.status = "done"
                st.finished_at = time.time()
        ev = BackfillEvent(
            event_type=BackfillEventType.TABLE_DONE,
            table=table,
            processed=processed,
            percent=100.0,
        )
        self._record_and_publish(ev)

    def publish_complete(self) -> None:
        with self._lock:
            self._global_status = "done"
        ev = BackfillEvent(event_type=BackfillEventType.COMPLETE, table="*")
        self._record_and_publish(ev)

    def publish_error(self, table: str, error: str) -> None:
        with self._lock:
            st = self._tables.get(table)
            if st is not None:
                st.status = "error"
            self._global_status = "error"
        ev = BackfillEvent(
            event_type=BackfillEventType.ERROR,
            table=table,
            error=error[:500],
        )
        self._record_and_publish(ev)

    def publish_heartbeat(self) -> None:
        ev = BackfillEvent(event_type=BackfillEventType.HEARTBEAT, table="*")
        self._record_and_publish(ev)

    def _record_and_publish(self, ev: BackfillEvent) -> None:
        with self._lock:
            self._history.append(ev)
            if len(self._history) > HISTORY_LIMIT:
                # 截掉最早的 10%
                cut = HISTORY_LIMIT // 10
                self._history = self._history[cut:]
        # 建议 148: 持久化
        if self._persister is not None:
            try:
                self._persister.append_event(ev)
                # 每次事件后保存 snapshot (开销小, 一致性高)
                self._persister.save_snapshot(self.get_snapshot())
            except Exception as e:
                logger.warning(f"[broadcaster] 持久化失败: {e}")
        self._publish_to_subscribers(ev)

    # ----- 查询 -----

    def get_snapshot(self) -> dict:
        with self._lock:
            tables = {}
            for t, st in self._tables.items():
                tables[t] = {
                    "status": st.status,
                    "started_at": st.started_at,
                    "finished_at": st.finished_at,
                    "total": st.total,
                    "processed": st.processed,
                    "percent": (st.processed / st.total * 100) if st.total else 0,
                    "tenants": dict(st.tenant_states),
                }
            return {
                "global_status": self._global_status,
                "tables": tables,
                "subscriber_count": len(self._subscribers),
                "history_size": len(self._history),
            }

    def get_history(self, limit: int = 50) -> list[dict]:
        with self._lock:
            return [ev.to_dict() for ev in self._history[-limit:]]

    def reset(self) -> None:
        with self._lock:
            self._tables.clear()
            self._history.clear()
            self._global_status = "idle"


# ---------------------------------------------------------------------------
# 单例
# ---------------------------------------------------------------------------

_broadcaster: BackfillBroadcaster | None = None
_broadcaster_lock = threading.Lock()


def get_broadcaster(persister: BackfillPersister | None = None) -> BackfillBroadcaster:
    """获取或创建 broadcaster 单例.

    建议 148: 首次调用时传入 persister, 重启可恢复; 之后调用忽略 persister.
    """
    global _broadcaster
    if _broadcaster is None:
        with _broadcaster_lock:
            if _broadcaster is None:
                _broadcaster = BackfillBroadcaster(persister=persister)
    return _broadcaster


def reset_broadcaster() -> None:
    """测试用."""
    global _broadcaster
    _broadcaster = None
