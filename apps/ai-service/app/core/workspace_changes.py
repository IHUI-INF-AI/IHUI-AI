# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合级工作区快照(对齐 DSH `dsh-workspace-changes`)。

与既有 `turn_diff_tracker` 的区别:tracker 只累计本进程内经补丁工具改过的
文件,`agent_engine` 的 git 分支又只做「回合前后脏文件集合差」——两者都会
漏掉「回合开始前已经脏、回合内又被其它工具改写」的文件。这里在回合开始
时用**独立临时 index + 临时 object 目录**给整个工作树写一棵 tree,回合结束
再写一棵,两棵树做 diff:只有真正被本轮改动的路径才进入变更集,轮前就存在
的未提交内容不会冒充本轮成果。

约束(对齐 DSH 的边界,不追求无限能力):
- 只读工作树,不碰真实 index、不 commit、不 stash、不改 HEAD;
- 忽略文件按 `.gitignore` 处理(`git add -A --ignore-errors` 的既有语义);
- 文件数超过 ``max_files`` 时截断并 ``truncated=True``;
- 文本 diff 超过 ``max_diff_chars`` 时截断并 ``truncated=True``;
- 非 git 工作区 / git 不可用 / 任何异常 → ``start()`` 返回 False,调用方
  回退既有 mtime 或 status 差集路径,不阻塞回合。
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_GIT_TIMEOUT_S = 15.0
_DEFAULT_MAX_FILES = 500
_DEFAULT_MAX_DIFF_CHARS = 2_000_000


@dataclass(frozen=True)
class TurnWorkspaceChange:
    """单个路径在本轮内的净变化。"""

    path: str
    status: str = "M"
    additions: int = 0
    deletions: int = 0
    binary: bool = False
    coarse: bool = False


@dataclass(frozen=True)
class TurnWorkspaceChangeSet:
    """两棵 tree 的 diff 结果。``start_tree`` 是回合开始快照的 tree oid。"""

    changes: tuple[TurnWorkspaceChange, ...] = field(default_factory=tuple)
    unified_diff: str = ""
    truncated: bool = False
    start_tree: str = ""
    end_tree: str = ""

    def as_changes(self) -> list[dict[str, Any]]:
        return [
            {
                "path": c.path,
                "status": c.status,
                "additions": c.additions,
                "deletions": c.deletions,
                "binary": c.binary,
                "coarse": c.coarse,
            }
            for c in self.changes
        ]


def _rmtree_onerror(func: Any, path: str, exc_info: Any) -> None:
    """Windows 上 git 对象文件可能是只读的；清临时目录前先补写权限。"""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except OSError:
        pass


def _git_env(git_dir: Path, objects_dir: Path, index_path: Path) -> dict[str, str]:
    env = dict(os.environ)
    env.update(
        {
            "GIT_INDEX_FILE": str(index_path),
            "GIT_OBJECT_DIRECTORY": str(objects_dir),
            "GIT_ALTERNATE_OBJECT_DIRECTORIES": str(git_dir / "objects"),
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_OPTIONAL_LOCKS": "0",
            "LC_ALL": "C",
            "LANG": "C",
        }
    )
    return env


