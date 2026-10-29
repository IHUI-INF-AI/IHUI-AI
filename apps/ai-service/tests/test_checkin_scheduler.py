# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""partition_platforms 纯函数用例(平台化 2026-10-10:主窗口 vs Qoder 窗口拆分)。

Qoder 领取窗口每日 10:00(UTC+8)开放 ⇒ 调度器把 qoder 账号拆到 10:05 独立
job;这里只测拆分语义(不触 store / 引擎,纯函数无 IO)。

风控第五件套增补(2026-10-16):积分快照跳过活跃冷却账号;Challenge 结果
触发出站全局暂停(store 打桩,不触 DB)。
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.services import checkin_scheduler as cs
from app.services import checkin_store
from app.services.checkin_outbound import checkin_outbound_gate
from app.services.checkin_scheduler import partition_platforms


@pytest.fixture(autouse=True)
def _stub_wb_memory_scan(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认不触真实进程内存扫描(单测不读别人进程);需要时用例内再覆盖。"""

    async def _none() -> dict[str, Any]:
        return {}

    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_memory_tokens", _none)


def _acc(aid: int, platform: str | None) -> dict[str, Any]:
    acc: dict[str, Any] = {"id": aid, "name": f"acc{aid}", "jwt": f"j{aid}"}
    if platform is not None:
        acc["platform"] = platform
    return acc


def test_partition_mixed():
    """混合列表:qoder 进 Qoder 侧,trae 进主侧,各自保持原顺序。"""
    accounts = [
        _acc(1, "trae"),
        _acc(2, "qoder"),
        _acc(3, "trae"),
        _acc(4, "qoder"),
    ]
    main_side, qoder_side = partition_platforms(accounts)
    assert [a["id"] for a in main_side] == [1, 3]
    assert [a["id"] for a in qoder_side] == [2, 4]


def test_partition_all_trae():
    """纯 trae:主侧全量,Qoder 侧空。"""
    accounts = [_acc(1, "trae"), _acc(2, "trae")]
    main_side, qoder_side = partition_platforms(accounts)
    assert len(main_side) == 2
    assert qoder_side == []


def test_partition_all_qoder():
    """纯 qoder:Qoder 侧全量,主侧空。"""
    accounts = [_acc(1, "qoder"), _acc(2, "qoder")]
    main_side, qoder_side = partition_platforms(accounts)
    assert main_side == []
    assert len(qoder_side) == 2


def test_partition_missing_platform_defaults_trae():
    """platform 缺失按 'trae' 处理(存量账号语义,与 store 默认列值一致)。"""
    accounts = [_acc(1, None), _acc(2, "qoder"), _acc(3, None)]
    main_side, qoder_side = partition_platforms(accounts)
    assert [a["id"] for a in main_side] == [1, 3]
    assert [a["id"] for a in qoder_side] == [2]


def test_partition_unknown_platform_goes_main():
    """未知平台值(防御)走主窗口,不误入 Qoder 窗口。"""
    accounts = [_acc(1, ""), _acc(2, "TRAE")]
    main_side, qoder_side = partition_platforms(accounts)
    assert len(main_side) == 2
    assert qoder_side == []


# ---------------------------------------------------------------------------
# 风控第五件套(2026-10-16):积分快照跳冷却 / Challenge 全局暂停
# ---------------------------------------------------------------------------


def _full_acc(aid: int, name: str) -> dict[str, Any]:
    return {
        "id": aid,
        "owner_user_id": "o1",
        "name": name,
        "jwt": f"j{aid}",
        "platform": "trae",
        "device_map": {},
    }


async def test_credits_snapshot_skips_cooled_accounts(monkeypatch):
    """冷却中的账号(如 401 死号 10 年冷却)不再被查余额——天天拿死 token
    打平台鉴权点是最典型的封号前兆,快照缺一天只是趋势少一格。"""
    accounts = [_full_acc(1, "dead"), _full_acc(2, "alive")]
    cooled_until = datetime.now(UTC) + timedelta(hours=2)
    queried: list[str] = []

    async def fake_list_full() -> list[dict[str, Any]]:
        return accounts

    async def fake_cooldowns() -> dict[int, datetime]:
        return {1: cooled_until}

    async def fake_query(jwt: str) -> dict[str, Any]:
        queried.append(jwt)
        return {"remaining": 42}

    async def fake_sum(*_a: Any, **_k: Any) -> int:
        return 0

    async def fake_upsert(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(checkin_store, "list_enabled_accounts_full", fake_list_full)
    monkeypatch.setattr(checkin_store, "get_active_cooldowns", fake_cooldowns)
    monkeypatch.setattr(checkin_store, "sum_credits_delta_for_day", fake_sum)
    monkeypatch.setattr(checkin_store, "upsert_credits_daily", fake_upsert)
    monkeypatch.setattr(cs.checkin_credits, "query_remaining_credits", fake_query)

    await cs.checkin_scheduler._daily_credits_snapshot()
    assert queried == ["j2"]  # 冷却账号 1 一发都没打


async def test_credits_snapshot_queries_all_when_no_cooldown(monkeypatch):
    """无冷却时全量查询(回归护栏:跳过逻辑不误伤正常账号)。"""
    accounts = [_full_acc(1, "a"), _full_acc(2, "b")]
    queried: list[str] = []

    async def fake_list_full() -> list[dict[str, Any]]:
        return accounts

    async def fake_cooldowns() -> dict[int, datetime]:
        return {}

    async def fake_query(jwt: str) -> dict[str, Any]:
        queried.append(jwt)
        return {"remaining": 7}

    async def fake_sum(*_a: Any, **_k: Any) -> int:
        return 0

    async def fake_upsert(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(checkin_store, "list_enabled_accounts_full", fake_list_full)
    monkeypatch.setattr(checkin_store, "get_active_cooldowns", fake_cooldowns)
    monkeypatch.setattr(checkin_store, "sum_credits_delta_for_day", fake_sum)
    monkeypatch.setattr(checkin_store, "upsert_credits_daily", fake_upsert)
    monkeypatch.setattr(cs.checkin_credits, "query_remaining_credits", fake_query)

    await cs.checkin_scheduler._daily_credits_snapshot()
    assert sorted(queried) == ["j1", "j2"]


async def test_record_result_challenge_cools_and_pauses(monkeypatch):
    """Challenge 结果:单账号即时落 30min 冷却 + 出站全局暂停(整批停手)。"""
    checkin_outbound_gate.reset()
    captured: dict[str, Any] = {}

    async def fake_insert(account_id: int, **kwargs: Any) -> dict[str, Any]:
        captured.update(kwargs)
        return {"id": 1}

    async def fake_reset_all(account_id: int) -> None:
        return None

    monkeypatch.setattr(checkin_store, "insert_record", fake_insert)
    monkeypatch.setattr(checkin_store, "reset_all_error_counts", fake_reset_all)

    result = {
        "ok": False,
        "classified_error": {"type": "Challenge", "cooldown_seconds": 1800},
    }
    await cs.checkin_scheduler.record_result(1, result)

    assert captured["cooldown_until"] is not None
    remaining = (captured["cooldown_until"] - datetime.now(UTC)).total_seconds()
    assert 1700 < remaining <= 1800
    assert checkin_outbound_gate.paused_remaining() > 0  # 全局暂停已触发
    checkin_outbound_gate.reset()


# ---------------------------------------------------------------------------
# 重启恢复出站暂停(第五件套配套,2026-10-16)
# ---------------------------------------------------------------------------


async def test_restore_outbound_pause_within_window(monkeypatch):
    """重启恢复:最近 SoftRate 记录在窗口内 → 按剩余时间补暂停(丢状态不丢停手)。"""
    checkin_outbound_gate.reset()
    monkeypatch.setenv("CHECKIN_RATE_LIMIT_PAUSE", "60")

    async def fake_signal() -> tuple[str, datetime]:
        return "SoftRate", datetime.now(UTC) - timedelta(seconds=10)  # 10s 前,窗口剩 50s

    monkeypatch.setattr(checkin_store, "latest_outbound_pause_signal", fake_signal)
    await cs.checkin_scheduler._restore_outbound_pause()
    remaining = checkin_outbound_gate.paused_remaining()
    assert 40 < remaining <= 50
    checkin_outbound_gate.reset()


async def test_restore_outbound_pause_challenge_uses_longer_window(monkeypatch):
    """Challenge 信号按 300s 窗口恢复(比 SoftRate 的 60s 长)。"""
    checkin_outbound_gate.reset()
    monkeypatch.setenv("CHECKIN_CHALLENGE_PAUSE", "300")

    async def fake_signal() -> tuple[str, datetime]:
        return "Challenge", datetime.now(UTC) - timedelta(seconds=20)  # 窗口剩 280s

    monkeypatch.setattr(checkin_store, "latest_outbound_pause_signal", fake_signal)
    await cs.checkin_scheduler._restore_outbound_pause()
    assert 260 < checkin_outbound_gate.paused_remaining() <= 280
    checkin_outbound_gate.reset()


async def test_restore_outbound_pause_expired_window_noop(monkeypatch):
    """窗口已走完 → 不补暂停(不误伤)。"""
    checkin_outbound_gate.reset()
    monkeypatch.setenv("CHECKIN_RATE_LIMIT_PAUSE", "60")

    async def fake_signal() -> tuple[str, datetime]:
        return "SoftRate", datetime.now(UTC) - timedelta(seconds=120)  # 早过 60s 窗口

    monkeypatch.setattr(checkin_store, "latest_outbound_pause_signal", fake_signal)
    await cs.checkin_scheduler._restore_outbound_pause()
    assert checkin_outbound_gate.paused_remaining() == 0


async def test_restore_outbound_pause_no_signal_noop(monkeypatch):
    """无历史信号 → 不补暂停(全新部署零行为变化)。"""
    checkin_outbound_gate.reset()

    async def fake_signal() -> None:
        return None

    monkeypatch.setattr(checkin_store, "latest_outbound_pause_signal", fake_signal)
    await cs.checkin_scheduler._restore_outbound_pause()
    assert checkin_outbound_gate.paused_remaining() == 0


async def test_restore_outbound_pause_query_failure_fail_open(monkeypatch):
    """读信号失败 → fail-open(不阻塞启动;每账号冷却仍持久兜底)。"""
    checkin_outbound_gate.reset()

    async def fake_signal() -> tuple[str, datetime]:
        raise RuntimeError("db down")

    monkeypatch.setattr(checkin_store, "latest_outbound_pause_signal", fake_signal)
    await cs.checkin_scheduler._restore_outbound_pause()  # 不抛
    assert checkin_outbound_gate.paused_remaining() == 0
def test_classify_checkin_result_separates_claim_from_skip():
    """ok=true 不等于本次领取:skip_already 必须单列。

    2026-10-24 实测:8 条 ok=true 全是 skip_already、0 条 claim,汇总却报「成功 8」
    —— 运营面据此会误判自动签到真的领到了积分。
    """
    assert cs.classify_checkin_result({"ok": True, "action": "checkin"}) == "claimed"
    assert cs.classify_checkin_result({"ok": True, "action": "claim"}) == "claimed"
    assert cs.classify_checkin_result({"ok": True, "action": "skip_already"}) == "skipped"
    assert cs.classify_checkin_result({"ok": False, "action": "checkin"}) == "failed"
    assert cs.classify_checkin_result({"ok": False, "action": "skip_already"}) == "failed"
    assert cs.classify_checkin_result({}) == "failed"


# ---------------------------------------------------------------------------
# WorkBuddy 网页会话保活腿(2026-10-24):探活 / 过期重抽 / 节流
# ---------------------------------------------------------------------------


def _wb_rows(device_map: dict[str, Any]) -> list[dict[str, Any]]:
    return [{"id": 7, "owner_user_id": "o", "name": "wb", "device_map": dict(device_map)}]


async def test_wb_sync_alive_skips_extraction(monkeypatch):
    """现有 cookie 探活通过 ⇒ 不拉起浏览器、不写库。"""
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1", "web_cookie": "session=ok", "web_cookie_expires_at": int(time.time()) + 86400 * 5})
    saves: list[Any] = []
    extracts: list[Any] = []

    async def fake_list(platform: str):
        assert platform == "workbuddy"
        return rows

    async def fake_session(cookie: str, dm: dict[str, Any]):
        return True, "u1", 200

    async def fake_extract():
        extracts.append(1)
        return {"cookie": "session=new", "user_agent": "UA", "expires_at": 1}

    async def fake_save(account_id: int, dm: dict[str, Any]):
        saves.append(account_id)

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy, "workbuddy_check_session", fake_session)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_cookie", fake_extract)
    monkeypatch.setattr(checkin_store, "save_device_map", fake_save)
    await sched._sync_workbuddy_local()
    assert extracts == [] and saves == []


async def test_wb_sync_dead_cookie_reextracts_and_writes(monkeypatch):
    """探活 401 ⇒ 重抽;重抽结果再探活通过才写库并解冷却。"""
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1", "web_cookie": "session=old"})
    saves: list[tuple[int, dict[str, Any]]] = []
    cooldowns: list[int] = []
    calls: list[str] = []

    async def fake_list(platform: str):
        return rows

    async def fake_session(cookie: str, dm: dict[str, Any]):
        calls.append(cookie)
        return (False, None, 401) if cookie == "session=old" else (True, "u1", 200)

    async def fake_extract():
        return {"cookie": "session=new", "user_agent": "UA-1", "expires_at": 1793380841}

    async def fake_save(account_id: int, dm: dict[str, Any]):
        saves.append((account_id, dict(dm)))

    async def fake_clear(account_id: int):
        cooldowns.append(account_id)

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy, "workbuddy_check_session", fake_session)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_cookie", fake_extract)
    monkeypatch.setattr(checkin_store, "save_device_map", fake_save)
    monkeypatch.setattr(checkin_store, "clear_open_cooldowns", fake_clear)
    await sched._sync_workbuddy_local()
    assert calls == ["session=old", "session=new"]
    assert saves and saves[0][1]["web_cookie"] == "session=new"
    assert saves[0][1]["user_agent"] == "UA-1"
    assert saves[0][1]["web_cookie_expires_at"] == 1793380841
    assert cooldowns == [7]


async def test_wb_sync_extract_failure_writes_nothing(monkeypatch):
    """重抽取不到(浏览器未登录)⇒ 一个字段都不写,不冒充成功。"""
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1", "login_type": "web"})
    saves: list[Any] = []

    async def fake_list(platform: str):
        return rows

    async def fake_extract():
        return None

    async def fake_save(account_id: int, dm: dict[str, Any]):
        saves.append(account_id)

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_cookie", fake_extract)
    monkeypatch.setattr(checkin_store, "save_device_map", fake_save)
    await sched._sync_workbuddy_local()
    assert saves == []


async def test_wb_sync_expiring_triggers_extraction(monkeypatch):
    """临期(<24h)即使探活通过也要重抽,提前换新。"""
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1", "web_cookie": "session=ok", "web_cookie_expires_at": int(time.time()) + 3600})
    extracts: list[Any] = []

    async def fake_list(platform: str):
        return rows

    async def fake_session(cookie: str, dm: dict[str, Any]):
        return True, "u1", 200

    async def fake_extract():
        extracts.append(1)
        return {"cookie": "session=ok", "user_agent": "UA", "expires_at": 1}

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy, "workbuddy_check_session", fake_session)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_cookie", fake_extract)
    await sched._sync_workbuddy_local()
    assert extracts == [1]


async def test_wb_sync_throttles_repeated_extraction(monkeypatch):
    """同一失败在节流窗口内不重复拉起无头 Chrome。"""
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1", "login_type": "web"})
    extracts: list[Any] = []

    async def fake_list(platform: str):
        return rows

    async def fake_extract():
        extracts.append(1)
        return None

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_cookie", fake_extract)
    await sched._sync_workbuddy_local()
    await sched._sync_workbuddy_local()
    assert extracts == [1]


async def test_wb_sync_bearer_only_account_does_not_extract(monkeypatch):
    """纯 Bearer 账号(无 login_type=web、无 cookie)不触发浏览器抽取。"""
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1"})
    extracts: list[Any] = []

    async def fake_list(platform: str):
        return rows

    async def fake_extract():
        extracts.append(1)
        return {"cookie": "session=new", "user_agent": "UA", "expires_at": 1}

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_cookie", fake_extract)
    await sched._sync_workbuddy_local()
    assert extracts == []


async def test_wb_sync_harvests_client_memory_token(monkeypatch):
    """临期时从客户端内存采到更新 Bearer ⇒ 写库、记来源、解冷却。"""
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1", "expires_at": 1000})  # 1970,早已过期
    saved: list[tuple[int, dict[str, Any]]] = []
    cooldowns: list[int] = []
    jwt_updates: list[tuple[int, str]] = []
    new_exp = int(time.time()) + 86400 * 20

    async def fake_list(platform: str):
        return rows

    async def fake_mem():
        return {
            "u1": {
                "bearer": "new-bearer",
                "bearer_exp": new_exp,
                "offline": "rt-new",
                "offline_exp": new_exp + 86400,
            }
        }

    async def fake_update_jwt(aid: int, owner: str, tok: str) -> bool:
        jwt_updates.append((aid, tok))
        return True

    async def fake_save(aid: int, dm: dict[str, Any]) -> None:
        saved.append((aid, dict(dm)))

    async def fake_clear(aid: int) -> None:
        cooldowns.append(aid)

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_memory_tokens", fake_mem)
    monkeypatch.setattr(checkin_store, "update_jwt", fake_update_jwt)
    monkeypatch.setattr(checkin_store, "save_device_map", fake_save)
    monkeypatch.setattr(checkin_store, "clear_open_cooldowns", fake_clear)
    await sched._sync_workbuddy_local()
    assert jwt_updates == [(7, "new-bearer")]
    assert saved[0][1]["expires_at"] == new_exp
    assert saved[0][1]["token_source"] == "client-memory"
    assert saved[0][1]["refresh_token"] == "rt-new"
    assert cooldowns == [7]


async def test_wb_sync_does_not_downgrade_token(monkeypatch):
    """客户端里那枚比库里还旧 ⇒ 一字不写(防把有效票换成短命票)。"""
    sched = cs.CheckinScheduler()
    cur_exp = int(time.time()) + 86400 * 3
    rows = _wb_rows({"uid": "u1", "expires_at": cur_exp})
    jwt_updates: list[Any] = []

    async def fake_list(platform: str):
        return rows

    async def fake_mem():
        return {"u1": {"bearer": "older", "bearer_exp": cur_exp - 3600}}

    async def fake_update_jwt(aid: int, owner: str, tok: str) -> bool:
        jwt_updates.append((aid, tok))
        return True

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_memory_tokens", fake_mem)
    monkeypatch.setattr(checkin_store, "update_jwt", fake_update_jwt)
    await sched._sync_workbuddy_local()
    assert jwt_updates == []


# [IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
