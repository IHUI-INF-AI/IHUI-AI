# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账测试(2026-11-05,goal-b49)。

覆盖三条验收口径:
  1. 判定纯函数有正例与反例 —— unknown 不许被折成 human/ai;
  2. 回溯失败如实出声 —— 「回溯不出」必须带着原因;
  3. 真消费方 —— file_editor.edit_file 跑一次,归属账里就得有一条 ai 记录
     (证明这模块是装车的,不是只有测试在调)。
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.core.ai_code_attribution import (
    AI_GENERATED_TOOLS,
    ATTRIBUTION_AI,
    ATTRIBUTION_HUMAN,
    ATTRIBUTION_UNKNOWN,
    HUMAN_AUTHORED_TOOLS,
    REASON_MISSING_INPUT,
    REASON_UNREGISTERED_TOOL,
    TRACE_RESOLVED,
    TRACE_UNRESOLVED,
    HunkAnchor,
    classify,
    classify_attribution,
    compute_stats,
    make_record,
    parse_diff_line_range,
    resolve_anchor,
)
from app.services.ai_code_attribution_store import (
    AiCodeAttributionStore,
    list_records,
    record_attribution,
    stats_all,
    stats_for_path,
)


@pytest.fixture
def tmp_store(tmp_path, monkeypatch):
    """把归属账的落点挪进 tmp_path(测试不许往仓库 data/ 里写)。"""
    from app.services import ai_code_attribution_store as store_mod

    monkeypatch.setattr(store_mod.store, "_file", tmp_path / "ai_code_attribution.json")
    monkeypatch.setattr(store_mod.store, "_records", [])
    monkeypatch.setattr(store_mod.store, "_loaded", False)
    return store_mod.store


# ---------------------------------------------------------------------------
# 1. 判定:正例 + 反例
# ---------------------------------------------------------------------------
def test_classify_ai_tool_positive():
    assert classify_attribution("file_edit", "a.py", "@@ -1 +1 @@\n+x") == ATTRIBUTION_AI


def test_classify_mcp_prefixed_tool_is_ai():
    """MCP 命名空间前缀归一化后仍判 ai。"""
    assert classify_attribution("mcp__files__file_edit", "a.py", "diff") == ATTRIBUTION_AI


def test_classify_human_tool_positive():
    assert classify_attribution("manual_edit", "a.py", "diff") == ATTRIBUTION_HUMAN


def test_classify_unknown_tool_is_not_folded_to_human_or_ai():
    """反例:工具未登记 ⇒ unknown。**不许**折成 human(「没人写」≠「判出来是人」)。"""
    verdict = classify("some_other_tool", "a.py", "diff")
    assert verdict.attribution == ATTRIBUTION_UNKNOWN
    assert verdict.attribution not in (ATTRIBUTION_AI, ATTRIBUTION_HUMAN)
    assert verdict.reason == REASON_UNREGISTERED_TOOL


def test_classify_missing_input_is_unknown():
    """反例:输入不足以判定 ⇒ unknown(不给它猜的机会)。"""
    assert classify("file_edit", "", "diff").attribution == ATTRIBUTION_UNKNOWN
    assert classify("file_edit", "a.py", "").attribution == ATTRIBUTION_UNKNOWN
    assert classify("file_edit", "a.py", "").reason == REASON_MISSING_INPUT


def test_registries_do_not_overlap():
    """两张登记表不得有交集(同一个工具不能既是 ai 又是 human)。"""
    assert not (AI_GENERATED_TOOLS & HUMAN_AUTHORED_TOOLS)


def test_attribution_registry_defined_only_once():
    """判据常量表**全仓只许定义一次**(聚合面只能 re-export,不许复制一份)。

    拆档后 `app/core/ai_code_attribution.py` 是聚合导出面,它 `from ... import
    AI_GENERATED_TOOLS` 并把名字列进 `__all__` —— 那是**再导出**,不是第二份表。
    本用例按**定义式**(行首 + `:` 或 `=`)扫全仓,确认只有判据模块里有定义。
    """
    root = Path(__file__).resolve().parents[1] / "app"
    pattern = re.compile(r"^(AI_GENERATED_TOOLS|HUMAN_AUTHORED_TOOLS)\s*[:=]", re.MULTILINE)
    hits = sorted(
        str(path.relative_to(root)).replace("\\", "/")
        for path in root.rglob("*.py")
        if pattern.search(path.read_text(encoding="utf-8"))
    )
    assert hits == ["core/ai_code_attribution_verdict.py"]


def test_hunk_id_is_stable_and_distinct():
    first = make_record("1", "file_edit", "a.py", "@@ -1 +1 @@\n+x")
    same = make_record("2", "file_edit", "a.py", "@@ -1 +1 @@\n+x")
    other = make_record("3", "file_edit", "b.py", "@@ -1 +1 @@\n+x")
    assert first.anchor.hunk_id == same.anchor.hunk_id
    assert first.anchor.hunk_id != other.anchor.hunk_id


def test_parse_diff_line_range():
    diff = "@@ -1,2 +1,3 @@\n a\n-b\n+c\n+d\n"
    assert parse_diff_line_range(diff) == (1, 3)
    assert parse_diff_line_range("not a diff") == (0, 0)


