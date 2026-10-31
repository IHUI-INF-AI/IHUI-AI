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


# ---------------------------------------------------------------------------
# status():WorkBuddy 任务巡检 job 的可见性(2026-10-31)
# 前端要能显示「自动做任务」在不在跑 / 下次何时跑 / 为什么没领奖,
# 故 status() 补 next_run_wb_tasks + wb_tasks 五字段;这里锁口径不漂移。
# ---------------------------------------------------------------------------


class _FakeJob:
    """APScheduler Job 的最小替身(只被读 next_run_time)。"""

    def __init__(self, next_run_time: datetime | None) -> None:
        self.next_run_time = next_run_time


class _FakeAsyncIOScheduler:
    """AsyncIOScheduler 的最小替身:只登记 job,不真起事件循环 / 线程。

    get_job 按注册的 trigger 现算 next_run_time(IntervalTrigger 未 start 时
    next_run_time 为 None,这里补算一次,让 status() 的取值路径可被断言)。
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.jobs: dict[str, dict[str, Any]] = {}

    def add_job(
        self, func: Any, *, trigger: Any, id: str, replace_existing: bool = False
    ) -> None:
        self.jobs[id] = {"func": func, "trigger": trigger}

    def get_job(self, job_id: str) -> Any:
        entry = self.jobs.get(job_id)
        if entry is None:
            return None
        nrt = entry["trigger"].get_next_fire_time(None, datetime.now(cs._CN_TZ))
        return _FakeJob(nrt)

    def start(self) -> None:
        return None

    def shutdown(self, wait: bool = False) -> None:
        return None


async def _noop_async() -> None:
    return None


def test_status_wb_tasks_shape_when_not_started(monkeypatch):
    """未 start:next_run_wb_tasks=None,wb_tasks 字段齐全且类型正确。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "false")
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", False)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_live_run", False)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_sweep_minutes", 180)
    st = cs.CheckinScheduler().status()
    assert st["next_run_wb_tasks"] is None
    wb = st["wb_tasks"]
    assert set(wb) == {
        "enabled",
        "tasks_enabled",
        "cron_enabled",
        "not_running_reason",
        "live_run",
        "sweep_minutes",
        "claim_path_configured",
        "activity_path_configured",
        "last_sweep",
    }
    assert isinstance(wb["enabled"], bool)
    assert isinstance(wb["tasks_enabled"], bool)
    assert isinstance(wb["cron_enabled"], bool)
    assert isinstance(wb["live_run"], bool)
    assert isinstance(wb["sweep_minutes"], int)
    assert isinstance(wb["claim_path_configured"], bool)
    assert isinstance(wb["activity_path_configured"], bool)
    assert wb["enabled"] is False  # 默认 off(安全设计:不配就不跑)
    assert wb["tasks_enabled"] is False
    assert wb["cron_enabled"] is False
    # 两门都关而未 start ⇒ 先点名任务门(它才是这条 job 的专闸,能当场整改)
    assert wb["not_running_reason"] == "tasks_gate_off"


def test_status_wb_tasks_enabled_is_observed_state_not_gate_and(monkeypatch):
    """enabled 是观测态(job 现在真注册着),不是「两门与」的配置意图。

    2026-10-31 二修:上一轮把 enabled 从单门改成「任务门 ∧ 总闸」仍是假绿 ——
    那两道闸都是**配置意图**,判不出"进程里到底有没有这条 job"。反例可复现:
    start() 里 ensure_tables 抛异常就 return(main.py 又把 start() 整包
    try/except 忽略)⇒ 进程里连 scheduler 都没有,两门 env 皆 true 时旧口径照样
    报 enabled=true,面板显示「已启用 · 每 180 分钟自动巡检」而这条 job 永不执行。
    意图仍原样报在 tasks_enabled / cron_enabled 里,由 not_running_reason 说明卡在哪。
    """
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", True)
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "false")
    wb = cs.CheckinScheduler().status()["wb_tasks"]
    assert wb["tasks_enabled"] is True
    assert wb["cron_enabled"] is False
    assert wb["enabled"] is False  # 总闸关 ⇒ 真不会跑
    assert wb["not_running_reason"] == "cron_gate_off"

    # 两门都开但本进程从未 start ⇒ 依旧不是「已启用」(旧版这里假绿,已改判)
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    wb = cs.CheckinScheduler().status()["wb_tasks"]
    assert wb["tasks_enabled"] is True
    assert wb["cron_enabled"] is True
    assert wb["enabled"] is False
    assert wb["not_running_reason"] == "scheduler_not_started"


