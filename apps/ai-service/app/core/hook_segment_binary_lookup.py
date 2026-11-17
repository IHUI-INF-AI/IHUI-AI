# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Which hook schema segments exist as serde `FIELDS` arrays in the binary (R85).

R84 located the seven `definitions` objects.  This round runs the same set-equality test over the
other sixteen inline segments — R63's `command.input` / `command.output` blocks — and the answer is
mostly negative, which is itself the finding:

| | segments | located |
| --- | --- | --- |
| `command.output` | 11 | **3** |
| `command.input` | 12 | **0** |
| total | 23 | **3** |

The three located are `post-compact.command.output` and `pre-compact.command.output` (both 4 fields,
**whole runs**, sharing the same two addresses) and `interrupt.command.output` (1 field, window only).

**What this separates.**  A serde `#[derive(Serialize, Deserialize)]` struct emits a `FIELDS` record
array into `.rdata`; hand-written JSON handling does not.  So:

* the `definitions` objects (`*HookSpecificOutputWire`) are **derived structs** — 6 of 7 found (R84);
* the sixteen inline `command.*` segments are **not** — 3 of 16 found, and every one of them is an
  `output` block;
* **all twelve `input` blocks are absent** from the array space.

That is the first structural split this chain can state about the binary: not "these structures are
unknown" but "these structures are not serde tables, so no field array exists to find."  It explains
why so many of the 1436 catalogued structs never yielded a field list — their fields are not stored
in a 16-byte record array at all.

`interrupt.command.output` has a single field, so a one-element window proves nothing about which
table it is; it is graded as thin evidence rather than counted with the two confirmed ones.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

SEGMENT_TOTAL: Final[int] = 23
LOCATED_COUNT: Final[int] = 3
UNLOCATED_COUNT: Final[int] = 20
OUTPUT_LOCATED: Final[int] = 3
INPUT_LOCATED: Final[int] = 0

#: segment -> (field count, array addresses, window offset, whether it is a whole run)
LOCATED: Final[Mapping[str, tuple[int, tuple[str, ...], int, bool]]] = MappingProxyType({
    'interrupt.command.output': (1, ('0x151f986a0', '0x151f9e290'), 3, False),
    'post-compact.command.output': (4, ('0x151f986a0', '0x151f9e290'), 0, True),
    'pre-compact.command.output': (4, ('0x151f986a0', '0x151f9e290'), 0, True),
})

UNLOCATED: Final[tuple[str, ...]] = (
    'interrupt.command.input',
    'permission-request.command.input',
    'permission-request.command.output',
    'post-compact.command.input',
    'post-tool-use.command.input',
    'post-tool-use.command.output',
    'pre-compact.command.input',
    'pre-tool-use.command.input',
    'pre-tool-use.command.output',
    'session-end.command.input',
    'session-start.command.input',
    'session-start.command.output',
    'stop.command.input',
    'stop.command.output',
    'subagent-start.command.input',
    'subagent-start.command.output',
    'subagent-stop.command.input',
    'subagent-stop.command.output',
    'user-prompt-submit.command.input',
    'user-prompt-submit.command.output',
)

#: One-field segments cannot be pinned by a window.
THIN_EVIDENCE: Final[tuple[str, ...]] = (
    'interrupt.command.output',
)

#: Addresses serving both compact-output segments (their field sets are identical).  The one-field
#: `interrupt` segment also lands on `0x151f986a0`, but it is thin evidence and not counted here.
SHARED_ADDRESSES: Final[tuple[tuple[str, tuple[str, ...]], ...]] = (
    ('0x151f986a0', ('post-compact.command.output', 'pre-compact.command.output')),
    ('0x151f9e290', ('post-compact.command.output', 'pre-compact.command.output')),)

DERIVE_SPLIT: Final[str] = "definitions-are-derived-structs-inline-outputs-are-not"
SEGMENTS_ATTESTED: Final[bool] = True
ALL_SEGMENTS_LOCATED: Final[bool] = False


class SegmentLookupError(ValueError):
    """Raised when the segment table contradicts the schema or its own counts."""


def address_of(segment: str) -> str | None:
    """First binary array address for one schema segment; None when it has no field table."""
    entry = LOCATED.get(segment)
    return entry[1][0] if entry else None


def input_share_of_located() -> float:
    """Share of located segments that are `input` blocks (zero here, and that is the point)."""
    return INPUT_LOCATED / LOCATED_COUNT


def validate_segment_lookup() -> None:
    if len(LOCATED) != LOCATED_COUNT:
        raise SegmentLookupError("located table size disagrees with LOCATED_COUNT")
    if LOCATED_COUNT + UNLOCATED_COUNT != SEGMENT_TOTAL:
        raise SegmentLookupError("located + unlocated must equal the segment count")
    if OUTPUT_LOCATED + INPUT_LOCATED != LOCATED_COUNT:
        raise SegmentLookupError("output/input located counts do not add up")
    if ALL_SEGMENTS_LOCATED:
        raise SegmentLookupError(f"{UNLOCATED_COUNT} segments are unlocated; the flag must stay false")
    for seg in UNLOCATED:
        if seg in LOCATED:
            raise SegmentLookupError(f"{seg}: unlocated segment also in the located table")
    for seg in THIN_EVIDENCE:
        if seg not in LOCATED:
            raise SegmentLookupError(f"{seg}: thin segment missing from the table")
    for seg, (field_count, addresses, offset, whole) in LOCATED.items():
        if field_count < 1:
            raise SegmentLookupError(f"{seg}: zero fields")
        if not addresses:
            raise SegmentLookupError(f"{seg}: no address recorded")
        for address in addresses:
            if not address.startswith('0x'):
                raise SegmentLookupError(f"{seg}: address is not a hex literal")
        if offset < 0:
            raise SegmentLookupError(f"{seg}: negative offset")
        if whole and offset != 0:
            raise SegmentLookupError(f"{seg}: a whole run cannot start at an offset")
    for address, members in SHARED_ADDRESSES:
        if len(members) < 2:
            raise SegmentLookupError(f"{address}: a shared address needs two members")
        for m in members:
            if address not in LOCATED.get(m, (0, ()))[1]:
                raise SegmentLookupError(f"{m}: not recorded at its shared address")


def segment_lookup_summary() -> Mapping[str, object]:
    validate_segment_lookup()
    return MappingProxyType({
        'segments': SEGMENT_TOTAL,
        'located': LOCATED_COUNT,
        'unlocated': UNLOCATED_COUNT,
        'output_located': OUTPUT_LOCATED,
        'input_located': INPUT_LOCATED,
        'shared_addresses': len(SHARED_ADDRESSES),
        'attested': SEGMENTS_ATTESTED,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
