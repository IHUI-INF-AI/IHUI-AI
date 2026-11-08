# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-053 夹具:外部 MCP 落点策略(默认 fail-closed + admin 注册权 + DNS 后判 IP)。

覆盖用户指定的五类场景:
① 普通用户注册远程 SSE → 403(注册权收归 admin);
② admin 注册 127.0.0.1 / 169.254.169.254 / 10.0.0.1 / [::1] → 拒;
③ 显式开关打开后 localhost → 放行;
④ 域名解析到私网 → 拒(DNS rebinding 同一把尺);
⑤ 30x 重定向到私网 → 拒(不跟随重定向)。
另补:IPv4/IPv6 同尺(100.100.100.200 / fd00:ec2::254)、混合公私解析结果、
连接点必须钉住已校验 IP(不得把 hostname 再交给连接层做第二次 DNS)。

判据有三处入口,各自独立钉:
- 策略层 `app.services.mcp_endpoint_policy.resolve_endpoint`;
- 注册端点 `routers/mcp.py::register_external_server`;
- 连接点 `services/mcp_client.py::_sse_connect` / `_sse_post_message`。
"""

from __future__ import annotations

import asyncio
import importlib
import ipaddress
import logging
import socket
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import Settings, settings
from app.routers import mcp as mcp_router
from app.routers.mcp import ExternalServerRegisterRequest, register_external_server
from app.services.mcp_client import TRANSPORT_SSE, MCPClient, MCPClientConfig


def _request_with_role(role_id: int | None) -> SimpleNamespace:
    """伪造中间件注入形态:request.state.role_id(resolve_request_role_id 的唯一读点)。"""
    state = SimpleNamespace()
    if role_id is not None:
        state.role_id = role_id
    return SimpleNamespace(state=state)


class _FakeClient:
    def __init__(self) -> None:
        self.connected = False

    async def connect(self) -> None:
        self.connected = True


class _FakeManager:
    """注册端点正向对照用:不真连、不污染全局单例。"""

    def __init__(self) -> None:
        self.registered: list[tuple[MCPClientConfig, str]] = []
        self._clients: dict[str, _FakeClient] = {}

    def get_client(self, name: str) -> _FakeClient | None:
        return self._clients.get(name)

    def register(self, config: MCPClientConfig, *, owner_user_id: str = "") -> str:
        self._clients[config.name] = _FakeClient()
        self.registered.append((config, owner_user_id))
        return config.name

    def client_status_visible(self, name: str, caller_user_id: str) -> dict[str, object] | None:
        if name not in self._clients:
            return None
        return {"name": name, "transport": TRANSPORT_SSE, "connected": True}


def _make_sse_writer() -> AsyncMock:
    writer = AsyncMock()
    writer.write = MagicMock()
    writer.drain = AsyncMock()
    writer.close = MagicMock()
    writer.wait_closed = AsyncMock()
    return writer


def _make_reader(payload: bytes) -> asyncio.StreamReader:
    reader = asyncio.StreamReader()
    reader.feed_data(payload)
    reader.feed_eof()
    return reader


def _sse_ok_headers() -> bytes:
    return b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\r\n"


def _policy_module() -> object:
    """策略模块按需导入:改前 HEAD 上不存在 → 相关用例逐条红(而不是整文件 collection 失败)。"""
    return importlib.import_module("app.services.mcp_endpoint_policy")


def _patch_allow_private(monkeypatch: pytest.MonkeyPatch, value: bool) -> None:
    """开关按 settings 字段注入;改前字段不存在时 raising=False 仍可写入(红由断言承担)。"""
    monkeypatch.setattr(settings, "mcp_allow_private_endpoints", value, raising=False)


# ---------------------------------------------------------------------------
# 策略层:默认 fail-closed + IP 黑名单 + 开关
# ---------------------------------------------------------------------------


def test_allow_private_switch_defaults_to_false() -> None:
    """开关默认关:不以"没配"当"放开"(类默认值必须就是 False)。"""
    assert Settings.model_fields["mcp_allow_private_endpoints"].default is False


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8803/sse",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/sse",
        "http://[::1]:8803/sse",
        "http://100.100.100.200/latest/meta-data/",
        "http://[fd00:ec2::254]/latest/meta-data/",
        "http://[::ffff:127.0.0.1]:8803/sse",
    ],
)
def test_policy_rejects_private_loopback_and_metadata_literals(url: str) -> None:
    """字面量就落在黑名单:回环/私网/链路本地/云元数据,IPv4 与 IPv6 同尺。"""
    policy = _policy_module()
    with pytest.raises(policy.MCPEndpointRejected):
        policy.resolve_endpoint(url, allow_private=False)


def test_policy_blocks_naive_private_judge_bypasses() -> None:
    """100.100.100.200(阿里云元数据)不属于 RFC1918,必须被显式覆盖。"""
    policy = _policy_module()
    assert policy.is_blocked_ip("100.100.100.200") is True
    assert policy.is_blocked_ip("169.254.169.254") is True
    assert policy.is_blocked_ip("fd00:ec2::254") is True
    assert policy.is_blocked_ip("93.184.216.34") is False


def test_policy_rejects_domain_resolving_to_private(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """域名解析结果落在私网 ⇒ 拒(只校验 URL 字面量挡不住这条)。"""
    policy = _policy_module()
    _patch_allow_private(monkeypatch, False)
    monkeypatch.setattr(
        policy.socket,
        "getaddrinfo",
        lambda *_a, **_k: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 0)),
        ],
    )
    with pytest.raises(policy.MCPEndpointRejected):
        policy.resolve_endpoint("http://rebind.example.invalid/sse", allow_private=False)


def test_policy_rejects_mixed_public_and_private_answers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A/AAAA 里**任意**一条是私网就拒:短 TTL 交替返回公网/内网正是 rebinding 手法。"""
    policy = _policy_module()
    monkeypatch.setattr(
        policy.socket,
        "getaddrinfo",
        lambda *_a, **_k: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 0)),
        ],
    )
    with pytest.raises(policy.MCPEndpointRejected):
        policy.resolve_endpoint("http://mixed.example.invalid/sse", allow_private=False)


