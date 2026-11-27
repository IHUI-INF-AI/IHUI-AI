# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P4-03 状态归一：账本权威、心跳 stale/timeout、缺账本 = unknown。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.run_status import normalize_run_status


def _now() -> datetime:
    return datetime(2026, 11, 28, 3, 0, tzinfo=UTC)


def test_ledger_is_authoritative_even_if_dispatch_says_running() -> None:
    result = normalize_run_status(
        ledger={"status": "queued", "lastHeartbeatAt": None},
        dispatch_status="running",
        now=_now(),
    )
    assert result["status"] == "queued"
    assert result["displayStatus"] == "queued"
    assert result["source"] == "agent_runs"


def test_running_with_6min_heartbeat_is_stale_and_31min_is_timeout() -> None:
    stale = normalize_run_status(
        ledger={
            "status": "running",
            "lastHeartbeatAt": (_now() - timedelta(minutes=6)).isoformat(),
        },
        now=_now(),
    )
    assert stale["displayStatus"] == "stale"
    assert stale["stale"] is True
    assert stale["terminal"] is False

    timeout = normalize_run_status(
        ledger={
            "status": "running",
            "lastHeartbeatAt": (_now() - timedelta(minutes=31)).isoformat(),
        },
        now=_now(),
    )
    assert timeout["displayStatus"] == "timeout"
    assert timeout["terminal"] is True


def test_missing_ledger_falls_back_and_never_says_running_by_default() -> None:
    result = normalize_run_status(ledger=None, now=_now())
    assert result["displayStatus"] == "unknown"
    assert result["source"] == "none"
    assert result["ledgerMissing"] is True

    queued = normalize_run_status(ledger=None, dispatch_status="pending", now=_now())
    assert queued["displayStatus"] == "queued"
    assert queued["source"] == "subagent_dispatch"

    job = normalize_run_status(ledger=None, job_status="completed", now=_now())
    assert job["displayStatus"] == "succeeded"
    assert job["source"] == "subagent_jobs"

    session = normalize_run_status(ledger=None, has_session=True, now=_now())
    assert session["displayStatus"] == "session"
    assert session["source"] == "session"


def test_unknown_datetime_does_not_crash() -> None:
    result = normalize_run_status(
        ledger={"status": "running", "lastHeartbeatAt": "not-a-date"},
        now=_now(),
    )
    assert result["displayStatus"] == "running"
