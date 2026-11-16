# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""溢出保留策略 — 复现 DeepSeek dsh-spill-policy/retention。

取证来源
--------
``.ihui-agent/tmp/dsh-src/dsh-spill-policy/src/retention.ts``（完整直读）::

    retainContent(content, budget, price):
      头尾各分一半预算; 从头/尾连续取块, 价格 ≤ 剩余才整块保留;
      文本块超剩余 → fitText 二分找最大可保留端（价格单调）;
      图片块不可分割 → 整块保留或整块溢出（未用空间不挪给别处）;
      last==first 同一块时尾部从 headCharacters 之后切（防重复计入）;
      返回 head/tail + omittedBytes(UTF-8) + omittedImages。
    textSlice: tail 切时若落在 UTF-16 代理对中间, 修正 1 位防劈开。

对照 IHUI 缺口
--------------
``tool_output_artifacts`` 只有磁盘截断标记（truncatedOnDisk）, 无
"头尾保留 + 图片不可分割 + 二分适配预算 + 代理对保护"的溢出保留纯算法。
本模块补齐（价格函数作参数注入, 与具体 tokenizer 解耦）。

设计要点（纯函数, 零 IO）
------------------------
1. ``text_slice``: 按码点安全切（Python str 已按码点, 无代理对, 但保留语义对齐）;
2. ``fit_text``: 二分找最大可保留端（价格单调假设）;
3. ``retain_content``: 头尾各半预算 + 图片不可分割 + 溢出统计。

与既有层关系
--------------
- ``tool_output_artifacts``: 工件落盘 + 续读（持久化）; 本模块管溢出时的保留策略;
- ``tool_result_pruner``: 头/中/尾裁剪（marker 占位）; 本模块: 头尾保留 + 溢出统计
  （不同面 —— pruner 用于压缩进上下文, retention 用于溢出时给预览）。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class RetainableBlock:
    """可保留内容块（text 可切; image 不可分割）。"""

    type: str  # 'text' | 'image'
    text: str | None = None


@dataclass(frozen=True)
class RetainedContent:
    """保留结果: 头尾 + 溢出统计。"""

    head: tuple[RetainableBlock, ...]
    tail: tuple[RetainableBlock, ...]
    omitted_bytes: int  # 溢出的 UTF-8 字节数
    omitted_images: int  # 整块溢出的图片数


def _utf8_len(text: str) -> int:
    return len(text.encode("utf-8"))


def _bytes_of(blocks: tuple[RetainableBlock, ...]) -> int:
    return sum(_utf8_len(b.text) for b in blocks if b.type == "text" and b.text is not None)


def _images_of(blocks: tuple[RetainableBlock, ...]) -> int:
    return sum(1 for b in blocks if b.type == "image")


def text_slice(text: str, length: int, *, tail: bool) -> str:
    """按 length 切（tail=True 取尾段），保护码点边界（纯函数）。

    Python str 按码点索引, 不像 JS 有 UTF-16 代理对; 这里保留 DSH 的
    "不劈开字符"语义 —— length 夹到 [0, len(text)]。
    """
    if tail:
        cut = max(0, min(len(text), len(text) - length))
        return text[cut:]
    cut = max(0, min(len(text), length))
    return text[:cut]


def fit_text(
    text: str,
    budget: int,
    *,
    tail: bool,
    price: Callable[[RetainableBlock], int],
) -> str:
    """二分找价格 ≤ budget 的最大可保留端（价格须对保留长度单调, 纯函数）。"""
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        candidate = text_slice(text, middle, tail=tail)
        if len(candidate) == 0 or price(RetainableBlock("text", candidate)) <= budget:
            low = middle
        else:
            high = middle - 1
    return text_slice(text, low, tail=tail)


def retain_content(
    content: list[RetainableBlock],
    budget: int,
    price: Callable[[RetainableBlock], int],
) -> RetainedContent:
    """头尾保留: 文本可切、图片不可分割（纯函数）。

    头尾各分一半预算; 连续取块, 价格 ≤ 剩余才整块保留; 文本超剩余则二分适配;
    图片超剩余则停止该端（未用空间不挪给别处）。price 为单块模型成本（含框架）。
    """
    head: list[RetainableBlock] = []
    tail: list[RetainableBlock] = []
    first, last = 0, len(content) - 1
    head_characters = 0

    # 头端: ceil(budget/2)
    remaining = (budget + 1) // 2
    while first <= last:
        block = content[first]
        cost = price(block)
        if cost <= remaining:
            head.append(block)
            remaining -= cost
            first += 1
            continue
        if block.type == "text" and block.text is not None:
            text = fit_text(block.text, remaining, tail=False, price=price)
            head_characters = len(text)
            if len(text) > 0:
                head.append(RetainableBlock("text", text))
        break

    # 尾端: floor(budget/2)
    remaining = budget // 2
    while last >= first:
        original = content[last]
        # 同一块被头端切过 → 尾端从 head_characters 之后取, 防重复计入
        if last == first and original.type == "text" and original.text is not None:
            block = RetainableBlock("text", original.text[head_characters:])
        else:
            block = original
        cost = price(block)
        if cost <= remaining:
            tail.append(block)
            remaining -= cost
            last -= 1
            continue
        if block.type == "text" and block.text is not None:
            text = fit_text(block.text, remaining, tail=True, price=price)
            if len(text) > 0:
                tail.append(RetainableBlock("text", text))
        break

    tail.reverse()
    all_blocks = tuple(content)
    head_t = tuple(head)
    tail_t = tuple(tail)
    return RetainedContent(
        head=head_t,
        tail=tail_t,
        omitted_bytes=_bytes_of(all_blocks) - _bytes_of(head_t) - _bytes_of(tail_t),
        omitted_images=_images_of(all_blocks) - _images_of(head_t) - _images_of(tail_t),
    )


__all__ = [
    "RetainableBlock",
    "RetainedContent",
    "text_slice",
    "fit_text",
    "retain_content",
]
