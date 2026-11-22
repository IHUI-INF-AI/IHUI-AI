# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-029 / AIS-030 / AIS-055 三条一组:浏览器会话上限与失败摘账、调度关停、任务表淘汰。

缺陷(现读):
  · AIS-029 `hub._sessions` 无上限/无 idle TTL;router 502 兜底只 `session.close()`,
    不摘 `_sessions/_tab_registry` → 死会话长期占 context,单用户可无限建 BrowserContext;
  · AIS-030 `self_media_scheduler.stop()` 只取消主循环,`_pending_tasks` 里的
    `_run_koubo/_run_wechat` 继续出网/写文件(关停后孤儿输出);
  · AIS-055 `BackgroundTaskManager` 的 `_tasks/_idempotency/_cancel_events/_handles`
    只增不减(注释明示"已完成记录保留"),内存随任务数线性增长。

修法:
  · AIS-029 hub 加 `_MAX_SESSIONS_PER_OWNER`(建会话前拒,幂等复用不计);
    502 兜底改走 `hub.close_session`(摘账 + 关 context);
  · AIS-030 stop() 一并 cancel `_pending_tasks` 并 gather 等收尾、清空集合;
  · AIS-055 新增 `_drop_record`/`_prune_retained`:终态记录按 TTL(1h)+ 上限(200)
    淘汰,同步摘 `_idempotency/_cancel_events/_handles`;在途记录永不淘汰,每次收尾调用。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

import app.routers.browser_hub as browser_hub_router
from app.services.background_tasks import (
    _RETAIN_TERMINAL_MAX,
    _RETAIN_TERMINAL_TTL_SEC,
    BackgroundTaskManager,
    TaskRecord,
    TaskState,
)
from app.services.browser_hub import BrowserHub, BrowserTabRegistration
from app.services.self_media_scheduler import SelfMediaScheduler

# ---------------------------------------------------------------------------
# AIS-029:单主体会话上限 + 失败路径摘账
# ---------------------------------------------------------------------------


def _hub_with_sessions(owner: str, count: int) -> BrowserHub:
    hub = BrowserHub()
    hub._started = True  # 跳过 start(),避免真起 playwright
    hub._browser = object()  # type: ignore[assignment]
    for i in range(count):
        sid = f"s-{i}"
        hub._sessions[sid] = SimpleNamespace(session_id=sid)  # type: ignore[assignment]
        hub._tab_registry[sid] = BrowserTabRegistration(
            tab_id=sid, owner_user_id=owner, chat_session_id=None, registered_at=0.0
        )
    return hub


async def test_hub_rejects_over_owner_cap() -> None:
    """达到单主体上限:直接 ValueError(且不进入 _build_session,不会先建 context)。"""
    hub = _hub_with_sessions("alice", BrowserHub._MAX_SESSIONS_PER_OWNER)

    with pytest.raises(ValueError):
        await hub.create_session(url=None, owner_user_id="alice")


async def test_hub_counts_other_owners_separately() -> None:
    """上限按属主独立计数:alice 满额不影响 bob。"""
    hub = _hub_with_sessions("alice", BrowserHub._MAX_SESSIONS_PER_OWNER)

    async def _fake_build(**kwargs: Any) -> Any:
        return SimpleNamespace(session_id=kwargs["session_id"])

    hub._build_session = _fake_build  # type: ignore[assignment]
    session = await hub.create_session(url=None, owner_user_id="bob")
    assert session is not None


