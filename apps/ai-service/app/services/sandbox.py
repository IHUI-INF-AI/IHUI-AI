"""沙箱执行器 — 支持 Local/Docker/SSH 三种后端(对标 Hermes 6 种后端)。

Local:现有模式,白黑名单 + subprocess + 超时
Docker:通过 docker run 命令在容器内执行(不装 docker SDK,用 subprocess 调 docker CLI)
SSH:通过 ssh 命令在远程主机执行(不装 paramiko,用 subprocess 调 ssh CLI)
Modal/Daytona/Singularity:预留接口,本轮返回 not_implemented
"""

import asyncio
import os
import re
import shlex
import sys
import time
from dataclasses import dataclass


@dataclass
class SandboxResult:
    """沙箱执行结果。"""
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    backend: str
    timed_out: bool


# 危险字符/操作黑名单(Shell 注入 + 破坏性操作,与 mcp_server._tool_run_command 同源)
_DANGEROUS_PATTERNS = [
    r";\s*\S",
    r"&&\s*\S",
    r"\|\|\s*\S",
    r"\brm\b",
    r"\brmdir\b",
    r"\bmv\b",
    r"\bcp\b",
    r"\bmkdir\b",
    r"\btouch\b",
    r"\bchmod\b",
    r"\bchown\b",
    r"\bcurl\b",
    r"\bwget\b",
    r"\bscp\b",
    r"\bssh\b",
    r"\bdd\b",
    r"\bmkfs\b",
    r"\bshutdown\b",
    r"\breboot\b",
    r"\bkill\b",
    r"\bkillall\b",
    r">\s*",
    r">>\s*",
    r"<\s*",
    r"\|\s*",
    r"`[^`]*`",
    r"\$\([^)]*\)",
    r"\$\{[^}]*\}",
]

# 命令白名单(与 mcp_server._tool_run_command 同源)
_ALLOWED_PREFIXES = {
    "git", "ls", "cat", "echo", "python", "python3", "node", "npm", "npx",
    "pnpm", "tsc", "ruff", "mypy", "pytest", "find", "grep", "rg", "wc",
    "head", "tail", "date", "whoami", "pwd", "which", "where", "env",
    "uname", "ver", "dir", "type", "getopt",
}


