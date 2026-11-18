# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Hook field descriptions (A6), R91.

A6 asked for the semantics behind the schema descriptions.  Of **170** properties exactly **12** carry one,
and they cover **2** fields: `reason` and `turn_id`.  Two texts, not one:

| field | copies | text |
| --- | --- | --- |
| `turn_id` | 10 | "Codex extension: expose the active turn id to internal turn-scoped hooks." |
| `reason` | 2 | "Claude requires `reason` when `decision` is `block`; we enforce that semantic rule during output parsing rather than in the JSON schema." |

The first is what A6 expected: an extension field documented once and repeated into every
turn-scoped input contract.

**The second is the finding.** It states, in the schema author's own words, that the contract has
a rule the schema cannot express — `reason` is required exactly when `decision` is `"block"` — and
that this rule is enforced **outside** the schema, during output parsing.  That is a cross-field
constraint, and it is the only such statement anywhere in the 23 recovered schemas.

It also explains a shape R63 recorded without explaining: `subagent-stop.command.output` and
`stop.command.output` both declare `decision` and `reason` with `required: []`.  Under a strict
schema reading both are optional; under the real contract, `decision == "block"` without `reason`
is invalid.  The gap between those two readings is exactly what the description describes.

`HOOK_SEMANTIC_RULES` below carries that constraint as data so `hook_contract_runtime_check` can
enforce it; this module only records what the author wrote.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

DESCRIPTION_COUNT: Final[int] = 12
DESCRIBED_FIELDS: Final[int] = 2
UNIQUE_TEXTS: Final[int] = 2
PROPERTY_TOTAL: Final[int] = 170
UNDESCRIBED_PROPERTIES: Final[int] = PROPERTY_TOTAL - DESCRIPTION_COUNT

#: The description texts, verbatim.
TEXTS: Final[tuple[str, ...]] = (
    'Claude requires `reason` when `decision` is `block`; we enforce that semantic rule during output parsing rather than in the JSON schema.',
    'Codex extension: expose the active turn id to internal turn-scoped hooks.',
)

#: field -> title -> description
DESCRIPTIONS: Final[Mapping[str, Mapping[str, str]]] = MappingProxyType({
    'reason': MappingProxyType({
        'stop.command.output': 'Claude requires `reason` when `decision` is `block`; we enforce that semantic rule during output parsing rather than in the JSON schema.',
        'subagent-stop.command.output': 'Claude requires `reason` when `decision` is `block`; we enforce that semantic rule during output parsing rather than in the JSON schema.',
    }),
    'turn_id': MappingProxyType({
        'interrupt.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'permission-request.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'post-compact.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'post-tool-use.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'pre-compact.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'pre-tool-use.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'stop.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'subagent-start.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'subagent-stop.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
        'user-prompt-submit.command.input': 'Codex extension: expose the active turn id to internal turn-scoped hooks.',
    }),
})

#: The cross-field rule the `reason` description states: decision=block requires reason.
BLOCK_REQUIRES_REASON: Final[bool] = True
#: Schemas that declare both `decision` and `reason` (where the rule can bite).
BLOCK_RULE_TITLES: Final[tuple[str, ...]] = (
    'stop.command.output',
    'subagent-stop.command.output',
)


class FieldDescriptionError(ValueError):
    """Raised when the description table contradicts itself."""


def description_of(field: str, title: str) -> str:
    """The description for one field in one schema; empty when none was written."""
    return DESCRIPTIONS.get(field, MappingProxyType({})).get(title, "")


def described_fields() -> tuple[str, ...]:
    return tuple(sorted(DESCRIPTIONS))


def validate_field_descriptions() -> None:
    from app.core.hook_contract_schema import HOOK_SCHEMA_FIELDS

    if len(DESCRIPTIONS) != DESCRIBED_FIELDS:
        raise FieldDescriptionError("described field count disagrees")
    if len(TEXTS) != UNIQUE_TEXTS:
        raise FieldDescriptionError("unique text count disagrees")
    if sum(len(v) for v in DESCRIPTIONS.values()) != DESCRIPTION_COUNT:
        raise FieldDescriptionError("row count disagrees")
    if UNDESCRIBED_PROPERTIES <= 0:
        raise FieldDescriptionError("some property must be undescribed")
    for field, titles in DESCRIPTIONS.items():
        for title, text in titles.items():
            if title not in HOOK_SCHEMA_FIELDS:
                raise FieldDescriptionError(f"{title}: not a recovered schema")
            if field not in HOOK_SCHEMA_FIELDS[title]:
                raise FieldDescriptionError(f"{title}: described field {field} not declared")
            if not text:
                raise FieldDescriptionError(f"{field}@{title}: empty description")
    if not BLOCK_REQUIRES_REASON:
        raise FieldDescriptionError("the block/reason rule is stated in the schema")
    for title in BLOCK_RULE_TITLES:
        declared = HOOK_SCHEMA_FIELDS[title]
        if "decision" not in declared or "reason" not in declared:
            raise FieldDescriptionError(f"{title}: rule target lacks decision/reason")


def field_description_summary() -> Mapping[str, object]:
    validate_field_descriptions()
    return MappingProxyType({
        'descriptions': DESCRIPTION_COUNT,
        'fields': DESCRIBED_FIELDS,
        'unique_texts': UNIQUE_TEXTS,
        'undescribed': UNDESCRIBED_PROPERTIES,
        'block_rule_titles': len(BLOCK_RULE_TITLES),
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
