# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The three remaining skill texts as policy contracts (R129).

Until now the ledger counted ``skill_texts`` at three of six: the documents, pdf and
template-creator bodies had been read, while ``spreadsheets``, ``excel-live-control`` and
``presentations`` had not. This module closes all three, and it does so by pinning the parts
that are *checkable* rather than by paraphrasing prose.

**The two spreadsheet texts are not two skills — they are two execution surfaces of one doctrine.**
``spreadsheets/SKILL.md`` (65,781 B / 467 lines) authors a local ``.xlsx`` through
``@oai/artifact-tool``; ``excel-live-control/SKILL.md`` (72,454 B / 512 lines) drives an open
Microsoft Excel session through connected-document tools. The routing rule is explicit and
one-directional: a request that does not name the desktop app or the ChatGPT add-in belongs to
the artifact route, and once the live route is chosen it stays chosen until the user switches.
Crucially the live text forbids loading the sibling artifact instructions while the live route
is active, and forbids editing cells through Computer Use — Computer Use is for setup and focus
only. Roughly half of the live file is a verbatim repeat of the shared workbook doctrine (tab
types, formula rules, writing quality), which is why the two texts land at nearly the same length
despite serving different engines.

**The live setup is a six-gate state machine, and a later gate cannot prove an earlier one.**
Excel open → intended workbook active and unambiguous → add-in installed → pane open → signed
in → connected-document tools available → workbook registered. Each failure has an exact
user-facing sentence, and the text is explicit that a ribbon button is *not* proof the pane is
open, that a pane title is *not* proof of sign-in, and that a missing ``list_document_sessions``
means the thread never loaded the tool surface rather than that the workbook failed to register.
Registration is tied to workbook and add-in lifecycle, so renaming, reloading, or recovering
invalidates the session and an ``executor_session_id`` may never be reused just because the title
looks similar.

**``run_officejs`` has its own gate.** Before the first call the ``officejs.md`` body must be read
completely in the current turn, even when the schema is already loaded.

**Both spreadsheet texts agree on one arithmetic discipline.** Prefer ``COUNTIFS``/``SUMIFS``/
``AVERAGEIFS`` even for a single criterion so a second condition can be added consistently;
never introduce ``LET``, spilled arrays, ``MAP``, ``REDUCE`` or ``LAMBDA``; distinguish a real
zero from missing data by writing ``"n.a."`` rather than wrapping everything in
``IFERROR(...,0)``; and never let a guarded ``ISNUMBER`` turn a failed prerequisite into a
healthy zero. ``PRODUCT`` silently skips blanks, so required factors must be checked first.
Format codes are Excel-invariant and must not be locale-swapped: ``0.0%`` not ``0,0%``,
``#,##0`` not ``#.##0``.

**Checks are terminal and one-way.** A Check/Audit area may read sources and builds and compute
its own diagnostics, but nothing outside it may consume its results — not assumptions, not builds,
not summaries, not output gates. ``='Checks'!C8`` in a build is a dependency failure.

**The deck text is mostly a writing-quality engine.** ``presentations/SKILL.md`` (30,044 B / 250
lines) spends its first hundred lines on a five-category taxonomy of bad slide copy (awkward,
flowery, vague, unnecessary, illogical) and a seven-part list of AI-isms (em dashes, semicolons,
dot notation, vertical bars, arrows, "it is not X it is Y", passive voice, imperative titles,
slogan phrasing, formulaic triples, hyphenated compounds). The punctuation bans are absolute
sentences in the source: em dashes, semicolons, ASCII dots, vertical bars and arrows are each
described as "always slop".

**And it bans programmatic drawing outright.** No Python-drawn images, no programmatic vector
shapes, no programmatic drawings of any sort — use image search or imagegen, and do not reuse the
same image more than once unless it is a background. The stated exception is narrow: required
tables, data charts and explicitly requested editable diagrams stay native slide objects, and the
exception may not be used to build decorative panels.