def test_policy_pins_validated_public_ip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """放行的域名必须回传"已校验的那个 IP",供连接层直接连(消除二次 DNS)。"""
    policy = _policy_module()
    monkeypatch.setattr(
        policy.socket,
        "getaddrinfo",
        lambda *_a, **_k: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
        ],
    )
    target = policy.resolve_endpoint("https://mcp.example.com/sse", allow_private=False)
    assert target.ip == "93.184.216.34"
    assert target.host == "mcp.example.com"
    assert target.port == 443
    assert target.host_header == "mcp.example.com"
    assert target.pin_url("https://mcp.example.com/sse") == "https://93.184.216.34/sse"


def test_policy_allows_localhost_only_with_explicit_switch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """③ 显式开关打开后 localhost → 放行(放行的是"已校验的回环 IP")。"""
    policy = _policy_module()
    monkeypatch.setattr(
        policy.socket,
        "getaddrinfo",
        lambda *_a, **_k: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0)),
        ],
    )
    with pytest.raises(policy.MCPEndpointRejected):
        policy.resolve_endpoint("http://localhost:8803/sse", allow_private=False)
    target = policy.resolve_endpoint("http://localhost:8803/sse", allow_private=True)
    assert target.host == "localhost"
    assert target.port == 8803
    assert ipaddress.ip_address(target.ip).is_loopback


# ---------------------------------------------------------------------------
# ① 注册端点:角色闸(非管理员一律 403)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_plain_user_register_sse_forbidden(monkeypatch: pytest.MonkeyPatch) -> None:
    """① 普通用户注册远程 SSE ⇒ 403,且根本不该走到 manager/connect。"""
    async def _boom(*_a: object, **_k: object) -> object:
        raise RuntimeError("sentinel-reached-later-stage")

    monkeypatch.setattr(mcp_router, "get_mcp_client_manager", _boom)
    req = ExternalServerRegisterRequest(
        name="plain-sse", transport="sse", url="https://example.invalid/sse"
    )

    res = await register_external_server(
        request=_request_with_role(0), req=req, user_id="user-plain"
    )

    assert getattr(res, "status_code", None) == 403
    assert "ROLE_DENIED" in res.body.decode("utf-8")


# ---------------------------------------------------------------------------
# ② 注册端点:admin 也被落点策略挡住(字面量黑名单)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8803/sse",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/sse",
        "http://[::1]:8803/sse",
    ],
)
@pytest.mark.asyncio
async def test_admin_register_blocked_literals_forbidden(
    monkeypatch: pytest.MonkeyPatch, url: str,
) -> None:
    """② admin 注册私网/回环/元数据地址 ⇒ 403 ENDPOINT_BLOCKED(不落到 manager)。"""
    async def _boom(*_a: object, **_k: object) -> object:
        raise RuntimeError("sentinel-reached-later-stage")

    monkeypatch.setattr(mcp_router, "get_mcp_client_manager", _boom)
    req = ExternalServerRegisterRequest(name="admin-sse", transport="sse", url=url)

    res = await register_external_server(
        request=_request_with_role(1), req=req, user_id="admin-1"
    )

    assert getattr(res, "status_code", None) == 403
    assert "ENDPOINT_BLOCKED" in res.body.decode("utf-8")


# ---------------------------------------------------------------------------
# ④ 注册端点:域名解析到私网 → 拒
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_register_domain_resolving_private_forbidden(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """④ 只校验 URL 字面量会被 DNS rebinding 绕过 ⇒ 必须按解析结果拒。"""
    policy = _policy_module()
    _patch_allow_private(monkeypatch, False)
    monkeypatch.setattr(
        policy.socket,
        "getaddrinfo",
        lambda *_a, **_k: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 0)),
        ],
    )
    req = ExternalServerRegisterRequest(
        name="rebind-sse", transport="sse", url="http://rebind.example.invalid/sse"
    )

    res = await register_external_server(
        request=_request_with_role(1), req=req, user_id="admin-1"
    )

    assert getattr(res, "status_code", None) == 403
    assert "ENDPOINT_BLOCKED" in res.body.decode("utf-8")


