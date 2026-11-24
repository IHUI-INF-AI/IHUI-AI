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

2026-11-19 接线:本模块已接进 ``agent_loop_v2.bound_tool_result_for_context`` 的
超预算预览路径(头+尾+续读 offset),不再是「有测试、零生产调用方」。

设计要点（纯函数, 零 IO, 零模型）
----------------------------------
1. ``code_point_length``: 按 Unicode code point 计长（Python str 天然按码点）;
2. ``measure_content``: text block 计码点, 非 text 计 0（旧口径, 兼容既有调用）;
3. ``prune_content``: 头/中/尾确定性裁剪 + 单次 marker 插入 + 裁后校验;
4. ``prune_blocks_over_budget``: 对一批 tool result 逐个裁, 汇总省下的码点。

DSH 对齐(2026-11-24, 依据 docs/benchmark-evidence/2026-11/qoder-dsh-deep-2026-11-24.md §E3-3)
----------------------------------------------------------------------------------------------
- ``ContentBlock`` 扩展 image 形态:图片不可切——整张保留或整张省略,禁止二分;
- 计价函数按参数注入(``price(block)``, 复刻 retention.ts 同签名),默认桩 text 按码点、
  image 按固定整数;不接真实 LLM 计价,不引新网络/模型依赖;
- ``PruneStats`` 给出 ``omitted_chars/omitted_bytes/omitted_images`` 精确计数:按
  「原始内容 − 实际保留内容」反推,不按预算推导(对照方 README:119 批评推导式通知高估)。

与既有层关系
--------------
- ``compact_with_llm``: LLM 摘要式（花模型）; 本模块: 确定性无模型（零调用）;
- 本模块不碰 session 事件/影价落账（调用方据返回决定落账）。
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

#: 默认字符预算 —— 生效值,不是猜的:
#: 对照件 `@deepseek-ai/dsh-compaction-tool-result-pruner`(MIT, D:\DevEnv\dsh-ref)
#: 的 README 明示 threshold 8192 / head 4096 / tail 1024,并要求
#: ``head + marker + tail <= threshold``(否则裁完仍超预算)。本仓取同一组
#: 默认值,并把该不变量做成构造期校验(见 ``PruneConfig.__post_init__``)。
DEFAULT_THRESHOLD_CHARS: int = 8_192
DEFAULT_HEAD_CHARS: int = 4_096
DEFAULT_TAIL_CHARS: int = 1_024

#: 中段占位标记（裁掉的部分用一个 marker 表示, 只插入一次）。
PRUNE_MARKER: str = "\n… [tool result trimmed — full output omitted] …\n"

#: 图片计价桩的固定整数成本(占位估算, 不是真实模型图片计价; 真实计价由调用方注入 price)。
IMAGE_PRICE_DEFAULT: int = 1024


@dataclass(frozen=True)
class ContentBlock:
    """一个工具结果内容块。

    type='text' 是可切文本;type='image' 是不可分割图片(整张保留或整张省略);
    其余类型沿用旧口径计 0。``image_url`` 仅承载图片定位,计价由 ``price`` 决定。
    """

    type: str
    text: str | None = None
    image_url: str | None = None


@dataclass(frozen=True)
class PruneConfig:
    """字符预算（threshold = head + marker + tail 的上限）。"""

    threshold_chars: int = DEFAULT_THRESHOLD_CHARS
    head_chars: int = DEFAULT_HEAD_CHARS
    tail_chars: int = DEFAULT_TAIL_CHARS

    def __post_init__(self) -> None:
        """配置合法性：head + marker + tail 必须装得进 threshold。

        对照件 README 把这条写成硬要求（不满足则裁剪后仍超预算）；放在构造期
        拒绝，比在裁剪路径上抛一个更晚、更难归因的错误强。
        """
        if self.threshold_chars <= 0:
            raise ValueError("prune config: threshold_chars must be > 0")
        if self.head_chars < 0 or self.tail_chars < 0:
            raise ValueError("prune config: head_chars/tail_chars must be >= 0")
        if self.head_chars + self.tail_chars + len(PRUNE_MARKER) > self.threshold_chars:
            raise ValueError(
                "prune config: head + marker + tail must fit within threshold_chars"
            )


@dataclass(frozen=True)
class PrunedEntry:
    """一条裁剪记录（调用前/后码点数 + 精确省略计数, 供汇总与影价）。"""

    index: int
    chars_before: int
    chars_after: int
    omitted_chars: int = 0
    omitted_bytes: int = 0
    omitted_images: int = 0


