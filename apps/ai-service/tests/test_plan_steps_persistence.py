# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""planSteps 持久化与回放(2026-09-21 立,零 schema 迁移)—— ai-service 侧单测。

覆盖:
- _build_plan_snapshot 是 SSE plan_updated 与落库 planSteps 的单一真相源
  (同输入 → 逐字段等价快照)
- _fire_callback 非空快照时写 body.planSteps;空历史 / 无历史不写字段
- 与 toolCalls 共存:两者同时携带,互不覆盖
- 快照字段契约与 packages/types/src/ai.ts 的 PlanStep 对齐

测试隔离(AGENTS.md §5):全程 monkeypatch httpx.AsyncClient + settings
ai_callback_secret,不触网、不连任何 PostgreSQL/Redis。
"""

from __future__ import annotations

import json

import pytest

from app.routers.llm import _build_plan_snapshot, _fire_callback, _format_plan_updated_event

_FRAME_PREFIX = "event: plan_updated\ndata: "

_HISTORY: list[dict[str, object]] = [
    {
        "toolCallId": "tc-1",
        "toolName": "run_command",
        "args": {"command": "ls -la"},
        "result": "a.txt",
        "startedAt": "2026-09-21T10:00:00+00:00",
        "endedAt": "2026-09-21T10:00:01+00:00",
        "durationMs": 1000,
    },
    {"toolCallId": "tc-2", "toolName": "read_file", "args": {"path": "a.txt"}},
    {"toolCallId": "tc-3", "toolName": "run_command", "result": "boom", "isError": True},
]


def _sse_plan(message_id: str | None = "msg-1") -> list[dict[str, object]]:
    frame = _format_plan_updated_event(_HISTORY, explanation="快照", message_id=message_id)  # type: ignore[arg-type]
    assert frame.startswith(_FRAME_PREFIX)
    payload = json.loads(frame[len(_FRAME_PREFIX) :])
    assert payload["type"] == "plan_updated"
    plan: list[dict[str, object]] = payload["plan"]
    return plan


class _FakeResp:
    status_code = 200
    text = ""


class _FakeClient:
    captured: list[dict] = []  # type: ignore[type-arg]

    def __init__(self, *args: object, **kwargs: object) -> None:
        pass

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def post(
        self, url: str, json: dict | None = None, headers: dict | None = None  # type: ignore[type-arg]
    ) -> _FakeResp:
        _FakeClient.captured.append(json or {})
        return _FakeResp()


@pytest.fixture(autouse=True)
def _cb_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_callback_secret", "test-secret")
    monkeypatch.setattr("app.routers.llm.httpx.AsyncClient", _FakeClient)
    _FakeClient.captured = []


class TestPlanSnapshotSingleSource:
    def test_snapshot_equals_sse_plan(self) -> None:
        """落库快照与 SSE plan 数组逐字段等价(同一构造函数的两条出口)。"""
        assert _build_plan_snapshot(_HISTORY) == _sse_plan()  # type: ignore[arg-type]

    def test_status_three_states(self) -> None:
        steps = _build_plan_snapshot(_HISTORY)  # type: ignore[arg-type]
        assert [s["status"] for s in steps] == ["completed", "in_progress", "failed"]
        assert steps[0]["durationMs"] == 1000
        assert steps[0]["toolCallIds"] == ["tc-1"]
        assert steps[2]["error"] is True

    def test_empty_history_returns_empty_list(self) -> None:
        assert _build_plan_snapshot([]) == []


class TestFireCallbackPlanSteps:
    async def test_writes_plan_steps_alongside_tool_calls(self) -> None:
        await _fire_callback(
            "http://cb",
            {"content": "hi", "model": "m1", "usage": {"total_tokens": 5}, "stub": False},
            {"conversationId": "c1", "userId": "u1", "messageId": "msg-1"},
            tool_calls_history=_HISTORY,  # type: ignore[arg-type]
        )
        body = _FakeClient.captured[0]
        # 端到端锚点①:回调 body 的 planSteps 与 SSE 快照等价(API 侧原样并入 metadata)
        assert body["planSteps"] == _sse_plan()
        # 不整体覆盖:toolCalls 通道仍在
        assert [c["id"] for c in body["toolCalls"]] == ["tc-1", "tc-2", "tc-3"]
        assert body["metadata"]["conversationId"] == "c1"

    async def test_no_history_omits_plan_steps(self) -> None:
        await _fire_callback("http://cb", {"content": "hi"}, {"conversationId": "c1"})
        body = _FakeClient.captured[0]
        assert "planSteps" not in body
        assert "toolCalls" not in body

    async def test_plan_steps_is_json_serializable(self) -> None:
        """metadata 是 jsonb 列,快照必须可 JSON 序列化(不得带 datetime 等原生对象)。"""
        await _fire_callback(
            "http://cb",
            {"content": "hi"},
            None,
            tool_calls_history=_HISTORY,  # type: ignore[arg-type]
        )
        body = _FakeClient.captured[0]
        restored = json.loads(json.dumps(body, ensure_ascii=False))
        assert restored["planSteps"] == body["planSteps"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
