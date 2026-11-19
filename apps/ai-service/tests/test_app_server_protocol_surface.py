# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R130 — locks the app-server protocol surface that the binary's own generator emitted.

The reverse mutations here are the interesting part. A protocol inventory is easy to make
self-consistent and useless; so each mutation breaks a fact that only holds because it was
measured: the additive-only delta, the empty ClientNotification, the thread family's dominance,
and the balanced notification counts across faces.
"""

from __future__ import annotations

import pytest

from app.core import app_server_protocol_surface as p


def test_validate_contract_is_clean() -> None:
    assert p.validate_contract() == []


def test_generator_commands_are_recorded() -> None:
    assert "generate-json-schema" in p.SCHEMA_COMMAND
    assert "--out <DIR>" in p.SCHEMA_COMMAND
    assert "--experimental" in p.SCHEMA_COMMAND
    assert "--prettier" in p.TS_COMMAND
    assert p.GENERATOR_IS_EXPERIMENTAL_LABELLED is True


def test_file_counts_come_from_the_two_runs() -> None:
    assert p.STABLE_FILE_COUNT == 329
    assert p.EXPERIMENTAL_FILE_COUNT == 479
    assert p.EXPERIMENTAL_FILE_COUNT > p.STABLE_FILE_COUNT


def test_bundle_sizes_are_pinned() -> None:
    assert p.STABLE_BUNDLE_BYTES == 775_089
    assert p.STABLE_V2_BUNDLE_BYTES == 669_264
    assert p.EXPERIMENTAL_BUNDLE_BYTES == 957_557
    assert p.EXPERIMENTAL_V2_BUNDLE_BYTES == 839_394


def test_union_envelopes_are_four() -> None:
    assert p.UNION_FILES == (
        "ClientRequest.json",
        "ClientNotification.json",
        "ServerNotification.json",
        "ServerRequest.json",
    )


def test_method_counts_per_envelope() -> None:
    assert p.METHOD_COUNTS_STABLE == {
        "ClientRequest.json": 107,
        "ClientNotification.json": 0,
        "ServerNotification.json": 81,
        "ServerRequest.json": 9,
    }
    assert p.METHOD_COUNTS_EXPERIMENTAL == {
        "ClientRequest.json": 182,
        "ClientNotification.json": 0,
        "ServerNotification.json": 81,
        "ServerRequest.json": 11,
    }
    assert p.STABLE_METHOD_TOTAL == 197
    assert p.EXPERIMENTAL_METHOD_TOTAL == 274


def test_client_notification_enumerates_nothing() -> None:
    assert p.CLIENT_NOTIFICATION_ENUMERATES_NO_METHOD is True
    assert p.METHOD_COUNTS_STABLE["ClientNotification.json"] == 0
    assert p.METHOD_COUNTS_EXPERIMENTAL["ClientNotification.json"] == 0


def test_notifications_do_not_differ_between_faces() -> None:
    assert (
        p.METHOD_COUNTS_STABLE["ServerNotification.json"]
        == p.METHOD_COUNTS_EXPERIMENTAL["ServerNotification.json"]
    )


def test_family_table_sums_to_the_total() -> None:
    assert len(p.STABLE_FAMILY_COUNTS) == 34
    assert p.stable_family_total() == p.STABLE_METHOD_TOTAL


def test_thread_is_the_largest_family() -> None:
    assert p.family_count("thread") == 59
    assert p.STABLE_FAMILY_COUNTS["thread"] == max(p.STABLE_FAMILY_COUNTS.values())
    assert p.family_count("item") == 19
    assert p.family_of("thread/read") == "thread"


def test_unknown_family_is_zero() -> None:
    assert p.family_count("nonexistent") == 0
    assert p.family_of("threadGoalGetParams") == "threadGoalGetParams"


def test_experimental_delta_is_exactly_77_and_unique() -> None:
    assert len(p.EXPERIMENTAL_ONLY_METHODS) == 77
    assert len(set(p.EXPERIMENTAL_ONLY_METHODS)) == 77
    assert p.EXPERIMENTAL_ONLY_COUNT == 77


def test_delta_arithmetic_is_additive_only() -> None:
    assert p.STABLE_ONLY_COUNT == 0
    assert p.EXPERIMENTAL_METHOD_TOTAL - p.STABLE_METHOD_TOTAL == p.EXPERIMENTAL_ONLY_COUNT
    assert p.delta_is_additive_only() is True
    assert p.FLAG_ONLY_ADDS_NEVER_REMOVES is True


def test_delta_membership() -> None:
    assert p.is_experimental_only("mock/experimentalMethod") is True
    assert p.is_experimental_only("thread/queue/add") is True
    assert p.is_experimental_only("userVerification/enroll") is True
    assert p.is_experimental_only("thread/read") is False
    assert p.is_experimental_only("turn/start") is False


def test_delta_names_are_path_shaped() -> None:
    for method in p.EXPERIMENTAL_ONLY_METHODS:
        assert "/" in method
        assert method[0].isalpha()
        assert " " not in method


def test_transports_and_websocket_flags() -> None:
    assert p.TRANSPORTS == ("stdio://", "unix://", "unix://PATH", "ws://IP:PORT", "off")
    assert p.DEFAULT_TRANSPORT == "stdio://"
    assert len(p.WS_AUTH_MODES) == 2
    assert "capability-token" in p.WS_AUTH_MODES
    assert "signed-bearer-token" in p.WS_AUTH_MODES
    assert len(p.WS_FLAGS) == 6
    for flag in p.WS_FLAGS:
        assert flag.startswith("--ws-")


def test_app_server_subcommands() -> None:
    assert p.APP_SERVER_SUBCOMMANDS == ("daemon", "proxy", "generate-ts", "generate-json-schema")
    assert p.ANALYTICS_OFF_BY_DEFAULT is True


def test_coverage_shape() -> None:
    cov = p.coverage()
    assert cov["stable_files"] == 329
    assert cov["experimental_files"] == 479
    assert cov["stable_methods"] == 197
    assert cov["experimental_methods"] == 274
    assert cov["experimental_only"] == 77
    assert cov["families"] == 34


# --- reverse mutations ----------------------------------------------------------------


def test_mutation_flag_removes_a_method_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(p, "STABLE_ONLY_COUNT", 1)
    problems = p.validate_contract()
    assert problems, "a flag that removes a method must be reported"
    assert any("must never remove" in x for x in problems)


def test_mutation_client_notification_gets_a_method_is_caught(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        p,
        "METHOD_COUNTS_STABLE",
        {**p.METHOD_COUNTS_STABLE, "ClientNotification.json": 1},
    )
    problems = p.validate_contract()
    assert problems, "ClientNotification must never be given an enumerated method"


def test_mutation_family_table_loses_mass_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(p, "STABLE_FAMILY_COUNTS", {**p.STABLE_FAMILY_COUNTS, "thread": 50})
    problems = p.validate_contract()
    assert problems, "a family table that no longer sums to the total must be reported"
    assert any("sum" in x for x in problems)


def test_mutation_notifications_diverge_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        p,
        "METHOD_COUNTS_EXPERIMENTAL",
        {**p.METHOD_COUNTS_EXPERIMENTAL, "ServerNotification.json": 80},
    )
    problems = p.validate_contract()
    assert problems, "notification counts must not diverge between faces"


def test_mutation_delta_gets_a_duplicate_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    dup = p.EXPERIMENTAL_ONLY_METHODS + ("thread/read",)
    monkeypatch.setattr(p, "EXPERIMENTAL_ONLY_METHODS", dup)
    problems = p.validate_contract()
    assert problems, "a duplicated or stable method in the delta must be reported"


def test_mutation_transport_default_moves_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(p, "DEFAULT_TRANSPORT", "ws://IP:PORT")
    problems = p.validate_contract()
    assert any("stdio" in x for x in problems)


def test_mutation_face_sizes_invert_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(p, "STABLE_FILE_COUNT", 500)
    problems = p.validate_contract()
    assert any("more files" in x for x in problems)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
