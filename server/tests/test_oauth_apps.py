"""OAuth 应用管理 + 授权流程端到端测试 (Round 23 补齐).

覆盖 oauth_apps.py 9 个 endpoint:
  1. GET  /oauth-apps/manage                       管理页面元信息
  2. POST /oauth-apps/create                       创建应用 (含 redirect_uris 白名单)
  3. GET  /oauth-apps/list                         应用列表 (不返回 client_secret)
  4. GET  /oauth-apps/{client_id}                  应用详情 (不返回 client_secret)
  5. DELETE /oauth-apps/{client_id}                软删除 (置 is_active=0)
  6. GET  /oauth-apps/authorize                    OAuth2 授权码签发 (含 PKCE + 白名单校验)
  7. POST /oauth-apps/token                        授权码换 access_token + refresh_token (含 PKCE 校验)
  8. POST /oauth-apps/refresh                      refresh_token 换新 access_token
  9. POST /oauth-apps/{client_id}/reset-secret     重置密钥 (旧 secret 失效)

实现策略:
  - dependency_overrides[require_login] 绕过认证
  - 临时 SQLite + StaticPool 单连接 + Base.metadata.create_all 建真实表
  - patch app.api.v1.agents.oauth_apps.get_session 返回临时 session 上下文
  - PKCE S256 用真实 hashlib 计算验证
"""
from __future__ import annotations

