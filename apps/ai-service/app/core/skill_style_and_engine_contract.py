# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""What the skills' own style sheets and engine docs say, made checkable (R116).

Seven documents were read here: the documents skill's manifest, its two template-authoring
protocols, its writing-quality doctrine, the presentations and spreadsheets style guides, and the
Excel Office.js guide. They are different in kind, and each contributes something a naive
implementation would get wrong.

**The template protocol has a hard gate.** A template exists only after ``create-template-skill.mjs``
returns successfully; hand-authoring a skill folder and calling it a template is explicitly
forbidden. That gate exists because a template is not a folder -- it is a manifest plus a retained
reference plus a preview, and only the script produces all four consistently.

**The template protocol also forbids two shortcuts an efficient implementer would reach for.**
``content_controls.py fill`` reconstructs the control rather than editing it, so template-following
mode must patch the text nodes directly and leave every untouched package part byte-for-byte. And
headless LibreOffice must not be used as the field-refresh step, because it rewrites or drops
unrelated package parts. When Word is unavailable the sanctioned move is to set
``w:updateFields`` and record that the refresh is deferred -- not to silently save through a
renderer that damages the package.

**Image diff is not a sufficient fidelity gate.** Fields, relationships, bookmarks, comments,
content controls, numbering and drawing anchors can all regress without changing a single rendered
pixel. So template verification compares a package-part inventory as well, and treats any
unexplained structural loss as a failure even when the pages look identical.

**Office.js is non-transactional, and that changes the whole strategy.** A failure mid-script
leaves earlier mutations in place, so the guide prescribes phases -- inspect, create sheets, inspect
again, clear, write, verify, format, then view -- with verification between each. The remedy after
a failure is to inspect what landed and retry a smaller phase, never to run a bigger recovery
script over it. Writes must be rectangular two-dimensional arrays; a one-column format matrix
cannot be assigned to a multi-column range. ``Excel.run()`` must not be called; the wrapper
supplies ``ctx``.

**Print layout is not a repair tool.** Page setup, print area, fit-to-page, paper size, margins and
print scaling are explicitly barred as visual-quality fixes. Use them only when the user asks for
print-ready output.

**Two style guides are literally the same file.** The spreadsheets and excel-live-control copies
hash identically, so a workbook styled under one skill carries the other's rules too -- worth
knowing before "fixing" a live workbook to match what looks like a different sheet.

**The style numbers are concrete, not adjectives.** Two type sizes, at most three; body 10 pt,
title 14 pt, ceiling 16 pt; the largest size stays within 6 pt of body. One font family from the
chain Helvetica Neue, Helvetica, Arial, Aptos. Gridlines hidden by default on new sheets. Thin
structural borders, never a grid around every filled cell. Freeze the smallest useful pane.

**The writing doctrine is a slop tester, and its scoring rule is absolute.** More than eighty means
no slop anywhere and an expert believing a human wrote it; any slop at all puts it below sixty.
The eleven vocabulary markers are concrete: delve, pivotal, robust, tapestry, underscore, showcase,
foster, intricate, landscape, testament, vibrant. Context decides -- a construction that states a
real distinction or quotes an identified source is not a defect.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- corpus ------------------------------------------------------------------------

AUX_DOCS: Final = (
    ("documents/manifest.txt", 2144),
    ("documents/template-create.md", 5177),
    ("documents/template-distill.md", 4375),
    ("documents/writing_quality.md", 19219),
    ("presentations/style_guidelines.md", 3179),
    ("spreadsheets/style_guidelines.md", 10165),
    ("excel-live-control/officejs.md", 8866),
    ("excel-live-control/style_guidelines.md", 10165),
)

AUX_DOC_COUNT: Final = len(AUX_DOCS)

# The spreadsheets and excel-live-control style guides are byte-identical.
IDENTICAL_STYLE_GUIDES: Final = True
STYLE_GUIDE_SHA_PREFIX: Final = "A0E328147991A4A"

# --- manifest -----------------------------------------------------------------

MANIFEST_ENTRY_COUNT: Final = 74
MANIFEST_IS_MACHINE_READABLE: Final = True
MANIFEST_RELATIVE_PATHS_ONLY: Final = True
DOCUMENTS_SCRIPT_COUNT: Final = 36
MANIFEST_AND_DISK_AGREE: Final = True  # verified: 36 on disk, 36 listed, no diff either way

# --- template protocol ---------------------------------------------------------

