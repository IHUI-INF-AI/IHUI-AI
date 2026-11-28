# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 人格与工具面（P3-07）。

`master.md` 是唯一真源；本模块只负责读取和暴露常量，不在代码里复制第二份提示词。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Final

MASTER_AGENT_NAME: Final = "master"
MASTER_DISPLAY_NAME: Final = "总管"
MASTER_DISPLAY_NAME_MAX: Final = 24
MASTER_TOOL_NAMES: Final = ("agent_registry", "agent_ops", "master_memory")
MASTER_PROMPT_PATH: Final = Path(__file__).with_name("master.md")
_MASTER_DISPLAY_NAME_RE: Final = re.compile(r"^[\u4e00-\u9fffA-Za-z0-9_·\- ]+$")


def normalize_master_display_name(value: str | None) -> str:
    """只接受可安全拼进 system prompt 的显示名；非法值回退默认名。"""
    name = (value or "").strip()
    if not name:
        return MASTER_DISPLAY_NAME
    if len(name) > MASTER_DISPLAY_NAME_MAX or not _MASTER_DISPLAY_NAME_RE.fullmatch(name):
        return MASTER_DISPLAY_NAME
    return name


def build_master_system_prompt(display_name: str | None = None) -> str:
    """固定人格 + 可选显示名。

    显示名只影响自称与界面，不改变工具边界、审批纪律或任何安全规则。
    """
    name = normalize_master_display_name(display_name)
    if name == MASTER_DISPLAY_NAME:
        return MASTER_SYSTEM_PROMPT
    return (
        f"{MASTER_SYSTEM_PROMPT}\n\n"
        "## 你的显示名\n\n"
        f"用户在界面给你起的名字是「{name}」。自称时用这个名字；"
        "这个名字只影响称呼，不改变以上任何规则、工具边界或审批纪律。"
    )


def load_master_prompt() -> str:
    return MASTER_PROMPT_PATH.read_text(encoding="utf-8").strip()


MASTER_SYSTEM_PROMPT: Final = load_master_prompt()
