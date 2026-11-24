# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R129 — locks the three skill-text contracts that closed ``skill_texts`` to 6/6.

The reverse mutations here are the point of the file. A contract that only agrees with itself
proves nothing, so each mutation breaks one load-bearing rule in the pinned inventory and the
suite must go red. The four chosen mutations are exactly the four a careless reader would most
likely "simplify": the gate order, the terminal-checks rule, the punctuation ban, and the
Office.js gate.
"""

from __future__ import annotations

import pytest

from app.core import skill_text_contracts as c


def test_three_texts_are_pinned() -> None:
    assert c.SKILL_TEXT_COUNT == 3
    assert len(c.SKILL_TEXTS) == c.SKILL_TEXT_COUNT
    names = [t.name for t in c.SKILL_TEXTS]
    assert names == ["spreadsheets", "excel-live-control", "presentations"]


def test_sizes_match_the_read() -> None:
    sizes = c.text_sizes()
    assert sizes["spreadsheets"] == (65_781, 467)
    assert sizes["excel-live-control"] == (72_454, 512)
    assert sizes["presentations"] == (30_044, 250)


def test_total_bytes_is_the_sum() -> None:
    assert c.total_bytes() == 65_781 + 72_454 + 30_044


def test_each_text_points_at_a_skill_body() -> None:
    for text in c.SKILL_TEXTS:
        assert text.relative_path.endswith("SKILL.md")
        assert text.engine
        assert text.surface


def test_spreadsheet_texts_are_two_surfaces_not_two_skills() -> None:
    assert c.SPREADSHEET_ROUTE_IS_TWO_SURFACES is True
    assert c.LIVE_ROUTE_FORBIDS_SIBLING_ARTIFACT_TEXT is True
    assert c.LIVE_ROUTE_FORBIDS_CELL_EDITS_VIA_COMPUTER_USE is True
    assert c.LIVE_ROUTE_STICKY_UNTIL_USER_SWITCHES is True
    assert c.GENERIC_CREATE_REQUEST_GOES_TO_ARTIFACT is True


def test_validate_contract_is_clean() -> None:
    assert c.validate_contract() == []


def test_coverage_reports_the_inventory() -> None:
    cov = c.coverage()
    assert cov["skill_texts"] == 3
    assert cov["setup_gates"] == 7
    assert cov["guidance_sentences"] == 9
    assert cov["advertised_live_tools"] == 16
    assert cov["tab_types"] == 7
    assert cov["artifact_verification_steps"] == 6
    assert cov["live_verification_steps"] == 5
    assert cov["slop_categories"] == 5
    assert cov["ai_ism_categories"] == 7
    assert cov["banned_punctuation"] == 5
    assert cov["min_font_points"] == (42, 32, 17)


def test_setup_gates_are_ordered_and_strict() -> None:
    assert c.SETUP_GATE_ORDER_IS_STRICT is True
    assert c.gate_order_is_valid("excel_open", "workbook_registered") is True
    assert c.gate_order_is_valid("workbook_registered", "excel_open") is False
    assert c.gate_order_is_valid("excel_open", "excel_open") is False
    assert c.setup_gate_index("workbook_registered") > c.setup_gate_index("pane_open")


def test_later_gate_cannot_prove_earlier() -> None:
    assert c.LATER_GATE_CANNOT_PROVE_EARLIER is True


def test_unknown_gate_is_refused() -> None:
    assert c.setup_gate_index("excel_installed_but_not_checked") == -1


def test_guidance_sentences_are_enumerated() -> None:
    assert len(c.GUIDANCE_KEYS) == 9
    assert c.guidance_keys_are_known(list(c.GUIDANCE_KEYS)) is True
    assert c.guidance_keys_are_known(["signed_out"]) is True
    assert c.guidance_keys_are_known(["please_try_again"]) is False
    assert c.GUIDANCE_IS_EXACT_AND_MINIMAL is True


def test_add_in_identity_is_pinned() -> None:
    assert c.ADD_IN_PUBLISHER == "OpenAI, LLC"
    assert c.ADD_IN_MARKETPLACE_URL.endswith("WA200010215")
    assert "20001063" in c.ADD_IN_ADMIN_GUIDANCE_URL
    assert c.ADD_IN_INSTALL_IS_USER_CONTROLLED is True


def test_sign_in_evidence_is_specific() -> None:
    assert "New chat" in c.SIGNED_IN_CHAT_SURFACE_MARKERS
    assert "Ask anything, @ for context" in c.SIGNED_IN_CHAT_SURFACE_MARKERS
    assert c.RIBBON_BUTTON_IS_NOT_PANE_OPEN_PROOF is True
    assert c.PANE_TITLE_IS_NOT_SIGN_IN_PROOF is True


def test_session_identity_is_never_guessed() -> None:
    assert c.SESSION_DISCOVERY_TOOL == "list_document_sessions"
    assert c.COMMAND_EXECUTOR == "execute_document_command"
    assert c.IDEMPOTENCY_KEY_IS_CALLER_STABLE is True
    assert c.SESSION_NEVER_REUSED_BY_TITLE_SIMILARITY is True
    assert c.REGISTRATION_TIED_TO_LIFECYCLE is True


def test_live_tool_set_excludes_the_gated_one() -> None:
    assert len(c.ADVERTISED_LIVE_TOOLS) == c.ADVERTISED_LIVE_TOOL_COUNT
    assert c.OPTIONAL_OFFICEJS_TOOL not in c.ADVERTISED_LIVE_TOOLS
    assert "read_range_image" in c.ADVERTISED_LIVE_TOOLS
    assert "pivot_table" in c.ADVERTISED_LIVE_TOOLS


def test_officejs_gate_requires_the_body_first() -> None:
    assert c.OFFICEJS_REQUIRES_READING_OFFICEJS_MD is True
    assert c.OFFICEJS_GATE_IS_PER_REQUEST is True


def test_unadvertised_capability_is_reported_not_substituted() -> None:
    assert c.UNKNOWN_CAPABILITY_IS_REPORTED_NOT_SUBSTITUTED is True


def test_tab_types_and_physical_order() -> None:
    assert len(c.TAB_TYPES) == c.TAB_TYPE_COUNT
    assert c.PHYSICAL_TAB_ORDER == ("outputs", "builds", "inputs_sources_internal")
    assert "after the primary output" in c.ASSUMPTIONS_PANEL_PLACEMENT
    assert c.TAB_POSITION_IS_NOT_CALCULATION_SEQUENCE is True


def test_checks_are_terminal_and_one_way() -> None:
    assert c.CHECKS_ARE_TERMINAL_AND_ONE_WAY is True
    assert c.CHECKS_FEED_NOTHING_OUTSIDE is True
    assert c.checks_may_feed_outside() is False


def test_case_selector_is_single_and_forecast_does_not_feed_itself() -> None:
    assert c.CASE_SELECTOR_IS_SINGLE_AND_AUTHORITATIVE is True
    assert c.FORECAST_MUST_NOT_FEED_ITS_OWN_ASSUMPTIONS is True
    assert c.PARALLEL_CASE_BUILDS_ARE_BANNED is True
    assert c.HISTORICAL_CALIBRATION_IS_A_BUILD_CALCULATION is True


def test_conditional_functions_preference() -> None:
    assert c.PREFERRED_CONDITIONAL_FUNCTIONS == ("COUNTIFS", "SUMIFS", "AVERAGEIFS")
    assert "COUNTIF" not in c.PREFERRED_CONDITIONAL_FUNCTIONS
    assert "COUNTIF" in c.DISCOURAGED_SINGLE_CRITERION_FUNCTIONS


def test_modern_formula_features_are_banned() -> None:
    for token in ("LET", "MAP", "REDUCE", "LAMBDA", "array_spill"):
        assert c.formula_feature_is_banned(token) is True
    assert c.formula_feature_is_banned("let") is True
    assert c.formula_feature_is_banned("SUMIFS") is False


def test_product_and_error_handling_warnings_are_load_bearing() -> None:
    assert c.PRODUCT_SKIPS_BLANKS is True
    assert c.N_A_TEXT_DIFFERS_FROM_NA_ERROR is True
    assert c.IFERROR_MUST_NOT_MASK_UNEXPECTED_FAILURE is True
    assert c.ISNUMBER_GUARD_MUST_NOT_FORGE_A_ZERO is True
    assert c.SUMIFS_ZERO_DOES_NOT_PROVE_COVERAGE is True
    assert c.BLANK_OVERRIDE_MEANS_BASE is True
    assert c.ZERO_OVERRIDE_MEANS_ZERO is True


def test_number_format_codes_are_excel_invariant() -> None:
    assert len(c.EXCEL_INVARIANT_CODE_TABLE) == 6
    for code in c.EXCEL_INVARIANT_CODE_TABLE:
        assert c.format_code_is_invariant(code) is True
    assert c.format_code_is_invariant("0,0%") is False
    assert c.format_code_swaps_locale_separator("0,0%") is True
    assert c.format_code_swaps_locale_separator("#.##0") is True
    assert c.format_code_swaps_locale_separator("0.0%") is False


def test_month_edges_use_edate_with_exclusive_upper_bound() -> None:
    assert c.MONTH_EDGE_USES_EXCLUSIVE_UPPER_BOUND is True
    assert "EDATE" in c.MONTHLY_SUMMARY_TEMPLATE
    assert '"<"' in c.MONTHLY_SUMMARY_TEMPLATE
    assert '"<="' not in c.MONTHLY_SUMMARY_TEMPLATE


def test_anchoring_cases_and_time_scales() -> None:
    assert c.ANCHOR_CASES == ("C8", "C$4", "$A8", "$B$3")
    assert c.TIME_SCALE_ORDER == ("annual", "quarterly", "monthly", "weekly")


def test_verification_steps_are_enumerated() -> None:
    assert len(c.ARTIFACT_VERIFICATION_STEPS) == 6
    assert c.ARTIFACT_VERIFICATION_STEPS[0] == "inspect_key_ranges"
    assert c.ARTIFACT_VERIFICATION_STEPS[-1] == "inspect_saved_file_when_needed"
    assert len(c.LIVE_VERIFICATION_STEPS) == 5
    assert c.LIVE_VERIFICATION_STEPS[0] == "inspect_key_values_and_formulas"


def test_recalculate_happens_once_before_checks() -> None:
    assert c.ARTIFACT_RECALCULATE_ONCE_BEFORE_CHECKS is True
    assert c.RECALCULATE_API_CALL == "workbook.recalculate()"


def test_error_scan_pattern_covers_every_token() -> None:
    assert c.FORMULA_ERROR_TOKENS == (
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
    assert c.FORMULA_ERROR_PATTERN == (
        r"#REF!|#DIV/0!|#VALUE!|#NAME\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!"
    )
    for token in c.FORMULA_ERROR_TOKENS:
        assert c.formula_error_is_scanned(token) is True
    assert c.formula_error_is_scanned("#NOTANERROR") is False


def test_output_is_thread_scoped() -> None:
    assert c.OUTPUT_PATH_IS_THREAD_SCOPED is True
    assert c.OUTPUT_DIR_TEMPLATE == "outputs/<unique_thread_id>/"


def test_authoring_marker_contract() -> None:
    assert c.ARTIFACT_OPERATION_MARKER_SCRIPT == "mark_artifact_operation_started.mjs"
    assert c.ARTIFACT_OPERATION_MARKER_ARGV[0] == "--operation-kind"
    assert c.ARTIFACT_OPERATION_MARKER_ARGV[-1] == "--output-format"
    assert c.ARTIFACT_OPERATION_MARKER_RUNS_ONCE is True
    assert c.ARTIFACT_OPERATION_MARKER_SKIPPED_FOR_READ_ONLY is True


def test_artifact_tool_is_the_default_author() -> None:
    assert c.ARTIFACT_TOOL_IS_THE_DEFAULT_AUTHOR is True
    assert c.OPENPYXL_WRITE_PATH_IS_NOT_DEFAULT is True
    assert c.NODE_MODULES_LINK_IS_REQUIRED is True
    assert c.NO_HEREDOCS_NO_DUPLICATE_BUILDERS is True


def test_slop_taxonomy_is_enumerated() -> None:
    assert len(c.SLOP_WORDING_CATEGORIES) == 5
    assert len(c.AI_ISM_CATEGORIES) == 7
    assert "formulaic_triples" in c.AI_ISM_CATEGORIES
    assert "hyphenated_compounds" in c.AI_ISM_CATEGORIES


def test_punctuation_bans_are_absolute() -> None:
    assert len(c.BANNED_PUNCTUATION) == 5
    assert c.PUNCTUATION_BANS_ARE_ABSOLUTE is True
    for name in ("em_dash", "semicolon", "dot_notation", "vertical_bar", "arrow"):
        assert c.punctuation_is_banned(name) is True
    assert c.punctuation_is_banned("comma") is False


def test_title_period_and_triple_rules() -> None:
    assert "remove from short titles" in c.TRAILING_PERIOD_RULE
    assert c.THREE_PART_LIST_IS_NOT_A_DEFAULT_PATTERN is True


def test_programmatic_drawing_is_banned_with_a_narrow_exception() -> None:
    assert c.PROGRAMMATIC_DRAWING_BANNED is True
    assert c.VISUAL_SOURCE_IS_SEARCH_OR_IMAGEGEN is True
    assert c.SAME_IMAGE_REUSE_BANNED_UNLESS_BACKGROUND is True
    assert c.NATIVE_EXCEPTION_IS_TABLES_CHARTS_AND_REQUESTED_DIAGRAMS is True
    assert c.NATIVE_EXCEPTION_MAY_NOT_BUILD_DECORATIVE_PANELS is True


def test_font_floor_descends() -> None:
    assert c.DECK_TITLE_MIN_PT == 42
    assert c.SLIDE_TITLE_MIN_PT == 32
    assert c.BODY_MIN_PT == 17
    assert c.OVERFLOW_FIX_IS_CUT_CONTENT_FIRST is True
    assert c.TEMPLATE_SIZES_WIN is True


def test_deck_delivery_rules() -> None:
    assert c.SLIDE_COUNT_IS_EXACT is True
    assert c.NO_DEFAULT_COVER_FOR_ONE_SLIDE is True
    assert c.PYTHON_PPTX_IS_BANNED is True
    assert c.ARTIFACT_TOOL_IS_THE_DECK_AUTHOR is True


def test_live_route_detection() -> None:
    assert c.is_live_route_request("create a spreadsheet") is False
    assert c.is_live_route_request("create a workbook") is False
    assert c.is_live_route_request(None) is False
    assert c.is_live_route_request("") is False
    assert c.is_live_route_request("edit the open workbook in Microsoft Excel") is True
    assert c.is_live_route_request("the ChatGPT add-in pane") is True
    assert c.is_live_route_request("Excel Desktop") is True


# --- reverse mutations: each must break a load-bearing rule --------------------------------


def test_mutation_gate_order_reversed_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(c, "SETUP_GATES", tuple(reversed(c.SETUP_GATES)))
    problems = c.validate_contract()
    assert problems, "reversing the gate order must be reported"
    assert any("gate order" in p for p in problems)


def test_mutation_checks_feed_outside_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(c, "CHECKS_ARE_TERMINAL_AND_ONE_WAY", False)
    problems = c.validate_contract()
    assert problems, "letting checks feed outside must be reported"
    assert any("checks" in p for p in problems)


def test_mutation_punctuation_ban_dropped_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(c, "BANNED_PUNCTUATION", ("em_dash", "semicolon"))
    problems = c.validate_contract()
    assert problems, "dropping three punctuation bans must be reported"
    assert any("punctuation" in p for p in problems)


def test_mutation_officejs_gate_removed_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(c, "OFFICEJS_REQUIRES_READING_OFFICEJS_MD", False)
    problems = c.validate_contract()
    assert problems, "removing the Office.js read-first gate must be reported"
    assert any("officejs" in p.lower() for p in problems)


def test_mutation_locale_swap_accepted_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(c, "INVARIANT_CODE_COUNT", 6)
    monkeypatch.setattr(
        c, "EXCEL_INVARIANT_CODE_TABLE", c.EXCEL_INVARIANT_CODE_TABLE + ("0,0%",)
    )
    problems = c.validate_contract()
    assert problems, "accepting a locale-swapped code must be reported"
    assert any("0,0%" in p for p in problems)


def test_mutation_size_drift_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    drifted = c.SkillText("spreadsheets", c.SPREADSHEETS_SKILL.relative_path, 65_782, 467, "x", "y")
    monkeypatch.setattr(c, "SPREADSHEETS_SKILL", drifted)
    problems = c.validate_contract()
    assert any("spreadsheets size drifted" in p for p in problems)


def test_mutation_error_scan_loses_a_token_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(c, "FORMULA_ERROR_TOKENS", ("#REF!", "#DIV/0!"))
    problems = c.validate_contract()
    assert problems, "losing seven error tokens must be reported"
    assert any("cover 9 tokens" in p for p in problems)


def test_mutation_font_floor_flattened_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(c, "BODY_MIN_PT", 32)
    problems = c.validate_contract()
    assert problems, "a flattened font floor must be reported"
