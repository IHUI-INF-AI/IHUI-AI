# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""环境上下文片段(2026-09-19 第四十批,对标 codex context/world_state/environment.rs)。

- EnvironmentsState 渲染语义:cwd / current_date / timezone 以 XML 子元素
  注入 user 角色片段,标记 <environment_context>…</environment_context>;
  可选元素缺省即省略(push_optional_element 语义)。
- 变化检测(对标 record_step_world_state_if_changed):与上次注入的渲染体
  逐字节比较,仅变化时产出新片段——cwd/日期不变则不重复注入,避免每轮
  推理都塞一份环境快照。

设计取舍:
- 片段角色 = user(codex RenderedEnvironments.role);文本以
  <environment_context> 开头,被 stream_events.USER_CONTEXTUAL_PREFIXES
  归约集识别,压缩/解析时不会污染真实用户输入。
- 渲染格式逐行对齐 codex:两空格缩进的 XML 子元素、xml 转义、
  前导换行 + 闭合换行。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from xml.sax.saxutils import escape as _xml_escape

__all__ = [
    "ENVIRONMENT_CONTEXT_OPEN_TAG",
    "ENVIRONMENT_CONTEXT_CLOSE_TAG",
    "build_environment_context_fragment",
    "format_local_date",
    "is_environment_context_fragment",
    "EnvironmentStateTracker",
]

ENVIRONMENT_CONTEXT_OPEN_TAG = "<environment_context>"
ENVIRONMENT_CONTEXT_CLOSE_TAG = "</environment_context>"


def _render_environment_body(cwd: str, current_date: str | None, timezone: str | None) -> str:
    """渲染片段正文(对标 push_environment_values + push_optional_element)。"""
    rendered = "\n"
    rendered += f"  <cwd>{_xml_escape(cwd)}</cwd>\n"
    if current_date:
        rendered += f"  <current_date>{_xml_escape(current_date)}</current_date>\n"
    if timezone:
        rendered += f"  <timezone>{_xml_escape(timezone)}</timezone>\n"
    return rendered


def build_environment_context_fragment(
    cwd: str,
    current_date: str | None = None,
    timezone: str | None = None,
) -> dict[str, Any]:
    """构造环境上下文片段(user 角色、带标记)。"""
    body = _render_environment_body(cwd, current_date, timezone)
    return {
        "type": "message",
        "role": "user",
        "content": [
            {
                "type": "input_text",
                "text": f"{ENVIRONMENT_CONTEXT_OPEN_TAG}{body}{ENVIRONMENT_CONTEXT_CLOSE_TAG}",
            }
        ],
    }


def format_local_date() -> str:
    """本地日期 YYYY-MM-DD(对标 read_clock_for_context("environment_date") 的
    with_timezone(Local).format("%Y-%m-%d") 语义)。"""
    return datetime.now().astimezone().strftime("%Y-%m-%d")


def is_environment_context_fragment(text: str) -> bool:
    """判断文本是否为环境上下文片段(供 contextual 归约集/裁剪逻辑使用)。"""
    return text.lstrip().startswith(ENVIRONMENT_CONTEXT_OPEN_TAG)


class EnvironmentStateTracker:
    """环境状态变化检测器(对标 world_state render_diff 的最小等价实现)。

    用法:每轮需要注入前调用 maybe_fragment(cwd=..., current_date=...);
    与上次渲染体相同则返回 None(不重复注入),变化(含首次)返回新片段。
    """

    def __init__(self) -> None:
        self._last_rendered: str | None = None

    def maybe_fragment(
        self,
        cwd: str,
        current_date: str | None = None,
        timezone: str | None = None,
    ) -> dict[str, Any] | None:
        rendered = _render_environment_body(cwd, current_date, timezone)
        if rendered == self._last_rendered:
            return None
        self._last_rendered = rendered
        return build_environment_context_fragment(cwd, current_date, timezone)
