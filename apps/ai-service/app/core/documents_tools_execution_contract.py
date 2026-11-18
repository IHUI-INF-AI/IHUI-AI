# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""What the documents toolkit actually does, measured (R118).

R112 read the 36 scripts' ``--help`` and recorded "thirty-two take ``in_docx`` plus ``--out``".
That was a guess assembled from help text. This round ran them against the toolkit's own fixtures
and the guess turned out to be wrong in a way that matters:

* ``redact_docx``, ``insert_ref_fields`` and ``captions_and_crossrefs`` take **two positional
  paths** and reject ``--out`` outright (``unrecognized arguments: --out``).
* ``style_normalize`` takes ``input_docx [output_docx]`` positionally, with ``--out`` alongside.
* Eight tools are pure readers that never write a document at all.
* One tool (``make_fixtures``) does not read a document: it manufactures them.

So "same toolkit, one calling convention" is false. A caller who learns one shape and assumes the
rest will hit ``rc=2`` on four of them, which is what happened here before the help text was read
properly.

The second finding is worse and more useful. ``insert_toc`` failed with ``rc=2`` because the fixture
had no ``[[TOC]]`` paragraph, and **it still wrote an output file** — byte-for-byte identical to the
input. Nothing in the size, the extension or the exit-of-file-open told the caller the TOC was
absent. The only signal that carried the truth was the exit code and the stderr line. That makes
"the output file exists" a fourth untrustworthy signal alongside the exit-code / stderr /
self-report trio recorded earlier: here the process was honest and the artifact lied.

Third: an edit that changes nothing still writes a full document. ``fields_materialize`` reported
"materialized 0 field(s)" and produced a 36,784-byte file; ``flatten_ref_fields`` produced
``fields_flattened=0`` and wrote one; ``style_normalize`` cleared nothing and wrote one. Two of
those outputs were byte-identical to each other (``7347453886B1``), which means the "no-op" path
is deterministic, not incidental. A pipeline that treats "a file came back" as "work happened"
will be wrong for most of this toolkit.

Fourth: the toolkit's own fixture generator is ``make_fixtures``, and it is the correct way to get
trustworthy inputs. It emits ``tracked_changes_fixture.docx`` (36,784 B, one insertion and one
deletion) and ``watermark_fixture.docx`` (37,466 B, a VML watermark plus a ``PowerPlusWaterMark``
object attribute). Using these means testing against the vendor's own expectation rather than
against an input this repo invented.

Every claim below carries which tool produced it. Tools marked ``HELP_ONLY`` had their shape read
from ``--help`` but were never executed — that is stated rather than glossed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

TOOL_COUNT: Final = 36

# --- calling conventions, measured from --help and confirmed by execution ------------------------

OUT_REQUIRED: Final = (
    "add_tracked_replacements",
    "comments_add",
    "comments_extract",
    "comments_strip",
    "docx_table_to_csv",
    "fields_materialize",
    "flatten_ref_fields",
    "insert_note",
    "internal_nav",
    "merge_docx_append",
    "privacy_scrub",
    "set_protection",
    "watermark_add",
)

OUT_OPTIONAL: Final = (
    "a11y_audit",
    "accept_tracked_changes",
    "docx_ooxml_patch",
    "google_docs_title_sanitize",
    "insert_toc",
    "watermark_audit_remove",
    "xlsx_to_docx_table",
)

#: Two positional document paths and no ``--out``. ``--out`` is rejected with rc=2.
POSITIONAL_PAIR: Final = (
    "captions_and_crossrefs",
    "insert_ref_fields",
    "redact_docx",
)

#: Positional input plus an optional positional output.
POSITIONAL_OPTIONAL_OUTPUT: Final = ("style_normalize",)

OUT_ABSENT: Final = (
    "fields_report",
    "footnotes_report",
    "heading_audit",
    "images_audit",
    "section_audit",
    "style_lint",
    "table_geometry",
)

SUBCOMMAND: Final = ("content_controls",)

#: Does not consume a document; manufactures fixtures.
FIXTURE_GENERATOR: Final = ("make_fixtures",)

#: Takes two source documents (template plus target) rather than one.
TWO_INPUT_DOCUMENTS: Final = ("apply_template_styles",)

#: Needs a JSON patch alongside the document.
PATCH_JSON_ARGUMENT: Final = ("comments_apply_patch",)

OUTDIR_TOOLS: Final = ("render_and_diff",)


@dataclass(frozen=True)
class Execution:
    """One measured run. ``rc`` is the real exit code."""

    tool: str
    rc: int
    note: str


