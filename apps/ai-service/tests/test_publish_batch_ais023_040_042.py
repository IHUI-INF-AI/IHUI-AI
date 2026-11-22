# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-023 / AIS-040 / AIS-042 三条一组:发布并发门、自助媒体定时任务管理门、运行态归属。

缺陷(现读):
  · AIS-023 `submit_task` 立即执行分支直接 spawn,**不看** task_id 去重与每用户
    `_MAX_CONCURRENT_PER_USER`(轮询分支才判) —— 双击/重放可在同秒并发多次,
    spawn 到协程起跑之间还有窗口,`_running` 去重不生效;retry 分支同样绕过;
  · AIS-040 `/api/self-media/automation/tasks/{id}/toggle|config|trigger` 无任何
    身份/角色依赖 —— 任意匿名可停用或立即触发全站定时发布,审计无操作主体;
  · AIS-042 `GET /api/publish/running` 无主体直接回全站 `_running` + 历史
    (含他人 task_id/user_id/published_url);`/publish/stats` 的 runningTasks 同样全站。

修法:
  · AIS-023 新增 `_reserve(task_id, user_id)`(去重 + 每用户上限 + 同步占位)与
    `_release_slot`,轮询/立即/重试三条 spawn 路径统一先占位,`_run_task` 起跑换真实
    句柄、finally 统一释放;落库失败回滚占位。
  · AIS-040 三个写端点加 `_require_automation_admin`(jwt_auth 单源,fail-closed),
    读端点(list/get/history)保持开放。
  · AIS-042 `list_running/list_history` 增 `owner_user_id` 过滤;`/publish/running` 强制
    JWT 并按主体过滤(管理员 role>=1 可看全站),`/publish/stats` 的 runningTasks 同步收口。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import app.routers.publish as publish_router_mod
from app.routers.publish import list_running_tasks
from app.routers.self_media import automation_toggle_task, automation_trigger_task
from app.services.publish.base_adapter import PublishContent
from app.services.publish.scheduler import (
    _MAX_CONCURRENT_PER_USER,
    PublishScheduler,
)


def _sched() -> PublishScheduler:
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    return sched


def _content() -> PublishContent:
    return PublishContent(format="md", title="测试发布")


def _capture_spawn(sched: PublishScheduler) -> list[Any]:
    """把 _spawn_task 换成捕获协程(测试里只验证门,不真跑发布)。"""
    spawned: list[Any] = []

    def _spawn(coro: Any) -> None:
        spawned.append(coro)

    sched._spawn_task = _spawn  # type: ignore[assignment]
    return spawned


def _close_all(coros: list[Any]) -> None:
    for coro in coros:
        coro.close()


def _request(user_id: str | None, role_id: int = 0) -> Request:
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})
    request.state.user_id = user_id
    request.state.role_id = role_id
    return request


# ---------------------------------------------------------------------------
# AIS-023:立即提交/重试与轮询共用同一份并发门
# ---------------------------------------------------------------------------


async def test_immediate_submit_rejects_duplicate_task_id() -> None:
    """同一 task_id 第二次提交(双击/重放):拒绝,不 spawn 第二个协程。"""
    sched = _sched()
    spawned = _capture_spawn(sched)
    try:
        first = await sched.submit_task("t-1", "alice", _content(), [])
        second = await sched.submit_task("t-1", "alice", _content(), [])

        assert first["ok"] is True
        assert second["ok"] is False and second["error"] == "task already running"
        assert len(spawned) == 1
    finally:
        _close_all(spawned)


async def test_immediate_submit_rejects_over_user_cap() -> None:
    """同一用户超过并发上限:第 N+1 条被拒,计数停在 N。"""
    sched = _sched()
    spawned = _capture_spawn(sched)
    try:
        for i in range(_MAX_CONCURRENT_PER_USER):
            assert (await sched.submit_task(f"t-{i}", "alice", _content(), []))["ok"] is True
        overflow = await sched.submit_task("t-over", "alice", _content(), [])

        assert overflow["ok"] is False and overflow["error"] == "too many running tasks"
        assert sched._user_running["alice"] == _MAX_CONCURRENT_PER_USER
        assert len(spawned) == _MAX_CONCURRENT_PER_USER
    finally:
        _close_all(spawned)


