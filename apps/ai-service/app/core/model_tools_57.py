# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批57:模型面新工具模块 — 对标 codex tools/handlers/ 四件+request_user_input_async。

new_context_window.rs -> new_context(spec)/new_context_window.rs(handler)
sleep.rs -> clock.sleep (namespace "clock")
current_time.rs -> clock.curr_time
send_message_to_user_async.rs / request_user_input_async.rs

本模块只含 spec/校验/纯函数与 async 睡眠原语;引擎接线(builtin 注册)由 agent_engine 完成。
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

MAX_SLEEP_DURATION_MS = 12 * 60 * 60 * 1000

NEW_CONTEXT_WINDOW_TOOL_NAME = "new_context"

NEW_CONTEXT_WINDOW_TOOL_SPEC: dict[str, Any] = {
    "type": "function",
    "name": NEW_CONTEXT_WINDOW_TOOL_NAME,
    "description": (
        "Start a new context window. Does not clear, reset, or otherwise affect "
        "environment state."
    ),
    "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
}

SLEEP_TOOL_SPEC: dict[str, Any] = {
    "type": "function",
    "name": "clock_sleep",
    "description": (
        "Pause execution for a specified duration. The sleep ends early when new "
        "input arrives for the active turn. Returns the elapsed wall-clock time."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "duration_ms": {
                "type": "number",
                "description": (
                    "How long to sleep in milliseconds. Must be between 1 and "
                    f"{MAX_SLEEP_DURATION_MS}."
                ),
            }
        },
        "required": ["duration_ms"],
        "additionalProperties": False,
    },
}

CURRENT_TIME_TOOL_SPEC: dict[str, Any] = {
    "type": "function",
    "name": "clock_curr_time",
    "description": "Return the current time in UTC.",
    "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
}

SEND_MESSAGE_TO_USER_ASYNC_TOOL_SPEC: dict[str, Any] = {
    "type": "function",
    "name": "send_message_to_user_async",
    "description": (
        "Send a concise message that needs the user's attention during ongoing "
        "work. The tool returns immediately without ending the turn or waiting for "
        "a reply; any reply arrives asynchronously as a new user message. Use this "
        "tool to report a critical blocker or a finding that may change the task's "
        "direction, or to answer a user question or status request received while "
        "work is still in progress. Use this tool when a message needs the user's "
        "immediate attention; use commentary for routine progress and intermediate "
        "context. Use clear formatting, such as bolding questions, to make requests "
        "easy to notice and answer."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "The concise question or update to send to the user.",
            }
        },
        "required": ["message"],
        "additionalProperties": False,
    },
}

REQUEST_USER_INPUT_ASYNC_TOOL_SPEC: dict[str, Any] = {
    "type": "function",
    "name": "request_user_input_async",
    "description": (
        "Ask the user one or more self-contained questions without ending the "
        "turn; the tool returns immediately and answers arrive asynchronously as "
        "new user messages."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "minItems": 1,
                "description": (
                    "One or more self-contained questions to present together, in "
                    "display order."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": (
                                "The complete question shown to the user, including "
                                "any context needed to answer it."
                            ),
                        },
                        "options": {
                            "type": "array",
                            "minItems": 1,
                            "items": {"type": "string"},
                            "description": (
                                "Suggested answers, in display order. Put the "
                                "recommended answer first; the first option is "
                                "preselected by default. The user can select one "
                                "option or enter a free-text answer. Do not include "
                                "an Other option or a free-text placeholder; the UI "
                                "provides free-text input automatically. Omit "
                                "options for a free-text-only question."
                            ),
                        },
                    },
                    "required": ["title"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["questions"],
        "additionalProperties": False,
    },
}


def build_new_context_window_result() -> dict[str, Any]:
    """工具调用时引擎设置开新窗标志;本返回形态对齐 codex signal 语义。"""
    return {"status": "context_window_requested"}


def should_skip_summarization(requested: bool) -> bool:
    """开新窗请求生效时压缩走不摘要截断分支。"""
    return requested


