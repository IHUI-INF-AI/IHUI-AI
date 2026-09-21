# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""O9「MCP server 协议完整化」回归:协商 / resources / batching / progress / 元数据 / 限流。

覆盖两个入口:
- 带内层 ``app/routers/mcp_official.py``(/api/mcp,单入口 JSON-RPC,无长连接);
- transport 层 ``app/services/mcp_export.py``(官方 SDK,SSE / streamable / stdio,有长连接)。

断言清单(与任务项一一对应,且**只断言代码真做到了的行为**;没实现的能力反向锁死
"确实不受理",防未来虚报):

1. initialize 版本协商:支持集合内回显同值、集合外回服务端最新并在 ``result._meta`` 注明;
   能力声明**如实**(无 logging;listChanged / subscribe 全 false,对应方法 -32601);
2. resources/read:有 scope 放行、无 scope 403(且绝不触取值实现)、未登记 URI
   (含引擎内部可读的 ``sampling://handler``)-32602;resources/list 视图与裁决同源;
   export 侧同三条;``resources/subscribe`` / ``unsubscribe`` 只在**有长连接**的 export 侧
   实现(订阅登记 + 两条投递通道),带内层不声明也不受理;
3. batching:混合"成功 / 授权失败 / 未知方法 / 通知" → 逐元素结果、通知不产元素;
   空批与超上限整批拒绝;批内非法元素回错不炸;纯通知批 202;
4. tools 元数据:annotations 四项 hint 与 capabilities.json 的 dataClass/risk/domain
   一致(测试直接读该 JSON 独立复算,不复用生产推导函数,防清单漂移),并与 export 侧
   逐字一致;``outputSchema`` 只在形状可证处声明(自诊断三件套由 SDK 从返回类型推导),
   内部代理工具结果异构 → 两端都不声明;
5. 按 key 限流:机器凭据通道的 rpm / burst / concurrent 三条路径都真发 429(带内
   JSON-RPC error + export MCPError data.code=429 + transport HTTP 429);授权先于限流
   (被拒调用不白烧令牌);非机器通道不受限;档位确实取自清单 rateProfiles;
6. progressToken → notifications/progress:SSE 升级真实出帧(受理帧 + 真实"已耗时"心跳
   帧 + 同 id 结果帧、无假百分比),含一条走真实引擎长任务(generate_chart)的用例;
   export 侧走 SDK ``Context.report_progress``;客户端不接受 SSE 时不得假装推送;
7. notifications/tools/list_changed 真实广播:视图指纹变化才自增,广播同时打
   SubscriptionBus 与 legacy 活会话(断链会话自动摘除);
8. 匿名 401 未回归(带内单请求 / 批量 / resources / export transport)。

测试隔离铁律(AGENTS.md §5):不连生产 PG(8810)/ Redis(8811)。内部引擎
``mcp_server.call_tool`` / ``mcp_server.read_resource`` 一律 monkeypatch;需要窄配额时
注入内存能力目录,只有"与真实清单一致性"那组用例才读真文件(纯读,不写)。
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Final

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from mcp.server.mcpserver.exceptions import ResourceNotFoundError
from mcp.shared.exceptions import MCPError
from mcp.shared.subscriptions import ResourceUpdated, ToolsListChanged
from mcp_types import SubscribeRequestParams, UnsubscribeRequestParams
from pydantic import AnyUrl
from starlette.requests import Request

from app.core.config import settings
from app.routers import mcp_official
from app.services import capability_gate as cg
from app.services import mcp_export as export
from app.services import mcp_server as internal_mcp

_app = FastAPI()
_app.include_router(mcp_official.router, prefix="/api")
client = TestClient(_app)

MEMORY_URI: Final = "memory://current"
MEMORY_SCOPE: Final = "memory:read"
SKILLS_URI: Final = "skills://available"
SKILLS_SCOPE: Final = "skills:read"
CONFIG_URI: Final = "config://agent"
CONFIG_SCOPE: Final = "connectors:read"
PROXIED_TOOL: Final = "read_file"
PROXIED_SCOPE: Final = "files:read"
PRINCIPAL_SECRET: Final = "test-principal-secret"
LOOPBACK_HOST: Final = {"host": "127.0.0.1:8000"}


# ---------------------------------------------------------------------------
# 公共夹具与替身
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _principal_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """内网头 HMAC 密钥固定(默认非生产态走本地开发回退主体,生产态由 prod 夹具翻上去)。"""
    monkeypatch.setattr(settings, "ihui_principal_secret", PRINCIPAL_SECRET)


@pytest.fixture(autouse=True)
def _isolate_shared_gate_state() -> Iterator[None]:
    """工具版本号 / 广播监听器 / 令牌桶是模块级共享状态:逐用例归零并复原。

    复原监听器清单是必要的 —— ``_build_mcp_server()`` 会把 export 的广播器挂到全局清单上,
    本文件不得把它抹掉(否则同 worker 内后续 export 用例被无辜牵连)。
    """
    saved_listeners = list(cg._TOOLS_CHANGED_LISTENERS)  # noqa: SLF001
    cg.reset_tools_revision_state()
    cg.machine_rate_limiter.reset()
    yield
    cg.reset_tools_revision_state()
    cg.machine_rate_limiter.reset()
    cg._TOOLS_CHANGED_LISTENERS[:] = saved_listeners  # noqa: SLF001


@pytest.fixture
def prod(monkeypatch: pytest.MonkeyPatch) -> None:
    """生产态:无凭据必须 401(非生产存在本地开发回退主体,验不出收权)。"""
    monkeypatch.setattr(settings, "node_env", "production")


def _headers(scopes: list[str], *, api_key_id: str | None = None, role: int = 0) -> dict[str, str]:
    """签发一个内网可信头主体(带 api_key_id 即"机器凭据通道")。"""
    value = cg.build_principal_header(
        sub="user-42",
        role=role,
        scopes=scopes,
        exp=time.time() + 600,
        api_key_id=api_key_id,
        secret=PRINCIPAL_SECRET,
    )
    return {cg.PRINCIPAL_HEADER_NAME: value}


def _send(
    method: str,
    params: dict[str, Any] | None = None,
    msg_id: int | str | None = 1,
    *,
    headers: dict[str, str] | None = None,
    accept: str | None = None,
) -> Any:
    body: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
    if msg_id is not None:
        body["id"] = msg_id
    if params is not None:
        body["params"] = params
    hdrs = dict(headers or {})
    if accept is not None:
        hdrs["accept"] = accept
    return client.post("/api/mcp", json=body, headers=hdrs)


def _send_payload(payload: Any, *, headers: dict[str, str] | None = None) -> Any:
    return client.post("/api/mcp", json=payload, headers=dict(headers or {}))


def _http_request(headers: dict[str, str]) -> Request:
    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": export.MCP_EXPORT_PREFIX + export.ENDPOINT_STREAMABLE,
        "query_string": b"",
        "root_path": export.MCP_EXPORT_PREFIX,
        "server": ("127.0.0.1", 8000),
        "client": ("127.0.0.1", 54321),
        "headers": [
            (k.lower().encode(), v.encode()) for k, v in {**headers, **LOOPBACK_HOST}.items()
        ],
    }
    return Request(scope)  # type: ignore[arg-type]


