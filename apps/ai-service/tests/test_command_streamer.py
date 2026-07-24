"""command_streamer.py 测试 — 流式命令执行器。

覆盖维度:
1. validate_command:空/超长/危险命令黑名单
2. parse_command:简单/引号/空/Windows 路径兼容
3. _clamp_timeout:超范围 clamp
4. stream_command:stdout/stderr/exit 事件 / 超时 kill / 危险命令拒绝 / 命令不存在
5. run_command_simple:成功/失败/危险拒绝/超时
"""

from __future__ import annotations

import sys

import pytest

from app.services.command_streamer import (
    MAX_COMMAND_LENGTH,
    MAX_TIMEOUT,
    MIN_TIMEOUT,
    _clamp_timeout,
    parse_command,
    run_command_simple,
    stream_command,
    validate_command,
)

# 跨平台 Python 可执行名(Unix: python3, Windows: python)
_PY = "python" if sys.platform == "win32" else "python3"


class TestValidateCommand:
    def test_empty_rejected(self):
        assert not validate_command("")[0]

    def test_whitespace_rejected(self):
        assert not validate_command("   ")[0]

    def test_safe_accepted(self):
        assert validate_command("echo hello")[0]

    def test_too_long_rejected(self):
        ok, reason = validate_command("a" * (MAX_COMMAND_LENGTH + 1))
        assert not ok
        assert "长度" in reason

    @pytest.mark.parametrize("cmd", [
        "rm -rf /",
        "rm -rf ~",
        "mkfs /dev/sda1",
        "shutdown now",
        "reboot",
        "format C:",
        "del /f /s /q C:\\windows",
        "rd /s /q D:\\temp",
        "halt",
        "poweroff",
    ])
    def test_dangerous_rejected(self, cmd):
        ok, reason = validate_command(cmd)
        assert not ok
        assert "危险" in reason or "拦截" in reason


class TestParseCommand:
    def test_simple(self):
        assert parse_command("echo hello") == ["echo", "hello"]

    def test_quoted_arg(self):
        assert parse_command('echo "hello world"') == ["echo", "hello world"]

    def test_empty(self):
        assert parse_command("") == []

    def test_forward_slash_path(self):
        # 正斜杠路径 posix 模式下正确解析
        result = parse_command("cat C:/Users/test/file.txt")
        assert result == ["cat", "C:/Users/test/file.txt"]

    def test_quoted_backslash_path(self):
        # Windows 反斜杠路径需引号包裹(posix 模式下 \ 是转义符)
        result = parse_command(r"type 'C:\Users\test\file.txt'")
        assert result[0] == "type"
        assert "C:\\Users" in result[1]

    def test_unbalanced_quote_fallback(self):
        # 引号不匹配 → 回退 split(不抛异常)
        result = parse_command('echo "unbalanced')
        assert isinstance(result, list)
        assert result[0] == "echo"


class TestClampTimeout:
    def test_below_min(self):
        assert _clamp_timeout(0) == MIN_TIMEOUT
        assert _clamp_timeout(-5) == MIN_TIMEOUT

    def test_above_max(self):
        assert _clamp_timeout(3600) == MAX_TIMEOUT

    def test_in_range(self):
        assert _clamp_timeout(60) == 60
        assert _clamp_timeout(300) == 300


class TestStreamCommand:
    async def test_stdout_stderr_exit_events(self):
        """成功执行:yield stdout/stderr/exit 事件。"""
        cmd = f'{_PY} -c "import sys; print(\'out\'); print(\'err\', file=sys.stderr)"'
        events = []
        async for ev in stream_command(cmd, timeout=15):
            events.append(ev)

        types = [e["type"] for e in events]
        assert "stdout" in types
        assert "exit" in types
        exit_ev = next(e for e in events if e["type"] == "exit")
        assert exit_ev["returncode"] == 0
        assert exit_ev["duration_ms"] >= 0
        # stdout 内容应含 "out"
        stdout_content = "".join(
            e.get("content", "") for e in events if e["type"] == "stdout"
        )
        assert "out" in stdout_content

    async def test_timeout_kills_process(self):
        """超时 → kill 进程 + yield timeout 事件。"""
        cmd = f'{_PY} -c "import time; time.sleep(10)"'
        events = []
        async for ev in stream_command(cmd, timeout=1):
            events.append(ev)

        types = [e["type"] for e in events]
        assert "timeout" in types
        # 不应有正常 exit(returncode=0)
        exits = [e for e in events if e["type"] == "exit" and e.get("returncode") == 0]
        assert len(exits) == 0

    async def test_dangerous_command_rejected(self):
        """危险命令 → 直接 yield exit error,不启动进程。"""
        events = []
        async for ev in stream_command("rm -rf /", timeout=5):
            events.append(ev)

        assert len(events) == 1
        assert events[0]["type"] == "exit"
        assert events[0]["returncode"] == -1
        assert "error" in events[0]

    async def test_command_not_found(self):
        """不存在的命令 → exit 事件 + 非零 returncode。"""
        events = []
        async for ev in stream_command("nonexistent_cmd_xyz_12345", timeout=5):
            events.append(ev)

        assert len(events) >= 1
        exit_ev = events[-1]
        assert exit_ev["type"] == "exit"
        assert exit_ev["returncode"] != 0

    async def test_nonzero_exit_code(self):
        """命令以非零码退出 → exit 事件记录 returncode。"""
        cmd = f'{_PY} -c "import sys; sys.exit(3)"'
        events = []
        async for ev in stream_command(cmd, timeout=10):
            events.append(ev)
        exit_ev = next(e for e in events if e["type"] == "exit")
        assert exit_ev["returncode"] == 3


class TestRunCommandSimple:
    async def test_success(self):
        cmd = f'{_PY} -c "print(\'hello\')"'
        result = await run_command_simple(cmd, timeout=10)
        assert result["ok"] is True
        assert result["returncode"] == 0
        assert "hello" in result["stdout"]
        assert result["timed_out"] is False

    async def test_failure_nonzero(self):
        cmd = f'{_PY} -c "import sys; sys.exit(2)"'
        result = await run_command_simple(cmd, timeout=10)
        assert result["ok"] is False
        assert result["returncode"] == 2
        assert result["timed_out"] is False

    async def test_dangerous_rejected(self):
        result = await run_command_simple("rm -rf /", timeout=5)
        assert result["ok"] is False
        assert result["error"]

    async def test_timeout(self):
        cmd = f'{_PY} -c "import time; time.sleep(10)"'
        result = await run_command_simple(cmd, timeout=1)
        assert result["ok"] is False
        assert result["timed_out"] is True
