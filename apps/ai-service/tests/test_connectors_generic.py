# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""通用连接器框架测试(2026-11-23 立)。

覆盖:
- 操作定义校验(能力位/方法/路径/id 唯一)
- OpenAPI 导入(servers/base_url/能力推断/查询默认值)
- 自定义 HTTP:模板展开、响应提取、SSRF 拒绝、读操作执行、写操作条件
- 路由:目录、自定义配置保存、extra_fields 回填、invoke 三重门
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import require_request_user_id
from app.routers import connectors as connectors_router
from app.services import connector_store
from app.services.connectors import base, catalog, custom_http, managed, openapi_import

USER = "user-generic"


@pytest.fixture(autouse=True)
def _public_dns(monkeypatch):
    """测试环境不依赖真实 DNS:把域名解析固定到公网 IP。

    字面 IP / localhost / 元数据地址在解析前就已拦截,SSRF 用例不受影响。
    """
    monkeypatch.setattr(
        custom_http.socket,
        "getaddrinfo",
        lambda host, port: [(2, 1, 6, "", ("93.184.216.34", 0))],
    )


# ---------------------------------------------------------------------------
# 操作定义
# ---------------------------------------------------------------------------


def test_operation_validation_rejects_bad_shapes():
    with pytest.raises(base.ConnectorOperationError):
        base.ConnectorOperation.from_dict({"id": "x", "capability": "write"})
    with pytest.raises(base.ConnectorOperationError):
        base.ConnectorOperation.from_dict({"id": "x", "path": "https://evil.com/x"})
    with pytest.raises(base.ConnectorOperationError):
        base.ConnectorOperation.from_dict(
            {"id": "x", "capability": "action", "method": "GET", "path": "/x"}
        )
    with pytest.raises(base.ConnectorOperationError):
        base.normalize_operations(
            [
                {"id": "dup", "capability": "list", "method": "GET", "path": "/a"},
                {"id": "dup", "capability": "list", "method": "GET", "path": "/b"},
            ]
        )


def test_capability_summary_and_path_params():
    ops = [
        {"id": "a", "capability": "list"},
        {"id": "b", "capability": "action"},
    ]
    summary = base.capability_summary(ops)
    assert summary == {"list": True, "search": False, "fetch": False, "action": True}
    assert base.path_param_names("/x/{id}/y/{sub}") == ["id", "sub"]


# ---------------------------------------------------------------------------
# OpenAPI 导入
# ---------------------------------------------------------------------------


def test_openapi_import_maps_paths_and_infers_capability():
    spec = {
        "openapi": "3.0.0",
        "info": {"title": "Demo API", "version": "1.0"},
        "servers": [{"url": "https://api.example.com"}],
        "paths": {
            "/items": {
                "get": {
                    "operationId": "listItems",
                    "summary": "列出条目",
                    "parameters": [
                        {"name": "page_size", "in": "query", "schema": {"default": 20}},
                        {"name": "q", "in": "query", "required": True},
                    ],
                }
            },
            "/items/{item_id}": {
                "get": {"operationId": "getItem", "summary": "取单条"},
                "delete": {
                    "operationId": "deleteItem",
                    "summary": "删除",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {"reason": {"type": "string"}},
                                }
                            }
                        }
                    },
                },
            },
        },
    }
    result = openapi_import.parse_openapi(spec)
    assert result["base_url"] == "https://api.example.com"
    by_id = {op["id"]: op for op in result["operations"]}
    assert by_id["listItems"]["capability"] == "search"  # q 命中搜索提示词
    assert by_id["listItems"]["query"]["page_size"] == 20
    assert by_id["listItems"]["query"]["q"] == "{q}"
    assert by_id["getItem"]["capability"] == "fetch"
    assert by_id["deleteItem"]["capability"] == "action"
    assert by_id["deleteItem"]["body"] == {"reason": {}}


def test_openapi_import_accepts_yaml_text():
    yaml = pytest.importorskip("yaml")
    spec = {
        "openapi": "3.0.0",
        "servers": [{"url": "https://api.example.com"}],
        "paths": {"/ping": {"get": {"operationId": "ping"}}},
    }
    raw = yaml.safe_dump(spec, allow_unicode=True)
    parsed = openapi_import.parse_spec_text(raw)
    result = openapi_import.parse_openapi(parsed)
    assert result["base_url"] == "https://api.example.com"
    assert result["operations"][0]["id"] == "ping"


