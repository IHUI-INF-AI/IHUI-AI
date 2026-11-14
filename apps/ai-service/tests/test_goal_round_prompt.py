# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""目标续跑提示词契约(2026-11-14 立,对标 DSH renderGoalRoundPrompt)。

判据:
① 段落有稳定开闭标签,轮次/目标各占一行,目标里的换行不会破坏结构;
② 无上限与有上限两种轮次写法都覆盖;
③ 四条纪律必须在:事实来源、先核查再行动、完成前收证据、仍有工作保持活动;
④ 非法轮次参数直接抛错(续跑提示词不能靠猜轮次);
⑤ 接线锁:agents.py 的 goal 续跑必须调用渲染函数,且不再原样复读 req.goal。
"""

from __future__ import annotations

import pathlib

import pytest

from app.core.goal_round_prompt import (
    GOAL_ROUND_CLOSE,
    GOAL_ROUND_OPEN,
    render_goal_round_prompt,
)


def test_prompt_shape_and_single_line_objective():
    prompt = render_goal_round_prompt("把季度报告\nexport 成 PDF", 3)
    lines = prompt.splitlines()
    assert lines[0] == GOAL_ROUND_OPEN
    assert lines[-1] == GOAL_ROUND_CLOSE
    # 目标 JSON 编码成一行,内嵌换行被转义,不新增结构行
    assert lines[1] == '目标:"把季度报告\\nexport 成 PDF"'
    assert lines[2] == "轮次:第 3 轮"
    assert len(lines) == 3 + 1 + 3  # 开标签/目标/轮次/空行/两段正文/闭标签


def test_prompt_with_round_limit():
    prompt = render_goal_round_prompt("完成迁移", 2, max_rounds=8)
    assert "轮次:2/8" in prompt
    assert GOAL_ROUND_OPEN in prompt and GOAL_ROUND_CLOSE in prompt


def test_prompt_keeps_evidence_and_continuation_rules():
    prompt = render_goal_round_prompt("发布 v1", 1)
    for fragment in (
        "唯一事实来源",
        "先核查再行动",
        "收集能证明整个目标已经达成的证据",
        "保持目标为活动状态",
        "遵守已配置的目标工具策略",
    ):
        assert fragment in prompt, fragment


@pytest.mark.parametrize("round_number", [0, -1, 1.5, True])
def test_invalid_round_number_raises(round_number):
    with pytest.raises(ValueError):
        render_goal_round_prompt("x", round_number)  # type: ignore[arg-type]


def test_invalid_max_rounds_raises():
    with pytest.raises(ValueError):
        render_goal_round_prompt("x", 1, max_rounds=0)


def test_goal_rerun_uses_rendered_prompt():
    src = pathlib.Path(__file__).resolve().parents[1].joinpath(
        "app", "routers", "agents.py"
    ).read_text(encoding="utf-8")
    # 续跑点必须调用渲染函数并带上账本轮次;不得在这里直接复读 req.goal
    assert "render_goal_round_prompt(" in src
    assert "req.goal, _round_no" in src
