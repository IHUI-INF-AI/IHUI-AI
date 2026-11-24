# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R59 pytest: server_request_method protocol-surface closed set.

Covers: verbatim element-count table, semantic domain classification, executable
reverse lookup, consistency gate, plus reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.server_request_method import (
    SERVER_REQUEST_DOMAIN,
    SERVER_REQUEST_ELEMENTS,
    ServerRequestMethod,
    ServerRequestMethodError,
    ensure_server_request_method,
    expected_server_element_count,
    is_server_request,
    server_request_domain,
    server_request_domain_members,
    server_request_names,
    validate_server_request,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert SERVER_REQUEST_ELEMENTS == {"ApplyPatchApproval": 2, "AttestationGenerate": 2, "ChatgptAuthTokensRefresh": 2, "CommandExecutionRequestApproval": 2, "CurrentTimeRead": 2, "DynamicToolCall": 2, "ExecCommandApproval": 2, "FileChangeRequestApproval": 2, "McpServerElicitationRequest": 2, "PermissionsRequestApproval": 2, "ToolRequestUserInput": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(ServerRequestMethod) == len(SERVER_REQUEST_ELEMENTS) == 11

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ServerRequestMethod} == set(SERVER_REQUEST_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in SERVER_REQUEST_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(SERVER_REQUEST_DOMAIN) == set(SERVER_REQUEST_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('ApplyPatchApproval', 'approval'), ('AttestationGenerate', 'auth'), ('McpServerElicitationRequest', 'elicitation'), ('CurrentTimeRead', 'query'), ('DynamicToolCall', 'tool')])
    def test_domain(self, name, expected) -> None:
        assert server_request_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ServerRequestMethodError):
            server_request_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(SERVER_REQUEST_DOMAIN.values()):
            seen.extend(server_request_domain_members(domain))
        assert sorted(seen) == sorted(SERVER_REQUEST_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ServerRequestMethodError):
            server_request_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_server_request(nm) for nm in SERVER_REQUEST_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "ApplyPatchApproval"
        assert first in SERVER_REQUEST_ELEMENTS
        assert not is_server_request(first.lower())
        assert not is_server_request("bogus")

    def test_names_returns_copy(self) -> None:
        a = server_request_names()
        a.append("bogus")
        assert "bogus" not in SERVER_REQUEST_ELEMENTS
        assert set(server_request_names()) == set(SERVER_REQUEST_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(SERVER_REQUEST_DOMAIN.values())))
        a = server_request_domain_members(domain)
        assert isinstance(a, tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", SERVER_REQUEST_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_server_request(name, count) == name

    @pytest.mark.parametrize("name,count", SERVER_REQUEST_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ServerRequestMethodError, match="元素数应为"):
            validate_server_request(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ServerRequestMethodError):
            ensure_server_request_method("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ServerRequestMethodError):
            expected_server_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("ApplyPatchApproval", "AttestationGenerate"):
            assert nm in SERVER_REQUEST_ELEMENTS
            assert nm.lower() not in SERVER_REQUEST_ELEMENTS

    def test_element_counts_not_all_identical_sentinel(self) -> None:
        """差异化元素数族必须真的有 >1 种取值；恒 2 族由本断言钉住不能伪装差异化。"""
        counts = set(SERVER_REQUEST_ELEMENTS.values())
        assert counts == {2}
