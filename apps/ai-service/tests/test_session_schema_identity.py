# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""存储身份判据:schema 名必须与 `db_path` 的绝对路径解耦。

钉住四件:
 1. 生产/手工路径 ⇒ 固定逻辑 schema `sess_main`(换一次 SESSION_STORE_DB_PATH 不再等于换空库);
 2. 临时路径 ⇒ 仍按路径哈希(用例之间互不干扰、close 即弃);
 3. 显式 `SESSION_STORE_SCHEMA` 可覆盖,非法标识符当场 fail-closed(不静默洗成别的名字);
 4. 旧"路径哈希 schema"的接管**只认显式指名**(`SESSION_STORE_ADOPT_LEGACY_SCHEMA`):
    库面上可能并存上百个旧 schema(实测 969 个带行),按计数猜生产 = 可能接管测试残留;
    机器只做可验证的三件事(目标空 / 源有数据 / RENAME 不搬行)。

第 1/2/3 条是纯函数面,不连库;第 4 条是真库面(无 DSN 或目标已有数据 ⇒ 跳过,§0.3 不记绿也不冒红)。
"""

from __future__ import annotations

import os
import pathlib
import re
import tempfile

import pytest

from app.core.pg_sync import PgShim, SyncPgError, SyncPgSession
from app.services import session_store as ss

_HEX = re.compile(r"^sess_[0-9a-f]{12}$")


def _live_dsn() -> str:
    dsn = os.environ.get("SESSION_PG_DSN") or os.environ.get("DATABASE_URL")
    if dsn:
        return dsn
    env = pathlib.Path(__file__).resolve().parents[1] / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return ""


DSN = _live_dsn()


def test_prod_path_maps_to_logical_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SESSION_STORE_SCHEMA", raising=False)
    # 生产进程不在 pytest 里:模拟把它摘掉,否则命中的是"用例隔离"那一档。
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    # 路径换三次 ⇒ 名字必须是同一个:存储身份不跟路径走。
    for p in ("G:/proj/data/sessions.db", "D:/other/place/sessions.db", "G:/proj/data/renamed.db"):
        assert ss._schema_name_for(pathlib.Path(p)) == "sess_main"


def test_pytest_process_always_gets_isolated_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    """pytest 的 basetemp 可能不在系统临时目录下 ⇒ 只看路径会把所有用例并到一个库。"""
    monkeypatch.delenv("SESSION_STORE_SCHEMA", raising=False)
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "tests/x.py::t (call)")
    a = ss._schema_name_for(pathlib.Path("G:/proj/data/sessions.db"))
    b = ss._schema_name_for(pathlib.Path("G:/proj/data/other.db"))
    assert _HEX.fullmatch(a) and _HEX.fullmatch(b) and a != b


def test_temp_path_keeps_hash_isolation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SESSION_STORE_SCHEMA", raising=False)
    root = pathlib.Path(tempfile.gettempdir())
    a = ss._schema_name_for(root / "pytest-a" / "sessions.db")
    b = ss._schema_name_for(root / "pytest-b" / "sessions.db")
    assert _HEX.fullmatch(a) and _HEX.fullmatch(b)
    assert a != b, "两个临时路径不得共用一个 schema(否则用例互相污染)"


def test_explicit_schema_env_wins_and_bad_name_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SESSION_STORE_SCHEMA", "sess_tenant_a")
    assert ss._schema_name_for(pathlib.Path(tempfile.gettempdir()) / "x.db") == "sess_tenant_a"
    for bad in ("1abc", "a-b", 'a"b', "x" * 64):
        monkeypatch.setenv("SESSION_STORE_SCHEMA", bad)
        with pytest.raises(SyncPgError):
            ss._schema_name_for(pathlib.Path("G:/proj/sessions.db"))


def _drop(conn: PgShim, schema: str) -> None:
    conn.execute(f"DROP SCHEMA IF EXISTS {ss._quote_ident(schema)} CASCADE")


def _seed_legacy(conn: PgShim, name: str) -> None:
    conn.execute(f"CREATE SCHEMA IF NOT EXISTS {ss._quote_ident(name)}")
    conn.execute(
        f"CREATE TABLE IF NOT EXISTS {ss._quote_ident(name)}.items (seq integer primary key)"
    )
    conn.execute(f"INSERT INTO {ss._quote_ident(name)}.items (seq) VALUES (1)")


def _seed_full_legacy(session: SyncPgSession, name: str) -> None:
    """造一个**全量结构**的旧 schema:借一个临时 store 建库,再原地改名。

    只有全量结构才能证明"接管后迁移不再重跑坏列"(裸 items 表会在 _migrate 里炸)。
    """
    seed = ss.SessionStore(pathlib.Path(tempfile.mkdtemp()) / "seed.db")
    tmp_name = seed._schema
    seed.create_thread(title="legacy-row")
    seed._ephemeral = False  # 保下 schema 供改名(否则 close 会整库丢弃)
    seed.close()
    session.execute(
        f"ALTER SCHEMA {ss._quote_ident(tmp_name)} RENAME TO {ss._quote_ident(name)}"
    )


@pytest.mark.skipif(not DSN, reason="无 DATABASE_URL/SESSION_PG_DSN ⇒ 真库面不判")
def test_named_adopt_renames_source_and_keeps_rows() -> None:
    session = SyncPgSession(DSN)
    conn = PgShim(session)
    legacy = "sess_0123456789ab"
    try:
        if ss._schema_row_count(conn, "sess_main") > 0:
            pytest.skip("本库 sess_main 已有会话数据 ⇒ 接管面不可在本用例里复现")
        _seed_legacy(conn, legacy)
        adopted = ss._adopt_named_legacy_schema(conn, "sess_main", legacy)
        assert adopted == legacy
        assert ss._schema_row_count(conn, "sess_main") == 1, "接管是 RENAME,行必须原地保留"
        assert ss._schema_row_count(conn, legacy) == 0, "旧名字应已不存在"
    finally:
        _drop(conn, "sess_main")
        _drop(conn, legacy)
        session.close()


@pytest.mark.skipif(not DSN, reason="无 DATABASE_URL/SESSION_PG_DSN ⇒ 真库面不判")
def test_adopt_refuses_when_target_already_has_data() -> None:
    session = SyncPgSession(DSN)
    conn = PgShim(session)
    legacy = "sess_cafebabecafe"
    try:
        if ss._schema_row_count(conn, "sess_main") > 0:
            pytest.skip("本库 sess_main 已有会话数据 ⇒ 接管面不可在本用例里复现")
        _seed_legacy(conn, legacy)
        _seed_legacy(conn, "sess_main")
        assert ss._adopt_named_legacy_schema(conn, "sess_main", legacy) is None
        assert ss._schema_row_count(conn, legacy) == 1, "目标已在用时,源必须原样留着"
        assert ss._schema_row_count(conn, "sess_main") == 1
    finally:
        _drop(conn, "sess_main")
        _drop(conn, legacy)
        session.close()


@pytest.mark.skipif(not DSN, reason="无 DATABASE_URL/SESSION_PG_DSN ⇒ 真库面不判")
def test_store_adopts_only_when_env_names_the_source(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SyncPgSession(DSN)
    conn = PgShim(session)
    legacy = "sess_d15ea5ed15ea"
    seeded = False
    try:
        if ss._schema_row_count(conn, "sess_main") > 0:
            pytest.skip("本库 sess_main 已有会话数据 ⇒ 接管面不可在本用例里复现")
        _seed_full_legacy(session, legacy)
        seeded = True
        monkeypatch.delenv("SESSION_STORE_SCHEMA", raising=False)
        monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)  # 模拟生产进程
        monkeypatch.setenv("SESSION_STORE_ADOPT_LEGACY_SCHEMA", legacy)
        store = ss.SessionStore("G:/proj/data/sessions.db")
        try:
            assert store._schema == "sess_main"
            assert store._adopted_schema == legacy, "显式指名 ⇒ 必须接管"
        finally:
            store.close()
        # 未指名 ∧ 旧名与本路径算出来的哈希对不上 ⇒ 不得接管(库面上可能并存上百个
        # 旧 schema,只有"当前 db_path 当年算出来的那一枚"才算可推导,其余一律不猜)
        monkeypatch.delenv("SESSION_STORE_ADOPT_LEGACY_SCHEMA", raising=False)
        _drop(conn, "sess_main")
        _seed_legacy(conn, "sess_deadbeefdead")
        store2 = ss.SessionStore("G:/proj/data/sessions.db")
        try:
            assert store2._adopted_schema is None
        finally:
            store2.close()
    finally:
        if seeded:
            _drop(conn, "sess_deadbeefdead")
        _drop(conn, "sess_main")
        _drop(conn, legacy)
        session.close()


@pytest.mark.skipif(not DSN, reason="无 DATABASE_URL/SESSION_PG_DSN ⇒ 真库面不判")
def test_store_adopts_path_derived_legacy_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    """不写任何 env:旧名由**当前 db_path** 现算得出 ⇒ 命中即原地接管(不是从库面上猜)。"""
    session = SyncPgSession(DSN)
    conn = PgShim(session)
    path = pathlib.Path("G:/proj/data/sessions.db")
    legacy = ss._legacy_schema_for_path(path)
    try:
        if ss._schema_row_count(conn, "sess_main") > 0:
            pytest.skip("本库 sess_main 已有会话数据 ⇒ 接管面不可在本用例里复现")
        _seed_full_legacy(session, legacy)
        monkeypatch.delenv("SESSION_STORE_SCHEMA", raising=False)
        monkeypatch.delenv("SESSION_STORE_ADOPT_LEGACY_SCHEMA", raising=False)
        monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)  # 模拟生产进程
        store = ss.SessionStore(path)
        try:
            assert store._schema == "sess_main"
            assert store._adopted_schema == legacy, "路径哈希命中的旧 schema 必须被接管"
            assert len(store.list_threads(limit=5).threads) >= 1, "接管是改名不是搬行:旧数据必须原地可读"
        finally:
            store.close()
    finally:
        _drop(conn, "sess_main")
        _drop(conn, legacy)
        session.close()
@pytest.mark.skipif(not DSN, reason="无 DATABASE_URL/SESSION_PG_DSN ⇒ 真库面不判")
def test_ephemeral_store_registers_and_cleanup_drops_schema() -> None:
    """测试库的根因闸:临时路径的 store 必须登记进进程级回收表,回收后名字真的消失。

    现状成因(2026-11-20 实测):pytest 进程里 `_ephemeral` 故意为假(同路径 close→reopen
    要能读到数据),所以 close() 不丢库;而 schema 名按 tmp 路径哈希派生 ⇒ 每跑一次 pytest
    就多一个永不清理的 `sess_<12hex>`,库面上堆到上千个。回收表就是这条的出口。
    """
    session = SyncPgSession(DSN)
    conn = PgShim(session)
    store = ss.SessionStore(pathlib.Path(tempfile.mkdtemp()) / "sessions.db")
    name = store._schema
    try:
        assert name in ss._TEST_SCHEMAS, "临时路径的 store 必须登记进进程级回收表"
        assert store.schema_name == name
        dropped = ss._drop_test_schemas({name})
        assert dropped == [name], f"回收必须真的丢掉了这个 schema,实际 {dropped}"
        rows = session.fetchall("SELECT 1 FROM pg_namespace WHERE nspname = $1", (name,))
        assert list(rows) == [], "回收后 schema 名必须已不存在"
        assert name not in ss._TEST_SCHEMAS, "回收成功后要从登记表里摘掉(避免重复 DROP)"
    finally:
        store.close()
        _drop(conn, name)
        session.close()


def test_cleanup_is_noop_without_registration() -> None:
    """没登记就没有回收对象 —— 空集必须是一次纯空转(不是"全库扫一遍找像测试的")。"""
    assert ss._drop_test_schemas(set()) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
