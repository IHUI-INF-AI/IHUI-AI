"""run_command 流式升级(asyncio.subprocess)单元测试。

测试覆盖(2026-07-24 升级):
- streamed=True 字段在所有返回路径存在
- _drain_stream helper:逐行读取 stream 直到 EOF
- _build_subprocess_env helper:env 合并 + PATH/HOME/USERPROFILE 保护
- 超时:proc.kill + partial_output + errorCode=TIMEOUT
- max_timeout 钳制(timeout > max_timeout → 用 max_timeout)
- sandbox_backend != "local" 委托 sandbox_executor(mock)
- env 参数透传到 subprocess
- stdout/stderr 并发 drain(分别捕获)
- 大输出截断(> 10000 字符)
- exit_code 来自 proc.returncode

注意:与 test_mcp_server.py 中 run_command 基础测试(空命令/白名单/危险模式/echo)
不重复,本文件聚焦流式升级新增能力。
"""

from __future__ import annotations

import asyncio
import os
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.mcp_server import (
    _build_subprocess_env,
    _drain_stream,
    _tool_run_command,
)


@pytest.fixture
def allow_any_cwd(monkeypatch):
    """绕过工作区白名单校验(允许 tmp_path 作为 cwd)。

    _validate_path_in_workspace 默认只允许 _WORKSPACE_ROOTS 下的路径,
    但 pytest 的 tmp_path 在系统临时目录,不在白名单内。
    """
    monkeypatch.setattr(
        "app.services.mcp_server._validate_path_in_workspace",
        lambda p: (True, str(p)),
    )


# =============================================================================
# _drain_stream helper
# =============================================================================


class _FakeStream:
    """模拟 asyncio subprocess stream:逐行返回预设行,结束后返回空 bytes。"""

    def __init__(self, lines: list[bytes]):
        self._lines = list(lines)
        self._idx = 0

    async def readline(self) -> bytes:
        if self._idx >= len(self._lines):
            return b""
        line = self._lines[self._idx]
        self._idx += 1
        return line


async def test_drain_stream_reads_all_lines():
    """_drain_stream 读取所有行直到 EOF。"""
    stream = _FakeStream([b"line1\n", b"line2\n", b"line3"])
    out: list[str] = []
    await _drain_stream(stream, out)
    assert out == ["line1", "line2", "line3"]


async def test_drain_stream_empty_stream():
    """空 stream 立即返回,lines_list 为空。"""
    stream = _FakeStream([])
    out: list[str] = []
    await _drain_stream(stream, out)
    assert out == []


async def test_drain_stream_preserves_crlf_strip():
    """CRLF 行尾被 rstrip 为纯净内容。"""
    stream = _FakeStream([b"win-line\r\n", b"unix-line\n"])
    out: list[str] = []
    await _drain_stream(stream, out)
    assert out == ["win-line", "unix-line"]


async def test_drain_stream_replaces_invalid_utf8():
    """非法 UTF-8 字节被 errors='replace' 替换(不抛异常)。"""
    stream = _FakeStream([b"\xff\xfe bad bytes\n"])
    out: list[str] = []
    await _drain_stream(stream, out)
    assert len(out) == 1
    # 替换字符存在,不崩溃
    assert "bad bytes" in out[0]


# =============================================================================
# _build_subprocess_env helper
# =============================================================================


def test_build_subprocess_env_none_returns_os_environ_copy():
    """user_env=None 返回 os.environ 的副本。"""
    env = _build_subprocess_env(None)
    assert isinstance(env, dict)
    assert env == dict(os.environ)
    # 确认是副本而非引用
    assert env is not os.environ


def test_build_subprocess_env_empty_dict():
    """user_env={} 返回 os.environ 副本。"""
    env = _build_subprocess_env({})
    assert env == dict(os.environ)


def test_build_subprocess_env_merges_normal_keys():
    """正常 key-value 被合并到 env。"""
    env = _build_subprocess_env({"MY_TEST_VAR": "hello123"})
    assert env["MY_TEST_VAR"] == "hello123"


