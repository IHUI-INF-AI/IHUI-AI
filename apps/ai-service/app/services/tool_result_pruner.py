# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具结果确定性裁剪。

设计依据
--------
按行为规格::

    measureContent(blocks): 非 text block 计 0; text block 累加 Unicode code
      point 数（不是 UTF-16 code unit, 故保留边界不劈开代理对; grapheme 簇仍可能劈）。
    pruneContent(blocks): totalChars <= thresholdChars 返回 null（不裁）;
      否则保留 headChars 头 + tailChars 尾, 中段用一个 PRUNE_MARKER 占位;
      marker 只插入一次（首个与被移除区相交的 text block）; 富块顺序保留;
      裁后必须更小且 ≤ threshold, 否则抛错。
    pruneSession: 对当前 surface 上每个超预算 tool/result 落一次
      compaction/prune 影价事件 + tool/result replace, 便于纯消费方减账。

对照 IHUI 缺口
--------------
``compact_with_llm`` 是 **LLM 摘要式**压缩（选 head 段做语义摘要, 花模型调用）;
无 **确定性、无模型** 的 tool-result 头/中/尾裁剪（replay-safe, 零模型调用）。
本模块补齐确定性裁剪纯函数（不含 session 事件落账 —— 那是调用方职责）。

设计要点（纯函数, 零 IO, 零模型）
----------------------------------
1. ``code_point_length``: 按 Unicode code point 计长（Python str 天然按码点）;
2. ``measure_content``: text block 计码点, 非 text 计 0;
3. ``prune_content``: 头/中/尾确定性裁剪 + 单次 marker 插入 + 裁后校验;
4. ``prune_blocks_over_budget``: 对一批 tool result 逐个裁, 汇总省下的码点。

与既有层关系
--------------
- ``compact_with_llm``: LLM 摘要式（花模型）; 本模块: 确定性无模型（零调用）;
- 本模块不碰 session 事件/影价落账（调用方据返回决定落账）。
"""

from __future__ import annotations

from dataclasses import dataclass

#: 默认字符预算（对齐 外部实现 config 默认语义; 具体 DEFAULTS 值未随 src 落盘, 取合理值）。
DEFAULT_THRESHOLD_CHARS: int = 20_000
DEFAULT_HEAD_CHARS: int = 2_000
DEFAULT_TAIL_CHARS: int = 2_000

#: 中段占位标记（裁掉的部分用一个 marker 表示, 只插入一次）。
PRUNE_MARKER: str = "\n… [tool result trimmed — full output omitted] …\n"


@dataclass(frozen=True)
class ContentBlock:
    """一个工具结果内容块（type='text' 计费, 其余计 0）。"""

    type: str
    text: str | None = None


@dataclass(frozen=True)
class PruneConfig:
    """字符预算（threshold = head + marker + tail 的上限）。"""

    threshold_chars: int = DEFAULT_THRESHOLD_CHARS
    head_chars: int = DEFAULT_HEAD_CHARS
    tail_chars: int = DEFAULT_TAIL_CHARS


@dataclass(frozen=True)
class PrunedEntry:
    """一条裁剪记录（调用前/后码点数, 供汇总与影价）。"""

    index: int
    chars_before: int
    chars_after: int


@dataclass(frozen=True)
class PruneResult:
    """一批裁剪的结果（每条记录 + 总省下的码点）。"""

    pruned: tuple[PrunedEntry, ...]
    chars_removed: int


def code_point_length(text: str) -> int:
    """按 Unicode code point 计长（Python str 已按码点索引, len 即码点数）。"""
    return len(text)


def measure_content(blocks: list[ContentBlock]) -> int:
    """非 text block 计 0; text block 累加码点数（纯函数）。"""
    total = 0
    for block in blocks:
        if block.type == "text" and block.text is not None:
            total += code_point_length(block.text)
    return total


def prune_content(
    blocks: list[ContentBlock],
    *,
    config: PruneConfig,
) -> list[ContentBlock] | None:
    """头/中/尾确定性裁剪（纯函数）。

    - totalChars <= threshold → 返回 None（不裁）;
    - 否则保留 head + 单次 marker + tail, 富块顺序保留;
    - 裁后必须更小且 ≤ threshold, 否则抛 ValueError。
    """
    total_chars = measure_content(blocks)
    if total_chars <= config.threshold_chars:
        return None

    removed_start = config.head_chars
    removed_end = total_chars - config.tail_chars
    pruned: list[ContentBlock] = []
    consumed = 0
    marker_inserted = False

    for block in blocks:
        if block.type != "text" or block.text is None:
            pruned.append(block)
            continue

        # Python 字符串按码点切片, 天然不劈代理对
        points = block.text
        block_start = consumed
        block_end = block_start + len(points)
        head_end = min(len(points), max(0, removed_start - block_start))
        tail_start = min(len(points), max(0, removed_end - block_start))
        intersects_removed = block_start < removed_end and block_end > removed_start
        marker = PRUNE_MARKER if intersects_removed and not marker_inserted else ""
        if len(marker) > 0:
            marker_inserted = True
        text = points[:head_end] + marker + points[tail_start:]
        if len(text) > 0:
            pruned.append(ContentBlock(type=block.type, text=text))
        consumed = block_end

    if not marker_inserted:
        raise ValueError("tool-result prune: failed to locate the removed text span")
    chars_after = measure_content(pruned)
    if chars_after > config.threshold_chars or chars_after >= total_chars:
        raise ValueError("tool-result prune: replacement must be smaller and within threshold")
    return pruned


def prune_blocks_over_budget(
    blocks_list: list[list[ContentBlock]],
    *,
    config: PruneConfig,
) -> PruneResult:
    """对一批 tool result 逐个裁, 汇总省下的码点（纯函数）。

    只裁超预算项; 未超的跳过。返回每条记录（index 指向输入位置）+ 总节省。
    """
    pruned: list[PrunedEntry] = []
    chars_removed = 0
    for idx, blocks in enumerate(blocks_list):
        original = measure_content(blocks)
        result = prune_content(blocks, config=config)
        if result is None:
            continue
        after = measure_content(result)
        pruned.append(PrunedEntry(index=idx, chars_before=original, chars_after=after))
        chars_removed += original - after
    return PruneResult(pruned=tuple(pruned), chars_removed=chars_removed)


__all__ = [
    "DEFAULT_THRESHOLD_CHARS",
    "DEFAULT_HEAD_CHARS",
    "DEFAULT_TAIL_CHARS",
    "PRUNE_MARKER",
    "ContentBlock",
    "PruneConfig",
    "PrunedEntry",
    "PruneResult",
    "code_point_length",
    "measure_content",
    "prune_content",
    "prune_blocks_over_budget",
]
