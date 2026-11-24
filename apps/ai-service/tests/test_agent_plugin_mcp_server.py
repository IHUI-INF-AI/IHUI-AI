# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R60 pytest: agent_plugin_mcp_server protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.agent_plugin_mcp_server import (
    AGENT_PLUGIN_MCP_SERVER_DOMAIN,
    AGENT_PLUGIN_MCP_SERVER_ELEMENTS,
    AgentPluginMcpServer,
    AgentPluginMcpServerError,
    agent_plugin_mcp_server_domain,
    agent_plugin_mcp_server_domain_members,
    agent_plugin_mcp_server_names,
    ensure_agent_plugin_mcp_server,
    expected_mcp_server_element_count,
    is_agent_plugin_mcp_server,
    validate_agent_plugin_mcp_server,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert AGENT_PLUGIN_MCP_SERVER_ELEMENTS == {"Sse": 2, "Stdio": 4, "StreamableHttp": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(AgentPluginMcpServer) == len(AGENT_PLUGIN_MCP_SERVER_ELEMENTS) == 3

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in AgentPluginMcpServer} == set(AGENT_PLUGIN_MCP_SERVER_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in AGENT_PLUGIN_MCP_SERVER_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(AGENT_PLUGIN_MCP_SERVER_DOMAIN) == set(AGENT_PLUGIN_MCP_SERVER_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Sse', 'http_transport'), ('Stdio', 'process_transport')])
    def test_domain(self, name, expected) -> None:
        assert agent_plugin_mcp_server_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(AgentPluginMcpServerError):
            agent_plugin_mcp_server_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(AGENT_PLUGIN_MCP_SERVER_DOMAIN.values()):
            seen.extend(agent_plugin_mcp_server_domain_members(domain))
        assert sorted(seen) == sorted(AGENT_PLUGIN_MCP_SERVER_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(AgentPluginMcpServerError):
            agent_plugin_mcp_server_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_agent_plugin_mcp_server(nm) for nm in AGENT_PLUGIN_MCP_SERVER_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Sse"
        assert first in AGENT_PLUGIN_MCP_SERVER_ELEMENTS
        assert not is_agent_plugin_mcp_server(first.lower())
        assert not is_agent_plugin_mcp_server("bogus")

    def test_names_returns_copy(self) -> None:
        a = agent_plugin_mcp_server_names()
        a.append("bogus")
        assert "bogus" not in AGENT_PLUGIN_MCP_SERVER_ELEMENTS
        assert set(agent_plugin_mcp_server_names()) == set(AGENT_PLUGIN_MCP_SERVER_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(AGENT_PLUGIN_MCP_SERVER_DOMAIN.values())))
        assert isinstance(agent_plugin_mcp_server_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", AGENT_PLUGIN_MCP_SERVER_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_agent_plugin_mcp_server(name, count) == name

    @pytest.mark.parametrize("name,count", AGENT_PLUGIN_MCP_SERVER_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(AgentPluginMcpServerError, match="元素数应为"):
            validate_agent_plugin_mcp_server(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(AgentPluginMcpServerError):
            ensure_agent_plugin_mcp_server("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(AgentPluginMcpServerError):
            expected_mcp_server_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Sse", "Stdio"):
            assert nm in AGENT_PLUGIN_MCP_SERVER_ELEMENTS
            assert nm.lower() not in AGENT_PLUGIN_MCP_SERVER_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(AGENT_PLUGIN_MCP_SERVER_ELEMENTS.values()) == {2, 4}
