# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""hook_audit 判据级用例(2026-11-21 第 39 项)。

覆盖四件事:载荷同形落盘 / 空表不落 / 写不进去不冒泡 / 观察出口只认 `hook.run`。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core import hook_audit
from app.services.hook_engine import HookEngine


def _payload(hooks: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {
        "run_id": "r-1",
        "session_id": "s-1",
        "tool_name": "read_file",
        "hooks": hooks
        if hooks is not None
        else [
            {"name": "fmt", "kind": "post_tool_use", "status": "ok", "durationMs": 12},
        ],
    }


def test_record_hook_run_appends_one_line(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))

    assert hook_audit.record_hook_run(_payload()) is True
    rows = [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 1
    row = rows[0]
    assert row["runId"] == "r-1"
    assert row["sessionId"] == "s-1"
    assert row["toolName"] == "read_file"
    assert row["hooks"][0]["status"] == "ok"
    assert row["hooks"][0]["durationMs"] == 12
    assert isinstance(row["ts"], str) and row["ts"]


def test_empty_hooks_do_not_write(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))

    assert hook_audit.record_hook_run(_payload(hooks=[])) is False
    assert not target.exists()


def test_append_failure_never_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # 用"路径的父是文件"造一个必然 mkdir 失败的场景,断言只返回 False 不吐异常。
    blocker = tmp_path / "blocker"
    blocker.write_text("x", encoding="utf-8")
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(blocker / "sub" / "hook-audit.jsonl"))

    assert hook_audit.record_hook_run(_payload()) is False


def test_publish_observation_audits_hook_run_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    engine = HookEngine()

    engine.publish_observation("hook.run", _payload())
    engine.publish_observation("hook.failed", {"hook_id": "x"})
    engine.publish_observation("subagent.status", {"status": "ok"})

    rows = [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 1
    assert rows[0]["runId"] == "r-1"


# ---- 第 41 项:摘要读侧 ---------------------------------------------------------


def test_summary_aggregates_hook_entries(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    hook_audit.record_hook_run(
        _payload(
            hooks=[
                {"name": "a", "kind": "pre_tool_use", "status": "ok", "durationMs": 10},
                {"name": "b", "kind": "post_tool_use", "status": "timeout", "durationMs": 5000},
            ]
        )
    )
    hook_audit.record_hook_run(
        _payload(hooks=[{"name": "c", "kind": "pre_tool_use", "status": "error", "durationMs": 3}])
    )

    s = hook_audit.summarize_hook_audit()
    assert s["available"] is True
    assert s["total"] == 3
    assert (s["ok"], s["timeout"], s["error"]) == (1, 1, 1)
    assert s["totalDurationMs"] == 5013
    assert s["slowestMs"] == 5000
    assert s["linesRead"] == 2
    assert isinstance(s["lastTs"], str)


def test_summary_filters_by_session(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    hook_audit.record_hook_run({**_payload(), "session_id": "s-a"})
    hook_audit.record_hook_run({**_payload(), "session_id": "s-b"})

    s = hook_audit.summarize_hook_audit(session_id="s-b")
    assert s["total"] == 1
    assert s["linesRead"] == 1


def test_summary_reports_unavailable_when_ledger_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(tmp_path / "nope.jsonl"))
    s = hook_audit.summarize_hook_audit()
    assert s["available"] is False
    assert s["total"] == 0


def test_summary_reads_tail_only(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    for _ in range(3):
        hook_audit.record_hook_run(_payload())

    s = hook_audit.summarize_hook_audit(max_lines=2)
    assert s["truncated"] is True
    assert s["linesRead"] == 2
    assert s["total"] == 2


def test_summary_exact_boundary_is_not_truncated(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    for _ in range(2):
        hook_audit.record_hook_run(_payload())

    s = hook_audit.summarize_hook_audit(max_lines=2)
    # 恰好两行 = 一行都没丢 ⇒ 不能标 truncated(否则"全量"被报成"截过")
    assert s["truncated"] is False
    assert s["linesRead"] == 2


def test_rotation_moves_oversized_ledger(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    monkeypatch.setenv("IHUI_HOOK_AUDIT_MAX_BYTES", "300")
    hook_audit.record_hook_run(_payload())
    hook_audit.record_hook_run(_payload())
    hook_audit.record_hook_run(_payload())

    rotated = target.with_name(target.name + ".1")
    assert rotated.exists()
    assert target.exists()
    # 轮转后追加的这枚落在新文件里,旧行不丢(.1 里保留)
    assert hook_audit.summarize_hook_audit()["available"] is True


def test_summary_reports_rotation_backup(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """第 45 项:轮转后当前台账为空时,必须报出"只剩历史备份",不许冒充零次。"""
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    monkeypatch.setenv("IHUI_HOOK_AUDIT_MAX_BYTES", "300")
    for _ in range(3):
        hook_audit.record_hook_run(_payload())

    backup = target.with_name(target.name + ".1")
    assert backup.stat().st_size > 0
    # 模拟"刚轮转、当前文件还没写入":把当前台账移走,备份仍在
    target.unlink()
    s = hook_audit.summarize_hook_audit()
    assert s["available"] is False
    assert s["total"] == 0
    assert isinstance(s["backupBytes"], int)
    assert s["backupBytes"] > 0


def test_summary_reports_no_backup_when_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "hook-audit.jsonl"
    monkeypatch.setenv("IHUI_HOOK_AUDIT_PATH", str(target))
    hook_audit.record_hook_run(_payload())
    s = hook_audit.summarize_hook_audit()
    assert s["backupBytes"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
