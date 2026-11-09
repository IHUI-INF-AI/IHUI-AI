# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""公网远程 MCP 端点单测 — 零真实网络、零真实凭据。

被测:app/routers/mcp_public.py(限流 + 白名单转发)与引擎 ``_dispatch`` 白名单语义。

口径:
  - tools/list 只回白名单两工具(wb_server_info / wb_action_routes);
  - tools/call 白名单外(写侧 wb_autopilot_run)⇒ -32602,写侧能力远程不可达;
  - 限流:滑动窗口内超限拒(429 语义由路由层);WB_MCP_PUBLIC_RATE=0 关闭;
  - 白名单内 tools/call 走真 handler(纯读仓库 JSON,零凭据)。
"""

from __future__ import annotations

import json
from typing import Any

from mcp_server import wb_autopilot_mcp as m
from app.routers import mcp_public


def _rpc(method: str, *, req_id: Any = 1, params: dict[str, Any] | None = None) -> dict[str, Any]:
    msg: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        msg["params"] = params
    return msg


PUB = mcp_public.PUBLIC_TOOLS


def test_public_tools_list_only_readonly() -> None:
    resp = m._dispatch(_rpc("tools/list"), allowed_tools=PUB)
    names = [t["name"] for t in resp["result"]["tools"]]
    assert names == ["wb_server_info", "wb_action_routes"]
    assert "wb_autopilot_run" not in names and "wb_tasks_list" not in names


def test_public_write_tool_rejected() -> None:
    """写侧工具在远程面 -32602(对外只读,凭据与写侧永不出境)。"""
    resp = m._dispatch(
        _rpc("tools/call", params={"name": "wb_autopilot_run", "arguments": {}}),
        allowed_tools=PUB,
    )
    assert resp["error"]["code"] == -32602
    assert "public endpoint" in resp["error"]["message"]


def test_public_server_info_tool_runs() -> None:
    resp = m._dispatch(
        _rpc("tools/call", params={"name": "wb_server_info", "arguments": {}}),
        allowed_tools=PUB,
    )
    assert resp["result"]["isError"] is False
    payload = json.loads(resp["result"]["content"][0]["text"])
    assert "aizhs.top" in payload["project"]
    assert "progress" in payload["safety"]
    assert payload["verified_task_codes"], "应有已 verified 的任务码"


def test_public_action_routes_tool_runs() -> None:
    resp = m._dispatch(
        _rpc("tools/call", params={"name": "wb_action_routes", "arguments": {}}),
        allowed_tools=PUB,
    )
    payload = json.loads(resp["result"]["content"][0]["text"])
    assert payload["routes"]["Sequential_Tasks_1"] == "generic"


def test_rate_allow_sliding_window() -> None:
    """滑动窗口:窗口内前 N 次放行、超限拒绝、窗口语义纯内存。"""
    mcp_public._RATE_LIMIT = 3
    mcp_public._rate_buckets.clear()
    key = "test-ip-1"
    assert [mcp_public._rate_allow(key) for _ in range(3)] == [True, True, True]
    assert mcp_public._rate_allow(key) is False
    mcp_public._RATE_LIMIT = 0  # 关闭(恢复全局,免污染其他测试)
    assert mcp_public._rate_allow(key) is True


def test_full_size_unchanged_for_stdio(monkeypatch=None) -> None:
    """stdio 本地面(无白名单)不受影响:四工具全量。"""
    resp = m._dispatch(_rpc("tools/list"))
    assert len(resp["result"]["tools"]) == 4
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
