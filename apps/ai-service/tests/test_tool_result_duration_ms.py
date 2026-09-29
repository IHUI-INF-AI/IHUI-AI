# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""tool-result 帧后端下发耗时(D49② / G-61②,2026-09-24 立)。

缺陷:契约 tool-result 帧不带 durationMs,前端只能在 tool-call-start 记本地时钟、
result 到达时相减 —— 断线 / 刷新 / 回放三条路径拿不到耗时(断线即不可得)。

本文件钉住修复后的三件事:
1. 每一帧 tool-result 都携带非负整数 durationMs(含去重 repeated 分支);
2. 同一次工具调用的 plan_updated 步骤 durationMs 与帧内值**逐字相等**
   (单一变量 _tc_duration_ms 同时喂两处,不允许两处各算各的);
3. Python 侧契约清单 sse_contract.py 与 TS 侧 contract.ts 都登记了该字段。

测试隔离:仅 patch llm_gateway.astream + mcp_server.call_tool,不连生产
PostgreSQL(8810)/ Redis(8811);conftest 的 autouse 隔离 fixture 已清 vendor key。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient

_REPO_ROOT = Path(__file__).resolve().parents[2].parent
_PY_CONTRACT = _REPO_ROOT / "apps/ai-service/app/core/sse_contract.py"
_TS_CONTRACT = _REPO_ROOT / "packages/shared/src/sse/contract.ts"

# 让工具"真的花一点时间",以便断言 durationMs 明显 > 0(而非恰好落在 0 挡掉回归)
_TOOL_SLEEP_SECONDS = 0.06
# 取 20ms 为下限:Windows 时钟粒度下 60ms 睡眠实测至少 45ms,留足余量不误抖
_MIN_EXPECTED_MS = 20


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """解析 SSE 原始文本为 [{event, data}] 列表(与同目录 tool loop 测试同口径)。"""
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
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


def _tool_results(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e["data"] for e in events if e["event"] == "tool-result"]


def _plan_step(events: list[dict[str, Any]], tool_call_id: str) -> dict[str, Any] | None:
    """取最后一帧 plan_updated 中该 toolCallId 的步骤(快照是权威全量,取末帧即终态)。"""
    for event in reversed([e for e in events if e["event"] == "plan_updated"]):
        for step in event["data"].get("plan", []):
            if isinstance(step, dict) and step.get("id") == tool_call_id:
                return step
    return None