# ---------------------------------------------------------------------------
# wb_tasks.not_running_reason:五档机器枚举的判序(实现与文档不许各写一份)
# ---------------------------------------------------------------------------


def test_wb_tasks_not_running_reason_pure_five_slots():
    """纯函数逐档喂参数验判序:自上而下第一个命中,且 enabled=true 恒为 None。"""
    reason = cs._wb_tasks_not_running_reason
    # ① job 真注册着 ⇒ 没有"为什么没跑"可说
    assert (
        reason(tasks_enabled=True, cron_enabled=True, started=True, job_registered=True) is None
    )
    # ② 任务门关(它专管这条 job,排在总闸前:红牌先指能当场改的那一格)
    assert (
        reason(tasks_enabled=False, cron_enabled=True, started=True, job_registered=False)
        == "tasks_gate_off"
    )
    # ③ 任务门开、总闸关
    assert (
        reason(tasks_enabled=True, cron_enabled=False, started=False, job_registered=False)
        == "cron_gate_off"
    )
    # ④ 两门皆开但调度器没起来(建表失败 / start() 抛异常 / lifespan 没跑到)
    assert (
        reason(tasks_enabled=True, cron_enabled=True, started=False, job_registered=False)
        == "scheduler_not_started"
    )
    # ⑤ 调度器起来了而这条 job 不在注册表(改完 env 没重启的进程内不一致)
    assert (
        reason(tasks_enabled=True, cron_enabled=True, started=True, job_registered=False)
        == "job_not_registered"
    )
    # 边界:两门双关且没 start ⇒ 仍落任务门,不越级报 scheduler_not_started
    assert (
        reason(tasks_enabled=False, cron_enabled=False, started=False, job_registered=False)
        == "tasks_gate_off"
    )


async def test_status_wb_tasks_ensure_tables_failure_is_not_enabled(monkeypatch):
    """建表异常 ⇒ start() 提前 return ⇒ 两门全开也必须报未运行(假绿的根反例)。

    main.py 的 lifespan 把 start() 整包 try/except 忽略,所以这条路径在生产里
    是"服务照常起、功能全没起"。status() 若按配置意图报绿,面板就在说谎。
    """
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", True)

    async def _boom() -> None:
        raise RuntimeError("db down")

    monkeypatch.setattr(cs.checkin_store, "ensure_tables", _boom)
    sched = cs.CheckinScheduler()
    await sched.start()  # 不抛(fail-open)
    assert sched._started is False
    wb = sched.status()["wb_tasks"]
    assert wb["enabled"] is False
    assert wb["not_running_reason"] == "scheduler_not_started"
    assert wb["tasks_enabled"] is True and wb["cron_enabled"] is True


async def test_status_wb_tasks_started_but_job_missing(monkeypatch):
    """调度器在跑而这条 job 不在注册表 ⇒ job_not_registered(改 env 未重启型)。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", False)
    monkeypatch.setattr(cs, "AsyncIOScheduler", _FakeAsyncIOScheduler)
    monkeypatch.setattr(cs.checkin_store, "ensure_tables", _noop_async)
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(sched, "_restore_outbound_pause", _noop_async)
    await sched.start()
    # 运行期把任务门改成 true(等价于改了 .env 而进程没重启)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", True)
    st = sched.status()
    assert st["started"] is True
    assert cs._JOB_ID_WB_TASKS not in sched._scheduler.jobs  # type: ignore[union-attr]
    wb = st["wb_tasks"]
    assert wb["enabled"] is False
    assert wb["not_running_reason"] == "job_not_registered"
    await sched.stop()


def test_status_wb_tasks_disabled_by_setting(monkeypatch):
    """workbuddy_tasks_enabled=False ⇒ wb_tasks.enabled=False(与 start() 同源)。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")  # 签到门打开也不影响这条 job 的门
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", False)
    st = cs.CheckinScheduler().status()
    assert st["enabled"] is True
    assert st["wb_tasks"]["enabled"] is False


def test_wb_tasks_sweep_minutes_clamped_single_source(monkeypatch):
    """节拍 clamp 只有一处(_wb_tasks_sweep_minutes):<5 抬到 5,正常值原样。"""
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_sweep_minutes", 1)
    assert cs._wb_tasks_sweep_minutes() == 5
    assert cs.CheckinScheduler().status()["wb_tasks"]["sweep_minutes"] == 5
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_sweep_minutes", 180)
    assert cs._wb_tasks_sweep_minutes() == 180
    assert cs.CheckinScheduler().status()["wb_tasks"]["sweep_minutes"] == 180