import base64
import hashlib
import secrets
import time
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def oauth_db(tmp_path):
    """临时 SQLite + OAuthApp/OAuthSession 真实表 + get_session patch.

    使用 StaticPool 强制单连接, 确保 commit 后所有 session 立即可见.
    返回 (engine, SessionClass) 元组, 测试用同一 SessionClass 插数据.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.database import Base
    from app.models.oauth_models import (
        OAuthApp,
        OAuthAuditLog,
        OAuthScopeMeta,
        OAuthSession,
    )

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[
            OAuthApp.__table__,
            OAuthSession.__table__,
            OAuthAuditLog.__table__,
            OAuthScopeMeta.__table__,
        ],
    )
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    class _Ctx:
        def __enter__(self):
            self.session = Session()
            return self.session

        def __exit__(self, *a):
            self.session.close()

    ctx_instance = _Ctx()
    with patch("app.api.v1.agents.oauth_apps.get_session", return_value=ctx_instance):
        yield engine, Session


@pytest.fixture
def auth_override():
    """覆盖 require_login 依赖, 模拟已登录用户."""
    from app.main import app
    from app.security import require_login

    def _fake_user():
        return "u-test-oauth"

    app.dependency_overrides[require_login] = _fake_user
    yield "u-test-oauth"
    app.dependency_overrides.pop(require_login, None)


def _create_app_via_api(
    sync_client,
    auth_override,
    name: str = "test-app",
    redirect_uri: str = "https://example.com/cb",
    redirect_uris: list = None,
):
    """通过 API 创建应用, 返回 (client_id, client_secret)."""
    payload = {"name": name}
    if redirect_uri:
        payload["redirect_uri"] = redirect_uri
    if redirect_uris is not None:
        payload["redirect_uris"] = redirect_uris
    r = sync_client.post("/api/v1/agents/oauth-apps/create", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    return body["client_id"], body["client_secret"]


def _make_pkce_pair() -> tuple:
    """生成 PKCE code_verifier + code_challenge (S256)."""
    code_verifier = secrets.token_urlsafe(64)[:128]
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return code_verifier, code_challenge


# ---------------------------------------------------------------------------
# 1. GET /oauth-apps/manage
# ---------------------------------------------------------------------------


class TestOAuthAppManage:
    def test_manage_returns_page_info(self, sync_client, auth_override):
        """管理页面返回基础元信息 + 完整 API 文档 (Round 23 增强)."""
        r = sync_client.get("/api/v1/agents/oauth-apps/manage")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["page"] == "oauth_app_management"
        assert body["version"] == "round-23"
        assert "endpoints" in body
        assert "create" in body["endpoints"]
        # Round 23: 验证完整端点文档
        assert "authorize" in body["endpoints"]
        assert "token" in body["endpoints"]
        assert "refresh" in body["endpoints"]
        assert "reset_secret" in body["endpoints"]
        # Round 23: 验证 OAuth2 流程文档
        assert "oauth2_flow" in body
        assert "step_1_authorize" in body["oauth2_flow"]
        assert "step_2_token" in body["oauth2_flow"]
        assert "step_3_refresh" in body["oauth2_flow"]
        # Round 23: 验证 PKCE / scope / redirect_uri 指南
        assert "pkce_guide" in body
        assert "scope_guide" in body
        assert "redirect_uri_guide" in body
        assert "security_notes" in body


# ---------------------------------------------------------------------------
# 2. POST /oauth-apps/create
# ---------------------------------------------------------------------------


class TestCreateOAuthApp:
    def test_create_with_single_redirect_uri(
        self, sync_client, oauth_db, auth_override
    ):
        """创建应用 (单回调 URI)."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, name="单回调应用"
        )
        assert client_id
        assert len(client_secret) >= 32

    def test_create_with_redirect_uris_whitelist(
        self, sync_client, oauth_db, auth_override
    ):
        """创建应用 (多回调白名单, Round 22)."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={
                "name": "多回调应用",
                "redirect_uris": [
                    "https://a.com/cb",
                    "https://b.com/cb",
                ],
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["redirect_uris"] == ["https://a.com/cb", "https://b.com/cb"]

    def test_create_name_empty_rejected(self, sync_client, oauth_db, auth_override):
        """name 为空拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": ""},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_create_redirect_uris_not_list_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """redirect_uris 非数组拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "x", "redirect_uris": "https://a.com/cb"},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_create_redirect_uris_empty_element_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """redirect_uris 数组含空字符串拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "x", "redirect_uris": ["https://a.com/cb", ""]},
        )
        body = r.json()
        assert body["code"] == "400000"


# ---------------------------------------------------------------------------
# 3. GET /oauth-apps/list
# ---------------------------------------------------------------------------


class TestListOAuthApps:
    def test_list_empty(self, sync_client, oauth_db, auth_override):
        """空列表."""
        r = sync_client.get("/api/v1/agents/oauth-apps/list")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0

    def test_list_default_only_active(self, sync_client, oauth_db, auth_override):
        """默认仅返回 is_active=1."""
        _create_app_via_api(sync_client, auth_override, name="app1")
        _create_app_via_api(sync_client, auth_override, name="app2")
        r = sync_client.get("/api/v1/agents/oauth-apps/list")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 2

    def test_list_no_client_secret(self, sync_client, oauth_db, auth_override):
        """list 绝不返回 client_secret."""
        _create_app_via_api(sync_client, auth_override, name="app-secret-check")
        r = sync_client.get("/api/v1/agents/oauth-apps/list")
        body = r.json()
        for item in body["data"]:
            assert "client_secret" not in item


# ---------------------------------------------------------------------------
# 4. GET /oauth-apps/{client_id}
# ---------------------------------------------------------------------------


class TestGetOAuthApp:
    def test_get_detail_success(self, sync_client, oauth_db, auth_override):
        """详情成功 (不返回 client_secret)."""
        client_id, _ = _create_app_via_api(sync_client, auth_override, name="detail-app")
        r = sync_client.get(f"/api/v1/agents/oauth-apps/{client_id}")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["client_id"] == client_id
        assert "client_secret" not in body

    def test_get_detail_not_found(self, sync_client, oauth_db, auth_override):
        """不存在的 client_id 返回 404."""
        r = sync_client.get("/api/v1/agents/oauth-apps/no-such-client")
        body = r.json()
        assert body["code"] == "404000"


# ---------------------------------------------------------------------------
# 5. DELETE /oauth-apps/{client_id}
# ---------------------------------------------------------------------------


class TestDeleteOAuthApp:
    def test_delete_soft_delete(self, sync_client, oauth_db, auth_override):
        """删除 = 软删除 (置 is_active=0)."""
        client_id, _ = _create_app_via_api(sync_client, auth_override, name="del-app")
        r = sync_client.delete(f"/api/v1/agents/oauth-apps/{client_id}")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["is_active"] == 0

    def test_delete_not_found(self, sync_client, oauth_db, auth_override):
        """删除不存在的应用返回 404."""
        r = sync_client.delete("/api/v1/agents/oauth-apps/no-such-client")
        body = r.json()
        assert body["code"] == "404000"

    def test_delete_already_disabled(self, sync_client, oauth_db, auth_override):
        """已禁用应用再次删除返回 400."""
        client_id, _ = _create_app_via_api(sync_client, auth_override, name="double-del")
        sync_client.delete(f"/api/v1/agents/oauth-apps/{client_id}")
        r = sync_client.delete(f"/api/v1/agents/oauth-apps/{client_id}")
        body = r.json()
        assert body["code"] == "400000"


# ---------------------------------------------------------------------------
# 6. GET /oauth-apps/authorize
# ---------------------------------------------------------------------------


class TestOAuthAuthorize:
    def test_authorize_success_basic(self, sync_client, oauth_db, auth_override):
        """基础授权码签发 (无 PKCE)."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override,
            name="auth-basic",
            redirect_uri="https://example.com/cb",
        )
        r = sync_client.get(
            f"/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "response_type": "code",
                "state": "xyz-state",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["code"]
        assert body["state"] == "xyz-state"
        assert body["pkce_required"] is False
        assert body["expires_in"] == 300

    def test_authorize_state_required(self, sync_client, oauth_db, auth_override):
        """state 必传 (CSRF 防护). FastAPI Query(...) 必传校验返回 400002."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            f"/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "response_type": "code",
            },
        )
        body = r.json()
        # FastAPI Query(...) 必传校验失败返回 400002 (validation error)
        assert body["code"] in ("400000", "400002")

    def test_authorize_invalid_client(self, sync_client, oauth_db, auth_override):
        """无效 client_id 拒绝."""
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": "invalid-client",
                "redirect_uri": "https://example.com/cb",
                "state": "x",
            },
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_authorize_redirect_uri_whitelist_exact_match(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 22: redirect_uris 白名单精确匹配."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={
                "name": "whitelist-app",
                "redirect_uris": [
                    "https://a.com/cb",
                    "https://b.com/cb",
                ],
            },
        )
        client_id = r.json()["data"]["client_id"]

        # 精确匹配白名单内的 URI 通过
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://b.com/cb",
                "state": "x",
            },
        )
        assert r.status_code == 200, r.text

    def test_authorize_redirect_uri_whitelist_mismatch_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 22: 白名单不匹配拒绝 (精确匹配, 不再前缀校验)."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={
                "name": "whitelist-mismatch",
                "redirect_uris": ["https://a.com/cb"],
            },
        )
        client_id = r.json()["data"]["client_id"]

        # 白名单外 URI 拒绝 (即使前缀匹配也不行, 精确匹配)
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://a.com/cb/extra",
                "state": "x",
            },
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_authorize_redirect_uri_fallback_prefix(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 22: 无 redirect_uris 时回退 redirect_uri 前缀校验 (向后兼容)."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override,
            name="fallback-app",
            redirect_uri="https://legacy.com/cb",
        )
        # 前缀匹配的 URI 通过 (向后兼容)
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://legacy.com/cb?extra=1",
                "state": "x",
            },
        )
        assert r.status_code == 200, r.text

    def test_authorize_with_pkce(self, sync_client, oauth_db, auth_override):
        """Round 22: PKCE 授权码签发."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        _, code_challenge = _make_pkce_pair()
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "pkce-state",
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["pkce_required"] is True

    def test_authorize_pkce_plain_method_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 22: PKCE plain method 拒绝 (仅支持 S256)."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
                "code_challenge": "some-challenge",
                "code_challenge_method": "plain",
            },
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_authorize_scope_subset_granted(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 23: scope 在应用允许范围内, 授权成功."""
        # 创建应用, 允许 read:profile + write:orders
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={
                "name": "scope-app",
                "redirect_uri": "https://example.com/cb",
                "scopes": ["read:profile", "write:orders"],
            },
        )
        client_id = r.json()["data"]["client_id"]

        # 请求 read:profile 子集
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "scope-state",
                "scope": "read:profile",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["scope"] == "read:profile"

    def test_authorize_scope_invalid_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 23: scope 不在应用允许范围内拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={
                "name": "scope-strict",
                "redirect_uri": "https://example.com/cb",
                "scopes": ["read:profile"],
            },
        )
        client_id = r.json()["data"]["client_id"]

        # 请求 admin:all (不在允许范围)
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
                "scope": "admin:all",
            },
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_authorize_scope_empty_defaults_to_all(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 23: 客户端未传 scope, 默认授权应用全部 scopes."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={
                "name": "scope-default",
                "redirect_uri": "https://example.com/cb",
                "scopes": ["read:profile", "write:orders"],
            },
        )
        client_id = r.json()["data"]["client_id"]

        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        # 默认授权全部 scopes (空格分隔)
        assert "read:profile" in body["scope"]
        assert "write:orders" in body["scope"]

    def test_authorize_scope_no_app_config_passthrough(
        self, sync_client, oauth_db, auth_override
    ):
        """Round 23: 应用未配置 scopes, 请求 scope 直接放行 (向后兼容)."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
                "scope": "custom:scope",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["scope"] == "custom:scope"


# ---------------------------------------------------------------------------
# 7. POST /oauth-apps/token
# ---------------------------------------------------------------------------


class TestOAuthToken:
    def test_token_full_flow_without_pkce(self, sync_client, oauth_db, auth_override):
        """完整流程 (无 PKCE): authorize → token."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        # 1. authorize
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "flow-state",
            },
        )
        code = r.json()["data"]["code"]

        # 2. token
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "flow-state",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["access_token"]
        assert body["token_type"] == "Bearer"
        assert body["refresh_token"]
        assert body["expires_in"] == 3600

    def test_token_full_flow_with_pkce(self, sync_client, oauth_db, auth_override):
        """完整流程 (PKCE): authorize → token."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        code_verifier, code_challenge = _make_pkce_pair()

        # 1. authorize with PKCE
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "pkce-flow",
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            },
        )
        code = r.json()["data"]["code"]

        # 2. token with code_verifier
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "pkce-flow",
                "code_verifier": code_verifier,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["access_token"]

    def test_token_pkce_verifier_missing_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """PKCE 流程 token 阶段缺 code_verifier 拒绝."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        _, code_challenge = _make_pkce_pair()

        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            },
        )
        code = r.json()["data"]["code"]

        # token 不传 code_verifier
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "x",
            },
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_token_pkce_verifier_mismatch_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """PKCE 校验失败 (verifier 不匹配 challenge) 拒绝."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        _, code_challenge = _make_pkce_pair()

        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            },
        )
        code = r.json()["data"]["code"]

        # token 传错误的 code_verifier
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "x",
                "code_verifier": "wrong-verifier",
            },
        )
        body = r.json()
        assert body["code"] == "401000"

    def test_token_invalid_client_credentials(
        self, sync_client, oauth_db, auth_override
    ):
        """client 凭证错误拒绝."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": "any-code",
                "client_id": client_id,
                "client_secret": "wrong-secret",
            },
        )
        body = r.json()
        assert body["code"] == "401000"

    def test_token_code_already_used(self, sync_client, oauth_db, auth_override):
        """授权码一次性使用, 第二次拒绝."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
            },
        )
        code = r.json()["data"]["code"]

        # 第一次使用成功
        r1 = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "x",
            },
        )
        assert r1.status_code == 200

        # 第二次使用拒绝
        r2 = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "x",
            },
        )
        body = r2.json()
        assert body["code"] == "401000"

    def test_token_state_mismatch_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """state 不一致拒绝 (CSRF 防护)."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "original-state",
            },
        )
        code = r.json()["data"]["code"]

        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "wrong-state",
            },
        )
        body = r.json()
        assert body["code"] == "400000"


# ---------------------------------------------------------------------------
# 8. POST /oauth-apps/refresh
# ---------------------------------------------------------------------------


class TestOAuthRefresh:
    def test_refresh_success(self, sync_client, oauth_db, auth_override):
        """refresh_token 换新 access_token 成功."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        # 拿到 refresh_token
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "refresh-state",
            },
        )
        code = r.json()["data"]["code"]
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "refresh-state",
            },
        )
        refresh_token = r.json()["data"]["refresh_token"]

        # refresh
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/refresh",
            json={"refresh_token": refresh_token},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["access_token"]
        assert body["token_type"] == "Bearer"

    def test_refresh_with_invalid_token_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """无效 refresh_token 拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/refresh",
            json={"refresh_token": "not-a-jwt"},
        )
        body = r.json()
        assert body["code"] == "401000"

    def test_refresh_access_token_not_accepted(
        self, sync_client, oauth_db, auth_override
    ):
        """access_token 不能用作 refresh_token (type 不匹配)."""
        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
            },
        )
        code = r.json()["data"]["code"]
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "x",
            },
        )
        access_token = r.json()["data"]["access_token"]

        # 用 access_token 当 refresh_token 应被拒绝
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/refresh",
            json={"refresh_token": access_token},
        )
        body = r.json()
        assert body["code"] == "401000"


# ---------------------------------------------------------------------------
# 9. POST /oauth-apps/{client_id}/reset-secret
# ---------------------------------------------------------------------------


class TestResetSecret:
    def test_reset_secret_success(self, sync_client, oauth_db, auth_override):
        """重置密钥成功, 新 secret 仅此一次返回."""
        client_id, original_secret = _create_app_via_api(
            sync_client, auth_override, name="reset-app"
        )
        r = sync_client.post(f"/api/v1/agents/oauth-apps/{client_id}/reset-secret")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        new_secret = body["client_secret"]
        assert new_secret != original_secret
        assert "warning" in body

    def test_reset_secret_invalidates_old(
        self, sync_client, oauth_db, auth_override
    ):
        """重置后旧 secret 失效 (用旧 secret 换 token 拒绝)."""
        client_id, original_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        # 重置
        r = sync_client.post(f"/api/v1/agents/oauth-apps/{client_id}/reset-secret")
        new_secret = r.json()["data"]["client_secret"]

        # 拿一个 code
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "x",
            },
        )
        code = r.json()["data"]["code"]

        # 用旧 secret 换 token 拒绝
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": original_secret,
                "state": "x",
            },
        )
        body = r.json()
        assert body["code"] == "401000"

    def test_reset_secret_not_found(self, sync_client, oauth_db, auth_override):
        """重置不存在的应用返回 404."""
        r = sync_client.post("/api/v1/agents/oauth-apps/no-such/reset-secret")
        body = r.json()
        assert body["code"] == "404000"

    def test_reset_secret_disabled_app_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """已禁用应用无法重置密钥."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, name="disabled-reset"
        )
        # 先删除 (软删除)
        sync_client.delete(f"/api/v1/agents/oauth-apps/{client_id}")
        # 再重置
        r = sync_client.post(f"/api/v1/agents/oauth-apps/{client_id}/reset-secret")
        body = r.json()
        assert body["code"] == "400000"


