# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-941 写账侧:workflow 链必须有真实生产者,漏传链别不得静默当主链(2026-10-26 立).

前提(现读于基线 HEAD):
- workflow_engine.py 全篇不写账 ⇒ 读面虽有 CHAIN_WORKFLOW 桶,却没有任何生产者往里写,
  工作流用量恒落"未判定"桶;
- agent_loop_v2 的 `chain: str = ""` 默认空参 ⇒ 构造点漏传在账面上看不出来。

本文件锁四格:
① workflow 执行产生的用量 ⇒ 条目链别 = workflow(不是未判定、不是主链);
② workflow 的每个 LLM 出口都经过带账包装器(源码结构锁,防新调用点静默无账);
③ AgentLoopV2 漏传 chain ⇒ 显式"未判定"并当场点名,**绝不被计进主链**;
④ 零副作用:测试只写注入的 tmp 账本,全局账本与生产库一次都不碰。
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
from pathlib import Path
from typing import Any

import pytest

from app.core.llm_gateway import llm_gateway
from app.core.token_baseline import (
    CHAIN_MAIN,
    CHAIN_SUBAGENT,
    CHAIN_UNKNOWN_LABEL,
    CHAIN_WORKFLOW,
)
from app.services.agent_loop_v2 import AgentLoopV2
from app.services.cost_ledger import CostLedger
from app.services.workflow_engine import WorkflowEngine

_WORKFLOW_SRC = Path(inspect.getfile(WorkflowEngine))


def _ledger(tmp_path: Path) -> CostLedger:
    """独立文件 + 干净内存的账本(绝不落全局 data/cost_ledger.json)。"""
    return CostLedger(file_path=tmp_path / "ledger.json")


def _usage_complete(prompt_tokens: int, completion_tokens: int = 7):
    """替身 llm_gateway.complete:回一段带 usage 的响应(零网络)。"""

    async def _fake(messages: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
        return {
            "content": "true",
            "model": "gpt-4o-mini",
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
            },
        }

    return _fake


async def _drain(engine: WorkflowEngine, instance_id: str, timeout: float = 3.0) -> str:
    """轮询到实例进入终态(后台链由 spawn 承载,不能直接 await 那个 task)。"""
    deadline = timeout
    while deadline > 0:
        inst = engine.get_instance(instance_id)
        if inst is not None and inst.status in ("completed", "failed", "cancelled"):
            return inst.status
        await asyncio.sleep(0.05)
        deadline -= 0.05
    pytest.fail(f"实例未在 {timeout}s 内进入终态")


# =============================================================================
# ① workflow 执行 ⇒ 真实生产者写账,链别 = workflow
# =============================================================================