# ---------------------------------------------------------------------------
# ③ 注册端点:开关打开后 localhost → 放行(正向对照,判据不得被改成恒 403)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_register_localhost_allowed_when_switch_on(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """③ 显式开关打开 ⇒ admin 注册 localhost 成功(201),且落点经过策略校验。"""
    policy = _policy_module()
    _patch_allow_private(monkeypatch, True)

    calls: list[str] = []

    def _resolver(url: str) -> object:
        calls.append(url)
        return policy.resolve_endpoint(url, allow_private=True)

    monkeypatch.setattr(mcp_router, "resolve_mcp_endpoint", _resolver)
    fake = _FakeManager()
    monkeypatch.setattr(mcp_router, "get_mcp_client_manager", lambda: fake)
    req = ExternalServerRegisterRequest(
        name="dev-sse", transport="sse", url="http://localhost:8803/sse"
    )

    res = await register_external_server(
        request=_request_with_role(1), req=req, user_id="admin-1"
    )

    assert getattr(res, "status_code", None) == 201
    assert calls == ["http://localhost:8803/sse"]
    assert fake.registered and fake.registered[0][1] == "admin-1"


# ---------------------------------------------------------------------------
# 连接点:判定在 DNS 解析后的实际连接 IP + 重定向不跟随
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8803/sse",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/sse",
        "http://[::1]:8803/sse",
    ],
)
@pytest.mark.asyncio
async def test_sse_connect_rejected_for_blocked_literals(monkeypatch: pytest.MonkeyPatch, url: str) -> None:
    """② 连接点与注册点同一把尺:被拒的落点根本不出连。"""
    _patch_allow_private(monkeypatch, False)
    client = MCPClient(MCPClientConfig(name="blocked-sse", transport=TRANSPORT_SSE, url=url))

    with patch("asyncio.open_connection", AsyncMock()) as open_conn:
        await client.connect()

    assert client.is_connected() is False
    open_conn.assert_not_awaited()


@pytest.mark.asyncio
async def test_sse_connect_pins_resolved_ip_and_keeps_original_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """③ 开关打开后 localhost 放行;连接目标必须是解析后的 IP,Host 头保持原域名。"""
    _patch_allow_private(monkeypatch, True)
    client = MCPClient(
        MCPClientConfig(
            name="local-sse", transport=TRANSPORT_SSE, url="http://localhost:8803/sse", timeout=5.0
        )
    )
    open_conn = AsyncMock(return_value=(_make_reader(_sse_ok_headers()), _make_sse_writer()))

    with patch("asyncio.open_connection", open_conn):
        await client.connect()

    assert client.is_connected() is True
    first_call = open_conn.await_args_list[0]
    connected_to = first_call.args[0]
    # 旧实现把 "localhost" 原样交给连接层(再解析一次);新实现必须传已校验的 IP。
    assert ipaddress.ip_address(connected_to).is_loopback
    assert connected_to != "localhost"
    assert first_call.args[1] == 8803
    request_bytes = first_call.kwargs.get("server_hostname")
    assert request_bytes in (None, "localhost")  # http 不带 SNI
    await client.disconnect()


@pytest.mark.asyncio
async def test_sse_connect_does_not_follow_redirect_to_private(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    """⑤ 30x 重定向到私网 ⇒ 不跟随、不建连(逐跳复检的替代:整段禁用重定向)。"""
    _patch_allow_private(monkeypatch, True)
    client = MCPClient(
        MCPClientConfig(
            name="redir-sse", transport=TRANSPORT_SSE, url="http://localhost:8803/sse", timeout=5.0
        )
    )
    redirect = (
        b"HTTP/1.1 302 Found\r\n"
        b"Location: http://169.254.169.254/latest/meta-data/\r\n"
        b"\r\n"
    )
    open_conn = AsyncMock(return_value=(_make_reader(redirect), _make_sse_writer()))

    with caplog.at_level(logging.ERROR):
        with patch("asyncio.open_connection", open_conn):
            await client.connect()

    assert client.is_connected() is False
    assert open_conn.await_count == 1, "3xx 之后不得再发起第二次连接(不跟随重定向)"
    assert "不跟随重定向" in caplog.text


@pytest.mark.asyncio
async def test_sse_post_endpoint_event_private_target_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SSE 的 messages 落点由服务端给出:同样按解析后 IP 判定,不能只信首跳。"""
    _patch_allow_private(monkeypatch, False)
    client = MCPClient(
        MCPClientConfig(name="post-sse", transport=TRANSPORT_SSE, url="http://127.0.0.1:8803/sse")
    )
    client._sse_post_url = "http://169.254.169.254/messages/"

    with patch("asyncio.open_connection", AsyncMock()) as open_conn:
        with pytest.raises(ConnectionError):
            await client._sse_post_message('{"jsonrpc":"2.0"}')

    open_conn.assert_not_awaited()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