# ---------------------------------------------------------------------------
# 2. 统计:AI 占比两个口径都给
# ---------------------------------------------------------------------------
def test_compute_stats_counts_and_ratios():
    records = [
        make_record("1", "file_edit", "a.py", "d1"),
        make_record("2", "manual_edit", "a.py", "d2"),
        make_record("3", "mystery_tool", "a.py", "d3"),
    ]
    stats = compute_stats(records)
    assert stats.total == 3
    assert stats.ai == 1
    assert stats.human == 1
    assert stats.unknown == 1
    assert stats.ai_ratio == pytest.approx(1 / 3)
    assert stats.known_ratio == pytest.approx(0.5)


def test_compute_stats_empty_is_zero_not_error():
    stats = compute_stats([])
    assert stats.total == 0
    assert stats.ai_ratio == 0.0
    assert stats.known_ratio == 0.0


# ---------------------------------------------------------------------------
# 3. 回溯:回溯不出必须如实出声
# ---------------------------------------------------------------------------
def test_resolve_anchor_without_commit_sha_is_unresolved():
    """改动尚未提交 ⇒ 无提交锚 ⇒ 回溯不出(如实出声,不假装成功)。"""
    anchor = HunkAnchor(path="a.py", line_start=1, line_end=2, hunk_id="x", commit_sha="")
    result = resolve_anchor(anchor, lambda *_a: (True, "ok", ("deadbeef",)))
    assert result.status == TRACE_UNRESOLVED
    assert "回溯不出" in result.detail
    assert result.commits == ()


def test_resolve_anchor_blame_failure_keeps_reason():
    anchor = HunkAnchor(path="a.py", line_start=1, line_end=2, hunk_id="x", commit_sha="a" * 40)
    result = resolve_anchor(anchor, lambda *_a: (False, "not a git repository", ()))
    assert result.status == TRACE_UNRESOLVED
    assert "not a git repository" in result.detail


def test_resolve_anchor_missing_line_range_is_unresolved():
    anchor = HunkAnchor(path="a.py", line_start=0, line_end=0, hunk_id="x", commit_sha="a" * 40)
    result = resolve_anchor(anchor, lambda *_a: (True, "ok", ("a" * 40,)))
    assert result.status == TRACE_UNRESOLVED
    assert "行区间" in result.detail


def test_resolve_anchor_success():
    anchor = HunkAnchor(path="a.py", line_start=1, line_end=2, hunk_id="x", commit_sha="a" * 40)
    result = resolve_anchor(anchor, lambda *_a: (True, "命中 1 个提交", ("a" * 40,)))
    assert result.status == TRACE_RESOLVED
    assert result.commits == ("a" * 40,)


# ---------------------------------------------------------------------------
# 4. 账目:落盘 / 读回 / 统计
# ---------------------------------------------------------------------------
def test_store_records_and_lists(tmp_store):
    record = record_attribution(
        "file_edit", "x.py", "@@ -1,1 +1,2 @@\n+a\n+b", line_start=1, line_end=2
    )
    assert record.attribution == ATTRIBUTION_AI
    rows = list_records(path="x.py")
    assert len(rows) == 1
    assert rows[0].record_id == record.record_id
    assert rows[0].anchor.line_start == 1
    assert rows[0].anchor.line_end == 2


def test_store_persists_across_instances(tmp_store, tmp_path):
    record_attribution("file_edit", "y.py", "diff")
    fresh = AiCodeAttributionStore(file_path=tmp_store._file)
    rows = fresh.list_records(path="y.py")
    assert len(rows) == 1
    assert rows[0].attribution == ATTRIBUTION_AI


def test_store_stats_by_path(tmp_store):
    record_attribution("file_edit", "z.py", "diff")
    record_attribution("mystery_tool", "z.py", "diff")
    stats = stats_for_path("z.py")
    assert stats.total == 2
    assert stats.ai == 1
    assert stats.unknown == 1
    assert stats_all().total == 2


# ---------------------------------------------------------------------------
# 5. 真消费方(装车证明):file_edit 跑一次 ⇒ 归属账里多一条 ai 记录
# ---------------------------------------------------------------------------
def test_file_edit_records_ai_attribution(tmp_path, monkeypatch, tmp_store):
    from app.services import file_editor

    monkeypatch.setattr(file_editor, "_workspace_roots", lambda: [str(tmp_path)])
    monkeypatch.setattr(file_editor, "_BACKUP_ROOT", tmp_path / "bak")
    target = tmp_path / "demo.py"
    target.write_text("a = 1\n", encoding="utf-8")

    result = file_editor.edit_file(str(target), "a = 1", "a = 2")

    assert result["ok"] is True
    rows = list_records(path=str(target.resolve()))
    assert len(rows) == 1, "file_edit 落账那一格没接线(消费方缺失)"
    assert rows[0].attribution == ATTRIBUTION_AI
    assert rows[0].tool == "file_edit"
    assert rows[0].anchor.line_start >= 1
    assert rows[0].anchor.commit_sha == "", "未提交的改动不得编出提交锚"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
