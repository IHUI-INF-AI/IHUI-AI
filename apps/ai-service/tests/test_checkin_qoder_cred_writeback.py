# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Qoder 凭证 relay 回写收窄用例(2026-11-08 立,同 uid 双行下游放大器根治)。

背景:ai_relay_account_pool 允许同一 (provider, uid) 并存两行 —— 运营池一行
(owner_user_id IS NULL)+ 某用户个人池一行。旧实现 save_qoder_cred 的 UPDATE
只按 uid 通配,双行期间刷新出来的新票会同时写进两行,把两个持有者当成一枚号。
纪律与 apps/api/scripts/relay-qoder-session-sync.ts 头注同源:写库一律收窄到
所属那一行,判不出归属 ⇒ 少写 + 点名(§0.3/§0.10),绝不回落通配。

本文件用「会真按 WHERE 命中行的假表」驱动被测 SQL:若回写语句退化为 uid 通配,
两行都会被命中,断言①当场翻红 —— 断言的是"另一行逐字没被动过",不是"这行写对了"。
测试全程 monkeypatch 连接池,不连任何真库(测试隔离铁律)。
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.services import checkin_store

_USER_UID = "11111111-2222-3333-4444-555555555555"  # 个人池持有者(apps/api users.id 形态)
_OPS_PK = "aaaaaaaa-0000-0000-0000-000000000001"  # 运营池行主键 id
_USER_PK = "aaaaaaaa-0000-0000-0000-000000000002"  # 个人池行主键 id
_POOL_UID = "upstream-uid-1"  # 上游账号 uid(双行并存的那一维)
_KEY32 = "01234567890123456789012345678901"  # CREDENTIALS_ENCRYPTION_KEY 测试值(≥32)


class _FakeTable:
    """按生产 SQL 的 WHERE 真命中行的假表(测试替身,只认本模块产出的条件形状)。

    它不复算归属判据 —— 判据仍在 checkin_store._qoder_row_target 里唯一一份;
    这里只把「列 = $n / 列 = '字面量' / 列 IS NULL」这三种条件套到行上,
    因此"收窄没收窄"完全由被测代码给出的 SQL 说了算。
    """

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def _matches(self, row: dict[str, Any], where: str, args: tuple[Any, ...]) -> bool:
        for raw in where.split(" AND "):
            cond = raw.strip()
            m = re.fullmatch(r"(\w+) = \$(\d+)", cond)
            if m:
                if str(row.get(m.group(1))) != str(args[int(m.group(2)) - 1]):
                    return False
                continue
            m = re.fullmatch(r"(\w+) = '([^']*)'", cond)
            if m:
                if row.get(m.group(1)) != m.group(2):
                    return False
                continue
            m = re.fullmatch(r"(\w+) IS NULL", cond)
            if m:
                if row.get(m.group(1)) is not None:
                    return False
                continue
            raise AssertionError(f"假表解不了这条条件(被测 SQL 出了新形状,须人工复核): {cond}")
        return True

    def run(self, sql: str, args: tuple[Any, ...]) -> list[dict[str, Any]]:
        body = " ".join(sql.split())
        where = body.split(" WHERE ", 1)[1]
        where = re.split(r" ORDER BY | RETURNING ", where, maxsplit=1)[0].strip()
        hits = [r for r in self.rows if self._matches(r, where, args)]
        if body.lstrip().upper().startswith("UPDATE"):
            m_set = re.search(r"SET token_enc = \$(\d+)", body)
            for row in hits:
                if m_set:
                    row["token_enc"] = args[int(m_set.group(1)) - 1]
                for m in re.finditer(r"(\w+) = COALESCE\(\$(\d+), \w+\)", body):
                    val = args[int(m.group(2)) - 1]
                    if val is not None:
                        row[m.group(1)] = val
                row["touched"] = int(row.get("touched", 0)) + 1
        elif "ORDER BY updated_at DESC" in body:
            hits.sort(key=lambda r: r["updated_at"], reverse=True)
            hits = hits[:1]
        return hits


class _FakeConn:
    def __init__(self, table: _FakeTable) -> None:
        self.table = table

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        return self.table.run(sql, args)

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        rows = self.table.run(sql, args)
        return rows[0] if rows else None


