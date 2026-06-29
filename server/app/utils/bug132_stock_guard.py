"""Bug-132: 库存超卖防护.
设计:
  - 基于内存的原子 CAS 模拟 (生产应使用 Redis Lua 或数据库乐观锁)
  - 预扣 -> 确认/回滚 二阶段
  - 不足时直接拒绝, 不允许负库存
  - 预留队列 + 过期自动回滚
"""

import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ReserveState(StrEnum):
    RESERVED = "reserved"
    COMMITTED = "committed"
    RELEASED = "released"
    EXPIRED = "expired"


@dataclass
class StockItem:
    sku: str
    total: int
    available: int
    reserved: int = 0
    sold: int = 0


@dataclass
class ReserveTicket:
    ticket_id: str
    sku: str
    qty: int
    state: ReserveState = ReserveState.RESERVED
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    owner: str = ""


@dataclass
class StockConfig:
    reservation_ttl: float = 60.0
    enable_auto_expire: bool = True


class StockGuard:
    """库存超卖防护器."""

    def __init__(self, config: StockConfig | None = None) -> None:
        self.config = config or StockConfig()
        self._lock = threading.RLock()
        self._items: dict[str, StockItem] = {}
        self._tickets: dict[str, ReserveTicket] = {}
        self._stats = {
            "reserved_ok": 0,
            "reserved_fail": 0,
            "committed": 0,
            "released": 0,
            "expired": 0,
        }

    def _now(self) -> float:
        return time.time()

    def _next_ticket_id(self) -> str:
        return f"t-{int(time.time() * 1000)}-{len(self._tickets)}"

    def _purge_expired(self) -> None:
        if not self.config.enable_auto_expire:
            return
        with self._lock:
            now = self._now()
            expired = [
                tid
                for tid, t in self._tickets.items()
                if t.state == ReserveState.RESERVED and t.expires_at > 0 and now > t.expires_at
            ]
            for tid in expired:
                t = self._tickets.pop(tid, None)
                if t is None:
                    continue
                t.state = ReserveState.EXPIRED
                item = self._items.get(t.sku)
                if item is not None:
                    item.reserved = max(0, item.reserved - t.qty)
                    item.available = min(item.total, item.available + t.qty)
                self._stats["expired"] += 1

    def init_stock(self, sku: str, total: int) -> StockItem:
        with self._lock:
            if total < 0:
                raise ValueError("total 不能为负")
            item = self._items.get(sku)
            if item is None:
                item = StockItem(sku=sku, total=total, available=total)
                self._items[sku] = item
            else:
                delta = total - item.total
                item.total = total
                item.available = max(0, item.available + delta)
            return item

    def adjust_total(self, sku: str, new_total: int) -> bool:
        if new_total < 0:
            return False
        with self._lock:
            item = self._items.get(sku)
            if item is None:
                return False
            sold_committed = item.sold
            if new_total < sold_committed:
                return False
            item.total = new_total
            item.available = max(0, new_total - sold_committed - item.reserved)
            return True

    def get_stock(self, sku: str) -> StockItem | None:
        with self._lock:
            return self._items.get(sku)

    def try_reserve(self, sku: str, qty: int, owner: str = "", ttl: float | None = None) -> ReserveTicket | None:
        """原子预留, 库存不足返回 None."""
        if qty <= 0:
            raise ValueError("qty 必须 > 0")
        self._purge_expired()
        with self._lock:
            item = self._items.get(sku)
            if item is None or item.available < qty:
                self._stats["reserved_fail"] += 1
                return None
            item.available -= qty
            item.reserved += qty
            tid = self._next_ticket_id()
            ticket = ReserveTicket(
                ticket_id=tid,
                sku=sku,
                qty=qty,
                owner=owner,
                expires_at=self._now() + (ttl or self.config.reservation_ttl),
            )
            self._tickets[tid] = ticket
            self._stats["reserved_ok"] += 1
            return ticket

    def commit(self, ticket_id: str) -> bool:
        with self._lock:
            t = self._tickets.get(ticket_id)
            if t is None or t.state != ReserveState.RESERVED:
                return False
            t.state = ReserveState.COMMITTED
            item = self._items.get(t.sku)
            if item is not None:
                item.reserved = max(0, item.reserved - t.qty)
                item.sold += t.qty
            self._stats["committed"] += 1
            return True

    def release(self, ticket_id: str) -> bool:
        with self._lock:
            t = self._tickets.pop(ticket_id, None)
            if t is None or t.state != ReserveState.RESERVED:
                return False
            t.state = ReserveState.RELEASED
            item = self._items.get(t.sku)
            if item is not None:
                item.reserved = max(0, item.reserved - t.qty)
                item.available = min(item.total, item.available + t.qty)
            self._stats["released"] += 1
            return True

    def get_ticket(self, ticket_id: str) -> ReserveTicket | None:
        with self._lock:
            return self._tickets.get(ticket_id)

    def force_release_expired(self) -> int:
        with self._lock:
            self._purge_expired()
            return self._stats["expired"]

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                **self._stats,
                "skus": len(self._items),
                "active_tickets": sum(1 for t in self._tickets.values() if t.state == ReserveState.RESERVED),
            }
