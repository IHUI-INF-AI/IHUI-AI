"""Bug-93: WebSocket 房间订阅广播 (pub/sub fanout by topic).

设计:
  - topic -> set[subscriber_id]
  - subscriber_id -> set[topic]
  - publish(topic, msg) 推给所有 subscriber
  - qos 0/1: 1 持久化最近 100 条, 新订阅者拉取
  - 防止单 subscriber 过载: max_pending_per_sub 限流

使用:
    from app.utils.ws_room_broker import ws_room_broker

    ws_room_broker.subscribe("sub_1", "chat:room:42")
    ws_room_broker.publish("chat:room:42", {"text": "hi"})
"""

import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_BACKLOG = 100
DEFAULT_MAX_PENDING = 1000


@dataclass
class BacklogItem:
    topic: str
    msg: Any
    ts: float = field(default_factory=time.time)
    msg_id: str = ""


class WsRoomBroker:
    """WS 房间订阅广播器."""

    def __init__(self, backlog_size: int = DEFAULT_BACKLOG, max_pending_per_sub: int = DEFAULT_MAX_PENDING):
        self._lock = threading.RLock()
        self._backlog_size = backlog_size
        self._max_pending = max_pending_per_sub
        self._subs_by_topic: dict[str, set[str]] = defaultdict(set)
        self._topics_by_sub: dict[str, set[str]] = defaultdict(set)
        self._backlog: dict[str, deque[BacklogItem]] = defaultdict(lambda: deque(maxlen=self._backlog_size))
        # 待投递队列 (sub_id -> deque[BacklogItem])
        self._pending: dict[str, deque[BacklogItem]] = defaultdict(deque)
        self._delivered_cb: dict[str, Any] = {}  # sub_id -> callable(msg) -> bool
        self._total_publish = 0
        self._total_deliver = 0
        self._dropped_overflow = 0

    def configure(self, backlog_size: int | None = None, max_pending: int | None = None) -> None:
        with self._lock:
            if backlog_size is not None:
                self._backlog_size = int(backlog_size)
            if max_pending is not None:
                self._max_pending = int(max_pending)

    def subscribe(self, sub_id: str, topic: str) -> bool:
        """订阅 topic. 新订阅者自动拉取 qos=1 backlog."""
        with self._lock:
            if sub_id in self._topics_by_sub.get(topic, set()):
                return False
            self._subs_by_topic[topic].add(sub_id)
            self._topics_by_sub[sub_id].add(topic)
            # 投递 backlog 给新订阅者
            for item in list(self._backlog.get(topic, [])):
                self._enqueue_to_sub(sub_id, item)
            return True

    def unsubscribe(self, sub_id: str, topic: str) -> bool:
        with self._lock:
            changed = False
            if sub_id in self._subs_by_topic.get(topic, set()):
                self._subs_by_topic[topic].discard(sub_id)
                changed = True
            if topic in self._topics_by_sub.get(sub_id, set()):
                self._topics_by_sub[sub_id].discard(topic)
            return changed

    def unsubscribe_all(self, sub_id: str) -> int:
        with self._lock:
            topics = self._topics_by_sub.pop(sub_id, set())
            n = 0
            for t in topics:
                self._subs_by_topic[t].discard(sub_id)
                n += 1
            self._pending.pop(sub_id, None)
            return n

    def publish(self, topic: str, msg: Any, msg_id: str = "") -> int:
        """发布到 topic. 返回投递到的订阅者数."""
        with self._lock:
            item = BacklogItem(topic=topic, msg=msg, msg_id=msg_id)
            self._backlog[topic].append(item)
            self._total_publish += 1
            subs = list(self._subs_by_topic.get(topic, set()))
            for s in subs:
                self._enqueue_to_sub(s, item)
            return len(subs)

    def _enqueue_to_sub(self, sub_id: str, item: BacklogItem) -> None:
        pending = self._pending[sub_id]
        pending.append(item)
        # 限流
        if len(pending) > self._max_pending:
            # 丢弃最旧的
            for _ in range(len(pending) - self._max_pending):
                pending.popleft()
                self._dropped_overflow += 1

    def register_delivery_cb(self, sub_id: str, cb) -> None:
        """注册投递回调. cb(msg) -> True 表示已送达 (从 pending 移除)."""
        with self._lock:
            self._delivered_cb[sub_id] = cb

    def drain_pending(self, sub_id: str, max_items: int = 100) -> int:
        """取出订阅者待投递的消息, 调 cb 投递. 返回投递数."""
        delivered = 0
        with self._lock:
            pending = self._pending.get(sub_id)
            if not pending:
                return 0
            cb = self._delivered_cb.get(sub_id)
            for _ in range(min(max_items, len(pending))):
                item = pending.popleft()
                if cb is not None:
                    try:
                        ok = cb(item)
                        if not ok:
                            # 投递失败, 放回去
                            pending.appendleft(item)
                            break
                    except Exception as e:
                        logger.warning(f"ws_room broker cb fail sub={sub_id}: {e!r}")
                        pending.appendleft(item)
                        break
                self._total_deliver += 1
                delivered += 1
        return delivered

    def list_subscribers(self, topic: str) -> list[str]:
        with self._lock:
            return list(self._subs_by_topic.get(topic, set()))

    def list_topics(self, sub_id: str) -> list[str]:
        with self._lock:
            return list(self._topics_by_sub.get(sub_id, set()))

    def list_all_topics(self) -> list[str]:
        with self._lock:
            return list(self._subs_by_topic.keys())

    def get_backlog(self, topic: str) -> list[dict[str, Any]]:
        with self._lock:
            return [
                {"msg_id": it.msg_id, "ts": round(it.ts, 3), "msg": it.msg} for it in list(self._backlog.get(topic, []))
            ]

    def stats(self) -> dict:
        with self._lock:
            return {
                "topic_count": len(self._subs_by_topic),
                "subscriber_count": len(self._topics_by_sub),
                "total_subscriptions": sum(len(t) for t in self._subs_by_topic.values()),
                "total_publish": self._total_publish,
                "total_deliver": self._total_deliver,
                "dropped_overflow": self._dropped_overflow,
                "max_pending_per_sub": self._max_pending,
                "backlog_size": self._backlog_size,
            }


# 全局单例
ws_room_broker = WsRoomBroker()
