# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Runtime checks over the extracted hook contract (A12, R90).

R63/R64 recovered the 23 hook JSON Schemas from the binary and turned them into data:
`HOOK_SCHEMA_FIELDS`, `HOOK_SCHEMA_REQUIRED`, and their accessors.  This module turns that data into
a callable check, so the contract stops being a table and starts being something that can reject a
payload.

Three violations are distinguishable, deliberately:

| kind | meaning |
| --- | --- |
| `unknown-schema` | the payload claims a schema that does not exist in the binary |
| `unknown-field` | the schema says `additionalProperties: false` and a key is not in `properties` |
| `missing-required` | a key in `required` is absent |

`unknown-field` and `missing-required` are reported together rather than short-circuiting, because a
caller fixing a payload wants the whole list, not one line per round trip.

What this is **not**: it does not validate field *types*.  The schemas carry `"type"` per property,
and this module deliberately does not interpret it — type checking needs the `oneOf`/`anyOf`/`$ref`
resolution that only a real JSON Schema engine does correctly, and a half-implemented one would
reject valid payloads.  `check_hook_payload` answers exactly the question the recovered data can
answer: are the key sets right.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Final, Literal

from app.core.hook_contract_schema import (
    HOOK_SCHEMA_FIELDS,
    HOOK_SCHEMA_NAMES,
    HOOK_SCHEMA_REQUIRED,
)

ViolationKind = Literal["unknown-schema", "unknown-field", "missing-required"]

DIRECTIONS: Final[tuple[str, str]] = ("input", "output")


class HookPayloadError(ValueError):
    """Raised when a payload cannot be checked at all (wrong shape, unknown schema)."""


@dataclass(frozen=True, slots=True)
class Violation:
    kind: ViolationKind
    field: str


@dataclass(frozen=True, slots=True)
class CheckResult:
    """Outcome of one payload check.  `ok` is true only when `violations` is empty."""

    title: str
    checked_fields: int
    violations: tuple[Violation, ...]

    @property
    def ok(self) -> bool:
        return not self.violations


def schema_title(event: str, direction: str) -> str:
    """Compose the schema title the binary uses: `<event>.command.<direction>`."""
    if direction not in DIRECTIONS:
        raise HookPayloadError(f"direction must be one of {DIRECTIONS}, got {direction!r}")
    title = f"{event}.command.{direction}"
    if title not in HOOK_SCHEMA_NAMES:
        raise HookPayloadError(f"no schema for {title!r}")
    return title


def check_hook_payload(title: str, payload: Mapping[str, object]) -> CheckResult:
    """Check one payload against one recovered schema.

    The key set is the whole judgement: every key must be declared in `properties`, and every key
    in `required` must be present.  Values are not inspected.
    """
    if title not in HOOK_SCHEMA_NAMES:
        raise HookPayloadError(f"unknown schema title {title!r}")
    if not isinstance(payload, Mapping):
        raise HookPayloadError("payload must be a mapping")

    declared = HOOK_SCHEMA_FIELDS[title]
    required = HOOK_SCHEMA_REQUIRED[title]
    declared_set = set(declared)

    unknown = tuple(Violation("unknown-field", k) for k in sorted(payload) if k not in declared_set)
    missing = tuple(Violation("missing-required", k) for k in sorted(required) if k not in payload)
    return CheckResult(title=title, checked_fields=len(payload), violations=unknown + missing)


def check_hook_event(event: str, direction: str,
                     payload: Mapping[str, object]) -> CheckResult:
    """Convenience wrapper: build the title from event + direction, then check."""
    return check_hook_payload(schema_title(event, direction), payload)


def minimal_payload(title: str) -> Mapping[str, None]:
    """A payload that satisfies `required` and nothing else — the smallest legal shape."""
    if title not in HOOK_SCHEMA_NAMES:
        raise HookPayloadError(f"unknown schema title {title!r}")
    return MappingProxyType(dict.fromkeys(HOOK_SCHEMA_REQUIRED[title]))


def audit_all_schemas() -> Mapping[str, CheckResult]:
    """Run the minimal payload through every schema — a self-check, not a payload check.

    If any schema rejects its own `required` set, the recovered table is internally inconsistent
    and the module must not be trusted.  The test asserts every result is ok.
    """
    out = {}
    for title in sorted(HOOK_SCHEMA_NAMES):
        out[title] = check_hook_payload(title, minimal_payload(title))
    return MappingProxyType(out)


def violations_summary(results: Mapping[str, CheckResult]) -> Mapping[str, int]:
    counts: dict[str, int] = dict.fromkeys(
        ("unknown-schema", "unknown-field", "missing-required"), 0)
    for r in results.values():
        for v in r.violations:
            counts[v.kind] += 1
    return MappingProxyType(counts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