# ---------------------------------------------------------------------------
# 端点覆盖校验
# ---------------------------------------------------------------------------


class TestEndpointsCovered:
    """验证 oauth_apps 模块所有 endpoint 都已注册."""

    def test_all_endpoints_registered(self):
        """遍历 router.routes, 验证 12 个 endpoint 已注册 (Round 27 新增 3 个)."""
        from app.api.v1.agents.oauth_apps import router

        paths = set()
        for route in router.routes:
            if hasattr(route, "methods") and hasattr(route, "path"):
                for method in route.methods:
                    if method in ("GET", "POST", "PUT", "DELETE"):
                        paths.add((method, route.path))

        # 12 个 endpoint (Round 21: 9 个 + Round 27: 3 个)
        expected = {
            ("GET", "/oauth-apps/manage"),
            ("POST", "/oauth-apps/create"),
            ("GET", "/oauth-apps/list"),
            ("GET", "/oauth-apps/{client_id}"),
            ("DELETE", "/oauth-apps/{client_id}"),
            ("GET", "/oauth-apps/authorize"),
            ("POST", "/oauth-apps/token"),
            ("POST", "/oauth-apps/refresh"),
            ("POST", "/oauth-apps/{client_id}/reset-secret"),
            # Round 27-A: scope 中间件示范 endpoint
            ("GET", "/oauth-apps/protected/profile"),
            ("GET", "/oauth-apps/protected/orders"),
            # Round 27-C: 审计日志查询 endpoint
            ("GET", "/oauth-apps/audit-logs"),
        }
        missing = expected - paths
        assert not missing, f"缺失 endpoint: {missing}"


# ---------------------------------------------------------------------------
# Round 25: OAuth scope 中间件校验 (require_oauth_scope)
# ---------------------------------------------------------------------------


class TestRequireOAuthScope:
    """Round 25: OAuth scope 中间件校验测试."""

    def test_scope_satisfied(self):
        """token 含所需 scope, 校验通过."""
        from app.security import create_access_token, require_oauth_scope

        token = create_access_token(
            subject="u-scope-test",
            extra_claims={"scope": "read:profile write:orders"},
        )

        # 构造 fake credentials 对象
        from fastapi.security import HTTPAuthorizationCredentials

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        dep = require_oauth_scope("read:profile")

        import asyncio

        user_uuid = asyncio.get_event_loop().run_until_complete(dep(creds))
        assert user_uuid == "u-scope-test"

    def test_scope_insufficient_rejected(self):
        """token 不含所需 scope, 403 拒绝."""
        from fastapi import HTTPException
        from fastapi.security import HTTPAuthorizationCredentials

        from app.security import create_access_token, require_oauth_scope

        token = create_access_token(
            subject="u-scope-test",
            extra_claims={"scope": "read:profile"},
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        dep = require_oauth_scope("write:orders")

        import asyncio

        with pytest.raises(HTTPException) as exc_info:
            asyncio.get_event_loop().run_until_complete(dep(creds))
        assert exc_info.value.status_code == 403

    def test_no_scope_claim_rejected(self):
        """token 无 scope 字段, 403 拒绝."""
        from fastapi import HTTPException
        from fastapi.security import HTTPAuthorizationCredentials

        from app.security import create_access_token, require_oauth_scope

        token = create_access_token(subject="u-no-scope")  # 无 extra_claims
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        dep = require_oauth_scope("read:profile")

        import asyncio

        with pytest.raises(HTTPException) as exc_info:
            asyncio.get_event_loop().run_until_complete(dep(creds))
        assert exc_info.value.status_code == 403

    def test_missing_token_rejected(self):
        """无 token, 401 拒绝."""
        from fastapi import HTTPException

        from app.security import require_oauth_scope

        dep = require_oauth_scope("read:profile")

        import asyncio

        with pytest.raises(HTTPException) as exc_info:
            asyncio.get_event_loop().run_until_complete(dep(None))
        assert exc_info.value.status_code == 401

    def test_invalid_token_rejected(self):
        """无效 token, 401 拒绝."""
        from fastapi import HTTPException
        from fastapi.security import HTTPAuthorizationCredentials

        from app.security import require_oauth_scope

        creds = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials="not-a-jwt"
        )
        dep = require_oauth_scope("read:profile")

        import asyncio

        with pytest.raises(HTTPException) as exc_info:
            asyncio.get_event_loop().run_until_complete(dep(creds))
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Round 25: OAuth 授权码自动清理任务 (task_cleanup_oauth_sessions)
# ---------------------------------------------------------------------------


class TestCleanupOAuthSessions:
    """Round 25: OAuth 授权码清理任务测试."""

    def test_cleanup_removes_used_and_expired(self):
        """清理任务删除 is_used=1 或 expires_at < now 的记录."""
        import datetime as dt
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool

        from app.database import Base
        from app.models.oauth_models import OAuthSession

        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(engine, tables=[OAuthSession.__table__])
        Session = sessionmaker(bind=engine, expire_on_commit=False)

        now = dt.datetime.now()
        with Session() as s:
            # 3 条记录: 已使用 / 已过期 / 有效
            s.add(OAuthSession(
                code="used", client_id="c1", user_uuid="u1",
                expires_at=now + dt.timedelta(seconds=300),
                is_used=1,  # 已使用
            ))
            s.add(OAuthSession(
                code="expired", client_id="c1", user_uuid="u1",
                expires_at=now - dt.timedelta(seconds=60),  # 已过期
                is_used=0,
            ))
            s.add(OAuthSession(
                code="valid", client_id="c1", user_uuid="u1",
                expires_at=now + dt.timedelta(seconds=300),  # 有效
                is_used=0,
            ))
            s.commit()

        # 用 patch 让 get_session 返回我们的 session 上下文
        class _Ctx:
            def __init__(self, session_factory):
                self._sf = session_factory

            def __enter__(self):
                self.session = self._sf()
                return self.session

            def __exit__(self, *a):
                self.session.close()

        ctx = _Ctx(Session)
        import asyncio
        from app.tasks.scheduler import task_cleanup_oauth_sessions

        # scheduler.py 内 import get_session, patch app.database.get_session
        with patch("app.database.get_session", return_value=ctx):
            asyncio.get_event_loop().run_until_complete(task_cleanup_oauth_sessions())

        # 验证: 只剩 1 条 (valid)
        with Session() as s:
            remaining = s.query(OAuthSession).all()
            assert len(remaining) == 1
            assert remaining[0].code == "valid"

    def test_cleanup_idempotent(self):
        """清理任务幂等: 无废数据时不报错, 不删除有效记录."""
        import datetime as dt
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool

        from app.database import Base
        from app.models.oauth_models import OAuthSession

        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(engine, tables=[OAuthSession.__table__])
        Session = sessionmaker(bind=engine, expire_on_commit=False)

        now = dt.datetime.now()
        with Session() as s:
            # 仅 1 条有效记录
            s.add(OAuthSession(
                code="valid", client_id="c1", user_uuid="u1",
                expires_at=now + dt.timedelta(seconds=300),
                is_used=0,
            ))
            s.commit()

        class _Ctx:
            def __init__(self, sf):
                self._sf = sf

            def __enter__(self):
                self.session = self._sf()
                return self.session

            def __exit__(self, *a):
                self.session.close()

        ctx = _Ctx(Session)
        import asyncio
        from app.tasks.scheduler import task_cleanup_oauth_sessions

        with patch("app.database.get_session", return_value=ctx):
            asyncio.get_event_loop().run_until_complete(task_cleanup_oauth_sessions())

        # 验证: 有效记录仍存在
        with Session() as s:
            remaining = s.query(OAuthSession).all()
            assert len(remaining) == 1
            assert remaining[0].code == "valid"

    def test_cleanup_task_registered_in_scheduler(self):
        """验证清理任务已注册到 scheduler."""
        from app.tasks.scheduler import start_scheduler, scheduler

        # 注意: 不真正 start (会启动后台线程), 仅检查 add_job 调用
        # 通过检查 start_scheduler 函数源码字符串验证注册
        import inspect

        src = inspect.getsource(start_scheduler)
        assert "task_cleanup_oauth_sessions" in src
        assert "oauth_session_cleanup_daily" in src


