# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

"""plan_updated 事件 payload 协议升级测试(2026-09-19 立)。

对应 packages/types/src/ai.ts 的 PlanUpdateEvent 扩展:plan[] 每步新增
id / toolCallIds / startedAt / endedAt / error 可选字段,PlanStepStatus
扩展为五态(pending / in_progress / completed / skipped / failed)。

验证 _format_plan_updated_event 的输出契约:
- 每步携带 id:toolCallId 优先(strip,与 tool-call-start 事件一致),缺失回退 step-{i}
- toolCallIds 数组正确(仅当 toolCallId 存在时携带)
- result 存在且 isError → status=failed + error=true
- 正常 result → completed;result 为 None → in_progress
- startedAt / endedAt ISO 8601 时间戳原样透传(仅当记录中存在)
- 空历史返回空串(调用点可无条件 yield,不清空前端 planSteps)
"""

from __future__ import annotations

import json
from typing import Any

from app.routers.llm import _format_plan_updated_event

_FRAME_PREFIX = "event: plan_updated\ndata: "


def _plan_of(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """构造 plan_updated SSE 帧并解析出 plan 数组(顺带校验帧格式与顶层字段)。"""
    frame = _format_plan_updated_event(history, explanation="测试快照", message_id="msg-1")
    assert frame.startswith(_FRAME_PREFIX)
    assert frame.endswith("\n\n")
    payload = json.loads(frame[len(_FRAME_PREFIX):-2])
    assert payload["type"] == "plan_updated"
    assert payload["explanation"] == "测试快照"
    assert payload["messageId"] == "msg-1"
    return payload["plan"]


class TestPlanStepId:
    """步骤唯一 ID:toolCallId 优先,缺失回退 step-{i}。"""

    def test_id_prefers_stripped_tool_call_id(self):
        """记录携带 toolCallId → id 取 strip 后的值(与 tool-call-start 事件一致)。"""
        plan = _plan_of([{
            "toolCallId": "call-001\n",
            "toolName": "run_command",
            "args": {"command": "echo hi"},
            "result": {"ok": True},
            "isError": False,
            "durationMs": 12,
        }])
        assert plan[0]["id"] == "call-001"

    def test_id_falls_back_to_step_index(self):
        """记录缺失 toolCallId → id 回退 step-{i}(i 为序号)。"""
        plan = _plan_of([
            {"toolName": "run_command", "args": {"command": "ls"}, "result": None},
            {
                "toolName": "search_codebase",
                "args": {"query": "config"},
                "result": {"ok": True},
                "isError": False,
            },
        ])
        assert plan[0]["id"] == "step-0"
        assert plan[1]["id"] == "step-1"


class TestPlanStepToolCallIds:
    """关联工具调用 ID 数组。"""

    def test_tool_call_ids_array_when_id_exists(self):
        """toolCallId 存在 → toolCallIds 为单元素数组(strip 后的值)。"""
        plan = _plan_of([
            {"toolCallId": "call-a", "toolName": "t", "args": {}, "result": None},
            {
                "toolCallId": "call-b ",
                "toolName": "t",
                "args": {},
                "result": {"ok": True},
                "isError": False,
            },
        ])
        assert plan[0]["toolCallIds"] == ["call-a"]
        assert plan[1]["toolCallIds"] == ["call-b"]

    def test_tool_call_ids_omitted_when_missing(self):
        """toolCallId 缺失 → 不携带 toolCallIds 键。"""
        plan = _plan_of([
            {"toolName": "t", "args": {}, "result": {"ok": True}, "isError": False}
        ])
        assert "toolCallIds" not in plan[0]


class TestPlanStepStatus:
    """status 五态判定(本函数产出 in_progress / completed / failed 三态)。"""

    def test_error_result_marks_failed(self):
        """result 存在且 isError → status=failed 且 error=true。"""
        plan = _plan_of([{
            "toolCallId": "call-err",
            "toolName": "run_command",
            "args": {"command": "boom"},
            "result": {"ok": False, "error": "命令执行失败"},
            "isError": True,
            "durationMs": 5,
        }])
        assert plan[0]["status"] == "failed"
        assert plan[0]["error"] is True

    def test_ok_result_completed_and_none_in_progress(self):
        """正常 result → completed;result 为 None → in_progress(均不带 error 键)。"""
        plan = _plan_of([
            {"toolCallId": "call-a", "toolName": "t", "args": {}, "result": None},
            {
                "toolCallId": "call-b",
                "toolName": "t",
                "args": {},
                "result": {"ok": True},
                "isError": False,
                "durationMs": 33,
            },
        ])
        assert plan[0]["status"] == "in_progress"
        assert "error" not in plan[0]
        assert plan[1]["status"] == "completed"
        assert "error" not in plan[1]

    def test_result_without_is_error_field_defaults_completed(self):
        """旧格式记录缺 isError 字段 → result 存在默认 completed(不误判 failed)。"""
        plan = _plan_of([
            {"toolCallId": "call-c", "toolName": "t", "args": {}, "result": {"ok": True}}
        ])
        assert plan[0]["status"] == "completed"
        assert "error" not in plan[0]


class TestPlanStepTimestamps:
    """startedAt / endedAt ISO 8601 时间戳透传。"""

    def test_started_and_ended_at_passthrough(self):
        """记录携带起止时间戳 → 原样透传。"""
        plan = _plan_of([{
            "toolCallId": "call-ts",
            "toolName": "t",
            "args": {},
            "startedAt": "2026-09-19T10:00:00+00:00",
            "endedAt": "2026-09-19T10:00:05+00:00",
            "result": {"ok": True},
            "isError": False,
        }])
        assert plan[0]["startedAt"] == "2026-09-19T10:00:00+00:00"
        assert plan[0]["endedAt"] == "2026-09-19T10:00:05+00:00"

    def test_timestamps_omitted_when_missing(self):
        """执行中步骤只有 startedAt → endedAt 键不携带;均缺失则两键都不携带。"""
        plan = _plan_of([
            {
                "toolCallId": "call-ts2",
                "toolName": "t",
                "args": {},
                "startedAt": "2026-09-19T10:00:00+00:00",
                "result": None,
            },
            {"toolCallId": "call-ts3", "toolName": "t", "args": {}, "result": None},
        ])
        assert plan[0]["startedAt"] == "2026-09-19T10:00:00+00:00"
        assert "endedAt" not in plan[0]
        assert "startedAt" not in plan[1]
        assert "endedAt" not in plan[1]


class TestEmptyHistoryGuard:
    """空历史守卫。"""

    def test_empty_history_returns_empty_string(self):
        """空历史返回空串(不产出 SSE 帧,避免清空前端 message.planSteps)。"""
        assert _format_plan_updated_event([], explanation="空", message_id=None) == ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
