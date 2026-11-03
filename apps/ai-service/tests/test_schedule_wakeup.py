# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""schedule_wakeup 延迟唤醒工具测试(2026-10-31 立)。

背景:定时工具面此前只有建(schedule_task)/查(list)/撤(cancel)三动词,模型没有
"过 N 秒再跑一次"的最小表达(对照程序有 ScheduleWakeup)。本文件钉住四件事:
1. 注册面:_TOOLS 有声明 ∧ _TOOL_HANDLERS 有同名键 ∧ 在 _ADMIN_ONLY_TOOLS(缺一即"声明了没接线");
2. 委托面:scheduler 收到的 trigger 是 date + now+delay,回调走 schedule_task 的派发形态,
   conversation_id 取承载层注入的 __session_id;
3. 参数校验:缺 prompt / delay_seconds 非正整数 ⇒ 结构化错误,且一次 add_task 都不发;
4. 权限:role 0 在 handler 之前被拒(零副作用)。

monkeypatch 路径与服务层测试同款:替换 `scheduler_service.task_scheduler` 模块属性 ——
handler 内部延迟 import,故即时生效。
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import mcp_server, scheduler_service
from app.services.mcp_server import (
    _ADMIN_ONLY_TOOLS,
    _TOOL_HANDLERS,
    _TOOLS,
    _tool_schedule_wakeup,
)

