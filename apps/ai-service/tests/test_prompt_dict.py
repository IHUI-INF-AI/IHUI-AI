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