async def test_run_task_releases_reserved_slot() -> None:
    """任务跑完(成功/无目标)后:去重位、running 句柄、属主映射、计数全部释放。"""
    sched = _sched()
    assert sched._reserve("t-1", "alice") is True
    await sched._run_task("t-1", "alice", _content(), [])

    assert sched._running == {}
    assert sched._reserved == set()
    assert sched._task_users == {}
    assert sched._user_running.get("alice", 0) == 0


# ---------------------------------------------------------------------------
# AIS-042:运行态/历史按主体过滤
# ---------------------------------------------------------------------------


async def test_list_running_scoped_by_owner() -> None:
    """带主体只回自己的 task_id;系统级(不传主体)仍可看全站。"""
    sched = _sched()
    assert sched._reserve("t-alice", "alice") is True
    assert sched._reserve("t-bob", "bob") is True
    sched._running["t-alice"] = None  # 占位模拟"协程已起跑"
    sched._running["t-bob"] = None

    assert sched.list_running("alice") == ["t-alice"]
    assert set(sched.list_running()) == {"t-alice", "t-bob"}


async def test_list_history_scoped_by_owner() -> None:
    """历史条目按 user_id 过滤,不把他人发布地址回给普通用户。"""
    sched = _sched()
    sched._append_history({"task_id": "t-alice", "user_id": "alice", "ok": True})
    sched._append_history({"task_id": "t-bob", "user_id": "bob", "ok": True})

    assert [e["task_id"] for e in sched.list_history(owner_user_id="alice")] == ["t-alice"]
    assert len(sched.list_history()) == 2


async def test_running_endpoint_filters_for_normal_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """/publish/running:普通用户只看到自己;管理员看到全站。"""
    sched = _sched()
    assert sched._reserve("t-alice", "alice") is True
    assert sched._reserve("t-bob", "bob") is True
    sched._running["t-alice"] = None
    sched._running["t-bob"] = None
    sched._append_history({"task_id": "t-bob", "user_id": "bob"})
    monkeypatch.setattr(publish_router_mod, "publish_scheduler", sched)

    normal = await list_running_tasks(_request("alice", role_id=0))
    admin = await list_running_tasks(_request("alice", role_id=1))

    assert normal["data"]["running"] == ["t-alice"]
    assert normal["data"]["history"] == []
    assert set(admin["data"]["running"]) == {"t-alice", "t-bob"}
    assert len(admin["data"]["history"]) == 1


async def test_running_endpoint_unknown_user_sees_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """无身份(开发回落匿名):只能看到匿名名下的任务,绝不回全站运行态。"""
    sched = _sched()
    assert sched._reserve("t-alice", "alice") is True
    sched._running["t-alice"] = None
    monkeypatch.setattr(publish_router_mod, "publish_scheduler", sched)

    resp = await list_running_tasks(_request(None))
    assert resp["data"]["running"] == []


# ---------------------------------------------------------------------------
# AIS-040:自助媒体定时任务的写端点仅管理员
# ---------------------------------------------------------------------------


async def test_self_media_automation_write_endpoints_require_admin() -> None:
    """role=0:toggle/trigger 直接 403(且不触碰调度器);role>=1 才进入业务分支。"""
    with pytest.raises(HTTPException) as toggle_exc:
        await automation_toggle_task("daily-hot", _request("alice", role_id=0), enabled=False)
    assert toggle_exc.value.status_code == 403

    with pytest.raises(HTTPException) as trigger_exc:
        await automation_trigger_task("daily-hot", _request("alice", role_id=0))
    assert trigger_exc.value.status_code == 403

    # 管理员通过门后,不存在的任务由业务层回 404(证明没被 403 提前拦掉)
    with pytest.raises(HTTPException) as admin_exc:
        await automation_toggle_task("no-such-task", _request("admin", role_id=1), enabled=True)
    assert admin_exc.value.status_code == 404
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