def validate_sleep_duration(duration_ms: float) -> str | None:
    """None=合法;否则返回 codex 同文案错误。"""
    if not isinstance(duration_ms, (int, float)) or isinstance(duration_ms, bool):
        return "duration_ms must be a number"
    if not (1 <= duration_ms <= MAX_SLEEP_DURATION_MS):
        return f"duration_ms must be between 1 and {MAX_SLEEP_DURATION_MS}"
    return None


async def run_sleep(
    duration_ms: float,
    *,
    wake_event: asyncio.Event | None = None,
) -> dict[str, Any]:
    """codex 语义:新输入提前唤醒 + 返回实际 wall-clock。

    wake_event.set() 视为新输入到达(sleep 被打断)。异常时降级为正常睡满。
    """
    err = validate_sleep_duration(duration_ms)
    if err is not None:
        return {"error": err, "slept_ms": 0, "interrupted": False}
    started = time.monotonic()
    interrupted = False
    try:
        if wake_event is not None:
            wake_task = asyncio.ensure_future(wake_event.wait())
            sleep_task = asyncio.ensure_future(asyncio.sleep(duration_ms / 1000.0))
            done, _pending = await asyncio.wait(
                {wake_task, sleep_task}, return_when=asyncio.FIRST_COMPLETED
            )
            interrupted = wake_task in done and wake_event.is_set()
            for t in (wake_task, sleep_task):
                if t not in done:
                    t.cancel()
            pending = [t for t in (wake_task, sleep_task) if not t.done()]
            if pending:
                await asyncio.wait(pending, timeout=1)
        else:
            await asyncio.sleep(duration_ms / 1000.0)
    except Exception:  # noqa: BLE001 - 引擎侧静默降级
        pass
    slept_ms = round((time.monotonic() - started) * 1000)
    return {"slept_ms": slept_ms, "interrupted": interrupted}


def build_current_time_result(
    now: datetime | None = None,
    *,
    timezone_name: str | None = None,
) -> dict[str, Any]:
    """对齐 codex CurrentTimeOutput:current_time = "YYYY-MM-DD HH:MM:SS UTC"。"""
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    utc_now = now.astimezone(timezone.utc)
    text = utc_now.strftime("%Y-%m-%d %H:%M:%S") + " UTC"
    return {"current_time": text, "timezone": timezone_name or "UTC"}


def validate_send_message(message: str) -> str | None:
    """codex:trim 后为空 -> "message must not be empty"。"""
    if not str(message).strip():
        return "message must not be empty"
    return None


def build_send_message_result() -> dict[str, Any]:
    """立即返回不打断轮次,形态逐字对齐 codex {"accepted":true}。"""
    return {"accepted": True}


def build_async_user_notification(message: str) -> dict[str, Any]:
    """host 侧投递载荷:AgentMessageItem{delivery=async, phase=final_answer}。"""
    return {
        "type": "agent_message",
        "delivery": "async",
        "phase": "final_answer",
        "content": [{"type": "input_text", "text": str(message).strip()}],
    }


def validate_async_questions(questions: list[dict[str, Any]]) -> str | None:
    """codex:questions 非空、每项 title 必填非空、options 非空数组时每项非空串。"""
    if not questions:
        return "questions must not be empty"
    seen_titles: set[str] = set()
    for q in questions:
        title = str(q.get("title", "") or "").strip()
        if not title:
            return "each question must have a non-empty title"
        if title in seen_titles:
            return "question titles must be unique"
        seen_titles.add(title)
        options = q.get("options")
        if options is not None:
            if not isinstance(options, list) or len(options) < 1:
                return "options must be a non-empty array when present"
            for opt in options:
                if not str(opt).strip():
                    return "options must not contain empty strings"
    return None


def build_async_questions_payload(questions: list[dict[str, Any]]) -> dict[str, Any]:
    """host 侧投递载荷(经 elicitation 通知通道发送)。"""
    items: list[dict[str, Any]] = []
    for q in questions:
        item: dict[str, Any] = {"title": str(q.get("title", "")).strip()}
        options = q.get("options")
        if options:
            item["options"] = [str(o) for o in options]
        items.append(item)
    return {"type": "async_user_input", "questions": items}
