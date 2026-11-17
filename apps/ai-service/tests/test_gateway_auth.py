# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: gateway_auth protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.gateway_auth import (
    GATEWAY_AUTH_DOMAIN,
    GATEWAY_AUTH_ELEMENTS,
    GatewayAuth,
    GatewayAuthError,
    ensure_gateway_auth,
    expected_gateway_auth_element_count,
    gateway_auth_domain,
    gateway_auth_domain_members,
    gateway_auth_names,
    is_gateway_auth,
    validate_gateway_auth,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert GATEWAY_AUTH_ELEMENTS == {"EnvironmentVariable": 1, "ExternallyConfigured": 1}

    def test_closed_set_cardinality(self) -> None:
        assert len(GatewayAuth) == len(GATEWAY_AUTH_ELEMENTS) == 2

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in GatewayAuth} == set(GATEWAY_AUTH_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in GATEWAY_AUTH_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(GATEWAY_AUTH_DOMAIN) == set(GATEWAY_AUTH_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('EnvironmentVariable', 'environment'), ('ExternallyConfigured', 'external')])
    def test_domain(self, name, expected) -> None:
        assert gateway_auth_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(GatewayAuthError):
            gateway_auth_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(GATEWAY_AUTH_DOMAIN.values()):
            seen.extend(gateway_auth_domain_members(domain))
        assert sorted(seen) == sorted(GATEWAY_AUTH_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(GatewayAuthError):
            gateway_auth_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_gateway_auth(nm) for nm in GATEWAY_AUTH_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "EnvironmentVariable"
        assert first in GATEWAY_AUTH_ELEMENTS
        assert not is_gateway_auth(first.lower())
        assert not is_gateway_auth("bogus")

    def test_names_returns_copy(self) -> None:
        a = gateway_auth_names()
        a.append("bogus")
        assert "bogus" not in GATEWAY_AUTH_ELEMENTS
        assert set(gateway_auth_names()) == set(GATEWAY_AUTH_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(GATEWAY_AUTH_DOMAIN.values())))
        assert isinstance(gateway_auth_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", GATEWAY_AUTH_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_gateway_auth(name, count) == name

    @pytest.mark.parametrize("name,count", GATEWAY_AUTH_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(GatewayAuthError, match="元素数应为"):
            validate_gateway_auth(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(GatewayAuthError):
            ensure_gateway_auth("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(GatewayAuthError):
            expected_gateway_auth_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("EnvironmentVariable", "ExternallyConfigured"):
            assert nm in GATEWAY_AUTH_ELEMENTS
            assert nm.lower() not in GATEWAY_AUTH_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(GATEWAY_AUTH_ELEMENTS.values()) == {1}
