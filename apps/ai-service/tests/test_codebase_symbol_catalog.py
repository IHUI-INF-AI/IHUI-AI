# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文件/符号目录纯结构测试(2026-11-07)。

覆盖 `codebase_symbol_catalog` 的派生、序列化/校验、查找、增量合并与本地取正文:
- 合成摘要片(module/architecture)不得混入真符号;零符号文件仍保留文件级条目;
- 精确命中排第一、包含命中、kind/路径过滤、别名解析;
- payload 往返一致 + 坏形态逐格点名 + 缺席与坏档分立;
- merge: 未变沿用 / 变更覆盖 / 删除摘除 / 上轮缺席时 complete=False;
- 真实临时仓上 `search_local_catalog` 的正文与行区间一致。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.codebase_symbol_catalog import (
    Catalog,
    CatalogHit,
    FileEntry,
    SymbolEntry,
    build_catalog,
    catalog_from_payload,
    lookup,
    merge_catalog,
    search_local_catalog,
)

#: 合成摘要片的 symbol_type 集(单源在索引器;测试这里显式给出同一份口径)。
EXCLUDE = frozenset({"module_summary", "architecture_summary"})


def _chunk(
    path: str,
    start: int,
    end: int,
    *,
    language: str | None = "python",
    name: str | None = None,
    kind: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        file_path=path,
        line_start=start,
        line_end=end,
        language=language,
        symbol_name=name,
        symbol_type=kind,
    )


def _sample_catalog() -> Catalog:
    chunks = [
        _chunk("src/pkg/a.py", 1, 2, name="foo", kind="function"),
        _chunk("src/pkg/a.py", 4, 8, name="foobar", kind="function"),
        _chunk("src/pkg/a.py", 10, 15, name="Widget", kind="class"),
        _chunk("src/pkg/a.py", 17, 19, name="widget_build", kind="function"),
        _chunk("src/pkg/a.py", 1, 19, name="a.py", kind="module_summary"),
        _chunk("src/pkg/b.py", 1, 3, name="Bar", kind="class"),
        _chunk("src/pkg/empty.py", 1, 1),
        _chunk("src/pkg/other.py", 1, 2, name="foo", kind="function"),
    ]
    return build_catalog(chunks, exclude_symbol_types=EXCLUDE)


class TestBuildCatalog:
    def test_summary_chunks_excluded_and_zero_symbol_files_kept(self):
        catalog = _sample_catalog()

        names = {symbol.name for symbol in catalog.files["src/pkg/a.py"].symbols}
        assert names == {"foo", "foobar", "Widget", "widget_build"}
        assert "a.py" not in names  # module_summary 的"符号名"是文件名,不是真符号

        empty = catalog.files["src/pkg/empty.py"]
        assert empty.symbol_count == 0  # 零符号文件仍要有文件级条目

        assert set(catalog.files) == {
            "src/pkg/a.py",
            "src/pkg/b.py",
            "src/pkg/empty.py",
            "src/pkg/other.py",
        }
        assert catalog.complete is True
        assert catalog.state == "ok"
        assert catalog.symbol_count == 6


