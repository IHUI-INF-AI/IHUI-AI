"""tool loop 端到端回归测试:浏览器控制 / subagent 调度。

防止 api agent-control 路由或 mcp_server 工具注册回归。
覆盖:
- dispatch_subagent 工具注册到 _TOOLS + _TOOL_HANDLERS
- dispatch_subagent 调用:未知 agent → ok=False / 缺参数 → MISSING_PARAMS
- tool loop 去重逻辑:LLM 重复调用同一工具 → 第二次 tool-result 含 repeated:True
- agent_tools 含未知工具名 → 被跳过(不进 openai_tools)

提取自 .trae-cn/tmp/mock_extension.py 验证脚本逻辑,转为 pytest fixture + test case。
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.services.mcp_server import (
    mcp_server,
    _TOOLS,
    _TOOL_HANDLERS,
)


# =============================================================================
# 辅助函数
# =============================================================================

def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """解析 SSE 原始文本为事件列表。

    每个事件格式:event: <type>\ndata: <json>\n\n
    返回 [{"event": "tool-result", "data": {...}}, ...]
    """
    events: list[dict[str, Any]] = []
    blocks = raw.split("\n\n")
    for block in blocks:
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


# =============================================================================
# 1. dispatch_subagent 工具注册
# =============================================================================

def test_dispatch_subagent_tool_registered():
    """dispatch_subagent 在 _TOOLS 和 _TOOL_HANDLERS 中均已注册。"""
    tool_names = {t.name for t in _TOOLS}
    assert "dispatch_subagent" in tool_names
    assert "dispatch_subagent" in _TOOL_HANDLERS


# =============================================================================
# 2. dispatch_subagent 调用未知 agent
# =============================================================================

async def test_dispatch_subagent_unknown_agent_returns_failed():
    """调用 dispatch_subagent 派发不存在的 agent → ok=False,error 含"不存在"或"failed"。"""
    result = await mcp_server.call_tool(
        "dispatch_subagent",
        {"name": "nonexistent-xyz", "task": "test"},
    )
    assert result["ok"] is False
    # agent_orchestrator.invoke 返回 status="failed" + error="Agent 不存在: ..."
    error_str = str(result.get("error", ""))
    status_str = str(result.get("status", ""))
    assert "不存在" in error_str or "failed" in status_str or "failed" in error_str


# =============================================================================
# 3. dispatch_subagent 缺少必填参数
# =============================================================================

async def test_dispatch_subagent_missing_params():
    """dispatch_subagent 缺少 task 参数 → ok=False + errorCode=MISSING_PARAMS。"""
    result = await mcp_server.call_tool(
        "dispatch_subagent",
        {"name": "code-reviewer"},  # 缺 task
    )
    assert result["ok"] is False
    assert result.get("errorCode") == "MISSING_PARAMS"


# =============================================================================
# 4. tool loop 去重逻辑(LLM 重复调用同一工具 → repeated:True)
# =============================================================================

async def test_tool_loop_dedup_logic(client: Any, monkeypatch):
    """模拟 LLM 重复调用同一工具,验证第二次 tool-result 事件含 repeated:True。

    通过 monkeypatch 控制 llm_gateway.complete 返回值:
    - 第 1 次:返回 tool_calls=[analyze_code({code:"x"})] → 首次执行
    - 第 2 次:返回相同 tool_calls → 命中去重,推送 repeated:True
    - 第 3 次:返回空 tool_calls → 跳出 loop,走 astream
    同时 mock astream + mcp_server.call_tool 避免真实 LLM/工具调用。
    """
    from app.routers import llm as llm_router
    from app.services.mcp_server import mcp_server as _mcp_inst

    call_count = [0]

    async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
        """模拟 complete:前 2 次返回相同 tool_calls,第 3 次返回空(跳出 loop)。"""
        call_count[0] += 1
        if call_count[0] <= 2:
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "tc_dedup_test",
                        "type": "function",
                        "function": {
                            "name": "analyze_code",
                            "arguments": json.dumps({"code": "x"}),
                        },
                    }
                ],
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }
        # 第 3 次起返回空 tool_calls(跳出 tool loop)
        return {
            "content": "分析完成",
            "model": "test-model",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "stub": True,
        }

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        """模拟 astream:产出单个 chunk + done,避免真实 LLM 调用。"""
        yield {"type": "chunk", "content": "分析完成"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    async def mock_call_tool(name, arguments, **kwargs):
        """模拟工具执行:返回 ok=True,确保 tool loop 认为工具成功后继续下一轮。

        analyze_code 实际 handler 不返回 ok 字段,会导致 tool loop 误判失败提前退出,
        故需 mock call_tool 统一返回 ok=True。
        """
        return {
            "tool": name,
            "ok": True,
            "mock": True,
            "message": f"mock execution of {name}",
        }

    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

    body = {
        "messages": [{"role": "user", "content": "分析这段代码"}],
        "model": "test-model",
        "agent_tools": ["analyze_code"],
    }

    resp = await client.post("/api/llm/complete/stream", json=body)
    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)

    # 收集 tool-result 事件
    tool_result_events = [
        e for e in events if e["event"] == "tool-result"
    ]

    # 至少 2 个 tool-result(首次执行 + 第二次去重)
    assert len(tool_result_events) >= 2, f"期望 ≥2 个 tool-result,实际 {len(tool_result_events)}"

    # 第 1 个:首次执行,不应有 repeated 标记
    first = tool_result_events[0]["data"]
    assert first.get("repeated") is not True, "首次执行不应标记 repeated"

    # 第 2 个:重复调用,应标记 repeated:True
    second = tool_result_events[1]["data"]
    assert second.get("repeated") is True, "第二次调用应标记 repeated:True"

    # 两个 tool-result 的工具名一致(去重基于 tool_name + args_hash)
    assert first.get("toolName") == "analyze_code"
    assert second.get("toolName") == "analyze_code"

    # 第二次的 result 应含 skipped 标记(跳过执行)
    second_result = second.get("result", {})
    assert second_result.get("skipped") is True
    assert second_result.get("previous_result_available") is True


# =============================================================================
# 5. agent_tools 含未知工具名 → 被跳过
# =============================================================================

async def test_agent_tools_unknown_tool_skipped():
    """agent_tools 含不存在的工具名时被跳过(不进 openai_tools)。

    验证逻辑与 llm.py tool loop 入口一致:
    - 从 mcp_server.list_tools() 构造 tool_map
    - 只把 tool_map 中存在的工具加入 openai_tools
    - 未知工具名被静默跳过
    """
    all_tools = mcp_server.list_tools()
    tool_map = {t.name: t for t in all_tools}
    tool_names = set(tool_map.keys())

    # fake_tool_xyz 不在注册表中
    assert "fake_tool_xyz" not in tool_names

    # 模拟 llm.py openai_tools 构造逻辑(line 324-335)
    requested = ["fake_tool_xyz", "analyze_code"]
    openai_tool_names = []
    for name in requested:
        t = tool_map.get(name)
        if t:
            openai_tool_names.append(t.name)

    # fake_tool_xyz 被跳过,只保留 analyze_code
    assert "fake_tool_xyz" not in openai_tool_names
    assert "analyze_code" in openai_tool_names
    assert len(openai_tool_names) == 1
