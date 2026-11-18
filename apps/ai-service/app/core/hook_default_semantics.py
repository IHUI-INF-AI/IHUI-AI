# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Hook `default` semantics (A9), R91.

The 23 recovered schemas carry **57** `default` values, and their types are remarkably narrow:
**20 booleans** and **37 nulls**.  There is not one array, object, number,
or string default in the whole set.

That narrowness is the useful fact.  A `default` in a JSON Schema means "when producing output,
emit this value for an absent optional field" — the serde side of the same thing is
`#[serde(default)]` plus a default value the type already has.  With only `true`/`false`/`null`
in play, the semantics can be reproduced exactly, with no type coercion guesswork:

- absent field with a `bool` default  → the boolean
- absent field with a `null` default  → `None`
- field present                       → left untouched, whatever it holds

That is what `apply_defaults` does, and nothing more.  It does not validate, and it does not
invent defaults for fields the schema gives none — an absent `agent_id` stays absent.

Where the nulls come from is worth stating plainly, and it splits into two groups:

- **11** properties declare no `type` at all and carry `"default": null` — the schema spelling
  of an optional field whose value may be absent.
- **26** properties declare **`"type": "string"`** and still carry `"default": null`.  That is legal
  JSON Schema and semantically inconsistent intent: the type says "a string", the default says "no
  value".  On the Rust side this is `Option<String>` serialized as `None`, and the schema's `type`
  simply forgot the `"null"` half.  It is counted as `NULL_ON_TYPED = 26`, not raised as an
  error, because the recovered data is what it is — editing it to look tidier would be inventing.

So the 37 nulls are not "a default of null" in the Rust sense; they are the schema declaring
a nullable default.  The practical output is the same, which is why the function treats them the
same — but the distinction is recorded here so nobody later reads `None` as evidence of a serde
attribute.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

DEFAULT_COUNT: Final[int] = 57
BOOL_DEFAULTS: Final[int] = 20
NULL_DEFAULTS: Final[int] = 37
#: Null defaults that sit on a declared non-null type — a schema self-inconsistency, counted.
NULL_ON_TYPED: Final[int] = 26
UNTYPED_NULLS: Final[int] = 11

#: title -> field -> (default value, schema type declaration)
DEFAULTS: Final[Mapping[str, Mapping[str, tuple[object, str]]]] = MappingProxyType({
    'interrupt.command.output': MappingProxyType({
        'systemMessage': (None, '"string"'),
    }),
    'permission-request.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'hookSpecificOutput': (None, 'null'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'post-compact.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'post-tool-use.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'decision': (None, 'null'),
        'hookSpecificOutput': (None, 'null'),
        'reason': (None, '"string"'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'pre-compact.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'pre-tool-use.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'decision': (None, 'null'),
        'hookSpecificOutput': (None, 'null'),
        'reason': (None, '"string"'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'session-start.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'hookSpecificOutput': (None, 'null'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'stop.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'decision': (None, 'null'),
        'reason': (None, '"string"'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'subagent-start.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'hookSpecificOutput': (None, 'null'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'subagent-stop.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'decision': (None, 'null'),
        'reason': (None, '"string"'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
    'user-prompt-submit.command.output': MappingProxyType({
        'continue': (True, '"boolean"'),
        'decision': (None, 'null'),
        'hookSpecificOutput': (None, 'null'),
        'reason': (None, '"string"'),
        'stopReason': (None, '"string"'),
        'suppressOutput': (False, '"boolean"'),
        'systemMessage': (None, '"string"'),
    }),
})

DEFAULT_TITLES: Final[tuple[str, ...]] = (
    'interrupt.command.output',
    'permission-request.command.output',
    'post-compact.command.output',
    'post-tool-use.command.output',
    'pre-compact.command.output',
    'pre-tool-use.command.output',
    'session-start.command.output',
    'stop.command.output',
    'subagent-start.command.output',
    'subagent-stop.command.output',
    'user-prompt-submit.command.output',
)


class DefaultSemanticsError(ValueError):
    """Raised when a default contradicts its declared type or the schema."""


def _schema(title: str):
    from app.core.hook_contract_schema import HOOK_SCHEMA_FIELDS

    if title not in HOOK_SCHEMA_FIELDS:
        raise DefaultSemanticsError(f"{title!r} is not a recovered schema")
    return HOOK_SCHEMA_FIELDS[title]


def defaults_for(title: str) -> Mapping[str, tuple[object, str]]:
    """The declared defaults of one schema; empty when it declares none."""
    _schema(title)
    return DEFAULTS.get(title, MappingProxyType({}))


def apply_defaults(title: str, payload: Mapping[str, object]) -> Mapping[str, object]:
    """Fill absent fields that declare a default.  Present fields are never touched."""
    declared = defaults_for(title)
    out = dict(payload)
    for field, (value, _type) in declared.items():
        if field not in out:
            out[field] = value
    return MappingProxyType(out)


def missing_defaults(title: str, payload: Mapping[str, object]) -> tuple[str, ...]:
    """Fields that would be filled by `apply_defaults`."""
    return tuple(sorted(f for f in defaults_for(title) if f not in payload))


def validate_defaults() -> None:
    if BOOL_DEFAULTS + NULL_DEFAULTS != DEFAULT_COUNT:
        raise DefaultSemanticsError("bool + null defaults must equal the total")
    if NULL_ON_TYPED + UNTYPED_NULLS != NULL_DEFAULTS:
        raise DefaultSemanticsError("null default split does not add up")
    seen = 0
    for title, fields in DEFAULTS.items():
        declared = _schema(title)
        for field, (value, ftype) in fields.items():
            seen += 1
            if field not in declared:
                raise DefaultSemanticsError(f"{title}: default for undeclared field {field}")
            if value is None:
                # a null default is legal on any declared type; mismatches are counted, not raised
                pass
            elif isinstance(value, bool):
                if '"boolean"' not in ftype:
                    raise DefaultSemanticsError(f"{title}.{field}: bool default, non-bool type")
            else:
                raise DefaultSemanticsError(f"{title}.{field}: unsupported default kind")
    if seen != DEFAULT_COUNT:
        raise DefaultSemanticsError("row count disagrees with DEFAULT_COUNT")


def default_summary() -> Mapping[str, object]:
    validate_defaults()
    return MappingProxyType({
        'total': DEFAULT_COUNT,
        'bool': BOOL_DEFAULTS,
        'null': NULL_DEFAULTS,
        'null_on_typed': NULL_ON_TYPED,
        'schemas': len(DEFAULTS),
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