def test_openapi_import_requires_base_url_when_relative_server():
    spec = {"openapi": "3.0.0", "servers": [{"url": "/api"}], "paths": {"/x": {"get": {}}}}
    with pytest.raises(base.ConnectorOperationError):
        openapi_import.parse_openapi(spec)
    result = openapi_import.parse_openapi(spec, base_url="https://api.example.com")
    assert result["base_url"] == "https://api.example.com"


def test_catalog_has_platform_surfaces_and_unsupported_reason():
    payload = catalog.list_catalog()
    types = {t["type"] for t in payload["templates"]}
    assert {"feishu", "dingtalk", "wecom", "wechat_mp", "yuque"} <= types
    feishu = next(t for t in payload["templates"] if t["type"] == "feishu")
    capabilities = {op["capability"] for op in feishu["operations"]}
    assert {"list", "fetch", "action"} <= capabilities
    unsupported = {u["type"] for u in payload["unsupported"]}
    assert "wechat_personal" in unsupported
    yuque = next(t for t in payload["templates"] if t["type"] == "yuque")
    assert yuque["auth_kind"] == "header"
    assert yuque["auth_name"] == "X-Auth-Token"


# ---------------------------------------------------------------------------
# 自定义 HTTP 执行
# ---------------------------------------------------------------------------


def _record(**overrides: Any) -> dict[str, Any]:
    record = {
        "key": "custom:demo",
        "type": "custom",
        "name": "demo",
        "app_id": "",
        "app_secret": "",
        "extra": {},
        "mode": "custom",
        "spec": {
            "base_url": "https://api.example.com",
            "auth_kind": "none",
            "allow_write": False,
        },
        "operations": [
            {
                "id": "list_items",
                "name": "列表",
                "capability": "list",
                "method": "GET",
                "path": "/items",
                "query": {"page_size": 10},
                "response_path": "data.items",
            },
            {
                "id": "get_item",
                "name": "取单条",
                "capability": "fetch",
                "method": "GET",
                "path": "/items/{item_id}",
                "response_path": "data",
            },
            {
                "id": "create_item",
                "name": "新建",
                "capability": "action",
                "method": "POST",
                "path": "/items",
                "body": {"name": "{name}"},
            },
        ],
    }
    record.update(overrides)
    return record


class _FakeResponse:
    def __init__(self, payload: Any, status: int = 200) -> None:
        self._payload = payload
        self.status_code = status
        self.content = json.dumps(payload, ensure_ascii=False).encode()

    def json(self) -> Any:
        return self._payload


class _FakeClient:
    def __init__(self, response: _FakeResponse, captured: list[dict[str, Any]]) -> None:
        self._response = response
        self._captured = captured

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def request(self, method: str, url: str, **kwargs: Any) -> _FakeResponse:
        self._captured.append({"method": method, "url": url, **kwargs})
        return self._response


@pytest.mark.asyncio
async def test_custom_http_list_uses_template_and_response_path(monkeypatch):
    captured: list[dict[str, Any]] = []
    payload = {"data": {"items": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}]}}
    monkeypatch.setattr(
        custom_http.httpx,
        "AsyncClient",
        lambda **_kw: _FakeClient(_FakeResponse(payload), captured),
    )
    result = await custom_http.invoke(_record(), "list_items", {})
    assert result["ok"] is True
    assert result["items"] == [
        {"doc_id": "1", "title": "A"},
        {"doc_id": "2", "title": "B"},
    ]
    assert captured[0]["url"] == "https://api.example.com/items"
    assert captured[0]["params"] == {"page_size": 10}


@pytest.mark.asyncio
async def test_custom_http_fetch_fills_path_param(monkeypatch):
    captured: list[dict[str, Any]] = []
    monkeypatch.setattr(
        custom_http.httpx,
        "AsyncClient",
        lambda **_kw: _FakeClient(_FakeResponse({"data": {"content": "正文"}}), captured),
    )
    doc = await custom_http.fetch_document(_record(), "42")
    assert doc["ok"] is True and doc["content"] == "正文"
    assert captured[0]["url"] == "https://api.example.com/items/42"