**Typographic defaults are given as numbers, not adjectives.** Absent a template: at least 42pt
for a deck title, 32pt for a slide title, 17pt for body. Overflow is to be fixed by cutting
content before shrinking type.

**Honest boundary.** These are policy texts, not code. This module pins their measurable claims
(bytes, line counts, enumerated inventories, exact rule sentences) and their internal
consistency; it cannot prove that any given run obeyed them, and it does not claim to. The byte
and line counts are of the files as read on 2026-11-18 and will drift if the vendor ships a new
build.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final


@dataclass(frozen=True)
class SkillText:
    """One SKILL.md body, pinned by size and by what it enumerates."""

    name: str
    relative_path: str
    bytes: int
    lines: int
    engine: str
    surface: str


SPREADSHEETS_SKILL: Final = SkillText(
    "spreadsheets",
    "spreadsheets/skills/spreadsheets/SKILL.md",
    65_781,
    467,
    "@oai/artifact-tool",
    "local file authoring",
)
EXCEL_LIVE_CONTROL_SKILL: Final = SkillText(
    "excel-live-control",
    "spreadsheets/skills/excel-live-control/SKILL.md",
    72_454,
    512,
    "connected-document tools",
    "live Microsoft Excel session",
)
PRESENTATIONS_SKILL: Final = SkillText(
    "presentations",
    "presentations/skills/presentations/SKILL.md",
    30_044,
    250,
    "@oai/artifact-tool",
    "local file authoring and artifact session",
)
SKILL_TEXTS: Final = (
    SPREADSHEETS_SKILL,
    EXCEL_LIVE_CONTROL_SKILL,
    PRESENTATIONS_SKILL,
)
SKILL_TEXT_COUNT: Final = 3

SPREADSHEET_ROUTE_IS_TWO_SURFACES: Final = True
LIVE_ROUTE_FORBIDS_SIBLING_ARTIFACT_TEXT: Final = True
LIVE_ROUTE_FORBIDS_CELL_EDITS_VIA_COMPUTER_USE: Final = True
LIVE_ROUTE_STICKY_UNTIL_USER_SWITCHES: Final = True
GENERIC_CREATE_REQUEST_GOES_TO_ARTIFACT: Final = True

SETUP_GATES: Final = (
    "excel_open",
    "target_workbook_active_and_unambiguous",
    "add_in_installed",
    "pane_open",
    "signed_in",
    "connected_document_tools_available",
    "workbook_registered",
)
SETUP_GATE_COUNT: Final = 7
SETUP_GATE_ORDER_IS_STRICT: Final = True
LATER_GATE_CANNOT_PROVE_EARLIER: Final = True

ADD_IN_PUBLISHER: Final = "OpenAI, LLC"
ADD_IN_MARKETPLACE_URL: Final = (
    "https://marketplace.microsoft.com/en-us/product/office/WA200010215"
)
ADD_IN_ADMIN_GUIDANCE_URL: Final = (
    "https://help.openai.com/en/articles/20001063-chatgpt-for-excel/"
)
ADD_IN_INSTALL_IS_USER_CONTROLLED: Final = True

SIGNED_IN_CHAT_SURFACE_MARKERS: Final = ("New chat", "Ask anything, @ for context")
SIGN_IN_INCOMPLETE_MARKERS: Final = (
    "Sign in",
    "Log in",
    "Get started",
    "account-choice",
    "workspace-access",
)
RIBBON_BUTTON_IS_NOT_PANE_OPEN_PROOF: Final = True
PANE_TITLE_IS_NOT_SIGN_IN_PROOF: Final = True
SESSION_DISCOVERY_TOOL: Final = "list_document_sessions"
TOOL_SCHEMA_READER: Final = "get_document_tool_schemas"
COMMAND_EXECUTOR: Final = "execute_document_command"
IDEMPOTENCY_KEY_IS_CALLER_STABLE: Final = True
SESSION_ID_FIELD: Final = "executor_session_id"
SESSION_NEVER_REUSED_BY_TITLE_SIMILARITY: Final = True
REGISTRATION_TIED_TO_LIFECYCLE: Final = True