def test_status_wb_paths_blank_not_configured(monkeypatch):
    """领奖/上报路径置空 ⇒ configured=False(前端据此解释「为什么没领奖」)。"""
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_claim_path", "")
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_activity_path", "   ")
    wb = cs.CheckinScheduler().status()["wb_tasks"]
    assert wb["claim_path_configured"] is False
    assert wb["activity_path_configured"] is False
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_claim_path", "/a/{code}/claim")
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_activity_path", "/v2/report")
    wb2 = cs.CheckinScheduler().status()["wb_tasks"]
    assert wb2["claim_path_configured"] is True
    assert wb2["activity_path_configured"] is True


def test_status_next_run_wb_tasks_when_started(monkeypatch):
    """已启动单例:next_run_wb_tasks 取 get_job(_JOB_ID_WB_TASKS).next_run_time 的 ISO8601。"""
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", True)
    nrt = datetime(2026, 10, 31, 12, 30, tzinfo=cs._CN_TZ)

    class _Aps:
        def get_job(self, job_id: str):
            if job_id == cs._JOB_ID_WB_TASKS:
                return _FakeJob(nrt)
            return None

    sched = cs.CheckinScheduler()
    sched._scheduler = _Aps()  # 注入 fake,不真起调度器(无网络/DB)
    sched._started = True
    st = sched.status()
    assert st["next_run_wb_tasks"] == "2026-10-31T12:30:00+08:00"
    assert st["wb_tasks"]["enabled"] is True
    assert st["wb_tasks"]["not_running_reason"] is None


async def test_start_registers_wb_job_with_status_same_interval(monkeypatch):
    """start() 注册的间隔 == status() 展示的 sweep_minutes(单一真源,不许两处各算)。

    ensure_tables / _restore_outbound_pause 打桩,调度器换 fake ⇒ 无 DB / 无线程。
    """
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", True)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_sweep_minutes", 1)  # 会被抬到 5
    monkeypatch.setattr(cs, "AsyncIOScheduler", _FakeAsyncIOScheduler)
    monkeypatch.setattr(cs.checkin_store, "ensure_tables", _noop_async)
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(sched, "_restore_outbound_pause", _noop_async)
    await sched.start()
    assert sched._started is True
    assert isinstance(sched._scheduler, _FakeAsyncIOScheduler)
    entry = sched._scheduler.jobs.get(cs._JOB_ID_WB_TASKS)
    assert entry is not None
    assert entry["trigger"].interval == timedelta(minutes=5)
    st = sched.status()
    assert st["wb_tasks"]["sweep_minutes"] == 5
    assert st["next_run_wb_tasks"] is not None  # fake 按 trigger 现算,证明取值路径通
    # 观测态:job 真在注册表里 ⇒ enabled=true 且没有"为什么没跑"可说
    assert st["wb_tasks"]["enabled"] is True
    assert st["wb_tasks"]["not_running_reason"] is None
    await sched.stop()


