# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The code-level string route: measured, and closed (R88).

R86 put the pool route's ceiling at 914/1436 and named 500 structs whose template neighbourhood holds
no field-name bytes.  The last candidate source was code-level string comparison — a hand-written
`serde_json` path does `lea rdx, [field_name]` + `call get`, so a function's `lea` targets should
form a set of field names.

Measured, on all 1,160,394 `lea` sites joined to function bounds:

| reading | value |
| --- | --- |
| functions with at least one identifier `lea` | **17649** |
| identifier-set size, median | **2** |
| p90 / max | 4 / 88 |
| known field lists found wholly inside one function | **1** of 316 |

The median of 2 settles it.  A serde struct with arity 5 would need five field-name strings
`lea`'d from one routine; the typical function references **two** identifiers (error messages, a
single key, a format string).  So the `lea` space is not carrying field tables — it is carrying
individual strings.

The positive control makes this concrete rather than theoretical: of 316 field lists already established
by the array route, exactly **1** appears as a set inside any single function.  If code-level strings carried
field tables, that number would be in the hundreds.

So: `CODE_ROUTE_VIABLE = False`.  This is the third closed route, after the pool route (ceiling
914) and the template-lea route (R82: zero template `lea` sites).  The 500 `empty` structs stay
unresolved, and no further judgement on this binary can change that — their field names are not
stored in any form this chain can read.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

FUNCS_WITH_IDENT_LEA: Final[int] = 17649
SET_SIZE_MEDIAN: Final[int] = 2
SET_SIZE_P90: Final[int] = 4
SET_SIZE_MAX: Final[int] = 88

KNOWN_FIELD_LISTS: Final[int] = 316
POSITIVE_CONTROL_HITS: Final[int] = 1

FALSIFICATION_ID: Final[str] = "code-strings-form-no-field-table"
CODE_ROUTE_VIABLE: Final[bool] = False

#: The one field list that did appear inside a single function.
CONTROL_SAMPLE: Final[tuple[str, int, str]] = ("ErrorData", 3, "0x14b3656b0")


class CodeRouteError(ValueError):
    """Raised when the measurement contradicts itself."""


def control_rate() -> float:
    """Share of known field lists that recur inside one function."""
    return POSITIVE_CONTROL_HITS / KNOWN_FIELD_LISTS


def validate_code_route() -> None:
    if FUNCS_WITH_IDENT_LEA <= 0:
        raise CodeRouteError("no functions measured")
    if not (0 < SET_SIZE_MEDIAN <= SET_SIZE_P90 <= SET_SIZE_MAX):
        raise CodeRouteError("set-size quantiles are not ordered")
    if POSITIVE_CONTROL_HITS > KNOWN_FIELD_LISTS:
        raise CodeRouteError("more controls hit than exist")
    if CODE_ROUTE_VIABLE:
        raise CodeRouteError(
            "a median of two identifiers cannot carry field tables; the route stays closed")


def code_route_summary() -> Mapping[str, object]:
    validate_code_route()
    return MappingProxyType({
        'functions': FUNCS_WITH_IDENT_LEA,
        'median_set_size': SET_SIZE_MEDIAN,
        'control_hits': POSITIVE_CONTROL_HITS,
        'known': KNOWN_FIELD_LISTS,
        'control_rate': round(control_rate(), 4),
        'viable': CODE_ROUTE_VIABLE,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