@dataclass(frozen=True)
class PruneStats:
    """精确省略计数:按「原始内容 − 实际保留内容」反推,不按预算推导。"""

    omitted_chars: int  # 被省略文字的 Unicode 码点数
    omitted_bytes: int  # 被省略文字的 UTF-8 字节数
    omitted_images: int  # 被整张省略的图片数


@dataclass(frozen=True)
class PruneOutcome:
    """一次裁剪的产出:保留块序列 + 省略统计。"""

    blocks: tuple[ContentBlock, ...]
    stats: PruneStats


@dataclass(frozen=True)
class PruneResult:
    """一批裁剪的结果（每条记录 + 总省下的码点与省略计数）。"""

    pruned: tuple[PrunedEntry, ...]
    chars_removed: int
    omitted_bytes: int = 0
    omitted_images: int = 0


def code_point_length(text: str) -> int:
    """按 Unicode code point 计长（Python str 已按码点索引, len 即码点数）。"""
    return len(text)


def default_price(block: ContentBlock) -> int:
    """确定性计价桩(零模型、零网络)。

    - text:按码点计;image:按 ``IMAGE_PRICE_DEFAULT`` 固定整数;其余类型计 0。
    签名对齐 DSH retention.ts 的 ``price(block)``;真实模型图片计价由调用方注入
    同名桩函数,本模块不引新依赖。
    """
    if block.type == "text":
        return code_point_length(block.text or "")
    if block.type == "image":
        return IMAGE_PRICE_DEFAULT
    return 0


def measure_content(blocks: list[ContentBlock]) -> int:
    """非 text block 计 0; text block 累加码点数（纯函数,旧口径保留）。"""
    total = 0
    for block in blocks:
        if block.type == "text" and block.text is not None:
            total += code_point_length(block.text)
    return total


def _text_chars(blocks: Sequence[ContentBlock]) -> int:
    return sum(
        code_point_length(b.text or "")
        for b in blocks
        if b.type == "text" and b.text is not None
    )


def _text_bytes(blocks: Sequence[ContentBlock]) -> int:
    return sum(
        len((b.text or "").encode("utf-8"))
        for b in blocks
        if b.type == "text" and b.text is not None
    )


def _image_count(blocks: Sequence[ContentBlock]) -> int:
    return sum(1 for b in blocks if b.type == "image")


def _fit_text(
    text: str,
    budget: int,
    *,
    tail: bool,
    price: Callable[[ContentBlock], int],
) -> str:
    """二分找价格 ≤ budget 的最大可保留端(价格对保留长度单调, 纯函数)。

    对齐 DSH retention.ts ``fitText``:文字可切,图片不走这里。
    """
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        candidate = text[len(text) - middle :] if tail else text[:middle]
        if len(candidate) == 0 or price(ContentBlock("text", candidate)) <= budget:
            low = middle
        else:
            high = middle - 1
    return text[len(text) - low :] if tail else text[:low]


