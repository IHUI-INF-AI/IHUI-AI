# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""轮次预算提示(Qoder 行为对齐,自研实现)。

Qoder 的代理循环有一层 IHUI 此前没有的行为面:**模型自己知道还剩几轮**。
临近预算上限时,它把"还剩 N 轮,请开始收敛"的提示注入当轮上下文,让模型
自行决定先交付什么;真正耗尽时给的是可执行的收尾说明,而不是一个空回复。

IHUI 现状(可核对):``app/core/doom_loop.py`` 的 ``AGENT_MAX_ITERATIONS = 10``
被 ``AgentLoopV2`` 构造器消费;``_run_loop`` 到顶后直接返回
``final_response=""`` + ``stop_reason="max_iterations"``,模型在整个回合里
从未收到任何预算信号(见 ``app/services/agent_loop_v2.py`` 的循环尾返回)。

本模块**只补提示层**:

* 默认预算刻意保持不变 —— ``scripts/check-doom-loop-parity.mjs`` 的
  ``MAX_ITERATION_DIVERGENCE`` 以 ``AGENT_MAX_ITERATIONS`` 为登记基准,
  擅自抬高默认档会把四个站点的 anchor 全部作废(那是产品决策,不是实现细节);
* 部署侧要放宽,走 ``IHUI_AGENT_MAX_ITERATIONS`` 显式开关,缺省零行为差异;
* 进入收尾窗口后注入一次 developer 片段(与 ``current_time_reminder`` 同形);
* 耗尽时的 ``error`` 保留 "达到最大迭代数 N" 原文(既有判据不破),
  后面追加"已完成多少工具调用、下一步怎么续"的可执行说明。
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

__all__ = [
    "AGENT_MAX_ITERATIONS_ENV",
    "BUDGET_NUDGE_CLOSE_TAG",
    "BUDGET_NUDGE_OPEN_TAG",
    "BUDGET_CEILING",
    "BUDGET_FLOOR",
    "WRAPUP_WINDOW_MAX",
    "build_budget_exhausted_error",
    "build_budget_nudge",
    "resolve_turn_budget",
    "should_nudge",
    "wrapup_window",
]

# 部署侧显式放宽预算的开关。缺省不设 ⇒ 一律用调用方给的档(引擎默认 10)。
AGENT_MAX_ITERATIONS_ENV = "IHUI_AGENT_MAX_ITERATIONS"

# 取值域:下界 1(0 轮等于不执行),上界 300(单回合 300 次 LLM 往返已经远超
# 任何正常任务,再高就属于"预算配置写错了",clamp 而不是静默接受)。
BUDGET_FLOOR = 1
BUDGET_CEILING = 300

# 收尾窗口上限(轮)。Qoder 的口径是固定 5 轮;IHUI 引擎默认档只有 10 轮,
# 固定 5 会让一半回合都在"收尾提示"里,故按 1/3 比例封顶 3 轮:
# budget=10 → 3;budget>=9 → 3;budget<=2 → 1。
WRAPUP_WINDOW_MAX = 3

BUDGET_NUDGE_OPEN_TAG = "<budget_reminder>"
BUDGET_NUDGE_CLOSE_TAG = "</budget_reminder>"


def resolve_turn_budget(requested: int) -> int:
    """把调用方给的轮次预算按部署开关归一。

    Args:
        requested: 构造器收到的预算(通常是 ``AGENT_MAX_ITERATIONS``)。

    Returns:
        生效预算。未设 env / env 非法 ⇒ 原样返回 ``requested``(失效方向 = 不放宽);
        env 合法 ⇒ 夹到 ``[BUDGET_FLOOR, BUDGET_CEILING]``。
    """
    try:
        base = max(BUDGET_FLOOR, int(requested))
    except (TypeError, ValueError):
        base = BUDGET_FLOOR

    raw = os.environ.get(AGENT_MAX_ITERATIONS_ENV, "").strip()
    if not raw:
        return base
    try:
        resolved = int(raw)
    except ValueError:
        logger.warning(
            "%s=%r 不是整数,忽略并沿用 %d(配置写错不放宽预算)",
            AGENT_MAX_ITERATIONS_ENV,
            raw,
            base,
        )
        return base
    resolved = max(BUDGET_FLOOR, min(BUDGET_CEILING, resolved))
    if resolved != base:
        logger.info(
            "轮次预算按 %s 调整: %d → %d",
            AGENT_MAX_ITERATIONS_ENV,
            base,
            resolved,
        )
    return resolved


def wrapup_window(budget: int) -> int:
    """收尾窗口长度(最后几轮注入提示),至少 1、至多 ``WRAPUP_WINDOW_MAX``。"""
    safe = max(BUDGET_FLOOR, int(budget))
    return max(1, min(WRAPUP_WINDOW_MAX, safe // 3))


def should_nudge(iteration: int, budget: int) -> bool:
    """当前轮(1 起算)是否已进入收尾窗口。"""
    remaining = max(BUDGET_FLOOR, int(budget)) - int(iteration) + 1
    return remaining <= wrapup_window(budget)


def build_budget_nudge(iteration: int, budget: int) -> dict[str, Any]:
    """构造收尾提示片段(developer 角色,与 ``current_time_reminder`` 同形)。

    刻意只陈述事实 + 给收敛指令,不替模型做取舍:先交付什么由它按当前进度决定。
    """
    safe_budget = max(BUDGET_FLOOR, int(budget))
    remaining = max(1, safe_budget - int(iteration) + 1)
    body = (
        f"本回合轮次预算共 {safe_budget} 轮,当前第 {iteration} 轮,"
        f"剩余 {remaining} 轮(含本轮)。\n"
        "从现在起请收敛:\n"
        "1. 优先完成并验证已经在手的改动,不要开启新的探索方向;\n"
        "2. 每一轮都要留下可交付的中间结果(结论、文件、命令输出);\n"
        "3. 预算耗尽时不会再调用工具,最后一轮必须给出面向用户的最终答复与未完成项。"
    )
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": f"{BUDGET_NUDGE_OPEN_TAG}\n{body}\n{BUDGET_NUDGE_CLOSE_TAG}",
            }
        ],
    }


def build_budget_exhausted_error(budget: int, tool_calls: int) -> str:
    """轮次耗尽时的 error 文案。

    判据兼容:既有用例断言 ``"达到最大迭代数 N" in result.error``,所以原文保留在
    最前面;新增的只是"已经做了什么 + 怎么续",不是把空回复包装成成功。
    """
    safe_budget = max(BUDGET_FLOOR, int(budget))
    calls = max(0, int(tool_calls))
    return (
        f"达到最大迭代数 {safe_budget}(轮次预算耗尽):本轮已完成 {calls} 次工具调用,"
        "未产出最终答复。可继续该任务以追加预算,或凭 checkpoint 续跑。"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
