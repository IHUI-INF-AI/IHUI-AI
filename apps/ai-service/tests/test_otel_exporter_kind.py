# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: otel_exporter_kind protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.otel_exporter_kind import (
    OTEL_EXPORTER_KIND_DOMAIN,
    OTEL_EXPORTER_KIND_ELEMENTS,
    OtelExporterKind,
    OtelExporterKindError,
    ensure_otel_exporter_kind,
    expected_otel_exporter_kind_element_count,
    is_otel_exporter_kind,
    otel_exporter_kind_domain,
    otel_exporter_kind_domain_members,
    otel_exporter_kind_names,
    validate_otel_exporter_kind,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert OTEL_EXPORTER_KIND_ELEMENTS == {"OtlpGrpc": 3, "OtlpHttp": 4}

    def test_closed_set_cardinality(self) -> None:
        assert len(OtelExporterKind) == len(OTEL_EXPORTER_KIND_ELEMENTS) == 2

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in OtelExporterKind} == set(OTEL_EXPORTER_KIND_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in OTEL_EXPORTER_KIND_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(OTEL_EXPORTER_KIND_DOMAIN) == set(OTEL_EXPORTER_KIND_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('OtlpGrpc', 'grpc'), ('OtlpHttp', 'http')])
    def test_domain(self, name, expected) -> None:
        assert otel_exporter_kind_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(OtelExporterKindError):
            otel_exporter_kind_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(OTEL_EXPORTER_KIND_DOMAIN.values()):
            seen.extend(otel_exporter_kind_domain_members(domain))
        assert sorted(seen) == sorted(OTEL_EXPORTER_KIND_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(OtelExporterKindError):
            otel_exporter_kind_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_otel_exporter_kind(nm) for nm in OTEL_EXPORTER_KIND_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "OtlpGrpc"
        assert first in OTEL_EXPORTER_KIND_ELEMENTS
        assert not is_otel_exporter_kind(first.lower())
        assert not is_otel_exporter_kind("bogus")

    def test_names_returns_copy(self) -> None:
        a = otel_exporter_kind_names()
        a.append("bogus")
        assert "bogus" not in OTEL_EXPORTER_KIND_ELEMENTS
        assert set(otel_exporter_kind_names()) == set(OTEL_EXPORTER_KIND_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(OTEL_EXPORTER_KIND_DOMAIN.values())))
        assert isinstance(otel_exporter_kind_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", OTEL_EXPORTER_KIND_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_otel_exporter_kind(name, count) == name

    @pytest.mark.parametrize("name,count", OTEL_EXPORTER_KIND_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(OtelExporterKindError, match="元素数应为"):
            validate_otel_exporter_kind(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(OtelExporterKindError):
            ensure_otel_exporter_kind("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(OtelExporterKindError):
            expected_otel_exporter_kind_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("OtlpGrpc", "OtlpHttp"):
            assert nm in OTEL_EXPORTER_KIND_ELEMENTS
            assert nm.lower() not in OTEL_EXPORTER_KIND_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(OTEL_EXPORTER_KIND_ELEMENTS.values()) == {3, 4}