# ---------------------------------------------------------------------------
# Round 27-A: OAuth scope 中间件示范 endpoint (/protected/profile + /protected/orders)
# ---------------------------------------------------------------------------


class TestProtectedEndpoints:
    """Round 27-A: 受 OAuth scope 保护的示范 endpoint 测试."""

    def test_protected_profile_with_valid_scope(
        self, sync_client, oauth_db, auth_override
    ):
        """携带含 read:profile scope 的 access_token, 访问 profile 成功."""
        from app.security import create_access_token

        # 走完整 OAuth 流程拿到含 scope 的 token
        client_id, client_secret = _create_app_via_api(
            sync_client,
            auth_override,
            redirect_uri="https://example.com/cb",
            redirect_uris=["https://example.com/cb"],
        )
        # 注: create_oauth_app 不传 scopes, _validate_scope 会放行请求 scope
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "s1",
                "scope": "read:profile",
            },
        )
        code = r.json()["data"]["code"]
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "s1",
            },
        )
        access_token = r.json()["data"]["access_token"]

        # 用 access_token 访问 protected/profile
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/protected/profile",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["scope_required"] == "read:profile"
        assert body["demo"] is True

    def test_protected_profile_with_insufficient_scope_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """token 不含 read:profile scope, 403 拒绝."""
        from app.security import create_access_token

        # 创建 token 仅含 read:orders scope
        client_id, client_secret = _create_app_via_api(
            sync_client,
            auth_override,
            redirect_uri="https://example.com/cb",
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "s1",
                "scope": "read:orders",  # 仅 read:orders, 不含 read:profile
            },
        )
        code = r.json()["data"]["code"]
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "s1",
            },
        )
        access_token = r.json()["data"]["access_token"]

        # 用仅含 read:orders 的 token 访问 protected/profile, 应 403
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/protected/profile",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert r.status_code == 403, r.text

    def test_protected_profile_no_token_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """无 Authorization header, 401 拒绝."""
        _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get("/api/v1/agents/oauth-apps/protected/profile")
        assert r.status_code == 401, r.text

    def test_protected_orders_with_valid_scope(
        self, sync_client, oauth_db, auth_override
    ):
        """携带含 read:orders scope 的 access_token, 访问 orders 成功."""
        client_id, client_secret = _create_app_via_api(
            sync_client,
            auth_override,
            redirect_uri="https://example.com/cb",
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "s1",
                "scope": "read:orders",
            },
        )
        code = r.json()["data"]["code"]
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "s1",
            },
        )
        access_token = r.json()["data"]["access_token"]

        r = sync_client.get(
            "/api/v1/agents/oauth-apps/protected/orders",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["scope_required"] == "read:orders"


# ---------------------------------------------------------------------------
# Round 27-C: OAuth 审计日志 (写入 + 查询)
# ---------------------------------------------------------------------------


class TestOAuthAuditLogWrite:
    """Round 27-C: OAuth 敏感操作写入审计日志."""

    def test_audit_log_on_app_create(self, sync_client, oauth_db, auth_override):
        """创建应用 → 写入 app_create 审计日志."""
        from app.models.oauth_models import OAuthAuditLog

        _create_app_via_api(sync_client, auth_override, name="audit-test")
        # 查审计日志表
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(event="app_create").all()
            assert len(logs) >= 1
            assert logs[0].status == "success"
            assert logs[0].user_uuid == "u-test-oauth"

    def test_audit_log_on_app_delete(self, sync_client, oauth_db, auth_override):
        """删除应用 → 写入 app_delete 审计日志."""
        from app.models.oauth_models import OAuthAuditLog

        client_id, _ = _create_app_via_api(
            sync_client, auth_override, name="delete-audit"
        )
        sync_client.delete(f"/api/v1/agents/oauth-apps/{client_id}")
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(event="app_delete").all()
            assert len(logs) >= 1
            assert logs[0].status == "success"
            assert logs[0].client_id == client_id

    def test_audit_log_on_reset_secret(self, sync_client, oauth_db, auth_override):
        """重置密钥 → 写入 app_reset_secret 审计日志."""
        from app.models.oauth_models import OAuthAuditLog

        client_id, _ = _create_app_via_api(
            sync_client, auth_override, name="reset-audit"
        )
        sync_client.post(f"/api/v1/agents/oauth-apps/{client_id}/reset-secret")
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(
                event="app_reset_secret"
            ).all()
            assert len(logs) >= 1
            assert logs[0].status == "success"

    def test_audit_log_on_authorize_grant(
        self, sync_client, oauth_db, auth_override
    ):
        """授权签发 code → 写入 authorize_grant 审计日志."""
        from app.models.oauth_models import OAuthAuditLog

        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "audit-state",
            },
        )
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(
                event="authorize_grant"
            ).all()
            assert len(logs) >= 1
            assert logs[0].status == "success"
            assert logs[0].client_id == client_id

    def test_audit_log_on_token_issue_success(
        self, sync_client, oauth_db, auth_override
    ):
        """code 换 token 成功 → 写入 token_issue success 审计日志."""
        from app.models.oauth_models import OAuthAuditLog

        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "s1",
            },
        )
        code = r.json()["data"]["code"]
        sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "s1",
            },
        )
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(
                event="token_issue", status="success"
            ).all()
            assert len(logs) >= 1

    def test_audit_log_on_token_issue_failure(
        self, sync_client, oauth_db, auth_override
    ):
        """code 换 token 失败 (凭证错误) → 写入 token_issue failure 审计日志."""
        from app.models.oauth_models import OAuthAuditLog

        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": "any-code",
                "client_id": client_id,
                "client_secret": "wrong-secret",
            },
        )
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(
                event="token_issue", status="failure"
            ).all()
            assert len(logs) >= 1
            assert "Invalid client credentials" in (logs[0].detail or "")

    def test_audit_log_on_token_refresh(
        self, sync_client, oauth_db, auth_override
    ):
        """refresh_token 换新 token → 写入 token_refresh 审计日志."""
        from app.models.oauth_models import OAuthAuditLog

        client_id, client_secret = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "s1",
            },
        )
        code = r.json()["data"]["code"]
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "state": "s1",
            },
        )
        refresh_token = r.json()["data"]["refresh_token"]
        # 用 refresh_token 换新 token
        sync_client.post(
            "/api/v1/agents/oauth-apps/refresh",
            json={"refresh_token": refresh_token, "client_id": client_id},
        )
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(
                event="token_refresh", status="success"
            ).all()
            assert len(logs) >= 1

    def test_audit_log_request_summary_no_sensitive(
        self, sync_client, oauth_db, auth_override
    ):
        """审计日志 request_summary 不含 client_secret / code_verifier 等敏感字段."""
        from app.models.oauth_models import OAuthAuditLog

        _create_app_via_api(sync_client, auth_override, name="sensitive-check")
        engine, Session = oauth_db
        with Session() as s:
            logs = s.query(OAuthAuditLog).filter_by(event="app_create").all()
            assert len(logs) >= 1
            summary = logs[0].request_summary or {}
            # 不应包含 client_secret
            assert "client_secret" not in summary
            # 应包含 name (非敏感)
            assert "name" in summary


