"""沙箱执行器 — 对标 Hermes Agent 的 6 种执行后端。

Local:本地 subprocess,白黑名单 + 超时
Docker:通过 docker run 命令在容器内执行(不装 docker SDK,用 subprocess 调 docker CLI)
SSH:通过 ssh 命令在远程主机执行(不装 paramiko,用 subprocess 调 ssh CLI)
Modal:Modal 无服务器后端,通过 httpx 调 Modal HTTP API(不装 modal-python SDK)
Daytona:Daytona 云开发环境后端,通过 httpx 调 Daytona HTTP API(不装 daytona-sdk)
Singularity:HPC 集群后端,通过 subprocess 调 singularity CLI(类似 docker)
"""

import asyncio
import logging
import os
import re
import shlex
import sys
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


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
    """沙箱执行器,支持 Local/Docker/SSH/Modal/Daytona/Singularity 六种后端。"""

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
        image: str = "",
        resource_limits: dict[str, str | int] | None = None,
    ) -> SandboxResult:
        """执行命令。

        Args:
            command: 要执行的命令
            backend: local/docker/ssh/modal/daytona/singularity
            timeout: 超时秒数
            workdir: 工作目录
            docker_image: Docker 镜像(backend=docker 时,兼容旧字段)
            ssh_host: SSH 主机(backend=ssh 时)
            ssh_user: SSH 用户名
            env: 环境变量
            image: 镜像/函数标识(backend=modal/daytona/singularity 时优先使用,缺省回退 docker_image)
            resource_limits: 资源限制(cpu/memory/gpu 等,透传到后端)
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
        if backend == "modal":
            return await self._execute_modal(
                command, timeout, image or docker_image, env, resource_limits,
            )
        if backend == "daytona":
            return await self._execute_daytona(
                command, timeout, image or docker_image, env, resource_limits,
            )
        if backend == "singularity":
            return await self._execute_singularity(
                command, timeout, image or docker_image, env, resource_limits,
            )
        return SandboxResult(
            exit_code=-1, stdout="", stderr=f"unknown backend: {backend}",
            duration_ms=0, backend=backend, timed_out=False,
        )

    @staticmethod
    def _log_exec(backend: str, command: str, exit_code: int, duration_ms: float) -> None:
        """记录单次执行日志(命令截断 200 字符)。"""
        logger.info(
            "sandbox exec backend=%s cmd=%r exit=%d duration_ms=%.1f",
            backend, command[:200], exit_code, duration_ms,
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

    async def _execute_modal(
        self,
        command: str,
        timeout: int,
        image: str,
        env: dict[str, str] | None,
        resource_limits: dict[str, str | int] | None,
    ) -> SandboxResult:
        """Modal 无服务器后端(通过 httpx 调 Modal HTTP API,不依赖 modal-python SDK)。

        流程:
        1. 校验 MODAL_TOKEN_ID + MODAL_TOKEN_SECRET(credentials 缺失 → 降级)
        2. POST https://modal.com/api/v1/functions/invoke
        3. payload: function_id=image or "sandbox-exec", args={command, timeout, env, resource_limits}
        4. Authorization: Bearer {MODAL_TOKEN_ID}:{MODAL_TOKEN_SECRET}
        5. httpx timeout = timeout + 5(留出网络往返余量)
        """
        start = time.monotonic()
        token_id = os.environ.get("MODAL_TOKEN_ID", "")
        token_secret = os.environ.get("MODAL_TOKEN_SECRET", "")
        if not token_id or not token_secret:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr="Modal credentials not configured (set MODAL_TOKEN_ID + MODAL_TOKEN_SECRET)",
                duration_ms=0, backend="modal", timed_out=False,
            )
            self._log_exec("modal", command, result.exit_code, result.duration_ms)
            return result

        function_id = image or "sandbox-exec"
        payload = {
            "function_id": function_id,
            "args": {
                "command": command,
                "timeout": timeout,
                "env": env or {},
                "resource_limits": resource_limits or {},
            },
        }
        headers = {
            "Authorization": f"Bearer {token_id}:{token_secret}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=timeout + 5) as client:
                resp = await client.post(
                    "https://modal.com/api/v1/functions/invoke",
                    json=payload,
                    headers=headers,
                )
        except httpx.TimeoutException:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"Modal HTTP request timed out ({timeout + 5}s)",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="modal", timed_out=True,
            )
            self._log_exec("modal", command, result.exit_code, result.duration_ms)
            return result
        except httpx.HTTPError as e:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"Modal HTTP request failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="modal", timed_out=False,
            )
            self._log_exec("modal", command, result.exit_code, result.duration_ms)
            return result

        # 解析响应(stdout/stderr/exit_code)
        stdout = ""
        stderr = ""
        exit_code = -1
        timed_out = False
        if resp.status_code == 200:
            try:
                data = resp.json()
                stdout = str(data.get("stdout", ""))
                stderr = str(data.get("stderr", ""))
                exit_code = int(data.get("exit_code", -1))
                timed_out = bool(data.get("timed_out", False))
            except (ValueError, TypeError) as e:
                stderr = f"Modal response parse failed: {e}"
        else:
            stderr = f"Modal API returned HTTP {resp.status_code}: {resp.text[:200]}"
        result = SandboxResult(
            exit_code=exit_code, stdout=stdout, stderr=stderr,
            duration_ms=(time.monotonic() - start) * 1000,
            backend="modal", timed_out=timed_out,
        )
        self._log_exec("modal", command, result.exit_code, result.duration_ms)
        return result

    async def _execute_daytona(
        self,
        command: str,
        timeout: int,
        image: str,
        env: dict[str, str] | None,
        resource_limits: dict[str, str | int] | None,
    ) -> SandboxResult:
        """Daytona 云开发环境后端(通过 httpx 调 Daytona HTTP API,不依赖 daytona-sdk)。

        流程:
        1. 校验 DAYTONA_API_KEY + DAYTONA_SERVER_URL(credentials 缺失 → 降级)
        2. workspace_id 从 DAYTONA_WORKSPACE_ID 读取,缺省 "default"
        3. POST {DAYTONA_SERVER_URL}/workspaces/{workspace_id}/execute
        4. payload: {command, timeout, env, resource_limits, image}
        5. Authorization: Bearer {DAYTONA_API_KEY}
        """
        start = time.monotonic()
        api_key = os.environ.get("DAYTONA_API_KEY", "")
        server_url = os.environ.get("DAYTONA_SERVER_URL", "")
        if not api_key or not server_url:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr="Daytona credentials not configured (set DAYTONA_API_KEY + DAYTONA_SERVER_URL)",
                duration_ms=0, backend="daytona", timed_out=False,
            )
            self._log_exec("daytona", command, result.exit_code, result.duration_ms)
            return result

        workspace_id = os.environ.get("DAYTONA_WORKSPACE_ID", "default")
        # image 在 Daytona 语义下不直接使用(由 workspace 决定镜像),仅作为 metadata 透传
        payload = {
            "command": command,
            "timeout": timeout,
            "env": env or {},
            "resource_limits": resource_limits or {},
            "image": image or "",
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        # 拼接 URL,移除末尾斜杠避免双斜杠
        url = f"{server_url.rstrip('/')}/workspaces/{workspace_id}/execute"
        try:
            async with httpx.AsyncClient(timeout=timeout + 5) as client:
                resp = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"Daytona HTTP request timed out ({timeout + 5}s)",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="daytona", timed_out=True,
            )
            self._log_exec("daytona", command, result.exit_code, result.duration_ms)
            return result
        except httpx.HTTPError as e:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"Daytona HTTP request failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="daytona", timed_out=False,
            )
            self._log_exec("daytona", command, result.exit_code, result.duration_ms)
            return result

        # 解析响应(stdout/stderr/exit_code)
        stdout = ""
        stderr = ""
        exit_code = -1
        timed_out = False
        if resp.status_code == 200:
            try:
                data = resp.json()
                stdout = str(data.get("stdout", ""))
                stderr = str(data.get("stderr", ""))
                exit_code = int(data.get("exit_code", -1))
                timed_out = bool(data.get("timed_out", False))
            except (ValueError, TypeError) as e:
                stderr = f"Daytona response parse failed: {e}"
        else:
            stderr = f"Daytona API returned HTTP {resp.status_code}: {resp.text[:200]}"
        result = SandboxResult(
            exit_code=exit_code, stdout=stdout, stderr=stderr,
            duration_ms=(time.monotonic() - start) * 1000,
            backend="daytona", timed_out=timed_out,
        )
        self._log_exec("daytona", command, result.exit_code, result.duration_ms)
        return result

    async def _execute_singularity(
        self,
        command: str,
        timeout: int,
        image: str,
        env: dict[str, str] | None,
        resource_limits: dict[str, str | int] | None,
    ) -> SandboxResult:
        """HPC 集群 Singularity 后端(通过 subprocess 调 singularity CLI,类似 docker)。

        流程:
        1. 探测 singularity CLI 可用性(singularity --version 子进程)
        2. 缺省镜像 "library://sylabsed/examples/default:latest"
        3. 环境变量透传 SINGULARITYENV_{KEY}=value
        4. 资源限制:--memory / --cpus / --nv(gpu)等透传
        5. 构造:singularity exec [--memory X] [--cpus Y] [--nv] <image> sh -c "<command>"
        """
        start = time.monotonic()
        # 1. 检测 singularity CLI 可用性
        try:
            probe = await asyncio.create_subprocess_exec(
                "singularity", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                await asyncio.wait_for(probe.communicate(), timeout=10)
            except asyncio.TimeoutError:
                try:
                    probe.kill()
                except ProcessLookupError:
                    pass
                result = SandboxResult(
                    exit_code=-1, stdout="",
                    stderr="Singularity CLI probe timed out",
                    duration_ms=(time.monotonic() - start) * 1000,
                    backend="singularity", timed_out=False,
                )
                self._log_exec("singularity", command, result.exit_code, result.duration_ms)
                return result
            if probe.returncode != 0:
                result = SandboxResult(
                    exit_code=-1, stdout="",
                    stderr="Singularity CLI not found (install singularity to use this backend)",
                    duration_ms=(time.monotonic() - start) * 1000,
                    backend="singularity", timed_out=False,
                )
                self._log_exec("singularity", command, result.exit_code, result.duration_ms)
                return result
        except FileNotFoundError:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr="Singularity CLI not found (install singularity to use this backend)",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="singularity", timed_out=False,
            )
            self._log_exec("singularity", command, result.exit_code, result.duration_ms)
            return result
        except Exception as e:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"Singularity CLI probe failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="singularity", timed_out=False,
            )
            self._log_exec("singularity", command, result.exit_code, result.duration_ms)
            return result

        # 2. 构造命令行
        image_final = image or "library://sylabsed/examples/default:latest"
        args: list[str] = ["singularity", "exec"]
        # 资源限制透传(memory/cpus/gpu)
        if resource_limits:
            if "memory" in resource_limits:
                args.extend(["--memory", str(resource_limits["memory"])])
            if "cpus" in resource_limits:
                args.extend(["--cpus", str(resource_limits["cpus"])])
            if "gpu" in resource_limits and resource_limits["gpu"]:
                args.append("--nv")
        args.extend([image_final, "sh", "-c", command])
        # 3. env 透传:SINGULARITYENV_{KEY}=value
        full_env = {**os.environ}
        if env:
            for k, v in env.items():
                full_env[f"SINGULARITYENV_{k}"] = str(v)
        # 4. 执行
        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
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
                result = SandboxResult(
                    exit_code=-1, stdout="",
                    stderr=f"singularity command timed out ({timeout}s)",
                    duration_ms=(time.monotonic() - start) * 1000,
                    backend="singularity", timed_out=True,
                )
                self._log_exec("singularity", command, result.exit_code, result.duration_ms)
                return result
            stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
            result = SandboxResult(
                exit_code=proc.returncode if proc.returncode is not None else 0,
                stdout=stdout, stderr=stderr,
                duration_ms=(time.monotonic() - start) * 1000,
                backend="singularity", timed_out=False,
            )
            self._log_exec("singularity", command, result.exit_code, result.duration_ms)
            return result
        except Exception as e:
            result = SandboxResult(
                exit_code=-1, stdout="",
                stderr=f"singularity execution failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
                backend="singularity", timed_out=False,
            )
            self._log_exec("singularity", command, result.exit_code, result.duration_ms)
            return result


sandbox_executor = SandboxExecutor()
