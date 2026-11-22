# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""推理摘要通道形态封闭集 —— 遵循统一工程规范。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物协议层 agent message 的 ``phase`` 维度三档逐字封闭集
``commentary`` / ``partial_answer`` / ``final_answer``（strings 18 次逐字命中
``commentarypartial_answerfinal_answer``）。这与 ``reasoning_summary_delivery``
（`sequential_cutoff`，本仓 `responses_request_assembly.py` 已对标）是**不同轴**：
delivery 是"摘要怎么随流交付"，phase 是"这条消息在答案形成中的角色"。

管：给定一条 agent message 的语义角色，判定它落进哪个通道形态档；
``phase`` 让消费方（前端渲染 / 审计 / 元学习）能区分"过程旁白、可丢弃" vs
"中间可替换答案" vs "最终答案"，并驱动渲染策略（`commentary` 不触发最终答案
UI 等）。

不管：不产出摘要内容（那是模型职责）；不替换本仓 `stream_events.py` 的散落
``phase == "commentary"`` 判断（本模块是封闭集真相源，可被它引用）；不做
`reasoning_summary_delivery`（已对标）。

超越轴（一轴）：对照把三档散在协议序列化与各渲染分支、靠字符串字面量隐式区分、
无统一封闭集与推进判据；本仓让通道形态成为**显式 StrEnum 封闭集** +
`is_final_answer()` / `advance_phase()` 纯函数判据（final_answer 是终态、
partial_answer 可被 final_answer 替换、commentary 可丢弃），可 diff 可单测可挂审计。
"""

from __future__ import annotations

from enum import StrEnum


class ReasoningChannel(StrEnum):
    """推理摘要通道形态封闭集（对照 agent message ``phase`` 三档）。

    - ``COMMENTARY``：过程旁白 / 进度说明，可丢弃，不进入最终答案。
    - ``PARTIAL_ANSWER``：中间可替换答案（流式过程中模型先给出的不完整答案，
      后续可能被 ``FINAL_ANSWER`` 替换）。
    - ``FINAL_ANSWER``：最终答案（终态，替换任何先前的 ``PARTIAL_ANSWER``）。
    """

    COMMENTARY = "commentary"
    PARTIAL_ANSWER = "partial_answer"
    FINAL_ANSWER = "final_answer"


def is_final_answer(phase: ReasoningChannel | str) -> bool:
    """判定通道形态是否最终答案（纯函数，唯一出口）。

    接受 StrEnum 或裸字符串（防调用方传未包装字面量）；未知字符串返回 False
    （不误判为最终答案）。
    """
    try:
        return ReasoningChannel(phase) is ReasoningChannel.FINAL_ANSWER
    except ValueError:
        return False


def is_discardable(phase: ReasoningChannel | str) -> bool:
    """判定通道形态是否可丢弃（commentary 可丢弃，其余不可）。

    未知字符串按可丢弃处理（保守：不误当答案保留）。
    """
    try:
        return ReasoningChannel(phase) is ReasoningChannel.COMMENTARY
    except ValueError:
        return True


def advance_phase(
    current: ReasoningChannel | str, incoming: ReasoningChannel | str
) -> ReasoningChannel:
    """推进通道形态（final_answer 不可被回退，partial_answer 可被 final 替换）。

    规则：
    - 若 ``current`` 已是 ``FINAL_ANSWER``，恒保持 ``FINAL_ANSWER``（终态不可回退，
      后续任何 incoming 都压不过已定稿的答案）。
    - 否则 ``incoming == FINAL_ANSWER`` ⇒ ``FINAL_ANSWER``（定稿）。
    - 其余情况返回 ``incoming``（commentary → partial_answer 正常推进）。
    未知 incoming 归一化为 ``COMMENTARY``（保守：不误升级）；未知 current 不影响
    上述判定（只认它是否字面等于 FINAL_ANSWER）。
    """
    try:
        cur = ReasoningChannel(current)
    except ValueError:
        cur = None
    if cur is ReasoningChannel.FINAL_ANSWER:
        return ReasoningChannel.FINAL_ANSWER
    try:
        inc = ReasoningChannel(incoming)
    except ValueError:
        return ReasoningChannel.COMMENTARY
    if inc is ReasoningChannel.FINAL_ANSWER:
        return ReasoningChannel.FINAL_ANSWER
    return inc
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