@pytest.mark.asyncio
async def test_header_auth_optional_for_public_endpoint(monkeypatch):
    """语雀公开仓库无 token:header 鉴权留空不注入;填了才注入指定头名。"""
    captured: list[dict[str, Any]] = []
    monkeypatch.setattr(
        custom_http.httpx,
        "AsyncClient",
        lambda **_kw: _FakeClient(_FakeResponse({"data": {"items": []}}), captured),
    )
    spec = {"base_url": "https://api.example.com", "auth_kind": "header", "auth_name": "X-Auth-Token"}
    await custom_http.invoke(_record(spec=spec), "list_items", {})
    assert "X-Auth-Token" not in (captured[0].get("headers") or {})
    await custom_http.invoke(_record(spec=spec, app_secret="private-token"), "list_items", {})
    assert captured[1]["headers"]["X-Auth-Token"] == "private-token"


@pytest.mark.asyncio
async def test_write_requires_allow_write():
    connector = custom_http.CustomHttpConnector(_record())
    with pytest.raises(custom_http.ConnectorExecutionError):
        await connector.invoke("create_item", {"name": "x"})
    allowed = _record(spec={"base_url": "https://api.example.com", "allow_write": True})
    # allow_write 打开后仍需真实请求;这里只验证条件分支不再被拒
    assert custom_http.CustomHttpConnector(allowed)._by_id["create_item"].capability == "action"


@pytest.mark.asyncio
async def test_ssrf_blocks_localhost_and_private_ip():
    with pytest.raises(custom_http.ConnectorSecurityError):
        await custom_http.validate_outbound_url("http://127.0.0.1/x")
    with pytest.raises(custom_http.ConnectorSecurityError):
        await custom_http.validate_outbound_url("http://localhost/x")
    with pytest.raises(custom_http.ConnectorSecurityError):
        await custom_http.validate_outbound_url("http://169.254.169.254/latest/meta-data")
    with pytest.raises(custom_http.ConnectorSecurityError):
        await custom_http.validate_outbound_url("ftp://example.com/x")


# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------


