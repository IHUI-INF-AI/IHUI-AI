# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Attribution frontier for the codex.exe struct contract (R67).

Single source of truth for two facts that the previous rounds established by measurement:

1. which structs still have an *unknown* field list, with the arity read from the

   embedded ``struct X with N elements`` template;
2. which attribution methods have been **falsified on this binary**, with the numbers

   that falsified them, so they are not retried.

The module holds no field names for the frontier structs on purpose: a field name that

was not verified would poison the R65 contract and the R66 drift baseline.

Numbers are measured, not estimated: see ``MEASUREMENTS`` and the R67 report.

::

    frontier = unknown_struct_fields()
    assert frontier["ThreadStartParams"].arity == 27
    assert not can_string_methods_settle("ThreadStartParams")
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class FrontierStruct:

    """A struct whose arity is known while its field list is not."""

    name: str
    arity: int
    template_va: str
    template_prefix_tail: str
    blocker: str

    @property
    def fields_known(self) -> bool:
        return False


@dataclass(frozen=True)
class FalsifiedMethod:

    """An attribution method that was measured and rejected on this binary."""

    method_id: str
    axis: str
    why_falsified: str
    round_id: str



FRONTIER_STRUCTS: Final[Mapping[str, FrontierStruct]] = {
    'ThreadStartParams': FrontierStruct(
        name='ThreadStartParams',
        arity=27,
        template_va='0x151b6a5e6',
        template_prefix_tail='tedCapabilityRootsmockExperimentalFieldexperimentalRawEvents',
        blocker="the pre-template field text has no pointer run and no gift-quality tail",
    ),
    'TurnStartParams': FrontierStruct(
        name='TurnStartParams',
        arity=28,
        template_va='0x151b68ed4',
        template_prefix_tail='utputSchemacollaborationModemultiAgentModecyberAccessProgram',
        blocker="the pre-template field text has no pointer run and no gift-quality tail",
    ),
}

#: Frontier entries that R68 closed by measurement. Kept beside the frontier (not deleted)
#: so this module still records *how* they were settled and by which evidence.
RESOLVED_BY_R68: Final[Mapping[str, str]] = {
    'ConfigRequirementsToml': (
        "16-byte (ptr,len) record run at 0x151cc6138: 48 records, first 46 == arity, "
        "tail pair belongs to a neighbour 2-field table -> app/core/struct_fields_fat_pointer.py"
    ),
}

FALSIFIED_METHODS: Final[tuple[FalsifiedMethod, ...]] = (
    FalsifiedMethod(
        method_id='distance-scan',
        axis='code address <- table address',
        why_falsified='947,729 byte distances leave 2,197 tables indistinguishable',
        round_id='R65',
    ),
    FalsifiedMethod(
        method_id='content-contains',
        axis='string containment',
        why_falsified='0 templates whose body contains the whole field list of a sibling',
        round_id='R65',
    ),
    FalsifiedMethod(
        method_id='address-contains',
        axis='address containment',
        why_falsified="0 table runs inside a template's code address range",
        round_id='R65',
    ),
    FalsifiedMethod(
        method_id='coverage-union',
        axis='byte coverage',
        why_falsified='0 structs covered by the union of merged runs',
        round_id='R65',
    ),
    FalsifiedMethod(
        method_id='whole-table-suffix',
        axis='table suffix',
        why_falsified='0 hits: an N-entry run never ends where a template begins',
        round_id='R65',
    ),
    FalsifiedMethod(
        method_id='arity-only',
        axis='count match',
        why_falsified='collides with 2 decoy tables (24-item Windows capabilities, 28-item orchestrator codes)',
        round_id='R65',
    ),
    FalsifiedMethod(
        method_id='pdata-same-function',
        axis='function boundary',
        why_falsified='template fn set (18) and table fn set {351994, 954287} intersect at 0',
        round_id='R66',
    ),
    FalsifiedMethod(
        method_id='pdata-in-function-slice',
        axis='function boundary',
        why_falsified='0 distinct slices for all 4 anchors',
        round_id='R66',
    ),
    FalsifiedMethod(
        method_id='data-section-slice',
        axis='function boundary',
        why_falsified='0 slices after adding .data (1,033,156 refs, 68 extra tables)',
        round_id='R66',
    ),
    FalsifiedMethod(
        method_id='pair-record-end',
        axis='16-byte record',
        why_falsified='1,323/2,661 records end at a template end yet 0 segregate: len equals the template literal'
                        ' (R68 narrowed: refutes len-as-length only, not array-as-record-run)',
        round_id='R67',
    ),
    FalsifiedMethod(
        method_id='plain-tail-min-segmentation',
        axis='dictionary segmentation',
        why_falsified='945 unique tails, 30/41 suffix agreement (0.732) against R65 ground truth; 3 frontier structs get no tail',
        round_id='R67',
    ),
    FalsifiedMethod(
        method_id='gap-stitched-segmentation',
        axis='dictionary segmentation',
        why_falsified='1/2661 segment after stitching <=24-byte gaps',
        round_id='R67',
    ),
)

MEASUREMENTS: Final[Mapping[str, float]] = {
    'templates': 2661,
    'bodies': 1706,
    'unique_tails': 945,
    'tail_suffix_ok': 30,
    'tail_suffix_mismatch': 11,
    'tail_accuracy': 0.732,
    'record_ends': 1323,
    'segmented_after_stitch': 1,
    'attributed_structs': 44,
    'record_runs_scanned': 15234,
    'resolved_by_r68': 1,
}


def resolved_structs() -> Mapping[str, str]:

    """Frontier entries closed by later rounds, with the evidence that closed them."""

    return dict(RESOLVED_BY_R68)


def frontier_structs() -> Mapping[str, FrontierStruct]:

    """Read-only view of the structs that still need field-list attribution."""

    return dict(FRONTIER_STRUCTS)


def unknown_struct_fields() -> dict[str, tuple[str, ...]]:

    """Frontier as ``{struct: ()}`` — empty tuple means "not yet attributed"."""

    out: dict[str, tuple[str, ...]] = {}
    for name in FRONTIER_STRUCTS:
        out[name] = ()
    return out


def falsified_methods() -> frozenset[FalsifiedMethod]:

    """Every attribution method that was rejected by measurement."""

    return frozenset(FALSIFIED_METHODS)


def can_string_methods_settle(name: str) -> bool:

    """False for every frontier struct: string-side evidence is exhausted there."""

    struct = FRONTIER_STRUCTS.get(name)
    if struct is None:
        raise KeyError(f"{name!r} is not on the attribution frontier")
    return False


def validate_frontier(attributed: Mapping[str, tuple[str, ...]]) -> None:

    """Check the frontier against an attributed contract (R65 shape).

    Raises ValueError when a frontier struct is already attributed (the frontier is
    stale) or when an arity is not a positive integer.
    """

    for name, struct in FRONTIER_STRUCTS.items():
        if name in attributed and attributed[name]:
            raise ValueError(f"frontier struct {name!r} is already attributed; update the frontier")
        if isinstance(struct.arity, bool) or struct.arity < 1:
            raise ValueError(f"frontier struct {name!r} has a non-positive arity")
        if struct.template_va.lower().startswith("0x") is False:
            raise ValueError(f"frontier struct {name!r} has a malformed template address")
        if name in RESOLVED_BY_R68:
            raise ValueError(f"frontier struct {name!r} was already resolved by R68; drop it from the frontier")


def ensure_frontier_consistent(attributed: Mapping[str, tuple[str, ...]]) -> None:

    """Assert-style wrapper used by the risk path."""

    validate_frontier(attributed)

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