ADVERTISED_LIVE_TOOLS: Final = (
    "read_ranges",
    "search_workbook",
    "list_items",
    "write_range",
    "clear_range",
    "update_sheet",
    "update_workbook",
    "copy_range_to",
    "read_range_image",
    "read_sheets_metadata",
    "resize_range",
    "update_sheet_view",
    "format_range",
    "chart",
    "table",
    "pivot_table",
)
ADVERTISED_LIVE_TOOL_COUNT: Final = 16
OPTIONAL_OFFICEJS_TOOL: Final = "run_officejs"
OFFICEJS_REQUIRES_READING_OFFICEJS_MD: Final = True
OFFICEJS_GATE_IS_PER_REQUEST: Final = True
UNKNOWN_CAPABILITY_IS_REPORTED_NOT_SUBSTITUTED: Final = True

GUIDANCE_KEYS: Final = (
    "excel_unavailable",
    "target_workbook_unclear",
    "add_in_missing",
    "installation_blocked",
    "pane_closed",
    "signed_out",
    "tools_unavailable",
    "wrong_workbook_registered",
    "workbook_not_registered",
)
GUIDANCE_COUNT: Final = 9
GUIDANCE_IS_EXACT_AND_MINIMAL: Final = True

TAB_TYPES: Final = (
    "inputs_sources",
    "assumptions",
    "build",
    "output_summary",
    "check_audit",
    "cover",
    "readme",
)
TAB_TYPE_COUNT: Final = 7
PHYSICAL_TAB_ORDER: Final = ("outputs", "builds", "inputs_sources_internal")
ASSUMPTIONS_PANEL_PLACEMENT: Final = "after the primary output, before the build tabs"
TAB_POSITION_IS_NOT_CALCULATION_SEQUENCE: Final = True
CHECKS_ARE_TERMINAL_AND_ONE_WAY: Final = True
CHECKS_FEED_NOTHING_OUTSIDE: Final = True
LINK_ONLY_TAB_IS_A_RED_FLAG: Final = True
FOCUSED_TASK_STARTS_WITH_ONE_TAB_OR_TWO: Final = True

CASE_SELECTOR_IS_SINGLE_AND_AUTHORITATIVE: Final = True
ACTIVE_SELECTION_ROW_PRECEDES_CASE_INPUTS: Final = True
FORECAST_MUST_NOT_FEED_ITS_OWN_ASSUMPTIONS: Final = True
HISTORICAL_CALIBRATION_IS_A_BUILD_CALCULATION: Final = True
PARALLEL_CASE_BUILDS_ARE_BANNED: Final = True

PREFERRED_CONDITIONAL_FUNCTIONS: Final = ("COUNTIFS", "SUMIFS", "AVERAGEIFS")
DISCOURAGED_SINGLE_CRITERION_FUNCTIONS: Final = ("COUNTIF", "SUMIF", "AVERAGEIF")
BANNED_MODERN_FORMULA_FEATURES: Final = ("LET", "MAP", "REDUCE", "LAMBDA", "array_spill")
ALLOWED_LOOKUP_FAMILIES: Final = ("INDEX_MATCH", "VLOOKUP", "XLOOKUP")
PRODUCT_SKIPS_BLANKS: Final = True
N_A_TEXT_DIFFERS_FROM_NA_ERROR: Final = True
IFERROR_MUST_NOT_MASK_UNEXPECTED_FAILURE: Final = True
ISNUMBER_GUARD_MUST_NOT_FORGE_A_ZERO: Final = True
SUMIFS_ZERO_DOES_NOT_PROVE_COVERAGE: Final = True
BLANK_OVERRIDE_MEANS_BASE: Final = True
ZERO_OVERRIDE_MEANS_ZERO: Final = True

