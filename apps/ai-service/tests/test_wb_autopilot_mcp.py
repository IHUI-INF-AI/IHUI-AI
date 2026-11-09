# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy autopilot MCP Server 协议层单测 — 零真实网络、零真实凭据。

被测:apps/ai-service/mcp_server/wb_autopilot_mcp.py 的 ``_dispatch``(纯函数)。

口径:
  - initialize 握手回 protocolVersion + tools capability;
  - tools/list 恰好 3 个工具(wb_autopilot_run / wb_tasks_list / wb_action_routes);
  - 通知(notifications/*)不产生响应;未知 method ⇒ -32601;
  - tools/call 未知工具 ⇒ -32602;handler 异常 ⇒ -32603(进程不崩);
  - main() 主循环:坏行回 -32700 不崩;EOF 正常退出。

工具执行面(_tool_* 需要 checkin_store 解密)不在本文件:引擎行为已由
test_workbuddy_autopilot.py 覆盖,此处只锁协议契约。
"""

from __future__ import annotations

import io
import json
from typing import Any

from mcp_server import wb_autopilot_mcp as m


def _rpc(method: str, *, req_id: Any = 1, params: dict[str, Any] | None = None) -> dict[str, Any]:
    msg: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        msg["params"] = params
    return msg


def test_initialize_handshake() -> None:
    resp = m._dispatch(_rpc("initialize", params={"protocolVersion": "2024-11-05"}))
    assert resp is not None and resp["id"] == 1
    result = resp["result"]
    assert result["protocolVersion"] == m.PROTOCOL_VERSION
    assert result["capabilities"]["tools"] == {}
    assert result["serverInfo"]["name"] == "wb-autopilot"


def test_tools_list_has_four_tools() -> None:
    resp = m._dispatch(_rpc("tools/list"))
    names = [t["name"] for t in resp["result"]["tools"]]
    assert names == ["wb_server_info", "wb_autopilot_run", "wb_tasks_list", "wb_action_routes"]
    for tool in resp["result"]["tools"]:
        assert "description" in tool and "inputSchema" in tool


def test_notification_produces_no_response() -> None:
    assert m._dispatch({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None


def test_unknown_method_is_32601() -> None:
    resp = m._dispatch(_rpc("resources/list"))
    assert resp["error"]["code"] == -32601


def test_ping_returns_empty_result() -> None:
    resp = m._dispatch(_rpc("ping"))
    assert resp["result"] == {}


def test_tools_call_unknown_tool_is_32602() -> None:
    resp = m._dispatch(_rpc("tools/call", params={"name": "no_such_tool", "arguments": {}}))
    assert resp["error"]["code"] == -32602


def test_tools_call_handler_exception_is_32603_not_crash() -> None:
    """handler 抛异常 ⇒ 结构化 -32603,进程不崩(顶层兜底契约)。"""
    async def boom(_args: dict[str, Any]) -> str:
        raise RuntimeError("boom")

    original = m._TOOL_HANDLERS["wb_action_routes"]
    m._TOOL_HANDLERS["wb_action_routes"] = boom
    try:
        resp = m._dispatch(
            _rpc("tools/call", params={"name": "wb_action_routes", "arguments": {}})
        )
    finally:
        m._TOOL_HANDLERS["wb_action_routes"] = original
    assert resp["error"]["code"] == -32603
    assert "boom" in resp["error"]["message"]


def test_wb_action_routes_returns_route_map() -> None:
    """真实动作表冒烟:routes 里 Sequential 族 = generic(零出站依赖,纯读 JSON)。"""
    import asyncio

    text = asyncio.run(m._tool_action_routes({}))
    routes = json.loads(text)["routes"]
    assert routes["Sequential_Tasks_1"] == "generic"
    assert routes["WorkBuddy_Valorant"] in ("desktop", "unregistered(零出站登记)")


def test_main_loop_bad_line_then_valid_request_then_eof() -> None:
    """坏行回 -32700 不崩;合法请求得到响应;EOF 退出码 0。"""
    lines = [
        "not-json-at-all",
        json.dumps(_rpc("tools/list"), ensure_ascii=False),
        "   ",
        json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
    ]
    fake_in = io.StringIO("\n".join(lines) + "\n")
    real_stdin, real_stdout = m.sys.stdin, m.sys.stdout
    m.sys.stdin = fake_in
    out = io.StringIO()
    m.sys.stdout = out
    try:
        rc = m.main()
    finally:
        m.sys.stdin, m.sys.stdout = real_stdin, real_stdout
    assert rc == 0
    written = [json.loads(l) for l in out.getvalue().splitlines() if l.strip()]
    assert len(written) == 2, "坏行 1 条 + tools/list 1 条;通知与空行不写"
    assert written[0]["error"]["code"] == -32700
    assert written[1]["result"]["tools"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
