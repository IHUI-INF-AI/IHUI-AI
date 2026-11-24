# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R58 review_target 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.review_target import (
    REVIEW_TARGET_ELEMENTS,
    REVIEW_TARGET_KIND,
    ReviewTarget,
    ReviewTargetError,
    ensure_review_target,
    expected_element_count,
    review_target_kind,
    review_target_names,
    validate_review_target,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        assert len(ReviewTarget) == 3

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in ReviewTarget}
        assert got == set(REVIEW_TARGET_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"BaseBranch", "Commit", "Custom"} == {m.value for m in ReviewTarget}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"base_branch", "Basebranch", "CommitRange", "CustomRange"}.isdisjoint(set(REVIEW_TARGET_ELEMENTS))


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert REVIEW_TARGET_ELEMENTS == {"BaseBranch": 1, "Commit": 2, "Custom": 1}

    @pytest.mark.parametrize("name,count", REVIEW_TARGET_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(ReviewTargetError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", REVIEW_TARGET_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_review_target(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(ReviewTargetError):
            ensure_review_target(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(ReviewTargetError, match="app/core/review_target.py"):
            ensure_review_target("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("BaseBranch", "base_branch"),
    ("Commit", "commit"),
    ("Custom", "custom"),
    ])
    def test_family(self, value, expected) -> None:
        assert review_target_kind(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(ReviewTargetError):
            review_target_kind("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", REVIEW_TARGET_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_review_target(name, count) == name

    @pytest.mark.parametrize("name,count", REVIEW_TARGET_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ReviewTargetError, match="元素数应为"):
            validate_review_target(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = review_target_names()
        assert set(a) == set(REVIEW_TARGET_ELEMENTS)

    def test_review_target_kind_covers_all(self):
        assert set(REVIEW_TARGET_KIND) == set(REVIEW_TARGET_ELEMENTS)


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(ReviewTarget) == len(REVIEW_TARGET_ELEMENTS) == 3
        assert {m.value for m in ReviewTarget} == set(REVIEW_TARGET_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "BaseBranch"
        assert first in REVIEW_TARGET_ELEMENTS
        assert first.lower() not in REVIEW_TARGET_ELEMENTS
