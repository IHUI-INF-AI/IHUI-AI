# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Contract tests for the Google Workspace export bridge (R128)."""

from __future__ import annotations

import pytest

from app.core import google_workspace_export_contract as gwx


def test_script_size_matches_the_file_read() -> None:
    assert gwx.SCRIPT_BYTES == 10_017
    assert gwx.SCRIPT_LINES == 353


def test_two_export_formats_only() -> None:
    assert len(gwx.EXPORT_FORMATS) == 2
    assert set(gwx.EXPORT_MIME_TYPES) == {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    assert gwx.export_format_mime("application/pdf") == ".pdf"


def test_pdf_prefix_is_the_real_header() -> None:
    pdf = next(f for f in gwx.EXPORT_FORMATS if f.extension == ".pdf")
    assert pdf.base64_prefix == "JVBERi0"


def test_xlsx_prefix_is_a_zip_header() -> None:
    xlsx = next(f for f in gwx.EXPORT_FORMATS if f.extension == ".xlsx")
    assert xlsx.base64_prefix == "UEsDB"


def test_decoded_length_is_arithmetic_only() -> None:
    assert gwx.decoded_byte_length("AAAA") == 3
    assert gwx.decoded_byte_length("AA==") == 1
    assert gwx.decoded_byte_length("AAA=") == 2
    assert gwx.BYTES_NEVER_DECODED is True


def test_decoded_length_rejects_non_multiple_of_four() -> None:
    assert gwx.decoded_byte_length("AAA") is None
    assert gwx.decoded_byte_length("") is None


def test_prefix_check_pins_format_to_header() -> None:
    assert gwx.payload_prefix_is_valid("JVBERi0xk", "application/pdf")
    assert not gwx.payload_prefix_is_valid(
        "UEsDBxk", "application/pdf"
    )
    assert gwx.payload_prefix_is_valid("UEsDBxk", gwx.EXPORT_MIME_TYPES[1])


def test_canonical_url_is_accepted() -> None:
    assert gwx.source_url_is_accepted(
        "https://docs.google.com/document/d/abcDEF_-123/edit"
    )


def test_account_prefixed_url_is_accepted() -> None:
    assert gwx.source_url_is_accepted(
        "https://docs.google.com/presentation/u/3/d/abc123/edit"
    )


def test_control_characters_in_url_are_refused() -> None:
    assert not gwx.source_url_is_accepted(
        "https://docs.google.com/document/d/abc\nInjected"
    )
    assert not gwx.source_url_is_accepted(
        "https://docs.google.com/document/d/abc\x7f"
    )


def test_non_google_host_is_refused() -> None:
    assert not gwx.source_url_is_accepted(
        "https://example.com/document/d/abc/edit"
    )


def test_non_workspace_family_is_refused() -> None:
    assert not gwx.source_url_is_accepted(
        "https://docs.google.com/file/d/abc/edit"
    )


def test_error_messages_redact_every_url() -> None:
    assert gwx.redact_urls(
        "see https://docs.google.com/document/d/x/edit?usp=sharing"
    ) == "see [URL_REDACTED]"
    assert gwx.redact_urls("two https://a.example/x and http://b.example/y") == (
        "two [URL_REDACTED] and [URL_REDACTED]"
    )


def test_preferred_connector_name_wins() -> None:
    assert (
        gwx.resolve_connector_tool(["mcp__codex_apps__google_drive_fetch"])
        == gwx.PREFERRED_CONNECTOR_TOOL
    )


def test_single_suffix_match_resolves() -> None:
    assert gwx.resolve_connector_tool(["google_drive_fetch"]) == "google_drive_fetch"


def test_ambiguous_suffix_matches_resolve_to_nothing() -> None:
    assert (
        gwx.resolve_connector_tool(
            ["google_drive_fetch", "gdf-google-drive-fetch"]
        )
        is None
    )


def test_zero_suffix_matches_resolve_to_nothing() -> None:
    assert gwx.resolve_connector_tool(["unrelated"]) is None


def test_output_extension_must_match_mime() -> None:
    assert gwx.output_path_matches_mime("/w/out.pdf", "application/pdf")
    assert not gwx.output_path_matches_mime("/w/out.pdf", gwx.EXPORT_MIME_TYPES[1])


def test_data_frame_shape() -> None:
    frame = gwx.frame_payload("AAAA", 3)
    assert frame == "D\t3\tAAAA\u0003"


def test_commit_and_abort_frames() -> None:
    assert gwx.commit_frame() == "C\u0003"
    assert gwx.abort_frame() == "A\u0003"


def test_receipt_is_three_way_reconciled() -> None:
    digest = "a" * 64
    assert gwx.receipt_is_trusted(
        f"TEMPLATE_EXPORT_COMMITTED 42 {digest}", 42, 0
    )
    assert not gwx.receipt_is_trusted(
        f"TEMPLATE_EXPORT_COMMITTED 41 {digest}", 42, 0
    )
    assert not gwx.receipt_is_trusted(
        f"TEMPLATE_EXPORT_COMMITTED 42 {digest}", 42, 1
    )
    assert not gwx.receipt_is_trusted(
        f"TEMPLATE_EXPORT_COMMITTED 42 {'a' * 63}", 42, 0
    )
    assert not gwx.receipt_is_trusted("garbage", 42, 0)


def test_shell_is_chosen_by_node_path() -> None:
    assert gwx.shell_for("C:/node.exe") == gwx.SHELL_POWERSHELL
    assert gwx.shell_for(r"\\server\share\node.exe") == gwx.SHELL_POWERSHELL
    assert gwx.shell_for("/usr/bin/node") == gwx.SHELL_POSIX


def test_base64_never_enters_argv() -> None:
    assert gwx.BASE64_NEVER_IN_ARGV is True
    assert gwx.BASE64_IS_SENT_OVER_STDIN is True
    assert gwx.RECEIVER_ARG_COUNT == 5
    assert "base64" not in " ".join(gwx.RECEIVER_ARG_ORDER).lower()


def test_coverage_surface_is_reported() -> None:
    surface = gwx.coverage()
    assert surface["script_bytes"] == 10_017
    assert surface["export_formats"] == 2
    assert surface["frame_chars"] == 480_000
    assert surface["max_export_bytes"] == 64 * 1024 * 1024
    assert surface["receiver_arg_count"] == 5
    assert surface["bytes_never_decoded"] is True
    assert surface["receipt_three_way"] is True
    assert surface["bfs_visit_limit"] == 10_000


def test_contract_holds_against_itself() -> None:
    assert gwx.validate_contract() == []


# --- reverse mutations: each must make validate_contract report a problem ---


def test_mutation_pdf_prefix_breaks_the_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = tuple(
        gwx.ExportFormat(f.mime_type, "JVBERi1", f.extension) if f.extension == ".pdf" else f
        for f in gwx.EXPORT_FORMATS
    )
    monkeypatch.setattr(gwx, "EXPORT_FORMATS", bad)
    problems = gwx.validate_contract()
    assert any("PDF prefix drifted" in p or "PDF MIME" in p for p in problems)


def test_mutation_padding_rule_breaks_the_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        gwx,
        "decoded_byte_length",
        lambda s: None if not s else (len(s) // 4) * 3,
    )
    problems = gwx.validate_contract()
    assert any("padding" in p for p in problems) or any(
        "decode" in p for p in problems
    )


def test_mutation_url_gate_rule_breaks_the_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # The shape regex alone already rejects a newline (its trailing class is [/?#] or end-of-string),
    # so weakening only the control-character table is not observable. Break the gate itself.
    monkeypatch.setattr(gwx, "source_url_is_accepted", lambda value: True)
    problems = gwx.validate_contract()
    assert any("newline" in p or "google host" in p for p in problems)


def test_mutation_receipt_rules_break_the_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(gwx, "receipt_is_trusted", lambda *a, **k: True)
    problems = gwx.validate_contract()
    assert any("receipt" in p.lower() for p in problems)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
