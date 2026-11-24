# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Where the field-name coverage stops, and why (R86).

Every one of the 1436 catalogued struct names is put in exactly one bucket by the amount of
field-name evidence that exists for it near its template:

| bucket | count | meaning |
| --- | --- | --- |
| `named` | **316** | a field list was reconstructed (R75/R80/R81/R82/R83) |
| `under` | 372 | the pool yields some identifiers, fewer than the arity |
| `over-rejected` | 226 | the pool yields at least the arity but the shape gate rejected it |
| `empty` | **500** | **no identifier at all in the pool** |
| unclassified | 22 | in the catalog but matched by no template scan |

Two numbers matter more than the rest:

* **`empty = 500`.** For these structs the bytes in front of the template contain no field-name
  identifier.  The pool route cannot produce a field list for them — not "not yet scanned", but
  nothing there to scan.  The only remaining sources are code-level string comparisons (the
  hand-written `serde_json` path) or a second schema, neither of which this chain has built yet.
* **pool-route ceiling = 914.** `named (316) + under (372) + over-rejected (226)`.  Even if every
  partially-evidenced struct were fully resolved, the pool route cannot exceed that, because 500 structs
  have nothing to resolve.

The `over-rejected` bucket is the one that looks most recoverable and is the least so: its samples
are dominated by small arity next to a shared or foreign pool — `FeedbackConfigToml` has arity 1 yet
19 identifiers in front of it, `AnalyticsConfigToml` arity 1 with 9.  Those identifiers belong to
neighbours, so "the pool has enough names" does not mean "these are its names".

`hook-side` (9) counts schema names located in the binary by R84/R85 (`*HookSpecificOutputWire`
objects and the three `command.output` segments).  They are not in the struct catalog, so they are
reported separately rather than added to `named`.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

CATALOG_STRUCTS: Final[int] = 1436
NAMED: Final[int] = 316
UNDER: Final[int] = 372
EMPTY: Final[int] = 500
OVER_REJECTED: Final[int] = 226
UNCLASSIFIED: Final[int] = 22
HOOK_SIDE: Final[int] = 9

CLASSIFIED_TOTAL: Final[int] = 1414
POOL_REACHABLE: Final[int] = 598
POOL_ROUTE_CEILING: Final[int] = 914
UNREACHABLE_BY_POOL: Final[int] = 500


class GapLedgerError(ValueError):
    """Raised when the ledger's buckets do not add up."""


def pool_route_ceiling() -> int:
    """Field lists the pool route can reach at most, named included."""
    return POOL_ROUTE_CEILING


def empty_share() -> float:
    """Share of catalogued structs with no field-name bytes near their template."""
    return EMPTY / CATALOG_STRUCTS


def validate_gap_ledger() -> None:
    if NAMED + UNDER + EMPTY + OVER_REJECTED != CLASSIFIED_TOTAL:
        raise GapLedgerError("the four buckets do not sum to CLASSIFIED_TOTAL")
    if CLASSIFIED_TOTAL + UNCLASSIFIED != CATALOG_STRUCTS:
        raise GapLedgerError("classified + unclassified must equal the catalog size")
    if POOL_REACHABLE != UNDER + OVER_REJECTED:
        raise GapLedgerError("pool-reachable must be under + over-rejected")
    if POOL_ROUTE_CEILING != NAMED + POOL_REACHABLE:
        raise GapLedgerError("ceiling must be named plus pool-reachable")
    if UNREACHABLE_BY_POOL != EMPTY:
        raise GapLedgerError("unreachable must equal the empty bucket")
    if NAMED + UNREACHABLE_BY_POOL + POOL_REACHABLE + UNCLASSIFIED > CATALOG_STRUCTS:
        raise GapLedgerError("buckets overlap: their sum exceeds the catalog")
    if HOOK_SIDE >= CATALOG_STRUCTS:
        raise GapLedgerError("hook-side names are not part of the catalog")
    for v in (NAMED, UNDER, EMPTY, OVER_REJECTED, UNCLASSIFIED, HOOK_SIDE):
        if v < 0:
            raise GapLedgerError("negative bucket")


def gap_ledger_summary() -> Mapping[str, object]:
    validate_gap_ledger()
    return MappingProxyType({
        'catalog': CATALOG_STRUCTS,
        'named': NAMED,
        'under': UNDER,
        'empty': EMPTY,
        'over_rejected': OVER_REJECTED,
        'unclassified': UNCLASSIFIED,
        'hook_side': HOOK_SIDE,
        'ceiling': POOL_ROUTE_CEILING,
        'empty_share': round(empty_share(), 4),
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
