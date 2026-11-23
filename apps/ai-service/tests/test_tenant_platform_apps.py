# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""租户级平台应用凭据(ai-service)回归锁。

不连真实 DB:只钉三件事 —— Node enc:v1 密文能被 Python 解、非租户 UUID 不查库、
连接器托管状态优先认租户行且不跨租户回退环境凭据。
"""

from __future__ import annotations

import app.services.tenant_platform_apps as tpa
from app.core.config import settings
from app.services.connectors import managed

# 由 Node apps/api 的 encryptCredential 生成,key=0123456789abcdef0123456789abcdef
NODE_CIPHERTEXT = "enc:v1:yyxomNelSggF+Od4:YrUAWtr96o1umRI/W7GWSA==:epW17eZU5TrdwXr5nddf4IOC/A=="


def test_node_enc_v1_is_decryptable(monkeypatch):
    monkeypatch.setattr(settings, "credentials_encryption_key", "0123456789abcdef0123456789abcdef")
    assert tpa._decrypt_secret(NODE_CIPHERTEXT) == "tenant-secret-value"


def test_plaintext_legacy_secret_is_returned_as_is(monkeypatch):
    monkeypatch.setattr(settings, "credentials_encryption_key", "0123456789abcdef0123456789abcdef")
    assert tpa._decrypt_secret("legacy-plain") == "legacy-plain"


def test_non_uuid_scope_never_touches_db(monkeypatch):
    def boom():
        raise AssertionError("个人作用域不得查 tenant_platform_apps")

    monkeypatch.setattr(tpa, "_pg_session", boom)
    assert tpa.resolve_tenant_platform_credentials("user:30763d9f", "feishu") is None
    assert tpa.resolve_tenant_platform_credentials(None, "feishu") is None


def test_managed_status_prefers_tenant_row(monkeypatch):
    monkeypatch.setattr(
        managed,
        "resolve_tenant_platform_credentials",
        lambda scope, conn_type: {
            "app_id": "cli_tenant_a",
            "app_secret": "tenant-secret",
            "extra": {},
            "source": "tenant",
        },
    )
    st = managed.status("feishu", "22222222-2222-2222-2222-222222222222")
    assert st["available"] is True
    assert st["credential_source"] == "tenant"
    assert st["multi_tenant"] is True


def test_other_tenant_cannot_fall_back_to_platform_env(monkeypatch):
    monkeypatch.setattr(managed, "resolve_tenant_platform_credentials", lambda scope, conn_type: None)
    monkeypatch.setenv("CONNECTOR_MULTI_TENANT", "1")
    monkeypatch.setenv("CONNECTOR_MANAGED_TENANT_ID", "11111111-1111-1111-1111-111111111111")
    monkeypatch.setattr(managed, "platform_default_tenant_id", lambda: "")
    st = managed.status("feishu", "22222222-2222-2222-2222-222222222222")
    assert st["available"] is False
    assert "其他租户" in st["reason"]


def test_tenant_row_query_passes_params_as_one_sequence(monkeypatch):
    """SyncPgSession.fetchrow(sql, params) 是 (sql, 序列) 两参形态;传成三个位置参会 TypeError。"""
    tenant = "33333333-3333-3333-3333-333333333333"
    seen: dict[str, object] = {}

    class FakeSession:
        def fetchrow(self, sql, params=()):
            seen["params"] = params
            return {
                "app_id": "cli_tenant",
                "app_secret": NODE_CIPHERTEXT,
                "extra": {"agent_id": "100"},
            }

    monkeypatch.setattr(settings, "credentials_encryption_key", "0123456789abcdef0123456789abcdef")
    monkeypatch.setattr(tpa, "_pg", FakeSession())
    monkeypatch.setattr(tpa, "_pg_session", lambda: tpa._pg)
    tpa.clear_tenant_platform_cache()
    got = tpa.resolve_tenant_platform_credentials(tenant, "feishu")
    assert seen["params"] == (tenant, "feishu")
    assert got is not None
    assert got["app_secret"] == "tenant-secret-value"
    assert got["extra"] == {"agent_id": "100"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
