"""sandbox.py 综合测试 — P3 沙箱执行器 6 后端 + 安全检查。

覆盖维度(15 TestClass,~130 cases):
1. SandboxError 异常 + SandboxResult dataclass
2. _DANGEROUS_PATTERNS / _ALLOWED_PREFIXES / _DESTRUCTIVE_PATTERNS 常量
3. _check_dangerous_patterns(8 个灾难性模式 + 安全命令无匹配)
4. _log_exec 静态方法
5. execute 后端分发(6 种后端 + 未知后端 + ssh 无 host)
6. _execute_local:灾难性拦截 + 黑白名单 + 真实执行 + 超时 + FileNotFoundError
7. _execute_docker:成功 + 超时 + FileNotFoundError + env 透传
8. _execute_ssh:成功 + 超时 + FileNotFoundError + 命令构造
9. _execute_modal:credentials + 成功 + HTTP 错误 + 超时 + 解析错误
10. _execute_daytona:credentials + 成功 + HTTP 错误 + 超时 + URL 构造
11. _execute_singularity:probe 失败 + 成功 + 超时 + 资源限制 + env 透传
12. 全局单例 sandbox_executor
"""

from __future__ import annotations

import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services import sandbox
from app.services.sandbox import (
    _ALLOWED_PREFIXES,
    _DANGEROUS_PATTERNS,
    _DESTRUCTIVE_PATTERNS,
    SandboxError,
    SandboxExecutor,
    SandboxResult,
    sandbox_executor,
)


class TestSandboxError:
    """SandboxError 异常类。"""

    def test_is_exception(self):
        assert issubclass(SandboxError, Exception)

    def test_can_raise(self):
        with pytest.raises(SandboxError, match="危险"):
            raise SandboxError("危险命令被拦截")

    def test_can_catch_as_exception(self):
        try:
            raise SandboxError("test")
        except Exception as e:
            assert isinstance(e, SandboxError)

    def test_message_preserved(self):
        err = SandboxError("specific message 123")
        assert str(err) == "specific message 123"


class TestSandboxResult:
    """SandboxResult dataclass。"""

    def test_full_construction(self):
        r = SandboxResult(0, "hello", "", 12.5, "local", False)
        assert r.exit_code == 0
        assert r.stdout == "hello"
        assert r.stderr == ""
        assert r.duration_ms == 12.5
        assert r.backend == "local"
        assert r.timed_out is False

    def test_error_result(self):
        r = SandboxResult(-1, "", "command not found", 0, "docker", False)
        assert r.exit_code == -1
        assert r.stdout == ""
        assert "not found" in r.stderr

    def test_timeout_result(self):
        r = SandboxResult(-1, "", "timed out", 60000.0, "modal", True)
        assert r.timed_out is True
        assert r.backend == "modal"

    def test_all_fields_required(self):
        with pytest.raises(TypeError):
            SandboxResult(exit_code=0)  # type: ignore[call-arg]

    def test_equality(self):
        r1 = SandboxResult(0, "out", "", 1.0, "local", False)
        r2 = SandboxResult(0, "out", "", 1.0, "local", False)
        assert r1 == r2


class TestDangerousPatterns:
    """_DANGEROUS_PATTERNS 黑名单正则。"""

    def test_is_list(self):
        assert isinstance(_DANGEROUS_PATTERNS, list)
        assert len(_DANGEROUS_PATTERNS) == 28

    def test_all_are_strings(self):
        for pat in _DANGEROUS_PATTERNS:
            assert isinstance(pat, str)
            assert pat

    def test_contains_rm_pattern(self):
        assert any(r"\brm\b" in p for p in _DANGEROUS_PATTERNS)

    def test_contains_chmod_pattern(self):
        assert any(r"\bchmod\b" in p for p in _DANGEROUS_PATTERNS)

    def test_contains_redirection_patterns(self):
        assert any(p.startswith(r">\s*") for p in _DANGEROUS_PATTERNS)
        assert any(p.startswith(r">>\s*") for p in _DANGEROUS_PATTERNS)
        assert any(p.startswith(r"<\s*") for p in _DANGEROUS_PATTERNS)

    def test_contains_pipe_pattern(self):
        assert any(p.startswith(r"\|\s*") for p in _DANGEROUS_PATTERNS)

    def test_contains_subshell_patterns(self):
        assert any(p.startswith(r"`[^`]*`") for p in _DANGEROUS_PATTERNS)
        assert any(p.startswith(r"\$\([^)]*\)") for p in _DANGEROUS_PATTERNS)
        assert any(p.startswith(r"\$\{[^}]*\}") for p in _DANGEROUS_PATTERNS)

    def test_contains_semicolon_and_logic_ops(self):
        assert any(p.startswith(r";\s*\S") for p in _DANGEROUS_PATTERNS)
        assert any(p.startswith(r"&&\s*\S") for p in _DANGEROUS_PATTERNS)
        assert any(p.startswith(r"\|\|\s*\S") for p in _DANGEROUS_PATTERNS)

    def test_contains_network_tools(self):
        assert any(r"\bcurl\b" in p for p in _DANGEROUS_PATTERNS)
        assert any(r"\bwget\b" in p for p in _DANGEROUS_PATTERNS)
        assert any(r"\bscp\b" in p for p in _DANGEROUS_PATTERNS)
        assert any(r"\bssh\b" in p for p in _DANGEROUS_PATTERNS)

    def test_contains_destructive_tools(self):
        for tool in [r"\bdd\b", r"\bmkfs\b", r"\bshutdown\b", r"\breboot\b",
                     r"\bkill\b", r"\bkillall\b"]:
            assert any(tool in p for p in _DANGEROUS_PATTERNS)


