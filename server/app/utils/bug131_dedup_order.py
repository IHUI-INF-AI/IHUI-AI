"""Bug-131: 并发抢单幂等 (重复下单防护).
设计:
  - 订单防重令牌 (order_token): 客户端 + 业务参数派生的 SHA256
  - 服务端短 TTL 缓存占位
  - 占位 (pending) -> 确认 (confirmed) -> 释放 (release) 三态
  - 并发同 token 请求: 仅 1 个胜出, 其余返回冲突
  - 用户级节流: N 秒内最多 M 单
"""

import hashlib
import json
import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class OrderState(StrEnum):
    PENDING = "pending"  # 已占位
    CONFIRMED = "confirmed"  # 已确认
    RELEASED = "released"  # 已释放
    EXPIRED = "expired"  # 已过期


@dataclass
class OrderSlot:
    token: str
    user_id: str
    biz_type: str
    biz_id: str
    state: OrderState = OrderState.PENDING
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    result: Any = None
    error: str | None = None


def derive_order_token(user_id: str, biz_type: str, biz_id: str, payload: Any = None, salt: str = "") -> str:
    """派发订单防重令牌."""
    if isinstance(payload, str):
        canonical = payload
    else:
        canonical = json.dumps(payload or {}, sort_keys=True, ensure_ascii=False, default=str)
    raw = f"{user_id}|{biz_type}|{biz_id}|{canonical}|{salt}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


@dataclass
class DedupConfig:
    default_ttl: float = 30.0
    max_per_user_window: float = 60.0
    max_per_user_count: int = 10
    auto_expire: bool = True


class ConcurrentOrderDeduper:
    """并发抢单幂等器."""

    def __init__(self, config: DedupConfig | None = None) -> None:
        self.config = config or DedupConfig()
        self._slots: dict[str, OrderSlot] = {}
        self._user_history: dict[str, list[float]] = {}
        self._lock = threading.RLock()
        self._stats = {
            "acquired": 0,
            "conflicts": 0,
            "confirmed": 0,
            "released": 0,
            "expired": 0,
            "rate_limited": 0,
        }

    def _now(self) -> float:
        return time.time()

    def _purge_expired(self) -> None:
        if not self.config.auto_expire:
            return
        with self._lock:
            now = self._now()
            expired = [k for k, s in self._slots.items() if s.expires_at > 0 and now > s.expires_at]
            for k in expired:
                slot = self._slots.pop(k, None)
                if slot is not None:
                    slot.state = OrderState.EXPIRED
                    self._stats["expired"] += 1

    def _user_rate_limit_ok(self, user_id: str) -> bool:
        now = self._now()
        with self._lock:
            arr = self._user_history.setdefault(user_id, [])
            while arr and now - arr[0] > self.config.max_per_user_window:
                arr.pop(0)
            if len(arr) >= self.config.max_per_user_count:
                self._stats["rate_limited"] += 1
                return False
            arr.append(now)
            return True

    def try_acquire(
        self,
        user_id: str,
        biz_type: str,
        biz_id: str,
        payload: Any = None,
        salt: str = "",
        ttl: float | None = None,
    ) -> tuple[OrderSlot, bool]:
        """尝试获取占位, 返回 (slot, acquired).
        acquired=True 表示成功占位, False 表示已被他人占位."""
        self._purge_expired()
        if not self._user_rate_limit_ok(user_id):
            fake = OrderSlot(
                token="",
                user_id=user_id,
                biz_type=biz_type,
                biz_id=biz_id,
                state=OrderState.EXPIRED,
                expires_at=0.0,
                error="rate_limited",
            )
            return fake, False
        token = derive_order_token(user_id, biz_type, biz_id, payload, salt)
        with self._lock:
            existing = self._slots.get(token)
            if (
                existing is not None
                and existing.state in (OrderState.PENDING, OrderState.CONFIRMED)
                and not (existing.expires_at > 0 and self._now() > existing.expires_at)
            ):
                self._stats["conflicts"] += 1
                return existing, False
            slot = OrderSlot(
                token=token,
                user_id=user_id,
                biz_type=biz_type,
                biz_id=biz_id,
                state=OrderState.PENDING,
                expires_at=self._now() + (ttl or self.config.default_ttl),
            )
            self._slots[token] = slot
            self._stats["acquired"] += 1
            return slot, True

    def confirm(self, token: str, result: Any = None) -> bool:
        with self._lock:
            slot = self._slots.get(token)
            if slot is None or slot.state != OrderState.PENDING:
                return False
            slot.state = OrderState.CONFIRMED
            slot.result = result
            self._stats["confirmed"] += 1
            return True

    def release(self, token: str, reason: str = "") -> bool:
        with self._lock:
            slot = self._slots.get(token)
            if slot is None or slot.state not in (OrderState.PENDING, OrderState.CONFIRMED):
                return False
            slot.state = OrderState.RELEASED
            slot.error = reason
            self._stats["released"] += 1
            return True

    def get(self, token: str) -> OrderSlot | None:
        with self._lock:
            return self._slots.get(token)

    def list_by_user(self, user_id: str) -> list[OrderSlot]:
        with self._lock:
            return [s for s in self._slots.values() if s.user_id == user_id]

    def force_expire(self, token: str) -> bool:
        with self._lock:
            slot = self._slots.pop(token, None)
            if slot is None:
                return False
            slot.state = OrderState.EXPIRED
            return True

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {**self._stats, "active_slots": len(self._slots)}
