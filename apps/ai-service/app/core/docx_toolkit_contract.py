# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The documents toolkit: 36 tools, one placeholder syntax, and a blind spot (R112).

The ``presentations`` plugin had twelve container tools; ``documents`` has **thirty-six**, and
almost all of them share one shape:

    <tool>.py <in_docx> --out <out_docx>

Read a package, patch it, write a new one. Only three escape that shape: ``content_controls``
takes subcommands, and ``accept_tracked_changes`` / ``watermark_audit_remove`` / ``set_protection``
take ``--mode``.

Two things in here are worth more than a roster, and both were established by running the tools
rather than reading about them.

**One placeholder syntax, verified by trying four others.** ``wrap_placeholders`` was handed a
document containing ``{{name}}``, ``<<title>>``, ``${code}`` and ``[ref]``. It wrapped exactly one
run: the ``{{name}}``. The other three are not supported, and neither is a plain paragraph. So the
syntax is ``{{tag}}`` and nothing else -- worth writing down because a caller who guesses
``${name}`` will get a silently under-filled document rather than an error.

**The filled value is real and, to python-docx, invisible.** After ``fill --set name=Alice``:

    the JSON listing says   {"tag": "name", "text": "Alice"}
    the raw XML contains    <w:sdtContent><w:r><w:t>Alice</w:t></w:r></w:sdtContent>
    paragraph.text returns  'Name: '

All three are true. The value is in the package and Word will show it; it simply sits under
``w:sdt/w:sdtContent``, and ``Paragraph.text`` concatenates only the runs that are direct children
of the paragraph. Anything downstream that reads a document through ``paragraph.text`` -- a redactor,
a style linter, a privacy scrubber -- is looking straight past content-control values.

That is the same failure as R109's overflow checker: an instrument that reports clean because it
cannot see the thing it is supposed to look at. The difference is that this one is documented
python-docx behaviour rather than a bug, which makes it more dangerous, not less -- nobody will
file a ticket against it.

**One unit trap.** ``docx_ooxml_patch.py`` indents in ``--indent-left-twips``. Word measures
horizontal geometry in twips (1/20 pt, 635 EMU), while every drawing surface in
``presentations`` measures in EMU. 1 pt = 635 twips-worth of EMU = 12,700 EMU; 1 twip = 635 EMU.
Keeping the two apart matters: 1,000,000 of the wrong unit is not a small mistake.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- the roster -------------------------------------------------------------------------

TOOL_COUNT: Final = 36
TOOLS: Final = (
    ("docx_ooxml_patch.py", 22_752),
    ("a11y_audit.py", 13_207),
    ("internal_nav.py", 12_335),
    ("content_controls.py", 11_851),
    ("fields_materialize.py", 10_804),
    ("google_docs_title_sanitize.py", 10_376),
    ("table_geometry.py", 10_066),
    ("captions_and_crossrefs.py", 9_983),
    ("redact_docx.py", 9_823),
    ("insert_note.py", 9_269),
    ("make_fixtures.py", 8_928),
    ("comments_add.py", 8_904),
    ("insert_ref_fields.py", 7_353),
    ("add_tracked_replacements.py", 6_051),
    ("images_audit.py", 6_010),
    ("fields_report.py", 5_867),
    ("privacy_scrub.py", 5_851),
    ("style_normalize.py", 5_848),
    ("xlsx_to_docx_table.py", 5_843),
    ("accept_tracked_changes.py", 5_727),
    ("comments_extract.py", 5_589),
    ("style_lint.py", 5_586),
    ("watermark_add.py", 5_492),
    ("insert_toc.py", 5_242),
    ("set_protection.py", 5_141),
    ("comments_apply_patch.py", 5_082),
    ("comments_strip.py", 5_007),
    ("render_and_diff.py", 4_989),
    ("flatten_ref_fields.py", 4_872),
    ("watermark_audit_remove.py", 4_813),
    ("apply_template_styles.py", 4_180),
    ("merge_docx_append.py", 3_952),
    ("heading_audit.py", 3_330),
    ("footnotes_report.py", 3_004),
    ("section_audit.py", 2_792),
    ("docx_table_to_csv.py", 2_178),
)

# --- the contract shapes ----------------------------------------------------------------

READ_PATCH_WRITE: Final = "in_docx + --out"
SUBCONTRACT_SHAPE: Final = "subcommands"
MODE_SHAPE: Final = "--mode"