class SandboxExecutor:
    """沙箱执行器,支持 Local/Docker/SSH 后端。"""

    async def execute(
        self,
        command: str,
        backend: str = "local",
        timeout: int = 60,
        workdir: str = ".",
        docker_image: str = "python:3.12-slim",
        ssh_host: str | None = None,
        ssh_user: str = "root",
        env: dict[str, str] | None = None,
    ) -> SandboxResult:
        """执行命令。

        Args:
            command: 要执行的命令
            backend: local/docker/ssh(modal/daytona/singularity 预留)
            timeout: 超时秒数
            workdir: 工作目录
            docker_image: Docker 镜像(backend=docker 时)
            ssh_host: SSH 主机(backend=ssh 时)
            ssh_user: SSH 用户名
            env: 环境变量
        """
        if backend == "local":
            return await self._execute_local(command, timeout, workdir, env)
        if backend == "docker":
            return await self._execute_docker(command, timeout, workdir, docker_image, env)
        if backend == "ssh":
            if not ssh_host:
                return SandboxResult(
                    exit_code=-1, stdout="", stderr="ssh backend requires ssh_host",
                    duration_ms=0, backend=backend, timed_out=False,
                )
            return await self._execute_ssh(command, timeout, workdir, ssh_host, ssh_user, env)
        if backend in ("modal", "daytona", "singularity"):
            return SandboxResult(
                exit_code=-1, stdout="", stderr=f"backend '{backend}' not implemented yet",
                duration_ms=0, backend=backend, timed_out=False,
            )
        return SandboxResult(
            exit_code=-1, stdout="", stderr=f"unknown backend: {backend}",
            duration_ms=0, backend=backend, timed_out=False,
        )

    async def _execute_local(
        self,
        command: str,
        timeout: int,
        workdir: str,
        env: dict[str, str] | None,
    ) -> SandboxResult:
        """本地执行(白黑名单 + subprocess)。"""
        start = time.monotonic()
        # 1. 危险模式检查(Shell 注入 + 破坏性操作)
        for pat in _DANGEROUS_PATTERNS:
            if re.search(pat, command):
                return SandboxResult(
                    exit_code=-1, stdout="",
                    stderr=f"command contains forbidden pattern: {pat}",
                    duration_ms=0, backend="local", timed_out=False,
                )
        # 2. 白名单检查(取首 token 作为命令名)
        tokens = command.split()
        first_token = tokens[0] if tokens else ""
        cmd_name = first_token.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].lower()
        if cmd_name not in _ALLOWED_PREFIXES:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"command '{cmd_name}' not in whitelist (allowed: {', '.join(sorted(_ALLOWED_PREFIXES))})",
                duration_ms=0, backend="local", timed_out=False,
            )
        # 3. 执行(asyncio subprocess + 超时)
        try:
            full_env = {**os.environ, **env} if env else None
            if sys.platform == "win32":
                # Windows: shell 内置命令需用 shell 执行
                proc = await asyncio.create_subprocess_shell(
                    command,
                    cwd=workdir,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=full_env,
                )
            else:
                # Unix: 用 exec 避免 shell 注入(参数已通过白黑名单过滤)
                args = shlex.split(command)
                proc = await asyncio.create_subprocess_exec(
                    *args,
                    cwd=workdir,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=full_env,
                )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                return SandboxResult(
                    exit_code=-1, stdout="",
                    stderr=f"command timed out ({timeout}s)",
                    duration_ms=(time.monotonic() - start) * 1000,
                    backend="local", timed_out=True,
                )
            stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
            return SandboxResult(
                exit_code=proc.returncode if proc.returncode is not None else 0,
                stdout=stdout,
                stderr=stderr,
                duration_ms=(time.monotonic() - start) * 1000,
                backend="local",
                timed_out=False,
            )
        except FileNotFoundError:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"command not found: {first_token}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="local", timed_out=False,
            )
        except Exception as e:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"execution failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="local", timed_out=False,
            )

    async def _execute_docker(
        self,
        command: str,
        timeout: int,
        workdir: str,
        image: str,
        env: dict[str, str] | None,
    ) -> SandboxResult:
        """Docker 容器执行(通过 docker run CLI)。

        构造:docker run --rm -w <workdir> [-e KEY=VAL...] <image> sh -c "<command>"
        不挂载宿主机文件系统(安全隔离),如需文件传递用 stdin。
        """
        start = time.monotonic()
        args: list[str] = ["docker", "run", "--rm", "-w", workdir]
        if env:
            for k, v in env.items():
                args.extend(["-e", f"{k}={v}"])
        args.extend([image, "sh", "-c", command])
        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                return SandboxResult(
                    exit_code=-1, stdout="",
                    stderr=f"docker command timed out ({timeout}s)",
                    duration_ms=(time.monotonic() - start) * 1000,
                    backend="docker", timed_out=True,
                )
            stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
            return SandboxResult(
                exit_code=proc.returncode if proc.returncode is not None else 0,
                stdout=stdout,
                stderr=stderr,
                duration_ms=(time.monotonic() - start) * 1000,
                backend="docker",
                timed_out=False,
            )
        except FileNotFoundError:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr="docker CLI not found (install docker and add to PATH)",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="docker", timed_out=False,
            )
        except Exception as e:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"docker execution failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="docker", timed_out=False,
            )

    async def _execute_ssh(
        self,
        command: str,
        timeout: int,
        workdir: str,
        host: str,
        user: str,
        env: dict[str, str] | None,
    ) -> SandboxResult:
        """SSH 远程执行(通过 ssh CLI)。

        构造:ssh -o StrictHostKeyChecking=no <user>@<host> "cd <workdir> && export K=V && <command>"
        """
        start = time.monotonic()
        # 构造远程命令(cd 到 workdir + export env + 执行 command)
        remote_cmd = f"cd {shlex.quote(workdir)}"
        if env:
            for k, v in env.items():
                remote_cmd += f" && export {k}={shlex.quote(v)}"
        remote_cmd += f" && {command}"
        args = ["ssh", "-o", "StrictHostKeyChecking=no", f"{user}@{host}", remote_cmd]
        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                return SandboxResult(
                    exit_code=-1, stdout="",
                    stderr=f"ssh command timed out ({timeout}s)",
                    duration_ms=(time.monotonic() - start) * 1000,
                    backend="ssh", timed_out=True,
                )
            stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
            return SandboxResult(
                exit_code=proc.returncode if proc.returncode is not None else 0,
                stdout=stdout,
                stderr=stderr,
                duration_ms=(time.monotonic() - start) * 1000,
                backend="ssh",
                timed_out=False,
            )
        except FileNotFoundError:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr="ssh CLI not found (install openssh-client and add to PATH)",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="ssh", timed_out=False,
            )
        except Exception as e:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"ssh execution failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="ssh", timed_out=False,
            )


sandbox_executor = SandboxExecutor()
