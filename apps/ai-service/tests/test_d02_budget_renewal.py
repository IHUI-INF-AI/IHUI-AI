# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D02(G-234):轮次预算弹性续跑 —— 票面五条验收各自成组。

被测对象是生产出口,不在测试里复制一份判据:
  `_resolve_extension_limits`(env 唯一读取口)/ `_d120_should_extend`(续期判定)/
  `_d120_extension_frame`(交代帧)/ `/api/llm/complete/stream` 主对话流。

验收对应:
  ① 默认配置(8 轮预算、续期 2 次 × +2 轮)下 12 轮任务续跑完成;
  ② 续期次数用尽后硬断,第 3 次绝不出现;
  ③ env 调次数生效(次数 / 每次轮数 / 关闭档 / 旧别名 / 新别名优先);
  ④ 续期记录落 done.metadata.iterationExtensions(与 SSE 交代帧同源,供回放);
  ⑤ 成本守门不被绕过:总结与主循环共用同一计费通道,试用额度照常扣;
     反向对照 —— 总结撞 `BUDGET_EXHAUSTED` 时一次也不续期。

全程假 LLM(monkeypatch 网关),不打外部 API。
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, settings
from app.main import app
from app.routers import llm as llm_mod
from app.routers.llm import _d120_extension_frame, _d120_should_extend, _resolve_extension_limits
from app.services.mcp_server import mcp_server

# 与 GET /llm/complete/stream 的请求体约定一致:conversationId 只作计费关联键
_CONVERSATION_ID = "conv-d02"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
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
                try:
                    data = json.loads(line[5:].strip())
                except (ValueError, json.JSONDecodeError):
                    data = line[5:].strip()
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


