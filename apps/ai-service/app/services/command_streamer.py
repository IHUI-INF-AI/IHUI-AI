"""命令流式执行器 — 对标 Trae Work Shell + Codex shell tool。

用 asyncio.create_subprocess_exec 启动进程,异步逐行读取 stdout/stderr,
yield 事件流(stdout/stderr/exit/timeout),解决长命令超时问题。
提供 run_command_simple 同步包装器供不需要流式的调用方使用。
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shlex
import time
from collections.abc import AsyncGenerator
from typing import Any

logger = logging.getLogger(__name__)

# 命令长度上限(防止超大输入打满 argv)
MAX_COMMAND_LENGTH = 2000

# 超时范围(秒):1s ~ 30min,超出 clamp
MIN_TIMEOUT = 1
MAX_TIMEOUT = 1800

# 超时后 SIGTERM 宽限期(SIGTERM → 等 5s → SIGKILL)
_GRACE_PERIOD = 5.0

# 危险命令黑名单(匹配即拒绝)
_DANGEROUS_PATTERNS: list[tuple[str, str]] = [
    (r"rm\s+-rf?\s+/(?:\s|$|/.*)", "rm -rf / (删除根目录)"),
    (r"rm\s+-rf?\s+~(?:\s|$)", "rm -rf ~ (删除家目录)"),
    (r"rm\s+-rf?\s+\$HOME(?:\s|$)", "rm -rf $HOME (删除家目录)"),
    (r"\bmkfs\b", "mkfs (格式化文件系统)"),
    (r"\bdd\b.*\bof=/dev/", "dd of=/dev/ (写入块设备)"),
    (r":\s*\(\)\s*\{\s*:\|.*?\}\s*;", ":(){:|:&};: (fork bomb)"),
    (r">\s*/dev/sd", "> /dev/sda (覆写磁盘)"),
    (r"\bshutdown\b", "shutdown (关机)"),
    (r"\breboot\b", "reboot (重启)"),
    (r"\bhalt\b", "halt (停机)"),
    (r"\bpoweroff\b", "poweroff (关机)"),
    (r"\bformat\b\s+[A-Za-z]:", "format (格式化磁盘)"),
    (r"\bdel\s+/[fsq]+", "del /f /s /q (强制删除)"),
    (r"\brd\s+/[sq]+", "rd /s /q (递归删除目录)"),
    (r"\bchmod\s+-R\s+777\s+/(?:\s|$)", "chmod -R 777 / (全盘权限开放)"),
]


def validate_command(command: str) -> tuple[bool, str]:
    """命令安全校验:长度 + 黑名单。

    Returns:
        (True, "") 或 (False, reason)
    """
    if not command or not command.strip():
        return False, "命令为空"
    if len(command) > MAX_COMMAND_LENGTH:
        return False, f"命令长度超限({len(command)} > {MAX_COMMAND_LENGTH})"
    for pattern, desc in _DANGEROUS_PATTERNS:
        if re.search(pattern, command):
            return False, f"危险命令被拦截: {desc}"
    return True, ""


def parse_command(command: str) -> list[str]:
    """用 shlex 解析命令为 args 列表。

    使用 posix 模式正确处理引号(python -c "script" → ['python', '-c', 'script'])。
    Windows 路径含反斜杠时需用引号包裹或改用正斜杠(posix 模式下 \\ 是转义符)。
    解析失败(引号不匹配等)回退到简单 split。
    """
    try:
        return shlex.split(command)
    except ValueError as e:
        logger.warning("parse_command 失败(%s),回退 split", e)
        return command.split()


def _clamp_timeout(timeout: int) -> int:
    """clamp 到 [MIN_TIMEOUT, MAX_TIMEOUT]。"""
    if timeout < MIN_TIMEOUT:
        return MIN_TIMEOUT
    if timeout > MAX_TIMEOUT:
        return MAX_TIMEOUT
    return timeout


async def _read_stream(
    stream: asyncio.StreamReader, ev_type: str, queue: asyncio.Queue
) -> None:
    """逐行读取 stream,put 事件到 queue;结束时 put None 哨兵。"""
    try:
        while True:
            line = await stream.readline()
            if not line:
                break
            await queue.put({
                "type": ev_type,
                "content": line.decode("utf-8", errors="replace").rstrip("\r\n"),
                "timestamp": time.time(),
            })
    except Exception as e:
        logger.warning("stream_command reader(%s) 异常: %s", ev_type, e)
    finally:
        await queue.put(None)


async def _cleanup_proc(
    proc: asyncio.subprocess.Process,
    stdout_task: asyncio.Task,
    stderr_task: asyncio.Task,
    timed_out: bool,
) -> None:
    """清理 reader 任务 + 进程(超时 → SIGTERM → grace → SIGKILL)。"""
    for t in (stdout_task, stderr_task):
        if not t.done():
            t.cancel()
    for t in (stdout_task, stderr_task):
        try:
            await t
        except (asyncio.CancelledError, Exception):
            pass
    if proc.returncode is None:
        if timed_out:
            try:
                proc.terminate()
            except (ProcessLookupError, OSError):
                pass
            try:
                await asyncio.wait_for(proc.wait(), timeout=_GRACE_PERIOD)
            except (asyncio.TimeoutError, Exception):
                try:
                    proc.kill()
                except (ProcessLookupError, OSError):
                    pass
                try:
                    await proc.wait()
                except Exception:
                    pass
        else:
            try:
                await asyncio.wait_for(proc.wait(), timeout=_GRACE_PERIOD)
            except (asyncio.TimeoutError, Exception):
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass


async def stream_command(
    command: str,
    cwd: str | None = None,
    timeout: int = 300,
    env: dict[str, str] | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """流式执行命令,yield 事件流。

    事件类型:
        {type: "stdout"|"stderr", content: str, timestamp: float}
        {type: "exit", returncode: int, duration_ms: float, error?: str}
        {type: "timeout", message: str, duration_ms: float}

    Args:
        command: 要执行的命令(单条,exec 模式不经过 shell)
        cwd: 工作目录
        timeout: 超时秒数(clamp 到 1-1800)
        env: 额外环境变量(合并到 os.environ)
    """
    ok, reason = validate_command(command)
    if not ok:
        yield {"type": "exit", "returncode": -1, "duration_ms": 0.0, "error": reason}
        return

    timeout = _clamp_timeout(timeout)
    args = parse_command(command)
    if not args:
        yield {
            "type": "exit", "returncode": -1, "duration_ms": 0.0,
            "error": "命令解析后为空",
        }
        return

    full_env: dict[str, str] | None = None
    if env:
        full_env = {**os.environ, **env}

    start = time.monotonic()

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=full_env,
        )
    except FileNotFoundError as e:
        yield {
            "type": "exit", "returncode": -1,
            "duration_ms": (time.monotonic() - start) * 1000,
            "error": f"command not found: {e}",
        }
        return
    except Exception as e:
        yield {
            "type": "exit", "returncode": -1,
            "duration_ms": (time.monotonic() - start) * 1000,
            "error": f"start failed: {e}",
        }
        return

    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    stdout_task = asyncio.create_task(_read_stream(proc.stdout, "stdout", queue))
    stderr_task = asyncio.create_task(_read_stream(proc.stderr, "stderr", queue))

    deadline = start + timeout
    timed_out = False
    sentinels = 2

    try:
        while sentinels > 0:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=remaining)
            except asyncio.TimeoutError:
                timed_out = True
                break
            if event is None:
                sentinels -= 1
                continue
            yield event
    finally:
        await _cleanup_proc(proc, stdout_task, stderr_task, timed_out)

    duration_ms = (time.monotonic() - start) * 1000
    if timed_out:
        yield {
            "type": "timeout",
            "message": f"命令超时({timeout}s),进程已终止",
            "duration_ms": duration_ms,
        }
    else:
        yield {
            "type": "exit",
            "returncode": proc.returncode if proc.returncode is not None else -1,
            "duration_ms": duration_ms,
        }


async def run_command_simple(
    command: str,
    cwd: str | None = None,
    timeout: int = 60,
) -> dict[str, Any]:
    """同步包装器:收集所有输出,返回聚合结果。

    Returns:
        {ok, returncode, stdout, stderr, duration_ms, timed_out, error?}
    """
    stdout_parts: list[str] = []
    stderr_parts: list[str] = []
    returncode = -1
    duration_ms = 0.0
    error: str | None = None
    timed_out = False

    async for event in stream_command(command, cwd=cwd, timeout=timeout):
        etype = event.get("type")
        if etype == "stdout":
            stdout_parts.append(event.get("content", ""))
        elif etype == "stderr":
            stderr_parts.append(event.get("content", ""))
        elif etype == "exit":
            returncode = event.get("returncode", -1)
            duration_ms = event.get("duration_ms", 0.0)
            if "error" in event:
                error = event["error"]
        elif etype == "timeout":
            timed_out = True
            duration_ms = event.get("duration_ms", 0.0)

    return {
        "ok": returncode == 0 and not error and not timed_out,
        "returncode": returncode,
        "stdout": "\n".join(stdout_parts),
        "stderr": "\n".join(stderr_parts),
        "duration_ms": duration_ms,
        "timed_out": timed_out,
        "error": error,
    }
