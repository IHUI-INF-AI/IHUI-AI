# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE-NEW]: 新文件,针对 mcp_export 采用度(即插即用)补测用例。

"""IHUI 作为 MCP Server 的"采用度"验证(对标其即插即用能力)。

覆盖 4 个采用度缺口:
1. stdio transport —— 用``python -m app.services.mcp_export_run``起真实子进程,
   以官方 mcp 客户端 stdio_client 真连接跑 initialize -> tools/list -> tools/call;
2. generate_client_config —— 一键接入配置(Claude Desktop stdio 片段 / SSE /
   Streamable-HTTP URL 形态)结构正确;
3. validate_request_host / compute_external_url —— 对外暴露时的 host/DNS-rebinding
   校验(白名单/回环放行/不安全地址拒绝)与最终对外 URL 计算;
4. 协议常量去重 —— EXPORT_PROTOCOL_VERSIONS 与 mcp_client.SUPPORTED_PROTOCOL_VERSIONS
   同源(引用同一对象),消除双轨漂移。

stdio 子进程拉起较慢,允许长超时;全部为真实运行,无桩。
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest
from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from app.services import mcp_client, mcp_export

# 子进程 cwd 必须指向 ai-service(让 ``app`` 包可导入)
APPS_DIR = Path(__file__).resolve().parents[1]


def _stdio_params() -> StdioServerParameters:
    return StdioServerParameters(
        command=sys.executable,
        args=["-m", mcp_export.MCP_EXPORT_RUN_MODULE, "--transport", "stdio"],
        cwd=str(APPS_DIR),
    )


# =============================================================================
# 1. stdio transport: 真实子进程 + 官方客户端全链路
# =============================================================================

async def test_stdio_subprocess_initialize_list_call() -> None:
    """stdio 真连接: initialize 身份/能力 -> tools/list 到底 -> tools/call(echo)。"""
    async with stdio_client(_stdio_params()) as (read_stream, write_stream):
        session = ClientSession(read_stream, write_stream)
        async with session:
            result = await session.initialize()
            assert result.server_info.name == "ihui-ai"
            assert result.server_info.version == mcp_export.SERVER_VERSION
            assert getattr(result.capabilities, "tools", None) is not None
            assert result.protocol_version in mcp_export.SUPPORTED_PROTOCOL_VERSIONS
            assert result.protocol_version >= "2025-03-26"

            await session.send_ping()

            names = {t.name for t in (await session.list_tools()).tools}
            assert {"ihui.echo", "ihui.now_utc", "ihui.capabilities"} <= names

            echo_def = next(t for t in (await session.list_tools()).tools)
            assert echo_def.description

            call = await session.call_tool("ihui.echo", {"message": "hi-stdio"})
            assert call.content[0].text == "hi-stdio"
            assert call.is_error is False


async def test_stdio_subprocess_now_utc_and_capabilities() -> None:
    """stdio 真连接: 只读工具 now_utc 与能力自述均可调用、结构正确。"""
    async with stdio_client(_stdio_params()) as (read_stream, write_stream):
        session = ClientSession(read_stream, write_stream)
        async with session:
            await session.initialize()

            now = await session.call_tool("ihui.now_utc", {})
            data = json_load(now.content[0].text)
            assert "iso_utc" in data
            assert data["iso_utc"].endswith("+00:00")

            caps = await session.call_tool("ihui.capabilities", {})
            caps_data = json_load(caps.content[0].text)
            assert caps_data["server"]["name"] == "ihui-ai"
            assert "ihui.echo" in caps_data["tools"]
            assert "stdio" in caps_data["transports"]


def json_load(text: str) -> dict[str, Any]:
    import json as _json

    return _json.loads(text)


# =============================================================================
# 2. generate_client_config: 一键接入配置结构
# =============================================================================

def test_generate_stdio_client_config_structure() -> None:
    cfg = mcp_export.generate_client_config("stdio")
    assert set(cfg.keys()) == {"mcpServers"}
    entry = cfg["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]
    assert entry["command"]  # 非空(当前解释器绝对路径)
    assert entry["args"] == ["-m", mcp_export.MCP_EXPORT_RUN_MODULE]


def test_generate_sse_client_config_url() -> None:
    cfg = mcp_export.generate_client_config("sse", base_url="http://127.0.0.1:8000")
    entry = cfg["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]
    assert entry["url"] == (
        "http://127.0.0.1:8000"
        + mcp_export.MCP_EXPORT_PREFIX + mcp_export.ENDPOINT_SSE
    )


def test_generate_streamable_http_client_config_url() -> None:
    cfg = mcp_export.generate_client_config(
        "streamable-http", base_url="https://mcp.example.com"
    )
    entry = cfg["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]
    assert entry["url"] == (
        "https://mcp.example.com"
        + mcp_export.MCP_EXPORT_PREFIX + mcp_export.ENDPOINT_STREAMABLE
    )


def test_generate_client_config_trailing_slash_base_url() -> None:
    # base_url 末尾斜杠应被规整,避免双斜杠破坏 URL
    cfg = mcp_export.generate_client_config("sse", base_url="http://h:1/")
    assert cfg["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]["url"].startswith(
        "http://h:1/api/"
    )


def test_generate_client_config_default_base_url_when_none() -> None:
    cfg = mcp_export.generate_client_config("streamable-http")
    url = cfg["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]["url"]
    assert url.startswith(mcp_export.DEFAULT_EXTERNAL_BASE_URL)
    assert url.endswith(
        mcp_export.MCP_EXPORT_PREFIX + mcp_export.ENDPOINT_STREAMABLE
    )


def test_generate_client_config_unknown_transport_raises() -> None:
    with pytest.raises(ValueError):
        mcp_export.generate_client_config("udp")


# =============================================================================
# 3. validate_request_host / compute_external_url: host/DNS-rebinding 防护
# =============================================================================

def test_validate_host_allows_loopback() -> None:
    for h in ("localhost", "127.0.0.1", "::1", "[::1]"):
        assert mcp_export.validate_request_host(h) is True


def test_validate_host_rejects_unsafe_sentinels() -> None:
    for h in ("0.0.0.0", "*", "", "::", "[::]", "0.0.0.0."):
        assert mcp_export.validate_request_host(h) is False


def test_validate_host_rejects_unknown_external_host() -> None:
    # 回环之外的主机,未声明(允许列表为空)一律拒绝
    assert mcp_export.validate_request_host("evil.example.com") is False
    assert mcp_export.validate_request_host("192.168.1.10") is False


def test_validate_host_allows_whitelisted_external_host() -> None:
    assert (
        mcp_export.validate_request_host(
            "mcp.example.com", allowed_devices=["mcp.example.com"]
        )
        is True
    )
    assert (
        mcp_export.validate_request_host(
            "192.168.1.10", allowed_devices=["192.168.1.10"]
        )
        is True
    )


def test_validate_host_normalizes_case_and_trailing_dot() -> None:
    # 白名单比对做小写 + 去尾点归一化:大小写与尾点差异不应误拒绝/误放行
    assert (
        mcp_export.validate_request_host("My.Host.Com", ["my.host.com"]) is True
    )
    assert (
        mcp_export.validate_request_host("mcp.host.com.", ["mcp.host.com"]) is True
    )
    # 归一化后仍不在白名单 -> 拒绝
    assert mcp_export.validate_request_host("mcp.host.com", ["other.com"]) is False


def test_validate_host_injectable_allowlist_variants() -> None:
    # allowed_devices 支持 list/tuple/set 任一形态,行为一致
    hosts = "mcp.example.com"
    assert mcp_export.validate_request_host(hosts, ["mcp.example.com"]) is True
    assert mcp_export.validate_request_host(hosts, ("mcp.example.com",)) is True
    assert mcp_export.validate_request_host(hosts, {"mcp.example.com"}) is True


def test_compute_external_url_streamable_http() -> None:
    url = mcp_export.compute_external_url(
        {"scheme": "http", "host": "127.0.0.1", "port": 8000,
         "transport": "streamable-http"}
    )
    assert url == f"http://127.0.0.1:8000{mcp_export.MCP_EXPORT_PREFIX}{mcp_export.ENDPOINT_STREAMABLE}"


def test_compute_external_url_sse_default_transport() -> None:
    # 未显式 transport 时默认计算 streamable? 这里显式 sse 断言路径
    url = mcp_export.compute_external_url({"host": "127.0.0.1", "transport": "sse"})
    assert url.endswith(mcp_export.MCP_EXPORT_PREFIX + mcp_export.ENDPOINT_SSE)
    assert url.startswith("http://127.0.0.1")


def test_compute_external_url_https_ipv6_custom_prefix() -> None:
    url = mcp_export.compute_external_url(
        {"scheme": "https", "host": "::1", "port": 8443,
         "transport": "streamable-http", "prefix": "/custom/"}
    )
    assert url.startswith("https://[::1]:8443")
    assert url.endswith(
        "/custom" + mcp_export.ENDPOINT_STREAMABLE
    )  # 前缀尾斜杠被规整为单斜杠


def test_compute_external_url_rejects_stdio() -> None:
    with pytest.raises(ValueError):
        mcp_export.compute_external_url({"transport": "stdio", "host": "h"})


# =============================================================================
# 4. 协议常量去重 + handler_stdio
# =============================================================================

def test_export_protocol_versions_identical_to_client() -> None:
    # 证明去重: 导出侧与客户端侧引用同一对象(而非分别维护的副本)
    assert mcp_export.EXPORT_PROTOCOL_VERSIONS is mcp_client.SUPPORTED_PROTOCOL_VERSIONS
    assert mcp_export.SUPPORTED_PROTOCOL_VERSIONS is mcp_client.SUPPORTED_PROTOCOL_VERSIONS
    assert mcp_export.EXPORT_PROTOCOL_VERSIONS == mcp_export.SUPPORTED_PROTOCOL_VERSIONS


def test_supported_versions_content() -> None:
    assert "2025-03-26" in mcp_export.SUPPORTED_PROTOCOL_VERSIONS
    assert mcp_export.SUPPORTED_PROTOCOL_VERSIONS == mcp_client.SUPPORTED_PROTOCOL_VERSIONS


def test_protocol_version_returns_latest() -> None:
    assert mcp_export._protocol_version() == mcp_export.SUPPORTED_PROTOCOL_VERSIONS[-1]
    assert mcp_export._protocol_version() in mcp_client.SUPPORTED_PROTOCOL_VERSIONS


def test_handler_stdio_returns_callable() -> None:
    # 不实际调起阻塞运输;仅验证返回的是一个可调用的 stdio 处理器
    handler = mcp_export.handler_stdio()
    assert callable(handler)
