"""Git worktree 隔离(P1-2,对齐 CLI 端 apps/cli/src/subagents/worktree.ts)。

用 asyncio.create_subprocess_exec 调 git(零新依赖,跨平台)。
每个 executor 在独立 worktree 中跑,防多 worker 并发改同一文件冲突。

Windows 注意:
- 路径长度:worktree 创建后 git config core.longpaths true
- 文件锁:删除失败 fallback shutil.rmtree(ignore_errors=True)
- 符号链接:git config core.symlinks false(Windows 不稳定)
- 大小写:task_id 统一小写(ULID/UUID .lower())
"""

import asyncio
import logging
import os
import re
import shutil
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# worktree 根目录环境变量(对齐 CLI 端 WORKTREE_DIR_ENV)
WORKTREE_DIR_ENV = "IHUI_WORKTREE_DIR"
# task_id 路径安全校验(防 ../ 注入)
_TASK_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass
class WorktreeInfo:
    """worktree 信息(对齐 CLI 端 WorktreeInfo)。"""

    path: str
    branch: str
    parent_id: str  # 源仓库路径


def get_default_worktree_root(source_path: str) -> str:
    """获取 worktree 根目录(对齐 CLI 端 getWorktreeRoot)。"""
    env = os.environ.get(WORKTREE_DIR_ENV)
    return env if env else os.path.join(source_path, ".worktrees")


def worktree_path(source_path: str, task_id: str) -> str:
    """计算 worktree 路径(.worktrees/<task_id>)。"""
    safe_id = task_id.lower() if not _TASK_ID_RE.match(task_id) else task_id
    return os.path.join(get_default_worktree_root(source_path), safe_id)


async def _git(
    args: list[str], cwd: str, *, timeout: float = 30.0
) -> tuple[int, bytes, bytes]:
    """调 git 子进程,返回 (returncode, stdout, stderr)。"""
    proc = await asyncio.create_subprocess_exec(
        "git",
        *args,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise
    return proc.returncode or 0, stdout, stderr


async def ensure_gitignore(source_path: str) -> None:
    """确保 .worktrees/ 在 .gitignore 中(对齐 CLI 端 ensureGitignore)。"""
    gitignore_path = os.path.join(source_path, ".gitignore")
    try:
        with open(gitignore_path, "r", encoding="utf-8") as f:
            content = f.read()
        if ".worktrees/" not in content:
            with open(gitignore_path, "a", encoding="utf-8") as f:
                if not content.endswith("\n"):
                    f.write("\n")
                f.write(".worktrees/\n")
    except FileNotFoundError:
        with open(gitignore_path, "w", encoding="utf-8") as f:
            f.write(".worktrees/\n")


async def create_worktree(
    source_path: str, task_id: str, *, start_point: Optional[str] = None
) -> WorktreeInfo:
    """创建 worktree(对齐 CLI 端 createWorktree)。

    Args:
        source_path: 源仓库路径
        task_id: 任务 ID(用作 worktree 目录名 + 分支名)
        start_point: 起始点(默认当前 HEAD)

    Returns:
        WorktreeInfo(path, branch, parent_id)

    Raises:
        RuntimeError: git worktree add 失败
    """
    if not _TASK_ID_RE.match(task_id):
        raise ValueError(f"task_id 含非法字符: {task_id}")

    await ensure_gitignore(source_path)
    wt_path = worktree_path(source_path, task_id)
    branch = f"subagent/{task_id}"

    # 探测 startPoint(对齐 CLI 端:先 rev-parse --abbrev-ref HEAD,失败用 HEAD)
    if start_point is None:
        rc, stdout, _ = await _git(
            ["rev-parse", "--abbrev-ref", "HEAD"], cwd=source_path
        )
        start_point = stdout.decode().strip() if rc == 0 and stdout.strip() else "HEAD"

    # git worktree add -b <branch> <path> <startPoint>
    rc, _, stderr = await _git(
        ["worktree", "add", "-b", branch, wt_path, start_point],
        cwd=source_path,
        timeout=60.0,
    )
    if rc != 0:
        raise RuntimeError(
            f"git worktree add 失败(branch={branch}, path={wt_path}): {stderr.decode().strip()}"
        )

    # Windows 适配:长路径 + 关闭 symlink(对齐研究建议)
    if os.name == "nt":
        await _git(["config", "core.longpaths", "true"], cwd=wt_path, timeout=5.0)
        await _git(["config", "core.symlinks", "false"], cwd=wt_path, timeout=5.0)

    return WorktreeInfo(path=wt_path, branch=branch, parent_id=source_path)


async def remove_worktree(
    wt_path: str, source_path: str, *, force: bool = True
) -> None:
    """删除 worktree(对齐 CLI 端 removeWorktree)。

    三层 fallback:
    1. git worktree remove --force(从源仓库 cwd 调,清理元数据)
    2. shutil.rmtree(ignore_errors=True)(git 失败时,如文件锁)
    3. 仅 log warning(全失败时不抛错,避免阻塞 WorkerPool)
    """
    # 层 1:git worktree remove
    args = ["worktree", "remove"]
    if force:
        args.append("--force")
    args.append(wt_path)
    rc, _, stderr = await _git(args, cwd=source_path, timeout=30.0)
    if rc == 0:
        return

    # 层 2:shutil.rmtree(git 失败,如 Windows 文件锁)
    logger.warning(
        "git worktree remove 失败,fallback shutil.rmtree: %s",
        stderr.decode().strip() if stderr else "unknown",
    )
    shutil.rmtree(wt_path, ignore_errors=True)

    # 层 3:检查是否仍存在(可能文件锁未释放)
    if os.path.exists(wt_path):
        logger.warning(
            "worktree 仍存在(可能文件锁): %s,将由后续 prune 清理", wt_path
        )


async def prune_worktrees(source_path: str) -> None:
    """清理孤儿 worktree 元数据(对齐 CLI 端 pruneWorktrees)。

    WorkerPool start() 时调一次,清理上次进程崩溃残留。
    """
    await _git(["worktree", "prune"], cwd=source_path, timeout=30.0)


async def list_worktrees(source_path: str) -> list[WorktreeInfo]:
    """列出所有 worktree(对齐 CLI 端 listWorktrees)。"""
    rc, stdout, _ = await _git(
        ["worktree", "list", "--porcelain"], cwd=source_path, timeout=10.0
    )
    if rc != 0:
        return []
    result: list[WorktreeInfo] = []
    current_path: Optional[str] = None
    for line in stdout.decode().splitlines():
        if line.startswith("worktree "):
            # 前一个 worktree 可能没有 branch 行(detached HEAD),也要加入
            if current_path:
                result.append(
                    WorktreeInfo(path=os.path.normpath(current_path), branch="", parent_id=source_path)
                )
            current_path = line[len("worktree ") :]
        elif line.startswith("branch ") and current_path:
            branch_ref = line[len("branch ") :]
            # branch refs/heads/<name> → <name>
            branch_name = (
                branch_ref[len("refs/heads/") :]
                if branch_ref.startswith("refs/heads/")
                else branch_ref
            )
            result.append(
                WorktreeInfo(path=os.path.normpath(current_path), branch=branch_name, parent_id=source_path)
            )
            current_path = None
        elif line == "" and current_path:
            # 空行分隔,前一个 worktree 无 branch 行
            result.append(
                WorktreeInfo(path=os.path.normpath(current_path), branch="", parent_id=source_path)
            )
            current_path = None
    # 最后一个 worktree
    if current_path:
        result.append(
            WorktreeInfo(path=os.path.normpath(current_path), branch="", parent_id=source_path)
        )
    return result
