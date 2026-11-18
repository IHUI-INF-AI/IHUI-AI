# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The literal-chart materialiser: turning literal values into a real workbook (R107).

R103 established a split: a chart built from inline literals (``c:v`` + ``c:strLit`` + ``c:numLit``,
no ``c:f``, no ``c:externalData``) is rejected in ``portable`` mode and accepted in ``powerpoint``
mode. That looked like a permanent dead end for literals. This round found the tool that closes
it: ``materialize_literal_chart_workbooks.py`` takes a literal-chart deck and writes an honest
embedded XLSX alongside, after which ``portable_chart_validation_passed`` comes back **true**.

Observed end to end:

    numlit.pptx (5,208 B)  ->  out.pptx (6,915 B)   rc=0
    converted_chart_count: 1
    workbook_part: ppt/embeddings/chart-data-snapshot-001.xlsx
    portable_chart_validation_passed: true

The receipt is an 18-field envelope and it is unusually careful about what it is *not* claiming:

* ``experimental: true`` and ``schema_version: experimental.literal-chart-workbook-snapshot.v1``
  -- it declares itself experimental in the schema name itself.
* ``new_formulas_describe_snapshot_only: true`` -- the new worksheet formulas describe the
  snapshot, nothing else.
* ``source_formulas_preserved: false`` and ``source_workbook_preserved: false`` -- it says
  outright that no original lineage was recovered.
* ``preserved_existing_workbook_chart_count: 0`` -- charts that already had a workbook are not
  touched.