def prune_content_with_stats(
    blocks: list[ContentBlock],
    *,
    config: PruneConfig,
    price: Callable[[ContentBlock], int] = default_price,
) -> PruneOutcome | None:
    """头/中/尾确定性裁剪(纯函数),返回保留块 + 精确省略统计。

    - 计价总价 ≤ threshold → 返回 None(不裁);
    - 头端按 ``head_chars``、尾端按 ``tail_chars`` 连续取块:图片价格够才整张保留,
      不够则整张省略(禁止二分);文本超剩余则二分拟合最大可保留端;
    - 被省略的中段用一个 marker 占位(只插一次);
    - 裁后必须更小且 ≤ threshold, 否则抛 ValueError。
    """
    total_cost = sum(price(b) for b in blocks)
    if total_cost <= config.threshold_chars:
        return None

    head: list[ContentBlock] = []
    tail: list[ContentBlock] = []
    head_whole = 0
    tail_whole = 0
    same_block_head_chars = 0

    # 头端:整块价格够就整块保留;文本超剩余则二分适配;图片超剩余直接整张省略
    remaining = config.head_chars
    first = 0
    while first < len(blocks):
        block = blocks[first]
        cost = price(block)
        if cost <= remaining:
            head.append(block)
            remaining -= cost
            head_whole += 1
            first += 1
            continue
        if block.type == "text" and block.text is not None:
            piece = _fit_text(block.text, remaining, tail=False, price=price)
            if piece:
                head.append(ContentBlock("text", piece))
                same_block_head_chars = len(piece)
        break

    # 尾端:同一块被头端切过,尾段从头段之后取,防重复计入
    remaining = config.tail_chars
    last = len(blocks) - 1
    while last >= first:
        original = blocks[last]
        if last == first and original.type == "text" and original.text is not None:
            tail_block: ContentBlock = ContentBlock(
                "text", original.text[same_block_head_chars:]
            )
        else:
            tail_block = original
        cost = price(tail_block)
        if cost <= remaining:
            tail.append(original)
            remaining -= cost
            tail_whole += 1
            last -= 1
            continue
        if tail_block.type == "text" and tail_block.text is not None:
            piece = _fit_text(tail_block.text, remaining, tail=True, price=price)
            if piece:
                tail.append(ContentBlock("text", piece))
        break
    tail.reverse()

    retained: list[ContentBlock] = list(head)
    if head_whole + tail_whole < len(blocks):
        retained.append(ContentBlock("text", PRUNE_MARKER))
    retained.extend(tail)

    # 精确计数:原始内容 − 实际保留内容(marker 不是原文,不计入保留原文)
    retained_original = head + tail
    stats = PruneStats(
        omitted_chars=_text_chars(blocks) - _text_chars(retained_original),
        omitted_bytes=_text_bytes(blocks) - _text_bytes(retained_original),
        omitted_images=_image_count(blocks) - _image_count(retained_original),
    )

    retained_cost = sum(price(b) for b in retained)
    if retained_cost > config.threshold_chars or retained_cost >= total_cost:
        raise ValueError("tool-result prune: replacement must be smaller and within threshold")
    return PruneOutcome(blocks=tuple(retained), stats=stats)


def prune_content(
    blocks: list[ContentBlock],
    *,
    config: PruneConfig,
    price: Callable[[ContentBlock], int] = default_price,
) -> list[ContentBlock] | None:
    """头/中/尾确定性裁剪（纯函数）。

    - totalChars <= threshold → 返回 None（不裁）;
    - 否则保留 head + 单次 marker + tail, 富块顺序保留;
    - 裁后必须更小且 ≤ threshold, 否则抛 ValueError。
    精确省略计数见 :func:`prune_content_with_stats`。
    """
    outcome = prune_content_with_stats(blocks, config=config, price=price)
    if outcome is None:
        return None
    return list(outcome.blocks)


def prune_blocks_over_budget(
    blocks_list: list[list[ContentBlock]],
    *,
    config: PruneConfig,
    price: Callable[[ContentBlock], int] = default_price,
) -> PruneResult:
    """对一批 tool result 逐个裁, 汇总省下的码点与精确省略计数（纯函数）。

    只裁超预算项; 未超的跳过。返回每条记录（index 指向输入位置）+ 总节省。
    """
    pruned: list[PrunedEntry] = []
    chars_removed = 0
    omitted_bytes = 0
    omitted_images = 0
    for idx, blocks in enumerate(blocks_list):
        original = measure_content(blocks)
        outcome = prune_content_with_stats(blocks, config=config, price=price)
        if outcome is None:
            continue
        after = measure_content(list(outcome.blocks))
        pruned.append(
            PrunedEntry(
                index=idx,
                chars_before=original,
                chars_after=after,
                omitted_chars=outcome.stats.omitted_chars,
                omitted_bytes=outcome.stats.omitted_bytes,
                omitted_images=outcome.stats.omitted_images,
            )
        )
        chars_removed += original - after
        omitted_bytes += outcome.stats.omitted_bytes
        omitted_images += outcome.stats.omitted_images
    return PruneResult(
        pruned=tuple(pruned),
        chars_removed=chars_removed,
        omitted_bytes=omitted_bytes,
        omitted_images=omitted_images,
    )


__all__ = [
    "DEFAULT_THRESHOLD_CHARS",
    "DEFAULT_HEAD_CHARS",
    "DEFAULT_TAIL_CHARS",
    "IMAGE_PRICE_DEFAULT",
    "PRUNE_MARKER",
    "ContentBlock",
    "PruneConfig",
    "PrunedEntry",
    "PruneStats",
    "PruneOutcome",
    "PruneResult",
    "code_point_length",
    "default_price",
    "measure_content",
    "prune_content_with_stats",
    "prune_content",
    "prune_blocks_over_budget",
]
