# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""list_scheduled_tasks / cancel_scheduled_task 工具面投影测试(2026-10-30 立)。

背景:scheduler_service 早有 list_tasks / remove_task,但工具面只有 schedule_task
一个"创建"动词 ⇒ 模型自己建的任务既看不见也撤不掉。本文件钉住两件事:
1. 注册面:_TOOLS 有声明 ∧ _TOOL_HANDLERS 有同名键(防"声明了没接线");
2. 委托面:handler 只是把参数原样交给 scheduler_service 的单例方法,
   判据(Redis 扫描 / 内存降级 / stub 三态 / 删除语义)一律不住本层。

monkeypatch 路径与服务层测试(test_scheduler_service)同款:替换
`scheduler_service.task_scheduler` 模块属性 —— handler 内部延迟 import,故即时生效。
"""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import mcp_server, scheduler_service
from app.services.mcp_server import (
    _ADMIN_ONLY_TOOLS,
    _TOOL_HANDLERS,
    _TOOLS,
    _tool_cancel_scheduled_task,
    _tool_list_scheduled_tasks,
)

_TOOL_NAMES = ("list_scheduled_tasks", "cancel_scheduled_task")


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def fake_scheduler(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """替换 scheduler_service.task_scheduler:三个方法各一枚 AsyncMock。

    默认返回值刻意取"找不到任何任务",让每个用例自己声明场景。
    """
    fake = MagicMock()
    fake.list_tasks = AsyncMock(return_value={"ok": True, "tasks": [], "count": 0})
    fake.get_task = AsyncMock(
        return_value={"ok": False, "errorCode": "NOT_FOUND", "message": "任务不存在: x"}
    )
    fake.remove_task = AsyncMock(return_value={"ok": True, "task_id": "t-1"})
    monkeypatch.setattr(scheduler_service, "task_scheduler", fake)
    return fake


def _task(**overrides: Any) -> dict[str, Any]:
    task: dict[str, Any] = {
        "task_id": "t-1",
        "name": "每日报告",
        "trigger_type": "cron",
        "next_run_at": "2026-12-31T09:00:00+00:00",
        "conversation_id": "conv-1",
    }
    task.update(overrides)
    return task


# =============================================================================
# 1. 注册面(声明 ∧ 接线)
# =============================================================================


def test_tools_declared_with_schemas() -> None:
    """两枚工具都在 _TOOLS;cancel 的 task_id 必填,list 的 conversation_id 可选。"""
    by_name = {t.name: t for t in _TOOLS}
    for name in _TOOL_NAMES:
        assert name in by_name, f"{name} 未声明进 _TOOLS"
    cancel_schema = by_name["cancel_scheduled_task"].input_schema
    assert cancel_schema["required"] == ["task_id"]
    assert "task_id" in cancel_schema["properties"]
    list_schema = by_name["list_scheduled_tasks"].input_schema
    assert "conversation_id" in list_schema["properties"]
    assert "required" not in list_schema


def test_handlers_wired() -> None:
    """_TOOL_HANDLERS 有同名键且指向本文件的这两个 handler(防声明了没接线)。"""
    assert _TOOL_HANDLERS["list_scheduled_tasks"] is _tool_list_scheduled_tasks
    assert _TOOL_HANDLERS["cancel_scheduled_task"] is _tool_cancel_scheduled_task


def test_declared_once_each() -> None:
    """同一工具名只声明一次(重复声明会让 list_tools 出现两条同名项)。"""
    names = [t.name for t in _TOOLS]
    for name in _TOOL_NAMES:
        assert names.count(name) == 1


def test_admin_only_same_tier_as_create() -> None:
    """查询/撤销必须与创建同档(admin 专属)。

    主席 2026-10-31 判定:底层 `scheduler_service.list_tasks(None)` 不带归属过滤、
    `remove_task` 无归属校验 ⇒ 放给 role 0 等于跨用户枚举 + 任意撤销;而创建动词
    `schedule_task` 本就在 `_ADMIN_ONLY_TOOLS` 里,三者不同档即漏洞。
    """
    assert set(_TOOL_NAMES) <= _ADMIN_ONLY_TOOLS


# =============================================================================
# 2. list_scheduled_tasks:委托 + 参数原样透传
# =============================================================================


async def test_list_delegates_with_conversation_id(fake_scheduler: MagicMock) -> None:
    fake_scheduler.list_tasks.return_value = {
        "ok": True, "tasks": [_task()], "count": 1,
    }
    out = await _tool_list_scheduled_tasks({"conversation_id": "conv-1"})
    fake_scheduler.list_tasks.assert_awaited_once_with("conv-1")
    assert out["ok"] is True
    assert out["conversation_id"] == "conv-1"
    assert out["count"] == 1
    assert out["tasks"][0]["task_id"] == "t-1"


async def test_list_without_conversation_id_passes_none(fake_scheduler: MagicMock) -> None:
    out = await _tool_list_scheduled_tasks({})
    fake_scheduler.list_tasks.assert_awaited_once_with(None)
    assert out["conversation_id"] is None
    assert out["count"] == 0


async def test_list_blank_conversation_id_not_guessed(fake_scheduler: MagicMock) -> None:
    """空串/纯空白不当成某个会话去过滤(猜错 = 静默返回空列表)。"""
    await _tool_list_scheduled_tasks({"conversation_id": "   "})
    fake_scheduler.list_tasks.assert_awaited_once_with(None)


async def test_list_stub_flag_passthrough(fake_scheduler: MagicMock) -> None:
    """stub 模式(未配置 redis_url)如实透出 stub,不把"没存储"读成"没有任务"。"""
    fake_scheduler.list_tasks.return_value = {"ok": True, "tasks": [], "stub": True}
    out = await _tool_list_scheduled_tasks({})
    assert out["stub"] is True


async def test_list_scheduler_exception_is_structured(fake_scheduler: MagicMock) -> None:
    fake_scheduler.list_tasks.side_effect = RuntimeError("redis down")
    out = await _tool_list_scheduled_tasks({})
    assert out["ok"] is False
    assert out["errorCode"] == "SCHEDULER_ERROR"
    assert "redis down" in out["message"]


# =============================================================================
# 3. cancel_scheduled_task:委托 + 回执 + 不静默成功
# =============================================================================


async def test_cancel_delegates_and_returns_summary(fake_scheduler: MagicMock) -> None:
    fake_scheduler.get_task.return_value = {"ok": True, "task": _task()}
    out = await _tool_cancel_scheduled_task({"task_id": "t-1"})
    fake_scheduler.get_task.assert_awaited_once_with("t-1")
    fake_scheduler.remove_task.assert_awaited_once_with("t-1")
    assert out["ok"] is True
    assert out["task_id"] == "t-1"
    assert out["cancelled"]["name"] == "每日报告"
    assert out["cancelled"]["schedule"] == "cron"
    assert out["cancelled"]["next_run_at"] == "2026-12-31T09:00:00+00:00"


async def test_cancel_missing_task_id(fake_scheduler: MagicMock) -> None:
    out = await _tool_cancel_scheduled_task({})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"
    fake_scheduler.get_task.assert_not_awaited()
    fake_scheduler.remove_task.assert_not_awaited()


async def test_cancel_unknown_task_not_silently_ok(fake_scheduler: MagicMock) -> None:
    """服务层 remove_task 对不存在的 task_id 幂等返回 ok(见 test_scheduler_service),
    所以工具层先问 get_task —— 否则"已取消"是个谎。"""
    out = await _tool_cancel_scheduled_task({"task_id": "ghost"})
    assert out["ok"] is False
    assert out["errorCode"] == "NOT_FOUND"
    fake_scheduler.remove_task.assert_not_awaited()


async def test_cancel_stub_task_none_is_not_found(fake_scheduler: MagicMock) -> None:
    """stub 模式 get_task 返回 ok=True + task=None:取不到任务就等于取消不了。"""
    fake_scheduler.get_task.return_value = {"ok": True, "task": None, "stub": True}
    out = await _tool_cancel_scheduled_task({"task_id": "t-1"})
    assert out["ok"] is False
    assert out["errorCode"] == "NOT_FOUND"
    fake_scheduler.remove_task.assert_not_awaited()


async def test_cancel_remove_exception_is_structured(fake_scheduler: MagicMock) -> None:
    fake_scheduler.get_task.return_value = {"ok": True, "task": _task()}
    fake_scheduler.remove_task.side_effect = RuntimeError("scheduler down")
    out = await _tool_cancel_scheduled_task({"task_id": "t-1"})
    assert out["ok"] is False
    assert out["errorCode"] == "SCHEDULER_ERROR"
    assert out["task_id"] == "t-1"


# =============================================================================
# 4. 经 call_tool 走一遍:注册面 + 权限矩阵 + handler 都通
# =============================================================================


async def test_cancel_through_call_tool(fake_scheduler: MagicMock) -> None:
    fake_scheduler.get_task.return_value = {"ok": True, "task": _task(task_id="t-9")}
    fake_scheduler.remove_task.return_value = {"ok": True, "task_id": "t-9"}
    out = await mcp_server.mcp_server.call_tool(
        "cancel_scheduled_task", {"task_id": "t-9"}, user_role=1
    )
    assert out["ok"] is True
    assert out["task_id"] == "t-9"


async def test_admin_only_denies_plain_user(fake_scheduler: MagicMock) -> None:
    """role 0 必须被权限矩阵拦下(list 与 cancel 都是 admin 专属,与 schedule_task 同档)。

    底层 list_tasks(None) 无归属过滤、remove_task 无归属校验,放给普通用户就是
    跨用户枚举 + 任意撤销;此处锁住"拒绝发生在 handler 之前"(不产生任何副作用)。
    """
    fake_scheduler.list_tasks.reset_mock()
    listed = await mcp_server.mcp_server.call_tool(
        "list_scheduled_tasks", {"conversation_id": "conv-1"}, user_role=0
    )
    assert listed["errorCode"] == "PERMISSION_DENIED"
    cancelled = await mcp_server.mcp_server.call_tool(
        "cancel_scheduled_task", {"task_id": "t-9"}, user_role=0
    )
    assert cancelled["errorCode"] == "PERMISSION_DENIED"
    fake_scheduler.list_tasks.assert_not_called()
    fake_scheduler.remove_task.assert_not_called()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