CONTRACT_FAMILIES: Final = {
    READ_PATCH_WRITE: 32,
    SUBCONTRACT_SHAPE: 1,
    MODE_SHAPE: 3,
}
READ_PATCH_WRITE_TOOL_COUNT: Final = 32
SUBCONTRACT_TOOLS: Final = ("content_controls.py",)
MODE_TOOLS: Final = (
    "accept_tracked_changes.py",
    "watermark_audit_remove.py",
    "set_protection.py",
)
MODE_CHOICES: Final = {
    "accept_tracked_changes.py": ("report", "accept", "reject"),
    "watermark_audit_remove.py": ("report", "remove"),
}

# --- content controls: one syntax, proven by trying four others ------------------------

CONTENT_CONTROLS: Final = "content_controls.py"
SUBCONTRACT_COMMANDS: Final = ("list", "wrap_placeholders", "fill")
PLACEHOLDER_SYNTAX: Final = "{{tag}}"
PLACEHOLDER_OPEN: Final = "{{"
PLACEHOLDER_CLOSE: Final = "}}"

REJECTED_SYNTAXES: Final = ("<<title>>", "${code}", "[ref]", "plain-paragraph")
REJECTED_SYNTAX_COUNT: Final = 4
CANDIDATES_TRIED: Final = 5
WRAPPED_RUNS: Final = 1
ONLY_DOUBLE_BRACES_SUPPORTED: Final = True

FILL_FLAG: Final = "--set TAG=VALUE"
FILL_IS_REPEATABLE: Final = True
LIST_FLAGS: Final = ("--no_headers_footers", "--json")
WRAP_FLAGS: Final = ("--output", "--no_headers_footers")
DEFAULT_SCOPE_INCLUDES_HEADERS_FOOTERS: Final = True

# --- the XML the tool writes -----------------------------------------------------------

SDT_XML_SHAPE: Final = (
    '<w:sdt><w:sdtPr><w:tag w:val="name"/><w:alias w:val="name"/><w:text/></w:sdtPr>'
    "<w:sdtContent><w:r><w:t>Alice</w:t></w:r></w:sdtContent></w:sdt>"
)
SDT_TAG_ATTRIBUTE: Final = "w:tag"
SDT_ALIAS_ATTRIBUTE: Final = "w:alias"
SDT_PLAIN_TEXT_MARKER: Final = "<w:text/>"
SDT_CONTENT_ELEMENT: Final = "w:sdtContent"
TAG_EQUALS_ALIAS: Final = True
PLACEHOLDER_BRACES_REMOVED_BY_FILL: Final = True

# --- the blind spot ---------------------------------------------------------------------

LISTED_TEXT_AFTER_FILL: Final = "Alice"
RAW_XML_OCCURRENCES_OF_VALUE: Final = 1
PARAGRAPH_TEXT_AFTER_FILL: Final = "Name: "
SDT_VALUE_IS_INVISIBLE_TO_PARAGRAPH_TEXT: Final = True
READ_PATCH_WRITE_TOOLS_MAY_BE_BLIND: Final = True

# --- units ------------------------------------------------------------------------------

TWIPS_PER_POINT: Final = 20
EMU_PER_TWIP: Final = 635
EMU_PER_POINT: Final = 12_700
TWIPS_BELONG_TO_DOCUMENTS: Final = True
EMU_BELONGS_TO_DRAWINGS: Final = True

# --- the runtime could run them -------------------------------------------------------

RUNTIME_PYTHON_HAS_DOCX: Final = True
RUNTIME_DOCX_VERSION: Final = "1.2.0"
RUNTIME_HAS_LXML: Final = True


class ContractError(ValueError):
    """Raised when the roster or the verified syntax claims drift."""


def family_of(tool: str) -> str:
    """Which contract shape a tool follows."""
    if tool in SUBCONTRACT_TOOLS:
        return SUBCONTRACT_SHAPE
    if tool in MODE_TOOLS:
        return MODE_SHAPE
    return READ_PATCH_WRITE


def is_placeholder(token: str) -> bool:
    """The only syntax the wrapper recognises."""
    return token.startswith(PLACEHOLDER_OPEN) and token.endswith(PLACEHOLDER_CLOSE)


