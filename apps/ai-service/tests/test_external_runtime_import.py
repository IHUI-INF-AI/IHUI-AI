# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""external_runtime_import 单元测试(2026-10-31,对齐 Qoder 导入 4 维)。

测试隔离:memory/automations 两个真出口全部 monkeypatch(不连 Redis、
不连 PG、不写真实记忆);sessions 维断言「只报数不代写」;capabilities
断言「只声明不静默注册」;幂等键断言确定性。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services import external_runtime_import as eri
from app.services.external_runtime_import import (
    apply_bundle,
    automation_task_id,
    parse_external_bundle,
)


def _good_bundle() -> dict[str, Any]:
    return {
        "specVersion": 1,
        "source": "qoder",
        "namespaces": {
            "memory": {"items": [{"content": "用户偏好暗色主题", "importance": 4}]},
            "automations": {
                "items": [
                    {
                        "name": "每日站会提醒",
                        "triggerType": "cron",
                        "triggerConfig": {"hour": 9, "minute": 30},
                        "callback": {"type": "notify", "channel": "mail"},
                    }
                ]
            },
            "capabilities": {"items": [{"id": "cap.web.search", "kind": "tool", "note": "来自 qoder"}]},
            "sessions": {"items": [{"externalId": "s-1", "title": "旧会话"}]},
        },
    }


# ---------------------------------------------------------------------------
# parse:形状与逐条点名
# ---------------------------------------------------------------------------


def test_parse_good_bundle() -> None:
    parsed = parse_external_bundle(_good_bundle())
    assert parsed.ok and parsed.source == "qoder"
    assert set(parsed.namespaces) == {"memory", "automations", "capabilities", "sessions"}
    assert parsed.problems == []


@pytest.mark.parametrize("bad", [None, [], "bundle", 42])
def test_parse_rejects_non_object(bad: object) -> None:
    parsed = parse_external_bundle(bad)
    assert not parsed.ok and parsed.problems


def test_parse_rejects_wrong_spec_version() -> None:
    raw = _good_bundle()
    raw["specVersion"] = 2
    assert not parse_external_bundle(raw).ok


def test_parse_item_problems_are_named_not_raised() -> None:
    raw = _good_bundle()
    raw["namespaces"]["memory"]["items"].append({"nope": 1})
    raw["namespaces"]["automations"]["items"].append(
        {"name": "x", "triggerType": "weekly", "triggerConfig": {}, "callback": {"type": "t"}}
    )
    raw["namespaces"]["capabilities"]["items"].append({"kind": "tool"})
    parsed = parse_external_bundle(raw)
    assert parsed.ok  # 坏条目不拖垮整包
    assert len(parsed.problems) == 3
    assert parsed.namespaces["memory"]["skipped"] == 1
    assert parsed.namespaces["automations"]["skipped"] == 1
    assert parsed.namespaces["capabilities"]["skipped"] == 1


# ---------------------------------------------------------------------------
# 幂等键:确定性
# ---------------------------------------------------------------------------


def test_automation_task_id_is_deterministic() -> None:
    item = _good_bundle()["namespaces"]["automations"]["items"][0]
    assert automation_task_id("qoder", item) == automation_task_id("qoder", dict(item))
    assert automation_task_id("qoder", item) != automation_task_id("trae", item)
    assert automation_task_id("qoder", item).startswith("ext-qoder-")


# ---------------------------------------------------------------------------
# apply:各维真出口(monkeypatch)+ 让位面
# ---------------------------------------------------------------------------


async def test_apply_rejects_bad_bundle_and_missing_identity() -> None:
    parsed = parse_external_bundle([1, 2, 3])
    assert (await apply_bundle(parsed, "u1"))["status"] == "rejected"
    assert (await apply_bundle(parse_external_bundle(_good_bundle()), ""))["status"] == (
        "skipped_missing_identity"
    )


async def test_apply_memory_uses_existing_bulk_import(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import agent_longterm_memory as ltm

    captured: dict[str, Any] = {}

    def fake_bulk(candidates: list, user_id: str, session_id: str | None = None) -> dict:
        captured["candidates"] = candidates
        captured["user_id"] = user_id
        captured["session_id"] = session_id
        return {"added": 1, "merged": 0, "skipped": 0, "total": 1}

    monkeypatch.setattr(ltm.agent_longterm_memory, "bulk_import_from_extract", fake_bulk)
    parsed = parse_external_bundle(_good_bundle())
    out = await apply_bundle(parsed, "u1", session_id="sess-9")
    assert out["status"] == "ok"
    assert out["memory"]["added"] == 1
    assert captured == {
        "candidates": parsed.namespaces["memory"]["items"],
        "user_id": "u1",
        "session_id": "sess-9",
    }


async def test_apply_automations_idempotent_and_failures_named(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import scheduler_service as ss

    existing: dict[str, bool] = {}
    add_calls: list[str] = []

    async def fake_get(task_id: str) -> dict:
        return {"ok": True, "task": {"task_id": task_id}} if existing.get(task_id) else {
            "ok": False,
            "errorCode": "NOT_FOUND",
            "message": "任务不存在",
        }

    async def fake_add(task_id: str | None, trigger_type: str, trigger_config: dict, callback: dict, conversation_id: str | None = None) -> dict:
        add_calls.append(str(task_id))
        if trigger_config.get("boom"):
            return {"ok": False, "errorCode": "INVALID_TRIGGER", "message": "boom"}
        existing[str(task_id)] = True
        return {"ok": True, "task_id": task_id}

    monkeypatch.setattr(ss.task_scheduler, "get_task", fake_get)
    monkeypatch.setattr(ss.task_scheduler, "add_task", fake_add)

    raw = _good_bundle()
    item = raw["namespaces"]["automations"]["items"][0]
    parsed = parse_external_bundle(raw)
    out1 = await apply_bundle(parsed, "u1")
    assert out1["automations"] == {"created": 1, "duplicated": 0, "failed": 0, "skipped_shape": 0}
    assert add_calls == [automation_task_id("qoder", item)]

    # 重复导入同一 bundle:同幂等键 → duplicated,不重复建
    out2 = await apply_bundle(parsed, "u1")
    assert out2["automations"]["duplicated"] == 1 and out2["automations"]["created"] == 0
    assert len(add_calls) == 1

    # 出口拒绝(坏 triggerConfig):逐条点名,不静默
    raw3 = _good_bundle()
    raw3["namespaces"]["automations"]["items"][0]["triggerConfig"] = {"boom": 1}
    out3 = await apply_bundle(parse_external_bundle(raw3), "u1")
    assert out3["automations"]["failed"] == 1
    assert "boom" in out3["automations"]["failures"][0]


async def test_apply_sessions_defer_and_capabilities_declare_only() -> None:
    out = await apply_bundle(parse_external_bundle(_good_bundle()), "u1")
    assert out["sessions"]["count"] == 1
    assert out["sessions"]["owner"] == "relay-session-leg"
    assert out["capabilities"]["registered"] == 0
    assert out["capabilities"]["declared"][0]["id"] == "cap.web.search"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