EXCEL_INVARIANT_CODE_TABLE: Final = (
    "#,##0",
    "#,##0.0",
    "0.0%",
    "0.00%",
    '"$"#,##0',
    '"$"#,##0.00',
)
INVARIANT_CODE_COUNT: Final = 6
LOCALE_SEPARATOR_SWAP_BANNED: Final = True
BANNED_CODE_FORMS: Final = ("0,0%", "#.##0")
MONTHLY_SUMMARY_TEMPLATE: Final = (
    '=SUMIFS(Amount,Date,">="&C$4,Date,"<"&EDATE(C$4,1),Item,$A8)'
)
MONTH_EDGE_USES_EXCLUSIVE_UPPER_BOUND: Final = True

ANCHOR_CASES: Final = ("C8", "C$4", "$A8", "$B$3")
ANCHOR_CASE_COUNT: Final = 4
TIME_SCALE_ORDER: Final = ("annual", "quarterly", "monthly", "weekly")

ARTIFACT_RECALCULATE_ONCE_BEFORE_CHECKS: Final = True
RECALCULATE_API_CALL: Final = "workbook.recalculate()"
ARTIFACT_VERIFICATION_STEPS: Final = (
    "inspect_key_ranges",
    "scan_formula_errors",
    "verify_recalculation_in_engine",
    "render_ranges",
    "export",
    "inspect_saved_file_when_needed",
)
ARTIFACT_VERIFICATION_STEP_COUNT: Final = 6
FORMULA_ERROR_TOKENS: Final = (
    "#REF!",
    "#DIV/0!",
    "#VALUE!",
    "#NAME?",
    "#N/A",
    "#NUM!",
    "#NULL!",
    "#SPILL!",
    "#CALC!",
)
FORMULA_ERROR_TOKEN_COUNT: Final = 9
FORMULA_ERROR_PATTERN: Final = "|".join(
    token.replace("?", r"\?") for token in FORMULA_ERROR_TOKENS
)
LIVE_VERIFICATION_STEPS: Final = (
    "inspect_key_values_and_formulas",
    "scan_formula_errors",
    "visual_output_via_read_range_image",
    "keep_verification_compact",
    "finalize_when_checks_pass",
)
LIVE_VERIFICATION_STEP_COUNT: Final = 5
OUTPUT_PATH_IS_THREAD_SCOPED: Final = True
OUTPUT_DIR_TEMPLATE: Final = "outputs/<unique_thread_id>/"

ARTIFACT_OPERATION_MARKER_SCRIPT: Final = "mark_artifact_operation_started.mjs"
ARTIFACT_OPERATION_MARKER_ARGV: Final = (
    "--operation-kind",
    "create",
    "--expected-output-count",
    "1",
    "--output-format",
)
ARTIFACT_OPERATION_MARKER_RUNS_ONCE: Final = True
ARTIFACT_OPERATION_MARKER_SKIPPED_FOR_READ_ONLY: Final = True
NODE_MODULES_LINK_IS_REQUIRED: Final = True
NO_HEREDOCS_NO_DUPLICATE_BUILDERS: Final = True
OPENPYXL_WRITE_PATH_IS_NOT_DEFAULT: Final = True
ARTIFACT_TOOL_IS_THE_DEFAULT_AUTHOR: Final = True

SLOP_WORDING_CATEGORIES: Final = (
    "awkward_unnatural",
    "excessive_flowery",
    "vague_empty",
    "unnecessary",
    "illogical",
)
SLOP_WORDING_CATEGORY_COUNT: Final = 5
AI_ISM_CATEGORIES: Final = (
    "punctuation",
    "not_x_but_y",
    "passive_voice",
    "imperative_title",
    "slogan_phrasing",
    "formulaic_triples",
    "hyphenated_compounds",
)
AI_ISM_CATEGORY_COUNT: Final = 7
BANNED_PUNCTUATION: Final = ("em_dash", "semicolon", "dot_notation", "vertical_bar", "arrow")
BANNED_PUNCTUATION_COUNT: Final = 5
PUNCTUATION_BANS_ARE_ABSOLUTE: Final = True
TRAILING_PERIOD_RULE: Final = "remove from short titles, keep on long complete sentences"
THREE_PART_LIST_IS_NOT_A_DEFAULT_PATTERN: Final = True

