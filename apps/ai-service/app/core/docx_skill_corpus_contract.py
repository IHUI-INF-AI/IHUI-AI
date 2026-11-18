# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The documents skill's own prose, turned into checkable contracts (R115).

The thirty-three markdown files under ``documents/skills/documents`` are where that toolkit
explains itself: four OOXML plumbing notes, twenty-six task guides, two troubleshooting notes,
one template note. Read all of them, the same handful of facts keep surfacing -- and most of them
are about a **signal that cannot be trusted**.

**The signal problem, in three forms.** R109 found an overflow checker that reported clean on a
deck that really overflowed, because the renderer clips content at the canvas edge and the checker
looked at the padding. R108 found that the render toolchain returned exit 0 after printing a
traceback. Here the same failure is printed in the skill's own troubleshooting note: LibreOffice
emits ``error : Unknown IO error`` on conversions that **succeeded**. So a caller who checks stderr
would throw away good output, and a caller who checks the exit code would accept bad output.
The only judge that survives all three is *whether the artifact exists and looks right*.

**Comments are the same shape.** The guides say rendering is *not* a way to verify comments --
they frequently do not render at all under headless LibreOffice. So a comment that renders proves
nothing about its structure, and a comment that does not render proves nothing about its absence.
Structure has to be checked directly: the part, the relationship, the content-type override, and
three anchors in the document.

**Fields have a hard limit that no automation crosses.** ``REF``, ``PAGEREF`` and ``SEQ`` can be
materialised into literal text, so a headless render shows real numbers. ``TOC``, ``PAGE`` and
``NUMPAGES`` cannot -- the guides are explicit that those still need Word's own field update. A
pipeline that materialises everything and calls the result final will ship a document whose table
of contents is empty and whose page numbers all read one.

**Order matters within materialisation.** ``SEQ`` is materialised before ``REF``, because a
cross-reference has to see the caption number that was just computed. Reversing it produces
references pointing at stale numbers -- and no error, because both fields "materialised fine".

**Small things that break silently.** A placeholder split across runs is missed by the wrapper
(Word splits text on style boundaries, so this happens on real documents, not contrived ones).
Deletions inside tracked changes must use ``w:delText``, not ``w:t``. A font set only via
``run.font.name`` is ignored by some renderers, which want ``w:rFonts`` at ``w:ascii`` and
``w:hAnsi`` as well. Footnote parts carry fixed separator entries at ``w:id=-1`` and ``w:id=0``
that consumers are strict about.

**Things the tooling deliberately refuses.** Merging two documents refuses drawings unless
``--allow_drawings`` is passed, because merging body XML without merging relationships produces a
file that opens and shows nothing. Password protection is not implemented. Rich content controls
(dropdown, checkbox, date picker) are out of scope. Redaction works inside one paragraph and
cannot touch text baked into images or charts.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- what the corpus is -------------------------------------------------------------

OOXML_NOTE_COUNT: Final = 4
TASK_GUIDE_COUNT: Final = 26
TROUBLESHOOTING_COUNT: Final = 2
REFERENCE_COUNT: Final = 1
CORPUS_TOTAL: Final = OOXML_NOTE_COUNT + TASK_GUIDE_COUNT + TROUBLESHOOTING_COUNT + REFERENCE_COUNT

OOXML_NOTES: Final = (
    "comments",
    "hyperlinks_and_fields",
    "rels_and_content_types",
    "tracked_changes",
)

TASK_GUIDES: Final = (
    "accessibility_a11y",
    "captions_crossrefs",
    "clean_tracked_changes",
    "comments_manage",
    "compare_diff",
    "create_edit",
    "equations",
    "fields_update",
    "fixtures_edge_cases",
    "footnotes_endnotes",
    "forms_content_controls",
    "headings_numbering",
    "images_figures",
    "multi_doc_merge",
    "navigation_internal_links",
    "privacy_scrub_metadata",
    "protection_restrict_editing",
    "read_review",
    "redaction_anonymization",
    "sections_layout",
    "style_lint_normalize",
    "tables_spreadsheets",
    "templates_style_packs",
    "toc_workflow",
    "verify_render",
    "watermarks_background",
)

TROUBLESHOOTING_NOTES: Final = ("libreoffice_headless", "run_splitting")
REFERENCE_NOTES: Final = ("template-elicitation",)


# --- the signal that cannot be trusted ---------------------------------------------

