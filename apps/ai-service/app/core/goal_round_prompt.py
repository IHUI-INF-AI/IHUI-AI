# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""目标续跑提示词(2026-11-14 立,对标 DSH `dsh-goal-round-driver` 的
`renderGoalRoundPrompt`)。

病灶:IHUI 的目标续跑此前把 `req.goal` 原样再发一次。模型看到的是同一句话,
既不知道这是第几轮,也不知道"先前的叙述可能已经过期",更没有被要求在声称完成前
收集证据 —— 于是很容易复述上一轮的说辞,或把"说过了"当成"做完了"。

判据(与 DSH 同语义,收敛成中文单段):
- 目标用 JSON 编码嵌一行,避免目标里的换行/标签破坏段落结构;
- 明示轮次(有上限时 `n/max`,无上限时 `第 n 轮`);
- 事实来源 = 当前工作区 + 工具结果 + 持久会话状态,先核查再行动;
- 完成前必须收证据并读取当前目标后标记完成;仍有工作则保持活动留给下一轮;
- 报阻塞前遵守目标工具策略。

本模块只产出文本,不读状态、不调工具、不依赖运行态。
"""

from __future__ import annotations

import json

GOAL_ROUND_OPEN = "<goal_round>"
GOAL_ROUND_CLOSE = "</goal_round>"


def render_goal_round_prompt(
    objective: str,
    round_number: int,
    max_rounds: int | None = None,
) -> str:
    """渲染同一会话内一轮目标续跑的用户消息。

    @param objective 当前目标原文(会被 JSON 编码成单行)
    @param round_number 本轮序号(从 1 开始)
    @param max_rounds 配置的总轮次上限;None/<=0 表示未配置
    """
    if (
        isinstance(round_number, bool)
        or not isinstance(round_number, int)
        or round_number < 1
    ):
        raise ValueError("round_number 必须是 >= 1 的整数")
    if max_rounds is not None and (
        isinstance(max_rounds, bool)
        or not isinstance(max_rounds, int)
        or max_rounds < 1
    ):
        raise ValueError("max_rounds 必须是 >= 1 的整数或 None")

    round_line = (
        f"轮次:{round_number}/{max_rounds}"
        if max_rounds is not None
        else f"轮次:第 {round_number} 轮"
    )
    encoded = json.dumps(objective, ensure_ascii=False)
    return (
        f"{GOAL_ROUND_OPEN}\n"
        f"目标:{encoded}\n"
        f"{round_line}\n\n"
        "在同一会话内继续推进该目标。以当前工作区、工具结果与持久会话状态为唯一事实来源,"
        "先核查再行动,不要假设先前的叙述仍然成立。做出具体进展并验证结果。\n"
        "在声称完成之前,先收集能证明整个目标已经达成的证据,读取当前目标,再标记完成;"
        "如果仍有剩余工作,保持目标为活动状态,留给下一轮继续。"
        "报告阻塞之前,遵守已配置的目标工具策略。\n"
        f"{GOAL_ROUND_CLOSE}"
    )