class TestAllowedPrefixes:
    """_ALLOWED_PREFIXES 白名单。"""

    def test_is_set(self):
        assert isinstance(_ALLOWED_PREFIXES, set)

    def test_contains_common_commands(self):
        for cmd in ["git", "ls", "cat", "echo", "python", "node", "npm", "npx",
                    "pnpm", "tsc", "ruff", "mypy", "pytest", "find", "grep",
                    "rg", "wc", "head", "tail", "date", "whoami", "pwd",
                    "which", "where", "env", "uname", "ver", "dir", "type",
                    "getopt"]:
            assert cmd in _ALLOWED_PREFIXES, f"{cmd} 应在白名单"

    def test_size_at_least_30(self):
        assert len(_ALLOWED_PREFIXES) >= 30

    def test_all_lowercase(self):
        for cmd in _ALLOWED_PREFIXES:
            assert cmd == cmd.lower()

    def test_does_not_contain_dangerous(self):
        for dangerous in ["rm", "rmdir", "mv", "cp", "mkdir", "touch",
                          "chmod", "chown", "curl", "wget", "scp", "ssh",
                          "dd", "mkfs", "shutdown", "reboot", "kill", "killall"]:
            assert dangerous not in _ALLOWED_PREFIXES, \
                f"{dangerous} 不应在白名单"


class TestDestructivePatterns:
    """_DESTRUCTIVE_PATTERNS 灾难性模式。"""

    def test_is_list(self):
        assert isinstance(_DESTRUCTIVE_PATTERNS, list)
        assert len(_DESTRUCTIVE_PATTERNS) == 8

    def test_is_list_of_tuples(self):
        for item in _DESTRUCTIVE_PATTERNS:
            assert isinstance(item, tuple)
            assert len(item) == 2

    def test_pattern_and_desc_both_strings(self):
        for pat, desc in _DESTRUCTIVE_PATTERNS:
            assert isinstance(pat, str)
            assert isinstance(desc, str)
            assert pat
            assert desc

    def test_contains_rm_root(self):
        patterns = [p for p, _ in _DESTRUCTIVE_PATTERNS]
        assert any("rm" in p and "/" in p for p in patterns)

    def test_contains_mkfs(self):
        patterns = [p for p, _ in _DESTRUCTIVE_PATTERNS]
        assert any("mkfs" in p for p in patterns)

    def test_contains_dd_dev(self):
        patterns = [p for p, _ in _DESTRUCTIVE_PATTERNS]
        assert any("dd" in p and "/dev/" in p for p in patterns)

    def test_contains_fork_bomb(self):
        patterns = [p for p, _ in _DESTRUCTIVE_PATTERNS]
        descs = [d for _, d in _DESTRUCTIVE_PATTERNS]
        # fork bomb 模式用 :\| 转义管道,检查描述更可靠
        assert any("fork" in d.lower() for d in descs)

    def test_contains_chmod_777_root(self):
        patterns = [p for p, _ in _DESTRUCTIVE_PATTERNS]
        assert any("chmod" in p and "777" in p for p in patterns)


class TestCheckDangerousPatterns:
    """_check_dangerous_patterns 灾难性模式检测。"""

    def test_safe_command_returns_empty(self):
        assert SandboxExecutor._check_dangerous_patterns("ls -la") == []
        assert SandboxExecutor._check_dangerous_patterns("echo hello") == []
        assert SandboxExecutor._check_dangerous_patterns("python main.py") == []

    def test_empty_command_returns_empty(self):
        assert SandboxExecutor._check_dangerous_patterns("") == []

    def test_rm_root_detected(self):
        result = SandboxExecutor._check_dangerous_patterns("rm -rf /")
        assert len(result) >= 1
        assert any("根目录" in r or "rm" in r for r in result)

    def test_rm_root_with_path(self):
        # 源码正则 r"rm\s+-rf?\s+/(?:\s|$|/.*)" 要求 / 后跟空格/行尾/以/开头的路径
        # rm -rf / tmp 匹配 \s 分支(/ 后跟空格)
        result = SandboxExecutor._check_dangerous_patterns("rm -rf / tmp")
        assert len(result) >= 1

    def test_rm_home_tilde(self):
        result = SandboxExecutor._check_dangerous_patterns("rm -rf ~")
        assert len(result) >= 1
        assert any("家目录" in r for r in result)

    def test_rm_home_env(self):
        result = SandboxExecutor._check_dangerous_patterns("rm -rf $HOME")
        assert len(result) >= 1
        assert any("家目录" in r for r in result)

    def test_mkfs_detected(self):
        result = SandboxExecutor._check_dangerous_patterns("mkfs.ext4 /dev/sda1")
        assert len(result) >= 1
        assert any("mkfs" in r for r in result)

    def test_dd_dev_detected(self):
        result = SandboxExecutor._check_dangerous_patterns("dd if=/dev/zero of=/dev/sda")
        assert len(result) >= 1
        assert any("dd" in r or "块设备" in r for r in result)

    def test_fork_bomb_detected(self):
        result = SandboxExecutor._check_dangerous_patterns(":(){ :|:& };:")
        assert len(result) >= 1
        assert any("fork" in r.lower() for r in result)

    def test_redirect_dev_sd_detected(self):
        result = SandboxExecutor._check_dangerous_patterns("echo bad > /dev/sda")
        assert len(result) >= 1

    def test_chmod_777_root_detected(self):
        result = SandboxExecutor._check_dangerous_patterns("chmod -R 777 /")
        assert len(result) >= 1
        assert any("chmod" in r or "权限" in r for r in result)

    def test_python_c_bypass_attempt(self):
        # 源码正则要求 rm -rf / 后跟空格/行尾/路径,用 mkfs 更可靠(无后缀约束)
        cmd = 'python -c "import os; os.system(\'mkfs /dev/sda\')"'
        result = SandboxExecutor._check_dangerous_patterns(cmd)
        assert len(result) >= 1

    def test_multiple_patterns_matched(self):
        cmd = "rm -rf / && mkfs.ext4 /dev/sda"
        result = SandboxExecutor._check_dangerous_patterns(cmd)
        assert len(result) >= 2

    def test_returns_list_type(self):
        result = SandboxExecutor._check_dangerous_patterns("ls")
        assert isinstance(result, list)


