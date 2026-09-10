# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""merge3 引擎专项测试(P1 1-2 补丁冲突处理,2026-09-08 立)。

契约:3-way merge 干净合并 / 冲突块标记 / 逐块 resolve(局部拒绝)。
"""

from __future__ import annotations

from app.services.merge3 import (
    OURS_MARKER,
    SEP_MARKER,
    THEIRS_MARKER,
    MergeResult,
    merge3,
    merge3_for_edit,
    resolve_conflicts,
)


def _lines_of(text: str) -> list[str]:
    return text.splitlines(keepends=True)


class TestMerge3Clean:
    """干净合并:双方修改不相交 → 自动合并。"""

    def test_no_changes(self):
        base = "a\nb\nc\n"
        mr = merge3(base, base, base)
        assert mr.clean
        assert mr.merged == base
        assert mr.conflicts == []

    def test_disjoint_edits_auto_merged(self):
        base = "a\nb\nc\nd\ne\n"
        theirs = "A\nb\nc\nd\ne\n"  # 外部改第 1 行
        ours = "a\nb\nc\nd\nE\n"  # agent 改第 5 行
        mr = merge3(base, theirs, ours)
        assert mr.clean
        assert mr.merged == "A\nb\nc\nd\nE\n"

    def test_only_theirs_changed(self):
        base = "a\nb\n"
        theirs = "a\nB\n"
        mr = merge3(base, theirs, base)
        assert mr.clean
        assert mr.merged == theirs

    def test_only_ours_changed(self):
        base = "a\nb\n"
        ours = "A\nb\n"
        mr = merge3(base, base, ours)
        assert mr.clean
        assert mr.merged == ours

    def test_pure_insertion_disjoint(self):
        base = "a\nb\n"
        theirs = "a\nx\nb\n"  # 插入 x
        ours = "a\nb\ny\n"  # 尾部插入 y
        mr = merge3(base, theirs, ours)
        assert mr.clean
        # 插入不相交时自动合并(a x b y)
        assert _lines_of(mr.merged) == ["a\n", "x\n", "b\n", "y\n"]


class TestMerge3Conflict:
    """双侧修改同一区域 → 冲突块。"""

    def test_overlapping_edits_conflict(self):
        base = "a\nb\nc\n"
        theirs = "a\nB2\nc\n"
        ours = "a\nB1\nc\n"
        mr = merge3(base, theirs, ours)
        assert not mr.clean
        assert len(mr.conflicts) == 1
        cb = mr.conflicts[0]
        assert cb.ours == ["B1\n"]
        assert cb.theirs == ["B2\n"]
        # 标记文本结构
        lines = _lines_of(mr.merged)
        assert lines[0] == "a\n"
        assert OURS_MARKER in lines
        assert SEP_MARKER in lines
        assert THEIRS_MARKER in lines

    def test_conflict_block_index_sequential(self):
        base = "a\nb\nc\nd\ne\nf\ng\n"
        # 两处不相交的双侧冲突
        theirs = "a\nB2\nc\nd\ne\nF2\ng\n"
        ours = "a\nB1\nc\nd\ne\nF1\ng\n"
        mr = merge3(base, theirs, ours)
        assert not mr.clean
        assert len(mr.conflicts) == 2
        assert mr.conflicts[0].index == 0
        assert mr.conflicts[1].index == 1
        assert mr.conflict_count() == 2

    def test_adjacent_blocks_clustered(self):
        # 紧邻块保守并簇:宁可多报冲突不丢改动
        base = "a\nb\nc\n"
        theirs = "a\nX\nY\nc\n"  # 替换 b 为 XY(2 行)
        ours = "a\nZ\nc\n"  # 替换 b 为 Z(1 行)
        mr = merge3(base, theirs, ours)
        assert not mr.clean


class TestMerge3ForEdit:
    """file_edit 场景包装。"""

    def test_ours_is_base_with_replacement(self):
        base = "def f():\n    return 1\n"
        mr = merge3_for_edit(base, base, "return 1", "return 2")
        assert mr.clean
        assert mr.merged == "def f():\n    return 2\n"

    def test_old_string_missing_in_base_gives_no_ours_change(self):
        # old_string 不在 base:ours=base(无 agent 侧修改)
        base = "a\n"
        mr = merge3_for_edit(base, "b\n", "zzz", "yyy")
        assert mr.clean
        assert mr.merged == "b\n"  # theirs 原样保留

    def test_replace_all(self):
        base = "x\nx\nx\n"
        mr = merge3_for_edit(base, base, "x", "y", replace_all=True)
        assert mr.clean
        assert mr.merged == "y\ny\ny\n"

    def test_external_edit_clean_merge(self):
        base = "a\nb\nc\n"
        current = "a\nb\nc\nnew_tail\n"  # 外部尾部追加
        mr = merge3_for_edit(base, current, "a", "A")
        assert mr.clean
        assert _lines_of(mr.merged) == ["A\n", "b\n", "c\n", "new_tail\n"]


class TestResolveConflicts:
    """逐块决策(局部拒绝核心)。"""

    def test_resolve_all_ours(self):
        base = "a\nb\nc\n"
        current = "a\nB2\nc\n"
        res = resolve_conflicts(base, current, "b", "B1", ["ours"])
        assert res["ok"]
        assert res["content"] == "a\nB1\nc\n"
        assert res["applied"] == [{"index": 0, "choice": "ours"}]

    def test_resolve_all_theirs_rejects_agent_edit(self):
        # 局部拒绝:选 theirs = 拒绝 agent 修改,保留磁盘现状
        base = "a\nb\nc\n"
        current = "a\nB2\nc\n"
        res = resolve_conflicts(base, current, "b", "B1", ["theirs"])
        assert res["ok"]
        assert res["content"] == current  # 磁盘现状保留
        assert res["applied"] == [{"index": 0, "choice": "theirs"}]

    def test_resolve_mixed_choices(self):
        # 两个冲突块:第 1 块 ours(采用)、第 2 块 theirs(拒绝)
        base = "a\nb\nc\nd\ne\nf\ng\n"
        theirs = "a\nB2\nc\nd\ne\nF2\ng\n"
        res = resolve_conflicts(base, theirs, "b", "B1", ["ours", "theirs"])
        assert res["ok"]
        # 注意 old_string=b 只影响第 1 块;第 2 块 ours=base 未变,选 theirs=保留 f 原状
        assert res["content"] == "a\nB1\nc\nd\ne\nf\ng\n"

    def test_choices_missing_defaults_to_ours(self):
        base = "a\nb\nc\n"
        current = "a\nB2\nc\n"
        res = resolve_conflicts(base, current, "b", "B1", [])
        assert res["ok"]
        assert res["content"] == "a\nB1\nc\n"

    def test_invalid_choice_falls_back_to_ours(self):
        base = "a\nb\nc\n"
        current = "a\nB2\nc\n"
        res = resolve_conflicts(base, current, "b", "B1", ["whatever"])
        assert res["ok"]
        assert res["content"] == "a\nB1\nc\n"

    def test_no_conflict_returns_auto_merge(self):
        base = "a\nb\nc\n"
        current = "A\nb\nc\n"  # 外部改第 1 行
        res = resolve_conflicts(base, current, "c", "C", [])
        assert res["ok"]
        assert res["conflicts"] == 0
        assert res["content"] == "A\nb\nC\n"


class TestMergeResultContract:
    """MergeResult 结构契约。"""

    def test_dataclass_fields(self):
        mr = MergeResult(merged="x", clean=True)
        assert mr.merged == "x"
        assert mr.clean
        assert mr.conflicts == []
        assert mr.conflict_count() == 0

    def test_empty_texts(self):
        mr = merge3("", "", "")
        assert mr.clean
        assert mr.merged == ""

    def test_merge3_preserves_unmodified_prefix_suffix(self):
        base = "l1\nl2\nl3\nl4\nl5\n"
        theirs = "l1\nT\nl3\nl4\nl5\n"
        ours = "l1\nO\nl3\nl4\nl5\n"
        mr = merge3(base, theirs, ours)
        assert not mr.clean
        lines = _lines_of(mr.merged)
        # 前缀 l1 与后缀 l3..l5 完整保留,冲突块在中间
        assert lines[0] == "l1\n"
        # 冲突块完整结构:OURS / SEP / THEIRS 标记行 + 后缀 l3..l5 完整保留
        assert OURS_MARKER in lines
        assert SEP_MARKER in lines
        assert THEIRS_MARKER in lines
        assert lines[-3:] == ["l3\n", "l4\n", "l5\n"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
