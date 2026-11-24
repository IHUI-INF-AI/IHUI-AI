# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Hook `definitions` objects cross-checked against binary field arrays (R84).

R63/R64 read the seven `definitions` objects out of the JSON Schema embedded in the PE (a *text*
source).  R80 read 4005 FIELDS record arrays out of `.rdata` (a *binary* source).  This round makes
the schema the subject: for each object, look for a window whose length equals the object's field
count and whose name set equals the object's field set.

That is set equality against an independent source, so a match is an **attestation** rather than a
candidate — the first one in this chain that can say that.  Six of seven match:

* `SessionStartHookSpecificOutputWire`, `SubagentStartHookSpecificOutputWire` and
  `UserPromptSubmitHookSpecificOutputWire` are whole runs at **one shared address** `0x151f9dee0` —
  their schema field sets are identical (2 fields), so they legitimately share one array.
* `PreToolUseHookSpecificOutputWire` (5) is a whole run at `0x151f9de60`.
* `PermissionRequestDecisionWire` (5) and `PermissionRequestHookSpecificOutputWire` (2) match windows
  at offsets 2 inside longer runs at `0x151f9dda0` and `0x151f9df10`.

All six addresses sit inside one contiguous region (`0x151f9dd..0x151f9df`) — the hook output
contract arrays are laid out together, which is why they were found in one pass.

**One does not match: `PostToolUseHookSpecificOutputWire` (3).** No window in any of the 4005 runs
carries `{additionalContext, hookEventName, updatedMCPToolOutput}`.  So the schema says that
object exists, but the record arrays do not confirm it — recorded as unlocated rather than assumed
present.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

DEFINITION_TOTAL: Final[int] = 7
LOCATED_COUNT: Final[int] = 6
UNLOCATED: Final[tuple[str, ...]] = ('PostToolUseHookSpecificOutputWire',)
WHOLE_RUN_COUNT: Final[int] = 3
WINDOW_ONLY_COUNT: Final[int] = 3

#: name -> (field count, array address, window offset, whether it is a whole run)
LOCATED: Final[Mapping[str, tuple[int, str, int, bool]]] = MappingProxyType({
    'PermissionRequestDecisionWire': (5, '0x151f9dda0', 2, False),
    'PermissionRequestHookSpecificOutputWire': (2, '0x151f9df10', 2, False),
    'PreToolUseHookSpecificOutputWire': (5, '0x151f9de60', 0, False),
    'SessionStartHookSpecificOutputWire': (2, '0x151f9dee0', 0, True),
    'SubagentStartHookSpecificOutputWire': (2, '0x151f9dee0', 0, True),
    'UserPromptSubmitHookSpecificOutputWire': (2, '0x151f9dee0', 0, True),
})

#: One address serving several definitions whose field sets are identical.
SHARED_ADDRESSES: Final[tuple[tuple[str, tuple[str, ...]], ...]] = (
    ('0x151f9dee0', ('SessionStartHookSpecificOutputWire', 'SubagentStartHookSpecificOutputWire', 'UserPromptSubmitHookSpecificOutputWire')),
)

REGION: Final[str] = "0x151f9dd00-0x151f9e000"
LOCATED_ATTESTED: Final[bool] = True
ALL_LOCATED: Final[bool] = False


class CrosscheckError(ValueError):
    """Raised when the cross-check table contradicts the schema or its own counts."""


def address_of(name: str) -> str | None:
    """Binary array address confirmed for one definition; None when unlocated."""
    entry = LOCATED.get(name)
    return entry[1] if entry else None


def located_share() -> float:
    """Share of definitions the binary confirms."""
    return LOCATED_COUNT / DEFINITION_TOTAL


def validate_crosscheck() -> None:
    if len(LOCATED) != LOCATED_COUNT:
        raise CrosscheckError("located table size disagrees with LOCATED_COUNT")
    if LOCATED_COUNT + len(UNLOCATED) != DEFINITION_TOTAL:
        raise CrosscheckError("located + unlocated must equal the definition count")
    if WHOLE_RUN_COUNT + WINDOW_ONLY_COUNT != LOCATED_COUNT:
        raise CrosscheckError("whole-run and window-only counts do not add up")
    if ALL_LOCATED:
        raise CrosscheckError("one definition is unlocated; ALL_LOCATED is false")
    for name in UNLOCATED:
        if name in LOCATED:
            raise CrosscheckError(f"{name}: unlocated entry also in the located table")
    for name, (field_count, address, offset, whole) in LOCATED.items():
        if field_count < 1:
            raise CrosscheckError(f"{name}: zero fields")
        if not address.startswith('0x'):
            raise CrosscheckError(f"{name}: address is not a hex literal")
        if offset < 0:
            raise CrosscheckError(f"{name}: negative offset")
        if whole and offset != 0:
            raise CrosscheckError(f"{name}: a whole run cannot start at an offset")
    for address, members in SHARED_ADDRESSES:
        if len(members) < 2:
            raise CrosscheckError(f"{address}: a shared address needs two members")
        for m in members:
            if LOCATED.get(m, (0, ''))[1] != address:
                raise CrosscheckError(f"{m}: not recorded at its shared address")


def crosscheck_summary() -> Mapping[str, object]:
    validate_crosscheck()
    return MappingProxyType({
        'definitions': DEFINITION_TOTAL,
        'located': LOCATED_COUNT,
        'unlocated': UNLOCATED[0],
        'whole_runs': WHOLE_RUN_COUNT,
        'window_only': WINDOW_ONLY_COUNT,
        'shared_addresses': len(SHARED_ADDRESSES),
        'attested': LOCATED_ATTESTED,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
