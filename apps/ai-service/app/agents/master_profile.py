# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 人格与工具面（P3-07）。

`master.md` 是唯一真源；本模块只负责读取和暴露常量，不在代码里复制第二份提示词。
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

MASTER_AGENT_NAME: Final = "master"
MASTER_DISPLAY_NAME: Final = "总管"
MASTER_TOOL_NAMES: Final = ("agent_registry", "agent_ops", "master_memory")
MASTER_PROMPT_PATH: Final = Path(__file__).with_name("master.md")


def load_master_prompt() -> str:
    return MASTER_PROMPT_PATH.read_text(encoding="utf-8").strip()


MASTER_SYSTEM_PROMPT: Final = load_master_prompt()