async def test_router_502_closes_via_hub(monkeypatch: pytest.MonkeyPatch) -> None:
    """导航后页面被关:必须走 hub.close_session(摘账),不是裸 session.close()。"""
    calls: list[tuple[str, str | None]] = []

    class _DeadSession(SimpleNamespace):
        async def get_current_url(self) -> str:
            raise RuntimeError("TargetClosedError")

    class _Hub:
        async def create_session(self, **kwargs: Any) -> Any:
            return _DeadSession(session_id="s-1")

        async def close_session(self, session_id: str, owner_user_id: str | None = None) -> bool:
            calls.append((session_id, owner_user_id))
            return True

    monkeypatch.setattr(browser_hub_router, "hub", _Hub())
    body = browser_hub_router.CreateSessionRequest()

    with pytest.raises(Exception) as exc:
        await browser_hub_router.create_session(body, user_id="alice")

    assert getattr(exc.value, "status_code", None) == 502
    assert calls == [("s-1", "alice")]


# ---------------------------------------------------------------------------
# AIS-030:关停需取消在途任务
# ---------------------------------------------------------------------------


async def test_stop_cancels_pending_tasks() -> None:
    """stop():主循环 + 在途任务全部取消并收尾,_pending_tasks 清空。"""
    sched = SelfMediaScheduler()
    sched._task = asyncio.create_task(asyncio.sleep(3600))
    cancelled = asyncio.Event()

    async def _in_flight() -> None:
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            cancelled.set()
            raise

    pending = sched._spawn_task(_in_flight())

    await asyncio.wait_for(sched.stop(), timeout=5)

    assert pending.cancelled() is True
    assert cancelled.is_set() is True
    assert sched._pending_tasks == set()
    assert sched._task is None


# ---------------------------------------------------------------------------
# AIS-055:终态记录 TTL + 容量上限
# ---------------------------------------------------------------------------


def _terminal(task_id: str, finished_at: datetime) -> TaskRecord:
    return TaskRecord(
        task_id=task_id,
        name="n",
        user_id="alice",
        state=TaskState.SUCCEEDED,
        finished_at=finished_at,
    )


def test_prune_enforces_capacity_and_clears_side_tables() -> None:
    """终态超过上限:按 finished_at 从旧到新淘汰,四处引用同步摘除。"""
    mgr = BackgroundTaskManager()
    now = datetime.now(UTC)
    total = _RETAIN_TERMINAL_MAX + 6
    for i in range(total):
        # 全部落在 TTL 内(按秒递增),只验证容量上限分支
        rec = _terminal(f"t-{i}", now - timedelta(seconds=total - i))
        mgr._tasks[rec.task_id] = rec
        mgr._idempotency[f"k-{i}"] = rec.task_id
        mgr._cancel_events[rec.task_id] = asyncio.Event()
        mgr._handles[rec.task_id] = None  # type: ignore[assignment]

    mgr._prune_retained()

    assert len(mgr._tasks) == _RETAIN_TERMINAL_MAX
    assert "t-0" not in mgr._tasks, "最旧终态应被淘汰"
    assert f"t-{total - 1}" in mgr._tasks, "最新终态必须保留"
    assert "k-0" not in mgr._idempotency, "幂等反查表必须同步摘除"
    assert "t-0" not in mgr._cancel_events and "t-0" not in mgr._handles


def test_prune_enforces_ttl_and_keeps_inflight() -> None:
    """超 TTL 的终态被淘汰;在途(running)记录再多也不淘汰。"""
    mgr = BackgroundTaskManager()
    now = datetime.now(UTC)
    stale = _terminal("stale", now - timedelta(seconds=_RETAIN_TERMINAL_TTL_SEC + 60))
    fresh = _terminal("fresh", now)
    mgr._tasks[stale.task_id] = stale
    mgr._tasks[fresh.task_id] = fresh
    for i in range(_RETAIN_TERMINAL_MAX + 10):
        tid = f"run-{i}"
        mgr._tasks[tid] = TaskRecord(task_id=tid, name="n", user_id="alice", state=TaskState.RUNNING)

    mgr._prune_retained()

    assert "stale" not in mgr._tasks
    assert "fresh" in mgr._tasks
    assert sum(1 for r in mgr._tasks.values() if r.state == TaskState.RUNNING) == (
        _RETAIN_TERMINAL_MAX + 10
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
