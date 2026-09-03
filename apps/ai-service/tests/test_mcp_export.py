# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌​‌‌​‌​​​‌‌​​​‌​​‍​​‌​‌‌​‌‍​‌​​‌​​​‍​‌‌​​‌‌​​‌​​‌​‌‌​​‌‌‌​​‍​‍​‌‌​​‌​​‌​‌​‌​‌‌​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌​​‌​‌​‌‌‌​‌‍​‌​​‌​​​‍​‌‌​​​​​‌‍​⁠

"""IHUI 作为 MCP Server 对外导出的真连接验证。

在 127.0.0.1 起真实 uvicorn,用官方 mcp SDK 客户端双层 transport 真网闭环:
- Streamable HTTP:  mcp.client.session_group.streamable_http_client + ClientSession
- SSE:              mcp.client.session_group.sse_client + ClientSession

每层都走 initialize → tools/list → tools/call → ping,并对调回的能力/工具/结果做断言。
另含协议版本协商(回告请求值)与开关关闭时 404(不暴露)。
"""

from __future__ import annotations

import socket
import threading
import time
from typing import Any

import httpx
import pytest
import uvicorn
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mcp.client.session import ClientSession
from mcp.client.session_group import sse_client, streamable_http_client

from app.services import mcp_export

TIMEOUT = 15.0


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _host_app() -> FastAPI:
    """最小宿主 FastAPI: 仅挂载 MCP Export 子应用(模拟 app.main 的开启态)。"""
    app = FastAPI()
    mcp_export.mount_to_app(app)
    return app


def _serve(app: Any, port: int) -> uvicorn.Server:
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    for _ in range(100):
        try:
            httpx.get(f"http://127.0.0.1:{port}/", timeout=0.3)
            return server
        except Exception:  # noqa: BLE001 - 就绪探测失败即连接被拒,继续重试
            time.sleep(0.05)
    raise RuntimeError(f"MCP Export 服务器无法启动 127.0.0.1:{port}")


@pytest.fixture(scope="module")
def export_urls() -> dict[str, str]:
    """模块级: 起真实 uvicorn,返回 streamable/sse 端点 URL。"""
    port = _free_port()
    server = _serve(_host_app(), port)
    base = f"http://127.0.0.1:{port}"
    yield {
        "streamable": f"{base}{mcp_export.MCP_EXPORT_PREFIX}{mcp_export.ENDPOINT_STREAMABLE}",
        "sse": f"{base}{mcp_export.MCP_EXPORT_PREFIX}{mcp_export.ENDPOINT_SSE}",
        "base": base,
    }
    server.should_exit = True


# =============================================================================
# Streamable HTTP transport(官方客户端真网)
# =============================================================================

async def test_streamable_initialize_list_call(export_urls: dict[str, str]) -> None:
    url = export_urls["streamable"]
    async with streamable_http_client(url) as (read_stream, write_stream):
        session = ClientSession(read_stream, write_stream)
        async with session:
            result = await session.initialize()

            # 握手: serverInfo + capabilities + 协议协商回告
            assert result.server_info.name == "ihui-ai"
            assert result.server_info.version == mcp_export.SERVER_VERSION
            assert getattr(result.capabilities, "tools", None) is not None
            assert result.protocol_version in mcp_export.SUPPORTED_PROTOCOL_VERSIONS
            assert result.protocol_version >= "2025-03-26"

            # 能力指纹握手
            await session.send_ping()

            # tools/list: 注册的 3 个工具都能列出
            listed = (await session.list_tools()).tools
            names = {t.name for t in listed}
            assert {"ihui.echo", "ihui.now_utc", "ihui.capabilities"} <= names
            echo_def = next(t for t in listed if t.name == "ihui.echo")
            assert echo_def.description  # clear description
            assert echo_def.input_schema is not None  # typed input_schema

            # tools/call: echo 原样回显
            call = await session.call_tool("ihui.echo", {"message": "hi-ihui"})
            assert call.content[0].text == "hi-ihui"
            assert call.is_error is False