_TOOL_NAME = "schedule_wakeup"


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def fake_scheduler(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """替换 scheduler_service.task_scheduler(handler 内延迟 import ⇒ 即时生效)。

    默认返回值刻意不含 next_run_at,让每个用例自己声明场景。
    """
    fake = MagicMock()
    fake.add_task = AsyncMock(return_value={"ok": True, "task_id": "t-1", "next_run_at": ""})
    monkeypatch.setattr(scheduler_service, "task_scheduler", fake)
    return fake


def _seconds_between(iso: str, base: datetime) -> float:
    return (datetime.fromisoformat(iso) - base).total_seconds()


# =============================================================================
# 1. 注册面(声明 ∧ 接线 ∧ admin 同档)
# =============================================================================


def test_declared_in_tools_with_schema() -> None:
    """_TOOLS 有声明,必填项恰为 delay_seconds + prompt,name 可选。"""
    by_name = {t.name: t for t in _TOOLS}
    assert _TOOL_NAME in by_name, f"{_TOOL_NAME} 未声明进 _TOOLS"
    schema = by_name[_TOOL_NAME].input_schema
    assert schema["required"] == ["delay_seconds", "prompt"]
    assert set(schema["properties"]) == {"delay_seconds", "prompt", "name"}
    assert schema["properties"]["delay_seconds"]["type"] == "integer"


def test_declared_once_each() -> None:
    """同一工具名只声明一次(重复声明会让 list_tools 出现两条同名项)。"""
    assert [t.name for t in _TOOLS].count(_TOOL_NAME) == 1


def test_handler_wired() -> None:
    """_TOOL_HANDLERS 有同名键且指向本 handler(防"声明了没接线")。"""
    assert _TOOL_HANDLERS[_TOOL_NAME] is _tool_schedule_wakeup


def test_admin_only_same_tier_as_create() -> None:
    """与 schedule_task 同档:底层 add_task 无归属校验,role 0 可用即漏洞。"""
    assert _TOOL_NAME in _ADMIN_ONLY_TOOLS
    assert "schedule_task" in _ADMIN_ONLY_TOOLS


# =============================================================================
# 2. 委托面:date 触发 + now+delay + 复用派发形态 + 真会话 id
# =============================================================================


async def test_delegates_date_trigger_at_now_plus_delay(fake_scheduler: MagicMock) -> None:
    before = datetime.now(UTC)
    out = await _tool_schedule_wakeup(
        {"delay_seconds": 90, "prompt": "看看构建结果", "__session_id": "sess-1"}
    )
    fake_scheduler.add_task.assert_awaited_once()
    args, kwargs = fake_scheduler.add_task.await_args

    assert out["tool"] == _TOOL_NAME
    assert out["ok"] is True
    assert args[0] == out["task_id"]
    assert len(out["task_id"]) == 32  # uuid4().hex,与 _tool_schedule_task 同命名法

    # 触发面:date + run_date,且落在 now+delay 附近
    assert args[1] == "date"
    run_date = args[2]["run_date"]
    assert run_date == out["wake_at"]
    assert 90 <= _seconds_between(run_date, before) <= 95

    # 回调面:与 schedule_task 的 mcp_tool 派发同形(prompt 原样进 task)
    callback = args[3]
    assert callback["type"] == "mcp_tool"
    assert callback["tool_name"] == "dispatch_subagent"
    assert callback["args"]["task"] == "看看构建结果"


async def test_conversation_id_is_session_id(fake_scheduler: MagicMock) -> None:
    """conversation_id 必须是承载层注入的 __session_id(不是任务名,与 schedule_task 同口径)。"""
    await _tool_schedule_wakeup(
        {"delay_seconds": 5, "prompt": "p", "name": "自定义名", "__session_id": "sess-9"}
    )
    assert fake_scheduler.add_task.await_args.kwargs["conversation_id"] == "sess-9"


async def test_conversation_id_falls_back_to_name(fake_scheduler: MagicMock) -> None:
    """无会话上下文(内部直调)退回任务名;name 缺省时是 wakeup-<task_id>。"""
    out = await _tool_schedule_wakeup({"delay_seconds": 5, "prompt": "p"})
    assert fake_scheduler.add_task.await_args.kwargs["conversation_id"] == f"wakeup-{out['task_id']}"
    assert out["name"] == f"wakeup-{out['task_id']}"


async def test_explicit_name_kept(fake_scheduler: MagicMock) -> None:
    out = await _tool_schedule_wakeup(
        {"delay_seconds": 5, "prompt": "p", "name": "十分钟后回看"}
    )
    assert out["name"] == "十分钟后回看"
    assert fake_scheduler.add_task.await_args.kwargs["conversation_id"] == "十分钟后回看"


async def test_next_run_at_from_scheduler_wins(fake_scheduler: MagicMock) -> None:
    """调度器回填的真实执行时刻优先;stub 标记如实透出,不把"没存储"读成"会执行"。"""
    fake_scheduler.add_task.return_value = {
        "ok": True, "task_id": "t-1", "next_run_at": "2030-01-01T00:00:00+00:00",
    }
    out = await _tool_schedule_wakeup({"delay_seconds": 5, "prompt": "p"})
    assert out["next_run_at"] == "2030-01-01T00:00:00+00:00"
    assert "stub" not in out

    fake_scheduler.add_task.return_value = {"ok": True, "task_id": "t-1", "stub": True}
    out = await _tool_schedule_wakeup({"delay_seconds": 5, "prompt": "p"})
    assert out["stub"] is True
    assert "next_run_at" not in out


async def test_scheduler_exception_is_structured(fake_scheduler: MagicMock) -> None:
    fake_scheduler.add_task.side_effect = RuntimeError("scheduler down")
    out = await _tool_schedule_wakeup({"delay_seconds": 5, "prompt": "p"})
    assert out["ok"] is False
    assert out["errorCode"] == "SCHEDULER_ERROR"
    assert "scheduler down" in out["message"]


async def test_scheduler_rejection_is_structured(fake_scheduler: MagicMock) -> None:
    fake_scheduler.add_task.return_value = {
        "ok": False, "errorCode": "INVALID_TRIGGER", "message": "bad",
    }
    out = await _tool_schedule_wakeup({"delay_seconds": 5, "prompt": "p"})
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_TRIGGER"


# =============================================================================
# 3. 参数校验:结构化错误 ∧ 零副作用
# =============================================================================


async def test_missing_prompt(fake_scheduler: MagicMock) -> None:
    for args in ({"delay_seconds": 10}, {"delay_seconds": 10, "prompt": "   "}):
        out = await _tool_schedule_wakeup(args)
        assert out["ok"] is False
        assert out["errorCode"] == "MISSING_PARAMS"
    fake_scheduler.add_task.assert_not_awaited()


async def test_invalid_delay_seconds(fake_scheduler: MagicMock) -> None:
    """缺参 / 0 / 负数 / 非数字 / 小数 / 布尔 一律 INVALID_PARAMS(不静默改成 1 秒)。"""
    for bad in (None, 0, -5, "abc", 1.5, "1.5", True, False, "", []):
        args: dict[str, Any] = {"prompt": "p"}
        if bad is not None:
            args["delay_seconds"] = bad
        out = await _tool_schedule_wakeup(args)
        assert out["ok"] is False, f"delay_seconds={bad!r} 被误接受"
        assert out["errorCode"] == "INVALID_PARAMS", f"delay_seconds={bad!r}"
    fake_scheduler.add_task.assert_not_awaited()


async def test_numeric_string_delay_accepted(fake_scheduler: MagicMock) -> None:
    """模型常把整数写成字符串:可无损转成正整数的仍接受。"""
    out = await _tool_schedule_wakeup({"delay_seconds": "30", "prompt": "p"})
    assert out["ok"] is True
    assert out["delay_seconds"] == 30


# =============================================================================
# 4. 经 call_tool 走一遍:权限矩阵拦在 handler 之前
# =============================================================================


async def test_role_zero_denied_with_zero_side_effects(fake_scheduler: MagicMock) -> None:
    fake_scheduler.add_task.reset_mock()
    out = await mcp_server.mcp_server.call_tool(
        _TOOL_NAME, {"delay_seconds": 10, "prompt": "p"}, user_role=0, session_id="sess-1"
    )
    assert out["ok"] is False
    assert out["errorCode"] == "PERMISSION_DENIED"
    fake_scheduler.add_task.assert_not_awaited()


async def test_role_one_through_call_tool(fake_scheduler: MagicMock) -> None:
    out = await mcp_server.mcp_server.call_tool(
        _TOOL_NAME, {"delay_seconds": 10, "prompt": "p"}, user_role=1, session_id="sess-7"
    )
    assert out["ok"] is True
    assert out["tool"] == _TOOL_NAME
    assert fake_scheduler.add_task.await_args.kwargs["conversation_id"] == "sess-7"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
