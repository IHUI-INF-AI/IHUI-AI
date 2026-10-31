# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""进程内存储的有界/带寿命原语 + 三处接线的用例(2026-11-01 安全强化)。

覆盖两类真实缺陷,而不是只测工具类:
1. **外层键无上限、永不清理**:会话键由调用方产生(每个新会话/新 conversationId 一枚),
   原先只有"每会话 ≤N 条"的内限 ⇒ 单账号线性刷键即可把进程写爆;
   其中 `_SESSION_EXTRA_ROOTS` 更糟:值不是数据而是**文件系统授权**,
   而它的显式移除函数全仓零调用 ⇒ 一次会话追加的目录永久生效。
2. **归属检查结构性永不命中**:`_owned` 写入键是 user_id、读取键是 session_id,
   两侧键空间不同 ⇒ "会话未登记时按归属兜底"那次防越权只是注释里存在过。
   本文件把这枚越权用例真正跑起来(摘掉键空间修复即红),并留正向对照不误伤本人/管理员。
"""

from __future__ import annotations

import tempfile
import types

import pytest
from fastapi import HTTPException

from app.core.bounded_ttl_store import BoundedTtlDict, is_expired
from app.routers import context_compaction as cc
from app.services import injection_event_recorder as ier
from app.services import mcp_server


# ------------------------------------------------------------------ 原语本身


def test_bounded_dict_rejects_degenerate_config() -> None:
    """max_keys<1 是"配置成禁用",必须当场炸而不是静默变成无限。"""
    with pytest.raises(ValueError):
        BoundedTtlDict(max_keys=0)


def test_bounded_dict_evicts_oldest_instead_of_growing() -> None:
    now = [1000.0]
    store = BoundedTtlDict(max_keys=3, ttl_seconds=0, clock=lambda: now[0])
    for i in range(3):
        store.set(f"k{i}", i)
    assert len(store) == 3
    now[0] += 1
    store.set("k3", 3)
    assert len(store) == 3
    assert store.get("k0") is None, "最旧的键应被逐出"
    assert store.get("k3") == 3
    assert store.evictions == 1, "逐出必须可观测,否则'有上限'只是口头"


def test_sliding_ttl_keeps_active_entry_and_drops_abandoned_one() -> None:
    now = [0.0]
    store = BoundedTtlDict(max_keys=10, ttl_seconds=100, clock=lambda: now[0])
    store.set("active", 1)
    store.set("abandoned", 2)
    now[0] = 60
    assert store.get("active") == 1  # 读一次即续期
    now[0] = 130
    assert store.get("active") == 1, "滑动续期应让它活着(60+100=160 才过期)"
    assert store.get("abandoned") is None, "从未被再读的条目必须会消失,而不是永生"
    assert store.expired_swept >= 1


def test_ttl_zero_is_explicitly_no_expiry() -> None:
    assert is_expired(0.0, 0, 10**9) is False
    assert is_expired(0.0, 1, 2.0) is True


# ------------------------------------------------------------------ 归属检查真的会触发


class _State:
    def __init__(self, user_id: str, role_id: int) -> None:
        self.user_id = user_id
        self.role_id = role_id


def _fake_request(user_id: str, role_id: int = 0) -> types.SimpleNamespace:
    """只喂 `_authorize_session` 实际读取的两维(state.user_id / state.role_id)。"""
    return types.SimpleNamespace(state=_State(user_id, role_id))


@pytest.fixture(autouse=True)
def _reset_stores():
    cc._history.reset()
    cc._owned.reset()
    ier._history.reset()
    mcp_server._SESSION_EXTRA_ROOTS.reset()
    yield
    cc._history.reset()
    cc._owned.reset()
    ier._history.reset()
    mcp_server._SESSION_EXTRA_ROOTS.reset()


def test_owner_check_blocks_other_user_and_allows_owner_and_admin() -> None:
    """反向牙:原实现把 owner 写在 user_id 键上,读侧读不到 ⇒ 这一整条检查形同不存在。"""
    cc.record_compaction(
        "sess-victim",
        original_tokens=1000,
        compressed_tokens=200,
        summary="s",
        user_id="alice",
    )
    # 本人放行
    who, is_admin = cc._authorize_session(_fake_request("alice"), "sess-victim")
    assert who == "alice" and is_admin is False
    # 他人 ⇒ 403(这一枚在原实现下不会发生)
    with pytest.raises(HTTPException) as caught:
        cc._authorize_session(_fake_request("mallory"), "sess-victim")
    assert caught.value.status_code == 403
    # 管理员豁免(既有语义不变)
    who2, is_admin2 = cc._authorize_session(_fake_request("root", 1), "sess-victim")
    assert who2 == "root" and is_admin2 is True


def test_unowned_session_still_passes() -> None:
    """正向对照:没登记过归属的会话不因本枚变严(宽松档照旧)。"""
    who, _ = cc._authorize_session(_fake_request("anyone"), "sess-unknown")
    assert who == "anyone"


# ------------------------------------------------------------------ 外层键有界


def test_compaction_history_outer_key_cap_and_ttl() -> None:
    now = [0.0]
    cc._history._clock = lambda: now[0]
    cc._owned._clock = lambda: now[0]
    monkey_keys = cc.MAX_SESSION_KEYS
    try:
        cc._history.__init__(max_keys=4, ttl_seconds=60, clock=lambda: now[0])
        cc._owned.__init__(max_keys=4, ttl_seconds=60, clock=lambda: now[0])
        for i in range(10):
            now[0] = float(i)
            cc.record_compaction(
                f"s{i}", original_tokens=10, compressed_tokens=5, user_id=f"u{i}"
            )
        assert len(cc._history) <= 4, "外层会话键必须受 max_keys 约束"
        now[0] = 1000.0
        assert cc.list_compaction_events("s9") == [], "过期会话的摘要不得再被读出"
    finally:
        cc._history.__init__(max_keys=monkey_keys, ttl_seconds=cc.SESSION_TTL_SECONDS)
        cc._owned.__init__(max_keys=monkey_keys, ttl_seconds=cc.SESSION_TTL_SECONDS)


def test_compaction_still_trims_per_session() -> None:
    """既有内限(每会话 ≤MAX_PER_SESSION)未被本枚改坏。"""
    for i in range(cc.MAX_PER_SESSION + 20):
        cc.record_compaction("big", original_tokens=10, compressed_tokens=1, user_id="u")
    assert len(cc.list_compaction_events("big", limit=cc.MAX_PER_SESSION)) == cc.MAX_PER_SESSION


def test_injection_recorder_has_no_second_owner_index_and_is_bounded() -> None:
    """注入事件面:归属索引既没人读就不该留第二份真相源(§0.6),同时外层键必须有界。"""
    assert not hasattr(ier, "_owned"), "写了没人读的归属副本又回来了"
    ier.record_injection_event("s1", snippet="ignore previous instructions", user_id="u1")
    assert len(ier.list_injection_events("s1")) == 1
    now = [0.0]
    ier._history._clock = lambda: now[0]
    ier._history.__init__(max_keys=3, ttl_seconds=30, clock=lambda: now[0])
    try:
        for i in range(9):
            now[0] = float(i)
            ier.record_injection_event(f"sess{i}", snippet="x", user_id="u")
        assert len(ier._history) <= 3
        now[0] = 999.0
        assert ier.list_injection_events("sess8") == []
    finally:
        ier._history.__init__(max_keys=2000, ttl_seconds=ier.SESSION_TTL_SECONDS)


# ------------------------------------------------------------------ 文件系统授权不得永生


def test_session_extra_roots_expire_and_are_capped() -> None:
    """追加目录 = 扩权。原实现无上限无清理,且显式移除函数全仓零调用 ⇒ 永久生效。"""
    now = [0.0]
    store = mcp_server._SESSION_EXTRA_ROOTS
    store._clock = lambda: now[0]
    with tempfile.TemporaryDirectory() as d1, tempfile.TemporaryDirectory() as d2:
        mcp_server.set_session_extra_roots("conv-A", [d1])
        assert mcp_server.get_session_extra_roots("conv-A"), "刚登记的授权必须生效"
        # 显式移除路径仍可用(它此前只是没被接线)
        mcp_server.clear_session_extra_roots("conv-A")
        assert mcp_server.get_session_extra_roots("conv-A") == ()
        # 时间推过 TTL ⇒ 未显式清理的授权也必须失效
        now[0] = 1.0
        mcp_server.set_session_extra_roots("conv-B", [d2])
        now[0] = 7 * 3600.0
        assert mcp_server.get_session_extra_roots("conv-B") == (), "会话级扩权不得跨会话永生"
    # 上限:刷会话不得让授权表无限增长
    store.__init__(max_keys=2, ttl_seconds=3600.0, clock=lambda: now[0])
    try:
        for i in range(8):
            now[0] = float(i)
            store.set(f"conv{i}", (f"/tmp/x{i}",))
        assert len(store) <= 2
    finally:
        store.__init__(max_keys=5000, ttl_seconds=6 * 3600.0)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