async def test_start_skips_wb_job_when_disabled(monkeypatch):
    """workbuddy_tasks_enabled=False ⇒ start() 不注册该 job,status 两个字段同步为空/False。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_enabled", False)
    monkeypatch.setattr(cs, "AsyncIOScheduler", _FakeAsyncIOScheduler)
    monkeypatch.setattr(cs.checkin_store, "ensure_tables", _noop_async)
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(sched, "_restore_outbound_pause", _noop_async)
    await sched.start()
    assert isinstance(sched._scheduler, _FakeAsyncIOScheduler)
    assert cs._JOB_ID_WB_TASKS not in sched._scheduler.jobs
    st = sched.status()
    assert st["next_run_wb_tasks"] is None
    assert st["wb_tasks"]["enabled"] is False
    assert st["wb_tasks"]["not_running_reason"] == "tasks_gate_off"
    await sched.stop()


async def test_wb_sweep_records_note_when_outbound_paused(monkeypatch):
    """出站暂停 ⇒ 本轮跳过也要留摘要,前端才能说「上次跳过:出站限流」。"""
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(cs.checkin_outbound_gate, "paused_remaining", lambda: 42.0)
    await sched._workbuddy_task_sweep()
    last = sched.status()["wb_tasks"]["last_sweep"]
    assert last is not None
    assert last["note"] == "出站限流暂停"
    assert last["families"] == 0


async def test_wb_sweep_records_note_when_no_workbuddy_account(monkeypatch):
    """只有非 WorkBuddy 账号 ⇒ note 点名,不冒充「跑过」。"""
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(cs.checkin_outbound_gate, "paused_remaining", lambda: 0.0)

    async def _fake_load(label):
        return ([{"id": 1, "platform": "trae", "jwt": "x", "device_map": {}}], {})

    monkeypatch.setattr(sched, "_load_accounts_and_cooldowns", _fake_load)
    await sched._workbuddy_task_sweep()
    last = sched.status()["wb_tasks"]["last_sweep"]
    assert last["note"] == "无 WorkBuddy 账号"
    assert last["accounts"] == 0


async def test_wb_sweep_records_counts_on_success(monkeypatch):
    """正常一轮:六族全跑,accepted/claimed 累计,note 为 None(真跑完了)。"""
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(cs.checkin_outbound_gate, "paused_remaining", lambda: 0.0)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_live_run", True)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_urgency_order", "none")
    # 节流等 0 秒:只改 random 的取值,不动全局 asyncio.sleep。
    monkeypatch.setattr(cs.random, "uniform", lambda a, b: 0.0)

    async def _fake_load(label):
        return ([{"id": 3, "platform": "workbuddy", "jwt": "j", "device_map": {}}], {})

    async def _fake_run(kind, jwt, dm, dry_run=False):
        return {
            "ok": True,
            "kind": kind,
            "accepted": ["a1"],
            "claimed": ["a1"] if kind == "growth" else [],
            "credit_delta": 0,
            "energy_delta": None,
            "reason": None,
            "unjudged": kind == "lottery",
        }

    monkeypatch.setattr(sched, "_load_accounts_and_cooldowns", _fake_load)
    monkeypatch.setattr(cs.workbuddy_tasks, "run_family", _fake_run)
    await sched._workbuddy_task_sweep()

    last = sched.status()["wb_tasks"]["last_sweep"]
    assert last["note"] is None
    assert last["dry_run"] is True or last["dry_run"] is False  # 布尔即可
    assert last["families"] == len(cs.workbuddy_tasks.SWEEP_ORDER)
    assert last["accepted"] == len(cs.workbuddy_tasks.SWEEP_ORDER)
    assert last["claimed"] == 1
    assert last["unjudged"] == 1
    assert last["errors"] == 0


async def test_wb_sweep_counts_errors_and_keeps_going(monkeypatch):
    """单族异常 ⇒ errors+1 且不中断整轮(后续族照跑),note 仍为 None。"""
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(cs.checkin_outbound_gate, "paused_remaining", lambda: 0.0)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_live_run", False)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_urgency_order", "none")
    monkeypatch.setattr(cs.random, "uniform", lambda a, b: 0.0)

    async def _fake_load(label):
        return ([{"id": 5, "platform": "workbuddy", "jwt": "j", "device_map": {}}], {})

    calls: list[str] = []

    async def _fake_run(kind, jwt, dm, dry_run=False):
        calls.append(kind)
        if kind == "travel":
            raise RuntimeError("boom")
        return {
            "ok": True,
            "kind": kind,
            "accepted": [],
            "claimed": [],
            "credit_delta": None,
            "energy_delta": None,
            "reason": None,
            "unjudged": False,
        }

    monkeypatch.setattr(sched, "_load_accounts_and_cooldowns", _fake_load)
    monkeypatch.setattr(cs.workbuddy_tasks, "run_family", _fake_run)
    await sched._workbuddy_task_sweep()

    last = sched.status()["wb_tasks"]["last_sweep"]
    assert last["errors"] == 1
    assert last["families"] == len(cs.workbuddy_tasks.SWEEP_ORDER) - 1
    # travel 之后的族仍被执行(顺序来自 SWEEP_ORDER 单一真源)
    assert calls[len(calls) - 1] == cs.workbuddy_tasks.SWEEP_ORDER[-1]
    assert last["note"] is None


async def test_wb_sweep_records_abort_note_on_outbound_pause_midway(monkeypatch):
    """跑到一半撞出站暂停 ⇒ 摘要写「中途中止」并立刻 return,不继续打网络。"""
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(cs.checkin_outbound_gate, "paused_remaining", lambda: 0.0)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_live_run", True)
    monkeypatch.setattr(cs.settings, "workbuddy_tasks_urgency_order", "none")
    monkeypatch.setattr(cs.random, "uniform", lambda a, b: 0.0)

    async def _fake_load(label):
        return ([{"id": 6, "platform": "workbuddy", "jwt": "j", "device_map": {}}], {})

    async def _fake_run(kind, jwt, dm, dry_run=False):
        raise cs.OutboundPaused(30.0)

    monkeypatch.setattr(sched, "_load_accounts_and_cooldowns", _fake_load)
    monkeypatch.setattr(cs.workbuddy_tasks, "run_family", _fake_run)
    await sched._workbuddy_task_sweep()

    last = sched.status()["wb_tasks"]["last_sweep"]
    assert last["note"] == "中途中止:出站限流"
    assert last["families"] == 0


# [IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
