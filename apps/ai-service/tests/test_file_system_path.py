# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R58 file_system_path 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.file_system_path import (
    FILE_SYSTEM_PATH_ALIASES,
    FILE_SYSTEM_PATH_ELEMENTS,
    PATH_KIND,
    FileSystemPath,
    FileSystemPathError,
    ensure_file_system_path,
    expected_element_count,
    path_kind,
    path_names,
    validate_path,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        assert len(FileSystemPath) == 3

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in FileSystemPath}
        assert got == set(FILE_SYSTEM_PATH_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"GlobPattern", "Path", "Special"} == {m.value for m in FileSystemPath}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"glob_pattern", "Glob", "FilePath", "SpecialPath"}.isdisjoint(set(FILE_SYSTEM_PATH_ELEMENTS))


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert FILE_SYSTEM_PATH_ELEMENTS == {"GlobPattern": 1, "Path": 1, "Special": 1}

    @pytest.mark.parametrize("name,count", FILE_SYSTEM_PATH_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(FileSystemPathError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", FILE_SYSTEM_PATH_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_file_system_path(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(FileSystemPathError):
            ensure_file_system_path(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(FileSystemPathError, match="app/core/file_system_path.py"):
            ensure_file_system_path("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("GlobPattern", "glob"),
    ("Path", "explicit"),
    ("Special", "special"),
    ])
    def test_family(self, value, expected) -> None:
        assert path_kind(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(FileSystemPathError):
            path_kind("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", FILE_SYSTEM_PATH_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_path(name, count) == name

    @pytest.mark.parametrize("name,count", FILE_SYSTEM_PATH_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(FileSystemPathError, match="元素数应为"):
            validate_path(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = path_names()
        assert set(a) == set(FILE_SYSTEM_PATH_ELEMENTS)

    def test_path_kind_covers_all(self):
        assert set(PATH_KIND) == set(FILE_SYSTEM_PATH_ELEMENTS)

    def test_isomorphic_alias_families_locked(self):
        # 三族同构(Exec/Raw/FileSystem)逐字确证, pytest 钉死
        assert FILE_SYSTEM_PATH_ALIASES == ("FileSystemPath", "ExecFileSystemPath", "RawFileSystemPath")


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(FileSystemPath) == len(FILE_SYSTEM_PATH_ELEMENTS) == 3
        assert {m.value for m in FileSystemPath} == set(FILE_SYSTEM_PATH_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "GlobPattern"
        assert first in FILE_SYSTEM_PATH_ELEMENTS
        assert first.lower() not in FILE_SYSTEM_PATH_ELEMENTS
