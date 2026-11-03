# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""worktree_isolated_write — 同文件写冲突治理「worktree 隔离」档(票78)。

串行化档(file_write_gate)覆盖**同进程**协程并发;本档覆盖需要**整组变更原子性**
或**跨进程/长任务**的场景:在 linked worktree(`git worktree add --detach`)里
应用并提交一组变更,主工作树全程不动;合并由调用方拿着隔离 commit oid 按
串行档(file_write_gate.get_path_write_lock)收敛 —— 两档组合 = 「隔离写 + 串行合并」。

与 scripts/lib/worktree.mjs 的分工:那边是"是否处于 linked worktree"的**环境
判定**(守门跳过用);本模块是"开一个隔离 worktree 干活"的**写出口**,不重复判定逻辑。

纪律(单一实现,不造第二份):
- subprocess 只调 git,参数一律 list(不走 shell,不拼引号);
- base_ref 先 `rev-parse --verify` 验真,防拼错 ref 静默落到错误基点;
- 清理兜底:正常退出与异常退出都 remove + prune,不留死 worktree 条目
  (丢弃型现场:调用方要保留 commit,必须在 with 内先记下 commit oid);
- 无 console;错误以结构化异常(stage + detail)上抛,日志归调用方。
"""

from __future__ import annotations

import subprocess
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


class WorktreeIsolatedWriteError(RuntimeError):
    """隔离写各阶段的结构化失败(stage: add/verify/commit)。"""

    def __init__(self, stage: str, detail: str) -> None:
        super().__init__(f"[{stage}] {detail}")
        self.stage = stage
        self.detail = detail


def _git(git_root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    """在 git_root 上跑一条 git 命令;check=True 时非零退码上抛结构化异常。"""
    proc = subprocess.run(
        ["git", "-C", str(git_root), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and proc.returncode != 0:
        raise WorktreeIsolatedWriteError(
            args[0] if args else "git", (proc.stderr or proc.stdout).strip()
        )
    return proc


def _worktree_dir(git_root: Path, name_prefix: str) -> Path:
    """隔离 worktree 落点:仓库内 .ihui-agent/tmp(已被 .gitignore,不进状态面)。"""
    return git_root / ".ihui-agent" / "tmp" / f"{name_prefix}-{uuid.uuid4().hex[:8]}"


@contextmanager
def isolated_write(
    git_root: str | Path,
    base_ref: str = "HEAD",
    name_prefix: str = "ihui-t78-wt",
) -> Iterator[Path]:
    """开一个 detach linked worktree,yield 其路径;退出(含异常)自动清理。

    用法:
        with isolated_write(repo_root) as wt:
            (wt / "f.txt").write_text("...")
            oid = commit_isolated_changes(wt, "msg")
        # with 外:主仓 cherry-pick/merge <oid>(按串行档收敛),oid 已在手
    """
    root = Path(git_root)
    # 基点验真:base_ref 拼错时宁可立刻炸,不静默建到错误基点
    _git(root, "rev-parse", "--verify", base_ref)
    wt = _worktree_dir(root, name_prefix)
    wt.parent.mkdir(parents=True, exist_ok=True)
    _git(root, "worktree", "add", "--detach", str(wt), base_ref)
    try:
        yield wt
    finally:
        # 丢弃型现场:无论成败都清理,不让 worktree 登记表挂死条目
        _git(root, "worktree", "remove", "--force", str(wt), check=False)
        _git(root, "worktree", "prune", check=False)


def commit_isolated_changes(worktree: Path, message: str) -> str:
    """在隔离 worktree 内 add -A + commit,返回新 commit oid。

    无变更(NO_CHANGES)按结构化异常上抛 —— "没提交"与"提交了"必须在
    返回面上可分辨,调用方不得把空提交当成功。
    """
    _git(worktree, "add", "-A")
    status = _git(worktree, "status", "--porcelain")
    if not status.stdout.strip():
        raise WorktreeIsolatedWriteError(
            "commit", "NO_CHANGES:隔离 worktree 内无变更可提交"
        )
    # 提交身份就地注入:不依赖环境/全局 git config,测试与生产同语义
    _git(
        worktree,
        "-c", "user.name=ihui-t78-isolated",
        "-c", "user.email=ihui-t78@aizhs.top",
        "commit", "-m", message,
    )
    return _git(worktree, "rev-parse", "HEAD").stdout.strip()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
