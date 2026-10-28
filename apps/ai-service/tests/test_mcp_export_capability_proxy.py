# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP export 层"能力闸代理"回归(标准 MCP 客户端连上真实工具集 + 强制收权)。

覆盖:
1. tools/list 动态代理内部工具集 —— 只列"已登记能力目录且在调用方 scope 内"的工具,
   未登记工具绝不外泄;自诊断三件套恒在;能力目录缺失 → 不声明任何内部工具(fail-safe);
2. tools/call 无 scope / 工具未登记 → ScopeDeniedError(403 结构化),且绝不触内部引擎;
   带内经 MCPServer.call_tool 以 JSON-RPC error(data 携带裁决体)表达;
3. tools/call 有 scope → 转 mcp_server.call_tool,principal.role/sub 透传为
   user_role/user_id(替代历史硬编码 0);
4. 生产环境无凭据 → 401(transport 入口 + 带内解析两处同判);
5. validate_request_host 在 _ExportDispatcher 入口被**实际调用**(防 DNS rebinding),
   非回环 Host 一律 403,白名单(settings.mcp_export_allowed_hosts)才放行。

测试隔离铁律:不连生产 PG(8810)/ Redis(8811)—— 内部引擎 call_tool 整体 mock,
能力目录内存注入,transport 只到 ASGI 入口闸(不起 uvicorn、不出网、不建 session)。
"""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Final

import pytest
from httpx import ASGITransport, AsyncClient
from mcp.shared.exceptions import MCPError
from starlette.requests import Request

from app.core.config import settings
from app.services import capability_gate as cg
from app.services import mcp_export as export
from app.services import mcp_server as internal_mcp

# 样例工具名:登记态/越权断言一律跑本文件注入的内存清单,不耦合生成物内容
REGISTERED_TOOL: Final = "read_file"
REGISTERED_TOOL_SCOPE: Final = "files:read"
UNREGISTERED_TOOL: Final = "search_web"  # 仅相对于**本文件注入的**内存清单
STREAMABLE_PATH: Final = export.MCP_EXPORT_PREFIX + export.ENDPOINT_STREAMABLE
SSE_PATH: Final = export.MCP_EXPORT_PREFIX + export.ENDPOINT_SSE
LOOPBACK_HOST: Final = {"host": "127.0.0.1:8000"}


@pytest.fixture(autouse=True)
def _prod_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认按生产环境判定 —— 非生产存在本地开发回退主体,验证不了收权。"""
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setattr(settings, "ihui_principal_secret", "test-principal-secret")
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "")


@pytest.fixture
def manifest(monkeypatch: pytest.MonkeyPatch) -> cg.CapabilityManifest:
    """内存态能力目录:1 个可放行 + 1 个 scope 不足 + 1 个平台级(机器通道永不放行)。"""
    m = cg.CapabilityManifest(
        tool_scope={
            REGISTERED_TOOL: REGISTERED_TOOL_SCOPE,
            "run_command": "sandbox:run",
            "computer_mouse_click": "computer:operate",
        },
        scope_meta={
            REGISTERED_TOOL_SCOPE: cg.ScopeMeta(
                data_class="scoped-read", risk="low", third_party_eligible=True
            ),
            "sandbox:run": cg.ScopeMeta(
                data_class="compute", risk="critical", third_party_eligible=False
            ),
            "computer:operate": cg.ScopeMeta(
                data_class="platform", risk="critical", third_party_eligible=False
            ),
        },
    )
    monkeypatch.setattr(cg, "load_capability_manifest", lambda: m)
    return m


# ---------------------------------------------------------------------------
# 替身:只暴露被测代码真正读取的那一条链(ctx.request / context.request_context.request)
# ---------------------------------------------------------------------------


def _http_scope(headers: dict[str, str]) -> dict[str, object]:
    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": STREAMABLE_PATH,
        "raw_path": STREAMABLE_PATH.encode(),
        "query_string": b"",
        "root_path": export.MCP_EXPORT_PREFIX,
        "server": ("127.0.0.1", 8000),
        "client": ("127.0.0.1", 54321),
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }


def _http_request(headers: dict[str, str]) -> Request:
    return Request(_http_scope(headers))  # type: ignore[arg-type]


