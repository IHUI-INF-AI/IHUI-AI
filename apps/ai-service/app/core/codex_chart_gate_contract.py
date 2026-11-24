# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Chart gate contract, observed by running it against a synthesised deck (R99).

Two findings worth recording:

* the gate's own schema prefix is ``owner-private`` -- not the ``presentation-native-*`` family
  the other gates use, so there are at least two schema namespaces in one bundle;
* supplying ``--expected-chart-slides 1`` against a deck whose chart the gate does not
  recognise produces ``required_native_chart_missing`` with ``native_chart_count: 0`` --
  a useful negative: a structurally referenced chart part is not enough, something further
  is required before the gate counts it.

Also observed: several flags that look boolean actually take a value, and passing them bare
yields a usage error (rc=2) rather than a verdict. That cost one round to notice, so it is
recorded here as a fact rather than a footnote.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

GATE: Final = "native_quantitative_chart_gate"

# --- schema namespaces ----------------------------------------------------------------

OWNER_PRIVATE_PREFIX: Final = "owner-private"
NATIVE_PREFIX: Final = "presentation-native-"

GATE_SCHEMA: Final = "owner-private.quantitative-chart-native-gate.v1"
DISCOVERY_SCHEMA: Final = "owner-private.actual-native-chart-discovery.v1"
SCHEMA_NAMESPACE_COUNT: Final = 2
OWNER_PRIVATE_SCHEMA_COUNT: Final = 2

# --- passing its own scope declaration ------------------------------------------------

CLAIM_BOUNDARY: Final = (
    "OOXML/workbook structural validation only; source provenance and native PowerPoint "
    "opening remain separate checks."
)
INSPECTS_SOURCE_PROVENANCE: Final = False
OPENS_NATIVE_POWERPOINT: Final = False
ACCESSES_SOURCE_ATTACHMENTS: Final = False

# --- result envelope ------------------------------------------------------------------

TOP_LEVEL_KEYS: Final = (
    "schema_version",
    "passed",
    "package_sha256",
    "claim_boundary",
    "expected_quantitative_chart_slides",
    "validated_slide_count",
    "failed_slide_count",
    "failed_slides",
    "results",
    "slide_count",
    "source_attachments_accessed",
    "native_application_open_verified",
    "formal_human_reviewed",
)
RESULT_KEYS: Final = (
    "slide_number",
    "status",
    "native_chart_count",
    "required_native_chart_count",
    "raster_picture_count",
    "approved_source_figure_exception",
    "failure_codes",
)
RESULT_STATUSES: Final = ("failed", "passed")
SHA_IS_PACKAGE_LEVEL: Final = True

DISCOVERY_KEYS: Final = (
    "schema_version",
    "slide_count",
    "chart_count",
    "chart_counts",
    "chart_owner_slides",
    "chart_owner_slide_parts",
    "source_required_chart_owners_inferred",
    "source_attachments_accessed",
    "package_sha256",
)

# --- failure codes --------------------------------------------------------------------

FAILURE_CODES: Final = ("required_native_chart_missing",)
FAILURE_CODE_COUNT: Final = 1
NATIVE_CHART_COUNT_WAS_ZERO: Final = True

# --- flags that take a value despite looking boolean ----------------------------------

VALUE_TAKING_FLAGS: Final = (
    "--require-native-table-slide",
    "--require-editorial-slide",
    "--require-embedded-workbook-slide",
    "--receipt",
    "--approved-source-figure",
    "--target-application",
    "--expected-chart-slides",
)
BARE_FLAG_YIELDS_USAGE_RC: Final = 2

# --- observed exit codes --------------------------------------------------------------

RC_PASS: Final = 0
RC_FINDINGS: Final = 1
RC_USAGE: Final = 2


class ChartGateContractError(ValueError):
    """Raised when a chart-gate fact is softened or mis-attributed."""


def schema_namespace_of(schema: str) -> str:
    """Namespace prefix of a schema string."""
    if schema.startswith(OWNER_PRIVATE_PREFIX):
        return OWNER_PRIVATE_PREFIX
    if schema.startswith(NATIVE_PREFIX):
        return NATIVE_PREFIX
    raise ChartGateContractError(f"unknown schema namespace: {schema!r}")


