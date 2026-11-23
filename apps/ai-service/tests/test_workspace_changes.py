# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合级工作区快照单测(对齐 DSH `dsh-workspace-changes`)。

覆盖最关键的口径:轮前已脏的文件不算本轮;轮前已脏且轮内再改的文件,
只算轮内的那一行;未跟踪新文件、删除、二进制都要如实进入变更集。
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from app.core.workspace_changes import TurnWorkspaceSnapshot


def _git(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return proc.stdout


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    _git(root, "init", "-q")
    _git(root, "config", "user.email", "test@example.com")
    _git(root, "config", "user.name", "Test")
    (root / "tracked.txt").write_text("one\n", encoding="utf-8")
    _git(root, "add", "tracked.txt")
    _git(root, "commit", "-q", "-m", "init")
    return root


def test_snapshot_only_reports_turn_changes(repo: Path) -> None:
    # 轮前就脏、轮内不再动:不得冒充本轮成果。
    (repo / "tracked.txt").write_text("one\npre-dirty\n", encoding="utf-8")
    (repo / "already-dirty.txt").write_text("dirty\n", encoding="utf-8")
    snap = TurnWorkspaceSnapshot(str(repo))
    assert snap.start() is True
    assert snap.available is True
    tmpdir = snap._tmpdir
    assert tmpdir is not None and tmpdir.exists()

    # 轮内:继续改同一个已脏文件 + 新建文件。
    (repo / "tracked.txt").write_text("one\npre-dirty\nturn\n", encoding="utf-8")
    (repo / "new.txt").write_text("new\n", encoding="utf-8")
    result = snap.finish()

    paths = [c.path for c in result.changes]
    assert paths == ["new.txt", "tracked.txt"]
    assert "already-dirty.txt" not in paths
    by_path = {c.path: c for c in result.changes}
    assert by_path["tracked.txt"].status == "M"
    assert by_path["tracked.txt"].additions == 1
    assert by_path["tracked.txt"].deletions == 0
    assert by_path["new.txt"].status == "A"
    assert by_path["new.txt"].additions == 1
    assert result.truncated is False
    assert result.start_tree and result.end_tree
    assert "+++ b/tracked.txt" in result.unified_diff
    assert "already-dirty.txt" not in result.unified_diff
    assert not tmpdir.exists()


def test_snapshot_reports_delete_and_binary(repo: Path) -> None:
    snap = TurnWorkspaceSnapshot(str(repo))
    assert snap.start() is True
    (repo / "tracked.txt").unlink()
    (repo / "blob.bin").write_bytes(b"\x00\x01\x02")
    result = snap.finish()

    by_path = {c.path: c for c in result.changes}
    assert by_path["tracked.txt"].status == "D"
    assert by_path["tracked.txt"].deletions == 1
    assert by_path["blob.bin"].status == "A"
    assert by_path["blob.bin"].binary is True
    assert by_path["blob.bin"].coarse is True


def test_snapshot_empty_when_nothing_changed(repo: Path) -> None:
    snap = TurnWorkspaceSnapshot(str(repo))
    assert snap.start() is True
    result = snap.finish()
    assert result.changes == ()
    assert result.unified_diff == ""
    assert result.start_tree == result.end_tree


def test_non_git_workspace_degrades_silently(tmp_path: Path) -> None:
    plain = tmp_path / "plain"
    plain.mkdir()
    snap = TurnWorkspaceSnapshot(str(plain))
    assert snap.start() is False
    assert snap.available is False
    assert snap.finish().changes == ()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
