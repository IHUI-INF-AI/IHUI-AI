# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex skill-artifact interaction contract (R95).

Two small, uniform surfaces sit underneath every artifact-producing skill, and both were read
out of real files rather than inferred:

1. **the operation marker** — ``mark_artifact_operation_started.mjs``. Four near-identical
   copies ship, one per plugin, and the *only* thing that differs between them is the
   ``--output-format`` allowlist. The script validates a fixed six-slot argv and exits 2 with
   a usage line on any deviation; on success it prints nothing and exits 0. It is a
   parameter check, not a recorder -- the name overstates what the file does.
2. **the citation directive** — ``:codex-file-citation{path=... purpose=...}``. Seven distinct
   argument names were observed across skills, but only ``path`` and ``purpose`` are shared by
   every skill that cites anything, and ``purpose`` has exactly two values.

Both surfaces are contracts about *how a skill reports its work*, which is why they belong
together here instead of with any single plugin's own skills.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- operation marker --------------------------------------------------------------

MARKER_SCRIPT: Final = "mark_artifact_operation_started.mjs"
MARKER_COPY_COUNT: Final = 4
MARKER_ARGV_LEN: Final = 6
MARKER_MIN_LINES: Final = 23
MARKER_MAX_BYTES: Final = 765
MARKER_MIN_BYTES: Final = 735

MARKER_SLOTS: Final = (
    "--operation-kind",
    "--expected-output-count",
    "--output-format",
)
MARKER_OPERATION_KINDS: Final = ("create", "edit")
MARKER_COUNT_MIN: Final = 1
MARKER_COUNT_MAX: Final = 100
MARKER_EXIT_USAGE: Final = 2
MARKER_EXIT_OK: Final = 0
MARKER_IS_SILENT_ON_SUCCESS: Final = True
MARKER_MUTATES_ANYTHING: Final = False

MARKER_FORMATS: Final[Mapping[str, tuple[str, ...]]] = {
    "documents": ("docx",),
    "pdf": ("pdf",),
    "presentations": ("ppt", "pptx"),
    "spreadsheets": ("csv", "tsv", "xls", "xlsm", "xlsx"),
}
MARKER_FORMAT_TOTAL: Final = sum(len(v) for v in MARKER_FORMATS.values())
FORMAT_COMPARISON: Final = "lowercased-before-membership-test"

# --- citation directive ------------------------------------------------------------

CITATION_NAME: Final = "codex-file-citation"
CITATION_ARGUMENTS: Final = (
    "path",
    "purpose",
    "artifact_kind",
    "mode",
    "page_number",
    "sheet",
    "range",
)
CITATION_ARGUMENT_COUNT: Final = len(CITATION_ARGUMENTS)
CITATION_UNIVERSAL_ARGUMENTS: Final = ("path", "purpose")
CITATION_PURPOSES: Final = ("output", "source")
CITATION_PURPOSE_COUNT: Final = len(CITATION_PURPOSES)
CITATION_EMITTED_BARE: Final = True          # no backticks / fences / markdown links
CITATION_REQUIRES_VERIFIED_TARGET: Final = True
CITATION_OUTPUT_ONCE: Final = True            # each deliverable cited exactly once
CITATION_SOURCE_INLINE: Final = True          # source citation replaces the filename
CITATION_MODE_OMIT_IN_PDF: Final = True       # pdf forbids mode / locators

# --- scope discipline --------------------------------------------------------------

MARKER_REQUIRED_FOR_WRITE: Final = True
MARKER_FORBIDDEN_FOR_READ_ONLY: Final = True
MARKER_ONCE_PER_OPERATION: Final = True


class SkillArtifactContractError(ValueError):
    """Raised when a skill-artifact fact contradicts the observed files."""


def marker_formats_of(plugin: str) -> tuple[str, ...]:
    """Return the ``--output-format`` allowlist for a plugin's marker copy."""
    try:
        return MARKER_FORMATS[plugin]
    except KeyError:
        raise SkillArtifactContractError(f"no marker copy for plugin: {plugin!r}") from None


def marker_accepts(plugin: str, fmt: str) -> bool:
    """Whether the plugin's marker would accept ``fmt`` (membership is case-insensitive)."""
    return fmt.lower() in marker_formats_of(plugin)


def is_citation_argument(name: str) -> bool:
    """Whether ``name`` is one of the seven observed citation arguments."""
    return name in CITATION_ARGUMENTS


def is_citation_purpose(value: str) -> bool:
    """Whether ``value`` is one of the two observed purpose values."""
    return value in CITATION_PURPOSES


def validate_contract() -> None:
    """Assert the observed relations that must not drift."""
    if len(MARKER_FORMATS) != MARKER_COPY_COUNT:
        raise SkillArtifactContractError("marker copy count disagrees with the format table")
    total = sum(len(v) for v in MARKER_FORMATS.values())
    if total != 9:
        raise SkillArtifactContractError(
            f"expected 9 allowed formats across four copies, got {total}"
        )
    for plugin, fmts in MARKER_FORMATS.items():
        if not fmts:
            raise SkillArtifactContractError(f"{plugin}: empty format allowlist")
        if any(f != f.lower() for f in fmts):
            raise SkillArtifactContractError(f"{plugin}: allowlist must stay lowercased")
    if len(MARKER_SLOTS) * 2 != MARKER_ARGV_LEN:
        raise SkillArtifactContractError("argv length does not match three flag slots")
    if MARKER_OPERATION_KINDS != ("create", "edit"):
        raise SkillArtifactContractError("operation kinds drifted")
    if MARKER_COUNT_MIN != 1 or MARKER_COUNT_MAX != 100:
        raise SkillArtifactContractError("output-count bounds drifted")
    if MARKER_MUTATES_ANYTHING is not False:
        raise SkillArtifactContractError("the marker only validates; it must not mutate")
    if MARKER_IS_SILENT_ON_SUCCESS is not True:
        raise SkillArtifactContractError("the marker prints nothing on success")
    if MARKER_EXIT_USAGE != 2 or MARKER_EXIT_OK != 0:
        raise SkillArtifactContractError("marker exit vocabulary drifted")
    if MARKER_MIN_BYTES > MARKER_MAX_BYTES:
        raise SkillArtifactContractError("marker size bounds inverted")
    if MARKER_MIN_LINES != 23:
        raise SkillArtifactContractError("all four marker copies are 23 lines")
    if CITATION_ARGUMENT_COUNT != 7:
        raise SkillArtifactContractError(f"expected 7 citation args, got {CITATION_ARGUMENT_COUNT}")
    if len(set(CITATION_ARGUMENTS)) != CITATION_ARGUMENT_COUNT:
        raise SkillArtifactContractError("duplicate citation argument")
    if CITATION_UNIVERSAL_ARGUMENTS != ("path", "purpose"):
        raise SkillArtifactContractError("the universal two must stay path+purpose")
    if CITATION_PURPOSE_COUNT != 2:
        raise SkillArtifactContractError("purpose vocabulary must stay two-valued")
    if set(CITATION_UNIVERSAL_ARGUMENTS) - set(CITATION_ARGUMENTS):
        raise SkillArtifactContractError("universal args must be a subset of all args")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