def requires_value(flag: str) -> bool:
    """Whether the flag needs an argument."""
    return flag in VALUE_TAKING_FLAGS


def failure_code_of(result: Mapping[str, object]) -> str:
    """First failure code in a result entry, or raise."""
    codes = result.get("failure_codes")
    if not isinstance(codes, list) or not codes:
        raise ChartGateContractError("result carries no failure_codes")
    first = codes[0]
    if not isinstance(first, str):
        raise ChartGateContractError("failure code must be a string")
    return first


def passed_from(results: list[Mapping[str, object]]) -> bool:
    """Whether an overall run passes, given per-slide results."""
    return all(r.get("status") == "passed" for r in results)


def chart_gate_contract() -> Mapping[str, object]:
    """Return the chart-gate contract as a plain mapping."""
    return {
        "schemas": OWNER_PRIVATE_SCHEMA_COUNT,
        "namespaces": SCHEMA_NAMESPACE_COUNT,
        "failure_codes": FAILURE_CODE_COUNT,
        "opens_powerpoint": OPENS_NATIVE_POWERPOINT,
        "value_flags": len(VALUE_TAKING_FLAGS),
    }


def validate_chart_gate_contract() -> None:
    """Assert the chart-gate facts, including that its schema is NOT the native family."""
    if schema_namespace_of(GATE_SCHEMA) != OWNER_PRIVATE_PREFIX:
        raise ChartGateContractError("chart gate schema uses the owner-private namespace")
    if schema_namespace_of(DISCOVERY_SCHEMA) != OWNER_PRIVATE_PREFIX:
        raise ChartGateContractError("discovery schema uses owner-private too")
    if OWNER_PRIVATE_SCHEMA_COUNT != 2:
        raise ChartGateContractError("two owner-private schemas were observed")
    if SCHEMA_NAMESPACE_COUNT != 2:
        raise ChartGateContractError("the bundle carries two schema namespaces")
    if GATE_SCHEMA.endswith(".v1") is False:
        raise ChartGateContractError("chart gate schema must carry .v1")

    if not CLAIM_BOUNDARY.startswith("OOXML/workbook structural validation only"):
        raise ChartGateContractError("claim boundary drifted")
    if INSPECTS_SOURCE_PROVENANCE is not False:
        raise ChartGateContractError("the gate says provenance is a separate check")
    if OPENS_NATIVE_POWERPOINT is not False:
        raise ChartGateContractError("the gate says PowerPoint opening is a separate check")
    if ACCESSES_SOURCE_ATTACHMENTS is not False:
        raise ChartGateContractError("source attachments were not accessed")

    if len(TOP_LEVEL_KEYS) != 13:
        raise ChartGateContractError(f"expected 13 envelope keys, got {len(TOP_LEVEL_KEYS)}")
    if len(RESULT_KEYS) != 7:
        raise ChartGateContractError(f"expected 7 result keys, got {len(RESULT_KEYS)}")
    if len(DISCOVERY_KEYS) != 9:
        raise ChartGateContractError(f"expected 9 discovery keys, got {len(DISCOVERY_KEYS)}")
    if SHA_IS_PACKAGE_LEVEL is not True:
        raise ChartGateContractError("the sha covers the whole package")

    if FAILURE_CODES != ("required_native_chart_missing",):
        raise ChartGateContractError("the observed failure code set drifted")
    if NATIVE_CHART_COUNT_WAS_ZERO is not True:
        raise ChartGateContractError("the gate counted zero native charts; do not soften it")

    if not requires_value("--require-native-table-slide"):
        raise ChartGateContractError("this flag takes a slide number, not a bare boolean")
    if not requires_value("--receipt"):
        raise ChartGateContractError("--receipt takes a value")
    if requires_value("--discover-chart-slides"):
        raise ChartGateContractError("--discover-chart-slides is a real boolean")
    if BARE_FLAG_YIELDS_USAGE_RC != 2:
        raise ChartGateContractError("bare value-taking flags yield usage rc=2")

    if (RC_PASS, RC_FINDINGS, RC_USAGE) != (0, 1, 2):
        raise ChartGateContractError("exit codes drifted")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
