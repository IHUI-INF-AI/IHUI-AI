# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-234(D120):轮次预算弹性续跑 —— 续期 / 上限 / 条件不满足 三态。

票面验收三条各自成组(判据只 import 生产出口,不在此复制一份):
① 预算耗尽且满足续期条件 ⇒ 续期一次并继续(12 轮任务在 8 轮预算下跑完);
② 超过续期上限 ⇒ 停止(封顶后不再延长,循环按剩余预算退出);
③ 不满足条件 ⇒ 不续期(首轮 / 未近上限 / 上轮无工具 / 限额收口 / env 关闭)。

另钉一例续期交代帧的形状:票面要求「总结落 metadata 供回放」,而 API 侧
`persistedInjectionSchema` 锁 `kind` + `collapsed` 两个必填键(loose 透传其余),
缺 `collapsed` 则整帧落不了库、前端 `appendMessageInjection` 也拿不到兜底文本。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, settings
from app.main import app
from app.routers import llm as llm_mod
from app.routers.llm import _d120_extension_frame, _d120_should_extend
from app.services.mcp_server import mcp_server


def _simulate_long_task(
    *, max_iterations: int, tool_rounds: int
) -> tuple[int, int, int, list[dict]]:
    """按 llm.py 工具循环的顺序只重放"预算记账那几行"(每轮都执行工具)。

    返回 (实跑轮数, 最终预算, 续期次数, 续期交代帧列表);判定一律问
    `_d120_should_extend`,帧一律取自 `_d120_extension_frame` —— 本函数不复制判据。
    """
    iter_budget = max_iterations
    extensions_used = 0
    frames: list[dict] = []
    tool_iter = 0
    while tool_iter < iter_budget:
        if _d120_should_extend(
            tool_iter=tool_iter,
            iter_budget=iter_budget,
            extensions_used=extensions_used,
            tool_executed_last_round=tool_iter > 0,
            budget_exhausted=False,
        ):
            extensions_used += 1
            iter_budget += llm_mod._ITERATION_EXTEND_TURNS
            frames.append(
                _d120_extension_frame(
                    tool_iter=tool_iter,
                    extension_index=extensions_used,
                    extension_limit=llm_mod._ITERATION_EXTEND_LIMIT,
                    note=f"续期说明-{extensions_used}",
                )
            )
        tool_iter += 1
        if tool_iter >= tool_rounds:  # 任务在这一轮做完 ⇒ 正常收尾
            break
    return tool_iter, iter_budget, extensions_used, frames


def test_extends_once_and_continues_past_budget(monkeypatch):
    """① 预算耗尽且条件全满足:续期 ⇒ 12 轮任务跑完(不硬断在第 8 轮)。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 2)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", 2)
    rounds, budget, used, frames = _simulate_long_task(max_iterations=8, tool_rounds=12)
    assert rounds == 12  # 跑完整条任务
    assert used == 2  # 8 + 2 + 2 = 12 轮,恰好两次续期
    assert budget == 12
    assert len(frames) == 2


def test_stops_after_extension_limit(monkeypatch):
    """② 超过续期上限 ⇒ 停止:封顶 2 次后再问判定恒 False,循环按预算退出。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 2)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", 2)
    rounds, budget, used, frames = _simulate_long_task(max_iterations=8, tool_rounds=10_000)
    assert used == 2  # 恰好用尽上限,没有第 3 次
    assert budget == 8 + 2 * 2
    assert rounds == budget  # 续期耗尽后跑满预算即停,不再自我续命
    assert len(frames) == 2
    # 上限处再问一次判定:其余条件全满足也必须是 False(防"上限外再续一次")
    assert not _d120_should_extend(
        tool_iter=11,
        iter_budget=12,
        extensions_used=used,
        tool_executed_last_round=True,
        budget_exhausted=False,
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"tool_iter": 0},  # 首轮:还没有"上一轮工具结果"可言
        {"iter_budget": 40},  # 离上限还远:不是"下一轮即触顶"
        {"tool_executed_last_round": False},  # 上一轮只有文本、没执行工具
        {"budget_exhausted": True},  # G-815971:本轮因限额/配额收口,一票否决
        {"extensions_used": 1, "_limit": 1},  # 续期名额已用尽
    ],
)
def test_no_extension_when_conditions_unmet(monkeypatch, overrides):
    """③ 不满足条件 ⇒ 不续期(逐条件单独失效,方向恒为"少续一期")。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", overrides.get("_limit", 2))
    cases = {
        "tool_iter": 3,
        "iter_budget": 4,
        "extensions_used": 0,
        "tool_executed_last_round": True,
        "budget_exhausted": False,
    }
    cases.update({k: v for k, v in overrides.items() if k != "_limit"})
    assert not _d120_should_extend(**cases)


def test_env_off_never_extends(monkeypatch):
    """env 关闭(LLM_ITERATION_EXTEND_LIMIT=0)⇒ 8 轮任务到顶即断,零续期零交代帧。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 0)
    rounds, budget, used, frames = _simulate_long_task(max_iterations=8, tool_rounds=10_000)
    assert (rounds, budget, used, frames) == (8, 8, 0, [])