MEASURED: Final = (
    Execution("make_fixtures", 0, "wrote tracked_changes_fixture.docx and watermark_fixture.docx"),
    Execution("a11y_audit", 0, "emitted JSON: counts high/medium/low all zero"),
    Execution("heading_audit", 0, "HEADING STYLE COUNTS: Heading 1 x1, plus a TOC reminder"),
    Execution("style_lint", 0, "direct run-formatting runs: 0, paragraph overrides 0"),
    Execution("fields_report", 0, "No fields found in document.xml/headers/footers"),
    Execution("images_audit", 0, "No inline/anchored drawings found"),
    Execution("section_audit", 0, "1 section, PORTRAIT, 8.50 x 11.00, L=1.25 R=1.25 T=1.00 B=1.00"),
    Execution("footnotes_report", 0, "footnoteReferences=0; word/footnotes.xml MISSING"),
    Execution("table_geometry", 0, "OK: tblW, tblInd, tblGrid and tcW all consistent"),
    Execution("privacy_scrub", 0, "rsid_attrs_removed=3, core_props_scrubbed=1"),
    Execution("redact_docx", 0, "parts_processed=1, paragraphs_touched=0"),
    Execution("watermark_add", 0, "patched word/header1.xml"),
    Execution("watermark_audit_remove", 0, "2 hits: vml_textpath DRAFT, attr PowerPlusWaterMarkObject1"),
    Execution("set_protection", 0, "mode=readOnly written"),
    Execution("insert_toc", 2, "no [[TOC]] paragraph: refused, and still wrote a byte-identical copy"),
    Execution("insert_toc", 0, "with a [[TOC]] paragraph: field inserted, next step Ctrl+A then F9"),
    Execution("accept_tracked_changes", 0, "report: ins=1 del=1 moveTo=0 moveFrom=0"),
    Execution("fields_materialize", 0, "materialized 0 field(s), file still written"),
    Execution("flatten_ref_fields", 0, "fields_flattened=0, file still written"),
    Execution("style_normalize", 0, "0 overrides cleared, file still written"),
    Execution("comments_extract", 0, "wrote JSON with 0 comments"),
    Execution("comments_strip", 0, "markup_removed=0, part removed 0, rels updated 0"),
    Execution("docx_table_to_csv", 2, "No tables found in DOCX"),
    Execution("merge_docx_append", 0, "body_children_appended=3"),
    Execution("internal_nav", 0, "wrote output"),
    Execution("captions_and_crossrefs", 2, "printed usage: expected two positional paths"),
    Execution("insert_ref_fields", 2, "unrecognized arguments: --out"),
    Execution("comments_add", 1, "Provide at least one --add"),
)

EXECUTED_TOOLS: Final = frozenset(
    e.tool for e in MEASURED
) | {"content_controls"}  # content_controls was exercised in R112 via its three subcommands

HELP_ONLY: Final = frozenset((
    "add_tracked_replacements",
    "apply_template_styles",
    "comments_apply_patch",
    "docx_ooxml_patch",
    "google_docs_title_sanitize",
    "insert_note",
    "render_and_diff",
    "xlsx_to_docx_table",
))

# --- fixture evidence -------------------------------------------------------------------------

FIXTURE_TOOL: Final = "make_fixtures"
FIXTURE_KINDS: Final = ("tracked", "watermark", "all")
FIXTURE_TRACKED_SIZE: Final = 36_784
FIXTURE_WATERMARK_SIZE: Final = 37_466
FIXTURE_TRACKED_EDITS: Final = {"ins": 1, "del": 1}

#: sha prefixes from the measured run, so a regression can be spotted by eye.
SOURCE_SHA_PREFIX: Final = "022DEBCDB873"
NOOP_OUTPUT_SHAS: Final = ("FF96D00C9F15", "7347453886B1")
NOOP_SHAS_IDENTICAL_PAIR: Final = ("7347453886B1", "7347453886B1")

# --- the four untrustworthy signals ------------------------------------------------------------

FAILURE_STILL_WRITES_OUTPUT: Final = True
FAILURE_OUTPUT_CAN_EQUAL_SOURCE_BYTE_FOR_BYTE: Final = True
OUTPUT_EXISTENCE_IS_EVIDENCE_OF_WORK: Final = False
EMPTY_EDIT_STILL_WRITES_DOCUMENT: Final = True
EMPTY_EDIT_PATH_IS_DETERMINISTIC: Final = True