def test_build_subprocess_env_refuses_path_override():
    """PATH 不允许被用户 env 覆盖。"""
    original_path = os.environ.get("PATH", "")
    env = _build_subprocess_env({"PATH": "/malicious/path"})
    assert env["PATH"] == original_path
    assert env["PATH"] != "/malicious/path"


def test_build_subprocess_env_refuses_home_override():
    """HOME 不允许被用户 env 覆盖(Windows 上 HOME 可能不存在)。"""
    original_home = os.environ.get("HOME", "")
    env = _build_subprocess_env({"HOME": "/malicious/home"})
    if original_home:
        assert env["HOME"] == original_home
    else:
        # HOME not set on this platform (e.g., Windows) → should not be set by user env
        assert "HOME" not in env or env["HOME"] != "/malicious/home"
    assert env.get("HOME", "") != "/malicious/home"


def test_build_subprocess_env_refuses_userprofile_override():
    """USERPROFILE(Windows)不允许被覆盖。"""
    original = os.environ.get("USERPROFILE", "")
    env = _build_subprocess_env({"USERPROFILE": "C:\\evil"})
    if original:
        assert env["USERPROFILE"] == original
    assert env["USERPROFILE"] != "C:\\evil"


def test_build_subprocess_env_refuses_case_insensitive_path():
    """path(小写)也不允许覆盖(case-insensitive)。"""
    original_path = os.environ.get("PATH", "")
    env = _build_subprocess_env({"path": "/sneaky"})
    assert env["PATH"] == original_path


def test_build_subprocess_env_converts_int_to_str():
    """int 值被转为字符串。"""
    env = _build_subprocess_env({"PORT_NUM": 8080})
    assert env["PORT_NUM"] == "8080"


def test_build_subprocess_env_converts_float_to_str():
    """float 值被转为字符串。"""
    env = _build_subprocess_env({"RATIO": 0.5})
    assert env["RATIO"] == "0.5"


def test_build_subprocess_env_skips_non_string_key():
    """非字符串 key 被跳过。"""
    env = _build_subprocess_env({123: "value"})  # type: ignore[dict-item]
    assert 123 not in env
    assert "123" not in env


def test_build_subprocess_env_skips_complex_values():
    """list/dict/None 等复杂值被跳过。"""
    env = _build_subprocess_env({
        "GOOD_VAR": "ok",
        "LIST_VAR": [1, 2, 3],
        "DICT_VAR": {"a": 1},
        "NONE_VAR": None,
    })
    assert env["GOOD_VAR"] == "ok"
    assert "LIST_VAR" not in env or not isinstance(env.get("LIST_VAR"), list)
    assert "DICT_VAR" not in env or not isinstance(env.get("DICT_VAR"), dict)


# =============================================================================
# streamed=True 字段在所有返回路径
# =============================================================================


async def test_streamed_field_on_empty_command():
    """空命令返回 streamed=True。"""
    out = await _tool_run_command({"command": ""})
    assert out["streamed"] is True
    assert out["ok"] is False


async def test_streamed_field_on_disallowed_command():
    """非白名单命令返回 streamed=True。"""
    out = await _tool_run_command({"command": "chmod 777 /etc"})
    assert out["streamed"] is True
    assert out["ok"] is False


async def test_streamed_field_on_dangerous_rm():
    """rm 危险命令返回 streamed=True + errorCode。"""
    out = await _tool_run_command({"command": "rm file.txt"})
    assert out["streamed"] is True
    assert out["errorCode"] == "DANGEROUS_COMMAND"


async def test_streamed_field_on_success():
    """成功执行返回 streamed=True。"""
    out = await _tool_run_command({"command": "echo streaming_test"})
    assert out["streamed"] is True
    assert out["ok"] is True
    assert "streaming_test" in out["stdout"]


async def test_streamed_field_on_cwd_not_allowed():
    """cwd 不在白名单返回 streamed=True + errorCode=PATH_NOT_ALLOWED。"""
    out = await _tool_run_command({
        "command": "echo test",
        "cwd": "/nonexistent/xyz/outside/workspace",
    })
    assert out["streamed"] is True
    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"