TEMPLATE_ENGINE_SCRIPT: Final = "create-template-skill.mjs"
TEMPLATE_EXISTS_ONLY_AFTER_SCRIPT_SUCCEEDS: Final = True
HAND_AUTHORED_SKILL_IS_NOT_A_TEMPLATE: Final = True
SKILL_NAME_PREFIX: Final = "artifact-template-"
REQUIRED_TEMPLATE_FILES: Final = (
    "SKILL.md",
    "artifact-template.json",
    "agents/openai.yaml",
    "assets/preview.png",
)
TEMPLATE_KINDS: Final = (
    "document",
    "presentation",
    "spreadsheet",
    "google-docs",
    "google-slides",
    "google-sheets",
    "image",
    "email",
    "slack",
    "site",
)
PERSONAL_SKILLS_ONLY: Final = True
PLUGIN_CACHE_IS_READ_ONLY: Final = True
IMAGE_GALLERY_KINDS: Final = ("imagegen", "product-design")
IMAGE_GALLERY_KIND_MUST_BE_EXPLICIT: Final = True
IMAGE_AND_PRODUCT_DESIGN_INTERCHANGEABLE: Final = False
SITE_TEMPLATE_NEEDS_PREVIEW: Final = False
RESOURCEKEY_PRESERVED: Final = True
GOOGLE_EXPORT_VIA_CONNECTOR_ONLY: Final = True
INTERMEDIARY_REQUEST_FILE_FORBIDDEN: Final = True

# --- template following: the two shortcuts that are barred -------------------------

CONTENT_CONTROLS_FILL_REBUILDS_CONTROL: Final = True
TEMPLATE_FOLLOWING_MAY_USE_FILL: Final = False
HEADLESS_LO_MAY_SERVE_AS_FIELD_REFRESH: Final = False
DEFERRED_REFRESH_SETTING: Final = "w:updateFields"
PACKAGE_PARTS_COMPARED_BYTE_FOR_BYTE: Final = True
IMAGE_DIFF_IS_SUFFICIENT_FIDELITY_GATE: Final = False
RETAINED_REFERENCE_VERIFIED_BY_SHA256: Final = True
DOCUMENT_PARAGRAPHS_IS_COMPLETE_SLOT_INVENTORY: Final = False
STABLE_LOCATOR_KINDS: Final = (
    "package_part",
    "structural_path",
    "style",
    "bookmark",
    "content_control_tag",
    "relationship_id",
)

# --- Office.js live control ---------------------------------------------------

RUN_OFFICEJS_IS_TRANSACTIONAL: Final = False
CALL_EXCEL_RUN_DIRECTLY: Final = False
WRITE_SHAPE: Final = "rectangular two-dimensional array"
ONE_COLUMN_FORMAT_FOR_MULTICOLUMN_RANGE: Final = False
PRINT_LAYOUT_AS_VISUAL_REPAIR: Final = False
PRINT_LAYOUT_REQUIRES_EXPLICIT_REQUEST: Final = True
LIVE_PHASES: Final = (
    "inspect_sheets",
    "create_missing_sheets",
    "reinspect_metadata",
    "clear_targets",
    "write_values",
    "verify_ranges",
    "apply_formatting",
    "build_charts_tables_pivots",
    "view_polish",
    "capture_image",
)
RECOVERY_STRATEGY: Final = "inspect_what_landed_then_retry_a_smaller_phase"
RECOVERY_WITH_BIGGER_SCRIPT: Final = False

# --- workbook style numbers ---------------------------------------------------------

WORKBOOK_TYPE_SIZES_MIN: Final = 2
WORKBOOK_TYPE_SIZES_MAX: Final = 3
BODY_POINT_SIZE: Final = 10
TITLE_POINT_SIZE: Final = 14
CEILING_POINT_SIZE: Final = 16
MAX_SIZE_OVER_BODY: Final = 6
FONT_CHAIN: Final = ("Helvetica Neue", "Helvetica", "Arial", "Aptos")
GRIDLINES_HIDDEN_BY_DEFAULT: Final = True
BORDER_EVERY_FILLED_CELL: Final = False
FREEZE_SMALLEST_USEFUL_PANE: Final = True
COVER_FILL_SPANS_WHOLE_SHEET: Final = False

# --- document style numbers ---------------------------------------------------------

DOCUMENT_DEFAULT_PAGE: Final = "Letter 8.5x11 portrait"
DOCUMENT_BODY_POINT_RANGE: Final = (11, 12)
TABLE_BORDER_COLOUR: Final = "#D9D9D9"
TABLE_HEADER_FILLS: Final = ("light gray", "dark gray", "dark blue", "light blue")
ALL_TABLES_DEFAULT_LIGHT_GRAY: Final = False
CALLOUT_BOXES: Final = False
RULE_UNDER_TITLE: Final = False

# --- the slop tester ---------------------------------------------------------

