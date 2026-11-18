# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R79: the FIELDS array does not sit in front of the template (falsification #7).

R68 proved serde's `FIELDS` is a contiguous 16 B fat-pointer array, and R75 found 1244 templates
whose preceding bytes are pointer data / zeros rather than a name pool.  The natural hope: those
templates are preceded by their own FIELDS array, whose record order would then be the declaration
order.

Measured over all 3186 templates, scanning 512 B backwards at all 16 byte alignments: only **29**
templates have any legal (ptr → .rdata, len-matching, field-shaped) record run in front of them, and
only **5** of those runs reach the template's arity.  If the array were adjacent, the rate would be
the majority, not 0.9%.

So the missing field names for the ~1159 undocumented structs are **not** recoverable by reading
the template's neighbourhood — they live wherever the 15k/17k record runs of R68/R69 live, which is
hundreds of megabytes of `.rdata` and needs the run-first attribution of R68 rather than
template-first.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

FALSIFICATION_ID: Final[str] = "template-not-adjacent-to-fields-array"
TEMPLATE_FOLLOWS_FIELDS: Final[bool] = False
LOOKBACK_BYTES: Final[int] = 512
ALIGNMENTS_TRIED: Final[int] = 16
TEMPLATE_TOTAL: Final[int] = 3186
WITH_RECORD_RUN: Final[int] = 29
RUN_LENGTH_EQ_ARITY: Final[int] = 5

#: The five runs whose length happened to equal the template's arity.  None is attested: every one
#: has arity 1, and each record can equally belong to a neighbouring struct, so these are recorded
#: as observations and explicitly NOT promoted to reconstructions.
ADJACENT_PAIRS: Final[Mapping[str, str]] = MappingProxyType({
    "CloudConfigTomlBundle": "operationId",
    "CloudRequirementsTomlBundle": "platform",
    "ConfigurationReasoning": "update",
    "ErrorDetail": "platform",
    "SkillDependencies": "tool_result",
})
ADJACENT_PAIRS_ATTESTED: Final[bool] = False


class AdjacencyError(ValueError):
    """Raised when the adjacency claim stops being a falsification."""


def recurrence_rate() -> float:
    return WITH_RECORD_RUN / TEMPLATE_TOTAL


def validate_adjacency() -> None:
    if TEMPLATE_FOLLOWS_FIELDS:
        raise AdjacencyError("recorded as adjacent, contradicting the measurement")
    if WITH_RECORD_RUN > TEMPLATE_TOTAL:
        raise AdjacencyError("more runs than templates")
    if RUN_LENGTH_EQ_ARITY > WITH_RECORD_RUN:
        raise AdjacencyError("more arity matches than runs")
    if recurrence_rate() >= 0.10:
        raise AdjacencyError(
            f"{recurrence_rate():.1%} of templates carry a record run — that is common enough "
            f"that the array may be adjacent after all")
    if ADJACENT_PAIRS_ATTESTED:
        raise AdjacencyError("these pairs were never attested; flipping the flag is unsupported")
    if len(ADJACENT_PAIRS) != RUN_LENGTH_EQ_ARITY:
        raise AdjacencyError("pair count disagrees with the measured arity matches")


def adjacency_summary() -> Mapping[str, object]:
    validate_adjacency()
    return MappingProxyType({
        "id": FALSIFICATION_ID,
        "templates": TEMPLATE_TOTAL,
        "with_record_run": WITH_RECORD_RUN,
        "run_eq_arity": RUN_LENGTH_EQ_ARITY,
        "recurrence_pct": round(recurrence_rate() * 100, 2),
        "template_follows_fields": TEMPLATE_FOLLOWS_FIELDS,
        "pairs_attested": ADJACENT_PAIRS_ATTESTED,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
