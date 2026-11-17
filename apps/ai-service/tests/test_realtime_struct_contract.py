# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R62 pytest: realtime_struct_contract struct arity contract.

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.realtime_struct_contract import (
    REALTIME_STRUCT_CONTRACT_DOMAIN,
    REALTIME_STRUCT_CONTRACT_ELEMENTS,
    RealtimeStructContract,
    RealtimeStructContractError,
    ensure_realtime_struct_contract,
    expected_realtime_struct_contract_element_count,
    is_realtime_struct_contract,
    realtime_struct_contract_domain,
    realtime_struct_contract_domain_members,
    realtime_struct_contract_names,
    validate_realtime_struct_contract,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert REALTIME_STRUCT_CONTRACT_ELEMENTS == {"AudioContent": 4, "AudioControls": 2, "AudioDevice": 3, "AudioDeviceSelection": 3, "AudioState": 2, "ImageContent": 4, "ImageGenerationItem": 5, "ImageViewItem": 2, "RealtimeAudioFrame": 5, "RealtimeVoicesList": 5}

    def test_closed_set_cardinality(self) -> None:
        assert len(RealtimeStructContract) == len(REALTIME_STRUCT_CONTRACT_ELEMENTS) == 10

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in RealtimeStructContract} == set(REALTIME_STRUCT_CONTRACT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in REALTIME_STRUCT_CONTRACT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(REALTIME_STRUCT_CONTRACT_DOMAIN) == set(REALTIME_STRUCT_CONTRACT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('AudioContent', 'content'), ('AudioState', 'descriptor'), ('AudioControls', 'domain_object')])
    def test_domain(self, name, expected) -> None:
        assert realtime_struct_contract_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(RealtimeStructContractError):
            realtime_struct_contract_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(REALTIME_STRUCT_CONTRACT_DOMAIN.values()):
            seen.extend(realtime_struct_contract_domain_members(domain))
        assert sorted(seen) == sorted(REALTIME_STRUCT_CONTRACT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(RealtimeStructContractError):
            realtime_struct_contract_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_realtime_struct_contract(nm) for nm in REALTIME_STRUCT_CONTRACT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AudioContent"
        assert first in REALTIME_STRUCT_CONTRACT_ELEMENTS
        assert not is_realtime_struct_contract(first.lower())
        assert not is_realtime_struct_contract("bogus")

    def test_names_returns_copy(self) -> None:
        a = realtime_struct_contract_names()
        a.append("bogus")
        assert "bogus" not in REALTIME_STRUCT_CONTRACT_ELEMENTS
        assert set(realtime_struct_contract_names()) == set(REALTIME_STRUCT_CONTRACT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(REALTIME_STRUCT_CONTRACT_DOMAIN.values())))
        assert isinstance(realtime_struct_contract_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", REALTIME_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_realtime_struct_contract(name, count) == name

    @pytest.mark.parametrize("name,count", REALTIME_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(RealtimeStructContractError, match="元素数应为"):
            validate_realtime_struct_contract(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(RealtimeStructContractError):
            ensure_realtime_struct_contract("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(RealtimeStructContractError):
            expected_realtime_struct_contract_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AudioContent", "AudioControls"):
            assert nm in REALTIME_STRUCT_CONTRACT_ELEMENTS
            assert nm.lower() not in REALTIME_STRUCT_CONTRACT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(REALTIME_STRUCT_CONTRACT_ELEMENTS.values()) == {2, 3, 4, 5}
