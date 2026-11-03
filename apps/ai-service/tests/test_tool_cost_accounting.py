# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""step 成本核算模型(tool_cost_accounting.py)单元测试(2026-09-03 立)。

覆盖:
- aggregate_steps:总数 / 总额 / by_tool / by_status / top_cost_steps
- aggregate_run:空 run 全 0;run_id 标注
- remaining_against_limit:有限额 / 用尽 / 未设限额 / 透传 already_used
  (配合预算门控判断"还能执行多少")
- 非法数值字段健壮回落(非数字 / None)
"""

from __future__ import annotations

from pathlib import Path

from app.services.agent_step_recorder import AgentStepRecorder
from app.services.tool_cost_accounting import (
    aggregate_run,
    aggregate_steps,
    remaining_against_limit,
)


def _recorder(tmp_path: Path) -> AgentStepRecorder:
    """独立文件 + 干净内存的步骤录制器(避免污染全局单例)。"""
    return AgentStepRecorder(file_path=tmp_path / "steps.json")


def _step(tool: str, cost: float, *, status: str = "ok", tin: int = 0, tout: int = 0) -> dict:
    return {
        "type": "tool",
        "tool_name": tool,
        "status": status,
        "cost": cost,
        "tokens_in": tin,
        "tokens_out": tout,
        "tokens": tin + tout,
    }


# =============================================================================
# aggregate_steps
# =============================================================================


def test_aggregate_steps_totals_and_by_tool():
    """正确累加总步数 / 总额 / 按工具、按状态分解。"""
    steps = [
        _step("read_file", 0.1, tin=100, tout=50),
        _step("write_file", 0.4, tin=200, tout=100),
        _step("write_file", 0.2, status="error", tin=50, tout=50),
    ]
    agg = aggregate_steps(steps)
    assert agg["total_steps"] == 3
    assert agg["total_cost"] == 0.7
    assert agg["total_tokens_in"] == 350
    assert agg["total_tokens_out"] == 200
    assert agg["total_tokens"] == 550

    assert agg["by_tool"]["read_file"] == {
        "steps": 1, "cost": 0.1, "tokens": 150, "tokens_in": 100, "tokens_out": 50,
    }
    assert agg["by_tool"]["write_file"]["steps"] == 2
    assert agg["by_tool"]["write_file"]["cost"] == 0.6

    assert agg["by_status"]["ok"]["steps"] == 2
    assert agg["by_status"]["error"]["steps"] == 1


def test_aggregate_steps_top_cost_steps_sorted():
    """top_cost_steps 按成本降序取前 10,且只含 cost>0 的步骤。"""
    steps = []
    for i in range(1, 15):
        s = _step("t", i * 0.1, status="error" if i % 2 else "ok")
        s["step_index"] = i - 1
        steps.append(s)
    top = aggregate_steps(steps)["top_cost_steps"]
    assert len(top) == 10
    assert top[0]["cost"] == pytest_appr(1.4)
    # cost 随 i 递增 → 首条 step_index 对应最大 i=14
    assert top[0]["step_index"] == 13


def test_aggregate_steps_empty():
    """空输入 → 全 0 账本。"""
    agg = aggregate_steps([])
    assert agg["total_steps"] == 0
    assert agg["total_cost"] == 0.0
    assert agg["by_tool"] == {}
    assert agg["top_cost_steps"] == []


def test_aggregate_steps_missing_tool_and_non_numeric():
    """缺 tool_name / 非法 cost 字段 → 健壮回落,不抛。"""
    steps = [{"type": "tool", "status": "ok", "cost": "abc"}, {"type": "tool"}]
    agg = aggregate_steps(steps)
    assert agg["total_steps"] == 2
    assert agg["by_tool"].get("(unknown)")["steps"] == 2
    assert agg["total_cost"] == 0.0


# =============================================================================
# aggregate_run
# =============================================================================


def test_aggregate_run(tmp_path: Path):
    """通过 recorder 聚合某 run。"""
    rec = _recorder(tmp_path)
    rec.append_step("r1", _step("read_file", 0.1))
    rec.append_step("r1", _step("write_file", 0.2))
    agg = aggregate_run(rec, "r1")
    assert agg["run_id"] == "r1"
    assert agg["total_steps"] == 2
    assert agg["total_cost"] == 0.3
    assert rec.replay("r1")["total"] == 2  # recorder 行为未被污染


def test_aggregate_run_unknown_run_is_empty(tmp_path: Path):
    """未知 run → 全 0,不报错。"""
    agg = aggregate_run(_recorder(tmp_path), "ghost")
    assert agg["total_steps"] == 0
    assert agg["total_cost"] == 0.0


# =============================================================================
# remaining_against_limit
# =============================================================================


def test_remaining_against_limit_normal(tmp_path: Path):
    """有限额:used 正确,remaining 与 usage_percent 计算正确。"""
    rec = _recorder(tmp_path)
    rec.append_step("r1", _step("read_file", 0.3))
    out = remaining_against_limit(rec, "r1", cost_limit=1.0)
    assert out["used"] == 0.3
    assert out["remaining"] == pytest_appr(0.7)
    assert out["usage_percent"] == pytest_appr(0.3)
    assert out["exhausted"] is False
    assert out["cost_limited"] is True


def test_remaining_exhausted(tmp_path: Path):
    """已用 ≥ 上限 → exhausted True。"""
    rec = _recorder(tmp_path)
    rec.append_step("r1", _step("write_file", 1.0))
    out = remaining_against_limit(rec, "r1", cost_limit=1.0)
    assert out["exhausted"] is True
    assert out["remaining"] == 0.0


def test_remaining_no_limit(tmp_path: Path):
    """cost_limit<=0 → 不视为成本受限,remaining 为 None。"""
    out = remaining_against_limit(_recorder(tmp_path), "r1", cost_limit=0.0)
    assert out["cost_limited"] is False
    assert out["remaining"] is None
    assert out["exhausted"] is False


def test_remaining_uses_already_used_arg(tmp_path: Path):
    """透传 already_used(口径一致的 governor 已用成本)优先于步骤求和。"""
    rec = _recorder(tmp_path)
    rec.append_step("r1", _step("read_file", 0.1))
    out = remaining_against_limit(rec, "r1", cost_limit=1.0, already_used=0.6)
    assert out["used"] == 0.6
    assert out["remaining"] == pytest_appr(0.4)


# 与 pytest.approx 等价的本地辅助(避免 import pytest 依赖)
def pytest_appr(v: float) -> float:
    return float(v)