PROGRAMMATIC_DRAWING_BANNED: Final = True
VISUAL_SOURCE_IS_SEARCH_OR_IMAGEGEN: Final = True
SAME_IMAGE_REUSE_BANNED_UNLESS_BACKGROUND: Final = True
NATIVE_EXCEPTION_IS_TABLES_CHARTS_AND_REQUESTED_DIAGRAMS: Final = True
NATIVE_EXCEPTION_MAY_NOT_BUILD_DECORATIVE_PANELS: Final = True

DECK_TITLE_MIN_PT: Final = 42
SLIDE_TITLE_MIN_PT: Final = 32
BODY_MIN_PT: Final = 17
OVERFLOW_FIX_IS_CUT_CONTENT_FIRST: Final = True
TEMPLATE_SIZES_WIN: Final = True
UI_PANEL_STYLING_IS_DISCOURAGED: Final = True

SLIDE_COUNT_IS_EXACT: Final = True
NO_DEFAULT_COVER_FOR_ONE_SLIDE: Final = True
PYTHON_PPTX_IS_BANNED: Final = True
ARTIFACT_TOOL_IS_THE_DECK_AUTHOR: Final = True
CITATIONS_LIVE_IN_SPEAKER_NOTES_UNLESS_AUDIENCE_VISIBLE: Final = True

VALIDATION_RULES: Final = 12


def text_sizes() -> dict[str, tuple[int, int]]:
    """Size of each pinned text, keyed by skill name."""
    return {t.name: (t.bytes, t.lines) for t in SKILL_TEXTS}


def total_bytes() -> int:
    """Combined byte size of the three pinned texts."""
    return sum(t.bytes for t in SKILL_TEXTS)


def is_live_route_request(named_target: str | None) -> bool:
    """Whether a request names the desktop app or add-in, i.e. belongs to the live route.

    The live text is explicit that a generic "create a spreadsheet" request does not qualify,
    even though the words are identical, because routing selects a surface rather than content.
    """
    if not named_target:
        return False
    lowered = str(named_target).lower()
    markers = ("excel", "add-in", "addin", "desktop")
    return any(m in lowered for m in markers)


def guidance_keys_are_known(keys: list[str] | tuple[str, ...]) -> bool:
    """Whether every referenced guidance sentence has a defined key."""
    return all(k in GUIDANCE_KEYS for k in keys)


def setup_gate_index(name: str) -> int:
    """Position of a setup gate in the strict order, or ``-1`` when it is not a gate."""
    try:
        return SETUP_GATES.index(name)
    except ValueError:
        return -1


def gate_order_is_valid(before: str, after: str) -> bool:
    """Whether ``before`` genuinely precedes ``after`` in the strict gate order."""
    i, j = setup_gate_index(before), setup_gate_index(after)
    if i < 0 or j < 0:
        return False
    return i < j


def formula_feature_is_banned(token: str) -> bool:
    """Whether a modern formula feature is on the banned list."""
    return str(token).upper() in {f.upper() for f in BANNED_MODERN_FORMULA_FEATURES}


def format_code_is_invariant(code: str) -> bool:
    """Whether a number-format code is one of the Excel-invariant forms."""
    return code in EXCEL_INVARIANT_CODE_TABLE


def format_code_swaps_locale_separator(code: str) -> bool:
    """Whether a code swaps ``.`` and ``,`` to mimic a locale separator."""
    return code in BANNED_CODE_FORMS


def formula_error_is_scanned(token: str) -> bool:
    """Whether the token appears in the error scan pattern."""
    return token in FORMULA_ERROR_TOKENS


