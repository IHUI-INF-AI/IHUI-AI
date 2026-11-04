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
from datetime import UTC, date, datetime, timedelta
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


# ---------------------------------------------------------------------------
# 2026-11-04 缺陷修复:快照平台分支(minimax 不再打 Trae / qoder 用号池权威票)
# ---------------------------------------------------------------------------


class _SnapshotLogCapture:
    """捕获 structlog 日志(PrintLoggerFactory 直写 stderr,caplog 抓不到)。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, tuple[Any, ...], dict[str, Any]]] = []

    def _record(self, level: str) -> Any:
        def _inner(msg: Any, *args: Any, **kwargs: Any) -> None:
            self.calls.append((level, str(msg), args, kwargs))

        return _inner

    def __getattr__(self, name: str) -> Any:
        return self._record(name)

    def summary_counts(self) -> tuple[int, int, int, int, int]:
        """取汇总行 args:(总数, 成功, 失败, 冷却跳过, 无指标/未判定)。"""
        for _level, msg, args, _kw in reversed(self.calls):
            if "本轮积分快照完成" in msg:
                return tuple(args)  # type: ignore[return-value]
        raise AssertionError("未捕获到快照汇总日志")

    def has(self, level: str, keyword: str) -> bool:
        return any(lv == level and keyword in msg for lv, msg, _a, _k in self.calls)


def _patch_snapshot_store(
    monkeypatch: pytest.MonkeyPatch,
    accounts: list[dict[str, Any]],
    *,
    upserts: list[tuple[tuple[Any, ...], dict[str, Any]]] | None = None,
) -> None:
    """快照依赖的 store 打桩:不触 DB,只留 upsert 调用记录。"""

    async def fake_list_full() -> list[dict[str, Any]]:
        return accounts

    async def fake_cooldowns() -> dict[int, datetime]:
        return {}

    async def fake_sum(*_a: Any, **_k: Any) -> int:
        return 0

    async def fake_upsert(*a: Any, **k: Any) -> None:
        if upserts is not None:
            upserts.append((a, k))

    monkeypatch.setattr(checkin_store, "list_enabled_accounts_full", fake_list_full)
    monkeypatch.setattr(checkin_store, "get_active_cooldowns", fake_cooldowns)
    monkeypatch.setattr(checkin_store, "sum_credits_delta_for_day", fake_sum)
    monkeypatch.setattr(checkin_store, "upsert_credits_daily", fake_upsert)


async def test_credits_snapshot_minimax_queries_minimax_not_trae(monkeypatch):
    """缺陷 A①:minimax 账号必须走 MiniMax 状态查询,绝不打 Trae 余额端点。

    (改前:落 else 分支 => query_remaining_credits(Trae) = 每天 08:15 的 401)
    """
    accounts = [
        {
            "id": 12,
            "owner_user_id": "o1",
            "name": "minimax:cn",
            "jwt": "mm-jwt",
            "platform": "minimax",
            "device_map": {"uid": "u-mm"},
        }
    ]
    log = _SnapshotLogCapture()
    monkeypatch.setattr(cs, "logger", log)
    _patch_snapshot_store(monkeypatch, accounts)

    mm_calls: list[tuple[str, dict[str, Any]]] = []

    async def fake_mm(jwt: str, device_map: dict[str, Any], **_kw: Any) -> dict[str, Any]:
        mm_calls.append((jwt, dict(device_map)))
        return {"remaining": None, "error": None, "checked_days": [1]}

    async def forbidden_trae(jwt: str) -> dict[str, Any]:
        raise AssertionError("minimax 账号不得调用 Trae 余额端点")

    monkeypatch.setattr(cs.checkin_minimax, "minimax_query_credits", fake_mm)
    monkeypatch.setattr(cs.checkin_credits, "query_remaining_credits", forbidden_trae)

    await cs.checkin_scheduler._daily_credits_snapshot()

    assert mm_calls == [("mm-jwt", {"uid": "u-mm"})]


async def test_credits_snapshot_minimax_no_metric_is_neither_success_nor_failure(
    monkeypatch,
):
    """缺陷 A②:MiniMax 无余额端点(err/remaining 皆 None)⇒ 记「未判定」:
    不落快照(不伪装成功),也不计失败(不是 401)。"""
    accounts = [
        {
            "id": 12,
            "owner_user_id": "o1",
            "name": "minimax:cn",
            "jwt": "mm-jwt",
            "platform": "minimax",
            "device_map": {"uid": "u-mm"},
        }
    ]
    log = _SnapshotLogCapture()
    monkeypatch.setattr(cs, "logger", log)
    upserts: list[tuple[tuple[Any, ...], dict[str, Any]]] = []
    _patch_snapshot_store(monkeypatch, accounts, upserts=upserts)

    async def fake_mm(jwt: str, device_map: dict[str, Any], **_kw: Any) -> dict[str, Any]:
        return {"remaining": None, "error": None, "checked_days": [1]}

    monkeypatch.setattr(cs.checkin_minimax, "minimax_query_credits", fake_mm)

    await cs.checkin_scheduler._daily_credits_snapshot()

    total, ok, fail, skip, na = log.summary_counts()
    assert (total, ok, fail, skip, na) == (1, 0, 0, 0, 1)
    assert upserts == []  # 未判定不落快照(没有 remaining 可写)
    assert not log.has("warning", "积分查询失败")


async def test_credits_snapshot_minimax_real_error_still_counts_failure(monkeypatch):
    """护栏:真故障不许被「未判定」吞掉 —— err 有值时仍按失败计。"""
    accounts = [
        {
            "id": 12,
            "owner_user_id": "o1",
            "name": "minimax:cn",
            "jwt": "mm-jwt",
            "platform": "minimax",
            "device_map": {"uid": "u-mm"},
        }
    ]
    log = _SnapshotLogCapture()
    monkeypatch.setattr(cs, "logger", log)
    _patch_snapshot_store(monkeypatch, accounts)

    async def fake_mm(jwt: str, device_map: dict[str, Any], **_kw: Any) -> dict[str, Any]:
        return {"remaining": None, "error": "token 无效或过期(401/403),请重新捕获"}

    monkeypatch.setattr(cs.checkin_minimax, "minimax_query_credits", fake_mm)

    await cs.checkin_scheduler._daily_credits_snapshot()

    total, ok, fail, skip, na = log.summary_counts()
    assert (total, ok, fail, skip, na) == (1, 0, 1, 0, 0)
    assert log.has("warning", "积分查询失败")


async def test_credits_snapshot_qoder_prefers_pool_cred(monkeypatch):
    """缺陷 B③:qoder 快照优先用号池权威票(本地旧票必 401 的夹具有号池票即成功)。"""
    accounts = [
        {
            "id": 18,
            "owner_user_id": "o1",
            "name": "Qoder-019f17c6",
            "jwt": "stale-local-jwt",
            "platform": "qoder",
            "device_map": {"uid": "u18"},
        }
    ]
    log = _SnapshotLogCapture()
    monkeypatch.setattr(cs, "logger", log)
    upserts: list[tuple[tuple[Any, ...], dict[str, Any]]] = []
    _patch_snapshot_store(monkeypatch, accounts, upserts=upserts)

    async def fake_load_cred(uid: str) -> dict[str, Any] | None:
        assert uid == "u18"
        return {
            "token": "pool-jwt",
            "refresh_token": "pool-rt",
            "expires_at": 1700000000,
            "cosy": {"machine_id": "m1"},
        }

    used_tokens: list[str] = []
    saved_maps: list[dict[str, Any]] = []

    async def fake_qoder_query(jwt: str, device_map: dict[str, Any], **_kw: Any) -> dict[str, Any]:
        used_tokens.append(jwt)
        if jwt != "pool-jwt":  # 本地旧票 = 死票(实测 401)
            return {"remaining": None, "packs": [], "error": "余额接口 HTTP 401"}
        return {"remaining": 100, "packs": [], "error": None}

    async def fake_save_map(account_id: int, device_map: dict[str, Any]) -> None:
        saved_maps.append({"id": account_id, **device_map})

    monkeypatch.setattr(checkin_store, "load_qoder_cred", fake_load_cred)
    monkeypatch.setattr(cs.checkin_qoder, "qoder_query_credits", fake_qoder_query)
    monkeypatch.setattr(checkin_store, "save_device_map", fake_save_map)

    await cs.checkin_scheduler._daily_credits_snapshot()

    assert used_tokens == ["pool-jwt"]  # 号池票唯一被使用,旧本地票一发未打
    total, ok, fail, skip, na = log.summary_counts()
    assert (total, ok, fail, skip, na) == (1, 1, 0, 0, 0)
    assert upserts and upserts[0][0][3] == 100  # (account_id, owner, day, remaining, gained)
    # 号池票的 refresh_token/expires_at/cosy 一并覆盖进持久化的 device_map
    assert saved_maps[0]["refresh_token"] == "pool-rt"
    assert saved_maps[0]["expires_at"] == 1700000000
    assert saved_maps[0]["cosy"]["machine_id"] == "m1"


async def test_credits_snapshot_qoder_without_pool_cred_is_undetermined(monkeypatch):
    """缺陷 B④:号池取不到票 ⇒ 记「未判定」:不拿未确认权威的本地票去打鉴权点,
    也不把没判过的结果写成 ok 或 401 失败。"""
    accounts = [
        {
            "id": 18,
            "owner_user_id": "o1",
            "name": "Qoder-019f17c6",
            "jwt": "stale-local-jwt",
            "platform": "qoder",
            "device_map": {"uid": "u18"},
        }
    ]
    log = _SnapshotLogCapture()
    monkeypatch.setattr(cs, "logger", log)
    upserts: list[tuple[tuple[Any, ...], dict[str, Any]]] = []
    _patch_snapshot_store(monkeypatch, accounts, upserts=upserts)

    async def fake_load_cred(uid: str) -> dict[str, Any] | None:
        return None

    async def forbidden_qoder_query(
        jwt: str, device_map: dict[str, Any], **_kw: Any
    ) -> dict[str, Any]:
        raise AssertionError("号池无权威票时不得拿本地票查余额")

    monkeypatch.setattr(checkin_store, "load_qoder_cred", fake_load_cred)
    monkeypatch.setattr(cs.checkin_qoder, "qoder_query_credits", forbidden_qoder_query)

    await cs.checkin_scheduler._daily_credits_snapshot()

    total, ok, fail, skip, na = log.summary_counts()
    assert (total, ok, fail, skip, na) == (1, 0, 0, 0, 1)
    assert upserts == []
    assert log.has("warning", "号池无权威票")


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
    """临期(<24h)即使探活通过也要重抽,提前换新。

    2026-11-01 补:本用例此前**只桩了取数/探活/抽取,没桩 save_device_map 与
    clear_open_cooldowns** —— 于是 `_sync_workbuddy_local` 真的写库,假行 `id=7`
    正好命中真库里的 qoder 号池账号,把它的 device_map 整体换成 WorkBuddy 测试
    数据(pool_account_id / pool_uid / pool_cred_version 全丢,对账从此认不回该号)。
    凡是"走到落库"的用例都必须桩住落库,否则测试库/生产库同 DSN 时就是一次写穿。
    """
    sched = cs.CheckinScheduler()
    rows = _wb_rows({"uid": "u1", "web_cookie": "session=ok", "web_cookie_expires_at": int(time.time()) + 3600})
    extracts: list[Any] = []
    saves: list[tuple[int, dict[str, Any]]] = []
    cleared: list[int] = []

    async def fake_list(platform: str):
        return rows

    async def fake_session(cookie: str, dm: dict[str, Any]):
        return True, "u1", 200

    async def fake_extract():
        extracts.append(1)
        return {"cookie": "session=ok", "user_agent": "UA", "expires_at": 1}

    async def fake_save(account_id: int, dm: dict[str, Any]):
        saves.append((account_id, dict(dm)))

    async def fake_clear(account_id: int):
        cleared.append(account_id)

    monkeypatch.setattr(checkin_store, "list_accounts_by_platform", fake_list)
    monkeypatch.setattr(cs.checkin_workbuddy, "workbuddy_check_session", fake_session)
    monkeypatch.setattr(cs.checkin_workbuddy_local, "extract_workbuddy_cookie", fake_extract)
    monkeypatch.setattr(checkin_store, "save_device_map", fake_save)
    monkeypatch.setattr(checkin_store, "clear_open_cooldowns", fake_clear)
    await sched._sync_workbuddy_local()
    assert extracts == [1]
    # 落库内容也要断言:只验"抽取被触发"会让真写库的内容完全失控(事故成因)
    assert len(saves) == 1 and saves[0][0] == 7
    assert saves[0][1]["web_cookie"] == "session=ok"
    assert saves[0][1]["user_agent"] == "UA"
    assert "web_cookie_synced_at" in saves[0][1]
    assert cleared == [7]


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


# ---------------------------------------------------------------------------
# Qoder 补跑轮(2026-11-01)
# 立因:活动由上游在 10:00 之后**异步下发**。当日 10:07 全池 8 个号一致返回
# 「活动未下发或已结束」,12:53 同票同 uid 已是 CLAIMABLE ⇒ 10:05 单跑一次会
# 整池空手。补跑轮只挑「今日还没有确定结果」的号,冷却/全局闸门/错峰一概照旧。
# ---------------------------------------------------------------------------


class _SpyLogger:
    """logger 替身:structlog 用 PrintLogger 直写 stderr,caplog 抓不到,只能接管。"""

    def __init__(self) -> None:
        self.records: list[tuple[str, str]] = []

    def _emit(self, level: str, args: tuple[Any, ...]) -> None:
        msg = str(args[0]) if args else ""
        if len(args) > 1:
            try:
                msg = msg % args[1:]
            except (TypeError, ValueError):
                msg = " ".join(str(a) for a in args)
        self.records.append((level, msg))

    def info(self, *args: Any, **kwargs: Any) -> None:
        self._emit("info", args)

    def warning(self, *args: Any, **kwargs: Any) -> None:
        self._emit("warning", args)

    def events(self, level: str | None = None) -> list[str]:
        return [m for lv, m in self.records if level is None or lv == level]


def _qoder_acc(aid: int) -> dict[str, Any]:
    return {"id": aid, "name": f"q{aid}", "jwt": f"j{aid}", "platform": "qoder", "device_map": {}}


def _stub_retry_deps(
    monkeypatch: pytest.MonkeyPatch,
    sched: Any,
    accounts: list[dict[str, Any]],
    records: list[dict[str, Any]],
) -> tuple[list[list[dict[str, Any]]], dict[str, Any]]:
    """把账号/记录读口与 _run_batch 换成替身,返回 (每批收到的账号, 观测槽)。

    _run_batch 是真风控入口(冷却/闸门/错峰都在里面),替身只记录**是否被调用**与
    收到了哪些账号;因此断言"进了批"等价于断言风控语义仍走原路。
    """

    async def _load(label: str) -> tuple[list[dict[str, Any]], dict[int, datetime]]:
        return accounts, {}

    async def _records(since: datetime) -> list[dict[str, Any]]:
        slot["since"] = since
        return records

    batches: list[list[dict[str, Any]]] = []
    slot: dict[str, Any] = {}

    async def _batch(
        acc_list: list[dict[str, Any]], cooldowns: dict[int, datetime], label: str
    ) -> None:
        batches.append(acc_list)
        slot["label"] = label

    monkeypatch.setattr(sched, "_load_accounts_and_cooldowns", _load)
    monkeypatch.setattr(checkin_store, "list_records_since", _records)
    monkeypatch.setattr(sched, "_run_batch", _batch)
    return batches, slot


async def test_qoder_retry_filters_today_settled_accounts(monkeypatch):
    """今日已有 ok=true 的号排除;只有失败记录/无记录/昨天成功的号进补跑批。"""
    monkeypatch.setattr(cs, "logger", _SpyLogger())
    sched = cs.CheckinScheduler()
    now = datetime.now(UTC)
    accounts = [
        _qoder_acc(1),  # 今日已领 → 排除
        _qoder_acc(2),  # 今日失败 → 补
        _qoder_acc(3),  # 今日无记录 → 补
        _qoder_acc(4),  # 只有昨天的成功 → 补(昨天的不算今天)
        _full_acc(9, "trae-号"),  # 非 qoder:绝不进 Qoder 腿
    ]
    records = [
        {"id": 1, "account_id": 1, "ok": True, "created_at": now},
        {"id": 2, "account_id": 2, "ok": False, "created_at": now},
        {"id": 3, "account_id": 4, "ok": True, "created_at": now - timedelta(days=2)},
    ]
    batches, slot = _stub_retry_deps(monkeypatch, sched, accounts, records)

    await sched._daily_run_qoder_retry()

    assert len(batches) == 1
    assert [a["id"] for a in batches[0]] == [2, 3, 4]
    assert slot["label"] == "Qoder补跑"


async def test_qoder_retry_no_pending_skips_batch(monkeypatch):
    """全部号今日已有结果 ⇒ 一行日志直接 return,不跑空批(_run_batch 一次都不进)。"""
    spy = _SpyLogger()
    monkeypatch.setattr(cs, "logger", spy)
    sched = cs.CheckinScheduler()
    now = datetime.now(UTC)
    accounts = [_qoder_acc(1), _qoder_acc(2)]
    records = [
        {"id": 1, "account_id": 1, "ok": True, "created_at": now},
        {"id": 2, "account_id": 2, "ok": True, "created_at": now},
    ]
    batches, _slot = _stub_retry_deps(monkeypatch, sched, accounts, records)

    await sched._daily_run_qoder_retry()

    assert batches == []  # 不跑空批
    assert any("补跑轮无待补账号" in m for m in spy.events())


async def test_qoder_retry_caps_round_at_200(monkeypatch):
    """单轮最多 200 个号(防异常数据把上游一轮打爆),超出的顺延并报数。"""
    spy = _SpyLogger()
    monkeypatch.setattr(cs, "logger", spy)
    sched = cs.CheckinScheduler()
    accounts = [_qoder_acc(i) for i in range(1, 251)]  # 250 个待补
    batches, _slot = _stub_retry_deps(monkeypatch, sched, accounts, [])

    await sched._daily_run_qoder_retry()

    assert len(batches) == 1
    assert len(batches[0]) == cs._QODER_RETRY_MAX_PER_ROUND == 200
    assert [a["id"] for a in batches[0]] == list(range(1, 201))  # 截断取前 200
    warnings = spy.events("warning")
    assert any("250" in m and "200" in m for m in warnings)  # 报数:待补 250 / 上限 200


def test_qoder_retry_times_parsing(monkeypatch):
    """合法 "11:00,12:30" → 2 条;非法 "25:00,abc" → 全忽略且不抛异常。"""
    monkeypatch.setenv("CHECKIN_QODER_RETRY_TIMES", "11:00,12:30")
    assert cs._qoder_retry_times() == [(11, 0), (12, 30)]

    spy = _SpyLogger()
    monkeypatch.setattr(cs, "logger", spy)
    monkeypatch.setenv("CHECKIN_QODER_RETRY_TIMES", "25:00,abc")  # 越界 + 非时刻
    assert cs._qoder_retry_times() == []  # 整条忽略,不抛
    assert len(spy.events("warning")) == 2  # 每条非法各告警一次(不静默吞掉)

    monkeypatch.setenv("CHECKIN_QODER_RETRY_TIMES", "11:00,11:00,7:5")
    assert cs._qoder_retry_times() == [(11, 0)]  # 去重保序;7:5 分钟不两位 → 忽略

    monkeypatch.delenv("CHECKIN_QODER_RETRY_TIMES")
    assert cs._qoder_retry_times() == [(11, 0), (12, 30)]  # 默认 11:00 / 12:30


async def test_qoder_retry_uses_shanghai_natural_day(monkeypatch):
    """今日判定按 Asia/Shanghai 自然日,不是 UTC 日(跨 UTC 日界实证)。

    UTC 2026-11-01T15:30Z == 北京 11-01 23:30 ⇒ 算「今天」;
    UTC 2026-11-01T16:30Z == 北京 11-02 00:30 ⇒ 已算「明天」。
    按 UTC 折日会把 00:00~08:00 的记录算到前一天,补跑就会对着今天已领的号再打。
    """
    late_today = datetime(2026, 11, 1, 15, 30, tzinfo=UTC)
    past_midnight = datetime(2026, 11, 1, 16, 30, tzinfo=UTC)

    assert cs._cn_day(late_today) == date(2026, 11, 1)
    assert cs._cn_day(past_midnight) == date(2026, 11, 2)
    # 北京某日 00:00 == 前一日 16:00 UTC(16:00Z 才是换日点)
    assert cs._cn_day_start(date(2026, 11, 1)) == datetime(2026, 10, 31, 16, 0, tzinfo=UTC)

    # 同一条记录,折日不同结论不同:15:30Z 是 11-01 的、16:30Z 是 11-02 的
    assert cs._settled_today({"ok": True, "created_at": late_today}, date(2026, 11, 1)) is True
    assert cs._settled_today({"ok": True, "created_at": past_midnight}, date(2026, 11, 1)) is False
    assert cs._settled_today({"ok": True, "created_at": past_midnight}, date(2026, 11, 2)) is True

    # 端到端:补跑轮交给 store 的查询下界 == 北京当日 00:00(+08:00),不是 UTC 00:00
    monkeypatch.setattr(cs, "logger", _SpyLogger())
    sched = cs.CheckinScheduler()
    batches, slot = _stub_retry_deps(monkeypatch, sched, [_qoder_acc(1)], [])
    await sched._daily_run_qoder_retry()
    assert len(batches) == 1
    since = slot["since"]
    assert (since.hour, since.minute) == (0, 0)
    assert since.utcoffset() == timedelta(hours=8)
    assert cs._cn_day(since) == cs._cn_day(datetime.now(UTC))


async def test_qoder_retry_skips_when_previous_round_still_running(monkeypatch):
    """上一轮还没跑完(200 号 × 错峰可能跨过下一个补跑时刻)⇒ 本轮整轮跳过,不叠打。"""
    spy = _SpyLogger()
    monkeypatch.setattr(cs, "logger", spy)
    sched = cs.CheckinScheduler()
    batches, _slot = _stub_retry_deps(monkeypatch, sched, [_qoder_acc(1)], [])
    sched._qoder_retry_running = True  # 模拟上一轮仍在跑

    await sched._daily_run_qoder_retry()

    assert batches == []
    assert any("仍在跑" in m for m in spy.events("warning"))

    sched._qoder_retry_running = False
    await sched._daily_run_qoder_retry()
    assert len(batches) == 1
    assert sched._qoder_retry_running is False  # 跑完即解锁(异常也不会卡死)

    async def _boom(*_a: Any) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(sched, "_run_batch", _boom)
    with pytest.raises(RuntimeError):
        await sched._daily_run_qoder_retry()
    assert sched._qoder_retry_running is False  # finally 解锁


async def test_midnight_job_registered_reuses_daily_run(monkeypatch):
    """零点窗口(2026-11-04):00:05 job 存在、复用 _daily_run、8:05 主窗口未动。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    monkeypatch.setattr(cs, "AsyncIOScheduler", _FakeAsyncIOScheduler)
    monkeypatch.setattr(cs.checkin_store, "ensure_tables", _noop_async)
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(sched, "_restore_outbound_pause", _noop_async)
    await sched.start()

    jobs = sched._scheduler.jobs  # type: ignore[union-attr]
    # ① 0:05 job 真注册,且与主窗口同一 jitter;主窗口仍是 8:05(不许被挪成 0:05)
    mid = jobs[cs._JOB_ID_MIDNIGHT]
    assert cs._job_cron_expr(mid["trigger"]) == "5 0 * * *"
    assert mid["trigger"].jitter == cs._CRON_JITTER
    assert mid["func"] == sched._daily_run_midnight
    main = jobs[cs._JOB_ID]
    assert cs._job_cron_expr(main["trigger"]) == "5 8 * * *"
    # 复用同一腿:零点入口只是带标签调用 _daily_run(不改业务逻辑)
    labels: list[str] = []

    async def _fake_daily_run(label: str = "主窗口") -> None:
        labels.append(label)

    monkeypatch.setattr(sched, "_daily_run", _fake_daily_run)
    await sched._daily_run_midnight()
    assert labels == ["零点窗口"]
    # ③ status() 暴露下次零点窗口时刻(与 next_run 同级)
    st = sched.status()
    assert st["next_run_midnight"] is not None
    assert datetime.fromisoformat(st["next_run_midnight"]).hour == 0
    await sched.stop()
    assert sched.status()["next_run_midnight"] is None


