# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""子代理派生的工具面与回传预算。

允许/禁止名单的语义（对照外部产品的智能体配置，本仓按更严的一档落地）：

- 禁止列表与父线程已有的负向名单取并集，子代理不能把父级禁掉的工具放回来。
- 调用方给出非空允许列表时，它是硬边界：只能调用其中的名字，并且不能超出父线程白名单。
- 允许列表省略或为空：不额外收窄，沿用父线程白名单；父线程也没有白名单时保持默认权限。
- 同一名字同时出现在允许与禁止中，禁止优先。
- 回传给父轮次的正文按既有接力摘要预算截断。超长全文不进父上下文，只留在调用方持有的侧账里。
"""

from __future__ import annotations

from typing import Final

_SUBAGENT_TRANSCRIPT_KEEP: Final = 32


class SubagentToolListError(ValueError):
    """允许/禁止名单不是字符串数组。field 是入参名，供调用方原样回给模型。"""

    def __init__(self, field: str) -> None:
        self.field = field
        super().__init__(field)


def parse_optional_tool_list(raw: object, field: str) -> list[str] | None:
    """省略 → None。空数组 → []。非法形态抛 SubagentToolListError，不猜。"""
    if raw is None:
        return None
    if not isinstance(raw, list):
        raise SubagentToolListError(field)
    names: list[str] = []
    for item in raw:
        if not isinstance(item, str) or not item.strip():
            raise SubagentToolListError(field)
        names.append(item.strip())
    return list(dict.fromkeys(names))


def resolve_subagent_tool_surface(
    parent_allow: list[str] | None,
    parent_deny: list[str],
    call_allow: list[str] | None,
    call_deny: list[str] | None,
) -> tuple[list[str] | None, list[str]]:
    """返回 (子代理白名单或 None, 子代理禁止名单)。

    None 白名单 = 不额外收窄（默认权限减去禁止名单）。
    空列表白名单 = 一个工具都不许调用。
    """
    deny = list(dict.fromkeys([*parent_deny, *(call_deny or [])]))
    denied = set(deny)
    if call_allow:
        base = call_allow
        if parent_allow is not None:
            parent_set = set(parent_allow)
            base = [name for name in call_allow if name in parent_set]
        allow = [name for name in dict.fromkeys(base) if name not in denied]
        return allow, deny
    if parent_allow is not None:
        allow = [name for name in parent_allow if name not in denied]
        return allow, deny
    return None, deny


def parent_visible_subagent_response(full: str, *, limit: int) -> tuple[str, bool]:
    """父轮次可见正文。未超预算时原样返回且 truncated=False。"""
    text = full if isinstance(full, str) else ""
    cap = limit if isinstance(limit, int) and limit > 0 else 0
    if len(text) <= cap:
        return text, False
    return text[:cap], True


def remember_subagent_transcript(
    store: dict[str, str],
    order: list[str],
    thread_id: str,
    text: str,
    *,
    keep: int = _SUBAGENT_TRANSCRIPT_KEEP,
) -> None:
    """侧账保留超长全文。超过 keep 条时丢掉最早的一条。"""
    if thread_id in store:
        with_removed = [item for item in order if item != thread_id]
        order.clear()
        order.extend(with_removed)
    store[thread_id] = text
    order.append(thread_id)
    limit = keep if keep > 0 else 1
    while len(order) > limit:
        oldest = order.pop(0)
        store.pop(oldest, None)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
