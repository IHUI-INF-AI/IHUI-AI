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

import inspect
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest

from app.services import ab_test_tracker as att_mod
from app.services import federated_learner as fed_mod
from app.services import memory_decay as md_mod
from app.services import meta_learner as meta_mod
from app.services import user_profile as up_mod
from app.services._load_lifecycle import LOAD_BACKOFF_BASE_S as _BASE_S
from app.services._load_lifecycle import LOAD_BACKOFF_MAX_S as _MAX_S
from app.services.ab_test_tracker import ABTestTracker
from app.services.agent_card import _scope_meta_index
from app.services.federated_learner import FederatedLearner
from app.services.memory_decay import MemoryDecayManager
from app.services.meta_learner import MetaLearner
from app.services.user_profile import UserProfileBuilder


class _FakeConn:
    """fetch 按 outcomes 序列给出;Exception 项抛错;序列耗尽 ⇒ AssertionError.

    "耗尽即抛"是判据的一部分:loaded 之后任何多余的 DB 调用都必须炸出来,
    而不是静默返回空 —— 后者正好复刻本票要防的"把没读到当读到空"。
    """

    def __init__(self, outcomes: list[Any]) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0

    def _pop(self, kind: str) -> Any:
        self.calls += 1
        if not self._outcomes:
            raise AssertionError(
                f"{kind} 在已无预设结果时被再次调用(不应再打 DB)"
            )
        out = self._outcomes.pop(0)
        if isinstance(out, BaseException):
            raise out
        return out

    async def fetch(self, *args: Any) -> list[Any]:
        return self._pop("fetch")

    async def fetchrow(self, *args: Any) -> Any:
        return self._pop("fetchrow")

    async def execute(self, *args: Any) -> None:
        """DDL / 自愈建表通道:不消耗预设、不计入 calls。

        用例断言的是"读了几次数据",建表这类写操作不得混进计数里。
        """
        return None


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

# ======================================================================
# G-748(2026-09-29):同族 4 处"读失败也置已加载"收到**同一份**判据上。
# 语义与上面 ab_test_tracker 那两条成对验收逐字同形:
#   ① 注入一次读异常 ⇒ 该对象仍**非** loaded,退避窗口过后真重试并固化;
#   ② 正向对照:读到空结果 ⇒ 置 loaded 且此后不再打库(权威的空允许固化)。
# 全程注入假连接,零 DB 句柄(conftest 的 autouse 兜底之外再显式注入自己的)。
# ======================================================================


def _inject_for(monkeypatch: pytest.MonkeyPatch, *mods: Any, conn: _FakeConn) -> _FakeClock:
    """把 _get_pool / _monotonic 换成假件;_monotonic 是各模块自己的别名绑定,可分块替换。"""
    clock = _FakeClock()
    for mod in mods:
        monkeypatch.setattr(mod, "_monotonic", clock)

        async def _get_pool() -> _FakePool:
            return _FakePool(conn)

        monkeypatch.setattr(mod, "_get_pool", _get_pool)
    return clock