class _Ctx:
    """SDK ``Context`` 替身:只暴露被测代码真正读的那几个口(request/session/进度)。"""

    def __init__(self, headers: dict[str, str] | None = None, session: Any | None = None) -> None:
        request = _http_request(headers) if headers is not None else None
        self.request_context = SimpleNamespace(request=request, session=session)
        self.progress: list[tuple[float, float | None, str | None]] = []

    async def report_progress(
        self, progress: float, total: float | None = None, message: str | None = None
    ) -> None:
        self.progress.append((progress, total, message))


class _ReqCtx:
    """lowlevel ``ServerRequestContext`` 替身(只读 request / session)。"""

    def __init__(self, headers: dict[str, str] | None = None, session: Any | None = None) -> None:
        self.request = _http_request(headers) if headers is not None else None
        self.session = session


class _FakeSession:
    """ServerSession 替身:记录服务端发起的通知;``fail=True`` 模拟断链以验摘除逻辑。"""

    def __init__(self, *, fail: bool = False) -> None:
        self.list_changed = 0
        self.updated: list[str] = []
        self._fail = fail

    async def send_tool_list_changed(self) -> None:
        if self._fail:
            raise RuntimeError("connection closed")
        self.list_changed += 1

    async def send_resource_updated(self, uri: Any) -> None:
        if self._fail:
            raise RuntimeError("connection closed")
        self.updated.append(str(uri))


class _FakeBus:
    """SubscriptionBus 替身:记录 publish 出去的事件类型。"""

    def __init__(self) -> None:
        self.events: list[Any] = []

    async def publish(self, event: Any) -> None:
        self.events.append(event)

    def subscribe(self, listener: Any) -> Any:  # pragma: no cover - 本用例不投监听器
        return lambda: None


def _tiny_profile_manifest(
    monkeypatch: pytest.MonkeyPatch,
    *,
    rpm: int,
    burst: int,
    concurrent: int,
    scope: str = PROXIED_SCOPE,
) -> cg.CapabilityManifest:
    """内存注入一份"配额可控"的能力目录(不读真文件,限流断言才确定)。"""
    manifest = cg.CapabilityManifest(
        tool_scope={PROXIED_TOOL: scope},
        scope_meta={
            scope: cg.ScopeMeta(
                data_class="scoped-read",
                risk="low",
                third_party_eligible=True,
                domain="file",
                idempotency_required=False,
            )
        },
        rate_profiles={
            "low": cg.RateProfile(
                rpm=rpm, burst=burst, daily_calls=100, concurrent=concurrent, max_duration_ms=5000
            )
        },
    )
    monkeypatch.setattr(cg, "load_capability_manifest", lambda: manifest)
    return manifest


