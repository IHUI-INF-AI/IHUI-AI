# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合前上下文自检(P0-7,2026-11-27 立)。

## 立因:不是"对照件有所以我们也加"

多轮工具调用里,模型下一轮的推理完全建立在上一轮的 tool 消息内容上。而这条链路有三处会
**静默**把内容变成空或不完整,且都不报错:

  1. 工具结果被有界环截断 —— `app/services/output_ring.py` 的 `DROPPED_MARKER_TEMPLATE`
     会在正文中间塞一行 `...[中间丢弃 N 字符]...`,读起来"有内容",实际缺了中段;
  2. 工具返回空串 —— handler 异常被吞、超时后没拿到尾巴、或上游给了个 `content=""`,
     消息还在,内容是空;
  3. `truncated: True` 但 `dropped_bytes>0` 且 `content` 为空 —— 帧级预算丢掉了整行。

三种情况下模型都不会收到任何提示,它只会基于"看起来正常"的残缺上下文继续推理。
**自检的职责就是在回合开始前把这三型挑出来明说**,而不是让模型自己发现。

## 三态语义(对齐 drain 四态的"不假装完整")

- `ok` —— 没发现残缺;
- `anchor_missing` —— 有本该承载内容的消息**几乎为空**(模型无法据此推理);
- `re_read_required` —— 内容还在但**明知不完整**(带丢弃标记 / `truncated=True`),
  调用方应重读原文而不是接着用。

优先级:`anchor_missing` > `re_read_required` > `ok` —— "完全没内容"比"内容不全"更严重,
两者同时出现时报更严重的那个。

## 这是纯判据

不读盘、不起进程、不改 messages。给定 messages 列表返回一份报告,可独立单测。
真正的"重读"动作由调用方决定(本模块只负责判定与点名,不替调用方做重活)。
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

#: 与 `app/services/output_ring.py::DROPPED_MARKER_TEMPLATE` 同形的丢弃标记。
#: 两处必须能互相认出来:环写了什么标记,自检就得认出什么标记。
_DROPPED_MARKER_RE = re.compile(r"中间丢弃\s+(\d+)\s*字符")

#: content 短于这个长度(去空白后)就当作"几乎为空"。
#: 不用 `== ""`:有些 handler 返回单个换行或一个空格,那同样不承载任何信息。
_EMPTY_EFFECTIVE_CHARS = 3

STATUS_OK = "ok"
STATUS_ANCHOR_MISSING = "anchor_missing"
STATUS_RE_READ_REQUIRED = "re_read_required"

_SEVERITY = {
    STATUS_OK: 0,
    STATUS_RE_READ_REQUIRED: 1,
    STATUS_ANCHOR_MISSING: 2,
}


@dataclass(frozen=True)
class ContextFinding:
    """一条自检发现。`index` 是它在 messages 里的下标,`reason` 是给人看的一句话。"""

    index: int
    status: str
    reason: str


@dataclass(frozen=True)
class SelfCheckReport:
    """一次回合前自检的结论。

    `status` 是三态里**最严重**的那个(`ok` / `re_read_required` / `anchor_missing`);
    `findings` 逐条点名,调用方据此决定"哪几条要重读"。
    """

    status: str
    findings: tuple[ContextFinding, ...] = field(default_factory=tuple)

    def is_clean(self) -> bool:
        """是否无需任何补救动作。"""
        return self.status == STATUS_OK

    def needs_reread(self) -> bool:
        """是否有条目需要重读(含"完全缺失"与"明知不全"两型)。"""
        return self.status != STATUS_OK

    def missing_indices(self) -> tuple[int, ...]:
        """`anchor_missing` 型的下标(内容几乎为空,必须重新取)。"""
        return tuple(f.index for f in self.findings if f.status == STATUS_ANCHOR_MISSING)

    def reread_indices(self) -> tuple[int, ...]:
        """`re_read_required` 型的下标(内容不全,建议重读)。"""
        return tuple(f.index for f in self.findings if f.status == STATUS_RE_READ_REQUIRED)

    def to_dict(self) -> dict[str, Any]:
        """机读形状(写日志/事件时用,避免把 dataclass 直接塞进 JSON)。"""
        return {
            "status": self.status,
            "findings": [
                {"index": f.index, "status": f.status, "reason": f.reason}
                for f in self.findings
            ],
        }


def _effective_len(text: str) -> int:
    return len(text.strip())


def _is_tool_message(message: Mapping[str, Any]) -> bool:
    role = str(message.get("role") or "").lower()
    return role in ("tool", "function")


def check_context(messages: Sequence[Mapping[str, Any]] | None) -> SelfCheckReport:
    """回合前自检:挑出"内容几乎为空"与"明知不完整"的工具消息。

    只看 `tool` / `function` 角色的消息 —— `user` 消息短是正常的(用户就发了两个字),
    对它判"空"会制造大量假红;而工具结果空就是真的没有内容可依据。

    不抛异常:入参不是序列、元素不是映射、字段类型不对,一律当"没这条"跳过 ——
    自检本身失败不该把主循环打断(自检是观测面,不是执行面)。
    """
    if not isinstance(messages, Sequence) or isinstance(messages, (str, bytes)):
        return SelfCheckReport(status=STATUS_OK)

    findings: list[ContextFinding] = []
    for index, raw in enumerate(messages):
        if not isinstance(raw, Mapping):
            continue
        if not _is_tool_message(raw):
            continue
        content = raw.get("content")
        text = content if isinstance(content, str) else ""

        if _effective_len(text) < _EMPTY_EFFECTIVE_CHARS:
            # 空/近空:若还带着"截断"标记,说明是截断把内容吃掉了,仍是完全缺失。
            findings.append(
                ContextFinding(
                    index=index,
                    status=STATUS_ANCHOR_MISSING,
                    reason=f"工具消息内容几乎为空(有效字符 {_effective_len(text)} 个)",
                )
            )
            continue

        dropped = _DROPPED_MARKER_RE.search(text)
        if dropped is not None and int(dropped.group(1)) > 0:
            findings.append(
                ContextFinding(
                    index=index,
                    status=STATUS_RE_READ_REQUIRED,
                    reason=f"内容带丢弃标记(缺 {dropped.group(1)} 字符),须重读",
                )
            )
            continue

        if raw.get("truncated") is True:
            dropped_bytes = raw.get("dropped_bytes")
            detail = (
                f",丢 {dropped_bytes} 字节"
                if isinstance(dropped_bytes, int) and dropped_bytes > 0
                else ""
            )
            findings.append(
                ContextFinding(
                    index=index,
                    status=STATUS_RE_READ_REQUIRED,
                    reason=f"消息标记 truncated=True{detail},须重读",
                )
            )

    if not findings:
        return SelfCheckReport(status=STATUS_OK)

    worst = max((f.status for f in findings), key=lambda s: _SEVERITY.get(s, 0))
    return SelfCheckReport(status=worst, findings=tuple(findings))


def merge_status(*statuses: str) -> str:
    """把多个状态合成最严重的一个(供调用方汇总多段上下文时用)。"""
    worst = STATUS_OK
    for status in statuses:
        if _SEVERITY.get(status, 0) > _SEVERITY.get(worst, 0):
            worst = status
    return worst


__all__ = [
    "ContextFinding",
    "SelfCheckReport",
    "STATUS_ANCHOR_MISSING",
    "STATUS_OK",
    "STATUS_RE_READ_REQUIRED",
    "check_context",
    "merge_status",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