# =============================================================================
# errorCode 字段
# =============================================================================


async def test_error_code_dangerous_pipe():
    """管道被拦截返回 errorCode=DANGEROUS_COMMAND。"""
    out = await _tool_run_command({"command": "ls | grep foo"})
    assert out["errorCode"] == "DANGEROUS_COMMAND"


async def test_error_code_dangerous_redirect():
    """重定向返回 errorCode=DANGEROUS_COMMAND。"""
    out = await _tool_run_command({"command": "echo x > file.txt"})
    assert out["errorCode"] == "DANGEROUS_COMMAND"


async def test_error_code_dangerous_command_substitution():
    """命令替换 $(...) 返回 errorCode=DANGEROUS_COMMAND。"""
    out = await _tool_run_command({"command": "echo $(whoami)"})
    assert out["errorCode"] == "DANGEROUS_COMMAND"


async def test_error_code_dangerous_backtick():
    """反引号命令替换返回 errorCode=DANGEROUS_COMMAND。"""
    out = await _tool_run_command({"command": "echo `whoami`"})
    assert out["errorCode"] == "DANGEROUS_COMMAND"


async def test_error_code_dangerous_chain():
    """命令链 ; 返回 errorCode=DANGEROUS_COMMAND。"""
    out = await _tool_run_command({"command": "ls; echo done"})
    assert out["errorCode"] == "DANGEROUS_COMMAND"


# =============================================================================
# 超时:proc.kill + partial_output + errorCode=TIMEOUT
# =============================================================================


async def test_timeout_returns_partial_output_and_error_code(allow_any_cwd, tmp_path):
    """超时返回 partial_output + errorCode=TIMEOUT + streamed=True。"""
    # 写一个 sleep 脚本(避免命令行中包含 ; 被 dangerous pattern 拦截)
    script = tmp_path / "slow_script.py"
    script.write_text(
        "import time\nprint('start', flush=True)\ntime.sleep(5)\nprint('end')\n",
        encoding="utf-8",
    )
    out = await _tool_run_command({
        "command": f"python {script}",
        "timeout": 1,
        "cwd": str(tmp_path),
    })
    assert out["streamed"] is True
    assert out["ok"] is False
    assert out["errorCode"] == "TIMEOUT"
    assert "partial_output" in out
    # 进程被 kill 前 print('start') 应已 drain 到 partial_output
    assert "start" in out.get("partial_output", "") or "start" in out.get("stdout", "")


async def test_timeout_max_timeout_clamping():
    """timeout > max_timeout 时被钳制为 max_timeout(不超 600 上限)。"""
    # timeout=9999, max_timeout=2 → 实际 timeout=2
    script_code = "import time\nprint('s')\ntime.sleep(5)\n"
    import tempfile

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        f.write(script_code)
        script_path = f.name

    try:
        out = await _tool_run_command({
            "command": f"python {script_path}",
            "timeout": 9999,
            "max_timeout": 2,
        })
        assert out["ok"] is False
        assert out["errorCode"] == "TIMEOUT"
        assert out["streamed"] is True
    finally:
        os.unlink(script_path)


async def test_max_timeout_minimum_one():
    """max_timeout 至少为 1(防 0 或负数)。"""
    # 用极小 max_timeout=1 触发超时
    import tempfile

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        f.write("import time\ntime.sleep(3)\n")
        script_path = f.name

    try:
        out = await _tool_run_command({
            "command": f"python {script_path}",
            "timeout": 0,  # 会被钳为 max(1, ...)
            "max_timeout": 1,
        })
        assert out["ok"] is False
        assert out["errorCode"] == "TIMEOUT"
    finally:
        os.unlink(script_path)


# =============================================================================
# stdout/stderr 并发 drain(分别捕获)
# =============================================================================


