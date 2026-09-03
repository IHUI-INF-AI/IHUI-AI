# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""step 成本核算模型 — 为已录制的运行步骤提供成本聚合与剩余额度评估(2026-09-03 立)。

对标 Claude Code / Codex 的成本审计:把 AgentStepRecorder 录制的 step
(含 tokens_in / tokens_out / cost)聚合成结构化成本账本,并配合预算门控
判断"还能执行多少"。与 tool_budget_governor 互补:
- governor 做执行前的配额门控(提前扣)
- 本模块做执行后的成本聚合 + 剩余额度估算(事后审计 / 回填预算判断)

纯函数、无副作用,默认不接入任何执行器;既是 Router 可复用的查询层,也是
AgentStepRecorder 数据的只读视图,不修改录制侧行为。
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

from .agent_step_recorder import AgentStepRecorder

logger = logging.getLogger(__name__)


def _num(value: Any, default: float = 0.0) -> float:
    """安全转 float,失败回退默认值(与 recorder 同源策略)。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def aggregate_steps(steps: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """把一组 step dict 聚合成成本账本。

    返回:
        total_steps / total_tokens / total_tokens_in / total_tokens_out / total_cost
        by_tool    : {tool_name: {"steps": n, "cost": c, "tokens": t, "tokens_in", "tokens_out"}}
        by_status  : {status: {"steps": n, "cost": c}}
        top_cost_steps: 按 cost 降序取前 10 步(step_index/tool_name/cost)
    """
    steps = list(steps)
    total_steps = len(steps)
    total_tokens = total_in = total_out = 0
    total_cost = 0.0
    by_tool: dict[str, dict[str, Any]] = {}
    by_status: dict[str, dict[str, Any]] = {}

    for s in steps:
        tool = str(s.get("tool_name") or "(unknown)")
        status = str(s.get("status") or "ok")
        cost = _num(s.get("cost"))
        tok = int(_num(s.get("tokens")))
        tin = int(_num(s.get("tokens_in")))
        tout = int(_num(s.get("tokens_out")))

        total_tokens += tok
        total_in += tin
        total_out += tout
        total_cost += cost

        tb = by_tool.setdefault(
            tool,
            {"steps": 0, "cost": 0.0, "tokens": 0, "tokens_in": 0, "tokens_out": 0},
        )
        tb["steps"] += 1
        tb["cost"] = round(tb["cost"] + cost, 6)
        tb["tokens"] += tok
        tb["tokens_in"] += tin
        tb["tokens_out"] += tout

        sb = by_status.setdefault(status, {"steps": 0, "cost": 0.0})
        sb["steps"] += 1
        sb["cost"] = round(sb["cost"] + cost, 6)

    top_steps = sorted(
        (s for s in steps if _num(s.get("cost")) > 0),
        key=lambda s: _num(s.get("cost")),
        reverse=True,
    )[:10]
    return {
        "total_steps": total_steps,
        "total_tokens": total_tokens,
        "total_tokens_in": total_in,
        "total_tokens_out": total_out,
        "total_cost": round(total_cost, 6),
        "by_tool": by_tool,
        "by_status": by_status,
        "top_cost_steps": [
            {
                "step_index": s.get("step_index"),
                "tool_name": s.get("tool_name"),
                "cost": round(_num(s.get("cost")), 6),
            }
            for s in top_steps
        ],
    }


def aggregate_run(
    recorder: AgentStepRecorder,
    run_id: str,
) -> dict[str, Any]:
    """聚合某运行的全部已录制步骤。空运行返回全 0 账本。"""
    replay = recorder.replay(run_id)
    steps: list[dict[str, Any]] = replay.get("steps") or []
    agg = aggregate_steps(steps)
    agg["run_id"] = run_id
    return agg


def remaining_against_limit(
    recorder: AgentStepRecorder,
    run_id: str,
    cost_limit: float = 0.0,
    *,
    already_used: float | None = None,
) -> dict[str, Any]:
    """根据已用成本估算剩余额度(配合预算门控判断还能执行多少)。

    Args:
        recorder: 已录制该 run 步骤的记录器
        run_id: 目标运行 id
        cost_limit: 成本上限($,<=0 视为未设上限)
        already_used: 若调用方已从 governor 取得口径一致的已用成本则透传,
                      否则从 recorder 步骤求和。

    返回:
        limit / used / remaining / usage_percent / exhausted 布尔
    """
    agg = aggregate_run(recorder, run_id)
    used = already_used if already_used is not None else float(agg["total_cost"])
    used = max(0.0, float(used))
    if cost_limit is None or cost_limit <= 0:
        return {
            "run_id": run_id,
            "limit": 0.0,
            "used": round(used, 6),
            "remaining": None,
            "usage_percent": None,
            "exhausted": False,
            "cost_limited": False,
        }
    remaining = max(0.0, float(cost_limit) - used)
    usage_percent = min(1.0, used / float(cost_limit)) if cost_limit > 0 else 1.0
    return {
        "run_id": run_id,
        "limit": round(float(cost_limit), 6),
        "used": round(used, 6),
        "remaining": round(remaining, 6),
        "usage_percent": round(usage_percent, 4),
        "exhausted": float(cost_limit) > 0 and used >= float(cost_limit),
        "cost_limited": True,
    }