def checks_may_feed_outside() -> bool:
    """Whether a Checks/Audit result may be consumed outside its own area. Always false."""
    return not CHECKS_ARE_TERMINAL_AND_ONE_WAY


def punctuation_is_banned(name: str) -> bool:
    """Whether a punctuation habit is on the deck's absolute ban list."""
    return name in BANNED_PUNCTUATION


def coverage() -> dict[str, Any]:
    """What this module pins, for the ledger to cite without recomputing."""
    return {
        "skill_texts": SKILL_TEXT_COUNT,
        "total_bytes": total_bytes(),
        "spreadsheet_surfaces": 2,
        "setup_gates": SETUP_GATE_COUNT,
        "guidance_sentences": GUIDANCE_COUNT,
        "advertised_live_tools": ADVERTISED_LIVE_TOOL_COUNT,
        "tab_types": TAB_TYPE_COUNT,
        "banned_formula_features": len(BANNED_MODERN_FORMULA_FEATURES),
        "invariant_format_codes": INVARIANT_CODE_COUNT,
        "artifact_verification_steps": ARTIFACT_VERIFICATION_STEP_COUNT,
        "live_verification_steps": LIVE_VERIFICATION_STEP_COUNT,
        "slop_categories": SLOP_WORDING_CATEGORY_COUNT,
        "ai_ism_categories": AI_ISM_CATEGORY_COUNT,
        "banned_punctuation": BANNED_PUNCTUATION_COUNT,
        "min_font_points": (DECK_TITLE_MIN_PT, SLIDE_TITLE_MIN_PT, BODY_MIN_PT),
    }


