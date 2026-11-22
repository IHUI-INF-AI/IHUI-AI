# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R78: the pool after the template is nearly empty — the before-only choice loses exactly one name.

R75/R77 read the name run *before* the serde template.  A fair check is whether the run *after* it
sometimes carries field names too.  Measured over all 3186 templates: 86 are followed by a
word-run, only **3** of those runs are field-shaped, and only **1** struct is accepted through the
after-pool that the before-pool missed — `FsReadFileResponse`.

The before-only segmentation reproduces R75 exactly (same 277 names, set-equal), and the union is a
strict superset at 278.  So the direction choice was right, and its cost is one missing struct —
quantified here instead of assumed.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

from app.core.struct_strict_reconstruction import STRICT_STRUCTURES

#: Segmented before the template: identical to R75, verified set-equal.
BEFORE_ACCEPTED_COUNT: Final[int] = 277
BEFORE_MATCHES_R75: Final[bool] = True
BEFORE_EXACT_SITES: Final[int] = 489

#: Segmented after the template.
AFTER_ACCEPTED: Final[tuple[str, ...]] = ("ErrorEnvelope", "FsReadFileResponse")
AFTER_ACCEPTED_COUNT: Final[int] = 2
AFTER_EXACT_SITES: Final[int] = 3

#: before + after concatenated.
BOTH_ACCEPTED_COUNT: Final[int] = 278
BOTH_EXACT_SITES: Final[int] = 488
BIDIRECTIONAL_GAIN: Final[int] = 1

#: How much text even sits after a template: 3186 templates, 86 followed by a word-run, 3 shaped.
AFTER_BLOCK_TEMPLATES: Final[int] = 3186
AFTER_BLOCKS_WITH_NAMES: Final[int] = 86
AFTER_BLOCKS_FIELD_SHAPED: Final[int] = 3
POST_TEMPLATE_POOL_RICH: Final[bool] = False

ONLY_VIA_AFTER: Final[tuple[str, ...]] = ("FsReadFileResponse",)


class BidirectionalPoolError(ValueError):
    """Raised when the after-pool claim contradicts its measurements."""


def validate_bidirectional_pool() -> None:
    if not BEFORE_MATCHES_R75:
        raise BidirectionalPoolError("before-pool no longer reproduces R75")
    if len(STRICT_STRUCTURES) != BEFORE_ACCEPTED_COUNT:
        raise BidirectionalPoolError(
            f"before-pool count {BEFORE_ACCEPTED_COUNT} != R75 table {len(STRICT_STRUCTURES)}")
    if BOTH_ACCEPTED_COUNT != BEFORE_ACCEPTED_COUNT + BIDIRECTIONAL_GAIN:
        raise BidirectionalPoolError("union count != before + gain")
    if len(ONLY_VIA_AFTER) != BIDIRECTIONAL_GAIN:
        raise BidirectionalPoolError("gain disagrees with the names only the after-pool found")
    for name in ONLY_VIA_AFTER:
        if name not in AFTER_ACCEPTED:
            raise BidirectionalPoolError(f"{name} is claimed as after-only but not in AFTER_ACCEPTED")
        if name in STRICT_STRUCTURES:
            raise BidirectionalPoolError(f"{name} is already in R75, so it is not after-only")
    if AFTER_BLOCKS_FIELD_SHAPED >= AFTER_BLOCKS_WITH_NAMES:
        raise BidirectionalPoolError(
            "most after-blocks would be shaped — the post-template pool might be rich after all")
    if POST_TEMPLATE_POOL_RICH:
        raise BidirectionalPoolError("recorded as rich, contradicting the measurements")


def bidirectional_summary() -> Mapping[str, object]:
    validate_bidirectional_pool()
    return MappingProxyType({
        "before_accepted": BEFORE_ACCEPTED_COUNT,
        "after_accepted": AFTER_ACCEPTED_COUNT,
        "both_accepted": BOTH_ACCEPTED_COUNT,
        "gain": BIDIRECTIONAL_GAIN,
        "after_blocks_with_names": AFTER_BLOCKS_WITH_NAMES,
        "after_blocks_field_shaped": AFTER_BLOCKS_FIELD_SHAPED,
        "post_template_pool_rich": POST_TEMPLATE_POOL_RICH,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
