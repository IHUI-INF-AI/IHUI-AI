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

from datetime import UTC, datetime, timedelta
from typing import Any

from app.services import checkin_scheduler as cs
from app.services import checkin_store
from app.services.checkin_outbound import checkin_outbound_gate
from app.services.checkin_scheduler import partition_platforms


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
# [IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
