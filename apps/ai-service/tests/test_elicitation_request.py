# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R60 pytest: elicitation_request protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.elicitation_request import (
    ELICITATION_REQUEST_DOMAIN,
    ELICITATION_REQUEST_ELEMENTS,
    ElicitationRequest,
    ElicitationRequestError,
    elicitation_request_domain,
    elicitation_request_domain_members,
    elicitation_request_names,
    ensure_elicitation_request,
    expected_elicitation_element_count,
    is_elicitation_request,
    validate_elicitation_request,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert ELICITATION_REQUEST_ELEMENTS == {"Form": 3, "OpenAiElicitationForm": 3, "OpenAiForm": 3, "Url": 4, "UserVerification": 4}

    def test_closed_set_cardinality(self) -> None:
        assert len(ElicitationRequest) == len(ELICITATION_REQUEST_ELEMENTS) == 5

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ElicitationRequest} == set(ELICITATION_REQUEST_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in ELICITATION_REQUEST_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(ELICITATION_REQUEST_DOMAIN) == set(ELICITATION_REQUEST_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Url', 'external'), ('Form', 'form')])
    def test_domain(self, name, expected) -> None:
        assert elicitation_request_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ElicitationRequestError):
            elicitation_request_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(ELICITATION_REQUEST_DOMAIN.values()):
            seen.extend(elicitation_request_domain_members(domain))
        assert sorted(seen) == sorted(ELICITATION_REQUEST_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ElicitationRequestError):
            elicitation_request_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_elicitation_request(nm) for nm in ELICITATION_REQUEST_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Form"
        assert first in ELICITATION_REQUEST_ELEMENTS
        assert not is_elicitation_request(first.lower())
        assert not is_elicitation_request("bogus")

    def test_names_returns_copy(self) -> None:
        a = elicitation_request_names()
        a.append("bogus")
        assert "bogus" not in ELICITATION_REQUEST_ELEMENTS
        assert set(elicitation_request_names()) == set(ELICITATION_REQUEST_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(ELICITATION_REQUEST_DOMAIN.values())))
        assert isinstance(elicitation_request_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", ELICITATION_REQUEST_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_elicitation_request(name, count) == name

    @pytest.mark.parametrize("name,count", ELICITATION_REQUEST_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ElicitationRequestError, match="元素数应为"):
            validate_elicitation_request(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ElicitationRequestError):
            ensure_elicitation_request("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ElicitationRequestError):
            expected_elicitation_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Form", "OpenAiElicitationForm"):
            assert nm in ELICITATION_REQUEST_ELEMENTS
            assert nm.lower() not in ELICITATION_REQUEST_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(ELICITATION_REQUEST_ELEMENTS.values()) == {3, 4}