class TestLookup:
    def test_exact_symbol_ranks_first(self):
        catalog = _sample_catalog()
        hits = lookup(catalog, "foo")

        assert hits[0].symbol_name == "foo"
        assert hits[0].match == "symbol-exact"
        exact = [hit for hit in hits if hit.symbol_name == "foo"]
        assert {hit.file_path for hit in exact} == {"src/pkg/a.py", "src/pkg/other.py"}

    def test_contains_match(self):
        catalog = _sample_catalog()
        hits = lookup(catalog, "foo")

        exact = [hit for hit in hits if hit.symbol_name == "foo"]
        contains = [hit for hit in hits if hit.match == "symbol-contains"]
        assert len(exact) == 2
        assert [hit.symbol_name for hit in contains] == ["foobar"]

    def test_kind_filter_keeps_only_functions(self):
        catalog = _sample_catalog()
        hits = lookup(catalog, "widget", kind="function")

        assert [hit.symbol_name for hit in hits] == ["widget_build"]
        assert all(hit.kind == "function" for hit in hits)
        class_hits = lookup(catalog, "widget", kind="class")
        assert [hit.symbol_name for hit in class_hits] == ["Widget"]

    def test_kind_file_returns_file_level_hit(self):
        catalog = _sample_catalog()
        hits = lookup(catalog, "empty", kind="file")

        assert len(hits) == 1
        assert hits[0].kind == "file"
        assert hits[0].symbol_name is None
        assert hits[0].line_start == 1
        assert hits[0].line_end is None

    def test_path_glob_limits_results(self):
        catalog = _sample_catalog()
        hits = lookup(catalog, "foo", path_glob="src/pkg/other.py")

        assert {hit.file_path for hit in hits} == {"src/pkg/other.py"}

        no_hits = lookup(catalog, "foo", path_glob="src/lib/*.py")
        assert no_hits == []

    def test_alias_path_resolves_to_source_entry(self):
        catalog = _sample_catalog()
        aliased = Catalog(
            files=catalog.files,
            aliases={"src/pkg/moved.py": "src/pkg/a.py"},
            complete=catalog.complete,
        )
        hits = lookup(aliased, "widget", path_glob="src/pkg/moved.py")

        assert {hit.file_path for hit in hits} == {"src/pkg/moved.py"}
        assert all(hit.alias_of == "src/pkg/a.py" for hit in hits)
        assert {hit.symbol_name for hit in hits} == {"Widget", "widget_build"}

    def test_no_terms_returns_empty(self):
        catalog = _sample_catalog()
        assert lookup(catalog, "中文查询") == []
        assert lookup(catalog, "foo", max_results=0) == []


class TestPayloadRoundTrip:
    def test_round_trip_equal(self):
        catalog = _sample_catalog()
        parsed, reason = catalog_from_payload(catalog.to_payload())

        assert reason is None
        assert parsed is not None
        assert parsed.complete == catalog.complete
        assert set(parsed.files) == set(catalog.files)
        for path, entry in catalog.files.items():
            assert parsed.files[path].language == entry.language
            assert parsed.files[path].symbols == entry.symbols
        assert parsed.symbol_count == catalog.symbol_count

    def test_absent_is_not_corrupt(self):
        assert catalog_from_payload(None) == (None, None)

    @pytest.mark.parametrize(
        "payload",
        [
            [],
            {"version": 999, "files": {}},
            {"version": True, "files": {}},
            {"version": 1, "complete": "yes", "files": {}},
            {"version": 1, "aliases": ["x"], "files": {}},
            {"version": 1, "files": {"a.py": {"language": "python", "symbols": "nope"}}},
            {"version": 1, "files": {"a.py": {"language": 3, "symbols": []}}},
            {
                "version": 1,
                "files": {
                    "a.py": {
                        "language": "python",
                        "symbols": [
                            {"name": "x", "kind": "function", "lineStart": 0, "lineEnd": 0}
                        ],
                    }
                },
            },
            {
                "version": 1,
                "files": {
                    "a.py": {
                        "language": "python",
                        "symbols": [
                            {"name": "x", "kind": "function", "lineStart": 5, "lineEnd": 2}
                        ],
                    }
                },
            },
        ],
    )
    def test_malformed_payload_returns_reason(self, payload: object):
        catalog, reason = catalog_from_payload(payload)

        assert catalog is None
        assert reason is not None
        assert reason