async def test_stdout_and_stderr_captured_separately(allow_any_cwd, tmp_path):
    """stdout 和 stderr 分别被 drain 到不同字段。"""
    script = tmp_path / "dual_output.py"
    script.write_text(
        'import sys\nprint("to_stdout", flush=True)\n'
        'sys.stderr.write("to_stderr\\n")\n',
        encoding="utf-8",
    )
    out = await _tool_run_command({
        "command": f"python {script}",
        "cwd": str(tmp_path),
    })
    assert out["ok"] is True
    assert out["streamed"] is True
    assert "to_stdout" in out["stdout"]
    assert "to_stderr" in out["stderr"]


async def test_multi_line_stdout_accumulated(allow_any_cwd, tmp_path):
    """多行 stdout 被逐行累积并用 \\n 连接。"""
    script = tmp_path / "multiline.py"
    script.write_text(
        "for i in range(5):\n    print(f'line-{i}')\n",
        encoding="utf-8",
    )
    out = await _tool_run_command({
        "command": f"python {script}",
        "cwd": str(tmp_path),
    })
    assert out["ok"] is True
    assert out["streamed"] is True
    for i in range(5):
        assert f"line-{i}" in out["stdout"]


# =============================================================================
# 大输出截断(> 10000 字符)
# =============================================================================


async def test_large_output_truncated(allow_any_cwd, tmp_path):
    """stdout > 10000 字符被截断 + 附截断提示。"""
    script = tmp_path / "big_output.py"
    # 每行约 10 字符,2000 行 ≈ 20000 字符 → 触发截断
    script.write_text(
        "for i in range(2000):\n    print(f'x{i:06d}')\n",
        encoding="utf-8",
    )
    out = await _tool_run_command({
        "command": f"python {script}",
        "cwd": str(tmp_path),
    })
    assert out["ok"] is True
    assert out["streamed"] is True
    assert len(out["stdout"]) <= 10100  # 10000 + 截断提示文本
    assert "已截断" in out["stdout"] or "截断" in out["stdout"]


# =============================================================================
# env 参数透传
# =============================================================================


async def test_env_param_passed_to_subprocess(allow_any_cwd, tmp_path):
    """env 参数中的变量在子进程中可读。"""
    script = tmp_path / "read_env.py"
    script.write_text(
        "import os\nprint(os.environ.get('IHUI_TEST_ENV_VAR', 'NOT_SET'))\n",
        encoding="utf-8",
    )
    out = await _tool_run_command({
        "command": f"python {script}",
        "cwd": str(tmp_path),
        "env": {"IHUI_TEST_ENV_VAR": "env_value_123"},
    })
    assert out["ok"] is True
    assert "env_value_123" in out["stdout"]


async def test_env_param_does_not_override_path(allow_any_cwd, tmp_path):
    """env 中的 PATH 不覆盖系统 PATH(子进程仍能找到 python)。"""
    script = tmp_path / "check_path.py"
    script.write_text(
        "import os\nprint('PATH_EXISTS' if os.environ.get('PATH') else 'NO_PATH')\n",
        encoding="utf-8",
    )
    # 尝试用 env 覆盖 PATH → 应被拒绝,子进程仍用系统 PATH
    out = await _tool_run_command({
        "command": f"python {script}",
        "cwd": str(tmp_path),
        "env": {"PATH": "/malicious/empty/path"},
    })
    assert out["ok"] is True
    assert "PATH_EXISTS" in out["stdout"]


# =============================================================================
# exit_code 来自 proc.returncode
# =============================================================================


async def test_exit_code_zero_on_success(tmp_path):
    """成功执行 exit_code=0。"""
    out = await _tool_run_command({"command": "echo ok"})
    assert out["exit_code"] == 0
    assert out["ok"] is True


async def test_exit_code_nonzero_on_failure(allow_any_cwd, tmp_path):
    """脚本 sys.exit(1) → exit_code=1, ok=False。"""
    script = tmp_path / "fail.py"
    script.write_text("import sys\nsys.exit(1)\n", encoding="utf-8")
    out = await _tool_run_command({
        "command": f"python {script}",
        "cwd": str(tmp_path),
    })
    assert out["exit_code"] == 1
    assert out["ok"] is False
    assert out["streamed"] is True