STDERR_IS_A_LIAR: Final = True
SCARY_STDERR_ON_SUCCESS: Final = "error : Unknown IO error"
STDERR_QUOTED_IN_GUIDES: Final = 2  # read_review and verify_render both print the warning
# Three independent rounds: the overflow checker (R109), the render toolchain (R108), and
# LibreOffice's own stderr (R115). All three are channels that look informative and are not.
UNTRUSTWORTHY_SIGNAL_CHANNELS: Final = ("exit_code", "stderr", "reported_findings")
SAFE_JUDGE: Final = "artifact_exists_and_looks_right"


# --- comments: structure, not pixels ----------------------------------------------

COMMENTS_RENDER_RELIABLY: Final = False
COMMENTS_VERIFIABLE_BY_RENDER: Final = False
COMMENT_WIRING_PARTS: Final = ("word/comments.xml", "word/_rels/document.xml.rels", "[Content_Types].xml")
COMMENT_ANCHORS: Final = ("w:commentRangeStart", "w:commentRangeEnd", "w:commentReference")
COMMENT_CONTENT_TYPE: Final = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"
)
COMMENT_REL_TYPE: Final = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
)
# Comments can be anchored in headers and footers too, so stripping must span all story parts.
COMMENTS_SPAN_STORY_PARTS: Final = True
COMMENTS_EXTENDED_PART: Final = "commentsExtended.xml"
RESOLVED_STATE_ROUNDTRIPPABLE: Final = False


# --- fields: what can and cannot be frozen ---------------------------------------

MATERIALIZABLE_FIELDS: Final = ("SEQ", "REF", "PAGEREF")
NON_MATERIALIZABLE_FIELDS: Final = ("TOC", "PAGE", "NUMPAGES")
FIELD_MATERIALIZATION_IS_FULLY_AUTOMATIC: Final = False
SEQ_MATERIALIZED_BEFORE_REF: Final = True
FIELD_UPDATE_WORD_SHORTCUT: Final = "Ctrl+A then F9"
HEADLESS_FIELDS_UPDATE_RELIABLY: Final = False


# --- structural rules that break silently ----------------------------------------

PLACEHOLDER_SYNTAX: Final = "{{tag}}"
PLACEHOLDER_SPLIT_BY_RUNS: Final = True
PLACEHOLDER_MUST_BE_ONE_RUN: Final = True
DEFAULT_REF_MARKER: Final = "[[REF:bookmark]]"
DEFAULT_TOC_MARKER: Final = "[[TOC]]"
DEFAULT_FOOTNOTE_MARKER: Final = "[[FN]]"
DEFAULT_ENDNOTE_MARKER: Final = "[[EN]]"
DELETION_ELEMENT: Final = "w:delText"
DELETION_USES_WT: Final = False
TRACK_CHANGE_ID_MUST_NOT_COLLIDE: Final = True
MOVE_WRAPPERS_EXIST: Final = ("w:moveTo", "w:moveFrom")
FOOTNOTE_PARTS: Final = ("word/footnotes.xml", "word/endnotes.xml")
NOTE_SEPARATOR_IDS: Final = (-1, 0)
FONT_NEEDS_RFONTS: Final = True
FONT_RFONTS_KEYS: Final = ("w:ascii", "w:hAnsi")
HEADER_FOOTER_TABLE_NEEDS_WIDTH: Final = True


# --- layout: the head mismatch ------------------------------------------------

INLINE_IMAGE_RELIABILITY: Final = "high"
FLOATING_IMAGE_RELIABILITY: Final = "high risk"
IMAGE_PLACEMENT_IS_TOP_LO_VS_WORD_MISMATCH: Final = True
RENDER_DPI_FROM_FIRST_SECTION: Final = True
SECTIONS_CONTROL_LAYOUT: Final = True
HEADER_FOOTER_LINK_TO_PREVIOUS: Final = True
LANDSCAPE_REQUIRES_SWAPPING_WIDTH_AND_HEIGHT: Final = True


# --- redaction and privacy: what a text pass cannot reach ---------------------------

REDACT_SCOPE: Final = "single paragraph"
REDACT_CROSSES_PARAGRAPHS: Final = False
REDACT_DEFAULT_MASK: Final = "█"  # repeated to match length, so pagination drifts less
REDACT_PRESERVE_LENGTH_FLAG: Final = "--preserve_length"
REDACT_INCLUDE_COMMENTS_FLAG: Final = "--include_comments"
REDACT_REACHES_IMAGES: Final = False
REDACT_REACHES_CHARTS: Final = False
REDACT_REACHES_TRACKED_DELETIONS: Final = False
PRIVACY_SCRUB_REMOVES_CONTENT: Final = False
PRIVACY_SCRUB_TARGETS: Final = ("creator", "lastModifiedBy", "docProps/custom.xml", "rsid*")