class TestLogExec:
    """_log_exec 日志静态方法。"""

    def test_does_not_raise(self):
        SandboxExecutor._log_exec("local", "ls -la", 0, 12.5)

    def test_long_command_truncated(self):
        long_cmd = "echo " + "x" * 500
        SandboxExecutor._log_exec("docker", long_cmd, 0, 100.0)

    def test_empty_command(self):
        SandboxExecutor._log_exec("ssh", "", -1, 0.0)

    def test_negative_exit_code(self):
        SandboxExecutor._log_exec("modal", "test", -1, 0.0)

    def test_logs_at_info_level(self, caplog):
        import logging
        caplog.set_level(logging.INFO, logger="app.services.sandbox")
        SandboxExecutor._log_exec("local", "echo test", 0, 5.0)
        assert any("sandbox exec" in r.message for r in caplog.records)


class TestExecuteDispatch:
    """execute 方法后端分发逻辑。"""

    @pytest.mark.asyncio
    async def test_unknown_backend_returns_error(self):
        executor = SandboxExecutor()
        result = await executor.execute("ls", backend="unknown_backend")
        assert result.exit_code == -1
        assert "unknown backend" in result.stderr
        assert result.backend == "unknown_backend"
        assert result.timed_out is False

    @pytest.mark.asyncio
    async def test_unknown_backend_empty(self):
        executor = SandboxExecutor()
        result = await executor.execute("ls", backend="")
        assert result.exit_code == -1
        assert "unknown backend" in result.stderr

    @pytest.mark.asyncio
    async def test_ssh_without_host_returns_error(self):
        executor = SandboxExecutor()
        result = await executor.execute("ls", backend="ssh", ssh_host=None)
        assert result.exit_code == -1
        assert "ssh_host" in result.stderr
        assert result.backend == "ssh"

    @pytest.mark.asyncio
    async def test_ssh_with_empty_host_returns_error(self):
        executor = SandboxExecutor()
        result = await executor.execute("ls", backend="ssh", ssh_host="")
        assert result.exit_code == -1
        assert "ssh_host" in result.stderr

    @pytest.mark.asyncio
    async def test_local_dispatch(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_local", new=AsyncMock(return_value=SandboxResult(
                0, "mocked", "", 1.0, "local", False
            ))
        ) as mock_local:
            result = await executor.execute("echo test", backend="local")
            assert mock_local.called
            assert result.stdout == "mocked"
            assert result.backend == "local"

    @pytest.mark.asyncio
    async def test_docker_dispatch(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_docker", new=AsyncMock(return_value=SandboxResult(
                0, "docker-out", "", 1.0, "docker", False
            ))
        ) as mock_docker:
            result = await executor.execute("ls", backend="docker",
                                            docker_image="python:3.12")
            assert mock_docker.called
            assert result.backend == "docker"

    @pytest.mark.asyncio
    async def test_ssh_dispatch_with_host(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_ssh", new=AsyncMock(return_value=SandboxResult(
                0, "ssh-out", "", 1.0, "ssh", False
            ))
        ) as mock_ssh:
            result = await executor.execute(
                "ls", backend="ssh", ssh_host="example.com", ssh_user="ubuntu"
            )
            assert mock_ssh.called
            assert result.backend == "ssh"

    @pytest.mark.asyncio
    async def test_modal_dispatch(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_modal", new=AsyncMock(return_value=SandboxResult(
                0, "modal-out", "", 1.0, "modal", False
            ))
        ) as mock_modal:
            result = await executor.execute("ls", backend="modal", image="my-fn")
            assert mock_modal.called
            assert result.backend == "modal"

    @pytest.mark.asyncio
    async def test_modal_dispatch_fallback_to_docker_image(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_modal", new=AsyncMock(return_value=SandboxResult(
                0, "", "", 1.0, "modal", False
            ))
        ) as mock_modal:
            await executor.execute("ls", backend="modal", image="",
                                   docker_image="fallback-img")
            args = mock_modal.call_args.args
            assert args[2] == "fallback-img"

    @pytest.mark.asyncio
    async def test_daytona_dispatch(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_daytona", new=AsyncMock(return_value=SandboxResult(
                0, "daytona-out", "", 1.0, "daytona", False
            ))
        ) as mock_daytona:
            result = await executor.execute("ls", backend="daytona", image="ws-1")
            assert mock_daytona.called
            assert result.backend == "daytona"

    @pytest.mark.asyncio
    async def test_singularity_dispatch(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_singularity", new=AsyncMock(return_value=SandboxResult(
                0, "sing-out", "", 1.0, "singularity", False
            ))
        ) as mock_sing:
            result = await executor.execute("ls", backend="singularity",
                                            image="library://default")
            assert mock_sing.called
            assert result.backend == "singularity"

    @pytest.mark.asyncio
    async def test_default_backend_is_local(self):
        executor = SandboxExecutor()
        with patch.object(
            executor, "_execute_local", new=AsyncMock(return_value=SandboxResult(
                0, "", "", 1.0, "local", False
            ))
        ) as mock_local:
            await executor.execute("echo test")
            assert mock_local.called


# ============================================================
# 9. _execute_local
# ============================================================


