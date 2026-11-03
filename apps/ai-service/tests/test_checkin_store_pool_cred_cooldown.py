# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""号池换票必须解除签到侧未到期冷却(2026-10-23 立)。

立因(dev 库实测):个人池那枚 Qoder 号因凭证被上游拒(`must start with drt-`)判
SessionDead ⇒ `cooldown_until` 落 3650 天(2036-10-20)。冷却按**账号**算、不看凭证,
而全仓零解冷却出口 —— 就算把票换好,这枚号也永远进不了签到窗口,"自动签到领每日
免费积分"对它结构性失效。

三臂对照(真驱动 create_account 的合并分支,连的是按 SQL 内容分派的假连接):
① 号池版本前进 ⇒ 清冷却;② 同版本幂等重推 ⇒ 一条 UPDATE 都不许多发;
③ 用户手工录入(无 pool_* 版本键)⇒ 行为零变化。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services import checkin_store

_NOW = datetime.now(UTC)


def _account(id_: int, device_map: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": id_,
        "name": "池号 #1",
        "device_map": device_map,
        "enabled": True,
        "account_group": "pool",
        "platform": "qoder",
        "created_at": _NOW,
        "updated_at": _NOW,
    }


class _SeqConn:
    """按 SQL 内容分派的连接替身:身份 SELECT → existing;UPDATE checkin_accounts → 新行;
    其余(冷却清理)记入 executes 并回 asyncpg 状态串。"""

    def __init__(self, existing: dict[str, Any] | None, updated: dict[str, Any]) -> None:
        self.existing = existing
        self.updated = updated
        self.executes: list[tuple[str, tuple[object, ...]]] = []

    async def fetchrow(self, sql: str, *args: object) -> dict[str, Any] | None:
        s = " ".join(sql.split())
        if "FROM checkin_accounts" in s and "identity_key = $3" in s:
            return self.existing
        if "UPDATE checkin_accounts" in s:
            return self.updated
        return None

    async def execute(self, sql: str, *args: object) -> str:
        self.executes.append((" ".join(sql.split()), args))
        return "UPDATE 2"


class _FakePool:
    def __init__(self, conn: _SeqConn) -> None:
        self.conn = conn

    def acquire(self) -> Any:
        outer = self

        class _Ctx:
            async def __aenter__(self) -> _SeqConn:
                return outer.conn

            async def __aexit__(self, *_a: object) -> bool:
                return False

        return _Ctx()


def _install(monkeypatch: Any, conn: _SeqConn) -> None:
    async def _pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(checkin_store, "get_shared_pool", _pool)
    # 加密与展示名派生不是本票判据;钉成常量,免得测试依赖 Fernet 密钥配置
    monkeypatch.setattr(checkin_store, "_encrypt_jwt", lambda _v: "enc")
    monkeypatch.setattr(
        checkin_store, "extract_display_name", lambda _jwt, _dm: None  # type: ignore[attr-defined]
    )


async def test_clear_open_cooldowns_sql_shape_only_touches_future_cooldowns() -> None:
    """出口 SQL:只置 NULL 未到期的 cooldown_until,绑定 account_id,不删历史、不动 ok/credits。"""
    conn = _SeqConn(None, _account(11, {}))
    await checkin_store.clear_open_cooldowns_conn(conn, 11)  # type: ignore[arg-type]
    assert len(conn.executes) == 1
    sql, args = conn.executes[0]
    assert "update checkin_records" in sql.lower()
    assert "set cooldown_until = null" in sql.lower()
    assert "cooldown_until > now()" in sql.lower()
    assert args == (11,)
    assert "delete" not in sql.lower()
    assert "credits" not in sql.lower()


async def test_pool_credential_upgrade_clears_open_cooldown(monkeypatch: Any) -> None:
    """正控:号池 credVersion 3 → 4 落进合并分支 ⇒ 未到期冷却必须被清。"""
    existing = _account(11, {"pool_uid": "u-9001", "pool_cred_version": 3})
    conn = _SeqConn(existing, _account(11, {"pool_uid": "u-9001", "pool_cred_version": 4}))
    _install(monkeypatch, conn)

    row = await checkin_store.create_account(
        "owner-uuid",
        "池号 #1",
        "opaque-token",
        {"pool_uid": "u-9001", "pool_cred_version": 4},
        platform="qoder",
    )
    assert row["id"] == 11
    cooldown_updates = [e for e in conn.executes if "cooldown_until = null" in e[0].lower()]
    assert len(cooldown_updates) == 1, f"换票应恰发一次解冷却,实得 {conn.executes}"
    assert cooldown_updates[0][1] == (11,)


async def test_same_version_repush_clears_nothing(monkeypatch: Any) -> None:
    """②同版本幂等重推(防降级档原样返回)⇒ 一条多余写都不许发。"""
    existing = _account(11, {"pool_uid": "u-9001", "pool_cred_version": 3})
    conn = _SeqConn(existing, _account(11, {"pool_uid": "u-9001", "pool_cred_version": 3}))
    _install(monkeypatch, conn)

    await checkin_store.create_account(
        "owner-uuid",
        "池号 #1",
        "opaque-token",
        {"pool_uid": "u-9001", "pool_cred_version": 3},
        platform="qoder",
    )
    assert conn.executes == [], f"同版本重推不许发任何写,实得 {conn.executes}"


async def test_manual_user_account_unchanged(monkeypatch: Any) -> None:
    """③存量语义:用户手工号(不带 pool_* 版本键)换票不解冷却、行为零变化。"""
    existing = _account(11, {"uid": "u-9001"})
    conn = _SeqConn(existing, _account(11, {"uid": "u-9001"}))
    _install(monkeypatch, conn)

    await checkin_store.create_account(
        "owner-uuid",
        "手工号",
        "opaque-token",
        {"uid": "u-9001"},
        platform="qoder",
    )
    assert conn.executes == [], f"手工录入不得触发解冷却,实得 {conn.executes}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
