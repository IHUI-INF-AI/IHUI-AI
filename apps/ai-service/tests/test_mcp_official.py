# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""官方 MCP 协议兼容层(streamable HTTP 风格)单测。

覆盖:
- initialize 握手(协议版本/能力声明/serverInfo)
- tools/list 返回全部工具(inputSchema 完整)
- tools/call 真实执行工具(生成图表) + 匿名高危工具被权限矩阵拒绝
- notifications/* 通知返回空响应
- ping
- 未知方法 -32601
- 坏 JSON -32700
- 参数缺失 -32602
"""

import json
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import mcp_official
from app.routers.mcp_official import (
    _dispatch_method,
    _handle_initialize,
    _handle_tools_list,
)

app = FastAPI()
app.include_router(mcp_official.router, prefix="/api")
client = TestClient(app)


def _send(method: str, params: dict[str, Any] | None = None, msg_id: int | None = 1):
    body: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
    if msg_id is not None:
        body["id"] = msg_id
    if params is not None:
        body["params"] = params
    return client.post("/api/mcp", json=body)


class TestDispatch:
    def test_handler_methods(self):
        for m in ("initialize", "tools/list", "tools/call", "ping"):
            assert _dispatch_method(m)[0] == "handler"

    def test_notifications(self):
        assert _dispatch_method("notifications/initialized")[0] == "notification"
        assert _dispatch_method("notifications/cancelled")[0] == "notification"

    def test_unknown(self):
        assert _dispatch_method("bogus")[0] == "unknown"

    def test_resources_prompts_are_handlers(self):
        """resources/list 与 prompts/list 已是真实现(非降级)。"""
        assert _dispatch_method("resources/list")[0] == "handler"
        assert _dispatch_method("prompts/list")[0] == "handler"


class TestHandlers:
    def test_initialize(self):
        r = _handle_initialize({})
        assert r["protocolVersion"] == mcp_official.MCP_PROTOCOL_VERSION
        assert "tools" in r["capabilities"]
        assert r["serverInfo"]["name"] == mcp_official.SERVER_NAME

    def test_tools_list_has_schema(self):
        r = _handle_tools_list()
        assert len(r["tools"]) >= 48
        for t in r["tools"]:
            assert t["name"] and t["description"]
            assert "inputSchema" in t


class TestEndpoint:
    def test_initialize_handshake(self):
        r = _send(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "t", "version": "1"},
            },
        )
        assert r.status_code == 200
        d = r.json()
        assert d["result"]["protocolVersion"] == "2025-06-18"
        assert d["result"]["serverInfo"]["name"] == "ihui-ai-ai-service"

    def test_tools_list(self):
        r = _send("tools/list")
        assert r.status_code == 200
        assert len(r.json()["result"]["tools"]) >= 48

    def test_tools_call_generate_chart(self):
        r = _send(
            "tools/call",
            {
                "name": "generate_chart",
                "arguments": {
                    "chart_type": "pie",
                    "title": "官方MCP测试",
                    "data": '[{"name":"A","value":30},{"name":"B","value":70}]',
                },
            },
        )
        assert r.status_code == 200
        d = r.json()["result"]
        assert d["isError"] is False
        text = json.loads(d["content"][0]["text"])
        assert text["ok"] is True
        assert text["file_path"]

    def test_tools_call_anonymous_guard(self):
        """匿名调用高危工具必须被权限矩阵拒绝(安全默认)。"""
        r = _send(
            "tools/call",
            {"name": "run_command", "arguments": {"command": "whoami"}},
        )
        d = r.json()["result"]
        text = json.loads(d["content"][0]["text"])
        assert d["isError"] is True or text.get("ok") is False

    def test_tools_call_unknown_tool(self):
        r = _send("tools/call", {"name": "no_such_tool", "arguments": {}})
        d = r.json()["result"]
        assert d["isError"] is True

    def test_notification_empty_response(self):
        r = _send("notifications/initialized", msg_id=None)
        assert r.status_code == 200
        assert r.json() == {}

    def test_ping(self):
        r = _send("ping", msg_id=2)
        assert r.status_code == 200
        assert r.json()["result"] == {}

    def test_unknown_method(self):
        r = _send("bogus/method", msg_id=3)
        assert r.status_code == 404
        assert r.json()["error"]["code"] == -32601

    def test_parse_error(self):
        r = client.post(
            "/api/mcp",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.json()["error"]["code"] == -32700

    def test_invalid_params(self):
        r = _send("tools/call", {"name": ""}, msg_id=4)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == -32602

    def test_resources_list(self):
        r = _send("resources/list")
        assert r.status_code == 200
        resources = r.json()["result"]["resources"]
        assert len(resources) >= 3
        names = {x["name"] for x in resources}
        assert {"current_memory", "available_skills", "agent_config"} <= names

    def test_prompts_list(self):
        r = _send("prompts/list")
        assert r.status_code == 200
        prompts = r.json()["result"]["prompts"]
        assert len(prompts) >= 3
        names = {x["name"] for x in prompts}
        assert {"code_review", "bug_fix"} <= names
        # arguments 结构完整
        assert all("arguments" in p for p in prompts)

    def test_prompts_get(self):
        r = _send("prompts/get", {"name": "bug_fix"})
        assert r.status_code == 200
        prompt = r.json()["result"]["prompt"]
        assert prompt["name"] == "bug_fix"
        assert prompt["arguments"]

    def test_prompts_get_not_found(self):
        r = _send("prompts/get", {"name": "no_such"})
        assert r.status_code == 200
        assert r.json()["result"]["prompt"] is None

    def test_prompts_get_missing_name(self):
        r = _send("prompts/get", {})
        assert r.status_code == 400
        assert r.json()["error"]["code"] == -32602