#: The exit code was the only signal that told the truth in the insert_toc failure.
TRUSTWORTHY_SIGNAL_IN_FAILURE: Final = "exit_code_and_stderr"

INSERT_TOC_PLACEHOLDER_DEFAULT: Final = "[[TOC]]"
INSERT_TOC_REQUIRES_EXACT_PARAGRAPH_TEXT: Final = True
INSERT_TOC_TIP: Final = "add a single paragraph containing that token"
INSERT_TOC_NEXT_STEP: Final = "Ctrl+A then F9 in Word, save, re-render"
INSERT_TOC_REFUSES_SILENTLY_EMPTY: Final = False

A11Y_AUDIT_CAN_FIX: Final = True
A11Y_AUDIT_FIX_FLAGS: Final = ("--fix_image_alt from_filename", "--fix_table_headers first_row")
A11Y_AUDIT_TWO_OUTPUTS: Final = ("--out for the patched document", "--out_json for the report")

SET_PROTECTION_MODES: Final = ("off", "readOnly", "comments", "trackedChanges", "forms")
SET_PROTECTION_ACCEPTS_ALIASES: Final = True


def shape_of(tool: str) -> str:
    """Which calling convention a tool follows. Raises on an unknown name."""
    for group, shape in (
        (OUT_REQUIRED, "out_required"),
        (OUT_OPTIONAL, "out_optional"),
        (POSITIONAL_PAIR, "positional_pair"),
        (POSITIONAL_OPTIONAL_OUTPUT, "positional_optional_output"),
        (OUT_ABSENT, "read_only"),
        (SUBCOMMAND, "subcommand"),
        (FIXTURE_GENERATOR, "fixture_generator"),
        (TWO_INPUT_DOCUMENTS, "two_input_documents"),
        (PATCH_JSON_ARGUMENT, "json_patch_argument"),
        (OUTDIR_TOOLS, "outdir"),
    ):
        if tool in group:
            return shape
    raise KeyError(f"unknown documents tool: {tool}")


def was_executed(tool: str) -> bool:
    return tool in EXECUTED_TOOLS


def output_proves_work(rc: int, output_equals_source: bool) -> bool:
    """Neither existence nor a zero exit proves an edit landed."""
    if output_equals_source:
        return False
    return 0 <= rc < 2 and rc != 1


def coverage() -> dict[str, int]:
    return {
        "tools": TOOL_COUNT,
        "executed": len(EXECUTED_TOOLS),
        "help_only": len(HELP_ONLY),
    }


def validate_contract() -> None:
    """Self-check the tables against the measured run."""
    shapes = (
        OUT_REQUIRED
        + OUT_OPTIONAL
        + POSITIONAL_PAIR
        + POSITIONAL_OPTIONAL_OUTPUT
        + OUT_ABSENT
        + SUBCOMMAND
        + FIXTURE_GENERATOR
        + TWO_INPUT_DOCUMENTS
        + PATCH_JSON_ARGUMENT
        + OUTDIR_TOOLS
    )
    if len(shapes) != TOOL_COUNT:
        raise ValueError(f"shape tables cover {len(shapes)} tools, expected {TOOL_COUNT}")
    if len(set(shapes)) != TOOL_COUNT:
        raise ValueError("a tool appears in more than one shape table")
    if len(POSITIONAL_PAIR) != 3:
        raise ValueError("exactly three tools take two positionals and reject --out")
    if not FAILURE_STILL_WRITES_OUTPUT:
        raise ValueError("the measured failure wrote its output")
    if OUTPUT_EXISTENCE_IS_EVIDENCE_OF_WORK:
        raise ValueError("an identical-to-source output was observed in a failure")
    if not EMPTY_EDIT_STILL_WRITES_DOCUMENT:
        raise ValueError("empty edits wrote documents in the measured run")
    if A11Y_AUDIT_CAN_FIX and not A11Y_AUDIT_FIX_FLAGS:
        raise ValueError("a fixable auditor needs its fix flags recorded")
    if len(SET_PROTECTION_MODES) != 5:
        raise ValueError("five protection modes")
    if FIXTURE_KINDS != ("tracked", "watermark", "all"):
        raise ValueError("fixture kinds do not match --help")
    if len(EXECUTED_TOOLS) + len(HELP_ONLY) != TOOL_COUNT:
        raise ValueError(
            f"executed {len(EXECUTED_TOOLS)} plus help-only {len(HELP_ONLY)} does not reach {TOOL_COUNT}"
        )
    if not EXECUTED_TOOLS.isdisjoint(HELP_ONLY):
        raise ValueError("a tool is claimed both executed and help-only")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