async def test_streamable_now_utc_and_capabilities(export_urls: dict[str, str]) -> None:
    url = export_urls["streamable"]
    async with streamable_http_client(url) as (rs, ws), ClientSession(rs, ws) as session:
        await session.initialize()

        # now_utc: 返回 ISO 时间
        now = await session.call_tool("ihui.now_utc", {})
        import json as _json

        data = _json.loads(now.content[0].text)
        assert "iso_utc" in data
        assert data["iso_utc"].endswith("+00:00")

        # capabilities: 静态能力清单
        caps = await session.call_tool("ihui.capabilities", {})
        caps_data = _json.loads(caps.content[0].text)
        assert caps_data["server"]["name"] == "ihui-ai"
        assert "ihui.echo" in caps_data["tools"]


# =============================================================================
# SSE transport(官方客户端真网)
# =============================================================================

async def test_sse_initialize_list_call(export_urls: dict[str, str]) -> None:
    url = export_urls["sse"]
    async with sse_client(url) as (read_stream, write_stream):
        session = ClientSession(read_stream, write_stream, read_timeout_seconds=TIMEOUT)
        async with session:
            result = await session.initialize()
            assert result.server_info.name == "ihui-ai"
            assert getattr(result.capabilities, "tools", None) is not None
            assert result.protocol_version in mcp_export.SUPPORTED_PROTOCOL_VERSIONS

            names = {t.name for t in (await session.list_tools()).tools}
            assert {"ihui.echo", "ihui.now_utc", "ihui.capabilities"} <= names

            echo = await session.call_tool("ihui.echo", {"message": "over-sse"})
            assert echo.content[0].text == "over-sse"


# =============================================================================
# 协议协商 + 开关
# =============================================================================

async def test_protocol_negotiation_echo_and_min(export_urls: dict[str, str]) -> None:
    """手工 JSON-RPC POST(真网): 回告请求的协议版本,且 2025-03-26 可达。"""
    import json as _json

    url = export_urls["streamable"]

    def _parse(body: str) -> dict[str, Any]:
        """streamable 默认以 SSE(text/event-stream)回包,抽取 data 行解析 JSON。"""
        payload = body.replace("\r", "")
        for line in payload.split("\n"):
            if line.startswith("data:"):
                return _json.loads(line[len("data:"):].strip())
        # 兜底: 直接按 JSON 解析(服务端若按 Accept 回 JSON)
        return _json.loads(payload)

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            url,
            headers={"Accept": "application/json, text/event-stream"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": {"name": "probe", "version": "1"},
                },
            },
        )
        assert r.status_code == 200
        result = _parse(r.text)["result"]
        assert result["protocolVersion"] == "2025-03-26"
        assert result["serverInfo"]["name"] == "ihui-ai"
        assert result["capabilities"]["tools"]


def test_switch_default_disabled_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认(未开启开关)不挂载: 请求导出端点应 404 不暴露。"""
    monkeypatch.delenv(mcp_export.ENABLE_MCP_EXPORT_ENV, raising=False)
    assert mcp_export.is_enabled() is False

    app = FastAPI()  # 未挂载 mcp_export → 导出路径 404
    client = TestClient(app)
    r = client.get(f"{mcp_export.MCP_EXPORT_PREFIX}{mcp_export.ENDPOINT_SSE}")
    assert r.status_code == 404
    r2 = client.post(
        f"{mcp_export.MCP_EXPORT_PREFIX}{mcp_export.ENDPOINT_STREAMABLE}",
        json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}},
    )
    assert r2.status_code == 404


def test_switch_enabled_to_mount(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(mcp_export.ENABLE_MCP_EXPORT_ENV, "true")
    assert mcp_export.is_enabled() is True

    app = FastAPI()
    mcp_export.mount_to_app(app)
    # 已挂载后: streamable 端点对坏 JSON-RPC 不再 404(走到传输层处理)
    client = TestClient(app)
    r = client.post(
        f"{mcp_export.MCP_EXPORT_PREFIX}{mcp_export.ENDPOINT_STREAMABLE}",
        content="not-json",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
    )
    assert r.status_code != 404
# ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌​‌‌​‌​​​‌‌​​​‌​​‍​​‌​‌‌​‌‍​‌​​‌​​​‍​‌‌​​‌‌​​‌​​‌​‌‌​​‌‌‌​​‍​‍​‌‌​​‌​​‌​‌​‌​‌‌​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌​​‌​‌​‌‌‌​‌‍​‌​​‌​​​‍​‌‌​​​​​‌‍​⁠
