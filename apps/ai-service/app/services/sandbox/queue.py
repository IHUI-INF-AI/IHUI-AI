# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""任务队列:并发容量上限 + 按项目轮转的公平性 + 超时僵尸态回收。"""
from __future__ import annotations

import time
from collections import OrderedDict, deque
from typing import Callable

from app.services.sandbox.models import (
    IllegalTransitionError,
    SandboxSession,
    SandboxStatus,
)

__all__ = ["Clock", "DuplicateSessionError", "SandboxQueue", "SessionNotTrackedError"]

Clock = Callable[[], float]


def _system_clock() -> float:
    return time.monotonic()


class DuplicateSessionError(ValueError):
    pass


class SessionNotTrackedError(ValueError):
    pass


class SandboxQueue:
    """容量 = 同时**起跑**的会话数;排不下的留在 pending,绝不丢弃。"""

    def __init__(
        self,
        *,
        max_parallel: int = 2,
        clock: Clock | None = None,
        max_attempts: int = 1,
        auto_retry_on_reap: bool = False,
    ) -> None:
        if max_parallel < 1:
            raise ValueError("max_parallel 必须 >= 1")
        if max_attempts < 1:
            raise ValueError("max_attempts 必须 >= 1")
        self._max_parallel = max_parallel
        self._max_attempts = max_attempts
        self._auto_retry = auto_retry_on_reap
        self._clock: Clock = clock or _system_clock
        self._pending: OrderedDict[str, deque[SandboxSession]] = OrderedDict()
        self._active: dict[str, SandboxSession] = {}
        self._settled: list[SandboxSession] = []
        self._cursor = 0

    @property
    def capacity(self) -> int:
        return self._max_parallel

    def submit(self, session: SandboxSession) -> None:
        if session.status is not SandboxStatus.QUEUED:
            raise IllegalTransitionError(session.status, SandboxStatus.QUEUED)
        if session.session_id in self._active or self._is_pending(session.session_id):
            raise DuplicateSessionError(session.session_id)
        self._pending.setdefault(session.project_id, deque()).append(session)

    def pending_count(self) -> int:
        return sum(len(items) for items in self._pending.values())

    def active_sessions(self) -> list[SandboxSession]:
        return list(self._active.values())

    def tracked_sessions(self) -> list[SandboxSession]:
        pending = [s for items in self._pending.values() for s in items]
        return pending + self.active_sessions() + list(self._settled)

    def schedule(self, *, now: float | None = None) -> list[SandboxSession]:
        moment = self._clock() if now is None else now
        admitted: list[SandboxSession] = []
        while len(self._active) < self._max_parallel:
            session = self._pick_round_robin()
            if session is None:
                break
            session.transition(SandboxStatus.STARTING, now=moment)
            self._active[session.session_id] = session
            admitted.append(session)
        return admitted

    def mark_running(self, session: SandboxSession, *, now: float | None = None) -> None:
        self._require_active(session)
        session.transition(SandboxStatus.RUNNING, now=self._moment(now))

    def complete(
        self,
        session: SandboxSession,
        *,
        status: SandboxStatus,
        exit_code: int | None = None,
        error: str | None = None,
        now: float | None = None,
    ) -> None:
        if status not in {
            SandboxStatus.FINISHED,
            SandboxStatus.FAILED,
            SandboxStatus.TIMEOUT,
        }:
            raise ValueError(f"complete 只接受 finished/failed/timeout,得到 {status.value}")
        self._require_active(session)
        moment = self._moment(now)
        session.transition(status, now=moment, exit_code=exit_code, error=error)
        if status is not SandboxStatus.TIMEOUT:
            self._retire(session, moment=moment, keep_status=True)

    def reap(self, *, now: float | None = None, grace: float = 0.0) -> list[SandboxSession]:
        """回收僵尸:已过截止的活跃会话走 TIMEOUT→REAPED,已标 TIMEOUT 的收口。

        槽位在回收前**不释放** —— 否则容器还在跑就放进下一个,并发上限形同虚设。
        """
        moment = self._moment(now)
        reaped: list[SandboxSession] = []
        for session in list(self._active.values()):
            if session.status is SandboxStatus.TIMEOUT:
                self._retire(session, moment=moment, target=SandboxStatus.REAPED)
                reaped.append(session)
                continue
            deadline = session.deadline_at
            if session.is_active and deadline is not None and moment >= deadline + grace:
                session.transition(SandboxStatus.TIMEOUT, now=moment, error="僵尸态:超时无心跳")
                self._retire(session, moment=moment, target=SandboxStatus.REAPED)
                reaped.append(session)
        return reaped

    def _retire(
        self,
        session: SandboxSession,
        *,
        moment: float,
        target: SandboxStatus | None = None,
        keep_status: bool = False,
    ) -> None:
        if target is not None:
            session.transition(target, now=moment)
        self._active.pop(session.session_id, None)
        self._settled.append(session)
        if not keep_status and self._auto_retry and session.attempt < self._max_attempts:
            self.submit(
                session.retry(
                    session_id=f"{session.session_id}:a{session.attempt + 1}",
                    now=moment,
                )
            )

    def _pick_round_robin(self) -> SandboxSession | None:
        projects = [pid for pid, items in self._pending.items() if items]
        if not projects:
            return None
        index = self._cursor % len(projects)
        project_id = projects[index]
        self._cursor = index + 1
        items = self._pending[project_id]
        session = items.popleft()
        if not items:
            del self._pending[project_id]
        return session

    def _is_pending(self, session_id: str) -> bool:
        return any(s.session_id == session_id for items in self._pending.values() for s in items)

    def _require_active(self, session: SandboxSession) -> None:
        if self._active.get(session.session_id) is not session:
            raise SessionNotTrackedError(session.session_id)

    def _moment(self, now: float | None) -> float:
        return self._clock() if now is None else now
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
