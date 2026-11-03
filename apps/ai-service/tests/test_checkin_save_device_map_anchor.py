# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""save_device_map 号池锚点保护用例(2026-11-01 立)。

立因:一条 pytest 用例(`test_wb_sync_expiring_triggers_extraction`)漏桩
save_device_map,拿假行 id=7 走真库,把 qoder 号池账号的 device_map 整体替换成
WorkBuddy 测试数据 —— pool_account_id / pool_uid / pool_cred_version 全丢,而且
全程没有一行日志。后果:对账收敛器认不回该账号(判号池行缺失→另建一行,历史记录
留在旧行),CAS 防降级同时失效。

本文件钉两件事:
1. `anchor_preserving_patch` 纯函数语义 —— 只在「库里有锚点 ∧ 传入没有」时回填;
2. `save_device_map` 落库 payload 真的带上锚点,且 patch 为空时**保持整行替换**
   (PATCH /device_map 顶掉旧 web_cookie、writeback 清 pool_pending_cred 都依赖删键)。
"""

from __future__ import annotations

import json
from typing import Any

from app.services import checkin_store
from app.services.checkin_store import _POOL_ANCHOR_KEYS, anchor_preserving_patch

EXISTING: dict[str, Any] = {
    "uid": "01a0c9c8-b0ad-71a4-80d0-eff79f881407",
    "pool_account_id": "06e3a61d-810a-4809-8db3-9f14c0edb9f0",
    "pool_uid": "01a0c9c8-b0ad-71a4-80d0-eff79f881407",
    "pool_cred_version": "3",
    "pool_enabled": True,
    "pool_name": "Qoder · 19944895160",
    "pool_synced_at": "2026-11-01T10:09:48+08:00",
    "refresh_token": "rt-not-printed",
}


class _FakeConn:
    """只实现本函数用到的两个方法(fetchval / execute),记录写入 payload。"""

    def __init__(self, existing: Any) -> None:
        self.existing = existing
        self.executed: list[tuple[tuple[Any, ...]]] = []

    async def fetchval(self, sql: str, *args: Any) -> Any:
        return self.existing

    async def execute(self, sql: str, *args: Any) -> str:
        self.executed.append((args,))
        return "UPDATE 1"


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> Any:
        conn = self.conn

        class _Ctx:
            async def __aenter__(self) -> _FakeConn:
                return conn

            async def __aexit__(self, *exc: object) -> None:
                return None

        return _Ctx()


def _fake_pool_factory(conn: _FakeConn) -> Any:
    async def _get() -> _FakePool:
        return _FakePool(conn)

    return _get


def test_patch_restores_all_anchor_keys_when_incoming_lacks_anchor() -> None:
    """事故现场的最小复现:传入 dm 只带 web_cookie 家族 ⇒ 六个锚点键全部回填。"""
    patch = anchor_preserving_patch(EXISTING, {"uid": "u1", "web_cookie": "session=ok"})
    assert set(patch) == set(_POOL_ANCHOR_KEYS)
    assert patch["pool_account_id"] == "06e3a61d-810a-4809-8db3-9f14c0edb9f0"
    assert patch["pool_cred_version"] == "3"


def test_patch_is_noop_when_row_has_no_anchor() -> None:
    """用户手工账号本来就没有锚点:不许凭空造出一个(会造成假同步态)。"""
    assert anchor_preserving_patch({"uid": "u"}, {"web_cookie": "c"}) == {}


def test_patch_is_noop_when_incoming_already_has_anchor() -> None:
    """传入合法完整 dm(含锚点)时不干预,原样整行替换。"""
    assert anchor_preserving_patch(EXISTING, {"pool_account_id": "x", "uid": "u"}) == {}


def test_patch_parses_asyncpg_text_form() -> None:
    """asyncpg 未注册 jsonb codec 时列值回来是 str,纯函数必须自己解析。"""
    patch = anchor_preserving_patch(json.dumps(EXISTING), {"uid": "u"})
    assert patch["pool_uid"] == "01a0c9c8-b0ad-71a4-80d0-eff79f881407"


def test_patch_tolerates_broken_json_text() -> None:
    assert anchor_preserving_patch("{not json", {"uid": "u"}) == {}


async def test_save_device_map_writes_anchor_back(monkeypatch: Any) -> None:
    """落库 payload 必须同时含本次写入的键与回填的锚点。"""
    conn = _FakeConn(EXISTING)
    monkeypatch.setattr(checkin_store, "get_shared_pool", _fake_pool_factory(conn))
    await checkin_store.save_device_map(7, {"uid": "u1", "web_cookie": "session=ok"})
    assert len(conn.executed) == 1
    (args,) = conn.executed[0]
    payload = json.loads(args[1])
    assert payload["web_cookie"] == "session=ok"
    assert payload["pool_account_id"] == "06e3a61d-810a-4809-8db3-9f14c0edb9f0"


async def test_save_device_map_keeps_replace_semantics_without_anchor(monkeypatch: Any) -> None:
    """无锚点场景保持整行替换(删键语义不变:PATCH 的旧键必须能被顶掉)。"""
    conn = _FakeConn({"uid": "u", "web_cookie": "old"})
    monkeypatch.setattr(checkin_store, "get_shared_pool", _fake_pool_factory(conn))
    await checkin_store.save_device_map(9, {"uid": "u", "user_agent": "UA"})
    (args,) = conn.executed[0]
    payload = json.loads(args[1])
    assert payload == {"uid": "u", "user_agent": "UA"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
