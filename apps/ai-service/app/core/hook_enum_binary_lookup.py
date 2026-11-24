# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Hook enum variant sets located in the binary (R87).

serde stores an enum's variant names as `&'static [&'static str]`, i.e. the same 16-byte
(ptr, len) record array as `FIELDS`.  So the enum path is testable exactly like R84/R85 were.

| enum | variants | located |
| --- | --- | --- |
| `BlockDecisionWire` | 1 | window at offset 1 (thin) |
| `PermissionRequestBehaviorWire` | 2 | **13 whole runs** |
| `PreToolUseDecisionWire` | 2 | whole run at `0x151f9dc30` |
| `PreToolUsePermissionDecisionWire` | 3 | **not located** |

`PermissionRequestBehaviorWire` appearing **13 times** is the one number worth pausing on: a
two-string table repeated thirteen times across `.rdata` is the shape you get when the same small
enum is embedded in thirteen different serialized structures, not one table shared by all.  The
three located enums are graded as attested because set equality against an independent source is
what the test checks; `BlockDecisionWire` has a single variant, so its one-element window cannot
pin a table and is recorded as thin.

`PreToolUsePermissionDecisionWire` ({allow, deny, ask}) has no array anywhere in the 4005 runs — the
same negative answer R85 got for the input segments.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

ENUM_TOTAL: Final[int] = 4
LOCATED_COUNT: Final[int] = 3
UNLOCATED: Final[tuple[str, ...]] = (
    'PreToolUsePermissionDecisionWire',
)

#: name -> (variant count, addresses, window offset, whether it is a whole run)
LOCATED: Final[Mapping[str, tuple[int, tuple[str, ...], int, bool]]] = MappingProxyType({
    'BlockDecisionWire': (1, ('0x151f9dc30',), 1, False),
    'PermissionRequestBehaviorWire': (2, ('0x1519c3848', '0x151a0a488', '0x151a9a058', '0x151a9cf20', '0x151aa1638', '0x151b12720', '0x151b29600', '0x151bfeff0', '0x151d09e30', '0x151e05d70', '0x151e98a80', '0x15232f618', '0x152363318'), 0, True),
    'PreToolUseDecisionWire': (2, ('0x151f9dc30',), 0, True),
})

#: Variant names, kept from the schema so the sets can be re-checked.
VARIANTS: Final[Mapping[str, tuple[str, ...]]] = MappingProxyType({
    'BlockDecisionWire': ('block',),
    'PermissionRequestBehaviorWire': ('allow', 'deny'),
    'PreToolUseDecisionWire': ('approve', 'block'),
})

#: Enums whose table appears more than once: name, variant count, copy count, first addresses.
MULTI_COPY: Final[tuple[tuple[str, int, int, tuple[str, ...]], ...]] = (
    ('PermissionRequestBehaviorWire', 2, 13, ('0x1519c3848', '0x151a0a488', '0x151a9a058')),)

THIN_EVIDENCE: Final[tuple[str, ...]] = ('BlockDecisionWire',)
ENUM_ARRAYS_ATTESTED: Final[bool] = True
ALL_ENUMS_LOCATED: Final[bool] = False


class EnumLookupError(ValueError):
    """Raised when the enum table contradicts the schema or its own counts."""


def addresses_of(name: str) -> tuple[str, ...]:
    """Array addresses for one enum; empty when unlocated."""
    entry = LOCATED.get(name)
    return entry[1] if entry else ()


def validate_enum_lookup() -> None:
    if len(LOCATED) != LOCATED_COUNT:
        raise EnumLookupError("located table size disagrees with LOCATED_COUNT")
    if LOCATED_COUNT + len(UNLOCATED) != ENUM_TOTAL:
        raise EnumLookupError("located + unlocated must equal the enum count")
    if ALL_ENUMS_LOCATED:
        raise EnumLookupError("one enum is unlocated; the flag must stay false")
    for name in UNLOCATED:
        if name in LOCATED:
            raise EnumLookupError(f"{name}: unlocated enum also in the located table")
    for name, (count, addresses, offset, whole) in LOCATED.items():
        if count != len(VARIANTS[name]):
            raise EnumLookupError(f"{name}: variant count disagrees with the table")
        if not addresses:
            raise EnumLookupError(f"{name}: no address recorded")
        for address in addresses:
            if not address.startswith('0x'):
                raise EnumLookupError(f"{name}: address is not a hex literal")
        if offset < 0:
            raise EnumLookupError(f"{name}: negative offset")
        if whole and offset != 0:
            raise EnumLookupError(f"{name}: a whole run cannot start at an offset")
    for name, variant_count, copies, _addrs in MULTI_COPY:
        if copies < 2:
            raise EnumLookupError(f"{name}: multi-copy entry needs at least two addresses")
        if variant_count != len(VARIANTS[name]):
            raise EnumLookupError(f"{name}: multi-copy variant count disagrees")
        if copies > len(LOCATED[name][1]):
            raise EnumLookupError(f"{name}: copy count exceeds recorded addresses")


def enum_lookup_summary() -> Mapping[str, object]:
    validate_enum_lookup()
    return MappingProxyType({
        'enums': ENUM_TOTAL,
        'located': LOCATED_COUNT,
        'unlocated': UNLOCATED[0],
        'multi_copy': len(MULTI_COPY),
        'attested': ENUM_ARRAYS_ATTESTED,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
