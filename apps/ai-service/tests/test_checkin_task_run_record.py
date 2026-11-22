# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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


# ---------------------------------------------------------------------------
# autopilot 端点(2026-11-09 深夜):AI 会话可编程入口 + 留痕
# ---------------------------------------------------------------------------


def test_settled_today_autopilot_true_is_not_settled() -> None:
    """task-run:autopilot + ok=True + 今天 ⇒ 不算结算(复用 task-run 前缀早退)。"""
    now = datetime.now(UTC)
    today = cs._cn_day(now)
    assert cs._settled_today(_rec("task-run:autopilot", True, now), today) is False
    assert cs._settled_today(_rec("task-run:autopilot:dry", True, now), today) is False


def _fake_autopilot_summary() -> dict[str, Any]:
    return {
        "ok": True,
        "dry_run": False,
        "total_tasks": 18,
        "claimed_already": ["t1", "t2"],
        "executed": [{"code": "Sequential_Tasks_2", "route": "generic", "ok": True}],
        "claimed": ["Sequential_Tasks_2"],
        "credits": 200,
        "undone": [],
        "unregistered": ["chat_5"],
        "read_failed": False,
    }


async def test_run_account_autopilot_records_summary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """autopilot 端点:调引擎 + 落记录(action=task-run:autopilot,credits_delta=None)。"""
    captured: dict[str, Any] = {}

    async def _fake_account(account_id: int, current_user: str) -> dict[str, Any]:
        return {"id": account_id, "platform": "workbuddy", "jwt": "jwt", "device_map": {}}

    async def _noop_precheck(account_id: int) -> None:
        return None

    async def _fake_run_autopilot(jwt: str, device_map: dict[str, Any], *, dry_run: bool = False, claim: bool = True) -> dict[str, Any]:
        captured["dry_run"] = dry_run
        captured["claim"] = claim
        return _fake_autopilot_summary()

    async def _fake_insert_record(account_id: int, **kwargs: Any) -> dict[str, Any]:
        captured["account_id"] = account_id
        captured.update(kwargs)
        return {"id": 1}

    monkeypatch.setattr(checkin_router, "_wb_tasks_account_or_404", _fake_account)
    monkeypatch.setattr(checkin_router, "_outbound_risk_precheck", _noop_precheck)
    monkeypatch.setattr(checkin_router.workbuddy_autopilot, "run_autopilot", _fake_run_autopilot)
    monkeypatch.setattr(checkin_router.checkin_store, "insert_record", _fake_insert_record)

    result = await checkin_router.run_account_autopilot(
        20, checkin_router.AutopilotIn(dry_run=False, claim=True), "user-1"
    )

    assert result["ok"] is True
    assert result["credits"] == 200
    assert captured["dry_run"] is False and captured["claim"] is True
    assert captured["account_id"] == 20
    assert captured["action"] == "task-run:autopilot"
    assert captured["credits_delta"] is None
    assert "claimed=1" in captured["message"]
    assert "credits=+200" in captured["message"]


async def test_run_account_autopilot_non_workbuddy_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """非 workbuddy 账号 ⇒ ok=False,零出站零留痕。"""
    called = False

    async def _fake_account(account_id: int, current_user: str) -> dict[str, Any]:
        return {"id": account_id, "platform": "trae"}

    async def _fake_insert_record(account_id: int, **kwargs: Any) -> dict[str, Any]:
        nonlocal called
        called = True
        return {"id": 1}

    monkeypatch.setattr(checkin_router, "_wb_tasks_account_or_404", _fake_account)
    monkeypatch.setattr(checkin_router.checkin_store, "insert_record", _fake_insert_record)

    result = await checkin_router.run_account_autopilot(
        21, checkin_router.AutopilotIn(), "user-1"
    )
    assert result["ok"] is False
    assert called is False


def test_autopilot_message_truncated() -> None:
    """摘要超长截断并加 …(≤500 字符)。"""
    summary = _fake_autopilot_summary()
    summary["executed"] = [{"code": f"code{i}", "route": "generic", "ok": True} for i in range(200)]
    message = checkin_router._autopilot_message(False, summary)
    assert len(message) <= 500


async def test_run_account_task_uses_run_family_exclusive_entry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-045:手动 task-run 走 run_family_exclusive 统一互斥入口。

    路由不得绕过该入口直调 run_family(否则手动+调度仍会并发撞车);
    account_id / kind / jwt / device_map / dry_run 必须原样透传。
    """
    seen: list[tuple[int, str, str, dict[str, Any], bool]] = []

    async def _fake_account(account_id: int, current_user: str) -> dict[str, Any]:
        return {
            "id": account_id,
            "platform": "workbuddy",
            "jwt": "jwt",
            "device_map": {"d": 1},
        }

    async def _noop_precheck(account_id: int) -> None:
        return None

    async def _fake_exclusive(
        account_id: int,
        kind: str,
        jwt: str,
        device_map: dict[str, Any],
        *,
        dry_run: bool,
    ) -> dict[str, Any]:
        seen.append((account_id, kind, jwt, dict(device_map), dry_run))
        return _fake_family_result()

    async def _boom_run_family(*_a: Any, **_k: Any) -> dict[str, Any]:
        raise AssertionError("run_account_task 不得绕过 run_family_exclusive 直调 run_family")

    async def _fake_insert_record(account_id: int, **kwargs: Any) -> dict[str, Any]:
        return {"id": 1}

    monkeypatch.setattr(checkin_router, "_wb_tasks_account_or_404", _fake_account)
    monkeypatch.setattr(checkin_router, "_outbound_risk_precheck", _noop_precheck)
    monkeypatch.setattr(
        checkin_router.checkin_scheduler_mod, "run_family_exclusive", _fake_exclusive
    )
    monkeypatch.setattr(checkin_router.workbuddy_tasks, "run_family", _boom_run_family)
    monkeypatch.setattr(checkin_router.checkin_store, "insert_record", _fake_insert_record)

    result = await checkin_router.run_account_task(
        20, checkin_router.TaskRunIn(kind="all", dry_run=True), "user-1"
    )

    assert result["ok"] is True
    assert seen == [(20, "all", "jwt", {"d": 1}, True)]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
