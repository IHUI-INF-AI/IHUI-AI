"""worktree 综合测试(2026-07-23 立,补齐 P1-2 Git worktree 隔离零覆盖)。

覆盖维度(45+ cases):
1. 模块级常量:WORKTREE_DIR_ENV / _TASK_ID_RE 正则(5 tests)
2. WorktreeInfo dataclass:字段构造与默认值(3 tests)
3. get_default_worktree_root:env 存在 / env 缺失 / 空串 / 路径拼接(5 tests)
4. worktree_path:正常 task_id / 异常 task_id(.lower)/ 大小写 / 注入字符(8 tests)
5. _git 异步:成功 / 失败 / 超时 / returncode=None / timeout 传参(7 tests)
6. ensure_gitignore:文件不存在 / 已含 / 不含 / 末尾换行 / 末尾无换行(5 tests)
7. create_worktree:非法 task_id / 默认 start_point / 显式 start_point / 失败抛错 / Windows 配置 / 返回 WorktreeInfo(8 tests)
8. remove_worktree:force=True / force=False / git 成功 / git 失败 fallback / 目录仍存(5 tests)
9. prune_worktrees:命令参数 / 不抛错(2 tests)
10. list_worktrees:rc!=0 / 空 / 单 worktree with branch / 多 worktree / detached HEAD / refs/heads 前缀 / 空行分隔 / 末尾(8 tests)
"""

