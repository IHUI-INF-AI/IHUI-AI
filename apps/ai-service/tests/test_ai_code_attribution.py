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
import subprocess
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
    plan_blame_view,
    plan_checkpoint,
    resolve_anchor,
)
from app.services.ai_code_attribution_git import (
    attach_checkpoint_note,
    judge_notes_refs,
    list_notes_refs,
    notes_ref_for_namespace,
    read_commit_notes,
)
from app.services.ai_code_attribution_store import (
    AiCodeAttributionStore,
    backfill_commit_sha,
    checkpoint_log_path,
    host_session_id,
    list_checkpoint_log,
    list_records,
    log_host_edit_checkpoint,
    mirror_checkpoints_to_notes,
    note_host_edit,
    note_measured_external_edit,
    prompt_log_path,
    record_attribution,
    remember_prompt,
    show_prompt,
    stats_all,
    stats_for_path,
    stats_for_session,
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
    assert classify_attribution("resolve_conflict", "a.py", "@@ -1 +1 @@\n+x") == ATTRIBUTION_AI


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
    assert rows[0].session_id == ""


def test_file_edit_keeps_the_host_session(tmp_path, monkeypatch, tmp_store):
    from app.services import file_editor

    monkeypatch.setattr(file_editor, "_workspace_roots", lambda: [str(tmp_path)])
    monkeypatch.setattr(file_editor, "_BACKUP_ROOT", tmp_path / "bak")
    target = tmp_path / "demo.py"
    target.write_text("a = 1\n", encoding="utf-8")

    result = file_editor.edit_file(str(target), "a = 1", "a = 2", session_id="sess-9")

    assert result["ok"] is True
    rows = list_records(session_id="sess-9")
    assert len(rows) == 1
    assert rows[0].session_id == "sess-9"
    assert stats_for_session("sess-9").total == 1


@pytest.mark.asyncio
async def test_write_file_records_host_session_not_the_model_claim(tmp_path, monkeypatch, tmp_store):
    from app.services.mcp_server import _tool_file_edit, _tool_write_file

    monkeypatch.setattr(
        "app.services.mcp_server._validate_path_in_workspace",
        lambda p, extra_roots=None: (True, str(p)),
    )
    written = tmp_path / "out.py"
    out = await _tool_write_file(
        {
            "path": str(written),
            "content": "x = 1\n",
            "session_id": "model-forged",
            "__session_id": "host-sess",
        }
    )
    assert out["ok"] is True
    rows = list_records(session_id="host-sess")
    assert len(rows) == 1
    assert rows[0].tool == "write_file"
    assert rows[0].session_id == "host-sess"
    assert stats_for_session("model-forged").total == 0
    assert host_session_id({"session_id": "model-forged"}) == ""

    edited = tmp_path / "edit.py"
    edited.write_text("a = 1\n", encoding="utf-8")
    edited_out = await _tool_file_edit(
        {
            "file_path": str(edited),
            "old_string": "a = 1",
            "new_string": "a = 2",
            "session_id": "model-forged",
            "__session_id": "host-edit",
        }
    )
    assert edited_out["ok"] is True
    edit_rows = list_records(session_id="host-edit")
    assert len(edit_rows) == 1
    assert edit_rows[0].tool == "file_edit"
    assert edit_rows[0].session_id == "host-edit"


def test_backfill_fills_only_the_matching_empty_anchor(tmp_store):
    kept = "b" * 40
    record_attribution("file_edit", r"G:\repo\apps\a.py", "diff")
    record_attribution("file_edit", r"G:\repo\apps\b.py", "diff", commit_sha=kept)
    record_attribution("file_edit", r"G:\repo\apps\nota.py", "diff")
    updated, refused = backfill_commit_sha("a" * 40, ["apps/a.py"])
    assert updated == 1
    assert refused == ""
    assert list_records(path=r"G:\repo\apps\a.py")[0].anchor.commit_sha == "a" * 40
    assert list_records(path=r"G:\repo\apps\b.py")[0].anchor.commit_sha == kept
    assert list_records(path=r"G:\repo\apps\nota.py")[0].anchor.commit_sha == ""


def test_backfill_rejects_a_short_sha_without_writing(tmp_store):
    record_attribution("file_edit", "a.py", "diff")
    updated, refused = backfill_commit_sha("abc", ["a.py"])
    assert updated == 0
    assert "40" in refused
    assert list_records(path="a.py")[0].anchor.commit_sha == ""


def test_backfill_empty_list_does_not_stamp_every_row(tmp_store):
    record_attribution("file_edit", "a.py", "diff")
    updated, refused = backfill_commit_sha("c" * 40, [])
    assert updated == 0
    assert refused == ""
    assert list_records(path="a.py")[0].anchor.commit_sha == ""


def test_backfill_does_not_replace_a_corrupt_ledger(tmp_store):
    body = "{not json"
    tmp_store._file.write_text(body, encoding="utf-8")
    updated, refused = backfill_commit_sha("d" * 40, ["a.py"])
    assert updated == 0
    assert "读不到" in refused
    assert tmp_store._file.read_text(encoding="utf-8") == body


def test_after_edit_checkpoint_does_not_invent_defaults(tmp_store):
    status, refused = log_host_edit_checkpoint(
        "file_edit",
        "apps/A.py",
        "@@ -1 +1 @@\n+x",
        {"__session_id": "sess-1", "model": "gpt", "completion_id": "forged"},
    )
    assert status == "appended"
    assert refused == ""
    rows, note = list_checkpoint_log()
    assert note == ""
    assert len(rows) == 1
    row = rows[0]
    assert row["hook_event_name"] == "after_edit"
    assert row["kind"] == "ai"
    assert row["operation_id"] == "unjudged"
    assert row["tool"] == "file_edit"
    assert row["model"] is None
    assert row["session_id"] == "sess-1"
    assert row["edited_filepaths"] == ["apps/a.py"]


def test_checkpoint_duplicate_does_not_append(tmp_store):
    args = {"__session_id": "sess-1"}
    assert log_host_edit_checkpoint("file_edit", "a.py", "diff", args)[0] == "appended"
    body = checkpoint_log_path().read_text(encoding="utf-8")
    assert log_host_edit_checkpoint("file_edit", "a.py", "diff", args)[0] == "duplicate"
    assert checkpoint_log_path().read_text(encoding="utf-8") == body


def test_checkpoint_path_order_shares_one_key():
    left, _ = plan_checkpoint(
        "file_edit",
        "a.py",
        "diff",
        None,
        hook_event_name="before_edit",
        session_id="s",
        edited_filepaths=["B.py", "a.py"],
    )
    right, _ = plan_checkpoint(
        "file_edit",
        "a.py",
        "diff",
        None,
        hook_event_name="before_edit",
        session_id="s",
        edited_filepaths=["a.py", "b.py"],
    )
    assert left is not None and right is not None
    assert left["dedupe_key"] == right["dedupe_key"]


def test_measured_completion_is_ai_tab_and_human_stays_human():
    tab, _ = plan_checkpoint(
        "file_edit",
        "a.py",
        "diff",
        {"__completion_id": "comp-9", "__model": "own-model"},
        hook_event_name="checkpoint",
        session_id="s",
    )
    human, _ = plan_checkpoint(
        "human_edit",
        "a.py",
        "diff",
        None,
        hook_event_name="after_edit",
        session_id="s",
    )
    assert tab is not None and tab["kind"] == "ai_tab"
    assert tab["operation_id"] == "comp-9"
    assert tab["model"] == "own-model"
    assert human is not None and human["kind"] == "known_human"
    assert human["operation_id"] == "human"


def test_unknown_hook_and_corrupt_log_do_not_write(tmp_store):
    planned, refused = plan_checkpoint(
        "file_edit",
        "a.py",
        "diff",
        None,
        hook_event_name="saved",
        session_id="s",
    )
    assert planned is None
    assert "before_edit" in refused
    assert not checkpoint_log_path().exists()
    body = "{not json\n"
    checkpoint_log_path().write_text(body, encoding="utf-8")
    status, refused = log_host_edit_checkpoint("file_edit", "a.py", "diff", {"__session_id": "s"})
    assert status == "refused"
    assert "读不到" in refused
    assert checkpoint_log_path().read_text(encoding="utf-8") == body
    rows, note = list_checkpoint_log()
    assert rows == []
    assert note


@pytest.mark.asyncio
async def test_checkpoint_route_names_a_corrupt_log(tmp_store):
    from app.routers.ai_code_attribution import list_attribution_checkpoints

    checkpoint_log_path().write_text("{not json\n", encoding="utf-8")
    body = await list_attribution_checkpoints(user_id="u")
    assert body["data"]["checkpoints"] == []
    assert body["data"]["refused"]
    note_host_edit("file_edit", "a.py", "diff", {"__session_id": "s"})
    assert checkpoint_log_path().read_text(encoding="utf-8").startswith("{not json")
    assert len(list_records(path="a.py")) == 1


@pytest.mark.asyncio
async def test_successful_write_pairs_before_and_after(tmp_path, monkeypatch, tmp_store):
    from app.services.mcp_server import _tool_write_file

    monkeypatch.setattr(
        "app.services.mcp_server._validate_write_path_in_workspace",
        lambda p, extra_roots=None: (True, str(p)),
    )
    target = tmp_path / "out.py"
    out = await _tool_write_file(
        {"path": str(target), "content": "x = 1\n", "__session_id": "pair"}
    )
    assert out["ok"] is True
    rows, note = list_checkpoint_log()
    assert note == ""
    assert [row["hook_event_name"] for row in rows] == ["before_edit", "after_edit"]
    assert rows[0]["path_hash"] == rows[1]["path_hash"]
    assert rows[0]["dedupe_key"] != rows[1]["dedupe_key"]
    assert rows[0]["kind"] == "ai"


@pytest.mark.asyncio
async def test_rejected_write_does_not_record_a_checkpoint(tmp_path, monkeypatch, tmp_store):
    from app.services.mcp_server import _tool_write_file

    monkeypatch.setattr(
        "app.services.mcp_server._validate_write_path_in_workspace",
        lambda _p, extra_roots=None: (False, "拒绝"),
    )
    out = await _tool_write_file({"path": str(tmp_path / "no.py"), "content": "x\n", "__session_id": "s"})
    assert out["ok"] is False
    assert not checkpoint_log_path().exists()


@pytest.mark.asyncio
async def test_write_io_failure_keeps_before_without_after(tmp_path, monkeypatch, tmp_store):
    from app.services.mcp_server import _tool_write_file

    monkeypatch.setattr(
        "app.services.mcp_server._validate_write_path_in_workspace",
        lambda p, extra_roots=None: (True, str(p)),
    )
    target = tmp_path / "out.py"
    target.write_text("old\n", encoding="utf-8")
    real_open = open

    def guarded(file, mode="r", *args, **kwargs):
        if str(file) == str(target) and "w" in str(mode):
            raise OSError(13, "denied")
        return real_open(file, mode, *args, **kwargs)

    monkeypatch.setattr("builtins.open", guarded)
    out = await _tool_write_file({"path": str(target), "content": "new\n", "__session_id": "s"})
    assert out["ok"] is False
    rows, note = list_checkpoint_log()
    assert note == ""
    assert [row["hook_event_name"] for row in rows] == ["before_edit"]


def test_external_drift_is_known_human_and_other_drift_is_not(tmp_store):
    state = {
        "verdict": "stale",
        "changed_by": "external",
        "current": {"fingerprint": "fp-1"},
    }
    assert note_measured_external_edit("src/A.py", {"__session_id": "s"}, state)[0] == "appended"
    assert note_measured_external_edit("src/A.py", {"__session_id": "s"}, state)[0] == "duplicate"
    rows, note = list_checkpoint_log()
    assert note == ""
    assert rows[0]["kind"] == "known_human"
    assert rows[0]["operation_id"] == "human"
    assert rows[0]["tool"] == "external_edit"
    assert rows[0]["content_fingerprint"] == "fp-1"
    state["current"] = {"fingerprint": "fp-2"}
    assert note_measured_external_edit("src/A.py", {"__session_id": "s"}, state)[0] == "appended"
    assert note_measured_external_edit("src/A.py", {"__session_id": "s"}, {**state, "changed_by": "other"})[0] == "skipped"
    assert note_measured_external_edit("src/A.py", {"__session_id": "s"}, {**state, "verdict": "fresh"})[0] == "skipped"
    assert note_measured_external_edit("src/A.py", {"__session_id": "s"}, {"verdict": "stale", "changed_by": "external", "current": {}})[0] == "refused"
    hooks = [row["hook_event_name"] for row in list_checkpoint_log()[0]]
    assert hooks == ["checkpoint", "checkpoint"]


@pytest.mark.asyncio
async def test_file_edit_records_measured_external_drift(tmp_path, monkeypatch, tmp_store):
    from app.services.mcp_server import _tool_file_edit

    monkeypatch.setattr(
        "app.services.mcp_server._validate_write_path_in_workspace",
        lambda p, extra_roots=None: (True, str(p)),
    )
    monkeypatch.setattr(
        "app.services.mcp_server.judge_read_state",
        lambda *args, **kwargs: {
            "verdict": "stale",
            "changed_by": "external",
            "blocking": False,
            "current": {"fingerprint": "disk-fp"},
            "message": "外部改过",
        },
    )
    target = tmp_path / "demo.py"
    target.write_text("a = 1\n", encoding="utf-8")
    out = await _tool_file_edit(
        {
            "file_path": str(target),
            "old_string": "a = 1",
            "new_string": "a = 2",
            "__session_id": "host-1",
        }
    )
    assert out["ok"] is True
    kinds = [row["kind"] for row in list_checkpoint_log()[0]]
    assert "known_human" in kinds
    assert kinds.count("known_human") == 1


def test_notes_health_names_absence_and_does_not_collapse_namespaces():
    assert notes_ref_for_namespace("") == "refs/notes/ai"
    assert notes_ref_for_namespace("default") == "refs/notes/ai"
    assert notes_ref_for_namespace("team") == "refs/notes/ai-team"
    assert notes_ref_for_namespace("../notes") is None
    assert notes_ref_for_namespace("a/b") is None
    missing = judge_notes_refs([])
    assert missing["status"] == "absent"
    assert missing["message"] == "Expected notes ref is present"
    unread = judge_notes_refs(None)
    assert unread["status"] == "unjudged"
    assert unread["refs"] == []
    other = judge_notes_refs(["refs/notes/commits"])
    assert other["status"] == "absent"
    many = judge_notes_refs(["refs/notes/ai", "refs/notes/ai-team"])
    assert many["status"] == "multiple"
    assert many["message"] == "Multiple git-ai note namespaces detected"
    assert many["refs"] == ["refs/notes/ai", "refs/notes/ai-team"]


def _repo_with_one_commit(path: Path) -> str:
    path.mkdir(parents=True, exist_ok=True)

    def run(*args: str) -> str:
        proc = subprocess.run(
            ["git", "-C", str(path), *args],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return proc.stdout.strip()

    subprocess.run(["git", "init", str(path)], check=True, capture_output=True, text=True)
    run("config", "user.email", "notes@example.com")
    run("config", "user.name", "notes")
    (path / "a.py").write_text("x = 1\n", encoding="utf-8")
    run("add", "a.py")
    run("commit", "-m", "init")
    return run("rev-parse", "HEAD")


def test_matching_checkpoint_is_noted_once_and_a_bad_sha_creates_nothing(tmp_path, tmp_store):
    repo = tmp_path / "repo"
    sha = _repo_with_one_commit(repo)
    log_host_edit_checkpoint("file_edit", "a.py", "diff", {"__session_id": "s"})
    updated, refused = mirror_checkpoints_to_notes(repo, "abc", ["a.py"])
    assert updated == 0
    assert refused == "提交号不是 40 位"
    assert list_notes_refs(repo) == []
    updated, refused = mirror_checkpoints_to_notes(repo, sha, ["other.py"])
    assert updated == 0
    assert refused == ""
    assert list_notes_refs(repo) == []
    updated, refused = mirror_checkpoints_to_notes(repo, sha, [])
    assert (updated, refused) == (0, "")
    assert list_notes_refs(repo) == []
    updated, refused = mirror_checkpoints_to_notes(repo, sha, ["a.py"])
    assert updated == 1
    assert refused == ""
    assert list_notes_refs(repo) == ["refs/notes/ai"]
    again, again_refused = mirror_checkpoints_to_notes(repo, sha, ["a.py"])
    assert again == 0
    assert again_refused == ""
    health = judge_notes_refs(list_notes_refs(repo))
    assert health["status"] == "present"


def test_corrupt_checkpoint_log_is_not_written_into_notes(tmp_path, tmp_store):
    repo = tmp_path / "repo"
    sha = _repo_with_one_commit(repo)
    checkpoint_log_path().write_text("{not json\n", encoding="utf-8")
    updated, refused = mirror_checkpoints_to_notes(repo, sha, ["a.py"])
    assert updated == 0
    assert "读不到" in refused
    assert list_notes_refs(repo) == []
    assert checkpoint_log_path().read_text(encoding="utf-8") == "{not json\n"


def test_escaped_namespace_does_not_fall_back_to_the_default_ref(tmp_path, tmp_store):
    repo = tmp_path / "repo"
    sha = _repo_with_one_commit(repo)
    log_host_edit_checkpoint("file_edit", "a.py", "diff", {"__session_id": "s"})
    updated, refused = mirror_checkpoints_to_notes(repo, sha, ["a.py"], namespace="../notes")
    assert updated == 0
    assert refused == "notes 命名空间不能用"
    assert list_notes_refs(repo) == []


@pytest.mark.asyncio
async def test_notes_routes_do_not_touch_a_repo_they_cannot_see(monkeypatch):
    from app.routers import ai_code_attribution as route_mod

    monkeypatch.setattr(route_mod, "detect_repo_root", lambda: None)
    health = await route_mod.attribution_notes_health(user_id="u")
    assert health["data"]["status"] == "unjudged"
    assert health["data"]["message"] == "取不到 git 仓库根"
    mirrored = await route_mod.mirror_attribution_notes(
        {"commit_sha": "a" * 40, "files": ["a.py"]},
        user_id="u",
    )
    assert mirrored["data"]["updated"] == 0
    assert mirrored["data"]["refused"] == "取不到 git 仓库根"


def test_host_prompt_is_stored_apart_from_the_checkpoint_and_notes(tmp_path, tmp_store):
    args = {
        "__session_id": "s",
        "__prompt_id": "p-1",
        "__prompt_text": "把这一行改成两行",
        "prompt_id": "forged",
        "prompt": "模型自报的正文",
    }
    status, refused = log_host_edit_checkpoint("file_edit", "a.py", "diff", args)
    assert status == "appended"
    assert refused == ""
    rows, note = list_checkpoint_log()
    assert note == ""
    assert rows[0]["prompt_id"] == "p-1"
    assert "prompt_text" not in rows[0]
    assert "把这一行改成两行" not in checkpoint_log_path().read_text(encoding="utf-8")
    text, prompt_note = show_prompt("p-1")
    assert text == "把这一行改成两行"
    assert prompt_note == ""
    again, again_note = remember_prompt("p-1", "把这一行改成两行")
    assert again == "duplicate"
    assert again_note == ""
    clash, clash_note = remember_prompt("p-1", "另一段")
    assert clash == "refused"
    assert clash_note == "同一编号对上了另一段提示词"
    assert show_prompt("p-1")[0] == "把这一行改成两行"
    missing, missing_note = show_prompt("  ")
    assert missing is None
    assert missing_note == "没有提示词编号"
    repo = tmp_path / "repo"
    sha = _repo_with_one_commit(repo)
    updated, notes_refused = mirror_checkpoints_to_notes(repo, sha, ["a.py"])
    assert updated == 1
    assert notes_refused == ""
    shown = subprocess.run(
        ["git", "-C", str(repo), "notes", "--ref", "refs/notes/ai", "show", sha],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert "p-1" in shown.stdout
    assert "把这一行改成两行" not in shown.stdout


def test_half_a_prompt_refuses_the_checkpoint_and_writes_nothing(tmp_store):
    status, refused = log_host_edit_checkpoint(
        "file_edit",
        "a.py",
        "diff",
        {"__session_id": "s", "__prompt_id": "p-1"},
    )
    assert status == "refused"
    assert refused == "提示词编号和正文必须一起给"
    assert not checkpoint_log_path().exists()
    assert not prompt_log_path().exists()
    status, refused = log_host_edit_checkpoint(
        "file_edit",
        "a.py",
        "diff",
        {"__prompt_text": "只有正文"},
    )
    assert status == "refused"
    assert not prompt_log_path().exists()


def test_corrupt_prompt_log_is_not_replaced(tmp_store):
    body = "{not json\n"
    prompt_log_path().write_text(body, encoding="utf-8")
    status, refused = remember_prompt("p-1", "正文")
    assert status == "refused"
    assert "读不到" in refused
    assert prompt_log_path().read_text(encoding="utf-8") == body
    text, note = show_prompt("p-1")
    assert text is None
    assert "读不到" in note


@pytest.mark.asyncio
async def test_prompt_route_names_a_missing_prompt(tmp_store):
    from app.routers.ai_code_attribution import show_attribution_prompt

    body = await show_attribution_prompt("missing", user_id="u")
    assert body["data"]["text"] is None
    assert body["data"]["refused"] == "提示词没量到"


def _second_commit(path: Path) -> str:
    (path / "b.py").write_text("y = 1\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(path), "add", "b.py"], check=True, capture_output=True, text=True)
    subprocess.run(
        ["git", "-C", str(path), "commit", "-m", "second"],
        check=True,
        capture_output=True,
        text=True,
    )
    proc = subprocess.run(
        ["git", "-C", str(path), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return proc.stdout.strip()


def test_commit_notes_distinguish_missing_ref_empty_note_and_corrupt_body(tmp_path):
    repo = tmp_path / "repo"
    first = _repo_with_one_commit(repo)
    unread = read_commit_notes(repo, "abc")
    assert unread["status"] == "refused"
    assert unread["message"] == "提交号不是 40 位"
    absent = read_commit_notes(repo, first)
    assert absent["status"] == "absent"
    assert absent["message"] == "Expected notes ref is present"
    assert absent["checkpoints"] == []
    attached, note = attach_checkpoint_note(
        repo,
        first,
        {"dedupe_key": "k-1", "hook_event_name": "after_edit", "tool": "file_edit"},
    )
    assert attached == "appended"
    assert note == ""
    second = _second_commit(repo)
    empty = read_commit_notes(repo, second)
    assert empty["status"] == "empty"
    assert empty["message"] == "这个提交上没有检查点"
    assert empty["checkpoints"] == []
    present = read_commit_notes(repo, first)
    assert present["status"] == "present"
    rows = present["checkpoints"]
    assert isinstance(rows, list) and rows[0]["dedupe_key"] == "k-1"
    subprocess.run(
        ["git", "-C", str(repo), "notes", "--ref", "refs/notes/ai", "add", "-f", "-m", "{not json", second],
        check=True,
        capture_output=True,
        text=True,
    )
    corrupt = read_commit_notes(repo, second)
    assert corrupt["status"] == "refused"
    assert corrupt["message"] == "notes 读不到,不能把它说成没有检查点"
    assert corrupt["checkpoints"] == []
    still = read_commit_notes(repo, first)
    assert still["status"] == "present"


def test_multiple_note_namespaces_are_not_collapsed(tmp_path):
    repo = tmp_path / "repo"
    sha = _repo_with_one_commit(repo)
    assert attach_checkpoint_note(repo, sha, {"dedupe_key": "def", "tool": "file_edit"})[0] == "appended"
    assert (
        attach_checkpoint_note(
            repo,
            sha,
            {"dedupe_key": "team-key", "tool": "file_edit"},
            namespace="team",
        )[0]
        == "appended"
    )
    mixed = read_commit_notes(repo, sha)
    assert mixed["status"] == "multiple"
    assert mixed["checkpoints"] == []
    assert mixed["refs"] == ["refs/notes/ai", "refs/notes/ai-team"]
    team = read_commit_notes(repo, sha, namespace="team")
    assert team["status"] == "present"
    rows = team["checkpoints"]
    assert isinstance(rows, list) and rows[0]["dedupe_key"] == "team-key"
    missing = read_commit_notes(repo, sha, namespace="other")
    assert missing["status"] == "absent"
    assert missing["message"] == "这个命名空间的 notes 引用不在"


@pytest.mark.asyncio
async def test_notes_show_route_stays_unjudged_without_a_repo(monkeypatch):
    from app.routers import ai_code_attribution as route_mod

    monkeypatch.setattr(route_mod, "detect_repo_root", lambda: None)
    body = await route_mod.show_attribution_commit_notes("a" * 40, user_id="u")
    assert body["data"]["status"] == "unjudged"
    assert body["data"]["checkpoints"] == []
    assert body["data"]["message"] == "取不到 git 仓库根"


def test_blame_view_does_not_pick_a_mode_or_a_line_that_was_not_measured(tmp_store):
    record_attribution("file_edit", "a.py", "@@ -3 +3 @@\n+x", line_start=3, line_end=5)
    record_attribution("file_edit", "a.py", "@@ -1 +1 @@\n+y", line_start=0, line_end=0)
    records = list_records(path="a.py")
    assert len(records) == 2
    status, _message, chosen = plan_blame_view(None, records, line=4)
    assert status == "unjudged"
    assert chosen == []
    status, message, chosen = plan_blame_view("auto", records, line=4)
    assert status == "unjudged"
    assert "auto" in message
    assert chosen == []
    status, _message, chosen = plan_blame_view("off", records, line=4)
    assert status == "off"
    assert chosen == []
    status, _message, chosen = plan_blame_view("line", records, line=4)
    assert status == "line"
    assert len(chosen) == 1
    assert chosen[0].anchor.line_start == 3
    status, message, chosen = plan_blame_view("line", records, line=None)
    assert status == "unjudged"
    assert "光标行" in message
    assert chosen == []
    status, message, chosen = plan_blame_view("wide", records)
    assert status == "refused"
    assert chosen == []
    status, _message, chosen = plan_blame_view("all", records)
    assert status == "all"
    assert len(chosen) == 2


@pytest.mark.asyncio
async def test_blame_route_without_a_path_does_not_scan_the_ledger(monkeypatch):
    from app.routers import ai_code_attribution as route_mod

    def boom(*_args, **_kwargs):
        raise AssertionError("没有路径却扫了全账")

    monkeypatch.setattr(route_mod, "list_records", boom)
    body = await route_mod.attribution_blame(path=None, mode="all", user_id="u")
    assert body["data"]["status"] == "refused"
    assert body["data"]["message"] == "没有文件路径"
    assert body["data"]["records"] == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
