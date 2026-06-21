"""Phase 10 建议 2: OIDC Vault 服务端到端验证.

测试点:
  1. FastAPI app 注册 /healthz / .well-known / /v1/exchange / /v1/validate / /v1/redeem / /v1/audit
  2. issue_service_token 颁发改 redeem 流程
  3. validate_service_token 验签 + 过期
  4. mock 模式 GitHub OIDC 验签
  5. /v1/exchange 端到端: mock OIDC JWT → service token → redeem 真凭据
  6. audit 日志写入
  7. /healthz 返回 providers 列表
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def make_mock_github_oidc_jwt(
    audience: str = "zhs-vault", sub: str = "repo:zhs/zhs-platform:ref:refs/heads/main"
) -> str:
    """构造 mock GitHub OIDC JWT (不签名, 仅 payload)."""
    header = {"alg": "RS256", "typ": "JWT", "kid": "mock"}
    payload = {
        "iss": "https://token.actions.githubusercontent.com",
        "sub": sub,
        "aud": audience,
        "iat": int(time.time()),
        "exp": int(time.time()) + 600,
    }
    h = _b64url(json.dumps(header, separators=("", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=("", ":")).encode("utf-8"))
    s = _b64url(b"mock-signature")
    return f"{h}.{p}.{s}"


@pytest.fixture
def vault_client():
    """启动 vault 测试客户端 (mock 模式)."""
    os.environ["ZHS_VAULT_MOCK"] = "1"
    # 清空模块缓存, 避免之前测试的 provider 注册表残留
    if "scripts.ci.oidc_vault_server" in sys.modules:
        del sys.modules["scripts.ci.oidc_vault_server"]
    from fastapi.testclient import TestClient

    from scripts.ci.oidc_vault_server import (
        _AUDIT_LOG,
        PROVIDER_REGISTRY,
        app,
        issue_service_token,
        validate_service_token,
    )

    client = TestClient(app)
    _AUDIT_LOG.clear()
    yield {
        "client": client,
        "issue": issue_service_token,
        "validate": validate_service_token,
        "providers": PROVIDER_REGISTRY,
        "audit": _AUDIT_LOG,
    }


def test_healthz_returns_providers(vault_client):
    """/healthz 返回状态 + providers 列表."""
    r = vault_client["client"].get("/healthz")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    for p in ("grafana", "dingtalk", "alertmanager"):
        assert p in data["providers"]


def test_openid_discovery(vault_client):
    """/.well-known/openid-configuration 返回 issuer + endpoints."""
    r = vault_client["client"].get("/.well-known/openid-configuration")
    assert r.status_code == 200
    data = r.json()
    assert data["issuer"] == "zhs-vault"
    assert "/v1/exchange" in data["token_endpoint"]


def test_jwks_endpoint(vault_client):
    """/.well-known/jwks.json 返空 keyset (mock 模式)."""
    r = vault_client["client"].get("/.well-known/jwks.json")
    assert r.status_code == 200
    assert r.json() == {"keys": []}


def test_exchange_rejects_missing_bearer(vault_client):
    """无 Authorization header → 401."""
    r = vault_client["client"].post("/v1/exchange", json={"provider": "grafana"})
    assert r.status_code == 422 or r.status_code == 401


def test_exchange_rejects_non_bearer(vault_client):
    """非 Bearer 格式 → 401."""
    r = vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "grafana"},
        headers={"Authorization": "Basic xxx"},
    )
    assert r.status_code == 401


def test_exchange_rejects_missing_provider(vault_client):
    """body 缺 provider → 400."""
    jwt = make_mock_github_oidc_jwt()
    r = vault_client["client"].post(
        "/v1/exchange",
        json={},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert r.status_code == 400


def test_exchange_rejects_unknown_provider(vault_client):
    """未知 provider → 400."""
    jwt = make_mock_github_oidc_jwt()
    r = vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "nonexistent"},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert r.status_code == 400


def test_exchange_rejects_audience_mismatch(vault_client):
    """OIDC aud 不匹配 → 401."""
    jwt = make_mock_github_oidc_jwt(audience="wrong-audience")
    r = vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "grafana"},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert r.status_code == 401


def test_exchange_success_grafana(vault_client):
    """正常 exchange 流程 → 返回 service token + 元数据."""
    jwt = make_mock_github_oidc_jwt()
    r = vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "grafana", "ttl_min": 30},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "grafana"
    assert data["ttl_min"] == 30
    assert "expires_at" in data
    assert "scope" in data
    # token 应可验签
    payload = vault_client["validate"](data["access_token"])
    assert payload is not None
    assert payload["aud"] == "grafana"
    assert payload["sub"] == "repo:zhs/zhs-platform:ref:refs/heads/main"


def test_exchange_rejects_invalid_ttl(vault_client):
    """ttl_min 越界 → 400."""
    jwt = make_mock_github_oidc_jwt()
    r = vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "grafana", "ttl_min": 9999},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert r.status_code == 400


def test_validate_rejects_tampered_token(vault_client):
    """篡改 token 最后一字节 → 401."""
    result = vault_client["issue"]("grafana", "test-sub", 30)
    tok = result["access_token"]
    h, p, s = tok.split(".")
    tampered = f"{h}.{p}.{s[:-1]}X"
    r = vault_client["client"].post("/v1/validate", json={"access_token": tampered})
    assert r.status_code == 401


def test_validate_accepts_legit_token(vault_client):
    """合法 token 验签通过."""
    result = vault_client["issue"]("dingtalk", "test-sub", 15)
    r = vault_client["client"].post("/v1/validate", json={"access_token": result["access_token"]})
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert data["aud"] == "dingtalk"
    assert data["scope"] == "webhook:send"


def test_redeem_returns_mock_credential(vault_client):
    """redeem mock 模式返 mock-credential."""
    result = vault_client["issue"]("grafana", "test", 30)
    r = vault_client["client"].post("/v1/redeem", json={"access_token": result["access_token"]})
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "grafana"
    assert "credential" in data
    assert data["url"].startswith("https://")


def test_redeem_rejects_expired_token(vault_client):
    """redeem 过期 token → 401."""
    # 手工构造过期 token (跳过 issue_service_token 的 ttl 校验)
    import hashlib
    import hmac

    payload = {
        "iss": "zhs-vault",
        "sub": "test",
        "aud": "grafana",
        "iat": int(time.time()) - 7200,
        "exp": int(time.time()) - 3600,  # 1 小时前过期
        "scope": "annotations:write",
    }
    h = _b64url(json.dumps({"alg": "HS256", "typ": "ZHS-VAULT-V1"}, separators=("", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=("", ":")).encode("utf-8"))
    msg = f"{h}.{p}".encode("ascii")
    sig = hmac.new(b"vault-dev-key-do-not-use-in-prod", msg, hashlib.sha256).digest()
    expired_token = f"{h}.{p}.{_b64url(sig)}"
    r = vault_client["client"].post("/v1/redeem", json={"access_token": expired_token})
    assert r.status_code == 401


def test_exchange_writes_audit_log(vault_client):
    """exchange 成功必写审计日志."""
    audit = vault_client["audit"]
    assert len(audit) == 0
    jwt = make_mock_github_oidc_jwt(sub="repo:test/repo:ref:refs/heads/main")
    r = vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "grafana", "ttl_min": 30},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert r.status_code == 200
    assert len(audit) == 1
    entry = audit[0]
    assert entry["provider"] == "grafana"
    assert "repo:test/repo" in entry["github_sub"]
    assert "ts" in entry
    assert "client_ip" in entry


def test_end_to_end_github_oidc_to_redeem(vault_client):
    """端到端: GitHub OIDC JWT → service token → redeem 真凭据."""
    jwt = make_mock_github_oidc_jwt()
    # 1. exchange
    r = vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "alertmanager", "ttl_min": 30},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert r.status_code == 200
    service_token = r.json()["access_token"]
    # 2. redeem
    r = vault_client["client"].post("/v1/redeem", json={"access_token": service_token})
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "alertmanager"
    assert "silences" in data["scope"]


def test_audit_endpoint_returns_log(vault_client):
    """/v1/audit 返审计日志."""
    jwt = make_mock_github_oidc_jwt()
    vault_client["client"].post(
        "/v1/exchange",
        json={"provider": "grafana"},
        headers={"Authorization": f"Bearer {jwt}"},
    )
    r = vault_client["client"].get("/v1/audit")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 1
    # Phase 11: 接口改为 source/rows 字段
    assert len(data["rows"]) == 1


def test_all_three_providers_exchangeable(vault_client):
    """3 个 provider 都能 exchange + redeem."""
    for prov in ("grafana", "dingtalk", "alertmanager"):
        jwt = make_mock_github_oidc_jwt()
        r = vault_client["client"].post(
            "/v1/exchange",
            json={"provider": prov, "ttl_min": 15},
            headers={"Authorization": f"Bearer {jwt}"},
        )
        assert r.status_code == 200, f"{prov} exchange 失败"
        service_token = r.json()["access_token"]
        r = vault_client["client"].post("/v1/redeem", json={"access_token": service_token})
        assert r.status_code == 200, f"{prov} redeem 失败"
        assert r.json()["provider"] == prov


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
