# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""task-run 执行留痕(2026-11-09 立)。

覆盖两件事:
1. `_settled_today` 不把 task-run 留痕当成「今日已结算」(否则跳过签到/启动补偿);
2. `run_account_task` 事后落一条 summary 记录(credits_delta 恒 None),且落库
   失败不影响路由返回。

零真实网络、零真实 DB:run_family / insert_record 全部打桩。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.routers import checkin as checkin_router
from app.services import checkin_scheduler as cs


def _rec(action: str, ok: bool, created: datetime) -> dict[str, Any]:
    return {"action": action, "ok": ok, "created_at": created}


def _fake_family_result() -> dict[str, Any]:
    return {
        "ok": True,
        "kind": "all",
        "accepted": ["growth:t1"],
        "claimed": ["growth:t1"],
        "credit_delta": 42,
        "energy_delta": None,
        "reason": None,
        "unjudged": False,
        "families": {
            "growth": {"ok": True, "credit_delta": 42},
            "travel": {"ok": False, "reason": "上游读不懂"},
        },
    }


def test_settled_today_task_run_true_is_not_settled() -> None:
    """task-run + ok=True + 今天 ⇒ 不算结算(否则真业务破坏)。"""
    now = datetime.now(UTC)
    today = cs._cn_day(now)
    assert cs._settled_today(_rec("task-run", True, now), today) is False


def test_settled_today_checkin_true_is_settled() -> None:
    """checkin + ok=True + 今天 ⇒ 仍算结算(回归保护)。"""
    now = datetime.now(UTC)
    today = cs._cn_day(now)
    assert cs._settled_today(_rec("checkin", True, now), today) is True


def test_settled_today_task_run_yesterday_is_not_settled() -> None:
    """task-run + ok=True + 昨天 ⇒ False(日界仍生效)。"""
    yesterday = datetime.now(UTC) - timedelta(days=1)
    today = cs._cn_day(datetime.now(UTC))
    assert cs._settled_today(_rec("task-run", True, yesterday), today) is False


async def test_run_account_task_records_summary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """落记录字段映射:action/ok/code/message/credits_delta。"""
    captured: dict[str, Any] = {}

    async def _fake_account(account_id: int, current_user: str) -> dict[str, Any]:
        return {"id": account_id, "platform": "workbuddy", "jwt": "jwt", "device_map": {}}

    async def _noop_precheck(account_id: int) -> None:
        return None

    async def _fake_run_family(kind: str, jwt: str, device_map: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
        return _fake_family_result()

    async def _fake_insert_record(account_id: int, **kwargs: Any) -> dict[str, Any]:
        captured["account_id"] = account_id
        captured.update(kwargs)
        return {"id": 1}

    monkeypatch.setattr(checkin_router, "_wb_tasks_account_or_404", _fake_account)
    monkeypatch.setattr(checkin_router, "_outbound_risk_precheck", _noop_precheck)
    monkeypatch.setattr(checkin_router.workbuddy_tasks, "run_family", _fake_run_family)
    monkeypatch.setattr(checkin_router.checkin_store, "insert_record", _fake_insert_record)

    result = await checkin_router.run_account_task(
        20, checkin_router.TaskRunIn(kind="all", dry_run=False), "user-1"
    )

    assert result["credit_delta"] == 42
    assert captured["account_id"] == 20
    assert captured["action"] == "task-run"
    assert captured["ok"] is True
    assert captured["http_status"] == 200
    assert captured["code"] == "all"
    assert captured["credits_delta"] is None
    assert captured["classified_error"] is None
    assert captured["cooldown_until"] is None
    assert captured["credits"] is None
    assert "kind=all" in captured["message"]
    assert "credit_delta=42" in captured["message"]
    assert "growth=ok" in captured["message"]


async def test_run_account_task_dry_run_action_suffix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """dry_run=True ⇒ action 用 task-run:dry 区分预演。"""
    captured: dict[str, Any] = {}

    async def _fake_account(account_id: int, current_user: str) -> dict[str, Any]:
        return {"id": account_id, "platform": "workbuddy", "jwt": "jwt", "device_map": {}}

    async def _noop_precheck(account_id: int) -> None:
        return None

    async def _fake_run_family(kind: str, jwt: str, device_map: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
        return _fake_family_result()

    async def _fake_insert_record(account_id: int, **kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return {"id": 1}

    monkeypatch.setattr(checkin_router, "_wb_tasks_account_or_404", _fake_account)
    monkeypatch.setattr(checkin_router, "_outbound_risk_precheck", _noop_precheck)
    monkeypatch.setattr(checkin_router.workbuddy_tasks, "run_family", _fake_run_family)
    monkeypatch.setattr(checkin_router.checkin_store, "insert_record", _fake_insert_record)

    await checkin_router.run_account_task(
        20, checkin_router.TaskRunIn(kind="growth", dry_run=True), "user-1"
    )

    assert captured["action"] == "task-run:dry"
    assert captured["code"] == "growth"
    assert "dry_run=True" in captured["message"]


async def test_run_account_task_survives_insert_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """落记录抛异常 ⇒ 路由照常返回原结果(留痕是旁路)。"""

    async def _fake_account(account_id: int, current_user: str) -> dict[str, Any]:
        return {"id": account_id, "platform": "workbuddy", "jwt": "jwt", "device_map": {}}

    async def _noop_precheck(account_id: int) -> None:
        return None

    async def _fake_run_family(kind: str, jwt: str, device_map: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
        return _fake_family_result()

    async def _boom_insert_record(account_id: int, **kwargs: Any) -> dict[str, Any]:
        raise RuntimeError("db down")

    monkeypatch.setattr(checkin_router, "_wb_tasks_account_or_404", _fake_account)
    monkeypatch.setattr(checkin_router, "_outbound_risk_precheck", _noop_precheck)
    monkeypatch.setattr(checkin_router.workbuddy_tasks, "run_family", _fake_run_family)
    monkeypatch.setattr(checkin_router.checkin_store, "insert_record", _boom_insert_record)

    result = await checkin_router.run_account_task(
        20, checkin_router.TaskRunIn(kind="all"), "user-1"
    )

    assert result["ok"] is True
    assert result["credit_delta"] == 42


async def test_run_account_task_non_workbuddy_skips_record(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """非 workbuddy 平台提前 return ⇒ 不落记录(不是真执行)。"""
    called = False

    async def _fake_account(account_id: int, current_user: str) -> dict[str, Any]:
        return {"id": account_id, "platform": "trae"}

    async def _fake_insert_record(account_id: int, **kwargs: Any) -> dict[str, Any]:
        nonlocal called
        called = True
        return {"id": 1}

    monkeypatch.setattr(checkin_router, "_wb_tasks_account_or_404", _fake_account)
    monkeypatch.setattr(checkin_router.checkin_store, "insert_record", _fake_insert_record)

    result = await checkin_router.run_account_task(
        21, checkin_router.TaskRunIn(kind="all"), "user-1"
    )

    assert result["ok"] is False
    assert called is False


def test_task_run_message_truncated() -> None:
    """摘要超长截断并加 …(≤500 字符)。"""
    result: dict[str, Any] = {
        "ok": True,
        "unjudged": False,
        "credit_delta": 1,
        "families": {f"family{i}": {"ok": True, "reason": "x" * 50} for i in range(40)},
    }
    message = checkin_router._task_run_message("all", False, result)
    assert len(message) <= 500
    assert message.endswith("…")
