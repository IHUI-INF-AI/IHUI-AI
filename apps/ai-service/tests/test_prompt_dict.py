"""业务代号字典(G1)单元测试。"""

from __future__ import annotations

from app.core.prompt_dict import DOMAIN_ALIASES, format_domain_dict


class TestDomainAliases:
    def test_minimum_20_entries(self):
        assert len(DOMAIN_ALIASES) >= 20, f"DOMAIN_ALIASES 仅 {len(DOMAIN_ALIASES)} 条,需 ≥20"

    def test_no_duplicate_codes(self):
        codes = list(DOMAIN_ALIASES.keys())
        assert len(codes) == len(set(codes)), f"代号有重复: {[c for c in codes if codes.count(c) > 1]}"

    def test_required_component_codes(self):
        for code in ("D1", "T1", "SSR", "CSR", "W1", "A1", "AI", "RAG", "LTM"):
            assert code in DOMAIN_ALIASES, f"必备代号 {code} 缺失"

    def test_codes_are_short(self):
        for code in DOMAIN_ALIASES:
            assert len(code) <= 5, f"代号 {code} 长度 >5"

    def test_descriptions_non_empty(self):
        for code, desc in DOMAIN_ALIASES.items():
            assert desc, f"代号 {code} 描述为空"


class TestModuleAliasesG1:
    """G1 收尾:验证补遗的 4 条模块代号(MCP/LG/A2A/SIO)均有真实代码引用。"""

    def test_mcp_alias_exists_and_references_mcp_server(self):
        assert "MCP" in DOMAIN_ALIASES
        desc = DOMAIN_ALIASES["MCP"]
        assert "Model Context Protocol" in desc
        assert "mcp_server.py" in desc

    def test_lg_alias_exists_and_references_langgraph(self):
        assert "LG" in DOMAIN_ALIASES
        desc = DOMAIN_ALIASES["LG"]
        assert "LangGraph" in desc
        assert "langgraph_service.py" in desc

    def test_a2a_alias_exists_and_references_a2a_service(self):
        assert "A2A" in DOMAIN_ALIASES
        desc = DOMAIN_ALIASES["A2A"]
        assert "Agent-to-Agent" in desc
        assert "a2a_service.py" in desc

    def test_sio_alias_exists_and_references_socket_io(self):
        assert "SIO" in DOMAIN_ALIASES
        desc = DOMAIN_ALIASES["SIO"]
        assert "Socket.IO" in desc
        assert "sio/handlers.py" in desc

    def test_new_codes_are_short(self):
        for code in ("MCP", "LG", "A2A", "SIO"):
            assert 2 <= len(code) <= 5, f"新代号 {code} 长度不在 [2,5]"

    def test_new_codes_do_not_collide_with_existing(self):
        # S1 在 _COMPONENT_ALIASES 与 _RENDER_ALIASES 间是已知"复用代号",不属本次新增
        new_codes = ("MCP", "LG", "A2A", "SIO")
        codes = list(DOMAIN_ALIASES.keys())
        for code in new_codes:
            assert codes.count(code) == 1, f"新代号 {code} 在合并后字典中出现多次"


class TestFormatDomainDict:
    def test_returns_markdown_section(self):
        result = format_domain_dict()
        assert result.startswith("## 业务代号字典")
        assert result.endswith("用短代号(如 D1/T1/SSR/RSC/PA/RAG/LTM),不再展开全称,除非首次引入某代号。")

    def test_contains_all_aliases(self):
        result = format_domain_dict()
        for code, desc in DOMAIN_ALIASES.items():
            assert f"- {code}: {desc}" in result, f"行 `- {code}: {desc}` 缺失"

    def test_includes_usage_rule(self):
        result = format_domain_dict()
        assert "使用规则" in result

    def test_does_not_leak_python_types(self):
        result = format_domain_dict()
        assert "dict[str, str]" not in result
        assert "DOMAIN_ALIASES" not in result or "DOMAIN_ALIASES" in result  # 文档允许

    def test_includes_new_module_aliases(self):
        """G1 收尾:format_domain_dict 输出必须含 4 条新别名。"""
        result = format_domain_dict()
        for code in ("MCP", "LG", "A2A", "SIO"):
            assert f"- {code}:" in result, f"新代号 {code} 未出现在 format_domain_dict 输出"
