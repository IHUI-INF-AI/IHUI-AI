# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R62 pytest: agent_struct_contract struct arity contract.

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.agent_struct_contract import (
    AGENT_STRUCT_CONTRACT_DOMAIN,
    AGENT_STRUCT_CONTRACT_ELEMENTS,
    AgentStructContract,
    AgentStructContractError,
    agent_struct_contract_domain,
    agent_struct_contract_domain_members,
    agent_struct_contract_names,
    ensure_agent_struct_contract,
    expected_agent_struct_contract_element_count,
    is_agent_struct_contract,
    validate_agent_struct_contract,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert AGENT_STRUCT_CONTRACT_ELEMENTS == {"AdditionalContextEntry": 3, "BedrockAwsProfile": 2, "ChannelSummary": 7, "CollabAgentRef": 3, "CollabAgentState": 2, "CollabAgentStatusEntry": 4, "CollaborationMode": 2, "CollaborationModeMask": 4, "ConnectorMetadata": 9, "Context": 7, "ContextId": 2, "CreateChannel": 3, "DetectedExternalAgentSessionConnectorRecord": 2, "ExternalAgentDetectedConnectorCandidate": 3, "ExternalPullRequestResponse": 4, "GetChannels": 4, "IdeContext": 2, "ImportedExternalAgentSessionLedger": 2, "ImportedExternalAgentSessionRecord": 7, "MultiAgentModeState": 2, "NoiseChannelPublicKey": 3, "ProcessSpawnParams": 10, "ProfileIdentity": 2, "ProfileInvocation": 4, "ProfileMetadata": 2, "SpawnRequest": 13, "SubAgentActivityItem": 6, "TuiAgentsKeymap": 12, "UpsertChannelRequest": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(AgentStructContract) == len(AGENT_STRUCT_CONTRACT_ELEMENTS) == 29

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in AgentStructContract} == set(AGENT_STRUCT_CONTRACT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in AGENT_STRUCT_CONTRACT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(AGENT_STRUCT_CONTRACT_DOMAIN) == set(AGENT_STRUCT_CONTRACT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('SubAgentActivityItem', 'content'), ('AdditionalContextEntry', 'descriptor'), ('CollabAgentRef', 'domain_object'), ('SpawnRequest', 'request'), ('ProcessSpawnParams', 'request_params'), ('ExternalPullRequestResponse', 'response')])
    def test_domain(self, name, expected) -> None:
        assert agent_struct_contract_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(AgentStructContractError):
            agent_struct_contract_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(AGENT_STRUCT_CONTRACT_DOMAIN.values()):
            seen.extend(agent_struct_contract_domain_members(domain))
        assert sorted(seen) == sorted(AGENT_STRUCT_CONTRACT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(AgentStructContractError):
            agent_struct_contract_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_agent_struct_contract(nm) for nm in AGENT_STRUCT_CONTRACT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AdditionalContextEntry"
        assert first in AGENT_STRUCT_CONTRACT_ELEMENTS
        assert not is_agent_struct_contract(first.lower())
        assert not is_agent_struct_contract("bogus")

    def test_names_returns_copy(self) -> None:
        a = agent_struct_contract_names()
        a.append("bogus")
        assert "bogus" not in AGENT_STRUCT_CONTRACT_ELEMENTS
        assert set(agent_struct_contract_names()) == set(AGENT_STRUCT_CONTRACT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(AGENT_STRUCT_CONTRACT_DOMAIN.values())))
        assert isinstance(agent_struct_contract_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", AGENT_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_agent_struct_contract(name, count) == name

    @pytest.mark.parametrize("name,count", AGENT_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(AgentStructContractError, match="元素数应为"):
            validate_agent_struct_contract(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(AgentStructContractError):
            ensure_agent_struct_contract("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(AgentStructContractError):
            expected_agent_struct_contract_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AdditionalContextEntry", "BedrockAwsProfile"):
            assert nm in AGENT_STRUCT_CONTRACT_ELEMENTS
            assert nm.lower() not in AGENT_STRUCT_CONTRACT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(AGENT_STRUCT_CONTRACT_ELEMENTS.values()) == {2, 3, 4, 6, 7, 9, 10, 12, 13}