def test_extension_frame_is_replayable_metadata():
    """续期交代帧:按 injection_applied 惯例带 collapsed/fullText,且不带 type/messageId。"""
    frame = _d120_extension_frame(
        tool_iter=7, extension_index=1, extension_limit=2, note="[系统] 续期说明"
    )
    assert frame["kind"] == "iteration_extension"
    # API 侧 persistedInjectionSchema 的必填两键(缺 collapsed ⇒ 校验不过、落不了库)
    assert isinstance(frame["collapsed"], str) and frame["collapsed"].strip()
    assert frame["fullText"] == "[系统] 续期说明"
    assert frame["extensionIndex"] == 1
    assert frame["extensionLimit"] == 2
    assert frame["round"] == 7
    # type 是 SSE 判别字(持久化层剥掉),messageId 按消息行寻址 —— 帧本身都不带
    assert "type" not in frame
    assert "messageId" not in frame


# =============================================================================
# 集成组(票面:用假 LLM/桩,不真打外部 API)—— 12 轮任务真跑主对话流
# =============================================================================


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
    summary_text: str = "进度总结:前段工具已完成,继续收尾",
    summary_error: dict[str, Any] | None = None,
) -> dict[str, int]:
    """假 LLM:按 messages 里的总结标记区分"总结调用"与"主循环轮次调用"。

    主循环前 tool_rounds 次返回 tool_calls(每轮执行一次 web_search),
    之后返回最终文本;总结调用单独计数,可注入限额错误。
    """
    from app.routers import llm as llm_router

    state = {"rounds": 0, "summaries": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        is_summary = any(
            llm_router._D120_SUMMARY_MARKER in str(m.get("content", ""))
            for m in messages
            if isinstance(m, dict)
        )
        if is_summary:
            state["summaries"] += 1
            if summary_error is not None:
                yield {"type": "error", **summary_error}
                return
            yield {"type": "chunk", "content": summary_text}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"total_tokens": 7},
                "stub": True,
            }
            return
        state["rounds"] += 1
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
        raise AssertionError("D120:主循环与总结均不得走非流式 complete()")

    async def mock_call_tool(name, arguments, **kwargs):
        return {"tool": name, "ok": True, "mock": True, "message": "ok"}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
    monkeypatch.setattr(mcp_server, "call_tool", mock_call_tool)
    return state