class TestOAuthAuditLogQuery:
    """Round 27-C: 审计日志查询 endpoint (GET /oauth-apps/audit-logs)."""

    def test_query_empty(self, sync_client, oauth_db, auth_override):
        """无审计日志时返回空列表."""
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0

    def test_query_after_create(self, sync_client, oauth_db, auth_override):
        """创建应用后, 查询审计日志返回 app_create 事件."""
        _create_app_via_api(sync_client, auth_override, name="query-test")
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1
        events = [item["event"] for item in body["data"]]
        assert "app_create" in events

    def test_query_filter_by_event(self, sync_client, oauth_db, auth_override):
        """按 event 筛选审计日志."""
        # 触发多种事件
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, name="filter-test"
        )
        sync_client.delete(f"/api/v1/agents/oauth-apps/{client_id}")
        # 仅查 app_delete 事件
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs",
            params={"event": "app_delete"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for item in body["data"]:
            assert item["event"] == "app_delete"

    def test_query_filter_by_status(self, sync_client, oauth_db, auth_override):
        """按 status 筛选审计日志 (success/failure)."""
        # 触发一个失败事件 (错误凭证换 token)
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        sync_client.post(
            "/api/v1/agents/oauth-apps/token",
            params={
                "code": "any-code",
                "client_id": client_id,
                "client_secret": "wrong-secret",
            },
        )
        # 仅查 failure 状态
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs",
            params={"status": "failure"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1
        for item in body["data"]:
            assert item["status"] == "failure"

    def test_query_filter_by_client_id(
        self, sync_client, oauth_db, auth_override
    ):
        """按 client_id 筛选审计日志."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, name="client-filter"
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs",
            params={"client_id": client_id},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1
        for item in body["data"]:
            assert item["client_id"] == client_id

    def test_query_pagination(self, sync_client, oauth_db, auth_override):
        """分页查询审计日志."""
        # 创建多个应用触发多条审计日志
        for i in range(5):
            _create_app_via_api(sync_client, auth_override, name=f"page-app-{i}")
        # 第 1 页, 每页 2 条
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs",
            params={"page": 1, "page_size": 2},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["page"] == 1
        assert body["page_size"] == 2
        assert body["total"] >= 5
        assert len(body["data"]) <= 2

    def test_query_invalid_start_time_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """start_time 格式错误拒绝."""
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs",
            params={"start_time": "not-a-date"},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_query_invalid_end_time_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """end_time 格式错误拒绝."""
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs",
            params={"end_time": "not-a-date"},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_query_returns_required_fields(
        self, sync_client, oauth_db, auth_override
    ):
        """查询返回的审计日志条目包含所有必需字段."""
        _create_app_via_api(sync_client, auth_override, name="fields-test")
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs")
        body = r.json()
        assert body["total"] >= 1
        item = body["data"][0]
        # 必需字段
        for field in (
            "id",
            "event",
            "client_id",
            "user_uuid",
            "ip",
            "status",
            "detail",
            "request_summary",
            "created_at",
        ):
            assert field in item, f"缺失字段: {field}"


# ---------------------------------------------------------------------------
# Round 29-A: OAuth 应用图标上传 (create_oauth_app 支持 icon 字段)
# ---------------------------------------------------------------------------


class TestRound29AAppIcon:
    """Round 29-A: OAuthApp.icon 字段 + create_oauth_app endpoint 支持 icon."""

    def test_create_app_with_icon(self, sync_client, oauth_db, auth_override):
        """创建应用时传入 icon URL, 应保存并在返回体中包含 icon."""
        icon_url = "https://example.com/icons/app1.png"
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "icon-app", "icon": icon_url},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["icon"] == icon_url

    def test_create_app_without_icon_returns_null(
        self, sync_client, oauth_db, auth_override
    ):
        """不传 icon 时, 返回 icon=null (向后兼容)."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "no-icon-app"},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["icon"] is None

    def test_create_app_icon_not_string_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """icon 非字符串拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "bad-icon", "icon": 123},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_create_app_icon_too_long_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """icon URL 长度超过 512 拒绝."""
        long_url = "https://example.com/" + "a" * 600
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "long-icon", "icon": long_url},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_list_returns_icon_field(
        self, sync_client, oauth_db, auth_override
    ):
        """list 返回的条目包含 icon 字段."""
        icon_url = "https://example.com/icons/list-test.png"
        _create_app_via_api(sync_client, auth_override, name="list-icon-app")
        sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "with-icon", "icon": icon_url},
        )
        r = sync_client.get("/api/v1/agents/oauth-apps/list")
        body = r.json()
        for item in body["data"]:
            assert "icon" in item

    def test_detail_returns_icon_field(
        self, sync_client, oauth_db, auth_override
    ):
        """详情返回的条目包含 icon 字段."""
        icon_url = "https://example.com/icons/detail.png"
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/create",
            json={"name": "detail-icon", "icon": icon_url},
        )
        client_id = r.json()["data"]["client_id"]
        r2 = sync_client.get(f"/api/v1/agents/oauth-apps/{client_id}")
        body = r2.json()["data"]
        assert body["icon"] == icon_url


# ---------------------------------------------------------------------------
# Round 29-B: 用户已授权应用查询 + 撤销
# ---------------------------------------------------------------------------


class TestRound29BMyAuthorized:
    """Round 29-B: GET /my-authorized + DELETE /my-authorized/{session_id}."""

    def test_list_my_authorized_empty(
        self, sync_client, oauth_db, auth_override
    ):
        """无授权记录时返回空列表."""
        r = sync_client.get("/api/v1/agents/oauth-apps/my-authorized")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0

    def test_list_my_authorized_after_authorize(
        self, sync_client, oauth_db, auth_override
    ):
        """授权后能在已授权列表中查到."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "my-auth-state",
            },
        )
        r = sync_client.get("/api/v1/agents/oauth-apps/my-authorized")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1
        item = body["data"][0]
        assert item["client_id"] == client_id
        # 必需字段
        for field in (
            "session_id",
            "client_id",
            "app_name",
            "app_icon",
            "app_active",
            "scope",
            "created_at",
        ):
            assert field in item, f"缺失字段: {field}"

    def test_revoke_my_authorized_success(
        self, sync_client, oauth_db, auth_override
    ):
        """撤销授权成功, session 记录被删除."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "revoke-state",
            },
        )
        r = sync_client.get("/api/v1/agents/oauth-apps/my-authorized")
        session_id = r.json()["data"][0]["session_id"]
        # 撤销
        r2 = sync_client.delete(
            f"/api/v1/agents/oauth-apps/my-authorized/{session_id}"
        )
        assert r2.status_code == 200, r2.text
        body = r2.json()["data"]
        assert body["session_id"] == session_id
        # 列表应不再包含该 session
        r3 = sync_client.get("/api/v1/agents/oauth-apps/my-authorized")
        items = [it["session_id"] for it in r3.json()["data"]]
        assert session_id not in items

    def test_revoke_nonexistent_session_returns_404(
        self, sync_client, oauth_db, auth_override
    ):
        """撤销不存在的 session_id 返回 404."""
        r = sync_client.delete("/api/v1/agents/oauth-apps/my-authorized/99999")
        body = r.json()
        assert body["code"] == "404000"

    def test_revoke_writes_authorize_deny_audit_log(
        self, sync_client, oauth_db, auth_override
    ):
        """撤销授权 → 写入 authorize_deny 审计日志 (detail=user_revoked_authorized_app)."""
        from app.models.oauth_models import OAuthAuditLog

        client_id, _ = _create_app_via_api(
            sync_client, auth_override, redirect_uri="https://example.com/cb"
        )
        sync_client.get(
            "/api/v1/agents/oauth-apps/authorize",
            params={
                "client_id": client_id,
                "redirect_uri": "https://example.com/cb",
                "state": "audit-revoke",
            },
        )
        r = sync_client.get("/api/v1/agents/oauth-apps/my-authorized")
        session_id = r.json()["data"][0]["session_id"]
        sync_client.delete(
            f"/api/v1/agents/oauth-apps/my-authorized/{session_id}"
        )
        engine, Session = oauth_db
        with Session() as s:
            logs = (
                s.query(OAuthAuditLog)
                .filter_by(event="authorize_deny", detail="user_revoked_authorized_app")
                .all()
            )
            assert len(logs) >= 1
            assert logs[0].status == "success"
            assert logs[0].client_id == client_id


# ---------------------------------------------------------------------------
# Round 29-C: 审计日志 CSV 导出
# ---------------------------------------------------------------------------


class TestRound29CCsvExport:
    """Round 29-C: GET /audit-logs/export (CSV 导出)."""

    def test_export_returns_csv_with_bom(
        self, sync_client, oauth_db, auth_override
    ):
        """导出返回 text/csv, 含 UTF-8 BOM 头."""
        _create_app_via_api(sync_client, auth_override, name="csv-export-app")
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/export")
        assert r.status_code == 200, r.text
        # Content-Type 是 text/csv
        assert "text/csv" in r.headers.get("content-type", "")
        # Content-Disposition 含 attachment; filename=
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert "filename" in cd
        # UTF-8 BOM 头 (xef bb bf)
        content = r.content
        assert content.startswith(b"\xef\xbb\xbf"), "CSV 应以 UTF-8 BOM 开头"

    def test_export_csv_contains_headers(
        self, sync_client, oauth_db, auth_override
    ):
        """CSV 第一行包含表头 (ID/事件/Client ID 等)."""
        _create_app_via_api(sync_client, auth_override, name="csv-headers-app")
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/export")
        content = r.content.decode("utf-8-sig")  # 去掉 BOM
        first_line = content.split("\n", 1)[0]
        # 表头至少包含这些列
        for header in ("ID", "事件", "Client ID"):
            assert header in first_line, f"CSV 表头缺失: {header}"

    def test_export_csv_with_event_filter(
        self, sync_client, oauth_db, auth_override
    ):
        """按 event 筛选导出, CSV 中只包含该 event 的记录."""
        _create_app_via_api(sync_client, auth_override, name="csv-filter-app")
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs/export",
            params={"event": "app_create"},
        )
        assert r.status_code == 200, r.text
        content = r.content.decode("utf-8-sig")
        lines = [ln for ln in content.split("\n") if ln.strip()]
        # 至少有表头 + 1 条 app_create 记录
        assert len(lines) >= 2
        # 所有数据行的 event 列应为 app_create
        for line in lines[1:]:
            assert "app_create" in line or "创建应用" in line

    def test_export_csv_empty_when_no_data(
        self, sync_client, oauth_db, auth_override
    ):
        """无审计日志时导出, CSV 仅含表头行."""
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs/export",
            params={"event": "token_refresh"},  # 无该事件记录
        )
        assert r.status_code == 200, r.text
        content = r.content.decode("utf-8-sig")
        lines = [ln for ln in content.split("\n") if ln.strip()]
        # 仅含表头
        assert len(lines) == 1


# ---------------------------------------------------------------------------
# Round 29-D: OAuth scope 元数据 (公开查询 + admin CRUD)
# ---------------------------------------------------------------------------


class TestRound29DScopeMetaPublic:
    """Round 29-D: GET /scope-meta (公开, 授权页用)."""

    def test_public_list_empty(self, sync_client, oauth_db, auth_override):
        """无 scope 元数据时返回空数组."""
        r = sync_client.get("/api/v1/agents/oauth-apps/scope-meta")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0

    def test_public_list_only_returns_active(
        self, sync_client, oauth_db, auth_override
    ):
        """公开列表仅返回 is_active=1 的 scope."""
        from app.models.oauth_models import OAuthScopeMeta

        engine, Session = oauth_db
        with Session() as s:
            s.add(OAuthScopeMeta(scope="read:profile", name="读取资料", is_active=1, sort_order=10))
            s.add(OAuthScopeMeta(scope="write:profile", name="修改资料", is_active=0, sort_order=20))
            s.commit()
        r = sync_client.get("/api/v1/agents/oauth-apps/scope-meta")
        body = r.json()
        assert body["total"] == 1
        assert body["data"][0]["scope"] == "read:profile"

    def test_public_list_sorted_by_sort_order(
        self, sync_client, oauth_db, auth_override
    ):
        """公开列表按 sort_order asc 排序."""
        from app.models.oauth_models import OAuthScopeMeta

        engine, Session = oauth_db
        with Session() as s:
            s.add(OAuthScopeMeta(scope="c", name="C", is_active=1, sort_order=30))
            s.add(OAuthScopeMeta(scope="a", name="A", is_active=1, sort_order=10))
            s.add(OAuthScopeMeta(scope="b", name="B", is_active=1, sort_order=20))
            s.commit()
        r = sync_client.get("/api/v1/agents/oauth-apps/scope-meta")
        body = r.json()
        scopes = [it["scope"] for it in body["data"]]
        assert scopes == ["a", "b", "c"]


class TestRound29DScopeMetaAdminCRUD:
    """Round 29-D: admin CRUD /admin/scope-meta."""

    def test_admin_create_scope_meta(self, sync_client, oauth_db, auth_override):
        """admin 创建 scope 元数据."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={
                "scope": "test:custom",
                "name": "测试自定义",
                "description": "测试用",
                "category": "test",
                "is_active": 1,
                "sort_order": 100,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["scope"] == "test:custom"
        assert body["name"] == "测试自定义"
        assert body["category"] == "test"
        assert body["sort_order"] == 100

    def test_admin_create_duplicate_scope_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """重复 scope 标识符拒绝 (唯一约束)."""
        sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "dup:scope", "name": "第一次"},
        )
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "dup:scope", "name": "第二次"},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_admin_create_empty_scope_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """scope 为空拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "", "name": "x"},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_admin_create_empty_name_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """name 为空拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "x:y", "name": ""},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_admin_create_invalid_is_active_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """is_active 非 0/1 拒绝."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "bad:active", "name": "x", "is_active": 2},
        )
        body = r.json()
        assert body["code"] == "400000"

    def test_admin_list_pagination(
        self, sync_client, oauth_db, auth_override
    ):
        """admin 列表分页."""
        for i in range(5):
            sync_client.post(
                "/api/v1/agents/oauth-apps/admin/scope-meta",
                json={"scope": f"page:{i}", "name": f"第{i}个", "sort_order": i},
            )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            params={"page": 1, "page_size": 2},
        )
        body = r.json()
        assert body["total"] == 5
        assert len(body["data"]) == 2

    def test_admin_list_filter_by_category(
        self, sync_client, oauth_db, auth_override
    ):
        """admin 列表按 category 筛选."""
        sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "p1:r", "name": "x", "category": "profile"},
        )
        sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "o1:r", "name": "y", "category": "orders"},
        )
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            params={"category": "profile"},
        )
        body = r.json()
        assert body["total"] == 1
        assert body["data"][0]["scope"] == "p1:r"

    def test_admin_update_scope_meta(
        self, sync_client, oauth_db, auth_override
    ):
        """admin 更新 scope 元数据 (scope 标识符不可改)."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "upd:scope", "name": "原名"},
        )
        meta_id = r.json()["data"]["id"]
        r2 = sync_client.put(
            f"/api/v1/agents/oauth-apps/admin/scope-meta/{meta_id}",
            json={"name": "新名", "description": "更新后", "is_active": 0},
        )
        assert r2.status_code == 200, r2.text
        body = r2.json()["data"]
        assert body["name"] == "新名"
        assert body["description"] == "更新后"
        assert body["is_active"] == 0
        # scope 不可改 (虽然 payload 没传, 验证返回仍是原 scope)
        assert body["scope"] == "upd:scope"

    def test_admin_update_nonexistent_returns_404(
        self, sync_client, oauth_db, auth_override
    ):
        """更新不存在的 scope meta 返回 404."""
        r = sync_client.put(
            "/api/v1/agents/oauth-apps/admin/scope-meta/99999",
            json={"name": "x"},
        )
        body = r.json()
        assert body["code"] == "404000"

    def test_admin_delete_scope_meta(
        self, sync_client, oauth_db, auth_override
    ):
        """admin 删除 scope 元数据."""
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "del:scope", "name": "待删"},
        )
        meta_id = r.json()["data"]["id"]
        r2 = sync_client.delete(
            f"/api/v1/agents/oauth-apps/admin/scope-meta/{meta_id}"
        )
        assert r2.status_code == 200, r2.text
        # 列表中应不再包含
        r3 = sync_client.get("/api/v1/agents/oauth-apps/admin/scope-meta")
        ids = [it["id"] for it in r3.json()["data"]]
        assert meta_id not in ids

    def test_admin_delete_nonexistent_returns_404(
        self, sync_client, oauth_db, auth_override
    ):
        """删除不存在的 scope meta 返回 404."""
        r = sync_client.delete(
            "/api/v1/agents/oauth-apps/admin/scope-meta/99999"
        )
        body = r.json()
        assert body["code"] == "404000"

    def test_admin_list_includes_inactive(
        self, sync_client, oauth_db, auth_override
    ):
        """admin 列表包含 is_active=0 的项 (与公开列表区别)."""
        sync_client.post(
            "/api/v1/agents/oauth-apps/admin/scope-meta",
            json={"scope": "inactive:scope", "name": "禁用项", "is_active": 0},
        )
        r = sync_client.get("/api/v1/agents/oauth-apps/admin/scope-meta")
        body = r.json()
        scopes = [it["scope"] for it in body["data"]]
        assert "inactive:scope" in scopes


