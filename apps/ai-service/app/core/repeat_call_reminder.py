# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""重复工具调用的分级 advisory(对标 DeepSeek Harness 的 3/5/8 三档提醒;只提醒不否决)。

病灶:`DoomLoopSentinel.observe_calls` 一旦命中阈值就只有**一档**文案 —— 第 3 次和被锁死
到第 8 次说的话一模一样,模型没有"越来越严重"的信号,运维也看不出它现在是"刚踩线"还是
"已经该人工介入"。

治理原则:
  - **三档只改措辞强度,不改任何动作**:``actions`` 仍完全由 ``plan_doom_alert_response``
    决定(``reflecting`` / ``skip_tool_execution`` 等既有语义零变化) —— advisory 不是闸门,
    不新增否决点;
  - **notice 档逐字复刻旧文案**:第 3 次看到的字符串与改动前完全相同,既有断言与模型
    观感零差异;
  - **零缺省**:低于 notice 阈值一律返回 ``None``,调用方据此**不追加任何文本**;
  - **阈值单源**:``ADVISORY_NOTICE_REPEATS`` 与 ``doom_loop.DOOM_LOOP_REPEAT_THRESHOLD``
    必须等值,由 pytest 钉住(两份字面量一旦漂开即红,而不是靠口头"记得同步")。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final

#: 既有解析器认这个前缀(``test_doom_loop`` 只断言包含它),三档一律保留。
DOOM_LOOP_ALERT_PREFIX: Final = "[DOOM_LOOP_ALERT]"

#: 与 ``doom_loop.DOOM_LOOP_REPEAT_THRESHOLD`` 等值(pytest 断言)。
ADVISORY_NOTICE_REPEATS: Final = 3
ADVISORY_WARNING_REPEATS: Final = 5
ADVISORY_CRITICAL_REPEATS: Final = 8

LEVEL_NOTICE: Final = "notice"
LEVEL_WARNING: Final = "warning"
LEVEL_CRITICAL: Final = "critical"
ADVISORY_LEVELS: Final = (LEVEL_NOTICE, LEVEL_WARNING, LEVEL_CRITICAL)


@dataclass(frozen=True)
class RepeatAdvisory:
    """一次重复调用的分级结果(纯数据,无副作用)。"""

    level: str
    repeat_count: int


def advisory_level(repeat_count: Any) -> str | None:
    """按 3/5/8 分档;``bool`` / 非整数 / 低于 notice 阈值 ⇒ ``None``(不提醒)。"""
    if isinstance(repeat_count, bool) or not isinstance(repeat_count, int):
        return None
    if repeat_count < ADVISORY_NOTICE_REPEATS:
        return None
    if repeat_count >= ADVISORY_CRITICAL_REPEATS:
        return LEVEL_CRITICAL
    if repeat_count >= ADVISORY_WARNING_REPEATS:
        return LEVEL_WARNING
    return LEVEL_NOTICE


def classify_repeat_call(tool_name: str, repeat_count: Any) -> RepeatAdvisory | None:
    """判据入口:不提醒时返回 ``None``,提醒时返回带档位的纯数据。"""
    level = advisory_level(repeat_count)
    if level is None:
        return None
    name = str(tool_name or "")
    if name == "":
        return None
    return RepeatAdvisory(level=level, repeat_count=int(repeat_count))


def build_repeat_reminder(tool_name: str, repeat_count: Any) -> str | None:
    """三档文案;notice 档与历史文案**逐字**相同(零观感变化)。"""
    advisory = classify_repeat_call(tool_name, repeat_count)
    if advisory is None:
        return None
    name = str(tool_name)
    count = advisory.repeat_count
    if advisory.level == LEVEL_NOTICE:
        return (
            f"{DOOM_LOOP_ALERT_PREFIX} 工具 {name} 已连续 {count} 次"
            f"以完全相同参数被调用,可能陷入死循环。"
            f"请检查工具返回值,或换用其他工具/方法。"
        )
    if advisory.level == LEVEL_WARNING:
        return (
            f"{DOOM_LOOP_ALERT_PREFIX} 工具 {name} 已连续 {count} 次"
            f"以完全相同参数被调用(警告)。请立刻改变执行路径:"
            f"换参数、换工具,或先读上一次结果再决定下一步。"
        )
    return (
        f"{DOOM_LOOP_ALERT_PREFIX} 工具 {name} 已连续 {count} 次"
        f"以完全相同参数被调用(严重)。若下一次调用仍无变化,"
        f"本循环将按既有策略自行终止,请先说明你卡在哪一步。"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