class TurnWorkspaceSnapshot:
    """一次回合的工作树快照;生命周期由 `agent_engine` 的 `_run_prompt_turn` 管。"""

    def __init__(
        self,
        workspace: str,
        *,
        max_files: int = _DEFAULT_MAX_FILES,
        max_diff_chars: int = _DEFAULT_MAX_DIFF_CHARS,
    ) -> None:
        self._workspace = workspace
        self._max_files = max_files
        self._max_diff_chars = max_diff_chars
        self._root: Path | None = None
        self._git_dir: Path | None = None
        self._tmpdir: Path | None = None
        self._objects_dir: Path | None = None
        self._index_path: Path | None = None
        self._env: dict[str, str] | None = None
        self._start_tree: str | None = None
        self._closed = False

    @property
    def available(self) -> bool:
        return self._start_tree is not None and not self._closed

    @property
    def start_tree(self) -> str:
        return self._start_tree or ""

    def start(self) -> bool:
        """捕获回合开始 tree;失败返回 False 且自行清理临时目录。"""
        try:
            root_text = self._run(["rev-parse", "--show-toplevel"], cwd=self._workspace)
            if root_text is None:
                return False
            self._root = Path(root_text.strip())
            # 工作区是父仓库的子目录时，不冒充整个父仓库的回合快照：
            # 否则会把工作区之外的脏文件带进 turn.diff，宁可回退既有路径。
            if os.path.normcase(os.path.abspath(self._root)) != os.path.normcase(
                os.path.abspath(self._workspace)
            ):
                self._root = None
                return False
            git_dir_text = self._run(
                ["rev-parse", "--absolute-git-dir"], cwd=str(self._root)
            )
            if git_dir_text is None:
                return False
            self._git_dir = Path(git_dir_text.strip())
            self._tmpdir = Path(tempfile.mkdtemp(prefix="ihui-turn-snapshot-"))
            self._objects_dir = self._tmpdir / "objects"
            self._objects_dir.mkdir(parents=True, exist_ok=True)
            self._index_path = self._tmpdir / "index"
            self._env = _git_env(self._git_dir, self._objects_dir, self._index_path)
            self._start_tree = self._write_tree()
            if not self._start_tree:
                self.cleanup()
                return False
            return True
        except Exception:
            self.cleanup()
            return False

    def finish(self) -> TurnWorkspaceChangeSet:
        """捕获结束 tree 并返回与开始 tree 的净差异;失败返回空集。"""
        if not self.available or self._closed:
            return TurnWorkspaceChangeSet()
        start_tree = self._start_tree or ""
        try:
            try:
                end_tree = self._write_tree()
            except Exception:
                end_tree = ""
            if not end_tree:
                return TurnWorkspaceChangeSet()
            if end_tree == start_tree:
                return TurnWorkspaceChangeSet(start_tree=start_tree, end_tree=end_tree)
            status_map = self._name_status(start_tree, end_tree)
            stats = self._numstat(start_tree, end_tree)
            truncated = len(stats) > self._max_files
            stats = stats[: self._max_files]
            changes: list[TurnWorkspaceChange] = []
            for path, additions, deletions, binary in stats:
                changes.append(
                    TurnWorkspaceChange(
                        path=path,
                        status=status_map.get(path, "M"),
                        additions=additions,
                        deletions=deletions,
                        binary=binary,
                        # git numstat 的 `-` 表示二进制/不可计行,不是 0 行。
                        coarse=binary,
                    )
                )
            diff_text, diff_truncated = self._diff_text(
                start_tree, end_tree, [c.path for c in changes]
            )
            return TurnWorkspaceChangeSet(
                changes=tuple(changes),
                unified_diff=diff_text,
                truncated=truncated or diff_truncated,
                start_tree=start_tree,
                end_tree=end_tree,
            )
        except Exception:
            return TurnWorkspaceChangeSet()
        finally:
            self.cleanup()

    def cleanup(self) -> None:
        """删除临时 index/object 目录；幂等,绝不删除工作树。"""
        if self._closed:
            return
        self._closed = True
        if self._tmpdir is not None:
            shutil.rmtree(self._tmpdir, onerror=_rmtree_onerror)
        self._tmpdir = None
        self._objects_dir = None
        self._index_path = None
        self._env = None

    def _run(
        self, args: list[str], *, cwd: str | None = None, timeout: float = _GIT_TIMEOUT_S
    ) -> str | None:
        """跑 git 并返回 stdout；非零退出也返回 stdout(调用方自行判定)。"""
        cwd = cwd or (str(self._root) if self._root is not None else self._workspace)
        env = self._env if self._env is not None else dict(os.environ)
        try:
            proc = subprocess.run(
                ["git", *args],
                cwd=cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except Exception:
            return None
        return proc.stdout or ""

    def _write_tree(self) -> str:
        if self._root is None or self._env is None:
            return ""
        # --ignore-errors 允许个别不可读路径存在;这类路径不会进 tree,
        # 与 DSH 的 `add --all --ignore-errors` 同口径。
        self._run(["add", "-A", "--ignore-errors"], cwd=str(self._root))
        out = self._run(["write-tree"], cwd=str(self._root))
        if not out:
            return ""
        return out.strip().splitlines()[0].strip()

    def _name_status(self, start_tree: str, end_tree: str) -> dict[str, str]:
        out = self._run(
            [
                "-c",
                "core.quotePath=false",
                "diff",
                "--name-status",
                "--no-renames",
                start_tree,
                end_tree,
            ]
        )
        status_map: dict[str, str] = {}
        if not out:
            return status_map
        for line in out.splitlines():
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            code = parts[0][:1]
            path = parts[-1]
            status_map[path] = "A" if code == "A" else "D" if code == "D" else "M"
        return status_map

    def _numstat(
        self, start_tree: str, end_tree: str
    ) -> list[tuple[str, int, int, bool]]:
        out = self._run(
            [
                "-c",
                "core.quotePath=false",
                "diff",
                "--numstat",
                "--no-renames",
                start_tree,
                end_tree,
            ]
        )
        rows: list[tuple[str, int, int, bool]] = []
        if not out:
            return rows
        for line in out.splitlines():
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            added, deleted, path = parts[0], parts[1], parts[-1]
            binary = added == "-" or deleted == "-"
            try:
                additions = 0 if binary else int(added)
                deletions = 0 if binary else int(deleted)
            except ValueError:
                additions = deletions = 0
                binary = True
            rows.append((path, additions, deletions, binary))
        return rows

    def _diff_text(
        self, start_tree: str, end_tree: str, paths: list[str]
    ) -> tuple[str, bool]:
        if not paths:
            return "", False
        args = [
            "-c",
            "core.quotePath=false",
            "diff",
            "--no-ext-diff",
            "--no-color",
            "--unified=3",
            start_tree,
            end_tree,
            "--",
            *paths,
        ]
        out = self._run(args)
        if not out:
            return "", False
        if len(out) > self._max_diff_chars:
            return out[: self._max_diff_chars], True
        return out, False


def snapshot_turn_workspace(workspace: str | None) -> TurnWorkspaceSnapshot | None:
    """构造并启动一个回合快照;失败返回 None(调用方零行为变化)。"""
    if not workspace:
        return None
    snapshot = TurnWorkspaceSnapshot(workspace)
    if not snapshot.start():
        snapshot.cleanup()
        return None
    return snapshot
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