async def _stream(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> str:
    """跑一轮 tool loop:第 1 轮流式给 tool_calls,第 2 轮起给正文收尾。"""
    from app.routers import llm as llm_router
    from app.services.mcp_server import mcp_server as _mcp_inst

    round_no = {"n": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        round_no["n"] += 1
        if round_no["n"] == 1:
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "call_dur_1",
                        "type": "function",
                        "function": {"name": "web_search", "arguments": '{"q":"duration"}'},
                    }
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "已完成"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    async def mock_call_tool(name, arguments, **kwargs):
        await asyncio.sleep(_TOOL_SLEEP_SECONDS)
        return {"tool": name, "ok": True, "mock": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)
    resp = await client.post(
        "/api/llm/complete/stream",
        json={
            "messages": [{"role": "user", "content": "搜一下 duration"}],
            "model": "test-model",
            "agent_tools": ["web_search"],
        },
    )
    assert resp.status_code == 200, f"流式接口未 200: {resp.status_code}"
    return resp.text


# =============================================================================
# 1. tool-result 帧携带后端耗时
# =============================================================================

async def test_tool_result_frame_carries_server_duration_ms(client: Any, monkeypatch):
    """正常分支:tool-result 帧带非负整数 durationMs,且明显反映工具真实耗时。"""
    events = _parse_sse_events(await _stream(client, monkeypatch))
    results = _tool_results(events)
    assert len(results) == 1, f"期望 1 帧 tool-result,实际 {len(results)}"

    data = results[0]
    assert "durationMs" in data, f"tool-result 帧缺 durationMs,前端将回退本地时钟: {sorted(data)}"
    duration = data["durationMs"]
    assert isinstance(duration, int) and not isinstance(duration, bool), f"durationMs 非整数: {duration!r}"
    assert duration >= _MIN_EXPECTED_MS, f"durationMs={duration} 未反映 {_TOOL_SLEEP_SECONDS}s 的真实耗时"


async def test_plan_updated_step_duration_equals_frame(client: Any, monkeypatch):
    """同源同值:plan 步骤 durationMs 必须与 tool-result 帧完全相等(同一变量喂两处)。"""
    events = _parse_sse_events(await _stream(client, monkeypatch))
    frame = _tool_results(events)[0]
    step = _plan_step(events, "call_dur_1")
    assert step is not None, "plan_updated 快照里找不到该工具步骤,无法对账"
    assert step.get("durationMs") == frame["durationMs"], (
        f"plan 步骤与 SSE 帧耗时不一致(plan={step.get('durationMs')} vs frame={frame['durationMs']}),"
        "说明两处各算各的 —— 前端与计划卡会显示两个不同数字"
    )


# =============================================================================
# 2. 去重分支同样下发
# =============================================================================

async def test_repeated_tool_result_frame_carries_duration_ms(client: Any, monkeypatch):
    """命中去重的 tool-result(repeated:True)也必须带 durationMs(≈0),不得只有正常分支有。"""
    from app.routers import llm as llm_router
    from app.services.mcp_server import mcp_server as _mcp_inst

    round_no = {"n": 0}
    same_call = {
        "index": 0,
        "id": "call_dur_dup",
        "type": "function",
        "function": {"name": "web_search", "arguments": '{"q":"dup"}'},
    }

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        round_no["n"] += 1
        if round_no["n"] <= 2:
            # 两轮返回同一 tool_name + 同一 args ⇒ 第 2 轮命中 executed_tool_keys 去重
            yield {"type": "tool_calls", "tool_calls": [dict(same_call)]}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "完成"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    async def mock_call_tool(name, arguments, **kwargs):
        return {"tool": name, "ok": True, "mock": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)
    resp = await client.post(
        "/api/llm/complete/stream",
        json={
            "messages": [{"role": "user", "content": "重复调用"}],
            "model": "test-model",
            "agent_tools": ["web_search"],
        },
    )
    assert resp.status_code == 200
    events = _parse_sse_events(resp.text)

    results = _tool_results(events)
    repeated = [r for r in results if r.get("repeated") is True]
    assert repeated, f"未命中去重分支,本用例失效(tool-result 共 {len(results)} 帧)"
    for frame in results:
        assert isinstance(frame.get("durationMs"), int), (
            f"存在不带 durationMs 的 tool-result 帧: keys={sorted(frame)}"
        )
        assert frame["durationMs"] >= 0


# =============================================================================
# 3. 两侧契约登记对账(Python 清单 ↔ TS 联合)
# =============================================================================

def test_both_contract_sources_declare_duration_ms():
    """sse_contract.py 与 contract.ts 两侧必须同名登记 durationMs(跨语言复刻曾造幻影缺陷)。"""
    py_src = _PY_CONTRACT.read_text(encoding="utf-8")
    ts_src = _TS_CONTRACT.read_text(encoding="utf-8")

    py_block = py_src.split('SSEEventContract("tool-result",', 1)
    assert len(py_block) == 2, "sse_contract.py 里找不到 tool-result 契约条目(被改名?)"
    py_fields = py_block[1].split(")", 1)[0]
    assert '"durationMs"' in py_fields, f"Python 侧 tool-result 清单未登记 durationMs: {py_fields.strip()}"
    assert '"toolCallId"' in py_fields and '"result"' in py_fields, "既有必填字段不得被删"

    ts_block = ts_src.split("type: 'tool-result'", 1)
    assert len(ts_block) == 2, "contract.ts 里找不到 tool-result 成员(被改名?)"
    ts_member = ts_block[1].split("}>", 1)[0]
    assert "durationMs?: number" in ts_member, (
        f"TS 侧 tool-result 成员未登记 durationMs?: number,与 Python 侧可选性不一致: {ts_member.strip()}"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
