# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 状态归一（P4-03 / 01 §7.5）。

唯一被允许的优先级：
    agent_runs（权威） > subagent_dispatch（队列/DAG） > subagent_jobs（后台任务） > session

实现成纯函数，不查库、不查 Redis：调用方把四个来源的原始状态喂进来，输出统一的
`display_status + source`。这样测试可以钉死每条规则，也能让 API/Web/CLI 复用同一口径。
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

STALE_AFTER_SECONDS = 5 * 60
TIMEOUT_AFTER_SECONDS = 30 * 60

TERMINAL = frozenset({"succeeded", "failed", "canceled", "timeout"})
ACTIVE = frozenset({"queued", "running", "paused", "blocked"})

_DISPATCH_MAP = {
    "queued": "queued",
    "pending": "queued",
    "running": "running",
    "in_progress": "running",
    "paused": "paused",
    "succeeded": "succeeded",
    "completed": "succeeded",
    "failed": "failed",
    "canceled": "canceled",
    "cancelled": "canceled",
    "timeout": "timeout",
    "blocked": "blocked",
}


def normalize_run_status(
    *,
    ledger: Mapping[str, Any] | None,
    dispatch_status: str | None = None,
    job_status: str | None = None,
    has_session: bool = False,
    now: datetime | None = None,
) -> dict[str, Any]:
    """输出 `{status, displayStatus, source, stale, terminal}`。

    - 账本存在：用账本；running 心跳超时再派生 stale/timeout。
    - 账本缺失：不显示“运行中”，回退到 dispatch/job/session/unknown，并标 `ledgerMissing`。
    - 队列只显示 queued，不把入队说成开始。
    """
    current = now or datetime.now(UTC)
    if ledger is not None:
        raw = str(ledger.get("status") or "unknown")
        if raw not in ACTIVE and raw not in TERMINAL and raw != "unknown":
            raw = "unknown"
        display = raw
        stale = False
        if raw == "running":
            age = _heartbeat_age_seconds(ledger.get("lastHeartbeatAt"), current)
            if age is not None and age > TIMEOUT_AFTER_SECONDS:
                display = "timeout"
                stale = True
            elif age is not None and age > STALE_AFTER_SECONDS:
                display = "stale"
                stale = True
        return {
            "status": raw,
            "displayStatus": display,
            "source": "agent_runs",
            "stale": stale,
            "terminal": display in TERMINAL,
            "ledgerMissing": False,
        }

    if dispatch_status:
        mapped = _DISPATCH_MAP.get(str(dispatch_status).lower())
        if mapped:
            return {
                "status": mapped,
                "displayStatus": mapped,
                "source": "subagent_dispatch",
                "stale": False,
                "terminal": mapped in TERMINAL,
                "ledgerMissing": True,
            }
    if job_status:
        mapped = _DISPATCH_MAP.get(str(job_status).lower())
        if mapped:
            return {
                "status": mapped,
                "displayStatus": mapped,
                "source": "subagent_jobs",
                "stale": False,
                "terminal": mapped in TERMINAL,
                "ledgerMissing": True,
            }
    if has_session:
        return {
            "status": "session",
            "displayStatus": "session",
            "source": "session",
            "stale": False,
            "terminal": False,
            "ledgerMissing": True,
        }
    return {
        "status": "unknown",
        "displayStatus": "unknown",
        "source": "none",
        "stale": False,
        "terminal": False,
        "ledgerMissing": True,
    }


def _heartbeat_age_seconds(value: Any, now: datetime) -> float | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return (now - parsed).total_seconds()


def is_terminal(status: str) -> bool:
    return status in TERMINAL