def _engine_spy(monkeypatch: pytest.MonkeyPatch, *, delay_s: float = 0.0) -> list[dict[str, Any]]:
    """把内部引擎 call_tool 换成记录型假实现(绝不触库/不触网)。"""
    calls: list[dict[str, Any]] = []

    async def _fake(
        name: str,
        arguments: dict[str, Any] | None = None,
        *,
        user_role: int = 0,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        calls.append({"name": name, "user_role": user_role, "user_id": user_id})
        if delay_s:
            await asyncio.sleep(delay_s)
        return {"ok": True, "tool": name}

    monkeypatch.setattr(internal_mcp.mcp_server, "call_tool", _fake)
    return calls


@pytest.fixture
def resource_engine(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """resources 取值替身(绝不打真实 memory_store / skill_registry)。"""
    seen: list[str] = []

    async def _fake_read(uri: str) -> dict[str, Any]:
        seen.append(uri)
        return {"uri": uri, "content": {"stub": uri}, "ok": True}

    monkeypatch.setattr(internal_mcp.mcp_server, "read_resource", _fake_read)
    return seen


def _sse_frames(raw: str) -> list[dict[str, Any]]:
    """SSE 文本 → 逐帧 JSON-RPC 消息。"""
    frames: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        for line in block.splitlines():
            if line.startswith("data: "):
                frames.append(json.loads(line[len("data: ") :]))
    return frames


def _real_catalog() -> dict[str, Any]:
    """测试侧独立期望值:直接读 capabilities.json,不复用生产推导函数(否则断言恒真)。"""
    raw: dict[str, Any] = json.loads(Path(cg.manifest_file()).read_text(encoding="utf-8"))
    return raw


# ---------------------------------------------------------------------------
# 1. 版本协商 + 能力如实声明
# ---------------------------------------------------------------------------


class TestVersionNegotiation:
    @pytest.mark.parametrize("version", ["2025-03-26", "2025-06-18"])
    def test_supported_version_is_echoed_back(self, version: str) -> None:
        r = _send("initialize", {"protocolVersion": version, "capabilities": {}})
        assert r.status_code == 200
        result = r.json()["result"]
        assert result["protocolVersion"] == version
        assert "_meta" not in result  # 满足了客户端要的版本 → 不该出现回退说明

    def test_unsupported_version_falls_back_to_latest_with_note(self) -> None:
        r = _send("initialize", {"protocolVersion": "2026-07-28", "capabilities": {}})
        result = r.json()["result"]
        assert result["protocolVersion"] == mcp_official.MCP_PROTOCOL_VERSION
        note = result["_meta"][mcp_official.NEGOTIATION_META_KEY]
        assert note["requested"] == "2026-07-28"
        assert note["negotiated"] == mcp_official.MCP_PROTOCOL_VERSION
        assert note["supported"] == list(mcp_official.SUPPORTED_PROTOCOL_VERSIONS)
        assert note["reason"]

    def test_missing_version_negotiates_latest(self) -> None:
        result = _send("initialize", {"capabilities": {}}).json()["result"]
        assert result["protocolVersion"] == mcp_official.MCP_PROTOCOL_VERSION
        assert "未声明" in result["_meta"][mcp_official.NEGOTIATION_META_KEY]["reason"]

    def test_server_never_claims_versions_it_does_not_implement(self) -> None:
        assert mcp_official.MCP_PROTOCOL_VERSION in mcp_official.SUPPORTED_PROTOCOL_VERSIONS
        assert "2026-07-28" not in mcp_official.SUPPORTED_PROTOCOL_VERSIONS


class TestCapabilityHonesty:
    def test_capabilities_are_declared_as_implemented(self) -> None:
        """不虚报:未实现 logging/setLevel;无长连接 → listChanged/subscribe 全 false。"""
        caps = _send(
            "initialize", {"protocolVersion": "2025-06-18"}
        ).json()["result"]["capabilities"]
        assert "logging" not in caps
        assert caps["tools"] == {"listChanged": False}
        assert caps["resources"] == {"subscribe": False, "listChanged": False}
        assert caps["prompts"]["listChanged"] is False

    def test_unadvertised_methods_are_not_accepted(self) -> None:
        """没声明的能力就不受理:-32601,而不是"受理了但什么都不推"。"""
        for method in (
            "resources/subscribe",
            "resources/unsubscribe",
            "logging/setLevel",
            "subscriptions/listen",
            "resources/templates/list",
        ):
            r = _send(method, {"uri": MEMORY_URI}, msg_id=7, headers=_headers([cg.ALL_SCOPES]))
            assert r.status_code == 404, method
            assert r.json()["error"]["code"] == mcp_official.ERR_METHOD_NOT_FOUND

    def test_initialized_notification_is_accepted(self) -> None:
        assert _send("notifications/initialized", msg_id=None).status_code == 200


# ---------------------------------------------------------------------------
# 2. resources/read(带内层 + export 层)
# ---------------------------------------------------------------------------


class TestResourcesRead:
    def test_read_with_scope_returns_contents(self, resource_engine: list[str]) -> None:
        r = _send("resources/read", {"uri": MEMORY_URI}, headers=_headers([MEMORY_SCOPE]))
        assert r.status_code == 200
        contents = r.json()["result"]["contents"]
        assert contents[0]["uri"] == MEMORY_URI
        assert contents[0]["mimeType"] == "application/json"
        assert json.loads(contents[0]["text"]) == {"stub": MEMORY_URI}
        assert resource_engine == [MEMORY_URI]

    def test_read_without_scope_is_403(self, resource_engine: list[str]) -> None:
        r = _send("resources/read", {"uri": MEMORY_URI}, headers=_headers([SKILLS_SCOPE]))
        assert r.status_code == 403
        err = r.json()["error"]
        assert err["data"]["errorCode"] == "SCOPE_DENIED"
        assert err["data"]["requiredScope"] == MEMORY_SCOPE
        assert resource_engine == []  # 被拒的请求绝不落到取值实现

    def test_each_resource_requires_its_own_scope(self, resource_engine: list[str]) -> None:
        """三资源的 scope 逐一生效(对配 200,错配一律 403)。"""
        for uri, scope in (
            (MEMORY_URI, MEMORY_SCOPE),
            (SKILLS_URI, SKILLS_SCOPE),
            (CONFIG_URI, CONFIG_SCOPE),
        ):
            ok = _send("resources/read", {"uri": uri}, headers=_headers([scope]))
            assert ok.status_code == 200, uri
            denied = _send("resources/read", {"uri": uri}, headers=_headers(["agents:read"]))
            assert denied.status_code == 403, uri
            assert denied.json()["error"]["data"]["requiredScope"] == scope

    def test_unregistered_uri_is_rejected(self, resource_engine: list[str]) -> None:
        """未登记 URI(含引擎内部实现能读的 sampling://handler)不得经 MCP 协议读出。"""
        wildcard = _headers([cg.ALL_SCOPES])
        for uri in ("sampling://handler", "memory://other", "bogus://x"):
            r = _send("resources/read", {"uri": uri}, headers=wildcard)
            assert r.status_code == 400, uri
            assert r.json()["error"]["code"] == mcp_official.ERR_INVALID_PARAMS
        assert resource_engine == []

    def test_missing_uri_is_invalid_params(self) -> None:
        r = _send("resources/read", {}, headers=_headers([cg.ALL_SCOPES]))
        assert r.status_code == 400
        assert r.json()["error"]["code"] == mcp_official.ERR_INVALID_PARAMS

    def test_resources_list_view_follows_scope(self) -> None:
        """视图与裁决同源:窄 scope 只列得出它能读的资源。"""
        narrow = _send(
            "resources/list", headers=_headers([SKILLS_SCOPE])
        ).json()["result"]["resources"]
        assert [x["uri"] for x in narrow] == [SKILLS_URI]
        broad = _send(
            "resources/list", headers=_headers([cg.ALL_SCOPES])
        ).json()["result"]["resources"]
        assert {x["uri"] for x in broad} == {MEMORY_URI, SKILLS_URI, CONFIG_URI}

    def test_platform_capability_denied_for_machine_channel(
        self, resource_engine: list[str], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """机器凭据通道即便带通配 scope,也读不到被划成平台域的资源。"""
        manifest = cg.CapabilityManifest(
            tool_scope={},
            scope_meta={
                CONFIG_SCOPE: cg.ScopeMeta(
                    data_class="platform",
                    risk="critical",
                    third_party_eligible=False,
                    domain="platform",
                )
            },
        )
        monkeypatch.setattr(cg, "load_capability_manifest", lambda: manifest)
        r = _send(
            "resources/read", {"uri": CONFIG_URI}, headers=_headers([cg.ALL_SCOPES], api_key_id="k1")
        )
        assert r.status_code == 403
        assert r.json()["error"]["data"]["requiredScope"] == CONFIG_SCOPE
        assert resource_engine == []


class TestExportResourceSurface:
    async def test_read_exported_resource_with_scope(self, monkeypatch: pytest.MonkeyPatch) -> None:
        async def _fake_read(uri: str) -> dict[str, Any]:
            return {"uri": uri, "content": {"sessions": ["s1"]}, "ok": True}

        monkeypatch.setattr(internal_mcp.mcp_server, "read_resource", _fake_read)
        principal = cg.resolve_principal_from_request(_http_request(_headers([MEMORY_SCOPE])))
        contents = await export.read_exported_resource(principal, MEMORY_URI)
        assert json.loads(str(contents[0].content)) == {"sessions": ["s1"]}
        assert contents[0].mime_type == "application/json"

    async def test_read_exported_resource_denied(self, monkeypatch: pytest.MonkeyPatch) -> None:
        async def _unused(uri: str) -> dict[str, Any]:  # pragma: no cover - 被拒即不该进来
            raise AssertionError("被拒的读取不应触达取值实现")

        monkeypatch.setattr(internal_mcp.mcp_server, "read_resource", _unused)
        principal = cg.resolve_principal_from_request(_http_request(_headers([SKILLS_SCOPE])))
        with pytest.raises(cg.ScopeDeniedError) as exc:
            await export.read_exported_resource(principal, MEMORY_URI)
        assert exc.value.http_status == 403

        # 带内(SDK 路径):403 以 JSON-RPC error 表达,结构化裁决体在 data
        with pytest.raises(MCPError) as mcp_exc:
            await export.get_mcp_server().read_resource(
                AnyUrl(MEMORY_URI), _Ctx(_headers([SKILLS_SCOPE]))
            )
        assert mcp_exc.value.data["errorCode"] == "SCOPE_DENIED"
        assert mcp_exc.value.data["requiredScope"] == MEMORY_SCOPE

    async def test_unregistered_resource_raises_not_found(self) -> None:
        principal = cg.resolve_principal_from_request(_http_request(_headers([cg.ALL_SCOPES])))
        with pytest.raises(ResourceNotFoundError):
            await export.read_exported_resource(principal, "sampling://handler")

    async def test_list_resources_narrows_with_principal(self) -> None:
        result = await export.get_mcp_server()._handle_list_resources(
            _ReqCtx(_headers([CONFIG_SCOPE])), None
        )
        assert [r.uri for r in result.resources] == [CONFIG_URI]
        assert {str(r.uri) for r in export.visible_export_resources(None)} == set(cg.RESOURCE_SCOPES)


# ---------------------------------------------------------------------------
# 2b. resources/subscribe + unsubscribe(export 长连接侧;带内侧不声明也不受理)
# ---------------------------------------------------------------------------


class TestExportResourceSubscription:
    async def test_handlers_registered_so_capability_is_not_hollow(self) -> None:
        """声明 resources.subscribe 的依据 = 方法真注册在 lowlevel server 上。"""
        served = export.get_mcp_server()._lowlevel_server._request_handlers  # noqa: SLF001
        assert "resources/subscribe" in served
        assert "resources/unsubscribe" in served

    async def test_subscribe_then_update_reaches_bus_and_session(self) -> None:
        server = export.get_mcp_server()
        bus = _FakeBus()
        server._subscriptions = bus  # noqa: SLF001 - 只换投递口
        session = _FakeSession()
        export._resource_subscriptions.clear()  # noqa: SLF001

        result = await server._handle_subscribe(
            _ReqCtx(_headers([MEMORY_SCOPE]), session=session),
            SubscribeRequestParams(uri=MEMORY_URI),
        )
        assert result.model_dump(exclude_none=True) is not None
        assert export._resource_subscriptions.subscriber_count(MEMORY_URI) == 1  # noqa: SLF001

        await export.notify_resource_updated(MEMORY_URI)
        assert len(bus.events) == 1 and isinstance(bus.events[0], ResourceUpdated)
        assert session.updated == [MEMORY_URI]

    async def test_unsubscribe_stops_delivery(self) -> None:
        server = export.get_mcp_server()
        session = _FakeSession()
        export._resource_subscriptions.clear()  # noqa: SLF001
        await server._handle_subscribe(
            _ReqCtx(_headers([MEMORY_SCOPE]), session=session), SubscribeRequestParams(uri=MEMORY_URI)
        )
        await server._handle_unsubscribe(
            _ReqCtx(_headers([MEMORY_SCOPE]), session=session),
            UnsubscribeRequestParams(uri=MEMORY_URI),
        )
        assert export._resource_subscriptions.subscriber_count(MEMORY_URI) == 0  # noqa: SLF001
        await export.notify_resource_updated(MEMORY_URI)
        assert session.updated == []

    async def test_subscribe_without_scope_is_denied(self) -> None:
        server = export.get_mcp_server()
        export._resource_subscriptions.clear()  # noqa: SLF001
        with pytest.raises(MCPError) as exc:
            await server._handle_subscribe(
                _ReqCtx(_headers([SKILLS_SCOPE]), session=_FakeSession()),
                SubscribeRequestParams(uri=MEMORY_URI),
            )
        assert exc.value.data["errorCode"] == "SCOPE_DENIED"
        assert exc.value.data["requiredScope"] == MEMORY_SCOPE
        assert export._resource_subscriptions.subscriber_count(MEMORY_URI) == 0  # noqa: SLF001

    async def test_subscribe_unregistered_uri_is_denied(self) -> None:
        server = export.get_mcp_server()
        with pytest.raises(MCPError) as exc:
            await server._handle_subscribe(
                _ReqCtx(_headers([cg.ALL_SCOPES]), session=_FakeSession()),
                SubscribeRequestParams(uri="sampling://handler"),
            )
        assert exc.value.data["errorCode"] == "RESOURCE_NOT_REGISTERED"

    async def test_dead_session_is_pruned_on_notify(self) -> None:
        server = export.get_mcp_server()
        dead = _FakeSession(fail=True)
        export._resource_subscriptions.clear()  # noqa: SLF001
        await server._handle_subscribe(
            _ReqCtx(_headers([MEMORY_SCOPE]), session=dead), SubscribeRequestParams(uri=MEMORY_URI)
        )
        await export.notify_resource_updated(MEMORY_URI)
        assert export._resource_subscriptions.subscriber_count(MEMORY_URI) == 0  # noqa: SLF001


# ---------------------------------------------------------------------------
# 3. JSON-RPC 批量
# ---------------------------------------------------------------------------


class TestBatching:
    def test_mixed_batch_returns_per_element_results(self, resource_engine: list[str]) -> None:
        batch = [
            {"jsonrpc": "2.0", "id": 1, "method": "ping"},
            {"jsonrpc": "2.0", "id": 2, "method": "bogus/method"},
            {"jsonrpc": "2.0", "id": 3, "method": "resources/read", "params": {"uri": MEMORY_URI}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
        ]
        r = _send_payload(batch, headers=_headers([SKILLS_SCOPE]))
        assert r.status_code == 200
        bodies = r.json()
        # 通知不产元素,其余三条各自带自己的 id
        assert [b.get("id") for b in bodies] == [1, 2, 3]
        assert bodies[0]["result"] == {}
        assert bodies[1]["error"]["code"] == mcp_official.ERR_METHOD_NOT_FOUND
        assert bodies[2]["error"]["data"]["errorCode"] == "SCOPE_DENIED"

    def test_batch_failure_does_not_poison_siblings(self, resource_engine: list[str]) -> None:
        batch = [
            {"jsonrpc": "2.0", "id": "a", "method": "resources/read", "params": {"uri": MEMORY_URI}},
            {"jsonrpc": "2.0", "id": "b", "method": "resources/read", "params": {"uri": MEMORY_URI}},
        ]
        bodies = _send_payload(batch, headers=_headers([MEMORY_SCOPE])).json()
        assert all("result" in b for b in bodies)
        assert resource_engine == [MEMORY_URI, MEMORY_URI]

    def test_empty_batch_is_rejected(self) -> None:
        r = _send_payload([], headers=_headers([cg.ALL_SCOPES]))
        assert r.status_code == 400
        assert r.json()["error"]["code"] == mcp_official.ERR_INVALID_REQUEST

    def test_oversized_batch_is_rejected(self) -> None:
        batch = [
            {"jsonrpc": "2.0", "id": i, "method": "ping"}
            for i in range(mcp_official.MAX_BATCH_SIZE + 1)
        ]
        r = _send_payload(batch, headers=_headers([cg.ALL_SCOPES]))
        assert r.status_code == 400
        assert "上限" in r.json()["error"]["message"]

    def test_illegal_batch_element_reports_error_not_crash(self) -> None:
        bodies = _send_payload(["nope", 42, {"nested": []}], headers=_headers([cg.ALL_SCOPES])).json()
        assert len(bodies) == 3
        assert all(b["error"]["code"] == mcp_official.ERR_INVALID_REQUEST for b in bodies)

    def test_notification_only_batch_is_202(self) -> None:
        batch = [{"jsonrpc": "2.0", "method": "notifications/initialized"}]
        r = _send_payload(batch, headers=_headers([cg.ALL_SCOPES]))
        assert r.status_code == 202
        assert r.json() == {}


# ---------------------------------------------------------------------------
# 4. 工具元数据:annotations 与能力目录一致 + 两端一致;outputSchema 不虚报
# ---------------------------------------------------------------------------


class TestToolAnnotations:
    def test_every_registered_tool_carries_annotations(self) -> None:
        tools = mcp_official._handle_tools_list()["tools"]
        registered = set(_real_catalog()["toolScopeMap"])
        listed = {t["name"] for t in tools}
        assert listed & registered, "真实能力目录与工具集无交集,用例前提不成立"
        for tool in tools:
            if tool["name"] in registered:
                assert "annotations" in tool, f"{tool['name']} 已登记却没有 annotations(漂移)"

    def test_annotations_match_catalog_data_class(self) -> None:
        """逐工具反查:dataClass / risk / domain 决定四项 hint(独立复算,防实现漂移)。"""
        catalog = _real_catalog()
        meta_by_scope = {c["scope"]: c for c in catalog["capabilities"]}
        by_name = {t["name"]: t for t in mcp_official._handle_tools_list()["tools"]}
        closed = {"file", "memory", "knowledge", "codebase", "tool"}
        checked = 0
        for name, tool in by_name.items():
            scope = catalog["toolScopeMap"].get(name)
            if scope is None:
                continue
            entry = meta_by_scope[scope]
            data_class = entry["dataClass"]
            ann = tool["annotations"]
            assert ann["readOnlyHint"] is (data_class == "scoped-read"), name
            assert ann["openWorldHint"] is (entry["domain"] not in closed), name
            if data_class == "scoped-read":
                assert "destructiveHint" not in ann, name  # 规范:只读时该 hint 无意义
            else:
                expected = data_class in {"scoped-write", "platform"} or entry["risk"] in {
                    "high",
                    "critical",
                }
                assert ann["destructiveHint"] is expected, name
                assert ann["idempotentHint"] is (
                    bool(entry["idempotencyRequired"])
                    and data_class in {"scoped-write", "platform"}
                ), name
            checked += 1
        assert checked >= 40, f"仅校验了 {checked} 个工具的注解,覆盖不足"

    def test_write_tools_are_destructive_and_read_tools_are_not(self) -> None:
        """任务点名的口径:files:write → destructiveHint true;files:read → readOnlyHint true。"""
        by_name = {t["name"]: t for t in mcp_official._handle_tools_list()["tools"]}
        for name in ("write_file", "file_edit", "resolve_conflict"):
            assert by_name[name]["annotations"]["destructiveHint"] is True
            assert by_name[name]["annotations"]["readOnlyHint"] is False
        for name in ("read_file", "list_files", "file_search"):
            assert by_name[name]["annotations"]["readOnlyHint"] is True
            assert "destructiveHint" not in by_name[name]["annotations"]

    def test_view_is_narrowed_by_scope(self) -> None:
        """视图与裁决同源:窄 scope 主体在 tools/list 就看不到调不动的工具。"""
        broad = _send("tools/list", headers=_headers([cg.ALL_SCOPES])).json()["result"]["tools"]
        narrow = _send("tools/list", headers=_headers([PROXIED_SCOPE])).json()["result"]["tools"]
        names_broad = {t["name"] for t in broad}
        names_narrow = {t["name"] for t in narrow}
        assert names_narrow < names_broad
        assert PROXIED_TOOL in names_narrow
        assert "run_command" in names_broad and "run_command" not in names_narrow

    def test_no_output_schema_without_structured_content(self) -> None:
        """带内层只回 text content,故一个 outputSchema 都不许声明(声明即虚报)。"""
        assert all("outputSchema" not in t for t in mcp_official._handle_tools_list()["tools"])

    async def test_export_side_annotations_are_identical(self) -> None:
        """两端 annotations 逐字一致(同一推导函数 + 同一清单)。"""
        listed = await export.get_mcp_server()._handle_list_tools(
            _ReqCtx(_headers([cg.ALL_SCOPES])), None
        )
        export_ann = {
            t.name: t.annotations.model_dump(by_alias=True, exclude_none=True)
            for t in listed.tools
            if t.annotations is not None
        }
        official_ann = {
            t["name"]: t["annotations"]
            for t in mcp_official._handle_tools_list()["tools"]
            if "annotations" in t
        }
        shared = set(export_ann) & set(official_ann)
        assert len(shared) >= 40
        for name in shared:
            assert export_ann[name] == official_ann[name], name

    async def test_export_output_schema_only_where_shape_is_provable(self) -> None:
        listed = await export.get_mcp_server()._handle_list_tools(
            _ReqCtx(_headers([cg.ALL_SCOPES])), None
        )
        with_schema = {t.name for t in listed.tools if t.output_schema}
        # 自诊断三件套:返回类型即契约,SDK 推导得出(形状可证)
        assert with_schema <= export.SELF_DIAGNOSTIC_TOOLS
        # 内部代理工具结果异构 → 不声明(与带内层同一诚实口径)
        assert PROXIED_TOOL not in with_schema


# ---------------------------------------------------------------------------
# 5. 按 key 限流(带内 / 带外三条路径 + 档位来源)
# ---------------------------------------------------------------------------


class TestMachineRateLimit:
    def test_in_band_tools_call_returns_429_after_quota(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _tiny_profile_manifest(monkeypatch, rpm=2, burst=2, concurrent=4)
        calls = _engine_spy(monkeypatch)
        headers = _headers([PROXIED_SCOPE], api_key_id="key-1")

        for _ in range(2):
            r = _send("tools/call", {"name": PROXIED_TOOL, "arguments": {}}, headers=headers)
            assert r.status_code == 200, r.text
        r = _send("tools/call", {"name": PROXIED_TOOL, "arguments": {}}, headers=headers)
        assert r.status_code == 429
        assert r.json()["error"]["data"]["errorCode"] == "RATE_LIMITED"
        assert r.json()["error"]["data"]["retryAfterMs"] >= 0
        assert len(calls) == 2  # 超限那次没有真的执行

    def test_concurrency_slot_is_released_between_calls(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """concurrent=1:串行 N 次全通过(用完即还)。"""
        _tiny_profile_manifest(monkeypatch, rpm=600, burst=600, concurrent=1)
        _engine_spy(monkeypatch)
        headers = _headers([PROXIED_SCOPE], api_key_id="key-serial")
        for i in range(4):
            r = _send(
                "tools/call", {"name": PROXIED_TOOL, "arguments": {}}, msg_id=i, headers=headers
            )
            assert r.status_code == 200, r.text

    async def test_concurrent_calls_beyond_profile_are_throttled(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """真并发:第二个在途请求必须被 concurrent 闸拦下,且第一个结束后额度回来。"""
        _tiny_profile_manifest(monkeypatch, rpm=600, burst=600, concurrent=1)
        gate = asyncio.Event()

        async def _slow(
            name: str, arguments: dict[str, Any] | None = None, **_kw: Any
        ) -> dict[str, Any]:
            await gate.wait()
            return {"ok": True, "tool": name}

        monkeypatch.setattr(internal_mcp.mcp_server, "call_tool", _slow)
        principal = cg.Principal(
            kind="internal",
            sub="u",
            role=0,
            scopes=frozenset({PROXIED_SCOPE}),
            api_key_id="key-c",
        )
        first = asyncio.create_task(export.call_exported_tool(principal, PROXIED_TOOL, {}))
        await asyncio.sleep(0.05)  # 让第一次调用占住在途位
        with pytest.raises(cg.RateLimitExceeded) as exc:
            await export.call_exported_tool(principal, PROXIED_TOOL, {})
        assert exc.value.http_status == 429
        gate.set()
        await first
        again = await export.call_exported_tool(principal, PROXIED_TOOL, {})
        assert again.is_error is False  # 并发位归还了,不是泄漏

    def test_user_channel_is_not_machine_rate_limited(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """非机器通道(本地开发回退 / 用户 JWT)不吃这把闸:交互会话不该按 key 配额掐死。"""
        _tiny_profile_manifest(monkeypatch, rpm=1, burst=1, concurrent=1)
        _engine_spy(monkeypatch)
        for i in range(3):
            assert (
                _send("tools/call", {"name": PROXIED_TOOL, "arguments": {}}, msg_id=i).status_code
                == 200
            )

    def test_denied_scope_never_consumes_quota(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """授权先于限流:scope 不足的调用不该白烧机器凭据的令牌。"""
        _tiny_profile_manifest(monkeypatch, rpm=1, burst=1, concurrent=1)
        _engine_spy(monkeypatch)
        headers = _headers(["agents:read"], api_key_id="key-deny")
        for _ in range(3):
            r = _send("tools/call", {"name": PROXIED_TOOL, "arguments": {}}, headers=headers)
            assert r.status_code == 403
        ok_headers = _headers([PROXIED_SCOPE], api_key_id="key-deny-ok")
        assert (
            _send(
                "tools/call", {"name": PROXIED_TOOL, "arguments": {}}, headers=ok_headers
            ).status_code
            == 200
        )

    async def test_export_in_band_error_carries_429_semantics(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _tiny_profile_manifest(monkeypatch, rpm=1, burst=1, concurrent=4)
        _engine_spy(monkeypatch)
        headers = _headers([PROXIED_SCOPE], api_key_id="key-inband")
        first = await export.get_mcp_server().call_tool(PROXIED_TOOL, {}, _Ctx(headers))
        assert first.is_error is False
        with pytest.raises(MCPError) as exc:
            await export.get_mcp_server().call_tool(PROXIED_TOOL, {}, _Ctx(headers))
        assert exc.value.data["code"] == 429
        assert exc.value.data["errorCode"] == "RATE_LIMITED"

    async def test_transport_entry_returns_http_429(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _tiny_profile_manifest(monkeypatch, rpm=1, burst=1, concurrent=8)
        sent: list[dict[str, Any]] = []

        async def _send_cb(message: dict[str, Any]) -> None:
            sent.append(message)

        async def _receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b"", "more_body": False}

        dispatcher = export._ExportDispatcher(export.get_mcp_server())
        headers = _headers([PROXIED_SCOPE], api_key_id="key-transport")
        asgi_scope: dict[str, Any] = {
            "type": "http",
            "path": export.MCP_EXPORT_PREFIX + export.ENDPOINT_STREAMABLE,
            "headers": [
                (k.lower().encode(), v.encode()) for k, v in {**headers, **LOOPBACK_HOST}.items()
            ],
        }
        assert await dispatcher._guard_entry(asgi_scope, _receive, _send_cb) is False
        sent.clear()
        assert await dispatcher._guard_entry(asgi_scope, _receive, _send_cb) is True
        status = int(next(m["status"] for m in sent if "status" in m))
        assert status == 429
        body = json.loads(bytes(next(m["body"] for m in sent if "body" in m)).decode())
        assert body["errorCode"] == "RATE_LIMITED"

    def test_missing_manifest_skips_limiting_but_not_admission(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """目录缺失 → 无档位可查:限流不介入,交互主体照旧由权限矩阵兜底。"""
        monkeypatch.setattr(cg, "load_capability_manifest", lambda: None)
        _engine_spy(monkeypatch)
        assert _send("tools/call", {"name": PROXIED_TOOL, "arguments": {}}).status_code == 200

    def test_profile_comes_from_catalog_rate_profiles(self) -> None:
        raw = _real_catalog()
        profile = cg.rate_profile_for_scope(PROXIED_SCOPE)
        assert profile is not None
        entry = next(c for c in raw["capabilities"] if c["scope"] == PROXIED_SCOPE)
        expected = raw["rateProfiles"][entry["risk"]]
        assert (profile.rpm, profile.burst, profile.concurrent) == (
            expected["rpm"],
            expected["burst"],
            expected["concurrent"],
        )

    def test_unknown_scope_falls_back_to_strictest_profile(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        manifest = cg.CapabilityManifest(
            tool_scope={},
            scope_meta={},
            rate_profiles={
                "low": cg.RateProfile(rpm=600, burst=100, daily_calls=1, concurrent=8, max_duration_ms=1),
                "critical": cg.RateProfile(rpm=5, burst=2, daily_calls=1, concurrent=1, max_duration_ms=1),
            },
        )
        monkeypatch.setattr(cg, "load_capability_manifest", lambda: manifest)
        profile = cg.rate_profile_for_scope("nope:unknown")
        assert profile is not None and profile.rpm == 5

    def test_transport_profile_uses_loosest_granted_scope(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        manifest = cg.CapabilityManifest(
            tool_scope={},
            scope_meta={
                "a:read": cg.ScopeMeta("scoped-read", "critical", True, "tool", False),
                "b:read": cg.ScopeMeta("scoped-read", "low", True, "tool", False),
            },
            rate_profiles={
                "low": cg.RateProfile(rpm=600, burst=600, daily_calls=1, concurrent=8, max_duration_ms=1),
                "critical": cg.RateProfile(rpm=5, burst=5, daily_calls=1, concurrent=1, max_duration_ms=1),
            },
        )
        monkeypatch.setattr(cg, "load_capability_manifest", lambda: manifest)
        principal = cg.Principal(
            kind="internal",
            sub="u",
            role=0,
            scopes=frozenset({"a:read", "b:read"}),
            api_key_id="k",
        )
        profile = cg.loosest_rate_profile_for_principal(principal)
        # 入口闸取最宽档:只挡洪水,绝不比带内 per-scope 闸更早拒合法请求
        assert profile is not None and profile.rpm == 600


# ---------------------------------------------------------------------------
# 6. progressToken → notifications/progress
# ---------------------------------------------------------------------------


class TestProgressChannel:
    def test_sse_upgrade_streams_progress_then_result(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """受理帧 + 心跳帧 + 结果帧,全在同一条 SSE 响应里;进度单调且无假百分比。"""
        _engine_spy(monkeypatch, delay_s=0.15)
        monkeypatch.setattr(mcp_official, "PROGRESS_HEARTBEAT_INTERVAL_S", 0.02)
        r = _send(
            "tools/call",
            {"name": PROXIED_TOOL, "arguments": {}, "_meta": {"progressToken": "tok-1"}},
            accept="application/json, text/event-stream",
        )
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        frames = _sse_frames(r.text)
        notifications = [f for f in frames if f.get("method") == "notifications/progress"]
        responses = [f for f in frames if "result" in f]
        assert notifications, "一个进度帧都没发出来"
        assert notifications[0]["params"]["progress"] == 0  # 受理帧
        assert {n["params"]["progressToken"] for n in notifications} == {"tok-1"}
        values = [n["params"]["progress"] for n in notifications]
        assert values == sorted(values) and len(set(values)) > 1, f"进度非单调递增: {values}"
        assert all("total" not in n["params"] for n in notifications)  # 引擎无分阶段计数 → 不编
        assert len(responses) == 1 and responses[0]["id"] == 1
        assert responses[0]["result"]["isError"] is False

    def test_real_long_tool_flows_through_progress_stream(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """走真实引擎的真实工具(generate_chart):进度通道不吞结果。"""
        monkeypatch.setattr(mcp_official, "PROGRESS_HEARTBEAT_INTERVAL_S", 0.005)
        r = _send(
            "tools/call",
            {
                "name": "generate_chart",
                "arguments": {
                    "chart_type": "pie",
                    "title": "O9 进度流",
                    "data": '[{"name":"A","value":1}]',
                },
                "_meta": {"progressToken": 7},
            },
            msg_id=11,
            accept="text/event-stream",
        )
        frames = _sse_frames(r.text)
        assert any(f.get("method") == "notifications/progress" for f in frames)
        final = next(f for f in frames if "result" in f)
        assert final["id"] == 11
        payload = json.loads(final["result"]["content"][0]["text"])
        assert payload["ok"] is True and payload["file_path"]

    def test_json_mode_when_client_does_not_accept_sse(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """没有 SSE 通道就不硬塞进度:回普通 JSON 单响应(不假装有推送)。"""
        _engine_spy(monkeypatch, delay_s=0.05)
        monkeypatch.setattr(mcp_official, "PROGRESS_HEARTBEAT_INTERVAL_S", 0.01)
        r = _send(
            "tools/call",
            {"name": PROXIED_TOOL, "arguments": {}, "_meta": {"progressToken": "t"}},
        )
        assert r.headers["content-type"].startswith("application/json")
        assert "result" in r.json()

    def test_non_tools_call_is_not_upgraded(self, resource_engine: list[str]) -> None:
        """只有 tools/call 会升级成 SSE;其余方法保持 HTTP 状态语义(403 就是 403)。"""
        r = _send(
            "resources/read",
            {"uri": MEMORY_URI},
            headers=_headers([SKILLS_SCOPE]),
            accept="text/event-stream",
        )
        assert r.status_code == 403
        assert not r.headers["content-type"].startswith("text/event-stream")

    async def test_export_reports_progress_via_sdk_context(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _tiny_profile_manifest(monkeypatch, rpm=600, burst=600, concurrent=8)
        _engine_spy(monkeypatch, delay_s=0.12)
        monkeypatch.setattr(export, "PROGRESS_HEARTBEAT_INTERVAL_S", 0.02)
        ctx = _Ctx(_headers([PROXIED_SCOPE]))
        result = await export.get_mcp_server().call_tool(PROXIED_TOOL, {}, ctx)
        assert result.is_error is False
        assert len(ctx.progress) >= 2
        assert [p[0] for p in ctx.progress] == sorted(p[0] for p in ctx.progress)
        assert all(p[1] is None for p in ctx.progress)  # 无 total:不编造百分比

    async def test_export_without_context_still_calls_tool(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """stdio 直调(完全没有 Context):拿不到进度口与请求头,裁决/限流照走、不得崩。"""
        _tiny_profile_manifest(monkeypatch, rpm=600, burst=600, concurrent=8)
        calls = _engine_spy(monkeypatch)
        result = await export.get_mcp_server().call_tool(PROXIED_TOOL, {}, None)
        assert result.is_error is False
        assert calls[0]["name"] == PROXIED_TOOL
        assert not hasattr(result, "progress")  # 结果对象不携带任何伪造的进度字段


# ---------------------------------------------------------------------------
# 7. 工具集变更广播
# ---------------------------------------------------------------------------


class TestToolsRevisionAndBroadcast:
    async def test_view_fingerprint_bumps_only_on_real_change(self) -> None:
        names = ["read_file", "write_file"]
        assert await cg.refresh_tools_revision(names) == 0  # 首次只建基线
        assert await cg.refresh_tools_revision(names) == 0  # 视图未变 → 不自增
        assert await cg.refresh_tools_revision([*names, "web_search"]) == 1
        assert cg.tools_revision() == 1

    async def test_explicit_change_notifies_registered_listeners(self) -> None:
        seen: list[int] = []

        async def _listener() -> None:
            seen.append(cg.tools_revision())

        cg.register_tools_changed_listener(_listener)
        assert await export.notify_tools_list_changed("unit-test") == 1
        assert seen == [1]

    async def test_broken_listener_does_not_swallow_the_rest(self) -> None:
        seen: list[str] = []

        async def _bad() -> None:
            raise RuntimeError("listener down")

        async def _good() -> None:
            seen.append("ok")

        cg.register_tools_changed_listener(_bad)
        cg.register_tools_changed_listener(_good)
        await cg.refresh_tools_revision(None, reason="boom")
        assert seen == ["ok"]

    async def test_export_broadcast_hits_bus_and_live_sessions(self) -> None:
        server = export.get_mcp_server()
        assert isinstance(server, export._CapabilityProxyServer)
        bus = _FakeBus()
        server._subscriptions = bus  # noqa: SLF001 - 只换投递口,不动裁决链
        live = _FakeSession()
        dead = _FakeSession(fail=True)
        broadcaster = export._session_broadcaster  # noqa: SLF001
        broadcaster.clear()
        broadcaster.observe(live)
        broadcaster.observe(dead)

        cg.register_tools_changed_listener(server.publish_tools_list_changed)
        await export.notify_tools_list_changed("test-broadcast")

        assert len(bus.events) == 1 and isinstance(bus.events[0], ToolsListChanged)
        assert live.list_changed == 1
        assert len(broadcaster) == 1  # 断链会话已被摘除

    async def test_list_tools_observes_session_and_stamps_version(self) -> None:
        broadcaster = export._session_broadcaster  # noqa: SLF001
        broadcaster.clear()
        session = _FakeSession()
        result = await export.get_mcp_server()._handle_list_tools(
            _ReqCtx(_headers([cg.ALL_SCOPES]), session=session), None
        )
        assert len(broadcaster) == 1  # 入站请求顺路登记会话
        dumped = result.model_dump(by_alias=True, exclude_none=True)
        assert dumped["_meta"]["toolsVersion"] == cg.tools_revision()

    def test_client_reported_list_changed_bumps_shared_version(self) -> None:
        before = cg.tools_revision()
        assert _send("notifications/tools/list_changed", msg_id=None).status_code == 200
        assert cg.tools_revision() == before + 1
        assert _send("tools/list").json()["result"]["toolsVersion"] == before + 1


# ---------------------------------------------------------------------------
# 8. prompts / 信封卫生 / 匿名未回归
# ---------------------------------------------------------------------------


class TestPrompts:
    def test_prompts_get_returns_standard_messages(self) -> None:
        r = _send("prompts/get", {"name": "code_review", "arguments": {"code": "print(1)"}})
        result = r.json()["result"]
        assert result["messages"][0]["role"] == "user"
        assert "print(1)" in result["messages"][0]["content"]["text"]
        assert result["prompt"]["name"] == "code_review"  # 兼容既有客户端的历史字段

    def test_prompts_get_unknown_is_empty_not_error(self) -> None:
        result = _send("prompts/get", {"name": "no_such"}).json()["result"]
        assert result["prompt"] is None
        assert result["messages"] == []

    async def test_export_serves_prompts_with_rendered_messages(self) -> None:
        prompts = await export.get_mcp_server().list_prompts()
        assert {p.name for p in prompts} == {p.name for p in internal_mcp._PROMPTS}
        code_review = next(p for p in prompts if p.name == "code_review")
        assert {a.name for a in (code_review.arguments or [])} == {"code", "language"}
        rendered = await export.get_mcp_server().get_prompt(
            "bug_fix", {"error": "boom", "code": "x=1"}
        )
        assert rendered.messages
        assert "boom" in str(rendered.messages[0].content)

    async def test_export_capabilities_self_report_matches_reality(self) -> None:
        ctx = _Ctx(_headers([cg.ALL_SCOPES]))
        result = await export.get_mcp_server().call_tool("ihui.capabilities", {}, ctx)
        caps = json.loads(str(result.content[0].text))
        assert caps["capabilities"] == {"tools": True, "prompts": True, "resources": True}
        assert set(caps["resources"]) == set(cg.RESOURCE_SCOPES)
        assert set(caps["prompts"]) == {p.name for p in internal_mcp._PROMPTS}
        assert caps["toolsVersion"] == cg.tools_revision()


class TestEnvelopeHygiene:
    def test_parse_error_still_returns_jsonrpc_error(self) -> None:
        r = client.post("/api/mcp", content="not-json", headers={"content-type": "application/json"})
        assert r.json()["error"]["code"] == mcp_official.ERR_PARSE

    def test_non_object_non_array_is_invalid_request(self) -> None:
        assert _send_payload(42).status_code == 400
        assert _send_payload({"jsonrpc": "2.0"}).status_code == 400

    def test_error_response_carries_request_id(self) -> None:
        body = _send("bogus/method", msg_id="abc").json()
        assert body["id"] == "abc"
        assert body["error"]["code"] == mcp_official.ERR_METHOD_NOT_FOUND

    def test_initialize_result_shape(self) -> None:
        result = _send("initialize", {"protocolVersion": "2025-03-26"}).json()["result"]
        assert result["serverInfo"]["name"] == mcp_official.SERVER_NAME
        assert result["instructions"]


class TestAuthStillEnforced:
    def test_production_anonymous_single_request_is_401(self, prod: None) -> None:
        r = _send("tools/list")
        assert r.status_code == 401
        assert r.json()["error"]["code"] == mcp_official.ERR_INVALID_REQUEST

    def test_production_anonymous_batch_is_401(self, prod: None) -> None:
        batch = [
            {"jsonrpc": "2.0", "id": 1, "method": "ping"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        ]
        assert _send_payload(batch).status_code == 401

    def test_production_anonymous_resources_read_is_401(self, prod: None) -> None:
        assert _send("resources/read", {"uri": MEMORY_URI}).status_code == 401

    def test_production_anonymous_progress_stream_is_401(self, prod: None) -> None:
        r = _send(
            "tools/call",
            {"name": PROXIED_TOOL, "arguments": {}, "_meta": {"progressToken": "t"}},
            accept="text/event-stream",
        )
        assert r.status_code == 401  # 凭据闸在升级 SSE 之前

    async def test_production_anonymous_export_transport_is_401(self, prod: None) -> None:
        async with AsyncClient(
            transport=ASGITransport(app=export.get_export_app()),
            base_url="http://127.0.0.1:8000",
        ) as ac:
            r = await ac.post(
                export.MCP_EXPORT_PREFIX + export.ENDPOINT_STREAMABLE,
                json={},
                headers=LOOPBACK_HOST,
            )
        assert r.status_code == 401


def test_manifest_file_present_for_consistency_checks() -> None:
    """前置自检:真实清单存在(否则"一致性"那组用例会静默失去意义)。"""
    assert Path(cg.manifest_file()).exists()
    assert cg.load_capability_manifest() is not None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
