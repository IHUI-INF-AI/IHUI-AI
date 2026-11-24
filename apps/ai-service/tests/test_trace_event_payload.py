# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R59 pytest: trace_event_payload protocol-surface closed set.

Covers: verbatim element-count table, semantic domain classification, executable
reverse lookup, consistency gate, plus reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.trace_event_payload import (
    TRACE_EVENT_DOMAIN,
    TRACE_EVENT_ELEMENTS,
    TraceEventPayload,
    TraceEventPayloadError,
    ensure_trace_event_payload,
    expected_trace_element_count,
    is_trace_event,
    trace_event_domain,
    trace_event_domain_members,
    trace_event_names,
    validate_trace_event,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert TRACE_EVENT_ELEMENTS == {"AgentResultObserved": 6, "CodeCellEnded": 3, "CodeCellInitialResponse": 3, "CodeCellStarted": 3, "CodexTurnEnded": 2, "CodexTurnStarted": 2, "CompactionInstalled": 2, "CompactionRequestCompleted": 3, "CompactionRequestFailed": 3, "CompactionRequestStarted": 7, "HistoryItemAccepted": 2, "InferenceCancelled": 4, "InferenceCompleted": 4, "InferenceFailed": 4, "InferenceStarted": 6, "McpToolCallCorrelationAssigned": 2, "Other": 4, "ProtocolEventObserved": 2, "RolloutEnded": 1, "RolloutStarted": 2, "StdinTargetResolved": 2, "ThreadEnded": 2, "ThreadResumed": 1, "ThreadStarted": 3, "ToolCallEnded": 3, "ToolCallRuntimeEnded": 3, "ToolCallRuntimeStarted": 3, "ToolCallStarted": 7}

    def test_closed_set_cardinality(self) -> None:
        assert len(TraceEventPayload) == len(TRACE_EVENT_ELEMENTS) == 28

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in TraceEventPayload} == set(TRACE_EVENT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in TRACE_EVENT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(TRACE_EVENT_DOMAIN) == set(TRACE_EVENT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('CodeCellEnded', 'code_cell'), ('CompactionInstalled', 'compaction'), ('AgentResultObserved', 'inference'), ('Other', 'other'), ('RolloutEnded', 'thread'), ('McpToolCallCorrelationAssigned', 'tool'), ('CodexTurnEnded', 'turn')])
    def test_domain(self, name, expected) -> None:
        assert trace_event_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(TraceEventPayloadError):
            trace_event_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(TRACE_EVENT_DOMAIN.values()):
            seen.extend(trace_event_domain_members(domain))
        assert sorted(seen) == sorted(TRACE_EVENT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(TraceEventPayloadError):
            trace_event_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_trace_event(nm) for nm in TRACE_EVENT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AgentResultObserved"
        assert first in TRACE_EVENT_ELEMENTS
        assert not is_trace_event(first.lower())
        assert not is_trace_event("bogus")

    def test_names_returns_copy(self) -> None:
        a = trace_event_names()
        a.append("bogus")
        assert "bogus" not in TRACE_EVENT_ELEMENTS
        assert set(trace_event_names()) == set(TRACE_EVENT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(TRACE_EVENT_DOMAIN.values())))
        a = trace_event_domain_members(domain)
        assert isinstance(a, tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", TRACE_EVENT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_trace_event(name, count) == name

    @pytest.mark.parametrize("name,count", TRACE_EVENT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(TraceEventPayloadError, match="元素数应为"):
            validate_trace_event(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(TraceEventPayloadError):
            ensure_trace_event_payload("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(TraceEventPayloadError):
            expected_trace_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AgentResultObserved", "CodeCellEnded"):
            assert nm in TRACE_EVENT_ELEMENTS
            assert nm.lower() not in TRACE_EVENT_ELEMENTS

    def test_element_counts_not_all_identical_sentinel(self) -> None:
        """差异化元素数族必须真的有 >1 种取值；恒 2 族由本断言钉住不能伪装差异化。"""
        counts = set(TRACE_EVENT_ELEMENTS.values())
        assert counts == {1, 2, 3, 4, 6, 7}