# ---------------------------------------------------------------------------
# Round 31-A: OAuth 审计日志 90 天老化清理任务
# ---------------------------------------------------------------------------


class TestRound31AAuditLogCleanup:
    """Round 31-A: task_cleanup_oauth_audit_logs (90 天老化清理).

    测试策略:
    - 复用 oauth_db fixture 的临时 engine
    - 插入 100 天前 + 10 天前两类审计日志
    - patch app.database.get_session 指向同一 engine 的 ctx
    - 调用 task 函数, 验证 100 天前的被删, 10 天前的保留
    """

    async def test_cleanup_deletes_old_logs_keeps_recent(self, oauth_db):
        """90 天前的审计日志被删除, 近期日志保留."""
        import datetime as dt

        from app.models.oauth_models import OAuthAuditLog

        engine, Session = oauth_db

        # 插入 3 条 100 天前 + 2 条 10 天前
        now = dt.datetime.now()
        old_time = now - dt.timedelta(days=100)
        recent_time = now - dt.timedelta(days=10)

        with Session() as s:
            for i in range(3):
                s.add(
                    OAuthAuditLog(
                        event="app_create",
                        client_id=f"old-client-{i}",
                        user_uuid="u-old",
                        ip="127.0.0.1",
                        status="success",
                        created_at=old_time,
                    )
                )
            for i in range(2):
                s.add(
                    OAuthAuditLog(
                        event="app_create",
                        client_id=f"recent-client-{i}",
                        user_uuid="u-recent",
                        ip="127.0.0.1",
                        status="success",
                        created_at=recent_time,
                    )
                )
            s.commit()

        # patch app.database.get_session 指向同一 engine
        from sqlalchemy.orm import sessionmaker

        CleanupSession = sessionmaker(bind=engine, expire_on_commit=False)

        class _CleanupCtx:
            def __enter__(self):
                self.session = CleanupSession()
                return self.session

            def __exit__(self, *a):
                self.session.close()

        ctx_instance = _CleanupCtx()
        with patch("app.database.get_session", return_value=ctx_instance):
            from app.tasks.scheduler import task_cleanup_oauth_audit_logs

            # asyncio_mode=auto, 直接 await
            await task_cleanup_oauth_audit_logs()

        # 验证: 100 天前的全删了, 10 天前的还在
        with Session() as s:
            old_logs = (
                s.query(OAuthAuditLog)
                .filter(OAuthAuditLog.user_uuid == "u-old")
                .all()
            )
            recent_logs = (
                s.query(OAuthAuditLog)
                .filter(OAuthAuditLog.user_uuid == "u-recent")
                .all()
            )
            assert len(old_logs) == 0, "100 天前的审计日志应被清理"
            assert len(recent_logs) == 2, "10 天前的审计日志应保留"

    async def test_cleanup_idempotent_no_logs(self, oauth_db):
        """无审计日志时清理任务无副作用 (幂等)."""
        engine, Session = oauth_db

        from sqlalchemy.orm import sessionmaker

        CleanupSession = sessionmaker(bind=engine, expire_on_commit=False)

        class _CleanupCtx:
            def __enter__(self):
                self.session = CleanupSession()
                return self.session

            def __exit__(self, *a):
                self.session.close()

        ctx_instance = _CleanupCtx()
        with patch("app.database.get_session", return_value=ctx_instance):
            from app.tasks.scheduler import task_cleanup_oauth_audit_logs

            # 空表执行不应抛异常
            await task_cleanup_oauth_audit_logs()

        # 验证表仍为空
        from app.models.oauth_models import OAuthAuditLog

        with Session() as s:
            assert s.query(OAuthAuditLog).count() == 0


