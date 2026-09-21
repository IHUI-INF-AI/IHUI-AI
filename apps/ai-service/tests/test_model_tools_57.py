# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠"""批57:模型面新工具测试 — new_context/clock.sleep/clock.curr_time/send_message_to_user_async/request_user_input_async。"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

import pytest

from app.core.model_tools_57 import (
    CURRENT_TIME_TOOL_SPEC,
    MAX_SLEEP_DURATION_MS,
    NEW_CONTEXT_WINDOW_TOOL_NAME,
    NEW_CONTEXT_WINDOW_TOOL_SPEC,
    REQUEST_USER_INPUT_ASYNC_TOOL_SPEC,
    SLEEP_TOOL_SPEC,
    SEND_MESSAGE_TO_USER_ASYNC_TOOL_SPEC,
    build_async_questions_payload,
    build_async_user_notification,
    build_current_time_result,
    build_new_context_window_result,
    build_send_message_result,
    run_sleep,
    should_skip_summarization,
    validate_async_questions,
    validate_send_message,
    validate_sleep_duration,
)


# ---------- spec 结构 ----------
def test_new_context_spec_shape() -> None:
    assert NEW_CONTEXT_WINDOW_TOOL_SPEC["name"] == NEW_CONTEXT_WINDOW_TOOL_NAME == "new_context"
    assert "new context window" in NEW_CONTEXT_WINDOW_TOOL_SPEC["description"].lower()
    assert NEW_CONTEXT_WINDOW_TOOL_SPEC["parameters"]["type"] == "object"


@pytest.mark.parametrize(
    "spec",
    [SLEEP_TOOL_SPEC, CURRENT_TIME_TOOL_SPEC, SEND_MESSAGE_TO_USER_ASYNC_TOOL_SPEC, REQUEST_USER_INPUT_ASYNC_TOOL_SPEC],
)
def test_spec_required_keys(spec: dict) -> None:
    assert spec["type"] == "function"
    assert spec["name"]
    assert spec["description"]
    assert spec["parameters"]["type"] == "object"
    # codex 侧 curr_time/new_context 无必填参数(required=None),其余必填
    no_required = {NEW_CONTEXT_WINDOW_TOOL_NAME, CURRENT_TIME_TOOL_SPEC["name"]}
    if spec["name"] not in no_required:
        assert "required" in spec["parameters"]


def test_sleep_spec_bounds_mentioned() -> None:
    assert str(MAX_SLEEP_DURATION_MS) in SLEEP_TOOL_SPEC["parameters"]["properties"]["duration_ms"]["description"]


def test_send_message_spec_message_required() -> None:
    assert SEND_MESSAGE_TO_USER_ASYNC_TOOL_SPEC["parameters"]["required"] == ["message"]


def test_request_input_spec_questions_required() -> None:
    assert REQUEST_USER_INPUT_ASYNC_TOOL_SPEC["parameters"]["required"] == ["questions"]


# ---------- new_context_window ----------
def test_new_context_result() -> None:
    assert build_new_context_window_result() == {"status": "context_window_requested"}
    assert should_skip_summarization(True) is True
    assert should_skip_summarization(False) is False


# ---------- sleep ----------
def test_sleep_validate_bounds() -> None:
    assert validate_sleep_duration(1) is None
    assert validate_sleep_duration(5000) is None
    assert validate_sleep_duration(MAX_SLEEP_DURATION_MS) is None
    assert validate_sleep_duration(0) is not None
    assert validate_sleep_duration(-100) is not None
    assert validate_sleep_duration(MAX_SLEEP_DURATION_MS + 1) is not None
    assert "duration_ms must be between 1 and" in str(validate_sleep_duration(0))


def test_sleep_validate_non_number() -> None:
    assert validate_sleep_duration("abc") is not None  # type: ignore[arg-type]
    assert validate_sleep_duration(None) is not None  # type: ignore[arg-type]


async def test_run_sleep_completes() -> None:
    started = time.monotonic()
    result = await run_sleep(50)
    assert result["error"] is None if "error" in result else True
    assert result["interrupted"] is False
    assert result["slept_ms"] >= 40
    assert time.monotonic() - started < 2


async def test_run_sleep_wake_early() -> None:
    wake = asyncio.Event()
    result: dict = {}

    async def _waker() -> None:
        await asyncio.sleep(0.05)
        wake.set()

    asyncio.ensure_future(_waker())
    result = await run_sleep(10_000, wake_event=wake)
    assert result["interrupted"] is True
    assert result["slept_ms"] < 5_000


async def test_run_sleep_invalid_duration() -> None:
    result = await run_sleep(0)
    assert "error" in result
    assert result["slept_ms"] == 0


# ---------- current_time ----------
def test_current_time_default_utc() -> None:
    out = build_current_time_result()
    assert out["current_time"].endswith(" UTC")
    assert out["timezone"] == "UTC"
    # YYYY-MM-DD HH:MM:SS 格式
    text = out["current_time"][: -len(" UTC")]
    datetime.strptime(text, "%Y-%m-%d %H:%M:%S")


def test_current_time_custom_input() -> None:
    now = datetime(2026, 9, 20, 12, 34, 56, tzinfo=timezone.utc)
    out = build_current_time_result(now)
    assert out["current_time"] == "2026-09-20 12:34:56 UTC"
    out2 = build_current_time_result(now, timezone_name="Asia/Shanghai")
    assert out2["timezone"] == "Asia/Shanghai"


def test_current_time_naive_assumed_utc() -> None:
    naive = datetime(2026, 1, 1, 0, 0, 0)
    out = build_current_time_result(naive)
    assert out["current_time"].startswith("2026-01-01 00:00:00")


# ---------- send_message_to_user_async ----------
def test_send_message_validate() -> None:
    assert validate_send_message("hello") is None
    assert validate_send_message("   ") == "message must not be empty"
    assert validate_send_message("") == "message must not be empty"


def test_send_message_result_accepted() -> None:
    assert build_send_message_result() == {"accepted": True}


def test_async_user_notification_shape() -> None:
    out = build_async_user_notification("  blocker found  ")
    assert out["type"] == "agent_message"
    assert out["delivery"] == "async"
    assert out["phase"] == "final_answer"
    assert out["content"][0]["text"] == "blocker found"


# ---------- request_user_input_async ----------
def test_async_questions_validate_ok() -> None:
    qs = [{"title": "Deploy now?", "options": ["yes", "no"]}]
    assert validate_async_questions(qs) is None


def test_async_questions_validate_empty() -> None:
    assert validate_async_questions([]) == "questions must not be empty"


def test_async_questions_validate_missing_title() -> None:
    assert validate_async_questions([{"options": ["a"]}]) is not None
    assert validate_async_questions([{"title": "  "}]) is not None


def test_async_questions_validate_dup_titles() -> None:
    assert validate_async_questions([{"title": "q"}, {"title": "q"}]) is not None


def test_async_questions_validate_options() -> None:
    assert validate_async_questions([{"title": "q", "options": []}]) is not None
    assert validate_async_questions([{"title": "q", "options": ["ok"]}]) is None
    assert validate_async_questions([{"title": "q", "options": ["", "x"]}]) is not None


def test_async_questions_payload() -> None:
    out = build_async_questions_payload([{"title": " Continue? ", "options": ["yes", 2]}])
    assert out["type"] == "async_user_input"
    assert out["questions"] == [{"title": "Continue?", "options": ["yes", "2"]}]