AI_VOCABULARY_CLUSTER: Final = (
    "delve",
    "pivotal",
    "robust",
    "tapestry",
    "underscore",
    "showcase",
    "foster",
    "intricate",
    "landscape",
    "testament",
    "vibrant",
)
NEGATIVE_PARALLELISM_MARKERS: Final = (
    "not just",
    "not only",
    "not X, but Y",
    "no X, no Y, just Z",
)
SLOP_ANYWHERE_SCORE_CEILING: Final = 60
NO_SLOP_SCORE_FLOOR: Final = 80
SLOP_IS_ABSOLUTE_FLOOR: Final = True  # any slop at all caps the score below 60
CONTEXT_NOT_TOKENS: Final = True  # penalise conspicuous, repeated, unearned -- not a single word


class StyleContractError(ValueError):
    """Raised when a claim contradicts what the style documents actually say."""


def is_ai_vocabulary(word: str) -> bool:
    return word.lower() in AI_VOCABULARY_CLUSTER


def slop_score_ceiling(vocabulary_hits: int) -> int:
    """Any slop at all caps the score; zero hits leaves room to reach the floor."""
    return SLOP_ANYWHERE_SCORE_CEILING if vocabulary_hits else NO_SLOP_SCORE_FLOOR


def template_kind_is_valid(kind: str) -> bool:
    return kind in TEMPLATE_KINDS


def can_use_content_control_fill(in_template_following_mode: bool) -> bool:
    """Fill rebuilds the control, so template fidelity forbids it."""
    return not (in_template_following_mode and CONTENT_CONTROLS_FILL_REBUILDS_CONTROL)


def may_use_print_layout_as_repair(user_requested_print: bool) -> bool:
    """Print layout is a deliverable setting, never a visual-quality fix."""
    return user_requested_print


def summary() -> Mapping[str, object]:
    return {
        "aux_docs": AUX_DOC_COUNT,
        "manifest_entries": MANIFEST_ENTRY_COUNT,
        "scripts": DOCUMENTS_SCRIPT_COUNT,
        "template_kinds": len(TEMPLATE_KINDS),
        "ai_vocabulary": len(AI_VOCABULARY_CLUSTER),
        "slop_cap": SLOP_ANYWHERE_SCORE_CEILING,
    }


def validate_contract() -> None:
    if len(AUX_DOCS) != AUX_DOC_COUNT:
        raise StyleContractError("aux doc count does not match the list")
    if AUX_DOC_COUNT != 8:
        raise StyleContractError("eight auxiliary documents were read")
    if len(REQUIRED_TEMPLATE_FILES) != 4:
        raise StyleContractError("a template folder carries exactly four required files")
    if SKILL_NAME_PREFIX != "artifact-template-":
        raise StyleContractError("the engine's prefix is literal")
    if IMAGE_AND_PRODUCT_DESIGN_INTERCHANGEABLE:
        raise StyleContractError("imagegen and product-design are separate kinds")
    if TEMPLATE_FOLLOWING_MAY_USE_FILL:
        raise StyleContractError("fill rebuilds controls and breaks template fidelity")
    if HEADLESS_LO_MAY_SERVE_AS_FIELD_REFRESH:
        raise StyleContractError("a renderer must not be the field-refresh step")
    if IMAGE_DIFF_IS_SUFFICIENT_FIDELITY_GATE:
        raise StyleContractError("structure can regress with identical pixels")
    if DOCUMENT_PARAGRAPHS_IS_COMPLETE_SLOT_INVENTORY:
        raise StyleContractError("paragraphs miss cells, headers, boxes, fields, controls")
    if RUN_OFFICEJS_IS_TRANSACTIONAL:
        raise StyleContractError("officejs leaves partial state on failure")
    if ONE_COLUMN_FORMAT_FOR_MULTICOLUMN_RANGE:
        raise StyleContractError("format matrices must match range shape")
    if PRINT_LAYOUT_AS_VISUAL_REPAIR:
        raise StyleContractError("print layout does not repair visual quality")
    if ALL_TABLES_DEFAULT_LIGHT_GRAY:
        raise StyleContractError("three other header fills are sanctioned")
    if CALLOUT_BOXES:
        raise StyleContractError("callouts are barred in document design")
    if len(AI_VOCABULARY_CLUSTER) != 11:
        raise StyleContractError("eleven vocabulary markers")
    if len(set(AI_VOCABULARY_CLUSTER)) != len(AI_VOCABULARY_CLUSTER):
        raise StyleContractError("vocabulary markers must be unique")
    if SLOP_ANYWHERE_SCORE_CEILING >= NO_SLOP_SCORE_FLOOR:
        raise StyleContractError("any slop caps below the no-slop floor")
    if MAX_SIZE_OVER_BODY != 6:
        raise StyleContractError("the ceiling is six points above body")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
