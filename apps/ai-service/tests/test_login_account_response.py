# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: login_account_response protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.login_account_response import (
    LOGIN_ACCOUNT_RESPONSE_DOMAIN,
    LOGIN_ACCOUNT_RESPONSE_ELEMENTS,
    LoginAccountResponse,
    LoginAccountResponseError,
    ensure_login_account_response,
    expected_login_account_response_element_count,
    is_login_account_response,
    login_account_response_domain,
    login_account_response_domain_members,
    login_account_response_names,
    validate_login_account_response,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert LOGIN_ACCOUNT_RESPONSE_ELEMENTS == {"Chatgpt": 2, "ChatgptDeviceCode": 3}

    def test_closed_set_cardinality(self) -> None:
        assert len(LoginAccountResponse) == len(LOGIN_ACCOUNT_RESPONSE_ELEMENTS) == 2

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in LoginAccountResponse} == set(LOGIN_ACCOUNT_RESPONSE_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in LOGIN_ACCOUNT_RESPONSE_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(LOGIN_ACCOUNT_RESPONSE_DOMAIN) == set(LOGIN_ACCOUNT_RESPONSE_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('ChatgptDeviceCode', 'device'), ('Chatgpt', 'interactive')])
    def test_domain(self, name, expected) -> None:
        assert login_account_response_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(LoginAccountResponseError):
            login_account_response_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(LOGIN_ACCOUNT_RESPONSE_DOMAIN.values()):
            seen.extend(login_account_response_domain_members(domain))
        assert sorted(seen) == sorted(LOGIN_ACCOUNT_RESPONSE_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(LoginAccountResponseError):
            login_account_response_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_login_account_response(nm) for nm in LOGIN_ACCOUNT_RESPONSE_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Chatgpt"
        assert first in LOGIN_ACCOUNT_RESPONSE_ELEMENTS
        assert not is_login_account_response(first.lower())
        assert not is_login_account_response("bogus")

    def test_names_returns_copy(self) -> None:
        a = login_account_response_names()
        a.append("bogus")
        assert "bogus" not in LOGIN_ACCOUNT_RESPONSE_ELEMENTS
        assert set(login_account_response_names()) == set(LOGIN_ACCOUNT_RESPONSE_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(LOGIN_ACCOUNT_RESPONSE_DOMAIN.values())))
        assert isinstance(login_account_response_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", LOGIN_ACCOUNT_RESPONSE_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_login_account_response(name, count) == name

    @pytest.mark.parametrize("name,count", LOGIN_ACCOUNT_RESPONSE_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(LoginAccountResponseError, match="元素数应为"):
            validate_login_account_response(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(LoginAccountResponseError):
            ensure_login_account_response("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(LoginAccountResponseError):
            expected_login_account_response_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Chatgpt", "ChatgptDeviceCode"):
            assert nm in LOGIN_ACCOUNT_RESPONSE_ELEMENTS
            assert nm.lower() not in LOGIN_ACCOUNT_RESPONSE_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(LOGIN_ACCOUNT_RESPONSE_ELEMENTS.values()) == {2, 3}