And it *refuses* to be asked for something it cannot honestly deliver:

    --require-source-formulas-slide 1  ->
    {"error": "A literal snapshot cannot preserve expressly required original source formulas
              or workbook", "error_category": "SnapshotError", "ok": false}

So the tool will not be talked into a false provenance claim. That refusal is the most
interesting part of its contract.

**Four preconditions, each discovered by being rejected**:

    no args                 -> required: source, destination, --workspace, --receipt
    two positionals only    -> required: --workspace, --receipt
    relative paths          -> "requires exact absolute staged input/output/receipt/workspace paths"
    absolute but fake       -> "input must be an approved bounded staged PPTX"
    real literal deck       -> rc=0

The adjectives matter: an input must be **approved**, **bounded**, and **staged**, all three.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- the tool identity --------------------------------------------------------------

TOOL: Final = "materialize_literal_chart_workbooks.py"
TOOL_BYTES: Final = 36_864  # ~36 KB in the bundle
SELF_DESCRIPTION: Final = (
    "Experimental: snapshot complete literal chart data into an honest embedded XLSX. "
    "A snapshot creates new chart-owned worksheet formulas. It never recovers, preserves, "
    "or claims lineage to an original source workbook or its formulas."
)
DECLARES_EXPERIMENTAL_IN_PROSE: Final = True
DECLARES_EXPERIMENTAL_IN_SCHEMA: Final = True
SCHEMA_VERSION: Final = "experimental.literal-chart-workbook-snapshot.v1"

# --- arguments ----------------------------------------------------------------------

POSITIONAL_ARGS: Final = ("source", "destination")
REQUIRED_OPTIONS: Final = ("--workspace", "--receipt")
VALUE_OPTIONS: Final = ("--require-source-formulas-slide", "--require-source-workbook-slide")
REQUIRED_ARG_COUNT: Final = 4  # two positional + two options
ALL_ARGS_REQUIRED: Final = True

# --- the four preconditions, each learned from a rejection ---------------------------

STAGE_1_ERROR: Final = "required: source, destination, --workspace, --receipt"
STAGE_2_ERROR: Final = "required: --workspace, --receipt"
STAGE_3_ERROR: Final = (
    "Chart snapshot requires exact absolute staged input/output/receipt/workspace paths"
)
STAGE_4_ERROR: Final = "Chart snapshot input must be an approved bounded staged PPTX"
PRECONDITION_TRIAD: Final = ("approved", "bounded", "staged")
PRECONDITIONS_DISCOVERED_BY_REJECTION: Final = True
ALL_FOUR_PATHS_MUST_BE_ABSOLUTE: Final = True

# --- the refusal that matters most --------------------------------------------------

REFUSAL_ERROR: Final = (
    "A literal snapshot cannot preserve expressly required original source formulas or workbook"
)
REFUSES_FALSE_PROVENANCE: Final = True
REFUSAL_TRIGGERED_BY: Final = "--require-source-formulas-slide"
REFUSAL_EXIT_CODE: Final = 2

# --- the success envelope (18 fields, observed once) --------------------------------

ENVELOPE_KEYS: Final = (
    "conversion",
    "converted_chart_count",
    "converted_charts",
    "detected_chart_owner_slides",
    "experimental",
    "input_sha256",
    "new_formulas_describe_snapshot_only",
    "output_bytes",
    "output_sha256",
    "portable_chart_validation_passed",
    "portable_validated_owner_slides",
    "preserved_existing_workbook_chart_count",
    "preserved_existing_workbook_charts",
    "schema_version",
    "source_formula_required_slides",
    "source_formulas_preserved",
    "source_workbook_preserved",
    "source_workbook_required_slides",
)
ENVELOPE_KEY_COUNT: Final = 18
CONVERSION_KIND: Final = "chart_data_snapshot"

CONVERTED_CHART_KEYS: Final = (
    "chart_part",
    "owner_slide",
    "point_count",
    "series_count",
    "workbook_part",
)
CONVERTED_CHART_KEY_COUNT: Final = 5

CHART_PART: Final = "ppt/charts/chart1.xml"
WORKBOOK_PART: Final = "ppt/embeddings/chart-data-snapshot-001.xlsx"
WORKBOOK_SEQUENCE_FORM: Final = "chart-data-snapshot-<NNN>.xlsx"

# --- the observed conversion --------------------------------------------------------

OBSERVED_INPUT_BYTES: Final = 5_208
OBSERVED_OUTPUT_BYTES: Final = 6_915
OBSERVED_POINTS: Final = 3
OBSERVED_SERIES: Final = 1
OBSERVED_CHART_COUNT: Final = 1
PORTABLE_VALIDATION_PASSED: Final = True
OUTPUT_LARGER_THAN_INPUT: Final = True

# --- the honesty flags it sets itself -----------------------------------------------

NEW_FORMULAS_SNAPSHOT_ONLY: Final = True
SOURCE_FORMULAS_PRESERVED: Final = False
SOURCE_WORKBOOK_PRESERVED: Final = False
PRESERVED_EXISTING_WORKBOOK_CHARTS: Final = 0
NEVER_OVERWRITES_DESTINATION: Final = True

# --- what this closes ---------------------------------------------------------------

LITERALS_PORTABLE_BEFORE: Final = False
LITERALS_PORTABLE_AFTER: Final = True
CLOSES_R103_GAP: Final = True
EXIT_CODES: Final = (0, 2)  # success / usage-or-refusal


class LiteralMaterializeError(ValueError):
    """Raised when the honest-snapshot contract is softened."""


def precondition_triad_met(approved: bool, bounded: bool, staged: bool) -> bool:
    """An input needs all three adjectives, not any two."""
    return approved and bounded and staged


def refusal_matches_invocation(argv: tuple[str, ...]) -> bool:
    """Only an expressly-required source formula triggers the provenance refusal."""
    return "--require-source-formulas-slide" in argv or (
        "--require-source-workbook-slide" in argv
    )


def materialize_contract() -> Mapping[str, object]:
    """The contract as facts."""
    return {
        "required_args": REQUIRED_ARG_COUNT,
        "precondition_triad": PRECONDITION_TRIAD,
        "envelope_keys": ENVELOPE_KEY_COUNT,
        "portable_passed": PORTABLE_VALIDATION_PASSED,
        "refuses_false_provenance": REFUSES_FALSE_PROVENANCE,
        "closes_r103_gap": CLOSES_R103_GAP,
    }


def validate_materialize_contract() -> None:
    """Assert the contract, and above all that the honesty flags stay false."""
    if TOOL != "materialize_literal_chart_workbooks.py":
        raise LiteralMaterializeError("tool identity drifted")
    if "honest embedded XLSX" not in SELF_DESCRIPTION:
        raise LiteralMaterializeError("the self-description is evidence and must stay")
    if "never recovers, preserves, or claims lineage" not in SELF_DESCRIPTION:
        raise LiteralMaterializeError("the no-lineage clause must stay verbatim")
    if SCHEMA_VERSION != "experimental.literal-chart-workbook-snapshot.v1":
        raise LiteralMaterializeError("schema version drifted")
    if not SCHEMA_VERSION.startswith("experimental."):
        raise LiteralMaterializeError("the schema declares its own experimental status")

    if len(POSITIONAL_ARGS) != 2 or POSITIONAL_ARGS != ("source", "destination"):
        raise LiteralMaterializeError("two positionals")
    if len(REQUIRED_OPTIONS) != 2:
        raise LiteralMaterializeError("two required options")
    if len(VALUE_OPTIONS) != 2:
        raise LiteralMaterializeError("two value-taking options")
    if REQUIRED_ARG_COUNT != 4:
        raise LiteralMaterializeError(
            "four required arguments: source, destination, workspace, receipt"
        )
    if ALL_ARGS_REQUIRED is not True:
        raise LiteralMaterializeError("all four are required")

    if PRECONDITION_TRIAD != ("approved", "bounded", "staged"):
        raise LiteralMaterializeError("the triad is three adjectives")
    if not precondition_triad_met(True, True, True):
        raise LiteralMaterializeError("all three together")
    if precondition_triad_met(True, True, False):
        raise LiteralMaterializeError("staged alone is not optional")
    if precondition_triad_met(False, True, True):
        raise LiteralMaterializeError("approved alone is not optional")
    for msg in (STAGE_3_ERROR, STAGE_4_ERROR):
        if "staged" not in msg:
            raise LiteralMaterializeError("staged appears in both late-stage errors")

    if REFUSAL_ERROR not in (
        "A literal snapshot cannot preserve expressly required original source formulas "
        "or workbook"
    ):
        raise LiteralMaterializeError("refusal wording is evidence")
    if REFUSES_FALSE_PROVENANCE is not True:
        raise LiteralMaterializeError("the refusal is a feature, not a failure")
    if not refusal_matches_invocation(("--require-source-formulas-slide", "1")):
        raise LiteralMaterializeError("formulas flag triggers refusal")
    if not refusal_matches_invocation(("--require-source-workbook-slide", "1")):
        raise LiteralMaterializeError("workbook flag triggers refusal")
    if refusal_matches_invocation(("--workspace", "ws")):
        raise LiteralMaterializeError("an ordinary invocation does not refuse")

    if ENVELOPE_KEY_COUNT != 18 or len(ENVELOPE_KEYS) != 18:
        raise LiteralMaterializeError("eighteen envelope keys")
    if len(set(ENVELOPE_KEYS)) != 18:
        raise LiteralMaterializeError("no duplicate keys")
    if CONVERSION_KIND != "chart_data_snapshot":
        raise LiteralMaterializeError("conversion kind drifted")
    if CONVERTED_CHART_KEY_COUNT != 5 or len(CONVERTED_CHART_KEYS) != 5:
        raise LiteralMaterializeError("five per-chart keys")
    if WORKBOOK_PART != "ppt/embeddings/chart-data-snapshot-001.xlsx":
        raise LiteralMaterializeError("workbook part drifted")
    if "<NNN>" not in WORKBOOK_SEQUENCE_FORM:
        raise LiteralMaterializeError("the part name carries a sequence")

    if OBSERVED_INPUT_BYTES != 5_208 or OBSERVED_OUTPUT_BYTES != 6_915:
        raise LiteralMaterializeError("byte counts are the observed ones")
    if OBSERVED_OUTPUT_BYTES <= OBSERVED_INPUT_BYTES:
        raise LiteralMaterializeError(
            "the output grew: a workbook was added"
        )
    if OBSERVED_POINTS != 3 or OBSERVED_SERIES != 1:
        raise LiteralMaterializeError("three points in one series")
    if PORTABLE_VALIDATION_PASSED is not True:
        raise LiteralMaterializeError("portable validation passed")

    if NEW_FORMULAS_SNAPSHOT_ONLY is not True:
        raise LiteralMaterializeError("new formulas describe the snapshot only")
    if SOURCE_FORMULAS_PRESERVED is not False:
        raise LiteralMaterializeError("source formulas were not preserved")
    if SOURCE_WORKBOOK_PRESERVED is not False:
        raise LiteralMaterializeError("source workbook was not preserved")
    if PRESERVED_EXISTING_WORKBOOK_CHARTS != 0:
        raise LiteralMaterializeError("existing workbook charts were not touched")
    if NEVER_OVERWRITES_DESTINATION is not True:
        raise LiteralMaterializeError("destination is never overwritten")

    if LITERALS_PORTABLE_BEFORE is not False:
        raise LiteralMaterializeError("before this round literals failed portable")
    if LITERALS_PORTABLE_AFTER is not True:
        raise LiteralMaterializeError("after materialising they pass")
    if CLOSES_R103_GAP is not True:
        raise LiteralMaterializeError("this closes the R103 gap")
    if EXIT_CODES != (0, 2):
        raise LiteralMaterializeError("two exit codes were observed")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
