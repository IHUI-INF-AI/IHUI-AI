# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R59 pytest: rollout_item_wire protocol-surface closed set.

Covers: verbatim element-count table, semantic domain classification, executable
reverse lookup, consistency gate, plus reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.rollout_item_wire import (
    ROLLOUT_ITEM_DOMAIN,
    ROLLOUT_ITEM_ELEMENTS,
    RolloutItemWire,
    RolloutItemWireError,
    ensure_rollout_item_wire,
    expected_rollout_item_element_count,
    is_rollout_item,
    rollout_item_domain,
    rollout_item_domain_members,
    rollout_item_names,
    validate_rollout_item,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert ROLLOUT_ITEM_ELEMENTS == {"Compacted": 1, "DynamicToolsUpdated": 1, "EventMsg": 1, "InterAgentCommunication": 1, "InterAgentCommunicationMetadata": 1, "RealtimeItem": 1, "ResponseItem": 2, "RetainedContext": 1, "SecurityRiskScore": 1, "SessionMeta": 1, "TokenUsageRecord": 1, "TurnContext": 1, "WorldState": 1}

    def test_closed_set_cardinality(self) -> None:
        assert len(RolloutItemWire) == len(ROLLOUT_ITEM_ELEMENTS) == 13

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in RolloutItemWire} == set(ROLLOUT_ITEM_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in ROLLOUT_ITEM_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(ROLLOUT_ITEM_DOMAIN) == set(ROLLOUT_ITEM_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Compacted', 'context'), ('EventMsg', 'event'), ('InterAgentCommunication', 'inter_agent'), ('ResponseItem', 'item'), ('SessionMeta', 'meta'), ('RealtimeItem', 'realtime'), ('SecurityRiskScore', 'security'), ('TokenUsageRecord', 'usage')])
    def test_domain(self, name, expected) -> None:
        assert rollout_item_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(RolloutItemWireError):
            rollout_item_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(ROLLOUT_ITEM_DOMAIN.values()):
            seen.extend(rollout_item_domain_members(domain))
        assert sorted(seen) == sorted(ROLLOUT_ITEM_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(RolloutItemWireError):
            rollout_item_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_rollout_item(nm) for nm in ROLLOUT_ITEM_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Compacted"
        assert first in ROLLOUT_ITEM_ELEMENTS
        assert not is_rollout_item(first.lower())
        assert not is_rollout_item("bogus")

    def test_names_returns_copy(self) -> None:
        a = rollout_item_names()
        a.append("bogus")
        assert "bogus" not in ROLLOUT_ITEM_ELEMENTS
        assert set(rollout_item_names()) == set(ROLLOUT_ITEM_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(ROLLOUT_ITEM_DOMAIN.values())))
        a = rollout_item_domain_members(domain)
        assert isinstance(a, tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", ROLLOUT_ITEM_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_rollout_item(name, count) == name

    @pytest.mark.parametrize("name,count", ROLLOUT_ITEM_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(RolloutItemWireError, match="元素数应为"):
            validate_rollout_item(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(RolloutItemWireError):
            ensure_rollout_item_wire("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(RolloutItemWireError):
            expected_rollout_item_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Compacted", "DynamicToolsUpdated"):
            assert nm in ROLLOUT_ITEM_ELEMENTS
            assert nm.lower() not in ROLLOUT_ITEM_ELEMENTS

    def test_element_counts_not_all_identical_sentinel(self) -> None:
        """差异化元素数族必须真的有 >1 种取值；恒 2 族由本断言钉住不能伪装差异化。"""
        counts = set(ROLLOUT_ITEM_ELEMENTS.values())
        assert counts == {1, 2}
