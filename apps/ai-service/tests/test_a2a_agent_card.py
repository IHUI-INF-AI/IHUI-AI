# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""O11 A2A 标准化:Agent Card 与 /.well-known 发现端点测试。

覆盖四件事(任务验收标准逐条对应):
1. agent-card 字段完备(A2A §5.5 AgentCard 必填集)+ **skills ⊆ capabilities.json**
   且每个 skill 的工具都在 MCP 执行面真实注册(不虚报未实现能力);
2. Host 非白名单时不泄露内网主机/端口(回落配置公网域,无域可回落则 403 拒答);
3. 发现端点匿名可读 —— 但**前提**是路径已登记进 JWT 白名单,该断言同时把
   "config.py 的 jwt_public_paths 必须加这两个路径"这条部署要求钉成可执行证据;
4. 任务端点接 Principal(生产无凭据 401)+ 归属他人 403。

隔离:不连生产 PG(8810)/ Redis(8811)—— 全部 Redis 访问 monkeypatch 成 None
(纯内存),agent 执行协程 monkeypatch 成 no-op(不外呼 LLM)。
"""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core import jwt_auth
from app.core.config import settings
from app.routers import agent_wellknown
from app.routers.a2a import router as a2a_router
from app.services import agent_card
from app.services import capability_gate as cg
from app.services.a2a_service import A2AServer

# ---------------------------------------------------------------------------
# 基线数据:能力清单原文 + 真实注册工具集(测试独立解析,不复用被测代码的派生逻辑)
# ---------------------------------------------------------------------------

MANIFEST_PATH: Path = agent_card.manifest_file()
if not MANIFEST_PATH.exists():  # pragma: no cover - CI 未生成清单时跳过整模块
    pytest.skip("能力清单 capabilities.json 缺失", allow_module_level=True)

_MANIFEST: dict[str, Any] = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
MANIFEST_SCOPES: set[str] = {c["scope"] for c in _MANIFEST["capabilities"] if isinstance(c, dict)}
MANIFEST_BY_SCOPE: dict[str, dict[str, Any]] = {
    c["scope"]: c for c in _MANIFEST["capabilities"] if isinstance(c, dict)
}
TOOL_SCOPE_MAP: dict[str, str] = dict(_MANIFEST["toolScopeMap"])

from app.services.mcp_server import _TOOLS  # noqa: E402

REGISTERED_TOOLS: set[str] = {t.name for t in _TOOLS}

# 门禁不放行给外部/机器凭据的 scope:出现在卡片里即是虚报
NOT_ADVERTISABLE = ["browser:operate", "computer:operate", "ops:execute", "sandbox:run"]


@pytest.fixture()
def allowlisted(monkeypatch: pytest.MonkeyPatch) -> None:
    """固定 Host 白名单为公网域(与 mcp_export 同源配置)。"""
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top www.aizhs.top")


@pytest.fixture()
def card() -> dict[str, Any]:
    return agent_card.build_agent_card("https://aizhs.top")


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """仅挂发现路由的最小宿主 app(不依赖 app.main,避免全局副作用)。

    node_env 按生产态势:对外公布的是公网域,卡片必须给 https。
    """
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top www.aizhs.top")
    monkeypatch.setattr(settings, "node_env", "production")
    app = FastAPI()
    app.include_router(agent_wellknown.router)
    yield TestClient(app)


# ===========================================================================
# 1. Agent Card 字段完备性
# ===========================================================================

# A2A §5.5 AgentCard 必填字段
REQUIRED_AGENTCARD_FIELDS = [
    "protocolVersion",
    "name",
    "description",
    "url",
    "preferredTransport",
    "version",
    "capabilities",
    "defaultInputModes",
    "defaultOutputModes",
    "skills",
]


def test_card_has_all_required_fields(card: dict[str, Any]) -> None:
    for field in REQUIRED_AGENTCARD_FIELDS:
        assert field in card, f"AgentCard 缺必填字段 {field}"
    assert card["protocolVersion"] == agent_card.PROTOCOL_VERSION
    assert isinstance(card["skills"], list) and card["skills"]
    assert isinstance(card["capabilities"], dict)
    assert isinstance(card["defaultInputModes"], list)
    assert card["url"].startswith("https://aizhs.top")


def test_card_security_schemes_and_security_are_consistent(card: dict[str, Any]) -> None:
    """security[] 只能引用 securitySchemes 里真实声明的通道。"""
    schemes = card["securitySchemes"]
    assert schemes["bearerAuth"] == {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        **{k: schemes["bearerAuth"][k] for k in ("description",)},
    }
    internal = schemes["ihuiInternalPrincipal"]
    assert internal["type"] == "apiKey" and internal["in"] == "header"
    assert internal["name"] == cg.PRINCIPAL_HEADER_NAME
    for entry in card["security"]:
        assert set(entry) <= set(schemes)


def test_card_flags_declared_honestly_no_streaming_or_push(card: dict[str, Any]) -> None:
    """本服务无 SSE / 无回调端点 / 无状态历史 → 三个开关必须全 False。"""
    caps = card["capabilities"]
    assert caps["streaming"] is False
    assert caps["pushNotifications"] is False
    assert caps["stateTransitionHistory"] is False


def test_card_extension_declares_native_rest_contract(card: dict[str, Any]) -> None:
    """偏差如实声明:自研 REST 报文 + 真实路径 + 必须轮询。"""
    ext = card["capabilities"]["extensions"][0]
    assert ext["uri"] == agent_card.NATIVE_TASK_API_EXTENSION_URI
    assert ext["required"] is True
    assert "JSON-RPC" in ext["description"]
    assert agent_card.TASKS_PATH in ext["description"]
    assert "{taskId}" in ext["description"]
    # 花括号渲染正确(f-string 转义回归):必须是单括号
    assert "{{" not in ext["description"] and "}}" not in ext["description"]


def test_card_version_and_name_come_from_app(card: dict[str, Any]) -> None:
    assert card["version"] == agent_card.APP_VERSION
    assert card["name"] == settings.app_name


# ===========================================================================
# 2. skills 只来自真实可执行能力
# ===========================================================================


def test_skills_are_subset_of_capabilities_manifest(card: dict[str, Any]) -> None:
    ids = [s["id"] for s in card["skills"]]
    assert ids, "skills 不应为空(清单存在时)"
    assert set(ids) <= MANIFEST_SCOPES, f"卡片出现了清单外的 scope: {set(ids) - MANIFEST_SCOPES}"


def test_skills_list_only_registered_tools(card: dict[str, Any]) -> None:
    """每个 skill 至少一个工具,且该工具真实注册在 mcp_server._TOOLS。"""
    for skill in card["skills"]:
        assert set(skill) == {"id", "name", "description", "tags"}
        tools_in_scope = {t for t, scope in TOOL_SCOPE_MAP.items() if scope == skill["id"]}
        assert tools_in_scope, f"{skill['id']} 无工具映射"
        advertised = [tag for tag in skill["tags"] if tag in REGISTERED_TOOLS or tag in TOOL_SCOPE_MAP]
        assert advertised, f"{skill['id']} 未列出任何真实工具"
        assert set(advertised) <= tools_in_scope, f"{skill['id']} 工具不属于该 scope"
        assert set(advertised) <= REGISTERED_TOOLS, f"{skill['id']} 声称了未注册工具"


def test_skills_exclude_non_advertisable_scopes(card: dict[str, Any]) -> None:
    ids = {s["id"] for s in card["skills"]}
    for scope in NOT_ADVERTISABLE:
        assert scope in MANIFEST_SCOPES, f"基线假设失效:{scope} 不在能力清单"
        assert scope not in ids, f"{scope} 门禁不放行给外部凭据,不得进卡片"


def test_skills_only_third_party_eligible_scopes(card: dict[str, Any]) -> None:
    for skill in card["skills"]:
        entry = MANIFEST_BY_SCOPE[skill["id"]]
        assert entry["thirdPartyEligible"] is True
        assert entry["dataClass"] != "platform"


def test_skills_are_deterministic(card: dict[str, Any]) -> None:
    again = agent_card.build_agent_card("https://aizhs.top")
    assert card["skills"] == again["skills"]
    assert [s["id"] for s in card["skills"]] == sorted(s["id"] for s in card["skills"])


def test_skills_fail_closed_when_manifest_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """清单缺失 → skills 空数组(宁缺不假),卡片仍可构建。"""
    monkeypatch.setattr(agent_card, "load_capability_manifest", lambda: None)
    built = agent_card.build_agent_card("https://aizhs.top")
    assert built["skills"] == []
    assert "skills" in built


def test_build_skills_ignores_unregistered_tools() -> None:
    """工具集为空(极端:没有任何工具真实注册)→ 不得产出任何 skill。"""
    manifest = agent_card.load_capability_manifest()
    assert manifest is not None
    assert agent_card.build_skills(manifest, frozenset()) == []


# ===========================================================================
# 3. 不泄露内网信息
# ===========================================================================


def test_card_contains_no_secrets_or_internal_bind(card: dict[str, Any]) -> None:
    text = json.dumps(card, ensure_ascii=False)
    monkey_secrets = [settings.jwt_secret, settings.ihui_principal_secret, settings.redis_url]
    for secret in monkey_secrets:
        assert not secret or secret not in text
    for internal in ("0.0.0.0", "127.0.0.1", "localhost", f":{settings.port}"):
        assert internal not in text, f"卡片泄露内网地址片段 {internal}"


def test_card_provider_is_public_site(card: dict[str, Any]) -> None:
    assert card["provider"]["url"] == agent_card.PROVIDER_URL == "https://aizhs.top"


# ===========================================================================
# 4. 对外基址推导(复用 mcp_export 白名单语义)
# ===========================================================================


def test_base_url_keeps_loopback_port_for_local_dev(allowlisted: None) -> None:
    assert agent_card.resolve_public_base_url({"host": "127.0.0.1:8803"}, "http") == "http://127.0.0.1:8803"


def test_base_url_prefers_forwarded_proto(allowlisted: None) -> None:
    headers = {"host": "aizhs.top", "x-forwarded-proto": "https"}
    assert agent_card.resolve_public_base_url(headers, "http") == "https://aizhs.top"


def test_base_url_rejects_bogus_forwarded_proto(allowlisted: None) -> None:
    headers = {"host": "aizhs.top", "x-forwarded-proto": "gopher://x"}
    assert agent_card.resolve_public_base_url(headers, "http") == "http://aizhs.top"


def test_base_url_forces_https_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top")
    assert agent_card.resolve_public_base_url({"host": "aizhs.top"}, "http") == "https://aizhs.top"


def test_base_url_forged_host_falls_back_to_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    """非白名单 Host → 用配置的第一个公网域,绝不回显伪造值。"""
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top www.aizhs.top")
    base = agent_card.resolve_public_base_url({"host": "10.1.2.3:8899"}, "http")
    assert base == "https://aizhs.top"


def test_base_url_raises_when_allowlist_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "")
    with pytest.raises(agent_card.PublicBaseUrlError):
        agent_card.resolve_public_base_url({"host": "10.1.2.3:8899"}, "http")


def test_base_url_rejects_subdomain_of_allowlisted_host(monkeypatch: pytest.MonkeyPatch) -> None:
    """白名单是精确主机匹配(与 mcp_export 同口径):子域不回显,回落公网域。"""
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top")
    monkeypatch.setattr(settings, "node_env", "production")
    base = agent_card.resolve_public_base_url({"host": "evil.aizhs.top"}, "http")
    assert base == "https://aizhs.top"
    assert "evil" not in base


def test_base_url_prefers_forwarded_host_through_reverse_proxy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """O20 web 反代场景:host 被代理重写为内网目标,原公网 Host 在 x-forwarded-host。"""
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top")
    monkeypatch.setattr(settings, "node_env", "production")
    headers = {"host": "localhost:8803", "x-forwarded-host": "aizhs.top"}
    base = agent_card.resolve_public_base_url(headers, "http")
    assert base == "https://aizhs.top"
    assert "localhost" not in base


def test_forwarded_host_multihop_takes_first_hop(monkeypatch: pytest.MonkeyPatch) -> None:
    """多级代理的 x-forwarded-host 是逗号列表,取第一段(最靠近客户端的一跳)。"""
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top")
    headers = {
        "host": "localhost:8803",
        "x-forwarded-host": "aizhs.top, inner-proxy.local",
        "x-forwarded-proto": "https",
    }
    assert agent_card.resolve_public_base_url(headers, "http") == "https://aizhs.top"


def test_forged_forwarded_host_falls_back_to_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    """伪造 x-forwarded-host 不在白名单 ⇒ 与伪造 host 同口径:回落公网域,不回显。"""
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top")
    monkeypatch.setattr(settings, "node_env", "production")
    headers = {"host": "localhost:8803", "x-forwarded-host": "evil.example.com"}
    base = agent_card.resolve_public_base_url(headers, "http")
    assert base == "https://aizhs.top"
    assert "evil" not in base


# ===========================================================================
# 5. 发现端点(HTTP 层)
# ===========================================================================


def test_wellknown_returns_card_anonymously(client: TestClient) -> None:
    resp = client.get(agent_wellknown.AGENT_CARD_PATH, headers={"host": "aizhs.top"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["url"] == "https://aizhs.top/api/a2a/tasks"
    assert resp.headers["cache-control"] == agent_wellknown.CACHE_CONTROL


def test_wellknown_alias_path_returns_same_body(client: TestClient) -> None:
    a = client.get(agent_wellknown.AGENT_CARD_PATH, headers={"host": "aizhs.top"})
    b = client.get(agent_wellknown.AGENT_CARD_ALIAS_PATH, headers={"host": "aizhs.top"})
    assert b.status_code == 200
    assert a.json() == b.json()


def test_wellknown_uses_request_host_for_url(client: TestClient) -> None:
    resp = client.get(agent_wellknown.AGENT_CARD_PATH, headers={"host": "www.aizhs.top"})
    assert resp.json()["url"] == "https://www.aizhs.top/api/a2a/tasks"


def test_wellknown_forged_host_does_not_leak_internal_url(client: TestClient) -> None:
    resp = client.get(agent_wellknown.AGENT_CARD_PATH, headers={"host": "192.168.4.20:8803"})
    assert resp.status_code == 200
    text = resp.text
    assert "192.168.4.20" not in text
    assert resp.json()["url"].startswith("https://aizhs.top")


def test_wellknown_403_when_no_public_host_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "")
    monkeypatch.setattr(settings, "node_env", "development")
    app = FastAPI()
    app.include_router(agent_wellknown.router)
    resp = TestClient(app).get(agent_wellknown.AGENT_CARD_PATH, headers={"host": "10.0.0.7:9"})
    assert resp.status_code == 403
    assert "url" not in resp.text


# --- JWT 中间件放行:发现端点必须匿名可读 --------------------------------------


def _app_with_jwt_middleware() -> TestClient:
    app = FastAPI()
    app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(agent_wellknown.router)
    return TestClient(app)


def test_wellknown_needs_jwt_public_path_entry(monkeypatch: pytest.MonkeyPatch) -> None:
    """未登记白名单 → 生产 JWT 中间件 401(这条把"必须改 config.py"钉成可执行证据)。"""
    monkeypatch.setattr(settings, "jwt_secret", "unit-test-secret")
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setattr(jwt_auth, "PUBLIC_PATHS", ("/api/health",))
    resp = _app_with_jwt_middleware().get(agent_wellknown.AGENT_CARD_PATH, headers={"host": "aizhs.top"})
    assert resp.status_code == 401


def test_wellknown_is_anonymous_once_whitelisted(monkeypatch: pytest.MonkeyPatch) -> None:
    """登记白名单后:无任何凭据 → 200(发现用途的验收条件)。"""
    monkeypatch.setattr(settings, "jwt_secret", "unit-test-secret")
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "aizhs.top")
    monkeypatch.setattr(jwt_auth, "PUBLIC_PATHS", agent_wellknown.JWT_PUBLIC_PATHS)
    client = _app_with_jwt_middleware()
    for path in agent_wellknown.JWT_PUBLIC_PATHS:
        resp = client.get(path, headers={"host": "aizhs.top"})
        assert resp.status_code == 200, path


def test_jwt_public_paths_constant_covers_both_routes() -> None:
    assert set(agent_wellknown.JWT_PUBLIC_PATHS) == {
        agent_wellknown.AGENT_CARD_PATH,
        agent_wellknown.AGENT_CARD_ALIAS_PATH,
    }
    registered = {r.path for r in agent_wellknown.router.routes}
    assert registered == set(agent_wellknown.JWT_PUBLIC_PATHS)


# ===========================================================================
# 6. 任务端点接 Principal(HTTP 层端到端)
# ===========================================================================


@pytest.fixture()
def task_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """挂真实 a2a 路由 + 内存态服务:不连 Redis、不外呼 agent。"""
    import app.routers.a2a as a2a_module

    server = A2AServer()
    monkeypatch.setattr(a2a_module, "a2a_server", server)
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setattr(settings, "ihui_principal_secret", "unit-test-principal-secret")
    app = FastAPI()
    app.include_router(a2a_router, prefix="/api")
    with (
        patch.object(A2AServer, "_get_redis", new=AsyncMock(return_value=None)),
        patch.object(A2AServer, "_execute_task", new=AsyncMock(return_value=None)),
    ):
        yield TestClient(app)


def _internal_headers(sub: str, *scopes: str) -> dict[str, str]:
    header = cg.build_principal_header(
        sub=sub, role=0, scopes=list(scopes), exp=time.time() + 120
    )
    return {cg.PRINCIPAL_HEADER_NAME: header}


def test_tasks_require_credentials(task_client: TestClient) -> None:
    resp = task_client.post("/api/a2a/tasks", json={"name": "t"})
    assert resp.status_code == 401


def test_task_owner_is_principal_sub_and_others_get_403(task_client: TestClient) -> None:
    created = task_client.post(
        "/api/a2a/tasks",
        json={"name": "t", "input": {"goal": "g"}, "assigned_agent_id": "a1"},
        headers=_internal_headers("user-a", "agents:call", "agents:read"),
    )
    assert created.status_code == 200
    task_id = created.json()["id"]
    # 响应形状冻结
    assert set(created.json()) == {
        "id",
        "name",
        "agent_id",
        "input",
        "status",
        "result",
        "error",
        "created_at",
        "updated_at",
    }

    mine = task_client.get(
        f"/api/a2a/tasks/{task_id}/status",
        headers=_internal_headers("user-a", "agents:read"),
    )
    assert mine.status_code == 200
    assert mine.json()["task_id"] == task_id

    for path in (f"/api/a2a/tasks/{task_id}/status", f"/api/a2a/tasks/{task_id}/result"):
        theirs = task_client.get(path, headers=_internal_headers("user-b", "agents:read"))
        assert theirs.status_code == 403, path

    missing = task_client.get(
        "/api/a2a/tasks/task-does-not-exist/status",
        headers=_internal_headers("user-b", "agents:read"),
    )
    assert missing.status_code == 404


def test_task_read_requires_scope(task_client: TestClient) -> None:
    created = task_client.post(
        "/api/a2a/tasks",
        json={"name": "t"},
        headers=_internal_headers("user-a", "agents:call"),
    )
    assert created.status_code == 200
    task_id = created.json()["id"]
    denied = task_client.get(
        f"/api/a2a/tasks/{task_id}/status",
        headers=_internal_headers("user-a", "chat:read"),
    )
    assert denied.status_code == 403


def test_task_create_requires_call_scope(task_client: TestClient) -> None:
    resp = task_client.post(
        "/api/a2a/tasks",
        json={"name": "t"},
        headers=_internal_headers("user-a", "agents:read"),
    )
    assert resp.status_code == 403


def test_legacy_agent_endpoints_shape_unchanged(task_client: TestClient) -> None:
    """向后兼容:注册/列表两端的路径与响应形状未受影响。"""
    registered = task_client.post(
        "/api/a2a/agents/register",
        json={"id": "a1", "name": "A1", "capabilities": ["x"], "endpoint": "http://x"},
    )
    assert registered.status_code == 200
    assert registered.json() == {
        "id": "a1",
        "name": "A1",
        "capabilities": ["x"],
        "endpoint": "http://x",
        "description": "",
    }
    listing = task_client.get("/api/a2a/agents")
    assert listing.status_code == 200
    assert listing.json() == {"agents": [registered.json()], "count": 1}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
