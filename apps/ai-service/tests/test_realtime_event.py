# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R60 pytest: realtime_event protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.realtime_event import (
    REALTIME_EVENT_DOMAIN,
    REALTIME_EVENT_ELEMENTS,
    RealtimeEvent,
    RealtimeEventError,
    ensure_realtime_event,
    expected_realtime_event_element_count,
    is_realtime_event,
    realtime_event_domain,
    realtime_event_domain_members,
    realtime_event_names,
    validate_realtime_event,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert REALTIME_EVENT_ELEMENTS == {"ConversationItemDone": 1, "HistoryTranscriptDelta": 2, "SessionUpdated": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(RealtimeEvent) == len(REALTIME_EVENT_ELEMENTS) == 3

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in RealtimeEvent} == set(REALTIME_EVENT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in REALTIME_EVENT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(REALTIME_EVENT_DOMAIN) == set(REALTIME_EVENT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('ConversationItemDone', 'lifecycle'), ('HistoryTranscriptDelta', 'streaming')])
    def test_domain(self, name, expected) -> None:
        assert realtime_event_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(RealtimeEventError):
            realtime_event_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(REALTIME_EVENT_DOMAIN.values()):
            seen.extend(realtime_event_domain_members(domain))
        assert sorted(seen) == sorted(REALTIME_EVENT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(RealtimeEventError):
            realtime_event_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_realtime_event(nm) for nm in REALTIME_EVENT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "ConversationItemDone"
        assert first in REALTIME_EVENT_ELEMENTS
        assert not is_realtime_event(first.lower())
        assert not is_realtime_event("bogus")

    def test_names_returns_copy(self) -> None:
        a = realtime_event_names()
        a.append("bogus")
        assert "bogus" not in REALTIME_EVENT_ELEMENTS
        assert set(realtime_event_names()) == set(REALTIME_EVENT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(REALTIME_EVENT_DOMAIN.values())))
        assert isinstance(realtime_event_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", REALTIME_EVENT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_realtime_event(name, count) == name

    @pytest.mark.parametrize("name,count", REALTIME_EVENT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(RealtimeEventError, match="元素数应为"):
            validate_realtime_event(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(RealtimeEventError):
            ensure_realtime_event("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(RealtimeEventError):
            expected_realtime_event_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("ConversationItemDone", "HistoryTranscriptDelta"):
            assert nm in REALTIME_EVENT_ELEMENTS
            assert nm.lower() not in REALTIME_EVENT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(REALTIME_EVENT_ELEMENTS.values()) == {1, 2}