async def test_federated_read_failure_is_not_frozen_and_retried(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对①(联邦):一次读失败 ⇒ 不置 loaded;窗口内不打库;窗口过后真重试并固化。"""
    conn = _FakeConn([ConnectionError("transient db down"), []])
    clock = _inject_for(monkeypatch, fed_mod, conn=conn)
    fl = FederatedLearner()

    await fl._ensure_loaded()
    assert conn.calls == 1
    assert fl._loaded is False  # 旧实现在这里已被 finally 置 True
    assert fl._load_failures == 1

    await fl._ensure_loaded()
    await fl._ensure_loaded()
    assert conn.calls == 1  # 退避窗口内:不得打爆 IO

    clock.advance(_BASE_S + 0.01)
    await fl._ensure_loaded()
    assert conn.calls == 2
    assert fl._loaded is True
    assert fl._load_failures == 0


async def test_federated_authoritative_empty_freezes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对②(联邦):读到空表 ⇒ 固化 loaded,后续零次再打库。"""
    conn = _FakeConn([[]])
    clock = _inject_for(monkeypatch, fed_mod, conn=conn)
    fl = FederatedLearner()

    await fl._ensure_loaded()
    assert fl._loaded is True
    assert conn.calls == 1

    clock.advance(10_000.0)
    await fl._ensure_loaded()
    await fl._ensure_loaded()
    assert conn.calls == 1


async def test_meta_read_failure_is_not_frozen_and_retried(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对①(元学习):建表后读失败 ⇒ 不固化;窗口过后真重试。"""
    conn = _FakeConn([ConnectionError("transient db down"), []])
    clock = _inject_for(monkeypatch, meta_mod, conn=conn)
    ml = MetaLearner()

    await ml._ensure_loaded()
    assert conn.calls == 1
    assert ml._loaded is False
    assert ml._load_failures == 1

    await ml._ensure_loaded()
    assert conn.calls == 1

    clock.advance(_BASE_S + 0.01)
    await ml._ensure_loaded()
    assert conn.calls == 2
    assert ml._loaded is True
    assert ml._load_failures == 0


async def test_meta_authoritative_empty_freezes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对②(元学习):空表 ⇒ loaded 且不再打库。"""
    conn = _FakeConn([[]])
    clock = _inject_for(monkeypatch, meta_mod, conn=conn)
    ml = MetaLearner()

    await ml._ensure_loaded()
    assert ml._loaded is True
    assert conn.calls == 1

    clock.advance(10_000.0)
    await ml._ensure_loaded()
    assert conn.calls == 1


async def test_memory_decay_read_failure_is_not_frozen_and_retried(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对①(衰减状态):某用户一次读失败 ⇒ 该用户记录仍非 loaded;窗口过后真重试。"""
    uid = str(uuid4())
    conn = _FakeConn([ConnectionError("transient db down"), []])
    clock = _inject_for(monkeypatch, md_mod, conn=conn)
    md = MemoryDecayManager()

    await md._ensure_loaded(uid)
    rec = md._load_records[uid]
    assert conn.calls == 1
    assert rec.loaded is False  # 旧实现在这里已 add 进 _loaded_users,余生不再重试
    assert rec.failures == 1
    assert rec.state_label() in ("retry_backoff",)

    await md._ensure_loaded(uid)
    assert conn.calls == 1

    clock.advance(_BASE_S + 0.01)
    await md._ensure_loaded(uid)
    assert conn.calls == 2
    assert rec.loaded is True
    assert rec.failures == 0


async def test_memory_decay_authoritative_empty_freezes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对②(衰减状态):该用户确无状态行 ⇒ 固化,后续不再打库。"""
    uid = str(uuid4())
    conn = _FakeConn([[]])
    clock = _inject_for(monkeypatch, md_mod, conn=conn)
    md = MemoryDecayManager()

    await md._ensure_loaded(uid)
    assert md._load_records[uid].loaded is True
    assert conn.calls == 1

    clock.advance(10_000.0)
    await md._ensure_loaded(uid)
    await md._ensure_loaded(uid)
    assert conn.calls == 1


async def test_user_profile_read_failure_is_not_frozen_and_retried(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对①(用户画像):fetchrow 抛 ⇒ 该用户仍非 loaded;窗口过后真重试并固化。"""
    uid = str(uuid4())
    conn = _FakeConn([ConnectionError("transient db down"), None])
    clock = _inject_for(monkeypatch, up_mod, conn=conn)
    up = UserProfileBuilder()

    await up._ensure_loaded(uid)
    rec = up._load_records[uid]
    assert conn.calls == 1
    assert rec.loaded is False
    assert rec.failures == 1

    await up._ensure_loaded(uid)
    assert conn.calls == 1

    clock.advance(_BASE_S + 0.01)
    await up._ensure_loaded(uid)
    assert conn.calls == 2
    assert rec.loaded is True  # 第二次读到"该行不存在"= 权威的空,允许固化


async def test_user_profile_authoritative_empty_freezes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """成对②(用户画像):无画像行 ⇒ 固化;损坏 JSON 则**不得**固化。"""
    ok_uid = str(uuid4())
    conn = _FakeConn([None])
    clock = _inject_for(monkeypatch, up_mod, conn=conn)
    up = UserProfileBuilder()

    await up._ensure_loaded(ok_uid)
    assert up._load_records[ok_uid].loaded is True
    assert conn.calls == 1

    clock.advance(10_000.0)
    await up._ensure_loaded(ok_uid)
    assert conn.calls == 1

    bad_uid = str(uuid4())
    conn2 = _FakeConn([{"profile": "{ not json"}])
    clock2 = _inject_for(monkeypatch, up_mod, conn=conn2)
    up2 = UserProfileBuilder()
    await up2._ensure_loaded(bad_uid)
    # 行在、内容读不出来 ⇒ "读不到",绝不能固化成"这个用户没有画像"
    assert up2._load_records[bad_uid].loaded is False
    assert up2._load_records[bad_uid].failures == 1
    assert clock2 is not None
    assert _MAX_S == 60.0


def test_no_second_copy_of_the_lifecycle_numbers() -> None:
    """形状锁:退避数值与指数式只许住在 _load_lifecycle 一处。

    本票的全部理由就是"两处算同一件事必漂移";这条断言防止下一个人在某个模块里
    顺手把 1.0/60.0/5 再抄一遍(抄一遍的那次改动,另一处不会跟着变)。
    """
    mods = (att_mod, fed_mod, meta_mod, md_mod, up_mod)
    for mod in mods:
        src = inspect.getsource(mod)
        assert "_load_lifecycle" in src, f"{mod.__name__} 未接共享判据"
        for literal in (
            "LOAD_BACKOFF_BASE_S = 1.0",
            "LOAD_BACKOFF_MAX_S = 60.0",
            "LOAD_MAX_CONSECUTIVE_FAILURES = 5",
            "2 ** (",
        ):
            assert literal not in src, f"{mod.__name__} 又抄了一份判据:{literal!r}"

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
