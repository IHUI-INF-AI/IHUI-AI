"""Bug-144: 流式响应中断恢复.
设计:
  - 流式 LLM 响应分块缓冲
  - 心跳保活 (idle_timeout 内必须收到 chunk)
  - 中断时保存 stream_id + last_chunk_index
  - 客户端可凭 resume_token 续传
  - 超时熔断 / 错误注入感知
"""

from __future__ import annotations

import contextlib
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class StreamState(StrEnum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


@dataclass
class StreamChunk:
    index: int
    content: str
    ts: float = field(default_factory=time.time)
    finish_reason: str | None = None
    token_count: int = 0


@dataclass
class StreamSession:
    stream_id: str
    user_id: str
    model: str
    state: StreamState = StreamState.ACTIVE
    chunks: list[StreamChunk] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    last_chunk_at: float = 0.0
    expires_at: float = 0.0
    total_tokens: int = 0
    resume_token: str = ""
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class StreamConfig:
    idle_timeout: float = 30.0
    total_timeout: float = 600.0
    resumable_window: float = 600.0
    max_chunks: int = 10000


class StreamResilience:
    """流式响应中断恢复管理器."""

    def __init__(self, config: StreamConfig | None = None) -> None:
        self.config = config or StreamConfig()
        self._lock = threading.RLock()
        self._sessions: dict[str, StreamSession] = {}
        self._by_user: dict[str, list[str]] = {}
        self._stats = {"started": 0, "chunks": 0, "resumed": 0, "cancelled": 0, "failed": 0, "expired": 0}

    def _now(self) -> float:
        return time.time()

    def start(self, user_id: str, model: str, metadata: dict[str, Any] | None = None) -> StreamSession:
        with self._lock:
            sid = uuid.uuid4().hex
            sess = StreamSession(
                stream_id=sid,
                user_id=user_id,
                model=model,
                last_chunk_at=self._now(),
                expires_at=self._now() + self.config.resumable_window,
                resume_token=uuid.uuid4().hex,
                metadata=metadata or {},
            )
            self._sessions[sid] = sess
            self._by_user.setdefault(user_id, []).append(sid)
            self._stats["started"] += 1
            return sess

    def append(
        self, stream_id: str, content: str, token_count: int = 0, finish_reason: str | None = None
    ) -> tuple[bool, str]:
        with self._lock:
            sess = self._sessions.get(stream_id)
            if sess is None or sess.state not in (StreamState.ACTIVE, StreamState.PAUSED):
                return False, "session_unavailable"
            now = self._now()
            if now - sess.started_at > self.config.total_timeout:
                sess.state = StreamState.EXPIRED
                self._stats["expired"] += 1
                return False, "total_timeout"
            idx = len(sess.chunks)
            chunk = StreamChunk(index=idx, content=content, finish_reason=finish_reason, token_count=token_count)
            sess.chunks.append(chunk)
            sess.last_chunk_at = now
            sess.total_tokens += token_count
            if len(sess.chunks) > self.config.max_chunks:
                sess.state = StreamState.FAILED
                sess.error = "too_many_chunks"
                self._stats["failed"] += 1
                return False, "too_many_chunks"
            if finish_reason in ("stop", "length", "content_filter"):
                sess.state = StreamState.COMPLETED
            self._stats["chunks"] += 1
            return True, "ok"

    def idle_check(self, stream_id: str) -> bool:
        """检查是否闲置超时, 若是则置 PAUSED, 不直接失败."""
        with self._lock:
            sess = self._sessions.get(stream_id)
            if sess is None or sess.state != StreamState.ACTIVE:
                return False
            if self._now() - sess.last_chunk_at > self.config.idle_timeout:
                sess.state = StreamState.PAUSED
                return True
            return False

    def fail(self, stream_id: str, error: str) -> bool:
        with self._lock:
            sess = self._sessions.get(stream_id)
            if sess is None or sess.state in (StreamState.COMPLETED, StreamState.CANCELLED, StreamState.FAILED):
                return False
            sess.state = StreamState.FAILED
            sess.error = error
            self._stats["failed"] += 1
            return True

    def cancel(self, stream_id: str) -> bool:
        with self._lock:
            sess = self._sessions.get(stream_id)
            if sess is None or sess.state not in (StreamState.ACTIVE, StreamState.PAUSED):
                return False
            sess.state = StreamState.CANCELLED
            self._stats["cancelled"] += 1
            return True

    def resume(self, resume_token: str) -> StreamSession | None:
        with self._lock:
            for sess in self._sessions.values():
                if sess.resume_token == resume_token:
                    if sess.state == StreamState.PAUSED:
                        sess.state = StreamState.ACTIVE
                        sess.last_chunk_at = self._now()
                        self._stats["resumed"] += 1
                        return sess
                    if sess.state in (StreamState.ACTIVE, StreamState.PAUSED):
                        return sess
                    return None
            return None

    def get_text(self, stream_id: str, from_index: int = 0) -> str:
        with self._lock:
            sess = self._sessions.get(stream_id)
            if sess is None:
                return ""
            return "".join(c.content for c in sess.chunks if c.index >= from_index)

    def get_chunks(self, stream_id: str, from_index: int = 0) -> list[StreamChunk]:
        with self._lock:
            sess = self._sessions.get(stream_id)
            if sess is None:
                return []
            return [c for c in sess.chunks if c.index >= from_index]

    def get(self, stream_id: str) -> StreamSession | None:
        with self._lock:
            return self._sessions.get(stream_id)

    def purge_expired(self) -> int:
        with self._lock:
            now = self._now()
            dead = [
                sid
                for sid, s in self._sessions.items()
                if s.state in (StreamState.COMPLETED, StreamState.CANCELLED, StreamState.FAILED)
                and s.expires_at > 0
                and now > s.expires_at
            ]
            for sid in dead:
                s = self._sessions.pop(sid, None)
                if s is not None:
                    s.state = StreamState.EXPIRED
                    arr = self._by_user.get(s.user_id)
                    if arr is not None:
                        with contextlib.suppress(ValueError):
                            arr.remove(sid)  # intentionally ignored
            return len(dead)

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                **self._stats,
                "active": sum(1 for s in self._sessions.values() if s.state == StreamState.ACTIVE),
                "paused": sum(1 for s in self._sessions.values() if s.state == StreamState.PAUSED),
                "completed": sum(1 for s in self._sessions.values() if s.state == StreamState.COMPLETED),
            }
