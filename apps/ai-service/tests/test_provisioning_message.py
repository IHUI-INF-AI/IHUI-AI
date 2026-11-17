# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: provisioning_message protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.provisioning_message import (
    PROVISIONING_MESSAGE_DOMAIN,
    PROVISIONING_MESSAGE_ELEMENTS,
    ProvisioningMessage,
    ProvisioningMessageError,
    ensure_provisioning_message,
    expected_provisioning_message_element_count,
    is_provisioning_message,
    provisioning_message_domain,
    provisioning_message_domain_members,
    provisioning_message_names,
    validate_provisioning_message,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert PROVISIONING_MESSAGE_ELEMENTS == {"ProvisionSandboxRequest": 1, "ProvisionSandboxResponse": 1, "RegisterInstallationRequest": 1}

    def test_closed_set_cardinality(self) -> None:
        assert len(ProvisioningMessage) == len(PROVISIONING_MESSAGE_ELEMENTS) == 3

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ProvisioningMessage} == set(PROVISIONING_MESSAGE_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in PROVISIONING_MESSAGE_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(PROVISIONING_MESSAGE_DOMAIN) == set(PROVISIONING_MESSAGE_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('RegisterInstallationRequest', 'installation'), ('ProvisionSandboxRequest', 'sandbox')])
    def test_domain(self, name, expected) -> None:
        assert provisioning_message_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ProvisioningMessageError):
            provisioning_message_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(PROVISIONING_MESSAGE_DOMAIN.values()):
            seen.extend(provisioning_message_domain_members(domain))
        assert sorted(seen) == sorted(PROVISIONING_MESSAGE_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ProvisioningMessageError):
            provisioning_message_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_provisioning_message(nm) for nm in PROVISIONING_MESSAGE_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "ProvisionSandboxRequest"
        assert first in PROVISIONING_MESSAGE_ELEMENTS
        assert not is_provisioning_message(first.lower())
        assert not is_provisioning_message("bogus")

    def test_names_returns_copy(self) -> None:
        a = provisioning_message_names()
        a.append("bogus")
        assert "bogus" not in PROVISIONING_MESSAGE_ELEMENTS
        assert set(provisioning_message_names()) == set(PROVISIONING_MESSAGE_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(PROVISIONING_MESSAGE_DOMAIN.values())))
        assert isinstance(provisioning_message_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", PROVISIONING_MESSAGE_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_provisioning_message(name, count) == name

    @pytest.mark.parametrize("name,count", PROVISIONING_MESSAGE_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ProvisioningMessageError, match="元素数应为"):
            validate_provisioning_message(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ProvisioningMessageError):
            ensure_provisioning_message("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ProvisioningMessageError):
            expected_provisioning_message_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("ProvisionSandboxRequest", "ProvisionSandboxResponse"):
            assert nm in PROVISIONING_MESSAGE_ELEMENTS
            assert nm.lower() not in PROVISIONING_MESSAGE_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(PROVISIONING_MESSAGE_ELEMENTS.values()) == {1}