class _StubContext:
    """MCPServer.call_tool 的 context 替身(被测代码只读 request_context.request)。"""

    def __init__(self, headers: dict[str, str] | None = None) -> None:
        request = _http_request(headers) if headers is not None else None
        self.request_context = SimpleNamespace(request=request)


class _StubRequestContext:
    """lowlevel ServerRequestContext 替身(被测代码只读 ctx.request)。"""

    def __init__(self, headers: dict[str, str] | None = None) -> None:
        self.request = _http_request(headers) if headers is not None else None


class _Sent:
    """ASGI send 收集器:断言入口闸就地回绝了什么。"""

    def __init__(self) -> None:
        self.messages: list[dict[str, object]] = []

    async def __call__(self, message: dict[str, object]) -> None:
        self.messages.append(message)

    @property
    def status(self) -> int:
        return int(next(m["status"] for m in self.messages if "status" in m))

    @property
    def body(self) -> dict[str, object]:
        raw = next(m["body"] for m in self.messages if "body" in m)
        return json.loads(bytes(raw).decode())  # type: ignore[arg-type]


async def _empty_receive() -> dict[str, object]:
    return {"type": "http.request", "body": b"", "more_body": False}


def _principal_headers(
    scopes: list[str], *, role: int = 0, api_key_id: str | None = None
) -> dict[str, str]:
    value = cg.build_principal_header(
        sub="user-42", role=role, scopes=scopes, exp=time.time() + 60, api_key_id=api_key_id
    )
    return {cg.PRINCIPAL_HEADER_NAME: value, **LOOPBACK_HOST}


@pytest.fixture
def engine_calls(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, object]]:
    """把内部引擎 mcp_server.call_tool 换成记录型假实现(绝不触库)。"""
    calls: list[dict[str, object]] = []

    async def _fake_call_tool(
        name: str,
        arguments: dict[str, object] | None = None,
        *,
        user_role: int = 0,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, object]:
        calls.append(
            {
                "name": name,
                "arguments": dict(arguments or {}),
                "user_role": user_role,
                "user_id": user_id,
                "session_id": session_id,
            }
        )
        return {"ok": True, "tool": name}

    monkeypatch.setattr(internal_mcp.mcp_server, "call_tool", _fake_call_tool)
    return calls


# ---------------------------------------------------------------------------
# 1. tools/list:动态代理 + 未登记工具不外泄
# ---------------------------------------------------------------------------


async def test_tools_list_proxies_registered_subset_for_principal(
    manifest: cg.CapabilityManifest,
) -> None:
    listed = await export.get_mcp_server()._handle_list_tools(
        _StubRequestContext(_principal_headers([REGISTERED_TOOL_SCOPE])), None
    )
    names = {t.name for t in listed.tools}

    # 自诊断三件套保留
    assert names >= export.SELF_DIAGNOSTIC_TOOLS
    # 已登记且 scope 命中 → 列出
    assert REGISTERED_TOOL in names
    # 已登记但 scope 不足 / 平台级(机器通道) → 不列(视图与裁决同源)
    assert "run_command" not in names
    assert "computer_mouse_click" not in names
    # 未登记能力目录的内部工具 → 绝不外泄
    assert UNREGISTERED_TOOL not in names
    assert names <= export.SELF_DIAGNOSTIC_TOOLS | set(manifest.tool_scope)
    # 代理的是真实 schema,不是空壳
    proxied = next(t for t in listed.tools if t.name == REGISTERED_TOOL)
    assert proxied.description
    assert proxied.input_schema["type"] == "object"
    assert "path" in proxied.input_schema["properties"]


async def test_visible_export_tools_narrows_with_principal_scope(
    manifest: cg.CapabilityManifest,
) -> None:
    """视图随 scope 收紧:通配用户主体看全集,窄 scope 机器主体只看子集。"""
    broad = cg.Principal(kind="jwt", sub="u", role=0, scopes=frozenset({cg.ALL_SCOPES}))
    narrow = cg.Principal(
        kind="internal", sub="u", role=0, scopes=frozenset({REGISTERED_TOOL_SCOPE})
    )

    broad_names = {t.name for t in export.visible_export_tools(broad)}
    narrow_names = {t.name for t in export.visible_export_tools(narrow)}

    assert narrow_names < broad_names
    assert REGISTERED_TOOL in narrow_names
    assert "run_command" in broad_names and "run_command" not in narrow_names
    # 未登记内部工具永远不在导出视图(_TOOLS 全集 > 登记子集)
    assert len(export.export_proxied_tool_specs()) < len(internal_mcp._TOOLS)


