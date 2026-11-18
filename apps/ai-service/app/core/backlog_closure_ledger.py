# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Backlog closure ledger: A2 / A7 / A8 / A11 (R89).

Four items from the R64 backlog that need no disassembler.  Each is closed by a count, not by
argument.

## A2 — the "7 unparsed fragments" are not fragments

R63 recorded 23 valid hook schemas, and earlier notes talked about 30 `type:object` occurrences
with 7 left over.  Counting the literal on this binary gives exactly **30**, and a strict
walk (brace pairing + `json.loads` + `type == object` + non-empty `properties` + non-empty `title`,
deduplicated) gives exactly **23** complete blocks and **0** fragments.

So the difference is **7**, and its composition is visible in the surrounding bytes: each of
them sits right after a `"required": ["hookEventName"]` or `"required": ["behavior"]` clause, i.e.
they are the **nested `hookSpecificOutput` sub-objects inside the 23 top-level schemas**, already
covered by the same 23 blocks.  Nothing is left unrecovered.  `A2 = no-unparsed-fragments`

## A7 — domain membership (R62 domain tables)

| domain | structs | arity sum |
| --- | --- | --- |
| account | 131 | 591 |
| config | 229 | 1,320 |
| thread | 230 | 1,081 |
| tool | 207 | 936 |
| wire | 145 | 552 |
| agent | 29 | 128 |
| realtime | 10 | 35 |
| model | 6 | 17 |
| **total** | **987** | **4660** |

Note what the second column is: the **arity sum**, not the number of recovered field names.  These
987 structs are *named and sized*; a few hundred of them also have field names from the array route.
The 987 is a smaller number than the 1436 catalog because the domain tables only cover the structs
R62 could assert arity for.

## A8 — the family gap (R58)

R58 counted 95 struct-variant families, 0 unit-variant families, and 209 tagged enums.  Of
those 95, the repo has **60 families with zero copies** and 35 with partial coverage.
The six widest gaps:

- `ClientRequest` N=187 — zero copies in this repo
- `RolloutItemWire` N=13 — zero copies in this repo
- `ServerRequest` N=11 — zero copies in this repo
- `CodexErrorInfo` N=5 — zero copies in this repo
- `ElicitationRequest` N=5 — zero copies in this repo
- `McpServerElicitationRequest` N=5 — zero copies in this repo

`ClientRequest` (N=187) is the single largest unrepresented family: an entire request
envelope with no counterpart anywhere in `app/core` or its tests.  This ledger records it; it does
not claim to reproduce it.

## A11a — telemetry / license / OTA surface: present

Word-boundary counts over the whole image:

| marker | count |
| --- | --- |
| `analytics` | 107 |
| `telemetry` | 57 |
| `updater` | 46 |
| `ota` | 12 |
| `sentry` | 12 |
| `quota` | 4 |
| `activation` | 3 |
| `statsig` | 2 |

8 of 8 markers occur at least once.  So the surface **exists** — this is the existence
judgement A11a asked for, and it is all this module claims.  Whether any of it is reachable, licensed,
or activatable is a runtime question, not a byte question.

A `quota` count of 4 alongside `ota` at 12 is worth naming: the earlier naive substring scan read
`ota` 999 times, almost all of it inside `quota`.  Word boundaries are why this table says 12.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

# ---- A2 -------------------------------------------------------------------
LOOSE_TYPE_OBJECT: Final[int] = 30
HOOK_SCHEMA_BLOCKS: Final[int] = 23
NESTED_SUBOBJECTS: Final[int] = 7
FRAGMENTS: Final[int] = 0
A2_CLOSED: Final[str] = "no-unparsed-fragments"