# =============================================================================
# sandbox_backend != "local" 委托 sandbox_executor
# =============================================================================


async def test_sandbox_backend_docker_delegates(monkeypatch):
    """sandbox_backend=docker 委托 sandbox_executor.execute,不执行本地命令。"""
    from app.services import sandbox as sandbox_mod

    fake_result = MagicMock()
    fake_result.exit_code = 0
    fake_result.stdout = "docker output"
    fake_result.stderr = ""
    fake_result.duration_ms = 100
    fake_result.timed_out = False

    fake_executor = MagicMock()
    fake_executor.execute = AsyncMock(return_value=fake_result)
    monkeypatch.setattr(sandbox_mod, "sandbox_executor", fake_executor)

    out = await _tool_run_command({
        "command": "echo docker_test",
        "sandbox_backend": "docker",
        "docker_image": "python:3.12-slim",
    })
    assert out["tool"] == "run_command"
    assert out["backend"] == "docker"
    assert out["streamed"] is False  # sandbox 后端不走流式
    assert out["ok"] is True
    assert out["exit_code"] == 0
    assert "docker output" in out["stdout"]
    # 验证委托参数
    call_args = fake_executor.execute.call_args
    assert call_args.kwargs["backend"] == "docker"
    assert call_args.kwargs["docker_image"] == "python:3.12-slim"
    assert call_args.kwargs["timeout"] == 60


async def test_sandbox_backend_ssh_delegates(monkeypatch):
    """sandbox_backend=ssh 委托 sandbox_executor.execute。"""
    from app.services import sandbox as sandbox_mod

    fake_result = MagicMock()
    fake_result.exit_code = 0
    fake_result.stdout = "ssh output"
    fake_result.stderr = ""
    fake_result.duration_ms = 50
    fake_result.timed_out = False

    fake_executor = MagicMock()
    fake_executor.execute = AsyncMock(return_value=fake_result)
    monkeypatch.setattr(sandbox_mod, "sandbox_executor", fake_executor)

    out = await _tool_run_command({
        "command": "ls",
        "sandbox_backend": "ssh",
        "ssh_host": "remote-host",
        "ssh_user": "deploy",
    })
    assert out["backend"] == "ssh"
    assert out["streamed"] is False
    assert out["ok"] is True
    call_args = fake_executor.execute.call_args
    assert call_args.kwargs["backend"] == "ssh"
    assert call_args.kwargs["ssh_host"] == "remote-host"
    assert call_args.kwargs["ssh_user"] == "deploy"


async def test_sandbox_backend_timed_out(monkeypatch):
    """sandbox 后端超时返回 timed_out=True + ok=False。"""
    from app.services import sandbox as sandbox_mod

    fake_result = MagicMock()
    fake_result.exit_code = -1
    fake_result.stdout = "partial"
    fake_result.stderr = ""
    fake_result.duration_ms = 60000
    fake_result.timed_out = True

    fake_executor = MagicMock()
    fake_executor.execute = AsyncMock(return_value=fake_result)
    monkeypatch.setattr(sandbox_mod, "sandbox_executor", fake_executor)

    out = await _tool_run_command({
        "command": "python slow.py",
        "sandbox_backend": "docker",
        "timeout": 60,
    })
    assert out["ok"] is False
    assert out["timed_out"] is True
    assert out["exit_code"] == -1


# =============================================================================
# FileNotFoundError(白名单内但命令不存在)
# =============================================================================


async def test_file_not_found_error_handled():
    """白名单内但命令不存在 → ok=False + streamed=True。"""
    # 用绝对路径调用一个不存在的可执行文件
    # first_token 会是 "nonexistent_cmd_xyz",不在白名单 → 返回白名单错误
    # 改用白名单内命令但路径不存在的情况:find 一个不存在的路径
    out = await _tool_run_command({"command": "find /nonexistent/xyz/abc/path"})
    assert out["tool"] == "run_command"
    assert out["streamed"] is True
    # find 命令存在但路径不存在,exit_code 非 0
    assert out["exit_code"] != 0 or out["ok"] is False
