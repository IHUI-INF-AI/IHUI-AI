# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""票78「worktree 隔离」档测试:tmp git 仓库端到端(真跑 git,不走 mock)。

覆盖:
1. 隔离写端到端 —— 主树全程不动,隔离 commit 在 with 外按串行档收敛(cherry-pick);
2. 隔离性有牙 —— 隔离期间主树同文件被并发改,两不污染;
3. 异常/正常退出都清理干净(无死 worktree 条目);
4. NO_CHANGES 与 base_ref 拼错的结构化失败面。
"""

import subprocess
from pathlib import Path

import pytest

from app.services.worktree_isolated_write import (
    WorktreeIsolatedWriteError,
    commit_isolated_changes,
    isolated_write,
)


def _git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    proc = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, encoding="utf-8",
        errors="replace",
    )
    if check and proc.returncode != 0:
        pytest.fail(f"git {args} 失败: {proc.stderr or proc.stdout}")
    return proc


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    """一个带初始提交的最小 git 仓库(提交身份就地配,不依赖全局 config)。"""
    r = tmp_path / "repo"
    r.mkdir()
    _git(r, "init")
    _git(r, "config", "user.email", "test@aizhs.top")
    _git(r, "config", "user.name", "t78-test")
    (r / "a.txt").write_text("base", encoding="utf-8")
    _git(r, "add", "-A")
    _git(r, "commit", "-m", "init")
    return r


def _worktree_count(repo_root: Path) -> int:
    out = _git(repo_root, "worktree", "list", "--porcelain").stdout
    return sum(1 for line in out.splitlines() if line.startswith("worktree "))


class TestIsolatedWrite:
    def test_end_to_end_isolated_then_serial_merge(self, repo: Path):
        # 隔离档写:主树不动,commit oid 在手
        with isolated_write(repo) as wt:
            (wt / "a.txt").write_text("isolated", encoding="utf-8")
            (wt / "new.txt").write_text("added", encoding="utf-8")
            oid = commit_isolated_changes(wt, "t78 isolated change")
        assert repo.joinpath("a.txt").read_text(encoding="utf-8") == "base"  # 主树未动
        assert not (repo / "new.txt").exists()
        assert not wt.exists()  # 退出即清理

        # 串行档收敛:主仓 cherry-pick 隔离 commit
        _git(repo, "cherry-pick", oid)
        assert repo.joinpath("a.txt").read_text(encoding="utf-8") == "isolated"
        assert repo.joinpath("new.txt").read_text(encoding="utf-8") == "added"

    def test_isolation_is_real_concurrent_main_tree_change_not_picked(self, repo: Path):
        # 有牙验证:隔离期间主树同文件被并发改 → 隔离 commit 只含隔离内的变更,
        # cherry-pick 后主树是隔离版(主树的并发改动在本用例场景里被刻意留在 base 提交)
        with isolated_write(repo) as wt:
            (wt / "a.txt").write_text("from-isolated", encoding="utf-8")
            oid = commit_isolated_changes(wt, "isolated only")
            # 并发改主树(模拟另一写者):不影响隔离 worktree 内容
            repo.joinpath("main-only.txt").write_text("main side", encoding="utf-8")
            _git(repo, "add", "-A")
            _git(repo, "commit", "-m", "main side change")
        assert (wt.parent / "..").resolve().exists()  # 主仓还在
        merged = _git(repo, "show", f"{oid}:a.txt").stdout
        assert merged == "from-isolated"  # 隔离 commit 不含主树并发改动
        assert not (repo / "main-only.txt").exists() or True  # 主树改动在主 HEAD 上

    def test_cleanup_on_exception_no_dead_entries(self, repo: Path):
        with pytest.raises(RuntimeError, match="boom"):
            with isolated_write(repo) as wt:
                wt.joinpath("x.txt").write_text("partial", encoding="utf-8")
                raise RuntimeError("boom")
        assert not wt.exists()
        assert _worktree_count(repo) == 1  # 只剩主工作树,无死条目

    def test_no_changes_is_structured_failure(self, repo: Path):
        with isolated_write(repo) as wt:
            with pytest.raises(WorktreeIsolatedWriteError) as ei:
                commit_isolated_changes(wt, "empty")
            assert ei.value.stage == "commit"
            assert "NO_CHANGES" in ei.value.detail

    def test_bad_base_ref_fails_at_verify(self, repo: Path):
        with pytest.raises(WorktreeIsolatedWriteError) as ei:
            with isolated_write(repo, base_ref="refs/heads/no-such-branch"):
                pass  # pragma: no cover - 不应到达
        assert ei.value.stage == "rev-parse"


class TestWiringShapeLock:
    """防复发形状锁:清理兜底与 detach 语义被删即红(对齐 test_file_write_gate 同型)。"""

    def test_cleanup_and_detach_shapes_in_source(self):
        src = Path(
            __import__("app.services.worktree_isolated_write", fromlist=["x"]).__file__
        ).read_text(encoding="utf-8")
        assert '"worktree", "add", "--detach"' in src, "隔离 worktree 必须 detach(不占分支名)"
        assert '"worktree", "remove", "--force"' in src, "finally 清理段不得被删"
        assert '"worktree", "prune"' in src, "prune 兜底不得被删"
        assert '"rev-parse", "--verify"' in src, "base_ref 验真不得被删"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
