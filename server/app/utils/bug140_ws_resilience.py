"""Bug-140: WebSocket 断线重连幂等.
设计:
  - 会话状态: connect / disconnect / reconnect
  - session_id + 客户端 last_event_id 续传
  - 心跳: server_ping / client_pong
  - 断线自动重连, 服务端去重幂等
  - 离线消息队列
  - 退避策略: 1s -> 2s -> 4s -> 8s (max 30s)
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class WsState(StrEnum):
    DISCONNECTED = "DISCONNECTED"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    RECONNECTING = "RECONNECTING"
    CLOSED = "CLOSED"


@dataclass
class WsSession:
    session_id: str
    user_id: str
    state: WsState = WsState.CONNECTING
    connected_at: float = 0.0
    last_ping: float = 0.0
    last_pong: float = 0.0
    last_event_id: int = 0
    reconnect_count: int = 0
    offline_queue: list[tuple[int, Any]] = field(default_factory=list)


@dataclass
class WsConfig:
    heartbeat_sec: float = 30.0
    heartbeat_timeout: float = 60.0
    max_reconnect: int = 10
    max_offline_queue: int = 100
    base_backoff: float = 1.0
    max_backoff: float = 30.0


class WSResilience:
    """WebSocket 断线重连幂等管理."""

    def __init__(self, config: WsConfig | None = None) -> None:
        self.config = config or WsConfig()
        self._lock = threading.RLock()
        self._sessions: dict[str, WsSession] = {}
        self._user_sessions: dict[str, str] = {}  # user_id -> session_id
        self._stats = {
            "connect": 0,
            "reconnect": 0,
            "disconnect": 0,
            "closed": 0,
            "dropped": 0,
            "events": 0,
            "duplicates": 0,
        }

    def _now(self) -> float:
        return time.time()

    def connect(self, user_id: str, session_id: str | None = None) -> WsSession:
        with self._lock:
            if user_id in self._user_sessions:
                old_id = self._user_sessions[user_id]
                old = self._sessions.get(old_id)
                if old is not None and old.state in (WsState.CONNECTED, WsState.RECONNECTING):
                    # 已有活跃会话, 复用为重连
                    old.state = WsState.RECONNECTING
                    old.reconnect_count += 1
                    old.last_pong = self._now()
                    self._stats["reconnect"] += 1
                    return old
            sid = session_id or uuid.uuid4().hex
            sess = WsSession(
                session_id=sid,
                user_id=user_id,
                state=WsState.CONNECTED,
                connected_at=self._now(),
                last_ping=self._now(),
                last_pong=self._now(),
            )
            self._sessions[sid] = sess
            self._user_sessions[user_id] = sid
            self._stats["connect"] += 1
            return sess

    def disconnect(self, session_id: str, reason: str = "client_close") -> bool:
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None:
                return False
            sess.state = WsState.DISCONNECTED
            self._user_sessions.pop(sess.user_id, None)
            self._stats["disconnect"] += 1
            return True

    def close(self, session_id: str) -> bool:
        with self._lock:
            sess = self._sessions.pop(session_id, None)
            if sess is None:
                return False
            sess.state = WsState.CLOSED
            self._user_sessions.pop(sess.user_id, None)
            self._stats["closed"] += 1
            return True

    def heartbeat_ping(self, session_id: str) -> bool:
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None or sess.state not in (WsState.CONNECTED, WsState.RECONNECTING):
                return False
            sess.last_ping = self._now()
            if sess.last_pong > 0 and (sess.last_ping - sess.last_pong) > self.config.heartbeat_timeout:
                sess.state = WsState.DISCONNECTED
                self._stats["dropped"] += 1
                return False
            return True

    def heartbeat_pong(self, session_id: str) -> bool:
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None:
                return False
            sess.last_pong = self._now()
            sess.state = WsState.CONNECTED
            return True

    def backoff(self, session_id: str) -> float:
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None:
                return 0.0
            b = self.config.base_backoff * (2 ** min(sess.reconnect_count, 10))
            return min(b, self.config.max_backoff)

    def send_event(self, session_id: str, event: Any, event_id: int | None = None) -> tuple[bool, bool]:
        """发送事件, 返回 (成功, 是否去重). 离线事件入队."""
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None:
                return False, False
            eid = event_id if event_id is not None else (sess.last_event_id + 1)
            if eid <= sess.last_event_id:
                self._stats["duplicates"] += 1
                return False, True
            if sess.state in (WsState.CONNECTED, WsState.RECONNECTING):
                sess.last_event_id = eid
                self._stats["events"] += 1
                return True, False
            # 离线
            if len(sess.offline_queue) >= self.config.max_offline_queue:
                sess.offline_queue.pop(0)
            sess.offline_queue.append((eid, event))
            return True, False

    def resume_from(self, session_id: str, last_event_id: int) -> list[tuple[int, Any]]:
        """客户端重连后拉取离线消息, 从 last_event_id+1 开始."""
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None:
                return []
            sess.state = WsState.CONNECTED
            items = [(eid, ev) for eid, ev in sess.offline_queue if eid > last_event_id]
            sess.offline_queue.clear()
            return items

    def get(self, session_id: str) -> WsSession | None:
        with self._lock:
            return self._sessions.get(session_id)

    def by_user(self, user_id: str) -> WsSession | None:
        with self._lock:
            sid = self._user_sessions.get(user_id)
            if sid is None:
                return None
            return self._sessions.get(sid)

    def sweep(self) -> int:
        with self._lock:
            now = self._now()
            dead = [
                sid
                for sid, s in self._sessions.items()
                if s.state == WsState.DISCONNECTED and (now - s.last_ping) > self.config.heartbeat_timeout * 2
            ]
            for sid in dead:
                s = self._sessions.pop(sid, None)
                if s is not None:
                    self._user_sessions.pop(s.user_id, None)
                    s.state = WsState.CLOSED
            return len(dead)

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                **self._stats,
                "active_sessions": len(self._sessions),
                "offline_messages": sum(len(s.offline_queue) for s in self._sessions.values()),
            }
