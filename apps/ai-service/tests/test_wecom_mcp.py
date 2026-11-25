# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""企业微信智能机器人 MCP 客户端测试:URL 解析/官方域白名单/JSON-RPC 流程/业务解析。"""

from __future__ import annotations

import json

import pytest

from app.services.connectors import wecom_mcp as mcp


# ---------------------------------------------------------------------------
# 端点解析 + 安全
# ---------------------------------------------------------------------------


def test_parse_bare_url_v2():
    ep = mcp.parse_mcp_endpoint(
        "https://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=abc123"
    )
    assert ep.apikey == "abc123"
    assert ep.capability == "document"
    assert "apikey=abc123" in ep.url
    assert ep.safe_dict()["apikey_len"] == "6"
    assert "abc123" not in str(ep.safe_dict())


def test_parse_json_config():
    cfg = json.dumps(
        {
            "mcpServers": {
                "企微日程": {
                    "type": "streamable-http",
                    "url": "https://qyapi.weixin.qq.com/mcp/v2/bot/schedule?apikey=k",
                }
            }
        },
        ensure_ascii=False,
    )
    ep = mcp.parse_mcp_endpoint(cfg)
    assert ep.apikey == "k"
    assert ep.capability == "calendar"


def test_parse_rejects_foreign_host_and_legal_suffix_trick():
    """官方域白名单必须逐字匹配,挡 qyapi.weixin.qq.com.evil.com 这类后缀伪装。"""
    for bad in (
        "https://qyapi.weixin.qq.com.evil.com/mcp/v2/bot/doc?apikey=x",
        "https://evil.com/mcp/v2/bot/doc?apikey=x",
        "http://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=x",
    ):
        with pytest.raises(mcp.WecomMcpError, match="主机|https"):
            mcp.parse_mcp_endpoint(bad)


def test_parse_rejects_missing_apikey_and_bad_json():
    with pytest.raises(mcp.WecomMcpError, match="apikey"):
        mcp.parse_mcp_endpoint("https://qyapi.weixin.qq.com/mcp/v2/bot/doc")
    with pytest.raises(mcp.WecomMcpError, match="JSON"):
        mcp.parse_mcp_endpoint("{not-json")


# ---------------------------------------------------------------------------
# JSON-RPC 流程(HTTP 出口 mock)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_call_tool_full_handshake_and_business_unwrap(monkeypatch):
    """initialize→initialized→tools/call,业务 JSON 从 content[0].text 解出。"""
    seen: list[dict] = []

    class FakeResp:
        status_code = 200
        headers: dict[str, str] = {}
        content = b""

    async def fake_post(self, payload):
        seen.append(payload)
        method = payload.get("method")
        fake = FakeResp()
        if method == "initialize":
            fake.content = json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2025-06-18"}}).encode()
            fake.headers = {"Mcp-Session-Id": "sess-1"}
        elif method == "notifications/initialized":
            fake.content = b""
        elif method == "tools/call":
            fake.content = json.dumps({
                "jsonrpc": "2.0", "id": 3,
                "result": {"content": [{"type": "text", "text": '{"docid":"d1","url":"https://doc"}'}], "isError": False},
            }).encode()
        return json.loads(fake.content.decode() or "{}")

    monkeypatch.setattr(mcp.WecomMcpClient, "_post", fake_post)
    ep = mcp.parse_mcp_endpoint("https://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=k")
    client = mcp.WecomMcpClient(ep)
    result = await client.call_tool("doc_create", {"doc_name": "周报"})
    assert result == {"docid": "d1", "url": "https://doc"}
    methods = [p.get("method") for p in seen]
    assert methods == ["initialize", "notifications/initialized", "tools/call"]
    assert seen[2]["params"]["name"] == "doc_create"


@pytest.mark.asyncio
async def test_call_tool_isError_raises(monkeypatch):
    """平台 isError=true 必须抛错,不能被当成正常业务结果。"""
    async def fake_post(self, payload):
        if payload.get("method") == "initialize":
            return {"jsonrpc": "2.0", "id": 1, "result": {}}
        if payload.get("method") == "tools/call":
            return {
                "jsonrpc": "2.0", "id": 3,
                "result": {"content": [{"type": "text", "text": "851008 权限未授权"}], "isError": True},
            }
        return {}
    monkeypatch.setattr(mcp.WecomMcpClient, "_post", fake_post)
    ep = mcp.parse_mcp_endpoint("https://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=k")
    with pytest.raises(mcp.WecomMcpError, match="权限未授权"):
        await mcp.WecomMcpClient(ep).call_tool("doc_create", {})


@pytest.mark.asyncio
async def test_notification_202_empty_is_not_error(monkeypatch):
    """notifications/initialized 按 Streamable HTTP 规范回 202 空响应,不得当失败。"""

    class FakeResp:
        status_code = 202
        headers: dict[str, str] = {}
        content = b""

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, headers=None, json=None):
            return FakeResp()

    monkeypatch.setattr(mcp.httpx, "AsyncClient", FakeClient)
    ep = mcp.parse_mcp_endpoint("https://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=k")
    client = mcp.WecomMcpClient(ep)
    out = await client._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert out == {}


def test_headers_require_accept_json():
    """Accept: application/json 是企微 MCP 必需头,缺失会 -32600。"""
    ep = mcp.parse_mcp_endpoint("https://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=k")
    headers = mcp.WecomMcpClient(ep)._headers()
    assert headers["Accept"] == "application/json"
    assert headers["Content-Type"] == "application/json"