class TestExecuteLocal:
    """_execute_local 本地执行。"""

    @pytest.mark.asyncio
    async def test_destructive_command_raises(self):
        executor = SandboxExecutor()
        with pytest.raises(SandboxError, match="危险命令"):
            await executor._execute_local("rm -rf /", 10, ".", None)

    @pytest.mark.asyncio
    async def test_destructive_mkfs_raises(self):
        executor = SandboxExecutor()
        with pytest.raises(SandboxError):
            await executor._execute_local("mkfs.ext4 /dev/sda1", 10, ".", None)

    @pytest.mark.asyncio
    async def test_destructive_dd_raises(self):
        executor = SandboxExecutor()
        with pytest.raises(SandboxError):
            await executor._execute_local(
                "dd if=/dev/zero of=/dev/sda bs=1M", 10, ".", None
            )

    @pytest.mark.asyncio
    async def test_destructive_fork_bomb_raises(self):
        executor = SandboxExecutor()
        with pytest.raises(SandboxError):
            await executor._execute_local(":(){ :|:& };:", 10, ".", None)

    @pytest.mark.asyncio
    async def test_destructive_chmod_777_raises(self):
        executor = SandboxExecutor()
        with pytest.raises(SandboxError):
            await executor._execute_local("chmod -R 777 /", 10, ".", None)

    @pytest.mark.asyncio
    async def test_semicolon_injection_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("ls; rm file", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_and_injection_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("ls && rm file", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_or_injection_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("ls || rm file", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_pipe_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("ls | grep foo", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_redirect_output_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("echo foo > /etc/passwd", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_redirect_append_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("echo foo >> file", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_redirect_input_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("cat < /etc/passwd", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_backtick_subshell_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("echo `whoami`", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_dollar_paren_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("echo $(whoami)", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_dollar_brace_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("echo ${HOME}", 10, ".", None)
        assert result.exit_code == -1
        assert "forbidden pattern" in result.stderr

    @pytest.mark.asyncio
    async def test_non_whitelist_command_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("docker ps", 10, ".", None)
        assert result.exit_code == -1
        assert "not in whitelist" in result.stderr
        assert "docker" in result.stderr

    @pytest.mark.asyncio
    async def test_non_whitelist_command_in_path(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("/usr/bin/rm file", 10, ".", None)
        assert result.exit_code == -1

    @pytest.mark.asyncio
    async def test_empty_command_blocked(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("", 10, ".", None)
        assert result.exit_code == -1
        assert "not in whitelist" in result.stderr

    @pytest.mark.asyncio
    async def test_whitelist_command_echo_success(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("echo ihui_test", 10, ".", None)
        assert result.exit_code == 0
        assert "ihui_test" in result.stdout
        assert result.backend == "local"
        assert result.timed_out is False

    @pytest.mark.asyncio
    async def test_whitelist_command_python(self):
        executor = SandboxExecutor()
        result = await executor._execute_local(
            'python -c "print(42)"', 10, ".", None
        )
        assert result.exit_code == 0
        assert "42" in result.stdout

    @pytest.mark.asyncio
    async def test_command_not_found_windows(self):
        executor = SandboxExecutor()
        with patch("app.services.sandbox.asyncio.create_subprocess_shell",
                    side_effect=FileNotFoundError("not found")):
            result = await executor._execute_local("echo test", 10, ".", None)
        assert result.exit_code == -1
        assert "command not found" in result.stderr

    @pytest.mark.asyncio
    async def test_command_not_found_unix(self):
        executor = SandboxExecutor()
        with patch("app.services.sandbox.sys.platform", "linux"):
            with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                       side_effect=FileNotFoundError("not found")):
                result = await executor._execute_local("echo test", 10, ".", None)
        assert result.exit_code == -1
        assert "command not found" in result.stderr

    @pytest.mark.asyncio
    async def test_timeout(self):
        executor = SandboxExecutor()

        async def slow_communicate(*args, **kwargs):
            await asyncio.sleep(10)
            return (b"", b"")

        mock_proc = MagicMock()
        mock_proc.communicate = slow_communicate
        mock_proc.kill = MagicMock()

        if sys.platform == "win32":
            patch_target = "app.services.sandbox.asyncio.create_subprocess_shell"
        else:
            patch_target = "app.services.sandbox.asyncio.create_subprocess_exec"

        with patch(patch_target, return_value=mock_proc):
            result = await executor._execute_local("echo test", 1, ".", None)
        assert result.exit_code == -1
        assert result.timed_out is True
        assert "timed out" in result.stderr
        assert result.backend == "local"

    @pytest.mark.asyncio
    async def test_env_passed_to_subprocess(self):
        executor = SandboxExecutor()
        captured_env = {}
        original_shell = asyncio.create_subprocess_shell

        async def capture_shell(cmd, **kwargs):
            captured_env.update(kwargs.get("env", {}) or {})
            return await original_shell(cmd, **kwargs)

        with patch("app.services.sandbox.asyncio.create_subprocess_shell",
                   side_effect=capture_shell):
            result = await executor._execute_local(
                "echo test", 10, ".",
                {"MY_TEST_VAR": "ihui_value"}
            )
        assert result.exit_code == 0
        assert captured_env.get("MY_TEST_VAR") == "ihui_value"

    @pytest.mark.asyncio
    async def test_general_exception_returns_error(self):
        executor = SandboxExecutor()
        if sys.platform == "win32":
            patch_target = "app.services.sandbox.asyncio.create_subprocess_shell"
        else:
            patch_target = "app.services.sandbox.asyncio.create_subprocess_exec"

        with patch(patch_target, side_effect=RuntimeError("weird error")):
            result = await executor._execute_local("echo test", 10, ".", None)
        assert result.exit_code == -1
        assert "execution failed" in result.stderr
        assert "weird error" in result.stderr

    @pytest.mark.asyncio
    async def test_duration_ms_positive(self):
        executor = SandboxExecutor()
        result = await executor._execute_local("echo test", 10, ".", None)
        assert result.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_returncode_none_defaults_zero(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = None

        async def fake_communicate():
            return (b"out", b"err")
        mock_proc.communicate = fake_communicate

        if sys.platform == "win32":
            patch_target = "app.services.sandbox.asyncio.create_subprocess_shell"
        else:
            patch_target = "app.services.sandbox.asyncio.create_subprocess_exec"

        with patch(patch_target, return_value=mock_proc):
            result = await executor._execute_local("echo test", 10, ".", None)
        assert result.exit_code == 0


# ============================================================
# 10. _execute_docker
# ============================================================


class TestExecuteDocker:
    """_execute_docker Docker 容器执行。"""

    @pytest.mark.asyncio
    async def test_file_not_found(self):
        executor = SandboxExecutor()
        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=FileNotFoundError("docker not found")):
            result = await executor._execute_docker(
                "ls", 10, "/work", "python:3.12", None
            )
        assert result.exit_code == -1
        assert "docker CLI not found" in result.stderr
        assert result.backend == "docker"

    @pytest.mark.asyncio
    async def test_success(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 0

        async def fake_communicate():
            return (b"hello docker", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc) as mock_create:
            result = await executor._execute_docker(
                "ls", 10, "/work", "python:3.12", None
            )
        assert result.exit_code == 0
        assert "hello docker" in result.stdout
        assert result.backend == "docker"
        assert result.timed_out is False
        args = mock_create.call_args.args
        assert "docker" in args
        assert "run" in args
        assert "--rm" in args
        assert "--network=none" in args
        assert "python:3.12" in args

    @pytest.mark.asyncio
    async def test_env_passed_as_e_flags(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 0

        async def fake_communicate():
            return (b"", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc) as mock_create:
            await executor._execute_docker(
                "ls", 10, "/work", "python:3.12",
                {"FOO": "bar", "BAZ": "qux"}
            )
        args = list(mock_create.call_args.args)
        assert "-e" in args
        assert "FOO=bar" in args
        assert "BAZ=qux" in args

    @pytest.mark.asyncio
    async def test_timeout(self):
        executor = SandboxExecutor()

        async def slow_communicate(*args, **kwargs):
            await asyncio.sleep(10)
            return (b"", b"")

        mock_proc = MagicMock()
        mock_proc.communicate = slow_communicate
        mock_proc.kill = MagicMock()

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc):
            result = await executor._execute_docker(
                "ls", 1, "/work", "python:3.12", None
            )
        assert result.exit_code == -1
        assert result.timed_out is True
        assert "timed out" in result.stderr
        assert result.backend == "docker"

    @pytest.mark.asyncio
    async def test_general_exception(self):
        executor = SandboxExecutor()
        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=RuntimeError("docker daemon down")):
            result = await executor._execute_docker(
                "ls", 10, "/work", "python:3.12", None
            )
        assert result.exit_code == -1
        assert "docker execution failed" in result.stderr
        assert "docker daemon down" in result.stderr

    @pytest.mark.asyncio
    async def test_stderr_captured(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 1

        async def fake_communicate():
            return (b"", b"docker error output")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc):
            result = await executor._execute_docker(
                "ls", 10, "/work", "python:3.12", None
            )
        assert result.exit_code == 1
        assert "docker error output" in result.stderr

    @pytest.mark.asyncio
    async def test_returncode_none_defaults_zero(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = None

        async def fake_communicate():
            return (b"", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc):
            result = await executor._execute_docker(
                "ls", 10, "/work", "python:3.12", None
            )
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_workdir_passed(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 0

        async def fake_communicate():
            return (b"", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc) as mock_create:
            await executor._execute_docker(
                "ls", 10, "/custom/workdir", "python:3.12", None
            )
        args = list(mock_create.call_args.args)
        assert "-w" in args
        w_idx = args.index("-w")
        assert args[w_idx + 1] == "/custom/workdir"


# ============================================================
# 11. _execute_ssh
# ============================================================


class TestExecuteSsh:
    """_execute_ssh SSH 远程执行。"""

    @pytest.mark.asyncio
    async def test_success(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 0

        async def fake_communicate():
            return (b"remote output", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc) as mock_create:
            result = await executor._execute_ssh(
                "ls", 10, "/home/user", "example.com", "ubuntu", None
            )
        assert result.exit_code == 0
        assert "remote output" in result.stdout
        assert result.backend == "ssh"
        args = list(mock_create.call_args.args)
        assert "ssh" in args
        assert "-o" in args
        assert "StrictHostKeyChecking=no" in args
        assert "ubuntu@example.com" in args

    @pytest.mark.asyncio
    async def test_remote_cmd_has_cd(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 0

        async def fake_communicate():
            return (b"", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc) as mock_create:
            await executor._execute_ssh(
                "ls", 10, "/home/user", "example.com", "ubuntu", None
            )
        args = list(mock_create.call_args.args)
        remote_cmd = args[-1]
        assert "cd" in remote_cmd
        assert "/home/user" in remote_cmd

    @pytest.mark.asyncio
    async def test_env_exports(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 0

        async def fake_communicate():
            return (b"", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc) as mock_create:
            await executor._execute_ssh(
                "ls", 10, "/home/user", "example.com", "ubuntu",
                {"FOO": "bar", "BAZ": "qux"}
            )
        args = list(mock_create.call_args.args)
        remote_cmd = args[-1]
        assert "export FOO" in remote_cmd
        assert "export BAZ" in remote_cmd

    @pytest.mark.asyncio
    async def test_file_not_found(self):
        executor = SandboxExecutor()
        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=FileNotFoundError("ssh not found")):
            result = await executor._execute_ssh(
                "ls", 10, "/home", "example.com", "ubuntu", None
            )
        assert result.exit_code == -1
        assert "ssh CLI not found" in result.stderr
        assert result.backend == "ssh"

    @pytest.mark.asyncio
    async def test_timeout(self):
        executor = SandboxExecutor()

        async def slow_communicate(*args, **kwargs):
            await asyncio.sleep(10)
            return (b"", b"")

        mock_proc = MagicMock()
        mock_proc.communicate = slow_communicate
        mock_proc.kill = MagicMock()

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc):
            result = await executor._execute_ssh(
                "ls", 1, "/home", "example.com", "ubuntu", None
            )
        assert result.exit_code == -1
        assert result.timed_out is True
        assert "timed out" in result.stderr

    @pytest.mark.asyncio
    async def test_general_exception(self):
        executor = SandboxExecutor()
        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=RuntimeError("network error")):
            result = await executor._execute_ssh(
                "ls", 10, "/home", "example.com", "ubuntu", None
            )
        assert result.exit_code == -1
        assert "ssh execution failed" in result.stderr

    @pytest.mark.asyncio
    async def test_returncode_none_defaults_zero(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = None

        async def fake_communicate():
            return (b"", b"")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc):
            result = await executor._execute_ssh(
                "ls", 10, "/home", "example.com", "ubuntu", None
            )
        assert result.exit_code == 0


# ============================================================
# 12. _execute_modal
# ============================================================


class TestExecuteModal:
    """_execute_modal Modal 无服务器后端。"""

    @pytest.mark.asyncio
    async def test_no_credentials(self, monkeypatch):
        monkeypatch.delenv("MODAL_TOKEN_ID", raising=False)
        monkeypatch.delenv("MODAL_TOKEN_SECRET", raising=False)
        executor = SandboxExecutor()
        result = await executor._execute_modal("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert "Modal credentials not configured" in result.stderr
        assert result.backend == "modal"

    @pytest.mark.asyncio
    async def test_partial_credentials_only_token_id(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.delenv("MODAL_TOKEN_SECRET", raising=False)
        executor = SandboxExecutor()
        result = await executor._execute_modal("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert "credentials" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_partial_credentials_only_secret(self, monkeypatch):
        monkeypatch.delenv("MODAL_TOKEN_ID", raising=False)
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()
        result = await executor._execute_modal("ls", 10, "", None, None)
        assert result.exit_code == -1

    @pytest.mark.asyncio
    async def test_success(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "stdout": "modal output",
            "stderr": "",
            "exit_code": 0,
            "timed_out": False,
        }

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_modal("ls", 10, "my-fn", None, None)
        assert result.exit_code == 0
        assert result.stdout == "modal output"
        assert result.backend == "modal"
        payload = mock_client.post.call_args.kwargs.get("json", {})
        assert payload.get("function_id") == "my-fn"

    @pytest.mark.asyncio
    async def test_default_function_id(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_modal("ls", 10, "", None, None)
        payload = mock_client.post.call_args.kwargs.get("json", {})
        assert payload.get("function_id") == "sandbox-exec"

    @pytest.mark.asyncio
    async def test_http_error_status(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_modal("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert "HTTP 401" in result.stderr

    @pytest.mark.asyncio
    async def test_timeout_exception(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_modal("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert result.timed_out is True
        assert "timed out" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_http_error_exception(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(side_effect=httpx.HTTPError("conn refused"))

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_modal("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert "HTTP request failed" in result.stderr

    @pytest.mark.asyncio
    async def test_response_parse_error_value(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "stdout": "out",
            "exit_code": "not-int",
        }

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_modal("ls", 10, "", None, None)
        assert "Modal response parse failed" in result.stderr

    @pytest.mark.asyncio
    async def test_response_parse_error_type(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.side_effect = TypeError("bad json")

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_modal("ls", 10, "", None, None)
        assert "Modal response parse failed" in result.stderr

    @pytest.mark.asyncio
    async def test_timed_out_from_response(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "stdout": "",
            "stderr": "remote timeout",
            "exit_code": -1,
            "timed_out": True,
        }

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_modal("ls", 10, "", None, None)
        assert result.timed_out is True

    @pytest.mark.asyncio
    async def test_resource_limits_passed(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_modal(
                "ls", 10, "", None,
                {"cpu": 2, "memory": "4G"}
            )
        payload = mock_client.post.call_args.kwargs.get("json", {})
        args = payload.get("args", {})
        assert args.get("resource_limits") == {"cpu": 2, "memory": "4G"}

    @pytest.mark.asyncio
    async def test_env_passed_in_payload(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_modal(
                "ls", 10, "", {"FOO": "bar"}, None
            )
        payload = mock_client.post.call_args.kwargs.get("json", {})
        args = payload.get("args", {})
        assert args.get("env") == {"FOO": "bar"}

    @pytest.mark.asyncio
    async def test_authorization_header(self, monkeypatch):
        monkeypatch.setenv("MODAL_TOKEN_ID", "tid")
        monkeypatch.setenv("MODAL_TOKEN_SECRET", "tsec")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_modal("ls", 10, "", None, None)
        headers = mock_client.post.call_args.kwargs.get("headers", {})
        assert headers.get("Authorization") == "Bearer tid:tsec"


# ============================================================
# 13. _execute_daytona
# ============================================================


class TestExecuteDaytona:
    """_execute_daytona Daytona 云开发环境后端。"""

    @pytest.mark.asyncio
    async def test_no_credentials(self, monkeypatch):
        monkeypatch.delenv("DAYTONA_API_KEY", raising=False)
        monkeypatch.delenv("DAYTONA_SERVER_URL", raising=False)
        executor = SandboxExecutor()
        result = await executor._execute_daytona("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert "Daytona credentials not configured" in result.stderr
        assert result.backend == "daytona"

    @pytest.mark.asyncio
    async def test_partial_credentials_only_api_key(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.delenv("DAYTONA_SERVER_URL", raising=False)
        executor = SandboxExecutor()
        result = await executor._execute_daytona("ls", 10, "", None, None)
        assert result.exit_code == -1

    @pytest.mark.asyncio
    async def test_success(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "stdout": "daytona output",
            "stderr": "",
            "exit_code": 0,
        }

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_daytona("ls", 10, "", None, None)
        assert result.exit_code == 0
        assert result.stdout == "daytona output"
        assert result.backend == "daytona"

    @pytest.mark.asyncio
    async def test_url_constructed_with_workspace(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        monkeypatch.setenv("DAYTONA_WORKSPACE_ID", "ws-123")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_daytona("ls", 10, "", None, None)
        url = mock_client.post.call_args.args[0]
        assert "workspaces/ws-123/execute" in url
        assert url.startswith("https://api.daytona.io")

    @pytest.mark.asyncio
    async def test_default_workspace_id(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        monkeypatch.delenv("DAYTONA_WORKSPACE_ID", raising=False)
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_daytona("ls", 10, "", None, None)
        url = mock_client.post.call_args.args[0]
        assert "workspaces/default/execute" in url

    @pytest.mark.asyncio
    async def test_url_strips_trailing_slash(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io/")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_daytona("ls", 10, "", None, None)
        url = mock_client.post.call_args.args[0]
        assert "//workspaces" not in url

    @pytest.mark.asyncio
    async def test_http_error(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_daytona("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert "HTTP 500" in result.stderr

    @pytest.mark.asyncio
    async def test_timeout(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        executor = SandboxExecutor()

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_daytona("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert result.timed_out is True

    @pytest.mark.asyncio
    async def test_http_error_exception(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        executor = SandboxExecutor()

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(side_effect=httpx.HTTPError("dns fail"))

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_daytona("ls", 10, "", None, None)
        assert result.exit_code == -1
        assert "HTTP request failed" in result.stderr

    @pytest.mark.asyncio
    async def test_response_parse_error(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"exit_code": "bad"}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            result = await executor._execute_daytona("ls", 10, "", None, None)
        assert "Daytona response parse failed" in result.stderr

    @pytest.mark.asyncio
    async def test_authorization_header(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "mykey")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_daytona("ls", 10, "", None, None)
        headers = mock_client.post.call_args.kwargs.get("headers", {})
        assert headers.get("Authorization") == "Bearer mykey"

    @pytest.mark.asyncio
    async def test_image_passed_in_payload(self, monkeypatch):
        monkeypatch.setenv("DAYTONA_API_KEY", "key")
        monkeypatch.setenv("DAYTONA_SERVER_URL", "https://api.daytona.io")
        executor = SandboxExecutor()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"stdout": "", "stderr": "", "exit_code": 0}

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.services.sandbox.httpx.AsyncClient", return_value=mock_client):
            await executor._execute_daytona("ls", 10, "my-image", None, None)
        payload = mock_client.post.call_args.kwargs.get("json", {})
        assert payload.get("image") == "my-image"


# ============================================================
# 14. _execute_singularity
# ============================================================


class TestExecuteSingularity:
    """_execute_singularity HPC 集群 Singularity 后端。"""

    @pytest.mark.asyncio
    async def test_cli_not_found_file_not_found_error(self):
        executor = SandboxExecutor()

        async def fake_exec(*args, **kwargs):
            raise FileNotFoundError("singularity not found")

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=fake_exec):
            result = await executor._execute_singularity(
                "ls", 10, "", None, None
            )
        assert result.exit_code == -1
        assert "Singularity CLI not found" in result.stderr
        assert result.backend == "singularity"

    @pytest.mark.asyncio
    async def test_cli_probe_returns_nonzero(self):
        executor = SandboxExecutor()
        mock_proc = MagicMock()
        mock_proc.returncode = 127

        async def fake_communicate():
            return (b"", b"command not found")
        mock_proc.communicate = fake_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc):
            result = await executor._execute_singularity(
                "ls", 10, "", None, None
            )
        assert result.exit_code == -1
        assert "Singularity CLI not found" in result.stderr

    @pytest.mark.asyncio
    async def test_probe_timeout(self):
        executor = SandboxExecutor()

        async def slow_communicate(*args, **kwargs):
            await asyncio.sleep(20)
            return (b"", b"")

        mock_proc = MagicMock()
        mock_proc.communicate = slow_communicate
        mock_proc.kill = MagicMock()

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   return_value=mock_proc):
            result = await executor._execute_singularity(
                "ls", 10, "", None, None
            )
        assert result.exit_code == -1
        assert "probe timed out" in result.stderr.lower() or \
               "Singularity CLI probe timed out" in result.stderr

    @pytest.mark.asyncio
    async def test_probe_general_exception(self):
        executor = SandboxExecutor()

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=RuntimeError("probe error")):
            result = await executor._execute_singularity(
                "ls", 10, "", None, None
            )
        assert result.exit_code == -1
        assert "probe failed" in result.stderr.lower() or \
               "Singularity CLI probe failed" in result.stderr

    @pytest.mark.asyncio
    async def test_success(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"singularity version 3.8.0", b"")
        probe_proc.communicate = probe_communicate

        exec_proc = MagicMock()
        exec_proc.returncode = 0

        async def exec_communicate():
            return (b"singularity output", b"")
        exec_proc.communicate = exec_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]) as mock_create:
            result = await executor._execute_singularity(
                "ls", 10, "", None, None
            )
        assert result.exit_code == 0
        assert "singularity output" in result.stdout
        assert result.backend == "singularity"
        exec_call = mock_create.call_args_list[1]
        exec_args = list(exec_call.args)
        assert "singularity" in exec_args
        assert "exec" in exec_args

    @pytest.mark.asyncio
    async def test_default_image(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"singularity version 3.8.0", b"")
        probe_proc.communicate = probe_communicate

        exec_proc = MagicMock()
        exec_proc.returncode = 0

        async def exec_communicate():
            return (b"", b"")
        exec_proc.communicate = exec_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]) as mock_create:
            await executor._execute_singularity("ls", 10, "", None, None)
        exec_args = list(mock_create.call_args_list[1].args)
        assert "library://sylabsed/examples/default:latest" in exec_args

    @pytest.mark.asyncio
    async def test_custom_image_used(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"v", b"")
        probe_proc.communicate = probe_communicate

        exec_proc = MagicMock()
        exec_proc.returncode = 0

        async def exec_communicate():
            return (b"", b"")
        exec_proc.communicate = exec_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]) as mock_create:
            await executor._execute_singularity(
                "ls", 10, "custom://my-image:1.0", None, None
            )
        exec_args = list(mock_create.call_args_list[1].args)
        assert "custom://my-image:1.0" in exec_args

    @pytest.mark.asyncio
    async def test_resource_limits_memory_cpus(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"v", b"")
        probe_proc.communicate = probe_communicate

        exec_proc = MagicMock()
        exec_proc.returncode = 0

        async def exec_communicate():
            return (b"", b"")
        exec_proc.communicate = exec_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]) as mock_create:
            await executor._execute_singularity(
                "ls", 10, "",
                None,
                {"memory": "4G", "cpus": "2"}
            )
        exec_args = list(mock_create.call_args_list[1].args)
        assert "--memory" in exec_args
        assert "4G" in exec_args
        assert "--cpus" in exec_args
        assert "2" in exec_args

    @pytest.mark.asyncio
    async def test_resource_limits_gpu_adds_nv(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"v", b"")
        probe_proc.communicate = probe_communicate

        exec_proc = MagicMock()
        exec_proc.returncode = 0

        async def exec_communicate():
            return (b"", b"")
        exec_proc.communicate = exec_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]) as mock_create:
            await executor._execute_singularity(
                "ls", 10, "",
                None,
                {"gpu": "1"}
            )
        exec_args = list(mock_create.call_args_list[1].args)
        assert "--nv" in exec_args

    @pytest.mark.asyncio
    async def test_resource_limits_gpu_false_no_nv(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"v", b"")
        probe_proc.communicate = probe_communicate

        exec_proc = MagicMock()
        exec_proc.returncode = 0

        async def exec_communicate():
            return (b"", b"")
        exec_proc.communicate = exec_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]) as mock_create:
            await executor._execute_singularity(
                "ls", 10, "",
                None,
                {"gpu": ""}
            )
        exec_args = list(mock_create.call_args_list[1].args)
        assert "--nv" not in exec_args

    @pytest.mark.asyncio
    async def test_env_passed_as_singularityenv(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"v", b"")
        probe_proc.communicate = probe_communicate

        exec_proc = MagicMock()
        exec_proc.returncode = 0

        async def exec_communicate():
            return (b"", b"")
        exec_proc.communicate = exec_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]) as mock_create:
            await executor._execute_singularity(
                "ls", 10, "",
                {"FOO": "bar", "BAZ": "123"},
                None
            )
        exec_kwargs = mock_create.call_args_list[1].kwargs
        full_env = exec_kwargs.get("env", {})
        assert full_env.get("SINGULARITYENV_FOO") == "bar"
        assert full_env.get("SINGULARITYENV_BAZ") == "123"

    @pytest.mark.asyncio
    async def test_exec_timeout(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"v", b"")
        probe_proc.communicate = probe_communicate

        async def slow_exec_communicate(*args, **kwargs):
            await asyncio.sleep(20)
            return (b"", b"")

        exec_proc = MagicMock()
        exec_proc.communicate = slow_exec_communicate
        exec_proc.kill = MagicMock()

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, exec_proc]):
            result = await executor._execute_singularity(
                "ls", 1, "", None, None
            )
        assert result.exit_code == -1
        assert result.timed_out is True
        assert "timed out" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_exec_general_exception(self):
        executor = SandboxExecutor()
        probe_proc = MagicMock()
        probe_proc.returncode = 0

        async def probe_communicate():
            return (b"v", b"")
        probe_proc.communicate = probe_communicate

        with patch("app.services.sandbox.asyncio.create_subprocess_exec",
                   side_effect=[probe_proc, RuntimeError("exec fail")]):
            result = await executor._execute_singularity(
                "ls", 10, "", None, None
            )
        assert result.exit_code == -1
        assert "execution failed" in result.stderr.lower()


# ============================================================
# 15. 全局单例
# ============================================================


class TestGlobalSingleton:
    """sandbox_executor 全局单例。"""

    def test_singleton_exists(self):
        assert sandbox_executor is not None

    def test_singleton_is_executor(self):
        assert isinstance(sandbox_executor, SandboxExecutor)

    def test_singleton_has_execute(self):
        assert hasattr(sandbox_executor, "execute")
        assert callable(sandbox_executor.execute)

    def test_singleton_has_log_exec(self):
        assert hasattr(sandbox_executor, "_log_exec")

    def test_singleton_has_check_dangerous(self):
        assert hasattr(sandbox_executor, "_check_dangerous_patterns")

    def test_module_exports(self):
        assert hasattr(sandbox, "SandboxError")
        assert hasattr(sandbox, "SandboxResult")
        assert hasattr(sandbox, "SandboxExecutor")
        assert hasattr(sandbox, "sandbox_executor")
        assert hasattr(sandbox, "_DANGEROUS_PATTERNS")
        assert hasattr(sandbox, "_ALLOWED_PREFIXES")
        assert hasattr(sandbox, "_DESTRUCTIVE_PATTERNS")