class TestMergeCatalog:
    def test_unchanged_kept_changed_overwritten_removed_dropped(self):
        kept = FileEntry(
            path="keep.py",
            language="python",
            symbols=(SymbolEntry("keep_me", "function", 1, 2, "python"),),
        )
        dropped = FileEntry(
            path="old.py",
            language="python",
            symbols=(SymbolEntry("gone", "function", 1, 2, "python"),),
        )
        previous = Catalog(
            files={"keep.py": kept, "old.py": dropped},
            aliases={"alias.py": "keep.py"},
            complete=True,
        )
        replacement = FileEntry(
            path="new.py",
            language="python",
            symbols=(SymbolEntry("fresh", "function", 3, 4, "python"),),
        )

        merged = merge_catalog(
            previous,
            {"new.py": replacement},
            ["old.py"],
            aliases={"alias.py": "keep.py"},
        )

        assert set(merged.files) == {"keep.py", "new.py"}
        assert merged.files["keep.py"].symbols == kept.symbols
        assert merged.files["new.py"].symbols == replacement.symbols
        assert merged.aliases == {"alias.py": "keep.py"}
        assert merged.complete is True

    def test_previous_absent_marks_incomplete(self):
        entry = FileEntry(
            path="only.py",
            language="python",
            symbols=(SymbolEntry("only", "function", 1, 2, "python"),),
        )
        merged = merge_catalog(None, {"only.py": entry}, [], aliases={})

        assert set(merged.files) == {"only.py"}
        assert merged.complete is False
        assert merged.state == "partial"

    def test_previous_incomplete_stays_incomplete(self):
        previous = Catalog(
            files={"keep.py": FileEntry("keep.py", "python", ())},
            complete=False,
        )
        merged = merge_catalog(previous, {}, [], aliases={})

        assert merged.complete is False


class TestSearchLocalCatalog:
    def test_hit_content_matches_source_lines(self, tmp_path):
        source = "def alpha():\n    return 1\n\ndef beta():\n    return 2\n"
        (tmp_path / "mod.py").write_text(source, encoding="utf-8")
        catalog = Catalog(
            files={
                "mod.py": FileEntry(
                    path="mod.py",
                    language="python",
                    symbols=(
                        SymbolEntry("alpha", "function", 1, 2, "python"),
                        SymbolEntry("beta", "function", 4, 5, "python"),
                    ),
                )
            }
        )

        hits = search_local_catalog(tmp_path, catalog, "alpha")

        assert len(hits) == 1
        assert hits[0]["content"] == "def alpha():\n    return 1"
        assert hits[0]["line_start"] == 1
        assert hits[0]["line_end"] == 2
        assert hits[0]["retrieval_leg"] == "local-catalog"

    def test_file_level_hit_reads_head(self, tmp_path):
        (tmp_path / "empty_named.py").write_text("x = 1\n", encoding="utf-8")
        catalog = Catalog(
            files={
                "empty_named.py": FileEntry(
                    path="empty_named.py", language="python", symbols=()
                )
            }
        )

        hits = search_local_catalog(tmp_path, catalog, "empty_named", kind="file")

        assert len(hits) == 1
        assert hits[0]["symbol_type"] == "file"
        assert hits[0]["content"] == "x = 1"
        assert hits[0]["retrieval_leg"] == "local-catalog"

    def test_missing_file_reports_named_note(self, tmp_path):
        catalog = Catalog(
            files={
                "gone.py": FileEntry(
                    path="gone.py",
                    language="python",
                    symbols=(SymbolEntry("ghost", "function", 1, 2, "python"),),
                )
            }
        )

        hits = search_local_catalog(tmp_path, catalog, "ghost")

        assert hits[0]["content"] == ""
        assert hits[0]["content_note"] is not None
        assert "索引可能已过期" in str(hits[0]["content_note"])


def test_catalog_hit_to_dict_leg_marker():
    hit = CatalogHit(
        file_path="a.py",
        line_start=1,
        line_end=2,
        symbol_name="foo",
        kind="function",
        language="python",
        score=1.0,
        match="symbol-exact",
    )

    assert hit.to_dict()["retrieval_leg"] == "local-catalog"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
