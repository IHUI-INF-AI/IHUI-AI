# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具内嵌 LLM 用量入账链路单元测试(2026-09-09 立)。

背景:extract_web 等工具在内部直接调 llm_gateway,usage 随结果透出为
llm_usage/llm_model。本文件验证两条入账通路都真正把 tokens 记到 step:
1. AgentLoopV2._tool_llm_usage_fields —— 对话主链路 step 顶层映射
2. GuardedToolPipeline —— 调用方未计 token 时从 fn_result.llm_usage 兜底补记
并端到端验证 step → cost_ledger.sync_from_recorder 聚合不漏计。
"""

from __future__ import annotations

from pathlib import Path

from app.services.agent_loop_v2 import AgentLoopV2
from app.services.agent_step_recorder import AgentStepRecorder
from app.services.cost_ledger import CostLedger
from app.services.guarded_tool_pipeline import GuardedToolPipeline

# =============================================================================
# AgentLoopV2._tool_llm_usage_fields(纯映射,无需实例化)
# =============================================================================


class TestToolLLMUsageFields:
    def test_maps_prompt_completion_tokens(self):
        f = AgentLoopV2._tool_llm_usage_fields({
            "llm_usage": {"prompt_tokens": 120, "completion_tokens": 30},
            "llm_model": "test-model-x",
        })
        assert f == {"tokens_in": 120, "tokens_out": 30, "tokens": 150, "model": "test-model-x"}

    def test_accepts_input_output_alias(self):
        f = AgentLoopV2._tool_llm_usage_fields({
            "llm_usage": {"input_tokens": 10, "output_tokens": 5},
        })
        assert f["tokens_in"] == 10 and f["tokens_out"] == 5 and f["tokens"] == 15
        assert "model" not in f  # 无 llm_model 时不注入

    def test_zero_or_missing_tokens_returns_empty(self):
        assert AgentLoopV2._tool_llm_usage_fields({"llm_usage": {}}) == {}
        assert AgentLoopV2._tool_llm_usage_fields({"llm_usage": {"total_tokens": 9}}) == {}
        assert AgentLoopV2._tool_llm_usage_fields({}) == {}
        assert AgentLoopV2._tool_llm_usage_fields("plain string result") == {}
        assert AgentLoopV2._tool_llm_usage_fields(None) == {}


# =============================================================================
# GuardedToolPipeline:调用方未计 token 时从结果兜底
# =============================================================================


async def test_pipeline_fills_tokens_from_result_llm_usage(tmp_path: Path):
    """fn 结果自带 llm_usage 且调用方 tokens 全 0 → step 记录补齐 tokens_in/out。"""
    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")
    pl = GuardedToolPipeline(record_enabled=True, step_recorder=rec)

    async def _fn(args):
        return {
            "tool": "extract_web",
            "ok": True,
            "source": "llm",
            "llm_usage": {"prompt_tokens": 120, "completion_tokens": 30, "total_tokens": 150},
            "llm_model": "test-model-x",
        }

    r = await pl.run("extract_web", {"url": "https://example.com/"}, fn=_fn, run_id="run-llm-1")
    assert r.ok is True
    steps = rec.replay("run-llm-1").get("steps") or []
    assert steps and steps[0]["tokens_in"] == 120
    assert steps[0]["tokens_out"] == 30
    assert steps[0]["tokens"] == 150
    assert steps[0]["model"] == "test-model-x"


async def test_pipeline_respects_caller_tokens_over_result(tmp_path: Path):
    """调用方已显式计 token → 不被结果内嵌 usage 覆盖。"""
    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")
    pl = GuardedToolPipeline(record_enabled=True, step_recorder=rec)

    async def _fn(args):
        return {"ok": True, "llm_usage": {"prompt_tokens": 999, "completion_tokens": 999}}

    r = await pl.run(
        "t", {}, fn=_fn, run_id="run-llm-2", tokens=7, tokens_in=5, tokens_out=2,
    )
    assert r.ok is True
    steps = rec.replay("run-llm-2").get("steps") or []
    assert steps[0]["tokens_in"] == 5 and steps[0]["tokens_out"] == 2


# =============================================================================
# 端到端:step → cost_ledger.sync_from_recorder 聚合入账
# =============================================================================


def test_cost_ledger_syncs_tool_embedded_llm_usage(tmp_path: Path):
    """对话链路录制带 tokens 的 tool step → sync_from_recorder 聚合出非零 tokens。"""
    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")
    rec.append_step("run-e2e", {
        "type": "tool",
        "tool_name": "extract_web",
        "status": "ok",
        "tokens_in": 120,
        "tokens_out": 30,
        "tokens": 150,
        "model": "test-model-x",
    })
    ledger = CostLedger(file_path=tmp_path / "ledger.json")
    res = ledger.sync_from_recorder("run-e2e", rec)
    assert res["synced"] == 1
    agg = ledger.aggregate()
    assert agg["total_tokens_in"] == 120
    assert agg["total_tokens_out"] == 30
    # model 一并入账(归一化不再丢弃)
    entry = next(iter(ledger._data.values()))
    assert entry["model"] == "test-model-x"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