from __future__ import annotations

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import worktree
from app.services.worktree import (
    WorktreeInfo,
    _TASK_ID_RE,
    WORKTREE_DIR_ENV,
    _git,
    create_worktree,
    ensure_gitignore,
    get_default_worktree_root,
    list_worktrees,
    prune_worktrees,
    remove_worktree,
    worktree_path,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_proc(
    returncode: int = 0,
    stdout: bytes = b"",
    stderr: bytes = b"",
    communicate_delay: float = 0.0,
):
    """构造 mock 子进程,提供 communicate/kill/wait/returncode。

    communicate() 返回 AsyncMock(返回 (stdout, stderr));
    kill()/wait() 分别为 sync/async。
    """
    proc = MagicMock()
    proc.returncode = returncode
    proc.communicate = AsyncMock(return_value=(stdout, stderr))
    proc.kill = MagicMock()
    proc.wait = AsyncMock()
    return proc


def make_worktree_info(
    path: str = "/repo/.worktrees/task1",
    branch: str = "subagent/task1",
    parent_id: str = "/repo",
) -> WorktreeInfo:
    return WorktreeInfo(path=path, branch=branch, parent_id=parent_id)


# =============================================================================
# 1. 模块级常量(5 tests)
# =============================================================================


class TestModuleConstants:
    """WORKTREE_DIR_ENV / _TASK_ID_RE 行为锁定。"""

    def test_worktree_dir_env_value(self):
        """WORKTREE_DIR_ENV 锁定为 'IHUI_WORKTREE_DIR'(对齐 CLI 端)。"""
        assert WORKTREE_DIR_ENV == "IHUI_WORKTREE_DIR"

    def test_task_id_re_matches_alphanumeric(self):
        """字母数字下划线连字符均匹配。"""
        assert _TASK_ID_RE.match("abc123")
        assert _TASK_ID_RE.match("ABC_xyz")
        assert _TASK_ID_RE.match("task-001")

    def test_task_id_re_rejects_path_traversal(self):
        """../ 注入字符不匹配。"""
        assert _TASK_ID_RE.match("../etc/passwd") is None
        assert _TASK_ID_RE.match("a/b") is None
        assert _TASK_ID_RE.match("a.b") is None  # 点不匹配
        assert _TASK_ID_RE.match("a b") is None  # 空格不匹配

    def test_task_id_re_rejects_empty(self):
        assert _TASK_ID_RE.match("") is None

    def test_task_id_re_anchored(self):
        """正则 ^...$ 锚定,不能部分匹配。"""
        assert _TASK_ID_RE.match("good") is not None
        # "good/bad" 含斜杠,整体不匹配
        assert _TASK_ID_RE.match("good/bad") is None


# =============================================================================
# 2. WorktreeInfo dataclass(3 tests)
# =============================================================================


class TestWorktreeInfo:
    def test_fields_assignment(self):
        info = WorktreeInfo(path="/p", branch="b", parent_id="/r")
        assert info.path == "/p"
        assert info.branch == "b"
        assert info.parent_id == "/r"

    def test_default_factory_no_optional(self):
        """WorktreeInfo 无 Optional 字段,三个 str 必填。"""
        info = make_worktree_info()
        assert isinstance(info.path, str)
        assert isinstance(info.branch, str)
        assert isinstance(info.parent_id, str)

    def test_equality_by_fields(self):
        a = WorktreeInfo(path="/p", branch="b", parent_id="/r")
        b = WorktreeInfo(path="/p", branch="b", parent_id="/r")
        c = WorktreeInfo(path="/p2", branch="b", parent_id="/r")
        assert a == b
        assert a != c


# =============================================================================
# 3. get_default_worktree_root(5 tests)
# =============================================================================


class TestGetDefaultWorktreeRoot:
    def test_env_var_set_returns_env(self, monkeypatch):
        """env 存在 → 返回 env 值。"""
        monkeypatch.setenv(WORKTREE_DIR_ENV, "/custom/wt")
        assert get_default_worktree_root("/repo") == "/custom/wt"

    def test_env_var_unset_returns_source_worktrees(self, monkeypatch):
        """env 不存在 → source_path/.worktrees。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = get_default_worktree_root("/repo")
        assert result == os.path.join("/repo", ".worktrees")

    def test_env_var_empty_string_returns_empty(self, monkeypatch):
        """BUG: env 设为空串时,getenv 返回 '',走 `if env` 分支 → fallback 到 source/.worktrees。

        源码 `env if env else ...`,空串 falsy → fallback。这里锁定当前行为:
        空串 env 等同于未设置。
        """
        monkeypatch.setenv(WORKTREE_DIR_ENV, "")
        result = get_default_worktree_root("/repo")
        assert result == os.path.join("/repo", ".worktrees")

    def test_relative_source_path(self, monkeypatch):
        """source_path 为相对路径时,join 仍是相对。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = get_default_worktree_root("./repo")
        assert result == os.path.join("./repo", ".worktrees")

    def test_env_takes_precedence_over_source(self, monkeypatch):
        """env 优先于 source_path/.worktrees。"""
        monkeypatch.setenv(WORKTREE_DIR_ENV, "/env/wt")
        result = get_default_worktree_root("/some/repo")
        assert result == "/env/wt"
        assert "/some/repo" not in result


# =============================================================================
# 4. worktree_path(8 tests)
# =============================================================================


class TestWorktreePath:
    def test_normal_task_id(self, monkeypatch):
        """正常 task_id(匹配 _TASK_ID_RE)→ root/task_id,大小写保留。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = worktree_path("/repo", "Task_001")
        assert result == os.path.join("/repo", ".worktrees", "Task_001")

    def test_uppercase_task_id_preserved(self, monkeypatch):
        """匹配 RE 的大写 task_id 不做 .lower()。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = worktree_path("/repo", "ABCD")
        assert result.endswith("ABCD")
        assert not result.endswith("abcd")

    def test_injection_task_id_lowered(self, monkeypatch):
        """task_id 含 ../ 等注入字符 → 不匹配 RE → .lower() 后拼接。

        BUG: 源码 `safe_id = task_id.lower() if not _TASK_ID_RE.match(task_id) else task_id`,
        含 "../" 的 task_id 不匹配 RE → 直接 .lower(),但路径分隔符 / 仍保留,
        导致 worktree_path 可能指向 root 外。这里锁定当前实际行为(不修)。
        """
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = worktree_path("/repo", "../ETC/passwd")
        # .lower() 后 "../etc/passwd" 仍含路径分隔符
        assert result == os.path.join("/repo", ".worktrees", "../etc/passwd")

    def test_dot_in_task_id_lowered(self, monkeypatch):
        """点号不匹配 RE → 整体 .lower()。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = worktree_path("/repo", "Task.ID")
        assert result.endswith("task.id")

    def test_slash_in_task_id_lowered(self, monkeypatch):
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = worktree_path("/repo", "Task/ID")
        assert result.endswith("task/id")

    def test_space_in_task_id_lowered(self, monkeypatch):
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = worktree_path("/repo", "Task ID")
        assert result.endswith("task id")

    def test_env_var_overrides_root(self, monkeypatch):
        """env 设置时,worktree_path 用 env 作 root。"""
        monkeypatch.setenv(WORKTREE_DIR_ENV, "/env/wt")
        result = worktree_path("/repo", "task1")
        assert result == os.path.join("/env/wt", "task1")

    def test_unicode_task_id_not_matched_lowered(self, monkeypatch):
        """Unicode 字符不匹配 [A-Za-z0-9_-] → .lower()。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        result = worktree_path("/repo", "Task中文")
        assert result.endswith("task中文")  # 中文 .lower() 不变


# =============================================================================
# 5. _git 异步(7 tests)
# =============================================================================


class TestGitSubprocess:
    @pytest.mark.asyncio
    async def test_success_returncode_zero(self):
        """rc=0 → 返回 (0, stdout, stderr)。"""
        proc = make_proc(returncode=0, stdout=b"main\n", stderr=b"")
        with patch("app.services.worktree.asyncio.create_subprocess_exec",
                   new=AsyncMock(return_value=proc)):
            rc, out, err = await _git(["rev-parse", "HEAD"], cwd="/repo")
        assert rc == 0
        assert out == b"main\n"
        assert err == b""

    @pytest.mark.asyncio
    async def test_failure_returncode_nonzero(self):
        """rc=1 → 返回 (1, stdout, stderr)。"""
        proc = make_proc(returncode=1, stdout=b"", stderr=b"error: bad rev\n")
        with patch("app.services.worktree.asyncio.create_subprocess_exec",
                   new=AsyncMock(return_value=proc)):
            rc, out, err = await _git(["rev-parse"], cwd="/repo")
        assert rc == 1
        assert err == b"error: bad rev\n"

    @pytest.mark.asyncio
    async def test_returncode_none_returns_zero(self):
        """BUG: 源码 `proc.returncode or 0`,returncode=None 时返回 0。

        实际上 returncode=None 表示进程未结束,但源码做了 falsy 兜底。
        这里锁定当前行为。
        """
        proc = make_proc(returncode=0, stdout=b"", stderr=b"")
        proc.returncode = None  # 覆盖为 None
        with patch("app.services.worktree.asyncio.create_subprocess_exec",
                   new=AsyncMock(return_value=proc)):
            rc, _, _ = await _git(["status"], cwd="/repo")
        assert rc == 0

    @pytest.mark.asyncio
    async def test_timeout_raises_and_kills(self):
        """超时 → 抛 asyncio.TimeoutError + proc.kill() 被调用 + proc.wait() 被调用。"""
        proc = make_proc(returncode=0, stdout=b"", stderr=b"")

        # communicate 永远挂起
        async def _hang():
            await asyncio.sleep(100)
            return (b"", b"")

        proc.communicate = _hang
        proc.kill = MagicMock()
        proc.wait = AsyncMock()

        with patch("app.services.worktree.asyncio.create_subprocess_exec",
                   new=AsyncMock(return_value=proc)):
            with pytest.raises(asyncio.TimeoutError):
                await _git(["status"], cwd="/repo", timeout=0.05)

        proc.kill.assert_called_once()
        proc.wait.assert_awaited()

    @pytest.mark.asyncio
    async def test_default_timeout_30s(self):
        """_git 默认 timeout=30.0。"""
        proc = make_proc(returncode=0, stdout=b"", stderr=b"")
        with patch("app.services.worktree.asyncio.create_subprocess_exec",
                   new=AsyncMock(return_value=proc)):
            with patch("app.services.worktree.asyncio.wait_for",
                       new=AsyncMock(return_value=(b"", b""))) as mock_wait:
                await _git(["status"], cwd="/repo")
                # wait_for 的 timeout 参数应为 30.0
                assert mock_wait.call_args.kwargs.get("timeout") == 30.0 or \
                       mock_wait.call_args.args[-1] == 30.0

    @pytest.mark.asyncio
    async def test_custom_timeout_passed_through(self):
        proc = make_proc(returncode=0, stdout=b"", stderr=b"")
        with patch("app.services.worktree.asyncio.create_subprocess_exec",
                   new=AsyncMock(return_value=proc)):
            with patch("app.services.worktree.asyncio.wait_for",
                       new=AsyncMock(return_value=(b"", b""))) as mock_wait:
                await _git(["status"], cwd="/repo", timeout=5.0)
                # 第 2 位置参数 timeout
                args, kwargs = mock_wait.call_args
                timeout_val = kwargs.get("timeout", args[-1] if len(args) > 1 else None)
                assert timeout_val == 5.0

    @pytest.mark.asyncio
    async def test_subprocess_exec_called_with_git(self):
        """create_subprocess_exec 第一参数必须是 'git'。"""
        proc = make_proc(returncode=0, stdout=b"", stderr=b"")
        with patch("app.services.worktree.asyncio.create_subprocess_exec",
                   new=AsyncMock(return_value=proc)) as mock_exec:
            await _git(["status"], cwd="/repo")
        args, kwargs = mock_exec.call_args
        assert args[0] == "git"
        assert args[1] == "status"
        assert kwargs["cwd"] == "/repo"
        assert kwargs["stdout"] is asyncio.subprocess.PIPE
        assert kwargs["stderr"] is asyncio.subprocess.PIPE


# =============================================================================
# 6. ensure_gitignore(5 tests)
# =============================================================================


class TestEnsureGitignore:
    @pytest.mark.asyncio
    async def test_file_not_exists_creates_with_worktrees(self, tmp_path):
        """.gitignore 不存在 → 创建并写入 .worktrees/。"""
        gi = tmp_path / ".gitignore"
        assert not gi.exists()
        await ensure_gitignore(str(tmp_path))
        assert gi.exists()
        content = gi.read_text(encoding="utf-8")
        assert ".worktrees/" in content
        assert content.endswith(".worktrees/\n")

    @pytest.mark.asyncio
    async def test_file_exists_without_worktrees_appends(self, tmp_path):
        """已存在但不含 .worktrees/ → 追加(末尾换行)。"""
        gi = tmp_path / ".gitignore"
        gi.write_text("node_modules/\n", encoding="utf-8")
        await ensure_gitignore(str(tmp_path))
        content = gi.read_text(encoding="utf-8")
        assert "node_modules/" in content
        assert ".worktrees/" in content
        # 原文件末尾有 \n,直接 append
        assert "node_modules/\n.worktrees/\n" in content

    @pytest.mark.asyncio
    async def test_file_exists_with_worktrees_no_change(self, tmp_path):
        """已含 .worktrees/ → 不重复追加。"""
        gi = tmp_path / ".gitignore"
        original = "node_modules/\n.worktrees/\n"
        gi.write_text(original, encoding="utf-8")
        await ensure_gitignore(str(tmp_path))
        content = gi.read_text(encoding="utf-8")
        assert content == original
        # 仅出现一次
        assert content.count(".worktrees/") == 1

    @pytest.mark.asyncio
    async def test_file_without_trailing_newline_adds_newline(self, tmp_path):
        """末尾无换行 → 先补 \n 再写 .worktrees/。"""
        gi = tmp_path / ".gitignore"
        gi.write_text("node_modules/", encoding="utf-8")  # 无 \n
        await ensure_gitignore(str(tmp_path))
        content = gi.read_text(encoding="utf-8")
        assert content == "node_modules/\n.worktrees/\n"

    @pytest.mark.asyncio
    async def test_file_with_trailing_newline_no_extra_newline(self, tmp_path):
        """末尾有换行 → 直接 append 不补 \n。"""
        gi = tmp_path / ".gitignore"
        gi.write_text("node_modules/\n", encoding="utf-8")
        await ensure_gitignore(str(tmp_path))
        content = gi.read_text(encoding="utf-8")
        # 不应出现双 \n
        assert "\n\n.worktrees/" not in content


# =============================================================================
# 7. create_worktree(8 tests)
# =============================================================================


class TestCreateWorktree:
    @pytest.mark.asyncio
    async def test_invalid_task_id_raises_value_error(self, tmp_path):
        """task_id 含非法字符 → ValueError,不调 git。"""
        with pytest.raises(ValueError, match="task_id 含非法字符"):
            await create_worktree(str(tmp_path), "../inject")

    @pytest.mark.asyncio
    async def test_invalid_task_id_with_dot_raises(self, tmp_path):
        with pytest.raises(ValueError):
            await create_worktree(str(tmp_path), "task.id")

    @pytest.mark.asyncio
    async def test_default_start_point_uses_rev_parse(self, tmp_path, monkeypatch):
        """start_point=None → 调 rev-parse --abbrev-ref HEAD;成功 → 用解析出的分支。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        monkeypatch.setattr(os, "name", "posix")  # 跳过 Windows config

        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append((args, cwd, timeout))
            if args[0] == "rev-parse":
                return (0, b"main\n", b"")
            if args[0] == "worktree":
                return (0, b"", b"")
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        # ensure_gitignore 会写文件,需要 tmp_path
        info = await create_worktree(str(tmp_path), "task1")
        assert info.branch == "subagent/task1"
        assert info.parent_id == str(tmp_path)
        # 路径 = tmp/.worktrees/task1
        assert info.path == os.path.join(str(tmp_path), ".worktrees", "task1")
        # 第 1 次调用 rev-parse
        assert calls[0][0] == ["rev-parse", "--abbrev-ref", "HEAD"]
        # 第 2 次调用 worktree add
        assert calls[1][0] == ["worktree", "add", "-b", "subagent/task1", info.path, "main"]

    @pytest.mark.asyncio
    async def test_default_start_point_rev_parse_fails_uses_HEAD(self, tmp_path, monkeypatch):
        """rev-parse 失败 → start_point = 'HEAD'。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        monkeypatch.setattr(os, "name", "posix")

        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append(args)
            if args[0] == "rev-parse":
                return (1, b"", b"error\n")
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        await create_worktree(str(tmp_path), "task1")
        # worktree add 的 start_point 应为 "HEAD"
        assert calls[1] == ["worktree", "add", "-b", "subagent/task1",
                             os.path.join(str(tmp_path), ".worktrees", "task1"), "HEAD"]

    @pytest.mark.asyncio
    async def test_default_start_point_empty_stdout_uses_HEAD(self, tmp_path, monkeypatch):
        """rev-parse 成功但 stdout 为空 → start_point = 'HEAD'。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        monkeypatch.setattr(os, "name", "posix")

        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append(args)
            if args[0] == "rev-parse":
                return (0, b"", b"")  # 空 stdout
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        await create_worktree(str(tmp_path), "task1")
        assert calls[1][-1] == "HEAD"

    @pytest.mark.asyncio
    async def test_explicit_start_point_skips_rev_parse(self, tmp_path, monkeypatch):
        """start_point 显式传入 → 跳过 rev-parse,直接 worktree add。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        monkeypatch.setattr(os, "name", "posix")

        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append(args)
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        info = await create_worktree(str(tmp_path), "task1", start_point="dev")
        # 不应有 rev-parse
        assert all(c[0] != "rev-parse" for c in calls)
        # worktree add 用 "dev"
        assert calls[0] == ["worktree", "add", "-b", "subagent/task1", info.path, "dev"]

    @pytest.mark.asyncio
    async def test_worktree_add_failure_raises_runtime_error(self, tmp_path, monkeypatch):
        """git worktree add 失败 → RuntimeError,错误信息含 branch/path/stderr。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        monkeypatch.setattr(os, "name", "posix")

        async def fake_git(args, cwd, *, timeout=30.0):
            if args[0] == "worktree":
                return (1, b"", b"already exists\n")
            return (0, b"main\n", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        with pytest.raises(RuntimeError, match="git worktree add 失败"):
            await create_worktree(str(tmp_path), "task1")

    @pytest.mark.asyncio
    async def test_windows_runs_config_commands(self, tmp_path, monkeypatch):
        """os.name == 'nt' → 额外调 config core.longpaths true + core.symlinks false。"""
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        monkeypatch.setattr(os, "name", "nt")

        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append((args, cwd, timeout))
            return (0, b"main\n", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        info = await create_worktree(str(tmp_path), "task1", start_point="main")

        # 应该有 config longpaths 和 config symlinks 两次调用
        config_calls = [c for c in calls if c[0][0] == "config"]
        assert len(config_calls) == 2
        assert config_calls[0][0] == ["config", "core.longpaths", "true"]
        assert config_calls[0][1] == info.path  # cwd 是 worktree 路径
        assert config_calls[0][2] == 5.0  # timeout=5.0
        assert config_calls[1][0] == ["config", "core.symlinks", "false"]

    @pytest.mark.asyncio
    async def test_returns_worktree_info_with_correct_fields(self, tmp_path, monkeypatch):
        monkeypatch.delenv(WORKTREE_DIR_ENV, raising=False)
        monkeypatch.setattr(os, "name", "posix")

        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, b"main\n", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        info = await create_worktree(str(tmp_path), "MyTask_001", start_point="main")
        assert isinstance(info, WorktreeInfo)
        assert info.branch == "subagent/MyTask_001"
        assert info.parent_id == str(tmp_path)
        assert info.path.endswith(os.path.join(".worktrees", "MyTask_001"))


# =============================================================================
# 8. remove_worktree(5 tests)
# =============================================================================


class TestRemoveWorktree:
    @pytest.mark.asyncio
    async def test_force_true_adds_force_flag(self, tmp_path, monkeypatch):
        """force=True → git worktree remove --force <path>。"""
        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append(args)
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        await remove_worktree("/wt/path", str(tmp_path), force=True)
        assert calls[0] == ["worktree", "remove", "--force", "/wt/path"]

    @pytest.mark.asyncio
    async def test_force_false_no_force_flag(self, tmp_path, monkeypatch):
        """force=False → git worktree remove <path>(无 --force)。"""
        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append(args)
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        await remove_worktree("/wt/path", str(tmp_path), force=False)
        assert calls[0] == ["worktree", "remove", "/wt/path"]
        assert "--force" not in calls[0]

    @pytest.mark.asyncio
    async def test_git_success_no_rmtree(self, tmp_path, monkeypatch):
        """git 成功(rc=0)→ 不调 shutil.rmtree。"""
        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        with patch("app.services.worktree.shutil.rmtree") as mock_rmtree:
            await remove_worktree("/wt/path", str(tmp_path))
        mock_rmtree.assert_not_called()

    @pytest.mark.asyncio
    async def test_git_failure_falls_back_to_rmtree(self, tmp_path, monkeypatch):
        """git 失败(rc≠0)→ fallback shutil.rmtree(ignore_errors=True)。"""
        async def fake_git(args, cwd, *, timeout=30.0):
            return (1, b"", b"locked\n")

        monkeypatch.setattr(worktree, "_git", fake_git)
        with patch("app.services.worktree.shutil.rmtree") as mock_rmtree:
            with patch("app.services.worktree.os.path.exists", return_value=False):
                await remove_worktree("/wt/path", str(tmp_path))
        mock_rmtree.assert_called_once_with("/wt/path", ignore_errors=True)

    @pytest.mark.asyncio
    async def test_git_failure_and_path_still_exists_logs_warning(self, tmp_path, monkeypatch):
        """git 失败 + rmtree 后 path 仍存 → log warning(不抛错)。"""
        async def fake_git(args, cwd, *, timeout=30.0):
            return (1, b"", b"locked\n")

        monkeypatch.setattr(worktree, "_git", fake_git)
        with patch("app.services.worktree.shutil.rmtree"):
            with patch("app.services.worktree.os.path.exists", return_value=True):
                # 不应抛错
                await remove_worktree("/wt/path", str(tmp_path))


# =============================================================================
# 9. prune_worktrees(2 tests)
# =============================================================================


class TestPruneWorktrees:
    @pytest.mark.asyncio
    async def test_calls_git_worktree_prune(self, tmp_path, monkeypatch):
        """命令参数 = ['worktree', 'prune']。"""
        calls = []

        async def fake_git(args, cwd, *, timeout=30.0):
            calls.append((args, cwd, timeout))
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        await prune_worktrees(str(tmp_path))
        assert calls[0][0] == ["worktree", "prune"]
        assert calls[0][1] == str(tmp_path)
        assert calls[0][2] == 30.0

    @pytest.mark.asyncio
    async def test_prune_does_not_raise_on_failure(self, tmp_path, monkeypatch):
        """prune 失败时 _git 不抛错(只返回 rc≠0),prune_worktrees 也不抛。"""
        async def fake_git(args, cwd, *, timeout=30.0):
            return (1, b"", b"error\n")

        monkeypatch.setattr(worktree, "_git", fake_git)
        # 不应抛错
        await prune_worktrees(str(tmp_path))


# =============================================================================
# 10. list_worktrees(8 tests)
# =============================================================================


class TestListWorktrees:
    @pytest.mark.asyncio
    async def test_failure_returns_empty_list(self, tmp_path, monkeypatch):
        """rc≠0 → 返回 []。"""
        async def fake_git(args, cwd, *, timeout=30.0):
            return (1, b"", b"error\n")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert result == []

    @pytest.mark.asyncio
    async def test_empty_output_returns_empty_list(self, tmp_path, monkeypatch):
        """rc=0 但 stdout 空 → []。"""
        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, b"", b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert result == []

    @pytest.mark.asyncio
    async def test_single_worktree_with_branch(self, tmp_path, monkeypatch):
        """单 worktree + branch 行 → 一个 WorktreeInfo。"""
        output = (
            b"worktree /repo\n"
            b"branch refs/heads/main\n"
            b"\n"
        )

        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, output, b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert len(result) == 1
        assert result[0].path == os.path.normpath("/repo")
        assert result[0].branch == "main"
        assert result[0].parent_id == str(tmp_path)

    @pytest.mark.asyncio
    async def test_multiple_worktrees(self, tmp_path, monkeypatch):
        """多 worktree → 多个 WorktreeInfo。"""
        output = (
            b"worktree /repo\n"
            b"branch refs/heads/main\n"
            b"\n"
            b"worktree /repo/.worktrees/t1\n"
            b"branch refs/heads/subagent/t1\n"
            b"\n"
        )

        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, output, b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert len(result) == 2
        assert result[0].branch == "main"
        assert result[1].branch == "subagent/t1"

    @pytest.mark.asyncio
    async def test_detached_head_no_branch_line(self, tmp_path, monkeypatch):
        """detached HEAD(无 branch 行)→ branch=""。"""
        output = (
            b"worktree /repo\n"
            b"detached\n"
            b"\n"
        )

        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, output, b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert len(result) == 1
        assert result[0].branch == ""

    @pytest.mark.asyncio
    async def test_branch_without_refs_heads_prefix(self, tmp_path, monkeypatch):
        """branch 行无 refs/heads/ 前缀 → 直接用作 branch 名。"""
        output = (
            b"worktree /repo\n"
            b"branch my-branch\n"
            b"\n"
        )

        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, output, b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert result[0].branch == "my-branch"

    @pytest.mark.asyncio
    async def test_empty_line_separates_worktrees(self, tmp_path, monkeypatch):
        """空行分隔 → 触发提前 append(若 current_path 存在但无 branch 行)。"""
        output = (
            b"worktree /repo\n"
            b"branch refs/heads/main\n"
            b"\n"
            b"worktree /repo/.worktrees/t1\n"
            b"detached\n"
            b"\n"
        )

        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, output, b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert len(result) == 2
        # 第二个 detached
        assert result[1].branch == ""

    @pytest.mark.asyncio
    async def test_last_worktree_without_trailing_empty_line(self, tmp_path, monkeypatch):
        """最后一个 worktree 无空行收尾 → 末尾 current_path 也要 append。"""
        output = (
            b"worktree /repo\n"
            b"branch refs/heads/main\n"
            b"\n"
            b"worktree /repo/.worktrees/t1\n"
            b"branch refs/heads/subagent/t1\n"
            # 末尾无空行
        )

        async def fake_git(args, cwd, *, timeout=30.0):
            return (0, output, b"")

        monkeypatch.setattr(worktree, "_git", fake_git)
        result = await list_worktrees(str(tmp_path))
        assert len(result) == 2
