# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The enum-variant route: measured and closed (R91).

A3 asked for the variant tables of 209 tagged enums; A5 asked whether `Message` (N=17) could be
pinned.  Both were tested against the same 4,005 record runs that carried the field tables.

## A3 — variant names are not stored as arrays

Of the 4,005 runs, **3353** are pure snake_case (field tables), and **31**
are "variant-shaped" in the loose sense (every element short and non-snake).  Reading those
31 settles the question: they are **camelCase field tables** — `threadId`/`afterCursor`,
`inputText`/`inputImage`/`inputAudio`, `osPid`/`cpuPercent`/`rssKb` — not variant names.

So the run space holds **zero** enum variant tables outside the hook side.  The four hook enums
that R87 did locate (`approve`/`block`, `allow`/`deny`, and the two single-variant ones) are the
whole exception, and they were already covered.

Why: an internally tagged enum is matched with `match`, and `match` against strings compiles to
per-variant comparisons — one literal compared in each branch, never a contiguous array of them.
The array shape only exists where serde derives a `VARIANTS`-style table, which is exactly the
`*DecisionWire` case.

**205 of 209 tagged enums have no variant table in this binary.**  A3 is closed as unreachable, by
measurement rather than by argument.

## A5 — `Message` is not in the catalog at all

`Message` has no arity in the R77 catalog (`arities=None`), and the nine runs of length 17 are
field-name tables of unrelated structs (`version`/`dual_write`/..., `name`/`canonical_app_id`/...).
There is no `Message`(17) to confirm, so A5 is not "unconfirmed" — the premise itself has no
counterpart in the catalog.  Recorded as `MESSAGE_IN_CATALOG=False`.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

RUNS: Final[int] = 4005
ALL_SNAKE_RUNS: Final[int] = 3353
VARIANT_SHAPED_RUNS: Final[int] = 31
MIXED_RUNS: Final[int] = 621
VARIANT_TABLES_OUTSIDE_HOOK: Final[int] = 0

TAGGED_ENUMS: Final[int] = 209
HOOK_ENUMS_LOCATED: Final[int] = 4
UNREACHABLE_ENUMS: Final[int] = TAGGED_ENUMS - HOOK_ENUMS_LOCATED

MESSAGE_IN_CATALOG: Final[bool] = False
LEN_17_RUNS: Final[int] = 9

FALSIFICATION_ID: Final[str] = "enum-variants-are-not-record-arrays"
ENUM_ROUTE_VIABLE: Final[bool] = False

#: The camelCase tables that the loose rule swept up, mislabelled as variant-shaped.
CAMEL_SAMPLES: Final[tuple[tuple[str, ...], ...]] = (
    ("threadId", "afterCursor"),
    ("inputText", "inputImage", "inputAudio"),
    ("osPid", "cpuPercent", "rssKb"),
)


class EnumVariantError(ValueError):
    """Raised when the enumeration contradicts its own counts."""


def variant_table_rate() -> float:
    """Share of tagged enums whose variant table was found."""
    return HOOK_ENUMS_LOCATED / TAGGED_ENUMS


def validate_enum_route() -> None:
    if ALL_SNAKE_RUNS + VARIANT_SHAPED_RUNS + MIXED_RUNS != RUNS:
        raise EnumVariantError("run buckets do not add up")
    if VARIANT_TABLES_OUTSIDE_HOOK != 0:
        raise EnumVariantError("a variant table appeared outside the hook side")
    if HOOK_ENUMS_LOCATED + UNREACHABLE_ENUMS != TAGGED_ENUMS:
        raise EnumVariantError("enum counts do not add up")
    if ENUM_ROUTE_VIABLE:
        raise EnumVariantError("the route was measured empty; the flag must stay false")
    if MESSAGE_IN_CATALOG:
        raise EnumVariantError("Message has no catalog entry; the flag must stay false")
    for seq in CAMEL_SAMPLES:
        if any("_" in x for x in seq):
            raise EnumVariantError("a camel sample contains a snake_case element")


def enum_route_summary() -> Mapping[str, object]:
    validate_enum_route()
    return MappingProxyType({
        'runs': RUNS,
        'variant_shaped': VARIANT_SHAPED_RUNS,
        'variant_tables_outside_hook': VARIANT_TABLES_OUTSIDE_HOOK,
        'tagged_enums': TAGGED_ENUMS,
        'unreachable': UNREACHABLE_ENUMS,
        'rate': round(variant_table_rate(), 4),
        'viable': ENUM_ROUTE_VIABLE,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