def contract_summary() -> Mapping[str, object]:
    return {
        "tools": TOOL_COUNT,
        "placeholder_syntax": PLACEHOLDER_SYNTAX,
        "rejected": len(REJECTED_SYNTAXES),
        "sdt_invisible_to_paragraph_text": SDT_VALUE_IS_INVISIBLE_TO_PARAGRAPH_TEXT,
    }


def validate_contract() -> None:
    """Assert the roster, the one-and-only syntax, and above all the blind spot."""
    if TOOL_COUNT != 36 or len(TOOLS) != 36:
        raise ContractError("thirty-six tools")
    for name, size in TOOLS:
        if not name.endswith(".py"):
            raise ContractError("every entry is a python file")
        if size <= 0:
            raise ContractError("every entry has a size")
    if sum(CONTRACT_FAMILIES.values()) != TOOL_COUNT:
        raise ContractError("the families must account for every tool")
    if CONTRACT_FAMILIES[READ_PATCH_WRITE] != READ_PATCH_WRITE_TOOL_COUNT:
        raise ContractError("the dominant shape count drifted")
    if len(SUBCONTRACT_TOOLS) != 1:
        raise ContractError("one subcommand tool")
    if len(MODE_TOOLS) != 3:
        raise ContractError("three mode tools")
    for tool in SUBCONTRACT_TOOLS + MODE_TOOLS:
        if tool not in [n for n, _ in TOOLS]:
            raise ContractError(f"{tool} is not in the roster")

    if SUBCONTRACT_COMMANDS != ("list", "wrap_placeholders", "fill"):
        raise ContractError("three subcommands, in that order")
    if PLACEHOLDER_SYNTAX != "{{tag}}":
        raise ContractError("the syntax is double braces and nothing else")
    if len(REJECTED_SYNTAXES) != REJECTED_SYNTAX_COUNT:
        raise ContractError("four syntaxes were tried and rejected")
    if CANDIDATES_TRIED != REJECTED_SYNTAX_COUNT + 1:
        raise ContractError("five candidates, one accepted")
    if WRAPPED_RUNS != 1:
        raise ContractError("exactly one run was wrapped")
    if ONLY_DOUBLE_BRACES_SUPPORTED is not True:
        raise ContractError("never claim more than one syntax is supported")
    if not all(is_placeholder("{{x}}") for _ in [0]):
        raise ContractError("double braces must read as a placeholder")
    for token in REJECTED_SYNTAXES[:3]:
        if is_placeholder(token):
            raise ContractError(f"{token} must not read as a placeholder")

    if SDT_TAG_ATTRIBUTE != "w:tag" or SDT_ALIAS_ATTRIBUTE != "w:alias":
        raise ContractError("the tag/alias attributes are evidence")
    if SDT_PLAIN_TEXT_MARKER != "<w:text/>":
        raise ContractError("the plain-text marker is evidence")
    if SDT_CONTENT_ELEMENT != "w:sdtContent":
        raise ContractError("the content element is evidence")
    if TAG_EQUALS_ALIAS is not True:
        raise ContractError("tag and alias match in the observed output")
    if PLACEHOLDER_BRACES_REMOVED_BY_FILL is not True:
        raise ContractError("fill strips the braces")

    if LISTED_TEXT_AFTER_FILL != "Alice":
        raise ContractError("the listing shows the value")
    if RAW_XML_OCCURRENCES_OF_VALUE != 1:
        raise ContractError("the value is in the package exactly once")
    if PARAGRAPH_TEXT_AFTER_FILL != "Name: ":
        raise ContractError(
            "paragraph.text cannot see the sdt value -- this is the whole finding"
        )
    if SDT_VALUE_IS_INVISIBLE_TO_PARAGRAPH_TEXT is not True:
        raise ContractError("the blind spot is real and must stay recorded")
    if READ_PATCH_WRITE_TOOLS_MAY_BE_BLIND is not True:
        raise ContractError("the read-patch-write tools inherit the blind spot")

    if TWIPS_PER_POINT != 20 or EMU_PER_TWIP != 635:
        raise ContractError("unit facts drifted")
    if EMU_PER_TWIP * TWIPS_PER_POINT != EMU_PER_POINT:
        raise ContractError("the two unit families must reconcile")
    if TWIPS_BELONG_TO_DOCUMENTS is not True or EMU_BELONGS_TO_DRAWINGS is not True:
        raise ContractError("do not mix the unit families")

    if RUNTIME_DOCX_VERSION != "1.2.0":
        raise ContractError("the runtime version is measured, not guessed")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
