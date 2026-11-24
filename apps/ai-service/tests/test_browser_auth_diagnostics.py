# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_auth_handoff submission_diagnostics 单测 — 钉住事件枚举/phase/mode/schema。"""

from __future__ import annotations

import pytest

from app.services.browser_auth_handoff import (
    ATTEMPT_EVENTS,
    DIAGNOSTICS_SCHEMA_VERSION,
    SUBMISSION_MODES,
    SUBMISSION_PHASES,
    AttemptEvent,
    RejectionRecord,
    SubmissionMode,
    SubmissionPhase,
    build_submission_diagnostics,
)


def test_attempt_events_full_enumeration() -> None:
    """Codex §6 attempt_events 全枚举(14 项)。"""
    expected = {
        "prompt_completed",
        "field_fill_started",
        "field_fill_completed",
        "field_fill_uncertain",
        "url_changed",
        "document_changed",
        "frame_changed",
        "reinspection_started",
        "reinspection_completed",
        "site_request",
        "site_navigation",
        "site_submission_verified",
        "submit_started",
        "attempt_completed",
    }
    assert set(ATTEMPT_EVENTS) == expected
    assert len(ATTEMPT_EVENTS) == 14


def test_reinspection_events_present() -> None:
    """reinspection_* 两个事件都在枚举里。"""
    assert "reinspection_started" in ATTEMPT_EVENTS
    assert "reinspection_completed" in ATTEMPT_EVENTS


def test_submission_phases() -> None:
    """Codex submission_phase 值域。"""
    assert set(SUBMISSION_PHASES) == {"prepare", "fill", "submit", "verify"}


def test_submission_modes() -> None:
    assert set(SUBMISSION_MODES) == {"ordinary", "private"}


def test_schema_version_is_1() -> None:
    assert DIAGNOSTICS_SCHEMA_VERSION == 1


def test_build_filters_invalid_events() -> None:
    """非法事件被过滤,合法事件保留原序。"""
    d = build_submission_diagnostics(
        attempt_events=[
            "prompt_completed",
            "bogus_event",
            "field_fill_started",
            "submit_started",
            "attempt_completed",
        ]
    )
    assert d.attempt_events == (
        "prompt_completed",
        "field_fill_started",
        "submit_started",
        "attempt_completed",
    )


def test_build_normalizes_invalid_mode() -> None:
    d = build_submission_diagnostics(
        attempt_events=["attempt_completed"], submission_mode="paranoid"
    )
    assert d.submission_mode == "ordinary"  # 回落到默认


def test_build_private_mode_preserved() -> None:
    d = build_submission_diagnostics(
        attempt_events=[], submission_mode="private"
    )
    assert d.submission_mode == "private"


def test_rejection_record_shape() -> None:
    r = RejectionRecord(
        outcome="submission_failed",
        reason="iframe_origin",
        request_class="private",
        submission_phase="submit",
    )
    d = r.to_dict()
    assert d == {
        "outcome": "submission_failed",
        "reason": "iframe_origin",
        "request_class": "private",
        "submission_phase": "submit",
    }


def test_diagnostics_with_rejections() -> None:
    first = RejectionRecord(
        outcome="locator_invalid",
        reason="request_scheme",
        request_class="ordinary",
        submission_phase="prepare",
    )
    terminal = RejectionRecord(
        outcome="submission_failed",
        reason="child_frame_origin",
        request_class="private",
        submission_phase="verify",
    )
    d = build_submission_diagnostics(
        attempt_events=["prompt_completed", "attempt_completed"],
        submission_mode="private",
        first_rejection=first,
        terminal_rejection=terminal,
    )
    assert d.first_rejection is not None
    assert d.first_rejection.reason == "request_scheme"
    assert d.terminal_rejection is not None
    assert d.terminal_rejection.submission_phase == "verify"
    assert d.submission_mode == "private"


def test_diagnostics_to_dict_shape() -> None:
    d = build_submission_diagnostics(attempt_events=["attempt_completed"])
    dd = d.to_dict()
    assert set(dd.keys()) == {
        "attempt_events",
        "submission_mode",
        "schema_version",
        "first_rejection",
        "terminal_rejection",
    }
    assert dd["schema_version"] == 1
    assert dd["first_rejection"] is None
    assert dd["terminal_rejection"] is None


def test_diagnostics_never_contains_credential_field() -> None:
    """SubmissionDiagnostics 结构永不含凭据值字段。"""
    d = build_submission_diagnostics(
        attempt_events=["attempt_completed"],
        first_rejection=RejectionRecord(
            outcome="submission_failed",
            reason="request_origin",
            request_class="ordinary",
            submission_phase="submit",
        ),
    )
    dd = d.to_dict()
    flat = str(dd)
    for forbidden in ("credential", "password_value", "secret_value", "token_value"):
        assert forbidden not in flat
    # 结构里无 secret/password 字段
    for forbidden_key in ("secret", "password", "token", "credential"):
        assert forbidden_key not in dd


def test_empty_events_valid() -> None:
    d = build_submission_diagnostics(attempt_events=[])
    assert d.attempt_events == ()
    assert d.schema_version == 1


def test_attempt_event_enum_values_match_tuple() -> None:
    """StrEnum 值与 ATTEMPT_EVENTS 一致。"""
    assert tuple(e.value for e in AttemptEvent) == ATTEMPT_EVENTS


def test_submission_phase_enum_values_match() -> None:
    assert tuple(p.value for p in SubmissionPhase) == SUBMISSION_PHASES


def test_submission_mode_enum_values_match() -> None:
    assert tuple(m.value for m in SubmissionMode) == SUBMISSION_MODES


def test_build_returns_immutable_diagnostics() -> None:
    import dataclasses

    d = build_submission_diagnostics(attempt_events=["attempt_completed"])
    assert dataclasses.is_dataclass(d)
    with pytest.raises(dataclasses.FrozenInstanceError):
        d.schema_version = 999  # type: ignore[misc]


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