async def test_missing_manifest_exposes_no_internal_tools(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """能力目录缺失 → fail-safe:不声明任何内部工具(自诊断三件套仍在)。"""
    monkeypatch.setattr(cg, "load_capability_manifest", lambda: None)
    principal = cg.Principal(kind="jwt", sub="u", role=0, scopes=frozenset({cg.ALL_SCOPES}))
    assert export.visible_export_tools(principal) == []


async def test_real_manifest_proxies_real_internal_toolset() -> None:
    """不打桩:真实 capabilities.json + 真实 _TOOLS 的交集确实被代理出去。"""
    real = cg.load_capability_manifest()
    assert real is not None, "缺 packages/types/generated/capabilities.json(先跑 export-capabilities)"
    internal_names = {t.name for t in internal_mcp._TOOLS}
    registered_internal = internal_names & set(real.tool_scope)
    assert registered_internal, "内部工具集与能力目录无交集,代理无从谈起"

    listed = await export.get_mcp_server()._handle_list_tools(
        _StubRequestContext(_principal_headers([cg.ALL_SCOPES])), None
    )
    names = {t.name for t in listed.tools}

    assert registered_internal <= names
    assert names >= export.SELF_DIAGNOSTIC_TOOLS
    # 除自诊断三件套外,导出视图一步都不越能力目录
    assert names - export.SELF_DIAGNOSTIC_TOOLS <= registered_internal


# ---------------------------------------------------------------------------
# 2. tools/call 越权:403 结构化,且绝不触引擎
# ---------------------------------------------------------------------------


async def test_tools_call_without_scope_is_structured_403(
    manifest: cg.CapabilityManifest, engine_calls: list[dict[str, object]]
) -> None:
    headers = _principal_headers(["chat:write"], api_key_id="key-1")
    principal = cg.resolve_principal_from_request(_http_request(headers))

    with pytest.raises(cg.ScopeDeniedError) as exc:
        await export.call_exported_tool(principal, REGISTERED_TOOL, {"path": "a.txt"})

    assert exc.value.http_status == 403
    assert exc.value.to_body()["errorCode"] == "SCOPE_DENIED"
    assert exc.value.to_body()["requiredScope"] == REGISTERED_TOOL_SCOPE
    assert engine_calls == []

    # 带内(MCP 客户端实际路径):MCP 没有 HTTP 状态位,403 以 JSON-RPC error 表达,
    # 结构化裁决体落在 data
    with pytest.raises(MCPError) as mcp_exc:
        await export.get_mcp_server().call_tool(
            REGISTERED_TOOL, {"path": "a.txt"}, _StubContext(headers)
        )
    assert mcp_exc.value.data["errorCode"] == "SCOPE_DENIED"
    assert mcp_exc.value.data["requiredScope"] == REGISTERED_TOOL_SCOPE
    assert mcp_exc.value.data["code"] == 403
    assert engine_calls == []


async def test_platform_scope_denied_even_for_wildcard_machine_channel(
    manifest: cg.CapabilityManifest, engine_calls: list[dict[str, object]]
) -> None:
    """'*' 通配不穿透平台/高危域:computer:operate 对机器凭据通道永不放行。"""
    headers = _principal_headers([cg.ALL_SCOPES], api_key_id="key-1")
    principal = cg.resolve_principal_from_request(_http_request(headers))
    with pytest.raises(cg.ScopeDeniedError) as exc:
        await export.call_exported_tool(principal, "computer_mouse_click", {})
    assert exc.value.required_scope == "computer:operate"
    assert engine_calls == []


async def test_unregistered_tool_call_is_denied_fail_safe(
    manifest: cg.CapabilityManifest, engine_calls: list[dict[str, object]]
) -> None:
    """未登记能力目录的工具:主体带通配 scope 也拒绝,且不落到内部引擎。"""
    headers = _principal_headers([cg.ALL_SCOPES])
    with pytest.raises(MCPError) as exc:
        await export.get_mcp_server().call_tool(UNREGISTERED_TOOL, {"query": "x"}, _StubContext(headers))
    assert exc.value.data["errorCode"] in {"SCOPE_DENIED", "TOOL_NOT_REGISTERED"}
    assert engine_calls == []


# ---------------------------------------------------------------------------
# 3. tools/call 有 scope:转内部引擎 + 身份透传
# ---------------------------------------------------------------------------


async def test_tools_call_with_scope_delegates_with_identity(
    manifest: cg.CapabilityManifest, engine_calls: list[dict[str, object]]
) -> None:
    headers = _principal_headers([REGISTERED_TOOL_SCOPE], role=3)
    result = await export.get_mcp_server().call_tool(
        REGISTERED_TOOL, {"path": "notes/a.txt"}, _StubContext(headers)
    )

    assert engine_calls == [
        {
            "name": REGISTERED_TOOL,
            "arguments": {"path": "notes/a.txt"},
            "user_role": 3,  # principal.role 透传
            "user_id": "user-42",  # principal.sub 透传
            "session_id": None,
        }
    ]
    assert result.is_error is False
    assert json.loads(result.content[0].text) == {"ok": True, "tool": REGISTERED_TOOL}


async def test_engine_failure_marks_is_error(
    manifest: cg.CapabilityManifest, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _failing(
        name: str, arguments: dict[str, object] | None = None, **_kw: object
    ) -> dict[str, object]:
        return {"ok": False, "error": "boom"}

    monkeypatch.setattr(internal_mcp.mcp_server, "call_tool", _failing)
    principal = cg.resolve_principal_from_request(
        _http_request(_principal_headers([REGISTERED_TOOL_SCOPE]))
    )

    result = await export.call_exported_tool(principal, REGISTERED_TOOL, {})
    assert result.is_error is True


# ---------------------------------------------------------------------------
# 自诊断三件套处置:豁免 scope 闸,不豁免凭据闸
# ---------------------------------------------------------------------------


async def test_self_diagnostic_tools_exempt_from_scope_gate(
    manifest: cg.CapabilityManifest,
) -> None:
    """三个自诊断工具零副作用:能力目录无映射,按明确豁免放行(scope 闸不拦)。"""
    headers = _principal_headers(["chat:write"], api_key_id="key-1")
    server = export.get_mcp_server()

    echo = await server.call_tool("ihui.echo", {"message": "over-proxy"}, _StubContext(headers))
    assert echo.content[0].text == "over-proxy"
    assert echo.is_error is False

    caps = json.loads(
        (await server.call_tool("ihui.capabilities", {}, _StubContext(headers))).content[0].text
    )
    assert caps["server"]["name"] == export.SERVER_NAME
    assert "stdio" in caps["transports"]
    # 自述清单与 tools/list 同源:窄 scope 的机器凭据反查不到未授予的登记工具
    assert set(caps["tools"]) == set(export.SELF_DIAGNOSTIC_TOOLS)
    assert caps["tool_count"] == len(caps["tools"])


async def test_capabilities_self_report_follows_principal_scope() -> None:
    """通配主体的 ihui.capabilities 自述已是真实工具集(不再是硬编码的三个自娱工具)。"""
    headers = _principal_headers([cg.ALL_SCOPES])
    caps = json.loads(
        (
            await export.get_mcp_server().call_tool("ihui.capabilities", {}, _StubContext(headers))
        ).content[0].text
    )
    assert caps["tool_count"] == len(caps["tools"]) > len(export.SELF_DIAGNOSTIC_TOOLS)
    assert set(caps["tools"]) >= export.SELF_DIAGNOSTIC_TOOLS
    assert set(caps["tools"]) - export.SELF_DIAGNOSTIC_TOOLS <= {t.name for t in internal_mcp._TOOLS}


async def test_credentials_gate_applies_to_self_diagnostic_tools() -> None:
    """豁免只针对 scope 闸:生产无凭据时连 ihui.echo 也 401。"""
    with pytest.raises(cg.PrincipalAuthError) as exc:
        await export.get_mcp_server().call_tool("ihui.echo", {"message": "x"}, _StubContext({}))
    assert exc.value.http_status == 401


# ---------------------------------------------------------------------------
# 4. 生产无凭据 → 401(transport 入口 + 带内解析)
# ---------------------------------------------------------------------------


async def test_production_without_credentials_is_401_in_band() -> None:
    with pytest.raises(cg.PrincipalAuthError) as call_exc:
        await export.get_mcp_server().call_tool(REGISTERED_TOOL, {}, _StubContext({}))
    assert call_exc.value.http_status == 401

    with pytest.raises(cg.PrincipalAuthError) as list_exc:
        await export.get_mcp_server()._handle_list_tools(_StubRequestContext({}), None)
    assert list_exc.value.http_status == 401


@pytest.fixture
async def export_client() -> Iterator[AsyncClient]:
    transport = ASGITransport(app=export.get_export_app())
    async with AsyncClient(transport=transport, base_url="http://127.0.0.1:8000") as ac:
        yield ac


async def test_production_anonymous_is_401_at_transport(export_client: AsyncClient) -> None:
    """SSE 建连与 streamable 请求都先解析 Principal:无凭据 → 401(不入 transport)。"""
    r = await export_client.post(STREAMABLE_PATH, json={}, headers=LOOPBACK_HOST)
    assert r.status_code == 401
    assert r.json()["code"] == 401

    r_sse = await export_client.get(SSE_PATH, headers=LOOPBACK_HOST)
    assert r_sse.status_code == 401


# ---------------------------------------------------------------------------
# 5. validate_request_host 真正接入入口(防 DNS rebinding)
# ---------------------------------------------------------------------------


@pytest.fixture
def host_spy(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """给 validate_request_host 套一层记录代理(证明入口真的调了它)。"""
    seen: list[str] = []
    real_validator = export.validate_request_host

    def _spy(
        host: str, allowed_devices: list[str] | set[str] | tuple[str, ...] | None = None
    ) -> bool:
        seen.append(host)
        return real_validator(host, allowed_devices)

    monkeypatch.setattr(export, "validate_request_host", _spy)
    return seen


async def test_entry_guard_rejects_foreign_host_and_accepts_credentials(
    host_spy: list[str],
) -> None:
    dispatcher = export._ExportDispatcher(export.get_mcp_server())

    # 凭据齐备 + 回环 Host → 入口放行(交官方 transport 处理,不回绝任何字节)
    sent_ok = _Sent()
    scope_ok = _http_scope(_principal_headers([REGISTERED_TOOL_SCOPE]))
    assert await dispatcher._guard_entry(scope_ok, _empty_receive, sent_ok) is False
    assert sent_ok.messages == []

    # 非回环且不在白名单 → 403,且校验函数确被调用(端口已剥离后才交给它)
    sent_bad = _Sent()
    scope_bad = _http_scope(
        {**_principal_headers([cg.ALL_SCOPES]), "host": "evil-rebind.example.com:8000"}
    )
    assert await dispatcher._guard_entry(scope_bad, _empty_receive, sent_bad) is True
    assert host_spy == ["127.0.0.1", "evil-rebind.example.com"]  # 每次入口都过闸,端口已剥离
    assert sent_bad.status == 403
    assert sent_bad.body["error"] == "forbidden_host"


async def test_illegal_host_is_rejected_at_transport_entry(
    export_client: AsyncClient, host_spy: list[str]
) -> None:
    r = await export_client.post(
        STREAMABLE_PATH, json={}, headers={"host": "evil-rebind.example.com:8000"}
    )
    assert r.status_code == 403
    assert host_spy == ["evil-rebind.example.com"]


async def test_whitelisted_host_passes_gate(
    export_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """白名单内 Host 不被误伤:卡在凭据闸(401),而不是 Host 闸(403)。"""
    monkeypatch.setattr(settings, "mcp_export_allowed_hosts", "mcp.example.com, other.example.com")
    r = await export_client.post(STREAMABLE_PATH, json={}, headers={"host": "mcp.example.com:8443"})
    assert r.status_code == 401


def test_request_host_of_strips_port_and_keeps_ipv6() -> None:
    assert export.request_host_of({"host": "127.0.0.1:8000"}) == "127.0.0.1"
    assert export.request_host_of({"host": "mcp.example.com"}) == "mcp.example.com"
    assert export.request_host_of({"host": "[::1]:8000"}) == "[::1]"
    assert export.request_host_of({"host": "::1"}) == "::1"
    assert export.request_host_of({}) == ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
