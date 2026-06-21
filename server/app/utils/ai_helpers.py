"""Shared helpers for AI proxy endpoints.

Reduces boilerplate in dashscope, doubao, sora2, volcengine, tencent, suno, etc.
"""

import asyncio
import time
import uuid as _uuid
from collections.abc import Callable
from typing import Any

from loguru import logger

# ---------------------------------------------------------------------------
# Header construction
# ---------------------------------------------------------------------------


def bearer_headers(api_key: str, *, extra: dict | None = None) -> dict:
    """Build standard Bearer auth headers for AI service calls.

    Usage:
        headers = bearer_headers(settings.DASHSCOPE_API_KEY)
        headers = bearer_headers(key, extra={"X-DashScope-Async": "enable"})
    """
    h = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


# ---------------------------------------------------------------------------
# Async polling
# ---------------------------------------------------------------------------


async def poll_until(
    request_fn: Callable[[], Any],
    *,
    check_done: Callable[[dict], bool],
    check_failed: Callable[[dict], bool] | None = None,
    max_retries: int = 60,
    interval: float = 5.0,
    sleep_first: bool = True,
) -> dict:
    """Generic async poll loop.

    Args:
        request_fn: Async callable that returns JSON response dict.
        check_done: Return True when the task is complete.
        check_failed: Return True when the task has failed (optional).
        max_retries: Maximum number of poll attempts.
        interval: Seconds between polls.
        sleep_first: If True, sleep before first check (DashScope/Doubao style).
                     If False, check first then sleep (Sora2 style).

    Returns:
        The last response dict when done.

    Raises:
        TimeoutError: If max_retries exhausted without done/failed.
    """
    for i in range(max_retries):
        if sleep_first or i > 0:
            await asyncio.sleep(interval)
        try:
            data = await request_fn()
        except Exception as e:
            logger.warning(f"poll_until: request failed ({e}), retrying")
            continue
        if check_done(data):
            return data
        if check_failed and check_failed(data):
            return data
    raise TimeoutError(f"poll_until: timed out after {max_retries} retries")


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------


def gen_filename(prefix: str, ext: str) -> str:
    """Generate a unique filename with timestamp and UUID.

    Usage:
        gen_filename("volc_cv_t2i", ".jpg") -> "volc_cv_t2i_1781627402067_a1b2c3d4.jpg"
    """
    return f"{prefix}_{int(time.time() * 1000)}_{_uuid.uuid4().hex[:8]}{ext}"


# ---------------------------------------------------------------------------
# Standard AI endpoint response builders
# ---------------------------------------------------------------------------


def ai_success(
    data: Any = None,
    *,
    msg: str = "success",
    model: str = "",
    task_id: str = "",
    user_uuid: str = "",
    tokens_deducted: int = 0,
) -> dict:
    """Build a standard AI endpoint success response."""
    result = {"code": "200", "msg": msg, "data": data}
    if model:
        result["model_id"] = model
    if task_id:
        result["task_id"] = task_id
    if user_uuid:
        result["user_uuid"] = user_uuid
    if tokens_deducted:
        result["tokens_deducted"] = tokens_deducted
    return result


def ai_error(msg: str, code: str = "500", *, data: Any = None) -> dict:
    """Build a standard AI endpoint error response."""
    return {"code": code, "msg": msg, "data": data}


def ai_timeout(msg: str = "Task timed out", task_id: str = "") -> dict:
    """Build a timeout response for async AI tasks."""
    result = {"code": "408", "msg": msg, "data": None}
    if task_id:
        result["task_id"] = task_id
    return result