def _install_fake_llm(
    monkeypatch,
    *,
    tool_rounds: int,
    summary_error: dict[str, Any] | None = None,
    summary_tokens: int = 7,
) -> dict[str, Any]:
    """假 LLM:按 messages 的总结标记区分"进度总结调用"与"主循环轮次调用"。

    主循环前 tool_rounds 次返回 tool_calls(每轮执行一次 web_search),之后返回
    最终文本;总结调用单独计数并记录 kwargs(供 ⑤ 比对计费通道)。
    """
    state: dict[str, Any] = {
        "rounds": 0,
        "summaries": 0,
        "round_kwargs": [],
        "summary_kwargs": [],
    }

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        is_summary = any(
            llm_mod._D120_SUMMARY_MARKER in str(m.get("content", ""))
            for m in messages
            if isinstance(m, dict)
        )
        if is_summary:
            state["summaries"] += 1
            state["summary_kwargs"].append(kwargs)
            if summary_error is not None:
                yield {"type": "error", **summary_error}
                return
            yield {"type": "chunk", "content": "进度总结:前段工具已完成,正在收尾"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"total_tokens": summary_tokens},
                "stub": True,
            }
            return
        state["rounds"] += 1
        state["round_kwargs"].append(kwargs)
        if state["rounds"] <= tool_rounds:
            yield {
                "type": "tool_calls",
                "tool_calls": [{
                    "index": 0,
                    "id": f"c{state['rounds']}",
                    "type": "function",
                    "function": {"name": "web_search", "arguments": '{"q":"x"}'},
                }],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "任务完成"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"total_tokens": 3},
                "stub": True,
            }

    async def mock_complete(*args, **kwargs):
        raise AssertionError("D02:主循环与总结均不得走非流式 complete()")

    async def mock_call_tool(name, arguments, **kwargs):
        return {"tool": name, "ok": True, "mock": True, "message": "ok"}

    monkeypatch.setattr(llm_mod.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_mod.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(mcp_server, "call_tool", mock_call_tool)
    return state


def _pin_default_renewal_config(monkeypatch) -> None:
    """钉住"默认配置"两档(2 次 × +2 轮),隔离宿主 ambient env 的 import 期覆盖。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 2)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", 2)


async def _stream(client: AsyncClient) -> list[dict[str, Any]]:
    resp = await client.post(
        "/api/llm/complete/stream",
        json={
            "messages": [{"role": "user", "content": "跑一个 12 步的长任务"}],
            "model": "test-model",
            "agent_tools": ["web_search"],
            "metadata": {"conversationId": _CONVERSATION_ID},
        },
    )
    assert resp.status_code == 200
    return _parse_sse_events(resp.text)


def _extensions(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        e["data"]
        for e in events
        if e["event"] == "injection_applied"
        and isinstance(e["data"], dict)
        and e["data"].get("kind") == "iteration_extension"
    ]


def _tool_results(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e for e in events if e["event"] == "tool-result"]


def _done_metadata(events: list[dict[str, Any]]) -> dict[str, Any]:
    done = [e for e in events if e["event"] == "done"]
    assert done, "流必须仍以既有 done 帧收尾"
    meta = done[-1]["data"].get("metadata")
    assert isinstance(meta, dict), "done 帧须带 metadata(续期记录的回放载体)"
    return meta


# =============================================================================
# ① 默认配置下 12 轮任务续跑完成(票面主验收)
# =============================================================================


async def test_default_config_runs_twelve_round_task_to_completion(client, monkeypatch):
    """8 轮单期预算 + 默认 2 次 × +2 轮 ⇒ 12 轮任务不硬断,跑完并给出最终回复。"""
    fields = Settings.model_fields
    assert fields["max_agent_iterations"].default == 8
    assert fields["agent_budget_renewals"].default == 2
    assert fields["agent_budget_renewal_turns"].default == 2

    _pin_default_renewal_config(monkeypatch)
    monkeypatch.setattr(settings, "max_agent_iterations", 8)
    state = _install_fake_llm(monkeypatch, tool_rounds=12)

    events = await _stream(client)

    assert len(_tool_results(events)) == 12  # 12 轮工具全部执行
    exts = _extensions(events)
    assert len(exts) == 2
    assert [e["extensionIndex"] for e in exts] == [1, 2]
    assert exts[0]["extensionLimit"] == 2
    assert "进度总结" in exts[0]["fullText"]
    assert state["summaries"] == 2
    # 12 轮工具 + 1 轮收尾生成
    assert state["rounds"] == 13
    chunks = "".join(
        str(e["data"].get("content", "")) for e in events if e["event"] == "chunk"
    )
    assert "任务完成" in chunks


# =============================================================================
# ② 续期次数用尽后硬断(上限不被绕过)
# =============================================================================


async def test_hard_stop_after_renewals_exhausted(client, monkeypatch):
    """每期 2 轮 + 2 次续期 × +2 轮 = 6 轮,之后按原语义硬断,绝不出现第 3 次。"""
    _pin_default_renewal_config(monkeypatch)
    monkeypatch.setattr(settings, "max_agent_iterations", 2)
    state = _install_fake_llm(monkeypatch, tool_rounds=10_000)

    events = await _stream(client)

    assert len(_extensions(events)) == 2
    assert len(_tool_results(events)) == 6
    assert state["summaries"] == 2
    # 上限处再问判定:其余条件全满足也必须 False(防"上限外再续一次")
    assert not _d120_should_extend(
        tool_iter=5,
        iter_budget=6,
        extensions_used=2,
        tool_executed_last_round=True,
        budget_exhausted=False,
    )


# =============================================================================
# ③ env 调次数生效
# =============================================================================


def test_env_overrides_renewal_budget(monkeypatch):
    """AGENT_BUDGET_RENEWALS / AGENT_BUDGET_RENEWAL_TURNS 真调得到,旧别名不丢,0 = 关闭。"""
    monkeypatch.delenv("MAX_AGENT_BUDGET_RENEWALS", raising=False)
    monkeypatch.delenv("LLM_ITERATION_EXTEND_LIMIT", raising=False)

    monkeypatch.setenv("AGENT_BUDGET_RENEWALS", "3")
    monkeypatch.setenv("AGENT_BUDGET_RENEWAL_TURNS", "1")
    assert _resolve_extension_limits() == (3, 1)

    # 0 = 关闭(且轮数下限 1,不允许"续了等于没续")
    monkeypatch.setenv("AGENT_BUDGET_RENEWALS", "0")
    monkeypatch.setenv("AGENT_BUDGET_RENEWAL_TURNS", "0")
    assert _resolve_extension_limits() == (0, 1)

    # 旧别名仍可调;新别名优先
    monkeypatch.delenv("AGENT_BUDGET_RENEWALS")
    monkeypatch.setenv("LLM_ITERATION_EXTEND_LIMIT", "4")
    assert _resolve_extension_limits()[0] == 4
    monkeypatch.setenv("MAX_AGENT_BUDGET_RENEWALS", "1")
    assert _resolve_extension_limits()[0] == 1


async def test_env_configured_limits_take_effect_in_loop(client, monkeypatch):
    """env 给 3 次 × +1 轮:每期 2 轮的预算被续到 5 轮,交代帧恰好 3 条。"""
    monkeypatch.delenv("MAX_AGENT_BUDGET_RENEWALS", raising=False)
    monkeypatch.delenv("LLM_ITERATION_EXTEND_LIMIT", raising=False)
    monkeypatch.setenv("AGENT_BUDGET_RENEWALS", "3")
    monkeypatch.setenv("AGENT_BUDGET_RENEWAL_TURNS", "1")
    limit, turns = _resolve_extension_limits()
    assert (limit, turns) == (3, 1)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", limit)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", turns)
    monkeypatch.setattr(settings, "max_agent_iterations", 2)
    _install_fake_llm(monkeypatch, tool_rounds=10_000)

    events = await _stream(client)

    assert len(_extensions(events)) == 3
    assert len(_tool_results(events)) == 2 + 3 * 1


# =============================================================================
# ④ 续期记录落 metadata(回放同源)
# =============================================================================


async def test_extension_metadata_is_replayable(client, monkeypatch):
    """done.metadata.iterationExtensions 与 SSE 交代帧同源、条数一致、字段齐备。"""
    _pin_default_renewal_config(monkeypatch)
    monkeypatch.setattr(settings, "max_agent_iterations", 8)
    _install_fake_llm(monkeypatch, tool_rounds=12)

    events = await _stream(client)

    meta = _done_metadata(events)
    records = meta.get("iterationExtensions")
    assert isinstance(records, list) and len(records) == 2
    for idx, rec in enumerate(records, start=1):
        assert rec["index"] == idx
        assert isinstance(rec["round"], int)
        assert rec["summary"].startswith("进度总结")
        # at 是 ISO 时间戳(回放/审计按时间排序)
        assert datetime.fromisoformat(rec["at"])

    # SSE 交代条(用户可见)与 metadata 同源:同样的 index/round/summary
    exts = _extensions(events)
    assert [(e["extensionIndex"], e["round"], e["summary"]) for e in exts] == [
        (r["index"], r["round"], r["summary"]) for r in records
    ]
    # 交代条进 injection_frames ⇒ 落 chat_messages.metadata.injections 的两个必填键
    assert all(isinstance(e["collapsed"], str) and e["collapsed"] for e in exts)
    assert all(e["fullText"] == e["text"] for e in exts)


# =============================================================================
# ⑤ 成本守门不被绕过(正向 + 反向对照)
# =============================================================================


async def test_renewal_spend_goes_through_the_same_cost_channel(client, monkeypatch):
    """正向:总结调用与主循环同一计费 kwargs,总结用量照常扣试用额度(不再开免费通道)。"""
    _pin_default_renewal_config(monkeypatch)
    monkeypatch.setattr(settings, "max_agent_iterations", 2)
    monkeypatch.setattr(llm_mod, "_resolve_owner_uuid", lambda request: "user-d02")
    monkeypatch.setattr(llm_mod, "resolve_request_user_id", lambda request: "user-d02")

    consumed: list[tuple[str | None, int]] = []

    async def fake_consume(user_id, total_tokens):
        consumed.append((user_id, total_tokens))

    monkeypatch.setattr(llm_mod.user_trial_quota, "consume", fake_consume)
    state = _install_fake_llm(monkeypatch, tool_rounds=100, summary_tokens=7)

    events = await _stream(client)

    assert len(_extensions(events)) == 2  # 续期确实发生(不是"关掉续期躲成本")
    assert state["summaries"] == 2

    def _billing(kwargs: dict[str, Any]) -> dict[str, Any]:
        return {k: kwargs.get(k) for k in ("billing_user_id", "conversation_id")}

    expected = {"billing_user_id": "user-d02", "conversation_id": _CONVERSATION_ID}
    assert _billing(state["summary_kwargs"][0]) == expected
    assert _billing(state["round_kwargs"][0]) == expected

    # 总结用量也计入试用额度(fire-and-forget 任务,给事件循环一个调度窗口)
    for _ in range(50):
        if len(consumed) >= 2:
            break
        await asyncio.sleep(0.01)
    assert consumed[:2] == [("user-d02", 7), ("user-d02", 7)]


async def test_budget_exhausted_summary_blocks_renewal(client, monkeypatch):
    """反向对照:总结撞 app/api 成本守门的 `BUDGET_EXHAUSTED` ⇒ 0 续期、预算一格不多。"""
    _pin_default_renewal_config(monkeypatch)
    monkeypatch.setattr(settings, "max_agent_iterations", 4)
    state = _install_fake_llm(
        monkeypatch,
        tool_rounds=10_000,
        summary_error={"errorCode": "BUDGET_EXHAUSTED", "message": "token budget exhausted"},
    )

    events = await _stream(client)

    assert _extensions(events) == []
    assert len(_tool_results(events)) == 4  # 单期预算 4 轮,续期未把已收口的 turn 延长
    assert state["summaries"] == 1  # 撞限额后不再重试总结
    assert state["rounds"] == 5  # 4 轮工具 + 1 轮收尾,无额外模型请求


def test_extension_frame_stays_inside_injection_family():
    """交代帧复用既有 injection_applied 形态:不新造帧族,也不带 SSE 判别字/寻址键。"""
    frame = _d120_extension_frame(
        tool_iter=7, extension_index=1, extension_limit=2, note="[系统] 续期说明"
    )
    assert frame["kind"] == "iteration_extension"
    assert frame["collapsed"].strip()
    assert frame["fullText"] == "[系统] 续期说明"
    assert "type" not in frame and "messageId" not in frame
