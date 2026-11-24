# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""connector_store PG 存储层测试(2026-11-24,JSON 单文件迁 PostgreSQL)。

覆盖语义:
- CRUD roundtrip;save 返回副本改不动持久化
- 租户 + 属主双轴隔离:跨租户 / 跨属主与"没这条"同形,且越权不留副作用
- 无主 / 缺租户 fail-closed:拿不到可信租户 ⇒ 写拒绝、读空
- 唯一约束:并发撞唯一索引回退 update;真库层钉个人行与共享行两条唯一索引
- 加密落库:原始行 secret 为 enc:v1 密文、不含明文;读回透明解密
- 回填 plan:三类计数、无主不转有主、二次跑幂等

fake 用例不连库;真库集成用例在无 DSN 时跳过,前缀隔离 + finally 清理,不碰生产库。
"""

from __future__ import annotations

import json
import os
from typing import Any

import pytest

from app.core.config import settings
from app.services import connector_store as store
from tests._connector_fake import FakeSession

TENANT_A = "2306401f-4b6d-4436-8f5c-aa36d25da676"
TENANT_B = "17568535-5479-4a7e-9402-5fb0659a6a94"
USER_A = "30763d9f-2b4a-4f6e-9c3a-1a2b3c4d5e6f"
USER_B = "40874c0a-3c5b-4f70-8d4b-2b3c4d5e6f70"
PLAIN_SECRET = "super-secret-value"


def _record(key: str = "yuque:docs", secret: str = PLAIN_SECRET, **overrides: Any) -> dict[str, Any]:
    rec: dict[str, Any] = {
        "key": key,
        "type": "yuque",
        "name": "语雀文档库",
        "app_id": "cli_a",
        "app_secret": secret,
        "extra": {"user": "yuque", "repo": "developer"},
        "mode": "preset",
        "spec": {},
        "operations": [],
        "enabled": True,
        "managed": False,
        "installed_at": "2026-09-02T00:00:00+00:00",
        "last_sync_at": "",
        "last_error": "",
        "sync_items": [],
    }
    rec.update(overrides)
    return rec


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> FakeSession:
    session = FakeSession()
    monkeypatch.setattr(store, "_pg_session", lambda: session)
    monkeypatch.setattr(settings, "platform_default_tenant_id", TENANT_A)
    return session


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def test_save_and_get_roundtrip(fake: FakeSession):
    saved = store.save(USER_A, _record())
    assert saved is not None
    got = store.get(USER_A, "yuque:docs")
    assert got is not None
    assert got["key"] == "yuque:docs"
    assert got["type"] == "yuque"
    assert got["app_id"] == "cli_a"
    assert got["app_secret"] == PLAIN_SECRET
    assert got["owner_user_id"] == USER_A

    listed = store.list_owned(USER_A)
    assert len(listed) == 1
    # 返回副本:改动不影响持久化
    listed[0]["app_secret"] = "mutated"
    assert store.get(USER_A, "yuque:docs")["app_secret"] == PLAIN_SECRET


def test_list_owned_returns_only_mine(fake: FakeSession):
    store.save(USER_A, _record(key="yuque:a"))
    store.save(USER_A, _record(key="yuque:b"))
    store.save(USER_B, _record(key="yuque:b", secret="other"))
    mine = store.list_owned(USER_A)
    assert {r["key"] for r in mine} == {"yuque:a", "yuque:b"}
    assert store.list_owned(USER_B)[0]["app_secret"] == "other"


def test_remove(fake: FakeSession):
    store.save(USER_A, _record())
    assert store.remove(USER_A, "yuque:docs") is True
    assert store.get(USER_A, "yuque:docs") is None
    assert store.remove(USER_A, "yuque:docs") is False


def test_set_enabled_and_sync_state(fake: FakeSession):
    store.save(USER_A, _record())
    updated = store.set_enabled(USER_A, "yuque:docs", False)
    assert updated is not None and updated["enabled"] is False

    synced = store.set_sync_state(
        USER_A, "yuque:docs", "2026-09-02T00:00:00+00:00", "",
        items=[{"doc_id": "api", "title": "Overview"}],
    )
    assert synced is not None
    assert synced["last_sync_at"] == "2026-09-02T00:00:00+00:00"
    assert synced["sync_items"] == [{"doc_id": "api", "title": "Overview"}]

    failed = store.set_sync_state(USER_A, "yuque:docs", "", "同步失败")
    assert failed is not None and failed["last_error"] == "同步失败"


# ---------------------------------------------------------------------------
# 隔离:属主 + 租户
# ---------------------------------------------------------------------------


def test_cross_owner_is_shaped_like_missing_and_side_effect_free(fake: FakeSession):
    store.save(USER_A, _record())
    before = store.get(USER_A, "yuque:docs")

    assert store.get(USER_B, "yuque:docs") is None
    assert store.list_owned(USER_B) == []
    assert store.set_enabled(USER_B, "yuque:docs", False) is None
    assert store.set_sync_state(USER_B, "yuque:docs", "", "x") is None
    assert store.remove(USER_B, "yuque:docs") is False

    after = store.get(USER_A, "yuque:docs")
    assert after == before  # 越权请求没留下任何副作用


def test_tenant_isolation_shared_rows(fake: FakeSession):
    # 显式 tenant_id ⇒ 租户共享行(owner_user_id=NULL)
    saved = store.save(TENANT_A, _record(key="yuque:shared"), tenant_id=TENANT_A)
    assert saved is not None
    row = fake.rows[0]
    assert row["owner_user_id"] is None
    assert row["tenant_id"] == TENANT_A

    # 同租户共享行可见;他租户不可见
    assert store.list_owned(TENANT_A, tenant_id=TENANT_A)[0]["key"] == "yuque:shared"
    assert store.get(TENANT_B, "yuque:docs", tenant_id=TENANT_B) is None
    assert store.list_owned(TENANT_B, tenant_id=TENANT_B) == []


def test_personal_and_shared_rows_are_separate_axes(fake: FakeSession):
    store.save(TENANT_A, _record(key="yuque:shared"), tenant_id=TENANT_A)
    store.save(USER_A, _record(key="yuque:personal"))
    # 个人主体只看得到自己的个人行,看不到同租户共享行? —— 共享行归属租户,
    # 个人上下文不把租户共享行列给自己;两条轴互不串。
    assert {r["key"] for r in store.list_owned(USER_A)} == {"yuque:personal"}
    shared = store.list_owned(TENANT_A, tenant_id=TENANT_A)
    assert {r["key"] for r in shared} == {"yuque:shared"}


# ---------------------------------------------------------------------------
# fail-closed:缺租户 / 缺 DSN / 空属主
# ---------------------------------------------------------------------------


def test_missing_tenant_fails_closed(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "platform_default_tenant_id", "")
    session = FakeSession()
    monkeypatch.setattr(store, "_pg_session", lambda: session)

    assert store.save(USER_A, _record()) is None
    assert store.list_owned(USER_A) == []
    assert store.get(USER_A, "yuque:docs") is None
    assert store.remove(USER_A, "yuque:docs") is False
    # 显式合法租户仍可写(不走兜底)
    assert store.save(TENANT_A, _record(), tenant_id=TENANT_A) is not None


def test_dsn_missing_fails_closed(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(store, "_pg_session", lambda: None)
    assert store.save(USER_A, _record()) is None
    assert store.list_owned(USER_A) == []
    assert store.get(USER_A, "yuque:docs") is None
    assert store.ownerless_count() == 0
    assert store.remove(USER_A, "yuque:docs") is False
    assert store.set_enabled(USER_A, "k", True) is None


def test_empty_owner_is_not_an_implicit_wildcard(fake: FakeSession):
    store.save(USER_A, _record())
    assert store.list_owned("") == []
    assert store.get("", "yuque:docs") is None


# ---------------------------------------------------------------------------
# 加密落库
# ---------------------------------------------------------------------------


def test_secret_encrypted_at_rest(fake: FakeSession):
    store.save(USER_A, _record(secret=PLAIN_SECRET))
    row = fake.rows[0]
    stored = str(row["app_secret"])
    assert stored.startswith(store._SECRET_CIPHER_PREFIX)
    assert PLAIN_SECRET not in json.dumps(row, ensure_ascii=False)
    # 读回透明解密
    assert store.get(USER_A, "yuque:docs")["app_secret"] == PLAIN_SECRET


def test_encryption_unavailable_refuses_plaintext(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    monkeypatch.setattr(store, "_pg_session", lambda: session)

    def _boom(_plain: str) -> str:
        raise store.SecretCryptoUnavailable("no key")

    monkeypatch.setattr(store, "_encrypt_secret", _boom)
    assert store.save(USER_A, _record(secret=PLAIN_SECRET)) is None
    assert session.rows == []  # 明文一行都没落


def test_unreadable_ciphertext_kept_on_next_write(fake: FakeSession):
    # 先落一条不可解密密文(模拟密钥轮换后旧密文)
    fake.rows.append({
        "id": "row-1",
        "tenant_id": TENANT_A,
        "owner_user_id": USER_A,
        "key": "yuque:k1",
        "conn_type": "yuque",
        "name": "n",
        "enabled": True,
        "app_id": "",
        "app_secret": "enc:v1:undecryptable",
        "extra": {},
        "mode": "preset",
        "spec": {},
        "operations": [],
        "managed": False,
        "credential_source": "",
        "installed_at": "",
        "last_sync_at": "",
        "last_error": "",
        "sync_items": [],
        "created_at": "2026-09-02T00:00:00+00:00",
        "updated_at": "2026-09-02T00:00:00+00:00",
    })
    loaded = store.get(USER_A, "yuque:k1")
    assert loaded is not None
    assert loaded["app_secret"] == ""
    assert all(not str(k).startswith("_") for k in loaded)

    # 再写另一条;不可读旧密文不得被整表写抹成空串
    store.save(USER_A, _record(key="yuque:k2", secret="plain"))
    kept = next(r for r in fake.rows if r["key"] == "yuque:k1")
    assert kept["app_secret"] == "enc:v1:undecryptable"


# ---------------------------------------------------------------------------
# 唯一约束:冲突回退 update
# ---------------------------------------------------------------------------


def test_unique_conflict_on_insert_does_not_crash(fake: FakeSession):
    fake.force_unique_conflict = True
    # INSERT 撞唯一索引 ⇒ 回退 update 路径兜住,不抛半成品异常;
    # 真库下并发已存在的行由 update 接管(fake 空表 update 命中不到,不留半成品行)。
    saved = store.save(USER_A, _record())
    assert saved is not None
    assert len(fake.rows) == 0


# ---------------------------------------------------------------------------
# 回填 plan 纯函数
# ---------------------------------------------------------------------------


def _backfill_records() -> list[dict[str, Any]]:
    return [
        {"key": "yuque:a", "type": "yuque", "owner_user_id": USER_A, "app_secret": "s1"},
        {"key": "feishu:b", "type": "feishu", "owner_user_id": USER_B, "app_secret": "s2"},
        {"key": "yuque:legacy", "type": "yuque", "app_secret": "legacy-secret"},  # 无主
        {"type": "wecom", "app_secret": "no-key"},  # 缺 key
    ]


def test_backfill_plan_classifies_three_buckets():
    from scripts.backfill_connectors_to_pg import plan_backfill

    existing = {(TENANT_A, USER_B, "feishu:b")}
    plan = plan_backfill(_backfill_records(), TENANT_A, existing)
    assert [r["key"] for r in plan.inserted] == ["yuque:a"]
    assert plan.skipped == ["feishu:b"]
    assert plan.ownerless == ["yuque:legacy (yuque)"]
    assert plan.unknown_key == ["wecom"]
    # 无主记录绝不进 inserted(不得被回填成有主)
    assert all(r.get(store.OWNER_FIELD) for r in plan.inserted)


def test_backfill_plan_is_idempotent():
    from scripts.backfill_connectors_to_pg import plan_backfill

    existing: set[tuple[str, str, str]] = set()
    first = plan_backfill(_backfill_records(), TENANT_A, existing)
    # 模拟第一次落库后,PG 已存键
    after = {(TENANT_A, r[store.OWNER_FIELD], r["key"]) for r in first.inserted}
    second = plan_backfill(_backfill_records(), TENANT_A, after)
    assert second.inserted == []
    assert sorted(second.skipped) == sorted(r["key"] for r in first.inserted)
    assert second.ownerless == first.ownerless


# ---------------------------------------------------------------------------
# 真库集成(无 DSN 跳过;前缀隔离,finally 清理)
# ---------------------------------------------------------------------------


def _has_dsn() -> bool:
    return bool(str(getattr(settings, "database_url", "") or "").strip())


pytestmark = pytest.mark.skipif(not _has_dsn(), reason="未配置 DATABASE_URL,跳过真库 PG 集成")


def test_pg_real_roundtrip_isolation_and_unique():
    prefix = f"test-{os.urandom(6).hex()}"
    session = store._pg_session()
    assert session is not None
    try:
        a_key = f"{prefix}:a"
        b_key = f"{prefix}:b"
        # 个人作用域:落兜底租户,属主=用户
        assert store.save(USER_A, _record(key=a_key)) is not None
        assert store.save(USER_B, _record(key=b_key, secret="other")) is not None

        # 跨属主不可见(个人轴)
        assert store.get(USER_B, a_key) is None
        # 跨租户不可见:B 租户共享轴查不到 A 租户的个人行
        assert store.get(TENANT_B, a_key, tenant_id=TENANT_B) is None

        # 个人行唯一冲突:同租户同属主同 key 第二条
        with pytest.raises(Exception):
            session.execute(
                """INSERT INTO connector_instances
                   (tenant_id, owner_user_id, key, conn_type, name, enabled, app_id,
                    app_secret, extra, mode, spec, operations, managed, credential_source,
                    installed_at, last_sync_at, last_error, sync_items)
                   VALUES ($1,$2,$3,'yuque','n',true,'','','{}','preset','{}','[]',false,'',
                           '','','','[]')""",
                (TENANT_A, USER_A, a_key),
            )

        # 共享行部分唯一索引:同租户两条 owner NULL 同 key 第二条被拒
        shared_key = f"{prefix}:shared"
        session.execute(
            """INSERT INTO connector_instances
               (tenant_id, owner_user_id, key, conn_type, name, enabled, app_id,
                app_secret, extra, mode, spec, operations, managed, credential_source,
                installed_at, last_sync_at, last_error, sync_items)
               VALUES ($1,NULL,$2,'yuque','n',true,'','','{}','preset','{}','[]',false,'',
                       '','','','[]')""",
            (TENANT_A, shared_key),
        )
        with pytest.raises(Exception):
            session.execute(
                """INSERT INTO connector_instances
                   (tenant_id, owner_user_id, key, conn_type, name, enabled, app_id,
                    app_secret, extra, mode, spec, operations, managed, credential_source,
                    installed_at, last_sync_at, last_error, sync_items)
                   VALUES ($1,NULL,$2,'yuque','n',true,'','','{}','preset','{}','[]',false,'',
                           '','','','[]')""",
                (TENANT_A, shared_key),
            )

        # 原始行断言:明文不落库
        row = session.fetchrow(
            "SELECT app_secret FROM connector_instances WHERE key=$1", (a_key,)
        )
        assert str(row["app_secret"]).startswith(store._SECRET_CIPHER_PREFIX)
        assert PLAIN_SECRET not in str(row["app_secret"])
    finally:
        session.execute(
            "DELETE FROM connector_instances WHERE key LIKE $1", (f"{prefix}:%",)
        )
        store.close_session()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
