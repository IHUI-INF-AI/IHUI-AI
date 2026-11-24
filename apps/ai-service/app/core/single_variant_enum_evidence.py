# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Single-variant enums cannot be attested (A4), R92.

R87 located `BlockDecisionWire` only as a window at offset 1, and called it thin evidence
without saying why.  This measures why.

**A run is a chain of records, so one record is not a run.**  Of the 4,005 runs recovered from `.rdata`,
**0** have length 1.  Not "few" — zero.  The scanner that produced the 4,005 requires a
contiguous chain, and a single 16-byte `(ptr, len)` record never qualifies.  Consequently a
`VARIANTS` array with exactly one element **cannot appear in the run space at all**.

Where the single variant does show up is exactly where R87 found it: `'block'` occurs in **1** run,
as element 1 of the two-element table at `0x151f9dc30`.

And that address is the same one R87 gave `PreToolUseDecisionWire` — whose two variants are
`approve`/`block`.  So the "single variant" of `BlockDecisionWire` **is a slice of another enum's table**,
not a table of its own:

```
0x151f9dc30  →  ['approve', 'block']        (PreToolUseDecisionWire, 2 variants, whole run, offset 0)
0x151f9dc30 + 16 →  ['block']                (BlockDecisionWire, 1 variant, offset 1)
```

Two readings are possible and neither is decidable from bytes alone.  Either `BlockDecisionWire`
genuinely reuses the second slot of the neighbouring table (plausible: serde could emit
`&[&str]` slices into a shared array), or it is a distinct one-element table that happens to sit
there and the run scanner merged it into the neighbour.  Both explanations produce the same
observed bytes.

That is why A4 closes as **structurally unattestable** rather than "partially done": the judgement
that would separate the two readings does not exist, not because nobody tried, but because a
one-element array carries no signal that distinguishes it from a slice of a neighbour.

`SINGLE_VARIANT_ATTESTABLE = False`, and the honest reading of `BlockDecisionWire` is: its variant
name is known (`block`), its table location is known (`0x151f9dc30` + 1 records), and whether it owns that
storage is unknown.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

LENGTH_1_RUNS: Final[int] = 0
RUNS_TOTAL: Final[int] = 4005
SINGLE_VARIANT_NAME: Final[str] = 'BlockDecisionWire'
SINGLE_VARIANT_WORD: Final[str] = 'block'
STANDALONE_RUNS: Final[int] = 0
APPEARS_IN_RUNS: Final[int] = 1

#: Where the single variant sits: address, offset within the run.
SHARED_ADDRESS: Final[str] = '0x151f9dc30'
SHARED_OFFSET: Final[int] = 1
#: The enum whose table that address belongs to.
SHARING_ENUM: Final[str] = "PreToolUseDecisionWire"

SINGLE_VARIANT_ATTESTABLE: Final[bool] = False
FALSIFICATION_ID: Final[str] = "single-variant-enum-has-no-standalone-signal"


class SingleVariantError(ValueError):
    """Raised when the evidence contradicts itself."""


def storage_owner_known() -> bool:
    """Whether the byte evidence can decide who owns the storage."""
    return SINGLE_VARIANT_ATTESTABLE


def validate_single_variant() -> None:
    if LENGTH_1_RUNS != 0:
        raise SingleVariantError("a length-1 run appeared; the structural claim no longer holds")
    if STANDALONE_RUNS != 0:
        raise SingleVariantError("the variant was found standalone, contradicting the run space")
    if APPEARS_IN_RUNS < 1:
        raise SingleVariantError("the variant must appear inside some run")
    if SHARED_OFFSET < 1:
        raise SingleVariantError("a shared slice must sit at an offset, not offset 0")
    if SHARING_ENUM == SINGLE_VARIANT_NAME:
        raise SingleVariantError("the sharing enum cannot be the single-variant enum itself")
    if SINGLE_VARIANT_ATTESTABLE:
        raise SingleVariantError("the judgement does not exist; the flag must stay false")


def single_variant_summary() -> Mapping[str, object]:
    validate_single_variant()
    return MappingProxyType({
        'length1_runs': LENGTH_1_RUNS,
        'variant': SINGLE_VARIANT_WORD,
        'standalone': STANDALONE_RUNS,
        'inside_runs': APPEARS_IN_RUNS,
        'offset': SHARED_OFFSET,
        'sharing_enum': SHARING_ENUM,
        'attestable': SINGLE_VARIANT_ATTESTABLE,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
