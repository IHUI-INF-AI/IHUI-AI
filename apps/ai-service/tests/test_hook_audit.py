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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