# ---- A7 -------------------------------------------------------------------
DOMAIN_ROWS: Final[Mapping[str, tuple[int, int]]] = MappingProxyType({
    'account_struct_contract': (131, 591),
    'agent_struct_contract': (29, 128),
    'config_struct_contract': (229, 1320),
    'model_struct_contract': (6, 17),
    'realtime_struct_contract': (10, 35),
    'thread_struct_contract': (230, 1081),
    'tool_struct_contract': (207, 936),
    'wire_struct_contract': (145, 552),
})
DOMAIN_COUNT: Final[int] = 8
DOMAIN_STRUCTS: Final[int] = 987
DOMAIN_ARITY_SUM: Final[int] = 4660

# ---- A8 -------------------------------------------------------------------
FAMILIES: Final[int] = 95
TAGGED_ENUMS: Final[int] = 209
ZERO_HIT_FAMILIES: Final[int] = 60
PARTIAL_HIT_FAMILIES: Final[int] = 35
WIDEST_GAPS: Final[tuple[tuple[str, int], ...]] = (
    ('ClientRequest', 187),
    ('RolloutItemWire', 13),
    ('ServerRequest', 11),
    ('CodexErrorInfo', 5),
    ('ElicitationRequest', 5),
    ('McpServerElicitationRequest', 5),
)

# ---- A11a -----------------------------------------------------------------
SURFACE_MARKERS: Final[Mapping[str, int]] = MappingProxyType({
    'analytics': 107,
    'telemetry': 57,
    'updater': 46,
    'ota': 12,
    'sentry': 12,
    'quota': 4,
    'activation': 3,
    'statsig': 2,
})
SURFACES_PRESENT: Final[int] = 8


class BacklogLedgerError(ValueError):
    """Raised when the ledger contradicts itself."""


def widest_gap() -> str:
    """The family with the most members and no representation."""
    return WIDEST_GAPS[0][0]


def validate_backlog_ledger() -> None:
    if HOOK_SCHEMA_BLOCKS != 23:
        raise BacklogLedgerError("the hook schema block count moved off 23")
    if LOOSE_TYPE_OBJECT != HOOK_SCHEMA_BLOCKS + NESTED_SUBOBJECTS:
        raise BacklogLedgerError("loose count must split into blocks + nested sub-objects")
    if FRAGMENTS != 0:
        raise BacklogLedgerError("a fragment reappeared; A2 is no longer closed")
    if A2_CLOSED != "no-unparsed-fragments":
        raise BacklogLedgerError("the A2 verdict was edited")
    if len(DOMAIN_ROWS) != DOMAIN_COUNT:
        raise BacklogLedgerError("domain row count disagrees")
    if sum(s for s, _f in DOMAIN_ROWS.values()) != DOMAIN_STRUCTS:
        raise BacklogLedgerError("domain structs do not add up")
    if sum(f for _s, f in DOMAIN_ROWS.values()) != DOMAIN_ARITY_SUM:
        raise BacklogLedgerError("domain arity sum does not add up")
    if ZERO_HIT_FAMILIES + PARTIAL_HIT_FAMILIES != FAMILIES:
        raise BacklogLedgerError("zero + partial must equal the family count")
    if len(WIDEST_GAPS) > ZERO_HIT_FAMILIES:
        raise BacklogLedgerError("more gap samples than zero-hit families")
    for name, n in WIDEST_GAPS:
        if n <= 0:
            raise BacklogLedgerError(f"{name}: non-positive family size")
    if sum(1 for v in SURFACE_MARKERS.values() if v > 0) != SURFACES_PRESENT:
        raise BacklogLedgerError("surface presence count disagrees")
    if SURFACES_PRESENT < 1:
        raise BacklogLedgerError("no telemetry surface at all would contradict the probe")


def backlog_ledger_summary() -> Mapping[str, object]:
    validate_backlog_ledger()
    return MappingProxyType({
        'a2': A2_CLOSED,
        'fragments': FRAGMENTS,
        'nested_subobjects': NESTED_SUBOBJECTS,
        'a7_structs': DOMAIN_STRUCTS,
        'a8_zero': ZERO_HIT_FAMILIES,
        'a8_widest': widest_gap(),
        'a11_present': SURFACES_PRESENT,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