# --- deliberate refusals ------------------------------------------------------

MERGE_REFUSES_DRAWINGS_BY_DEFAULT: Final = True
MERGE_FLAG: Final = "--allow_drawings"
MERGE_MERGES_HEADERS_FOOTERS: Final = False
PASSWORD_PROTECTION_IMPLEMENTED: Final = False
PROTECTION_MODES: Final = ("readOnly", "comments", "trackedChanges", "forms", "off")
PROTECTION_ENFORCED_BY_WORD_ONLY: Final = True
RICH_CONTENT_CONTROLS_SUPPORTED: Final = False
EQUATION_NATIVE_FORMAT: Final = "OMML"
EQUATION_FALLBACK_IS_AN_IMAGE: Final = True
MUST_NOT_SILENTLY_RASTERIZE: Final = True
TOC_VIA_HEADING_STYLES_ONLY: Final = True
STATIC_TOC_IS_HEADLESS_SAFE: Final = True


# --- watermarks and fixtures -------------------------------------------------

WATERMARK_VML_PATH: Final = "w:hdr > w:p > w:r > w:pict > v:shape > v:textpath"
WATERMARK_REMOVAL_IS_HEURISTIC: Final = True
WATERMARK_MAY_NOT_RENDER_HEADLESS: Final = True
FIXTURE_OUTPUTS: Final = ("tracked_changes_fixture.docx", "watermark_fixture.docx")
A11Y_HEADING_FIX_IS_MECHANICAL: Final = False


class ContractError(ValueError):
    """Raised when a claim about the corpus does not match what the corpus says."""


def is_signal_trustworthy(channel: str) -> bool:
    """None of the three channels settles it; look at the artifact."""
    return channel not in UNTRUSTWORTHY_SIGNAL_CHANNELS


def can_materialize(field: str) -> bool:
    """TOC, PAGE and NUMPAGES need a human in Word; the rest can be frozen."""
    return field.upper() in MATERIALIZABLE_FIELDS


def needs_word_field_update(field: str) -> bool:
    return field.upper() in NON_MATERIALIZABLE_FIELDS


def corpus_size() -> int:
    return CORPUS_TOTAL


def contract_summary() -> Mapping[str, object]:
    return {
        "corpus": {
            "ooxml": OOXML_NOTE_COUNT,
            "tasks": TASK_GUIDE_COUNT,
            "troubleshooting": TROUBLESHOOTING_COUNT,
            "references": REFERENCE_COUNT,
            "total": CORPUS_TOTAL,
        },
        "untrustworthy_channels": list(UNTRUSTWORTHY_SIGNAL_CHANNELS),
        "comments_need_structure": not COMMENTS_VERIFIABLE_BY_RENDER,
        "materializable": list(MATERIALIZABLE_FIELDS),
        "word_only": list(NON_MATERIALIZABLE_FIELDS),
    }


def validate_contract() -> None:
    """Keep the numbers and the claims consistent with the files that were actually read."""
    if len(OOXML_NOTES) != OOXML_NOTE_COUNT:
        raise ContractError("ooxml note count does not match the list")
    if len(TASK_GUIDES) != TASK_GUIDE_COUNT:
        raise ContractError("task guide count does not match the list")
    if len(TROUBLESHOOTING_NOTES) != TROUBLESHOOTING_COUNT:
        raise ContractError("troubleshooting count does not match the list")
    if len(REFERENCE_NOTES) != REFERENCE_COUNT:
        raise ContractError("reference count does not match the list")
    if CORPUS_TOTAL != 33:
        raise ContractError("the documents corpus is 33 files")
    if set(MATERIALIZABLE_FIELDS) & set(NON_MATERIALIZABLE_FIELDS):
        raise ContractError("a field cannot be both materialisable and word-only")
    if MATERIALIZABLE_FIELDS != ("SEQ", "REF", "PAGEREF"):
        raise ContractError("exactly three field kinds can be frozen")
    if not COMMENTS_VERIFIABLE_BY_RENDER and COMMENTS_RENDER_RELIABLY:
        raise ContractError("comments cannot both render reliably and be unverifiable by render")
    if DELETION_USES_WT:
        raise ContractError("a tracked deletion that uses w:t is invisible to Word")
    if not MERGE_REFUSES_DRAWINGS_BY_DEFAULT:
        raise ContractError("merging body xml without relationships produces a broken file")
    if len(set(TASK_GUIDES)) != len(TASK_GUIDES):
        raise ContractError("task guide names must be unique")
    if STDERR_IS_A_LIAR and is_signal_trustworthy("stderr"):
        raise ContractError("stderr is named as a liar but treated as trustworthy")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