async def test_workflow_llm_step_produces_chain_workflow_entry(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """正例:llm 步跑一次 ⇒ 账本多一行,chain 是 workflow,不是未判定/主链。"""
    ld = _ledger(tmp_path)
    monkeypatch.setattr(llm_gateway, "complete", _usage_complete(1200, 30))
    engine = WorkflowEngine(ledger=ld)
    wf = engine.create_workflow(
        name="计费链验证",
        description="workflow 写账生产者",
        triggerType="manual",
        steps=[{"name": "draft", "type": "llm", "input": "写一句"}],
    )

    inst = await engine.trigger_workflow(wf.id, {"q": "写一句"})
    assert inst is not None
    assert await _drain(engine, inst.id) == "completed"

    rows = ld.aggregate()
    # 环①生产者确实落了账:一行,tool_name 带 workflow 前缀
    assert rows["steps"] == 1
    entry = list(ld._data.values())[0]
    assert entry["chain"] == CHAIN_WORKFLOW
    assert entry["tool_name"] == "workflow:draft"
    assert entry["tokens_in"] == 1200
    # 环②读面:workflow 桶可见,未判定桶一条都不该有(旧行为正是恒落未判定)
    by_chain = rows["by_chain"]
    assert by_chain[CHAIN_WORKFLOW]["tokens_in"] == 1200
    assert CHAIN_UNKNOWN_LABEL not in by_chain
    assert CHAIN_MAIN not in by_chain


async def test_workflow_condition_step_also_produces(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """分支节点同样烧 token:condition 判真的那次 LLM 调用必须在账上。"""
    ld = _ledger(tmp_path)
    monkeypatch.setattr(llm_gateway, "complete", _usage_complete(500, 1))
    engine = WorkflowEngine(ledger=ld)
    result = await engine._execute_step(
        {
            "name": "gate",
            "type": "condition",
            "condition": "{context.amount} > 10",
            "thenSteps": [{"type": "echo", "input": "yes"}],
            "elseSteps": [{"type": "echo", "input": "no"}],
        },
        {"amount": 100},
        "inst-cond",
        user_id="u1",
    )
    assert json.loads(result["output"])["result"] is True

    rows = ld.aggregate()
    assert rows["steps"] == 1
    assert list(ld._data.values())[0]["chain"] == CHAIN_WORKFLOW
    assert rows["by_chain"][CHAIN_WORKFLOW]["tokens_in"] == 500


async def test_workflow_llm_exception_writes_no_fabricated_row(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """反例:调用抛异常时没有可测用量 ⇒ 宁可零行,也不把"没量到"写成"量到了"。"""
    ld = _ledger(tmp_path)

    async def _boom(messages: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
        raise RuntimeError("llm down")

    monkeypatch.setattr(llm_gateway, "complete", _boom)
    engine = WorkflowEngine(ledger=ld)
    result = await engine._execute_step(
        {"name": "down", "type": "llm", "input": "x"}, {}, "inst-boom"
    )
    assert "LLM 调用失败" in str(result.get("error"))
    assert ld.aggregate()["steps"] == 0


# =============================================================================
# ② 结构锁:workflow 的 LLM 出口只有一个,且链别取唯一常量源
# =============================================================================


def test_workflow_llm_gateway_call_site_is_single(tmp_path: Path) -> None:
    """新增 llm_gateway.complete 直调 = 又一个静默无账路径,判红。"""
    src = (_WORKFLOW_SRC.resolve()).read_text(encoding="utf-8")
    assert src.count("await llm_gateway.complete(") == 1
    # 写账链别必须取常量源,不许落字面量(字面量与 token_baseline 必然漂移)
    assert '"chain": CHAIN_WORKFLOW' in src
    assert '"chain": "workflow"' not in src


def test_default_ledger_is_the_real_singleton() -> None:
    """缺省构造必须直连全局账本 —— "默认不写账"就是本票要修的洞。"""
    from app.services.cost_ledger import cost_ledger

    assert WorkflowEngine()._cost_ledger() is cost_ledger


# =============================================================================
# ③ 漏传 chain ⇒ 显式未判定,且绝不计进主链
# =============================================================================


def _final_llm(prompt_tokens: int):
    async def _mock(messages: list[dict[str, Any]], tools: Any) -> dict[str, Any]:
        return {
            "content": "ok",
            "tool_calls": None,
            "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": 10},
        }

    return _mock


async def test_omitted_chain_lands_unjudged_never_main(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """构造点漏传 chain:当场点名 + 条目落"未判定"桶,主链读数必须为 0。"""
    from app.services.agent_step_recorder import AgentStepRecorder

    ld = _ledger(tmp_path)
    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")

    with caplog.at_level(logging.WARNING, logger="app.services.agent_loop_v2"):
        loop = AgentLoopV2(
            _final_llm(1000),
            tools=[],
            max_iterations=2,
            recorder=rec,
            session_id="s-g941-omit",
            # 刻意不传 chain(旧默认 ""=看不出来的那格)
        )
    result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.success is True

    # 漏传必须"看得见":实例链标签写成未判定,并留一条 warning
    assert loop._chain == CHAIN_UNKNOWN_LABEL
    assert any("未传 chain" in r.getMessage() for r in caplog.records)

    steps = [s for s in rec.replay("s-g941-omit")["steps"] if s["type"] == "llm"]
    assert steps and {s["chain"] for s in steps} == {CHAIN_UNKNOWN_LABEL}

    out = ld.sync_from_recorder("s-g941-omit", rec, user_id="u1", session_id="s-g941-omit")
    assert out["synced"] == len(steps)
    agg = ld.aggregate()
    # 核心断言:这一笔既在账上,又绝不计进主链
    assert CHAIN_MAIN not in agg["by_chain"]
    assert agg["by_chain"][CHAIN_UNKNOWN_LABEL]["steps"] == len(steps)


async def test_explicit_chain_not_warned_and_bucketed_by_value(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """正向对照:显式传 chain 既不点名,链别也照原值入桶(证明上一条的点名是漏传所致)。"""
    ld = _ledger(tmp_path)

    with caplog.at_level(logging.WARNING, logger="app.services.agent_loop_v2"):
        loop = AgentLoopV2(
            _final_llm(800),
            tools=[],
            max_iterations=2,
            session_id="s-g941-explicit",
            chain=CHAIN_SUBAGENT,
        )
    assert loop._chain == CHAIN_SUBAGENT
    assert not any("未传 chain" in r.getMessage() for r in caplog.records)

    # 显式传空串同样按"未判定"处理(不许把空标签读成主链)
    empty = AgentLoopV2(_final_llm(1), tools=[], session_id="s-g941-empty", chain="")
    assert empty._chain == CHAIN_UNKNOWN_LABEL
    assert ld.aggregate()["steps"] == 0


# =============================================================================
# ④ 零副作用:全局账本一次都不写
# =============================================================================


async def test_workflow_recording_never_touches_global_ledger(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """注入 tmp 账本后,全局 cost_ledger.append 必须一次都不被调(测试不落生产文件)。"""
    import app.services.cost_ledger as cl_mod

    calls: list[str] = []

    def _spy(entry: Any) -> dict[str, Any]:
        calls.append(str(entry))
        raise AssertionError("测试不得写全局账本")

    monkeypatch.setattr(cl_mod.cost_ledger, "append", _spy)

    ld = _ledger(tmp_path)
    monkeypatch.setattr(llm_gateway, "complete", _usage_complete(10, 1))
    engine = WorkflowEngine(ledger=ld)
    await engine._execute_step({"type": "llm", "input": "x"}, {}, "inst-isolated")

    assert calls == []
    assert ld.aggregate()["steps"] == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
