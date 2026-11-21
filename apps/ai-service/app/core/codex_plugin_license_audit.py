# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex plugin licence audit (R96).

The bundle is internally contradictory and this module records that rather than smoothing it
over in whichever direction is convenient:

* every ``plugin.json`` except one declares ``"license": "MIT"``;
* the single licence file that actually ships inside the bundle
  (``documents/skills/documents/LICENSE.txt``, 1,437 bytes) declares
  ``Copyright 2026 OpenAI. All rights reserved.`` and then lists five prohibitions --
  extraction from the service, retaining copies outside it, reproduction, distribution of
  derivative works, and reverse engineering.

A specific licence text outranks a metadata field. So the operative reading is the restrictive
one, and the consequences are stated as facts here instead of being argued:

* vendoring these files into this repository is **not permitted** by the shipped text;
* the same text also restricts the analysis work this repository has been doing.

This module exists so a future reader cannot accidentally act on the ``"MIT"`` field alone.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- declared metadata -------------------------------------------------------------

DECLARED_LICENSES: Final[Mapping[str, str]] = {
    "documents": "MIT",
    "pdf": "MIT",
    "presentations": "MIT",
    "spreadsheets": "MIT",
    "template-creator": "Proprietary",
}
DECLARED_MIT_COUNT: Final = sum(1 for v in DECLARED_LICENSES.values() if v == "MIT")
DECLARED_PROPRIETARY_COUNT: Final = sum(
    1 for v in DECLARED_LICENSES.values() if v == "Proprietary"
)

# --- the licence text that actually ships ------------------------------------------

LICENSE_FILE_REL: Final = "plugins/documents/skills/documents/LICENSE.txt"
LICENSE_FILE_BYTES: Final = 1437
COPYRIGHT_LINE: Final = "Copyright 2026 OpenAI. All rights reserved."
COPYRIGHT_HOLDER: Final = "OpenAI"
COPYRIGHT_YEAR: Final = 2026
RIGHTS_RESERVED: Final = True

PROHIBITIONS: Final = (
    "extract-materials-from-service-or-retain-copies-outside",
    "reproduce-or-copy-except-temporary-authorized-use",
    "distribute-sublicense-or-transfer-derivative-works",
    "make-offer-sell-or-import-inventions",
    "reverse-engineer-decompile-or-disassemble",
)
PROHIBITION_COUNT: Final = len(PROHIBITIONS)
PERMITTED_USE: Final = "governed-by-agreement-with-openai"
NO_SEPARATE_AGREEMENT_FALLBACK: Final = "terms-of-use-or-services-agreement"

# --- the verdict -------------------------------------------------------------------

METADATA_CONFLICTS_WITH_TEXT: Final = True
OPERATIVE_INSTRUMENT: Final = "shipped-licence-text"
VENDOR_ALLOWED: Final = False
REPRODUCTION_ALLOWED: Final = False
DERIVATIVE_DISTRIBUTION_ALLOWED: Final = False
REVERSE_ENGINEERING_ALLOWED_BY_TEXT: Final = False
PRIOR_ANALYSIS_WORK_ALSO_RESTRICTED: Final = True

# Where an unencumbered copy would have to come from.
COMPLIANT_PATH: Final = "obtain-explicit-licence-or-use-only-through-the-service"


class LicenseAuditError(ValueError):
    """Raised when a licence fact is softened or contradicts the shipped text."""


def declared_license_of(plugin: str) -> str:
    """Return the ``plugin.json`` licence string for ``plugin``, or raise."""
    try:
        return DECLARED_LICENSES[plugin]
    except KeyError:
        raise LicenseAuditError(f"unknown plugin: {plugin!r}") from None


def is_declared_mit(plugin: str) -> bool:
    """Whether the metadata field claims MIT for ``plugin``."""
    return declared_license_of(plugin) == "MIT"


def is_restricted(prohibition: str) -> bool:
    """Whether the named prohibition appears in the shipped licence text."""
    return prohibition in PROHIBITIONS


def vendoring_blocked_by(plugin: str) -> bool:
    """Every plugin in this bundle is blocked from vendoring, MIT field notwithstanding."""
    declared_license_of(plugin)  # validates the name
    return VENDOR_ALLOWED is False


def audit() -> Mapping[str, object]:
    """Return the audit outcome as a plain mapping for reporting."""
    return {
        "declared_mit": DECLARED_MIT_COUNT,
        "declared_proprietary": DECLARED_PROPRIETARY_COUNT,
        "license_file": LICENSE_FILE_REL,
        "license_file_bytes": LICENSE_FILE_BYTES,
        "copyright_line": COPYRIGHT_LINE,
        "prohibitions": PROHIBITION_COUNT,
        "conflict": METADATA_CONFLICTS_WITH_TEXT,
        "operative": OPERATIVE_INSTRUMENT,
        "vendor_allowed": VENDOR_ALLOWED,
        "prior_work_restricted": PRIOR_ANALYSIS_WORK_ALSO_RESTRICTED,
        "compliant_path": COMPLIANT_PATH,
    }


def validate_audit() -> None:
    """Assert the audit reads the restrictive text, not the convenient metadata field."""
    if len(DECLARED_LICENSES) != 5:
        raise LicenseAuditError(f"expected 5 plugins, got {len(DECLARED_LICENSES)}")
    if DECLARED_MIT_COUNT != 4:
        raise LicenseAuditError(f"expected 4 MIT declarations, got {DECLARED_MIT_COUNT}")
    if DECLARED_PROPRIETARY_COUNT != 1:
        raise LicenseAuditError("exactly one plugin declares Proprietary")
    if declared_license_of("template-creator") != "Proprietary":
        raise LicenseAuditError("template-creator must stay Proprietary")
    if LICENSE_FILE_BYTES != 1437:
        raise LicenseAuditError("licence file size drifted; re-read before trusting it")
    if COPYRIGHT_LINE != "Copyright 2026 OpenAI. All rights reserved.":
        raise LicenseAuditError("copyright line drifted")
    if RIGHTS_RESERVED is not True:
        raise LicenseAuditError("the shipped text reserves all rights")
    if PROHIBITION_COUNT != 5:
        raise LicenseAuditError(f"expected 5 prohibitions, got {PROHIBITION_COUNT}")
    if not is_restricted("reverse-engineer-decompile-or-disassemble"):
        raise LicenseAuditError("reverse engineering must stay listed as prohibited")
    if METADATA_CONFLICTS_WITH_TEXT is not True:
        raise LicenseAuditError("the MIT metadata field does conflict with the text")
    if OPERATIVE_INSTRUMENT != "shipped-licence-text":
        raise LicenseAuditError("the specific text outranks a metadata field")
    if VENDOR_ALLOWED is not False:
        raise LicenseAuditError(
            "vendoring is not permitted by the shipped licence; flip only with written grant"
        )
    if REPRODUCTION_ALLOWED is not False:
        raise LicenseAuditError("reproduction is prohibited by the shipped text")
    if DERIVATIVE_DISTRIBUTION_ALLOWED is not False:
        raise LicenseAuditError("derivative distribution is prohibited by the shipped text")
    if REVERSE_ENGINEERING_ALLOWED_BY_TEXT is not False:
        raise LicenseAuditError("the text prohibits reverse engineering")
    if PRIOR_ANALYSIS_WORK_ALSO_RESTRICTED is not True:
        raise LicenseAuditError("the same text reaches the earlier analysis work")
    if COMPLIANT_PATH != "obtain-explicit-licence-or-use-only-through-the-service":
        raise LicenseAuditError("compliant path drifted")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
