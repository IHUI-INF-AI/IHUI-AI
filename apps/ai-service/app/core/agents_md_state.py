# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""AGENTS.md 模型可见状态(2026-09-20 第五十六批,对标 Codex context/world_state/agents_md.rs)。

独立纯函数模块:不 import app.core.agents_md(发现/预算逻辑),仅对标 Codex
的「模型可见 AGENTS.md 片段」渲染与状态机。

Codex 源语义逐字对齐:
- ``REPLACEMENT_NOTICE`` / ``REMOVAL_NOTICE`` 字面值取自
  ``core/src/context/world_state/agents_md.rs``。
- 渲染模板取自 ``core/src/context/user_instructions.rs`` 的
  ``UserInstructions::body()`` + ``ContextualUserFragment::render()``:
  开标记 ``"# AGENTS.md instructions"``,可选目录后缀 ``" for {directory}"``,
  正文用 ``<INSTRUCTIONS>…</INSTRUCTIONS>`` 包裹。
- 状态机(``AgentsMdState``)对标 ``WorldStateSection::render_diff``:
  与上次快照逐字节比较(模仿 app.core.environment_context.EnvironmentStateTracker);
  首次 + 内容 → 普通片段;内容变更 → REPLACEMENT 片段;文件删除(无内容)且先前
  有 → REMOVAL 片段;无变化 / 首次空 → None。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

__all__ = [
    "REPLACEMENT_NOTICE",
    "REMOVAL_NOTICE",
    "AGENTS_MD_OPEN_TAG",
    "AGENTS_MD_BODY_OPEN",
    "AGENTS_MD_BODY_CLOSE",
    "render_agents_md_body",
    "build_agents_md_fragment",
    "build_agents_md_replacement_fragment",
    "build_agents_md_removal_fragment",
    "is_agents_md_fragment",
    "AgentsMdSnapshot",
    "AgentsMdState",
]

# 逐字对齐 codex core/src/context/world_state/agents_md.rs 常量。
REPLACEMENT_NOTICE: str = (
    "These AGENTS.md instructions replace all previously provided AGENTS.md instructions."
)
REMOVAL_NOTICE: str = "The previously provided AGENTS.md instructions no longer apply."

# 开/闭标记(对齐 codex user_instructions.rs 的 type_markers):
# ("# AGENTS.md instructions", "</INSTRUCTIONS>")。
AGENTS_MD_OPEN_TAG = "# AGENTS.md instructions"
AGENTS_MD_BODY_OPEN = "<INSTRUCTIONS>"
AGENTS_MD_BODY_CLOSE = "</INSTRUCTIONS>"


def _normalize_directory(directory: str | None) -> str | None:
    """目录规范化:None / 空串统一视为无目录(渲染时不出 ' for ' 后缀)。"""
    if directory is None:
        return None
    directory = directory.strip()
    return directory or None


def render_agents_md_body(directory: str | None, text: str) -> str:
    """渲染 AGENTS.md 模型可见正文(逐字对齐 codex user_instructions.rs)。

    codex ``UserInstructions::body()`` 产出 ``"{directory}\\n\\n<INSTRUCTIONS>\\n{text}\\n"``,
    其中 ``directory`` = ``" for {dir}"`` 或空;再经 ``render()`` 在头尾拼接
    ``"# AGENTS.md instructions"`` 与 ``"</INSTRUCTIONS>"``。
    """
    suffix = f" for {directory}" if _normalize_directory(directory) else ""
    return (
        f"{AGENTS_MD_OPEN_TAG}{suffix}\n\n"
        f"{AGENTS_MD_BODY_OPEN}\n{text}\n{AGENTS_MD_BODY_CLOSE}"
    )


def build_agents_md_fragment(directory: str | None, text: str) -> dict[str, Any]:
    """普通注入片段(user 角色;正文为纯 AGENTS.md 文本,不含 REPLACEMENT 通知)。

    对齐 environment_context.build_environment_context_fragment 的片段 dict 风格:
    {type: message, role: user, content: [{type: input_text, text: <渲染正文>}]}.
    开标记为 codex 源码的 ``"# AGENTS.md instructions"``(无专属 XML 开标记,故用
    正文首行即该开标记判定,见 is_agents_md_fragment)。
    """
    return {
        "type": "message",
        "role": "user",
        "content": [
            {"type": "input_text", "text": render_agents_md_body(directory, text)}
        ],
    }


