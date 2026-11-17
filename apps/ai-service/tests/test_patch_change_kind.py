# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R56 patch_change_kind 封闭集测试（统一工程规范；wire 逐字锚 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.patch_change_kind import (
    PATCH_CHANGE_KIND_VALUES,
    PatchChangeKind,
    PatchChangeKindError,
    classify_patch_change,
    ensure_patch_change_kind,
    is_add,
    is_delete,
    is_rename,
    is_update,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        assert len(PatchChangeKind) == 3

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in PatchChangeKind}
        assert got == set(PATCH_CHANGE_KIND_VALUES)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"Add", "Delete", "Update"} == {m.value for m in PatchChangeKind}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"add", "delete", "update", "Modify", "Rename"}.isdisjoint({m.value for m in PatchChangeKind})


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", PATCH_CHANGE_KIND_VALUES)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_patch_change_kind(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_state", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(PatchChangeKindError):
            ensure_patch_change_kind(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(PatchChangeKindError, match="app/core/patch_change_kind.py"):
            ensure_patch_change_kind("bogus")


class TestPredicates:
    def test_is_add_delete_update(self):
        assert is_add("Add") is True and is_add("Update") is False
        assert is_delete("Delete") is True and is_delete("Add") is False
        assert is_update("Update") is True and is_update("Delete") is False

    def test_is_rename_requires_update_and_flag(self):
        assert is_rename("Update", True) is True
        assert is_rename("Update", False) is False
        assert is_rename("Add", True) is False  # 非 Update 即使带 flag 也 False

    def test_classify_consistency(self):
        assert classify_patch_change("Update", has_move_path=True) == "Update"
        assert classify_patch_change("Add") == "Add"

    @pytest.mark.parametrize("bad", [("Add", True), ("Delete", True)])
    def test_classify_rejects_move_path_on_non_update(self, bad):
        with pytest.raises(PatchChangeKindError):
            classify_patch_change(bad[0], has_move_path=bad[1])

    def test_predicates_reject_unregistered(self):
        for fn in (is_add, is_delete, is_update):
            with pytest.raises(PatchChangeKindError):
                fn("bogus")


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self):
        assert len(PatchChangeKind) == len(PATCH_CHANGE_KIND_VALUES) == 3
        assert {m.value for m in PatchChangeKind} == set(PATCH_CHANGE_KIND_VALUES)

    def test_mutating_kind_names_is_detected(self):
        """反向变异：Add 被改名 ⇒ 逐字锚失配转红。"""
        assert "Add" in PATCH_CHANGE_KIND_VALUES
        assert "add" not in PATCH_CHANGE_KIND_VALUES