async def _stream(client: AsyncClient) -> list[dict[str, Any]]:
    resp = await client.post(
        "/api/llm/complete/stream",
        json={
            "messages": [{"role": "user", "content": "跑一个 12 步的长任务"}],
            "model": "test-model",
            "agent_tools": ["web_search"],
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


def _is_volatile_key(key: str) -> bool:
    """追踪 id 与一切计时字段(*Ms / *At)每请求必变,不参与逐帧比对。"""
    return key in {"traceId", "timestamp", "ts"} or key.endswith("Ms") or key.endswith("At")


def _strip_volatile(value: Any) -> Any:
    """去掉每请求必变的追踪/计时字段,只比协议与内容。"""
    if isinstance(value, dict):
        return {k: _strip_volatile(v) for k, v in value.items() if not _is_volatile_key(k)}
    if isinstance(value, list):
        return [_strip_volatile(v) for v in value]
    return value


async def test_twelve_round_task_extends_and_completes(client, monkeypatch):
    """① 默认 8 轮预算 + 每次 +2 轮、最多 2 次续期:12 轮任务续跑到完成。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 2)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", 2)
    monkeypatch.setattr(settings, "max_agent_iterations", 8)
    state = _install_fake_llm(monkeypatch, tool_rounds=12)

    events = await _stream(client)

    assert len([e for e in events if e["event"] == "tool-result"]) == 12
    exts = _extensions(events)
    assert len(exts) == 2
    assert [e["extensionIndex"] for e in exts] == [1, 2]
    assert exts[0]["extensionLimit"] == 2
    assert "进度总结" in exts[0]["fullText"]
    # 总结经同一网关模型调用产生,每次续期调一次
    assert state["summaries"] == 2
    # 12 轮工具 + 1 轮收尾文本
    assert state["rounds"] == 13
    chunks = "".join(
        str(e["data"].get("content", "")) for e in events if e["event"] == "chunk"
    )
    assert "任务完成" in chunks
    # 总结落响应 metadata(回放同源)
    done = [e for e in events if e["event"] == "done"]
    assert done
    meta = done[-1]["data"].get("metadata")
    assert len(meta["iterationExtensions"]) == 2
    assert meta["iterationExtensions"][0]["summary"].startswith("进度总结")


async def test_extension_limit_is_not_bypassed(client, monkeypatch):
    """② 续期满 2 次后不再续:按每期预算退出,第 3 次绝不出现。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 2)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", 2)
    monkeypatch.setattr(settings, "max_agent_iterations", 2)
    state = _install_fake_llm(monkeypatch, tool_rounds=10_000)

    events = await _stream(client)

    assert len(_extensions(events)) == 2
    # 2 期预算 + 2 次续期 × 2 轮 = 6 轮工具,之后循环按原语义退出
    assert len([e for e in events if e["event"] == "tool-result"]) == 6
    assert state["summaries"] == 2
    # 仍然产出既有收尾形态(done)
    assert [e for e in events if e["event"] == "done"]


async def test_no_extension_scenario_is_byte_identical(client, monkeypatch):
    """③ 未触发续期的场景:开启续期能力与关闭(limit=0)输出逐帧一致。"""
    monkeypatch.setattr(settings, "max_agent_iterations", 8)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", 2)

    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 0)
    _install_fake_llm(monkeypatch, tool_rounds=2)
    baseline = [_strip_volatile(e) for e in await _stream(client)]

    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 2)
    state = _install_fake_llm(monkeypatch, tool_rounds=2)
    actual = [_strip_volatile(e) for e in await _stream(client)]

    assert actual == baseline
    assert _extensions(actual) == []
    assert state["summaries"] == 0


async def test_summary_budget_error_cancels_extension(client, monkeypatch):
    """④ 总结调用本身撞限额 ⇒ 不续期、不再开模型请求,按原预算停。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 2)
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_TURNS", 2)
    monkeypatch.setattr(settings, "max_agent_iterations", 4)
    _install_fake_llm(
        monkeypatch,
        tool_rounds=10_000,
        summary_error={"errorCode": "RATE_LIMITED", "message": "429 rate limit"},
    )

    events = await _stream(client)

    assert _extensions(events) == []
    assert len([e for e in events if e["event"] == "tool-result"]) == 4


def test_renewal_config_default_is_two():
    """D120 配置档:续期上限默认 2、每次续 +2 轮,且不改 max_agent_iterations 的语义。"""
    fields = Settings.model_fields
    assert fields["agent_budget_renewals"].default == 2
    assert fields["agent_budget_renewal_turns"].default == 2
    assert fields["max_agent_iterations"].default == 8

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
