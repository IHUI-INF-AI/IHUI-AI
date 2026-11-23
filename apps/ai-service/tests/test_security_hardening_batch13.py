# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 13 批(2026-10-31,R4 评估轮)修复钉住:连接器凭据落库加密(H3)。

覆盖:
- save 后原始行 app_secret 为密文形态(``enc:v1:`` 前缀),不含明文
- get/list 读回是明文(round-trip,调用方行为与旧行为逐字节兼容)
- 存量明文记录(无前缀)读时原样返回 —— 渐进迁移不破坏旧数据
- 坏密文(密钥不匹配/损坏)解密失败 → 置空串,读面不崩

2026-11-24 迁 PG:夹具由 JSON 文件换成内存 fake 会话,不连真实库。
"""

from __future__ import annotations

import pytest

from app.core.config import settings
from app.services import connector_store
from tests._connector_fake import FakeSession

TENANT = "2306401f-4b6d-4436-8f5c-aa36d25da676"


def _row(owner: str, key: str, secret: str) -> dict:
    return {
        "id": f"row-{key}",
        "tenant_id": TENANT,
        "owner_user_id": owner,
        "key": key,
        "conn_type": "feishu",
        "name": "n",
        "enabled": True,
        "app_id": "cli_a",
        "app_secret": secret,
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
    }


def _record(key: str = "feishu:k1", secret: str = "super-secret-value") -> dict:
    return {
        "key": key,
        "type": "feishu",
        "name": "n",
        "app_id": "cli_a",
        "app_secret": secret,
        "extra": {},
        "enabled": True,
        connector_store.OWNER_FIELD: "u1",
    }


@pytest.fixture
def fake_store(monkeypatch: pytest.MonkeyPatch) -> FakeSession:
    fake = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)
    monkeypatch.setattr(settings, "platform_default_tenant_id", TENANT)
    return fake


def test_save_persists_ciphertext_not_plaintext(fake_store: FakeSession):
    connector_store.save("u1", _record())
    raw = str(fake_store.rows[0]["app_secret"])
    assert "super-secret-value" not in raw
    assert connector_store._SECRET_CIPHER_PREFIX in raw


def test_get_roundtrip_returns_plaintext(fake_store: FakeSession):
    connector_store.save("u1", _record())
    got = connector_store.get("u1", "feishu:k1")
    assert got is not None
    assert got["app_secret"] == "super-secret-value"


def test_legacy_plaintext_still_readable(fake_store: FakeSession):
    """存量明文(无前缀)读时原样返回,渐进迁移不破坏旧数据。"""
    fake_store.rows.append(_row("u1", "feishu:k1", "super-secret-value"))
    got = connector_store.get("u1", "feishu:k1")
    assert got is not None
    assert got["app_secret"] == "super-secret-value"


def test_corrupted_cipher_degrades_to_empty_not_crash(fake_store: FakeSession):
    """坏密文解密失败 → 置空串,读面不抛异常。"""
    fake_store.rows.append(
        _row("u1", "feishu:k1", connector_store._SECRET_CIPHER_PREFIX + "bm90LWEtY2lwaGVy")
    )
    got = connector_store.get("u1", "feishu:k1")
    assert got is not None
    assert got["app_secret"] == ""


def test_list_owned_roundtrip(fake_store: FakeSession):
    connector_store.save("u1", _record(key="feishu:a"))
    connector_store.save("u1", _record(key="feishu:b", secret="another-secret"))
    items = connector_store.list_owned("u1")
    assert {i["app_secret"] for i in items} == {"super-secret-value", "another-secret"}
    raw = " ".join(str(r["app_secret"]) for r in fake_store.rows)
    assert "another-secret" not in raw
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