class _FakePool:
    def __init__(self, table: _FakeTable) -> None:
        self.conn = _FakeConn(table)

    def acquire(self) -> Any:
        conn = self.conn

        class _Ctx:
            async def __aenter__(self) -> _FakeConn:
                return conn

            async def __aexit__(self, *_a: object) -> bool:
                return False

        return _Ctx()


class _LogSpy:
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

    def warning(self, *args: Any, **_kw: Any) -> None:
        self._emit("warning", args)

    def error(self, *args: Any, **_kw: Any) -> None:
        self._emit("error", args)

    def info(self, *args: Any, **_kw: Any) -> None:
        self._emit("info", args)

    def texts(self, level: str) -> list[str]:
        return [m for lv, m in self.records if lv == level]


def _row(pk: str, owner: str | None, token: str, updated: datetime) -> dict[str, Any]:
    return {
        "id": pk,
        "provider_code": "qoder",
        "uid": _POOL_UID,
        "owner_user_id": owner,
        "token_enc": checkin_store._relay_encrypt(token),
        "refresh_token_enc": None,
        "token_expires_at": None,
        "machine_id": None,
        "extra_metadata": None,
        "updated_at": updated,
        "touched": 0,
    }


@pytest.fixture()
def dual_rows(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """双行现场:运营池行(updated_at 更新)+ 个人池行,同一上游 uid 并存。"""
    monkeypatch.setenv("CREDENTIALS_ENCRYPTION_KEY", _KEY32)
    now = datetime.now(UTC)
    ops = _row(_OPS_PK, None, "tok-ops", now)
    personal = _row(_USER_PK, _USER_UID, "tok-user", now - timedelta(hours=1))
    table = _FakeTable([ops, personal])
    pool = _FakePool(table)

    async def _factory() -> _FakePool:
        return pool

    monkeypatch.setattr(checkin_store, "get_shared_pool", _factory)
    log = _LogSpy()
    monkeypatch.setattr(checkin_store, "logger", log)
    snapshot = {"ops": dict(ops), "personal": dict(personal)}
    return {"table": table, "ops": ops, "personal": personal, "log": log, "snap": snapshot}


# ── ①双行场景:回写只命中所属那一行,另一行逐字不变 ──────────────────────────


async def test_writeback_primary_key_hits_only_owned_row(dual_rows: dict[str, Any]) -> None:
    """档位①:有 pool_account_id ⇒ 主键收窄。个人池票回写,运营池行一个字节都不许动。"""
    result = await checkin_store.save_qoder_cred(
        _POOL_UID,
        "tok-user-refreshed",
        "rt-new",
        None,
        pool_account_id=_USER_PK,
        owner_user_id=None,
    )
    assert result["status"] == "applied"
    assert result["path"] == "primary-key"
    assert result["writtenIds"] == [_USER_PK]  # 回库确认的真实落集,不是请求侧条数
    personal = dual_rows["personal"]
    ops = dual_rows["ops"]
    assert checkin_store._relay_decrypt(personal["token_enc"]) == "tok-user-refreshed"
    # 另一行逐字不变(旧 SQL 按 uid 通配会连这行一起命中,此断言当场翻红)
    assert ops["touched"] == 0
    assert ops["token_enc"] == dual_rows["snap"]["ops"]["token_enc"]


async def test_writeback_owner_fallback_personal_writes_only_personal_row(
    dual_rows: dict[str, Any],
) -> None:
    """档位②a:拿不到主键、owner 是 uuid ⇒ (uid, owner) 收窄,只写该用户个人池行。"""
    result = await checkin_store.save_qoder_cred(
        _POOL_UID,
        "tok-user-refreshed",
        None,
        None,
        owner_user_id=_USER_UID,
    )
    assert result["status"] == "applied"
    assert result["path"] == "owner-personal"  # 如实回显走了回落档
    assert result["writtenIds"] == [_USER_PK]
    assert dual_rows["ops"]["touched"] == 0
    assert dual_rows["ops"]["token_enc"] == dual_rows["snap"]["ops"]["token_enc"]


async def test_writeback_owner_fallback_ops_writes_only_ops_row(dual_rows: dict[str, Any]) -> None:
    """档位②b:owner=POOL_SYNC_OWNER ⇒ 运营池行(owner_user_id IS NULL)单行命中。"""
    result = await checkin_store.save_qoder_cred(
        _POOL_UID,
        "tok-ops-refreshed",
        None,
        None,
        owner_user_id=checkin_store.POOL_SYNC_OWNER,
    )
    assert result["status"] == "applied"
    assert result["path"] == "owner-ops"
    assert result["writtenIds"] == [_OPS_PK]
    assert dual_rows["personal"]["touched"] == 0
    assert dual_rows["personal"]["token_enc"] == dual_rows["snap"]["personal"]["token_enc"]


# ── ②判不出归属 ⇒ 不写 + 点名(少写,不多写) ──────────────────────────────


async def test_writeback_undetermined_writes_nothing(dual_rows: dict[str, Any]) -> None:
    """档位③:主键与归属都拿不到 ⇒ 一条不写、warning 点名,绝不回落 uid 通配。"""
    result = await checkin_store.save_qoder_cred(_POOL_UID, "tok-new", None, None)
    assert result["status"] == "undetermined"
    assert result["writtenIds"] == []
    assert dual_rows["ops"]["touched"] == 0
    assert dual_rows["personal"]["touched"] == 0
    assert dual_rows["ops"]["token_enc"] == dual_rows["snap"]["ops"]["token_enc"]
    assert dual_rows["personal"]["token_enc"] == dual_rows["snap"]["personal"]["token_enc"]
    warn = " ".join(dual_rows["log"].texts("warning"))
    assert "未判定" in warn and _POOL_UID in warn


async def test_writeback_non_owner_shape_is_undetermined(dual_rows: dict[str, Any]) -> None:
    """dev-anonymous 等占位主人不构成归属 ⇒ 同样未判定,不写任何人。"""
    result = await checkin_store.save_qoder_cred(
        _POOL_UID, "tok-new", None, None, owner_user_id="dev-anonymous"
    )
    assert result["status"] == "undetermined"
    assert dual_rows["ops"]["touched"] == 0
    assert dual_rows["personal"]["touched"] == 0


async def test_writeback_miss_names_anchor_without_wildcard_retry(dual_rows: dict[str, Any]) -> None:
    """主键锚点指到不存在的行(号池行已删/漂移)⇒ status=miss 点名,不回退通配补写。"""
    result = await checkin_store.save_qoder_cred(
        _POOL_UID, "tok-new", None, None, pool_account_id="bbbbbbbb-0000-0000-0000-000000000099"
    )
    assert result["status"] == "miss"
    assert result["path"] == "primary-key"
    assert dual_rows["ops"]["touched"] == 0
    assert dual_rows["personal"]["touched"] == 0
    warn = " ".join(dual_rows["log"].texts("warning"))
    assert "命中 0 行" in warn


async def test_writeback_malformed_pool_id_falls_back_to_owner(dual_rows: dict[str, Any]) -> None:
    """pool_account_id 形态坏 ⇒ 视同拿不到,回落 owner 档并如实点名档位。"""
    result = await checkin_store.save_qoder_cred(
        _POOL_UID,
        "tok-user-refreshed",
        None,
        None,
        pool_account_id="not-a-uuid",
        owner_user_id=_USER_UID,
    )
    assert result["status"] == "applied"
    assert result["path"] == "owner-personal"
    assert result["writtenIds"] == [_USER_PK]
    assert dual_rows["ops"]["touched"] == 0


# ── 读侧同锚:收窄到所属行;拿不到锚时保留旧兜底并回显档位 ──────────────────


async def test_load_narrows_to_owned_row_even_when_other_row_is_newer(
    dual_rows: dict[str, Any],
) -> None:
    """运营池行 updated_at 更新,但账号锚定个人池行 ⇒ 必须读到个人池的票(不串号)。"""
    cred = await checkin_store.load_qoder_cred(
        _POOL_UID, pool_account_id=_USER_PK, owner_user_id=_USER_UID
    )
    assert cred is not None
    assert cred["token"] == "tok-user"
    assert cred["pool_row_path"] == "primary-key"


async def test_load_without_anchor_keeps_latest_row_and_flags_it(dual_rows: dict[str, Any]) -> None:
    """无锚点 ⇒ 维持旧"最新一行"兜底,并在 pool_row_path 里如实回显未收窄。"""
    cred = await checkin_store.load_qoder_cred(_POOL_UID)
    assert cred is not None
    assert cred["token"] == "tok-ops"
    assert cred["pool_row_path"] == "uid-latest"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