# ---------------------------------------------------------------------------
# Round 31-B: OAuth 应用 owner_uuid 多租户隔离
# ---------------------------------------------------------------------------


class TestRound31BOwnerUuid:
    """Round 31-B: OAuthApp.owner_uuid 多租户隔离.

    覆盖:
    - create 写入 owner_uuid
    - list 默认仅自己的 + 历史无主
    - list include_all=1 查全部
    - delete 非 owner 403
    - reset-secret 非 owner 403
    - 历史无主应用 (NULL) 任何用户可管理
    """

    def test_create_writes_owner_uuid(self, sync_client, oauth_db, auth_override):
        """创建应用时写入 owner_uuid = 当前 user_uuid."""
        client_id, _ = _create_app_via_api(sync_client, auth_override, name="owner-app")
        # 详情接口应返回 owner_uuid
        r = sync_client.get(f"/api/v1/agents/oauth-apps/{client_id}")
        body = r.json()["data"]
        assert body["owner_uuid"] == "u-test-oauth"

    def test_list_default_only_own_apps(self, sync_client, oauth_db, auth_override):
        """list 默认仅返回当前用户创建的应用 + 历史无主应用."""
        # 当前用户创建 1 个
        _create_app_via_api(sync_client, auth_override, name="my-app")
        # 直接插入另一个用户的应用
        from app.models.oauth_models import OAuthApp

        engine, Session = oauth_db
        with Session() as s:
            s.add(
                OAuthApp(
                    name="other-user-app",
                    client_id="other-client-id",
                    client_secret="other-secret",
                    redirect_uri="https://other.com/cb",
                    is_active=1,
                    owner_uuid="u-other-user",
                )
            )
            s.commit()
        # 默认 list: 应只见 my-app (自己的), 不见 other-user-app
        r = sync_client.get("/api/v1/agents/oauth-apps/list")
        body = r.json()
        names = [it["name"] for it in body["data"]]
        assert "my-app" in names
        assert "other-user-app" not in names

    def test_list_include_all_returns_all(self, sync_client, oauth_db, auth_override):
        """list include_all=1 返回全部应用 (含其他用户的)."""
        _create_app_via_api(sync_client, auth_override, name="my-app-2")
        from app.models.oauth_models import OAuthApp

        engine, Session = oauth_db
        with Session() as s:
            s.add(
                OAuthApp(
                    name="other-app-2",
                    client_id="other-client-2",
                    client_secret="secret-2",
                    redirect_uri="https://other.com/cb",
                    is_active=1,
                    owner_uuid="u-other-2",
                )
            )
            s.commit()
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/list", params={"include_all": 1}
        )
        body = r.json()
        names = [it["name"] for it in body["data"]]
        assert "my-app-2" in names
        assert "other-app-2" in names

    def test_list_includes_null_owner_legacy_apps(
        self, sync_client, oauth_db, auth_override
    ):
        """历史无主应用 (owner_uuid IS NULL) 在默认 list 中可见 (向后兼容)."""
        from app.models.oauth_models import OAuthApp

        engine, Session = oauth_db
        with Session() as s:
            s.add(
                OAuthApp(
                    name="legacy-null-owner",
                    client_id="legacy-client",
                    client_secret="legacy-secret",
                    redirect_uri="https://legacy.com/cb",
                    is_active=1,
                    owner_uuid=None,  # 历史无主
                )
            )
            s.commit()
        r = sync_client.get("/api/v1/agents/oauth-apps/list")
        body = r.json()
        names = [it["name"] for it in body["data"]]
        assert "legacy-null-owner" in names

    def test_delete_non_owner_returns_403(
        self, sync_client, oauth_db, auth_override
    ):
        """非应用创建者无权删除 (403)."""
        from app.models.oauth_models import OAuthApp

        engine, Session = oauth_db
        with Session() as s:
            s.add(
                OAuthApp(
                    name="other-owner-app",
                    client_id="other-owner-client",
                    client_secret="secret",
                    redirect_uri="https://other.com/cb",
                    is_active=1,
                    owner_uuid="u-real-owner",
                )
            )
            s.commit()
        # 当前用户 u-test-oauth 不是 owner
        r = sync_client.delete(
            "/api/v1/agents/oauth-apps/other-owner-client"
        )
        body = r.json()
        assert body["code"] == "403000"
        assert "无权删除" in body["msg"]

    def test_reset_secret_non_owner_returns_403(
        self, sync_client, oauth_db, auth_override
    ):
        """非应用创建者无权重置密钥 (403)."""
        from app.models.oauth_models import OAuthApp

        engine, Session = oauth_db
        with Session() as s:
            s.add(
                OAuthApp(
                    name="other-secret-app",
                    client_id="other-secret-client",
                    client_secret="old-secret",
                    redirect_uri="https://other.com/cb",
                    is_active=1,
                    owner_uuid="u-real-owner",
                )
            )
            s.commit()
        r = sync_client.post(
            "/api/v1/agents/oauth-apps/other-secret-client/reset-secret"
        )
        body = r.json()
        assert body["code"] == "403000"
        assert "无权重置密钥" in body["msg"]

    def test_delete_null_owner_legacy_allowed(
        self, sync_client, oauth_db, auth_override
    ):
        """历史无主应用 (owner_uuid=NULL) 任何登录用户可删除 (历史兼容)."""
        from app.models.oauth_models import OAuthApp

        engine, Session = oauth_db
        with Session() as s:
            s.add(
                OAuthApp(
                    name="legacy-del-app",
                    client_id="legacy-del-client",
                    client_secret="secret",
                    redirect_uri="https://legacy.com/cb",
                    is_active=1,
                    owner_uuid=None,  # 历史无主
                )
            )
            s.commit()
        r = sync_client.delete(
            "/api/v1/agents/oauth-apps/legacy-del-client"
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["is_active"] == 0

    def test_delete_owner_self_allowed(
        self, sync_client, oauth_db, auth_override
    ):
        """应用创建者本人可删除自己的应用."""
        client_id, _ = _create_app_via_api(
            sync_client, auth_override, name="self-del-app"
        )
        r = sync_client.delete(f"/api/v1/agents/oauth-apps/{client_id}")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["is_active"] == 0


# ---------------------------------------------------------------------------
# Round 31-C: OAuth 审计日志聚合统计 (仪表盘)
# ---------------------------------------------------------------------------


class TestRound31CAuditLogStats:
    """Round 31-C: GET /oauth-apps/audit-logs/stats (仪表盘聚合统计).

    覆盖:
    - 空数据 stats 返回零值结构
    - 有数据 by_event 统计 + 成功/失败分布
    - by_day 按日趋势
    - by_client Top 10
    - days 参数范围校验 (ge=1, le=365)
    """

    def test_stats_empty_data(self, sync_client, oauth_db, auth_override):
        """无审计日志时返回零值结构."""
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/stats")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["days"] == 30  # 默认 30 天
        assert body["total"] == 0
        assert body["by_event"] == []
        assert body["by_day"] == []
        assert body["by_client"] == []
        assert "start" in body
        assert "end" in body

    def test_stats_by_event_aggregation(
        self, sync_client, oauth_db, auth_override
    ):
        """by_event 按事件分组统计 + 成功/失败分布."""
        from app.models.oauth_models import OAuthAuditLog

        engine, Session = oauth_db
        with Session() as s:
            # app_create: 3 success + 1 failure
            for _ in range(3):
                s.add(
                    OAuthAuditLog(
                        event="app_create", client_id="c1", user_uuid="u1",
                        ip="127.0.0.1", status="success",
                    )
                )
            s.add(
                OAuthAuditLog(
                    event="app_create", client_id="c1", user_uuid="u1",
                    ip="127.0.0.1", status="failure",
                )
            )
            # app_delete: 2 success
            for _ in range(2):
                s.add(
                    OAuthAuditLog(
                        event="app_delete", client_id="c2", user_uuid="u2",
                        ip="127.0.0.1", status="success",
                    )
                )
            s.commit()
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/stats")
        body = r.json()["data"]
        assert body["total"] == 6
        # by_event 按 total 倒序
        by_event = body["by_event"]
        assert len(by_event) == 2
        # app_create total=4 排第一
        assert by_event[0]["event"] == "app_create"
        assert by_event[0]["total"] == 4
        assert by_event[0]["success"] == 3
        assert by_event[0]["failure"] == 1
        # app_delete total=2 排第二
        assert by_event[1]["event"] == "app_delete"
        assert by_event[1]["total"] == 2
        assert by_event[1]["success"] == 2
        assert by_event[1]["failure"] == 0

    def test_stats_by_day_trend(self, sync_client, oauth_db, auth_override):
        """by_day 按日趋势 (近 N 天)."""
        import datetime as dt

        from app.models.oauth_models import OAuthAuditLog

        engine, Session = oauth_db
        now = dt.datetime.now()
        with Session() as s:
            # 今天 2 条
            for _ in range(2):
                s.add(
                    OAuthAuditLog(
                        event="app_create", client_id="c1", user_uuid="u1",
                        ip="127.0.0.1", status="success", created_at=now,
                    )
                )
            # 昨天 1 条
            yesterday = now - dt.timedelta(days=1)
            s.add(
                OAuthAuditLog(
                    event="app_create", client_id="c1", user_uuid="u1",
                    ip="127.0.0.1", status="success", created_at=yesterday,
                )
            )
            s.commit()
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/stats")
        body = r.json()["data"]
        by_day = body["by_day"]
        assert len(by_day) >= 1
        # 每条都有 date + count 字段
        for item in by_day:
            assert "date" in item
            assert "count" in item
            assert isinstance(item["count"], int)
        # 按 date asc 排序
        dates = [it["date"] for it in by_day]
        assert dates == sorted(dates)

    def test_stats_by_client_top10(self, sync_client, oauth_db, auth_override):
        """by_client 按 client_id 分组 Top 10 (按次数倒序)."""
        from app.models.oauth_models import OAuthAuditLog

        engine, Session = oauth_db
        with Session() as s:
            # client-A: 5 次
            for _ in range(5):
                s.add(
                    OAuthAuditLog(
                        event="app_create", client_id="client-A", user_uuid="u1",
                        ip="127.0.0.1", status="success",
                    )
                )
            # client-B: 3 次
            for _ in range(3):
                s.add(
                    OAuthAuditLog(
                        event="app_create", client_id="client-B", user_uuid="u2",
                        ip="127.0.0.1", status="success",
                    )
                )
            # client-C: 1 次
            s.add(
                OAuthAuditLog(
                    event="app_create", client_id="client-C", user_uuid="u3",
                    ip="127.0.0.1", status="success",
                )
            )
            s.commit()
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/stats")
        body = r.json()["data"]
        by_client = body["by_client"]
        assert len(by_client) == 3
        # 按次数倒序: client-A (5) > client-B (3) > client-C (1)
        assert by_client[0]["client_id"] == "client-A"
        assert by_client[0]["count"] == 5
        assert by_client[1]["client_id"] == "client-B"
        assert by_client[1]["count"] == 3
        assert by_client[2]["client_id"] == "client-C"
        assert by_client[2]["count"] == 1

    def test_stats_by_client_max_10(self, sync_client, oauth_db, auth_override):
        """by_client 最多返回 10 条 (Top 10 限制)."""
        from app.models.oauth_models import OAuthAuditLog

        engine, Session = oauth_db
        with Session() as s:
            # 插入 12 个不同 client_id, 每个 1 条
            for i in range(12):
                s.add(
                    OAuthAuditLog(
                        event="app_create", client_id=f"client-{i:02d}",
                        user_uuid="u1", ip="127.0.0.1", status="success",
                    )
                )
            s.commit()
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/stats")
        body = r.json()["data"]
        assert len(body["by_client"]) == 10  # Top 10 限制

    def test_stats_days_param_default_30(self, sync_client, oauth_db, auth_override):
        """days 参数默认 30."""
        r = sync_client.get("/api/v1/agents/oauth-apps/audit-logs/stats")
        body = r.json()["data"]
        assert body["days"] == 30

    def test_stats_days_param_custom(self, sync_client, oauth_db, auth_override):
        """days 参数自定义 (如 days=7)."""
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs/stats", params={"days": 7}
        )
        body = r.json()["data"]
        assert body["days"] == 7

    def test_stats_days_param_below_min_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """days < 1 拒绝 (ge=1)."""
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs/stats", params={"days": 0}
        )
        # FastAPI Query ge=1 校验失败返回 422
        assert r.status_code == 422

    def test_stats_days_param_above_max_rejected(
        self, sync_client, oauth_db, auth_override
    ):
        """days > 365 拒绝 (le=365)."""
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs/stats", params={"days": 366}
        )
        assert r.status_code == 422

    def test_stats_filters_old_data(self, sync_client, oauth_db, auth_override):
        """days=1 时, 100 天前的数据不计入统计."""
        import datetime as dt

        from app.models.oauth_models import OAuthAuditLog

        engine, Session = oauth_db
        now = dt.datetime.now()
        with Session() as s:
            # 100 天前 1 条 (应被排除)
            s.add(
                OAuthAuditLog(
                    event="app_create", client_id="old-c", user_uuid="u1",
                    ip="127.0.0.1", status="success",
                    created_at=now - dt.timedelta(days=100),
                )
            )
            # 今天 1 条 (应计入)
            s.add(
                OAuthAuditLog(
                    event="app_create", client_id="today-c", user_uuid="u1",
                    ip="127.0.0.1", status="success", created_at=now,
                )
            )
            s.commit()
        r = sync_client.get(
            "/api/v1/agents/oauth-apps/audit-logs/stats", params={"days": 1}
        )
        body = r.json()["data"]
        assert body["total"] == 1  # 仅今天 1 条
        # by_client 仅 today-c
        client_ids = [it["client_id"] for it in body["by_client"]]
        assert "today-c" in client_ids
        assert "old-c" not in client_ids
