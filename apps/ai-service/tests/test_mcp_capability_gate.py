"""O1 MCP 收权测试:匿名后门关闭 + 工具级 scope 门禁。

不依赖真实 PG/Redis(测试隔离铁律):仅覆盖凭据解析与 scope 裁决纯逻辑,
外部依赖(manifest 文件、settings)一律 monkeypatch。
"""

from __future__ import annotations

import time
from typing import Any

import pytest

from app.core.config import settings
from app.services import capability_gate as cg


@pytest.fixture(autouse=True)
def _prod_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认按生产环境判定 —— 非生产存在本地开发回退,不能用来验证收权。"""
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setattr(settings, "ihui_principal_secret", "test-principal-secret")


def _headers(**extra: str) -> dict[str, str]:
    base: dict[str, str] = {"content-type": "application/json"}
    base.update(extra)
    return base


def test_production_anonymous_is_rejected() -> None:
    with pytest.raises(cg.PrincipalAuthError) as exc:
        cg.resolve_principal_from_headers(_headers())
    assert exc.value.http_status == 401


def test_api_key_is_not_validated_in_ai_service() -> None:
    """API key 只在 apps/api 校验:此处必须 401 并指向 /v1/mcp/*,不得本地兜底。"""
    with pytest.raises(cg.PrincipalAuthError) as exc:
        cg.resolve_principal_from_headers(_headers(**{"x-api-key": "ihui_secret_value"}))
    assert "/v1/mcp" in exc.value.message


def test_bearer_api_key_prefix_rejected() -> None:
    with pytest.raises(cg.PrincipalAuthError):
        cg.resolve_principal_from_headers(_headers(authorization="Bearer ihui_secret_value"))


def test_principal_header_roundtrip() -> None:
    header = cg.build_principal_header(
        sub="user-1", role=0, scopes=["chat:write"], exp=time.time() + 60, api_key_id="key-1"
    )
    principal = cg.verify_principal_header(header)
    assert principal is not None
    assert principal.sub == "user-1"
    assert principal.role == 0
    assert principal.is_machine_channel is True


def test_principal_header_bad_signature_is_none() -> None:
    header = cg.build_principal_header(sub="u", role=0, scopes=["chat:write"], exp=time.time() + 60)
    tampered = f"{header[:-8]}deadbeef"
    assert cg.verify_principal_header(tampered) is None


def test_principal_header_expired_is_none() -> None:
    header = cg.build_principal_header(sub="u", role=0, scopes=["chat:write"], exp=time.time() - 10)
    assert cg.verify_principal_header(header) is None


def test_forged_principal_header_from_other_secret_is_none(monkeypatch: pytest.MonkeyPatch) -> None:
    header = cg.build_principal_header(
        sub="u", role=7, scopes=["*"], exp=time.time() + 60, secret="attacker-guessed-secret"
    )
    monkeypatch.setattr(settings, "ihui_principal_secret", "real-secret")
    assert cg.verify_principal_header(header) is None


def _manifest(
    tool_scope: dict[str, str], scope_meta: dict[str, tuple[str, bool]]
) -> cg.CapabilityManifest:
    """构造内存态清单:(scope → (data_class, third_party_eligible))。risk 不参与本组断言。"""
    scopes: dict[str, cg.ScopeMeta] = {
        s: cg.ScopeMeta(data_class=dc, risk="high", third_party_eligible=eligible)
        for s, (dc, eligible) in scope_meta.items()
    }
    return cg.CapabilityManifest(tool_scope=tool_scope, scope_meta=scopes)


@pytest.fixture
def manifest(monkeypatch: pytest.MonkeyPatch) -> cg.CapabilityManifest:
    m = _manifest(
        tool_scope={
            "read_file": "files:read",
            "run_command": "sandbox:run",
            "computer_mouse_click": "computer:operate",
            "publish_article": "publish:operate",
        },
        scope_meta={
            "files:read": ("scoped-read", True),
            "sandbox:run": ("compute", False),
            "computer:operate": ("platform", False),
            "publish:operate": ("platform", False),
        },
    )
    monkeypatch.setattr(cg, "load_capability_manifest", lambda: m)
    return m


def _machine(scopes: list[str]) -> cg.Principal:
    return cg.Principal(kind="internal", sub="u", role=0, scopes=frozenset(scopes), api_key_id="k")


def test_machine_channel_requires_scope(manifest: cg.CapabilityManifest) -> None:
    decision = cg.check_tool_access(_machine(["chat:write"]), "read_file")
    assert decision.allowed is False
    assert decision.required_scope == "files:read"
    assert decision.error_code == "SCOPE_DENIED"


def test_machine_channel_with_scope_allowed(manifest: cg.CapabilityManifest) -> None:
    assert cg.check_tool_access(_machine(["files:read"]), "read_file").allowed is True


def test_unregistered_tool_denied(manifest: cg.CapabilityManifest) -> None:
    decision = cg.check_tool_access(_machine(["files:read"]), "some_unknown_tool")
    assert decision.allowed is False
    assert decision.error_code == "TOOL_NOT_REGISTERED"


def test_platform_scope_never_granted_even_with_wildcard(manifest: cg.CapabilityManifest) -> None:
    """'*' 通配不得穿透 platform 域与 thirdPartyEligible=false 的能力。"""
    for tool, scope in (
        ("computer_mouse_click", "computer:operate"),
        ("publish_article", "publish:operate"),
        ("run_command", "sandbox:run"),
    ):
        decision = cg.check_tool_access(_machine(["*"]), tool)
        assert decision.allowed is False, tool
        assert decision.required_scope == scope, tool


def test_enforce_tool_access_raises_structured_403(manifest: cg.CapabilityManifest) -> None:
    with pytest.raises(cg.ScopeDeniedError) as exc:
        cg.enforce_tool_access(_machine(["chat:write"]), "read_file")
    body: dict[str, Any] = exc.value.to_body()
    assert body["code"] == 403
    assert body["requiredScope"] == "files:read"


def test_manifest_missing_fails_safe_for_external_and_keeps_matrix_for_internal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cg, "load_capability_manifest", lambda: None)
    jwt_principal = cg.Principal(kind="jwt", sub="u", role=0, scopes=frozenset({cg.ALL_SCOPES}))
    assert cg.check_tool_access(jwt_principal, "read_file").allowed is False
    internal = cg.Principal(kind="internal", sub="u", role=0, scopes=frozenset({cg.ALL_SCOPES}))
    assert cg.check_tool_access(internal, "read_file").matrix_fallback is True
