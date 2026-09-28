# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-702: 读失败不得固化成"权威的空"(两条成对验收夹具,2026-09-29 立)。

- ab_test_tracker._ensure_loaded:注入一次读取异常 ⇒ `_loaded` 仍为 False,
  且退避窗口过去后的第二次调用**真的重试**(旧实现 `finally: self._loaded = True`
  把一次瞬时故障永久固化成"确实没有",且不再重试);
- 读到空表 ⇒ 标记已加载、此后不再打 DB(权威的空**允许**固化)——与上一条成对。
- agent_card._scope_meta_index:"读不到"与"读到但为空"返回值可区分 ({}, False) vs ({}, True)。
全程 mock pool(conftest autouse `_isolate_ab_test_db` 是全局兜底,用例再显式注入自己的),
不触生产 PG 8810 / Redis 8811。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from app.services import ab_test_tracker as att_mod
from app.services.ab_test_tracker import ABTestTracker
from app.services.agent_card import _scope_meta_index


class _FakeConn:
    """fetch 按 outcomes 序列给出;Exception 项抛错;序列耗尽 ⇒ AssertionError.

    "耗尽即抛"是判据的一部分:loaded 之后任何多余的 DB 调用都必须炸出来,
    而不是静默返回空 —— 后者正好复刻本票要防的"把没读到当读到空"。
    """

    def __init__(self, outcomes: list[Any]) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0

    async def fetch(self, *args: Any) -> list[Any]:
        self.calls += 1
        if not self._outcomes:
            raise AssertionError("fetch 在已无预设结果时被再次调用(不应再打 DB)")
        out = self._outcomes.pop(0)
        if isinstance(out, BaseException):
            raise out
        return out


class _AcquireCtx:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *exc: object) -> bool:
        return False


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _AcquireCtx:
        return _AcquireCtx(self._conn)


class _FakeClock:
    """替换 att_mod._monotonic:模拟退避时间流逝,不真 sleep。"""

    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds


def _inject(monkeypatch: pytest.MonkeyPatch, conn: _FakeConn) -> _FakeClock:
    clock = _FakeClock()
    monkeypatch.setattr(att_mod, "_monotonic", clock)

    async def _get_pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(att_mod, "_get_pool", _get_pool)
    return clock


async def test_ab_read_failure_is_not_frozen_and_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    """成对①:一次读失败 ⇒ 不置 loaded;退避窗口内不打 DB;窗口过后第二次调用真重试。"""
    conn = _FakeConn([ConnectionError("transient db down"), []])
    clock = _inject(monkeypatch, conn)
    t = ABTestTracker()

    # 全新实例的第三态:从未尝试(与"读失败"与"已固化"三者互不冒充)
    assert t.get_status()["loadState"] == "never_tried"

    await t._ensure_loaded()
    assert conn.calls == 1
    # 核心断言(旧实现在这里 _loaded 已被 finally 置 True):读失败不得置 loaded
    assert t._loaded is False
    assert t._load_failures == 1
    status = t.get_status()
    assert status["loaded"] is False
    assert status["loadFailures"] == 1
    assert status["loadState"] == "retry_backoff"

    # 有界退避:窗口内反复调用也不得打爆 IO
    await t._ensure_loaded()
    await t._ensure_loaded()
    assert conn.calls == 1

    # 窗口过后 ⇒ 真的重试,并且这次读成功(空表)可以固化
    clock.advance(att_mod._LOAD_BACKOFF_BASE_S + 0.01)
    await t._ensure_loaded()
    assert conn.calls == 2
    assert t._loaded is True
    assert t._load_failures == 0
    assert t.get_status()["loadState"] == "loaded"


async def test_ab_read_empty_table_frozen_no_more_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    """成对②:读到空表(成功)⇒ 固化 loaded,后续调用零次再打 DB。"""
    conn = _FakeConn([[]])
    clock = _inject(monkeypatch, conn)
    t = ABTestTracker()

    await t._ensure_loaded()
    assert t._loaded is True
    assert conn.calls == 1

    clock.advance(10_000.0)  # 远过任何退避档
    await t._ensure_loaded()
    await t._ensure_loaded()
    assert conn.calls == 1
    assert t.get_status()["loadState"] == "loaded"


async def test_ab_backoff_is_bounded_then_gives_up_without_faking_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """失败计数到上限 ⇒ 停止自动重试(有界),但状态仍是"读不到",不得装成已加载。"""
    max_failures = att_mod._LOAD_MAX_CONSECUTIVE_FAILURES
    conn = _FakeConn([ConnectionError(f"db down #{i}") for i in range(max_failures)])
    clock = _inject(monkeypatch, conn)
    t = ABTestTracker()

    for _ in range(max_failures):
        clock.advance(att_mod._LOAD_BACKOFF_MAX_S + 1.0)  # 每次都跨过退避窗口
        await t._ensure_loaded()
    assert conn.calls == max_failures
    assert t._loaded is False
    assert t._load_failures == max_failures

    # 放弃后:不再打 DB(有界),但 loaded 仍 False —— "试了 N 次都失败"≠"没有数据"
    clock.advance(att_mod._LOAD_BACKOFF_MAX_S + 1.0)
    await t._ensure_loaded()
    assert conn.calls == max_failures
    status = t.get_status()
    assert status["loaded"] is False
    assert status["loadState"] == "gave_up"


async def test_ab_try_load_distinguishes_failure_from_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """三态出口:_try_load_active_tests 用二元组分开"读不到"与"读到但为空"。"""
    conn = _FakeConn([ConnectionError("db down"), []])
    _inject(monkeypatch, conn)
    t = ABTestTracker()

    ok, count = await t._try_load_active_tests()
    assert (ok, count) == (False, 0)  # 读不到
    ok2, count2 = await t._try_load_active_tests()
    assert (ok2, count2) == (True, 0)  # 读到空表 —— 条数同、语义不同

    # 公开投影保持旧语义(兼容既有测试对 load_active_tests 返回 0 的断言)
    assert await t.load_active_tests() == 0


def test_agent_card_read_failure_differs_from_authoritative_empty(tmp_path: Path) -> None:
    """_scope_meta_index 三态:读不到 ⇒ ({}, False);读到但无条目 ⇒ ({}, True)。"""
    missing = tmp_path / "no-such.json"
    assert _scope_meta_index(missing) == ({}, False)

    broken = tmp_path / "broken.json"
    broken.write_text("{ not json", encoding="utf-8")
    assert _scope_meta_index(broken) == ({}, False)

    wrong_shape = tmp_path / "shape.json"
    wrong_shape.write_text('{"capabilities": {"x": 1}}', encoding="utf-8")
    assert _scope_meta_index(wrong_shape) == ({}, False)

    empty_but_real = tmp_path / "empty.json"
    empty_but_real.write_text('{"capabilities": []}', encoding="utf-8")
    assert _scope_meta_index(empty_but_real) == ({}, True)  # 权威的空,可固化

    with_entries = tmp_path / "ok.json"
    with_entries.write_text(
        '{"capabilities": [{"scope": "files:read", "description": "d", "domain": "x"}]}',
        encoding="utf-8",
    )
    index, ok = _scope_meta_index(with_entries)
    assert ok is True and "files:read" in index
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