def validate_contract() -> list[str]:
    """Assert the pinned inventory is internally consistent. Returns the problems found."""
    problems: list[str] = []

    if len(SKILL_TEXTS) != SKILL_TEXT_COUNT:
        problems.append(f"expected {SKILL_TEXT_COUNT} texts, listed {len(SKILL_TEXTS)}")
    for text in SKILL_TEXTS:
        if text.bytes <= 0 or text.lines <= 0:
            problems.append(f"{text.name} has no measured size")
        if not text.relative_path.endswith("SKILL.md"):
            problems.append(f"{text.name} does not point at a SKILL.md")

    if SPREADSHEETS_SKILL.bytes != 65_781 or SPREADSHEETS_SKILL.lines != 467:
        problems.append("spreadsheets size drifted from 65,781 B / 467 lines")
    if EXCEL_LIVE_CONTROL_SKILL.bytes != 72_454 or EXCEL_LIVE_CONTROL_SKILL.lines != 512:
        problems.append("excel-live-control size drifted from 72,454 B / 512 lines")
    if PRESENTATIONS_SKILL.bytes != 30_044 or PRESENTATIONS_SKILL.lines != 250:
        problems.append("presentations size drifted from 30,044 B / 250 lines")

    if len(SETUP_GATES) != SETUP_GATE_COUNT:
        problems.append("setup gate count does not match the listed gates")
    if not LATER_GATE_CANNOT_PROVE_EARLIER:
        problems.append("a later gate must not be allowed to prove an earlier one")
    if gate_order_is_valid("workbook_registered", "excel_open"):
        problems.append("gate order must not accept registration before Excel is open")
    if not gate_order_is_valid("excel_open", "workbook_registered"):
        problems.append("gate order must accept Excel before registration")
    if setup_gate_index("nonexistent_gate") != -1:
        problems.append("an unknown gate must not resolve to a position")

    if len(GUIDANCE_KEYS) != GUIDANCE_COUNT:
        problems.append("guidance count does not match the listed keys")
    if not guidance_keys_are_known(list(GUIDANCE_KEYS)):
        problems.append("a listed guidance key is not known")
    if guidance_keys_are_known(["not_a_key"]):
        problems.append("an unknown guidance key must be refused")

    if len(ADVERTISED_LIVE_TOOLS) != ADVERTISED_LIVE_TOOL_COUNT:
        problems.append("advertised live tool count drifted")
    if OPTIONAL_OFFICEJS_TOOL in ADVERTISED_LIVE_TOOLS:
        problems.append("run_officejs must stay outside the default advertised set")
    if not OFFICEJS_REQUIRES_READING_OFFICEJS_MD:
        problems.append("the Office.js gate must require reading officejs.md")
    if UNKNOWN_CAPABILITY_IS_REPORTED_NOT_SUBSTITUTED is not True:
        problems.append("an unadvertised capability must be reported, not substituted")

    if len(TAB_TYPES) != TAB_TYPE_COUNT:
        problems.append("tab type count drifted")
    if PHYSICAL_TAB_ORDER[0] != "outputs":
        problems.append("outputs must lead the physical tab order")
    if not CHECKS_ARE_TERMINAL_AND_ONE_WAY:
        problems.append("checks must stay terminal")
    if checks_may_feed_outside():
        problems.append("checks must feed nothing outside their own area")

    if formula_feature_is_banned("let") is not True:
        problems.append("LET must be banned")
    if formula_feature_is_banned("MAP") is not True:
        problems.append("MAP must be banned")
    if formula_feature_is_banned("SUMIFS") is not False:
        problems.append("SUMIFS must not be banned")
    if "COUNTIFS" not in PREFERRED_CONDITIONAL_FUNCTIONS:
        problems.append("COUNTIFS must be the preferred conditional counter")
    if "COUNTIF" in PREFERRED_CONDITIONAL_FUNCTIONS:
        problems.append("COUNTIF must not be preferred for new work")

    if not PRODUCT_SKIPS_BLANKS:
        problems.append("the product-skips-blanks warning is load-bearing and must stay")
    if not IFERROR_MUST_NOT_MASK_UNEXPECTED_FAILURE:
        problems.append("IFERROR must not be allowed to mask unexpected failures")
    if not ISNUMBER_GUARD_MUST_NOT_FORGE_A_ZERO:
        problems.append("a guard must not forge a healthy zero")
    if not SUMIFS_ZERO_DOES_NOT_PROVE_COVERAGE:
        problems.append("a zero SUMIFS must not be read as proof of coverage")
    if not (BLANK_OVERRIDE_MEANS_BASE and ZERO_OVERRIDE_MEANS_ZERO):
        problems.append("a blank override must mean base while a zero override means zero")

    if len(EXCEL_INVARIANT_CODE_TABLE) != INVARIANT_CODE_COUNT:
        problems.append("invariant format code count drifted")
    for code in BANNED_CODE_FORMS:
        if format_code_is_invariant(code):
            problems.append(f"{code} is a locale-swapped form and must not be accepted")
    if not format_code_is_invariant("0.0%"):
        problems.append("0.0% must be an accepted code")
    if not format_code_swaps_locale_separator("0,0%"):
        problems.append("0,0% must be recognised as a swapped form")
    if not MONTH_EDGE_USES_EXCLUSIVE_UPPER_BOUND:
        problems.append("month edges must use an exclusive upper bound")
    if "EDATE" not in MONTHLY_SUMMARY_TEMPLATE:
        problems.append("the monthly summary template must step with EDATE")

    if len(ANCHOR_CASES) != ANCHOR_CASE_COUNT:
        problems.append("anchor case count drifted")
    if TIME_SCALE_ORDER != ("annual", "quarterly", "monthly", "weekly"):
        problems.append("time scales must widen from annual to weekly")

    if len(ARTIFACT_VERIFICATION_STEPS) != ARTIFACT_VERIFICATION_STEP_COUNT:
        problems.append("artifact verification step count drifted")
    if len(LIVE_VERIFICATION_STEPS) != LIVE_VERIFICATION_STEP_COUNT:
        problems.append("live verification step count drifted")
    if not ARTIFACT_RECALCULATE_ONCE_BEFORE_CHECKS:
        problems.append("a single recalculate before the final checks is required")
    for token in FORMULA_ERROR_TOKENS:
        if not formula_error_is_scanned(token):
            problems.append(f"{token} is not covered by the error scan pattern")
    if len(FORMULA_ERROR_TOKENS) != FORMULA_ERROR_TOKEN_COUNT:
        problems.append(
            "the error scan must cover "
            f"{FORMULA_ERROR_TOKEN_COUNT} tokens, inventory carries "
            f"{len(FORMULA_ERROR_TOKENS)}"
        )
    if FORMULA_ERROR_PATTERN != (
        r"#REF!|#DIV/0!|#VALUE!|#NAME\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!"
    ):
        problems.append("the derived error scan pattern drifted from the source regex")
    if formula_error_is_scanned("#NOTANERROR"):
        problems.append("an unknown token must not be reported as scanned")

    if len(SLOP_WORDING_CATEGORIES) != SLOP_WORDING_CATEGORY_COUNT:
        problems.append("slop wording category count drifted")
    if len(AI_ISM_CATEGORIES) != AI_ISM_CATEGORY_COUNT:
        problems.append("AI-ism category count drifted")
    if len(BANNED_PUNCTUATION) != BANNED_PUNCTUATION_COUNT:
        problems.append("banned punctuation count drifted")
    if not punctuation_is_banned("em_dash"):
        problems.append("em dashes must be banned")
    if not punctuation_is_banned("semicolon"):
        problems.append("semicolons must be banned")
    if punctuation_is_banned("comma"):
        problems.append("commas must not be on the ban list")
    if not PUNCTUATION_BANS_ARE_ABSOLUTE:
        problems.append("the punctuation bans are absolute sentences in the source")
    if not THREE_PART_LIST_IS_NOT_A_DEFAULT_PATTERN:
        problems.append("a formulaic triple must not be a default pattern")

    if not PROGRAMMATIC_DRAWING_BANNED:
        problems.append("programmatic drawing must stay banned")
    if not VISUAL_SOURCE_IS_SEARCH_OR_IMAGEGEN:
        problems.append("visuals must come from search or imagegen")
    if not SAME_IMAGE_REUSE_BANNED_UNLESS_BACKGROUND:
        problems.append("image reuse must stay banned outside backgrounds")
    if not NATIVE_EXCEPTION_IS_TABLES_CHARTS_AND_REQUESTED_DIAGRAMS:
        problems.append("the native-object exception must stay narrow")
    if not NATIVE_EXCEPTION_MAY_NOT_BUILD_DECORATIVE_PANELS:
        problems.append("the native exception must not licence decoration")

    if not (DECK_TITLE_MIN_PT > SLIDE_TITLE_MIN_PT > BODY_MIN_PT > 0):
        problems.append("the font floor must descend title > slide title > body")
    if DECK_TITLE_MIN_PT != 42 or SLIDE_TITLE_MIN_PT != 32 or BODY_MIN_PT != 17:
        problems.append("the font floor drifted from 42 / 32 / 17")
    if not OVERFLOW_FIX_IS_CUT_CONTENT_FIRST:
        problems.append("overflow must be fixed by cutting content first")

    if not SLIDE_COUNT_IS_EXACT:
        problems.append("an N-slide request must mean N slides")
    if not NO_DEFAULT_COVER_FOR_ONE_SLIDE:
        problems.append("a one-slide deliverable must not gain a default cover")
    if not PYTHON_PPTX_IS_BANNED:
        problems.append("python-pptx must stay banned for deck authoring")
    if not ARTIFACT_TOOL_IS_THE_DECK_AUTHOR:
        problems.append("@oai/artifact-tool must remain the deck author")

    if is_live_route_request("create a spreadsheet") is not False:
        problems.append("a generic create request must not enter the live route")
    if is_live_route_request("edit the open workbook in Microsoft Excel") is not True:
        problems.append("a request naming Excel must enter the live route")
    if is_live_route_request(None) is not False:
        problems.append("an unnamed target must not enter the live route")

    return problems