@pytest.fixture
def generic_app(monkeypatch, tmp_path):
    monkeypatch.setattr(
        connector_store, "_STORE_PATH", tmp_path / "connector_store-generic.json"
    )
    app = FastAPI()
    app.include_router(connectors_router.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: USER
    return app


@pytest.fixture
async def generic_client(generic_app):
    async with AsyncClient(
        transport=ASGITransport(app=generic_app), base_url="http://test"
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_catalog_endpoint(generic_client):
    resp = await generic_client.get("/api/connectors/catalog")
    assert resp.status_code == 200
    body = resp.json()
    assert "templates" in body and "unsupported" in body
    assert any(t["type"] == "feishu" for t in body["templates"])


@pytest.mark.asyncio
async def test_save_custom_and_extra_fields_roundtrip(generic_client):
    # 非自定义类型:extra 非凭据键要能回填(旧实现在这里回填成 true)
    resp = await generic_client.post(
        "/api/connectors/config",
        json={
            "key": "yuque:docs",
            "type": "yuque",
            "name": "语雀",
            "extra": {"user": "team", "repo": "handbook", "token": "secret"},
        },
    )
    assert resp.status_code == 200
    item = resp.json()
    assert item["extra"] == {"user": True, "repo": True, "token": True}
    assert item["extra_fields"] == {"user": "team", "repo": "handbook"}

    resp = await generic_client.post(
        "/api/connectors/config",
        json={
            "key": "custom:demo",
            "type": "custom",
            "name": "自建系统",
            "mode": "custom",
            "spec": {
                "base_url": "https://api.example.com",
                "auth_kind": "header",
                "auth_name": "X-API-Key",
                "allow_write": True,
            },
            "operations": _record()["operations"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is True
    assert body["operation_count"] == 3
    assert body["operation_capabilities"]["action"] is True
    assert body["spec"]["headers"] == {}


@pytest.mark.asyncio
async def test_invoke_action_gates(monkeypatch, generic_client):
    monkeypatch.setattr(
        custom_http.httpx,
        "AsyncClient",
        lambda **_kw: _FakeClient(_FakeResponse({"ok": True}), []),
    )
    await generic_client.post(
        "/api/connectors/config",
        json={
            "key": "custom:demo",
            "type": "custom",
            "name": "自建系统",
            "mode": "custom",
            "spec": {
                "base_url": "https://api.example.com",
                "auth_kind": "none",
                "allow_write": False,
            },
            "operations": _record()["operations"],
        },
    )
    # 未开写权限
    resp = await generic_client.post(
        "/api/connectors/custom:demo/invoke",
        json={"operation_id": "create_item", "params": {"name": "x"}, "confirm": True},
    )
    assert resp.status_code == 400

    # 开写权限但没带 confirm
    await generic_client.post(
        "/api/connectors/config",
        json={
            "key": "custom:demo",
            "type": "custom",
            "name": "自建系统",
            "mode": "custom",
            "spec": {
                "base_url": "https://api.example.com",
                "auth_kind": "none",
                "allow_write": True,
            },
            "operations": _record()["operations"],
        },
    )
    resp = await generic_client.post(
        "/api/connectors/custom:demo/invoke",
        json={"operation_id": "create_item", "params": {"name": "x"}},
    )
    assert resp.status_code == 400

    resp = await generic_client.post(
        "/api/connectors/custom:demo/invoke",
        json={"operation_id": "create_item", "params": {"name": "x"}, "confirm": True},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_openapi_preview_endpoint(generic_client):
    spec = {
        "openapi": "3.0.0",
        "servers": [{"url": "https://api.example.com"}],
        "paths": {"/items": {"get": {"operationId": "listItems"}}},
    }
    resp = await generic_client.post(
        "/api/connectors/openapi/preview", json={"spec": spec, "base_url": ""}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["operation_count"] == 1
    assert body["operations"][0]["id"] == "listItems"


# ---------------------------------------------------------------------------
# 平台托管(零配置接入)
# ---------------------------------------------------------------------------


def test_managed_status_missing_env(monkeypatch):
    monkeypatch.delenv("FEISHU_APP_ID", raising=False)
    monkeypatch.delenv("FEISHU_APP_SECRET", raising=False)
    st = managed.status("feishu")
    assert st["available"] is False
    assert "FEISHU_APP_ID" in st["missing"]
    assert "FEISHU_APP_SECRET" in st["missing"]
    with pytest.raises(managed.ManagedUnavailable):
        managed.build_record("feishu")


def test_managed_record_never_stores_secrets(monkeypatch):
    monkeypatch.setenv("FEISHU_APP_ID", "cli_test")
    monkeypatch.setenv("FEISHU_APP_SECRET", "secret_test")
    rec = managed.build_record("feishu")
    assert rec["managed"] is True
    assert rec["app_id"] == "" and rec["app_secret"] == ""
    assert rec["key"] == "feishu:managed"
    hydrated = managed.hydrate(rec)
    assert hydrated["app_id"] == "cli_test"
    assert hydrated["app_secret"] == "secret_test"
    # 原记录不得被注水污染
    assert rec["app_secret"] == ""


@pytest.mark.asyncio
async def test_managed_connect_endpoint(monkeypatch, generic_client):
    monkeypatch.setenv("WECOM_CORP_ID", "corp_test")
    monkeypatch.setenv("WECOM_SECRET", "secret_test")
    monkeypatch.setenv("WECOM_AGENT_ID", "100001")
    resp = await generic_client.post(
        "/api/connectors/managed/connect", json={"type": "wecom"}
    )
    assert resp.status_code == 200
    item = resp.json()
    assert item["managed"] is True
    assert item["configured"] is True
    assert item["credential_source"] == "platform_env"
    assert item["key"] == "wecom:managed"
    assert item["extra_fields"].get("agent_id") == "100001"
    assert "secret_test" not in json.dumps(item)

    # 二次点击幂等,不重复建条
    again = await generic_client.post(
        "/api/connectors/managed/connect", json={"type": "wecom"}
    )
    assert again.status_code == 200
    assert again.json()["key"] == item["key"]


@pytest.mark.asyncio
async def test_check_connection_custom(generic_client):
    await generic_client.post(
        "/api/connectors/config",
        json={
            "key": "custom:check",
            "type": "custom",
            "name": "自检",
            "mode": "custom",
            "spec": {"base_url": "https://api.example.com", "auth_kind": "none"},
            "operations": _record()["operations"],
        },
    )
    resp = await generic_client.post("/api/connectors/custom:check/check")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "通过安全校验" in body["message"]


@pytest.mark.asyncio
async def test_managed_connect_unavailable(monkeypatch, generic_client):
    monkeypatch.delenv("FEISHU_APP_ID", raising=False)
    monkeypatch.delenv("FEISHU_APP_SECRET", raising=False)
    resp = await generic_client.post(
        "/api/connectors/managed/connect", json={"type": "feishu"}
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["type"] == "feishu"
    assert "FEISHU_APP_ID" in body["missing_env"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