async def test_midnight_run_excludes_qoder(monkeypatch):
    """② 零点窗口的目标集不含 Qoder(Qoder 只走 10:05/补跑),轮次标签为「零点窗口」。"""
    sched = cs.CheckinScheduler()
    seen: dict[str, Any] = {}

    async def _fake_load(label: str) -> tuple[list[dict[str, Any]], dict[int, datetime]]:
        return [_acc(1, "trae"), _acc(2, "qoder"), _acc(3, "workbuddy")], {}

    async def _fake_run(accounts: list[dict[str, Any]], cooldowns: Any, label: str) -> None:
        seen["ids"] = [a["id"] for a in accounts]
        seen["label"] = label

    monkeypatch.setattr(sched, "_load_accounts_and_cooldowns", _fake_load)
    monkeypatch.setattr(sched, "_run_batch", _fake_run)
    await sched._daily_run_midnight()
    assert 2 not in seen["ids"]  # Qoder 绝不进零点窗口
    assert seen["ids"] == [1, 3]
    assert seen["label"] == "零点窗口"


async def test_qoder_retry_jobs_registered_and_status_exposed(monkeypatch):
    """start() 按 env 逐个注册补跑 job(带同一 jitter),status() 暴露下次补跑时刻。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    monkeypatch.setenv("CHECKIN_QODER_RETRY_TIMES", "11:00,12:30")
    monkeypatch.setattr(cs, "AsyncIOScheduler", _FakeAsyncIOScheduler)
    monkeypatch.setattr(cs.checkin_store, "ensure_tables", _noop_async)
    sched = cs.CheckinScheduler()
    monkeypatch.setattr(sched, "_restore_outbound_pause", _noop_async)
    await sched.start()

    jobs = sched._scheduler.jobs  # type: ignore[union-attr]
    for hour, minute in ((11, 0), (12, 30)):
        entry = jobs[cs._qoder_retry_job_id(hour, minute)]
        assert entry["func"] == sched._daily_run_qoder_retry  # 同一补跑腿
        assert entry["trigger"].jitter == cs._CRON_JITTER  # 与其它 job 同一漂移
    st = sched.status()
    assert st["next_run_qoder_retry"] is not None
    assert st["next_run_qoder"] is not None  # 既有键不破
    await sched.stop()
    assert cs.CheckinScheduler().status()["next_run_qoder_retry"] is None


async def test_start_disabled_registers_no_jobs(monkeypatch):
    """总闸关 ⇒ start() 直接返回:不建表、不建调度器、零 job,status 如实报 cron_enabled=False。

    反向例(2026-11-03 补):此前只有「开关 true 时注册了哪些 job」的正向用例,
    没有「开关 false 时一个 job 都不许注册」的硬断言,关闸回归会静默放行。
    """
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "false")
    monkeypatch.setattr(cs, "AsyncIOScheduler", _FakeAsyncIOScheduler)
    ensure_calls: list[int] = []

    async def _ensure() -> None:
        ensure_calls.append(1)

    monkeypatch.setattr(cs.checkin_store, "ensure_tables", _ensure)
    sched = cs.CheckinScheduler()
    await sched.start()

    assert sched._started is False
    assert sched._scheduler is None  # 连调度器实例都不许建
    assert ensure_calls == []  # 关闸时不做任何建表/网络动作
    st = sched.status()
    assert st["cron_enabled"] is False
    assert st["enabled"] is False
    assert st["next_run"] is None
    assert st["next_run_qoder"] is None


# [IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