def build_agents_md_replacement_fragment(directory: str | None, text: str) -> dict[str, Any]:
    """REPLACEMENT 通知片段:正文 = REPLACEMENT_NOTICE + 双换行 + 原始文本。

    对齐 codex render_diff 的 ``(Some, true)`` 分支:
    ``text: format!("{REPLACEMENT_NOTICE}\\n\\n{}", instructions.text)``。
    """
    notice_text = f"{REPLACEMENT_NOTICE}\n\n{text}"
    return {
        "type": "message",
        "role": "user",
        "content": [
            {"type": "input_text", "text": render_agents_md_body(directory, notice_text)}
        ],
    }


def build_agents_md_removal_fragment() -> dict[str, Any]:
    """REMOVAL 通知片段:目录置空,正文 = REMOVAL_NOTICE。

    对齐 codex render_diff 的 ``(None, true)`` 分支:
    ``UserInstructions { directory: None, text: REMOVAL_NOTICE }``。
    """
    return {
        "type": "message",
        "role": "user",
        "content": [
            {"type": "input_text", "text": render_agents_md_body(None, REMOVAL_NOTICE)}
        ],
    }


def is_agents_md_fragment(text: str) -> bool:
    """判断文本是否 AGENTS.md 片段(供 contextual 归约集/裁剪逻辑使用)。

    开标记为 codex 源码的 ``"# AGENTS.md instructions"``(无专属 XML 标签,用正文
    首行判定)。
    """
    return text.lstrip().startswith(AGENTS_MD_OPEN_TAG)


@dataclass
class AgentsMdSnapshot:
    """持久化模型可见 AGENTS.md 状态(对标 codex AgentsMdSnapshot)。"""

    directory: str | None = None
    text: str | None = None


class AgentsMdState:
    """AGENTS.md 状态机(对标 codex WorldStateSection ID="agents_md")。

    逐字节比较风格(模仿 app.core.environment_context.EnvironmentStateTracker):
    每轮推理前调用 maybe_fragment(directory, text);与上次快照相同返回 None
    (不重复注入),变化/首次/删除按分支产出对应片段。
    """

    # 对标 WorldStateSection::ID。
    ID = "agents_md"

    def __init__(self) -> None:
        self._last: AgentsMdSnapshot | None = None

    def reset(self) -> None:
        """重置记忆(压缩发生后调用:强制下次重注入)。对齐 EnvironmentStateTracker.reset。"""
        self._last = None

    def snapshot(self) -> dict[str, Any]:
        """当前模型可见快照 {directory, text}。"""
        last = self._last or AgentsMdSnapshot()
        return {"directory": last.directory, "text": last.text}

    def _current_snapshot(self, directory: str | None = None, text: str | None = None) -> AgentsMdSnapshot:
        """由 (directory, text) 构造规范化快照:空文本统一为 None(=无指令)。"""
        norm_text = text if text else None
        norm_dir = _normalize_directory(directory)
        # 无文本时目录也无意义(对齐 codex:None 指令不含 directory)。
        if norm_text is None:
            norm_dir = None
        return AgentsMdSnapshot(directory=norm_dir, text=norm_text)

    def maybe_fragment(
        self,
        directory: str | None = None,
        text: str | None = None,
    ) -> dict[str, Any] | None:
        """按状态机产出片段(对齐 codex render_diff + ihui 逐字节比较)。

        分支:
        1. 首次 + 内容            → 普通片段
        2. 与上次相同             → None(无变化)
        3. 内容变更(先前有指令)    → REPLACEMENT 片段
        4. 删除(无内容)且先前有     → REMOVAL 片段
        5. 首次空(无内容)         → None
        """
        current = self._current_snapshot(directory, text)

        # 无变化 → 不注入(codex: Known(previous) if previous == &current → None)。
        if self._last is not None and self._last == current:
            return None

        # 先前是否可能已含指令(codex previous_may_contain_instructions):
        # 本无状态记忆实现仅知自己上一次注入;_last 有 text 即曾注入过指令。
        previous_may_contain = self._last is not None and self._last.text is not None

        self._last = current

        if current.text is not None:
            if previous_may_contain:
                # 变更 → REPLACEMENT 通知。
                return build_agents_md_replacement_fragment(current.directory, current.text)
            # 首次注入 → 普通片段。
            return build_agents_md_fragment(current.directory, current.text)

        # 当前无内容。
        if previous_may_contain:
            # 删除 → REMOVAL 通知。
            return build_agents_md_removal_fragment()
        # 首次空 → None。
        return None
