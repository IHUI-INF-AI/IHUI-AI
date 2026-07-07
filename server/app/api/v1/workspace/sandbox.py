"""
容器沙箱 + 网络隔离模块 — 对标 Codex sandbox_mode 三档 (P0 缺口补齐)。

三档沙箱模式 (对标 Codex):
- READ_ONLY:           只读挂载, 网络隔离, 拒绝任何写操作
- WORKSPACE_WRITE:     读写挂载 (仅工作区), 网络隔离
- DANGER_FULL_ACCESS:  完全放开 (无沙箱, 无网络隔离) — 等价于直接执行

执行策略 (自动降级):
1. Docker 隔离 (优先): docker run --rm 挂载工作区, --network none 隔离网络
   - READ_ONLY:       只读挂载 (:ro)
   - WORKSPACE_WRITE: 读写挂载 (:rw), 写操作仅限工作区目录
   - DANGER:          不走 Docker, 直接在本机执行
2. 进程级隔离 (降级): Docker 不可用 / 镜像缺失 / 容器执行失败时降级
   - asyncio subprocess + 工作目录锁定 + 环境变量清理 + 超时 + 输出截断 + 命令黑名单

网络隔离:
- Docker 模式: --network none (内核级隔离)
- 进程模式:   拦截网络命令 (curl/wget/nc/ssh/Invoke-WebRequest 等)

可写路径限制:
- Docker 模式: 仅挂载工作区, 容器无法触碰宿主机其他路径 (WORKSPACE_WRITE 读写 / READ_ONLY 只读)
- 进程模式:   工作目录锁定到 workspace (best-effort, 无内核级强制)

Windows 兼容: 项目运行在 Windows, Docker Desktop 可用则用容器隔离, 否则降级进程级。
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
import sys
from enum import Enum
from pathlib import Path
from typing import Any

from loguru import logger

IS_WINDOWS = sys.platform == "win32"

# 沙箱容器默认镜像 (轻量, 启动快)。可按部署环境覆盖: 环境变量 IHUI_SANDBOX_IMAGE。
# 注意: 需预先 `docker pull <image>` 才会启用 Docker 路径, 否则降级为进程级隔离。
DEFAULT_SANDBOX_IMAGE = os.environ.get("IHUI_SANDBOX_IMAGE", "alpine:3.19")

# 输出截断上限 (与 tools.tool_run_command 保持一致)
MAX_STDOUT = 5000
MAX_STDERR = 3000

# 拦截的网络命令 (READ_ONLY / WORKSPACE_WRITE 模式下阻断)
NETWORK_COMMANDS: list[str] = [
    "curl", "wget", "nc", "netcat", "ncat", "ssh", "scp", "sftp",
    "rsync", "telnet", "ftp",
    # PowerShell 网络命令
    "Invoke-WebRequest", "Invoke-RestMethod", "iwr", "irm",
]

# 敏感环境变量关键词 (进程级降级时移除, 防止凭证泄漏到子进程)
SENSITIVE_ENV_KEYWORDS: list[str] = [
    "API_KEY", "SECRET", "TOKEN", "PASSWORD", "PASSWD", "CREDENTIAL",
    "PRIVATE_KEY", "AWS_", "AZURE_", "GCP_", "GOOGLE_APPLICATION",
    "OPENAI", "ANTHROPIC", "DATABASE_URL", "REDIS_URL", "SSH_AUTH",
]

__all__ = [
    "SandboxMode",
    "SandboxExecutor",
    "execute_in_sandbox",
    "resolve_sandbox_mode",
    "is_docker_available",
    "check_network_command",
    "reset_docker_cache",
]


# ---------------------------------------------------------------------------
# 沙箱模式
# ---------------------------------------------------------------------------

class SandboxMode(str, Enum):
    """沙箱模式 (对标 Codex sandbox_mode)。"""

    READ_ONLY = "read-only"
    WORKSPACE_WRITE = "workspace-write"
    DANGER_FULL_ACCESS = "danger-full-access"


# 外部字符串 -> SandboxMode 别名表 (兼容中划线/下划线/简写)
_MODE_ALIASES: dict[str, SandboxMode] = {
    "read-only": SandboxMode.READ_ONLY,
    "readonly": SandboxMode.READ_ONLY,
    "ro": SandboxMode.READ_ONLY,
    "workspace-write": SandboxMode.WORKSPACE_WRITE,
    "workspace_write": SandboxMode.WORKSPACE_WRITE,
    "write": SandboxMode.WORKSPACE_WRITE,
    "danger-full-access": SandboxMode.DANGER_FULL_ACCESS,
    "danger_full_access": SandboxMode.DANGER_FULL_ACCESS,
    "danger": SandboxMode.DANGER_FULL_ACCESS,
    "full": SandboxMode.DANGER_FULL_ACCESS,
    "full-access": SandboxMode.DANGER_FULL_ACCESS,
}


def resolve_sandbox_mode(mode: str | SandboxMode) -> SandboxMode:
    """将外部字符串/枚举归一化为 SandboxMode。未知值抛 ValueError。"""
    if isinstance(mode, SandboxMode):
        return mode
    key = str(mode).strip().lower()
    if key not in _MODE_ALIASES:
        raise ValueError(
            f"未知沙箱模式: {mode!r}. 可用: read-only / workspace-write / danger-full-access"
        )
    return _MODE_ALIASES[key]


def _is_network_restricted(mode: SandboxMode) -> bool:
    """READ_ONLY / WORKSPACE_WRITE 模式下网络受限。"""
    return mode in (SandboxMode.READ_ONLY, SandboxMode.WORKSPACE_WRITE)


# ---------------------------------------------------------------------------
# 安全检查
# ---------------------------------------------------------------------------

def check_network_command(command: str) -> str | None:
    """检查命令是否包含网络操作。命中返回拒绝原因, 否则返回 None。

    使用词边界匹配, 避免误伤文件名 (如 curl_test.py 不会命中)。
    """
    for cmd in NETWORK_COMMANDS:
        if re.search(rf"\b{re.escape(cmd)}\b", command, re.IGNORECASE):
            return (
                f"网络命令被沙箱策略拦截: {cmd} "
                f"(READ_ONLY/WORKSPACE_WRITE 模式禁止网络访问)"
            )
    return None


def _check_shell_blacklist(command: str) -> str | None:
    """复用 tools.check_shell_blacklist (惰性导入避免循环依赖)。"""
    from app.api.v1.workspace.tools import check_shell_blacklist

    return check_shell_blacklist(command)


def _clean_env(env: dict[str, str] | None = None) -> dict[str, str]:
    """清理敏感环境变量 (进程级降级防护)。保留 PATH/SystemRoot 等运行所需变量。"""
    src = env if env is not None else dict(os.environ)
    cleaned: dict[str, str] = {}
    for key, value in src.items():
        upper = key.upper()
        if any(kw in upper for kw in SENSITIVE_ENV_KEYWORDS):
            continue
        cleaned[key] = value
    # Windows 运行必需变量强制保留 (powershell/cmd 依赖)
    if IS_WINDOWS:
        for required in ("SystemRoot", "COMSPEC", "TEMP", "TMP"):
            if required in os.environ and required not in cleaned:
                cleaned[required] = os.environ[required]
    return cleaned


# ---------------------------------------------------------------------------
# Docker 可用性检测 (带缓存)
# ---------------------------------------------------------------------------

_docker_available: bool | None = None


def is_docker_available() -> bool:
    """检测 Docker 是否可用 (命令存在 + 守护进程运行)。结果进程内缓存。"""
    global _docker_available
    if _docker_available is not None:
        return _docker_available
    if not shutil.which("docker"):
        _docker_available = False
        return False
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        _docker_available = result.returncode == 0
    except Exception as e:
        logger.debug(f"Docker 守护进程检测失败: {e}")
        _docker_available = False
    if not _docker_available:
        logger.info("Docker 不可用, 沙箱将降级为进程级隔离")
    return _docker_available


def _docker_image_exists(image: str) -> bool:
    """检查镜像是否本地存在 (避免触发耗时拉取)。"""
    try:
        result = subprocess.run(
            ["docker", "image", "inspect", image],
            capture_output=True,
            timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


def reset_docker_cache() -> None:
    """重置 Docker 可用性缓存 (测试/运维用)。"""
    global _docker_available
    _docker_available = None


# ---------------------------------------------------------------------------
# 沙箱执行器
# ---------------------------------------------------------------------------

class SandboxExecutor:
    """沙箱执行器 — 优先 Docker 隔离, 自动降级为进程级隔离。

    用法:
        executor = SandboxExecutor()
        result = await executor.execute("ls -la", "/workspace", "workspace-write", 60000)
    """

    def __init__(self, image: str = DEFAULT_SANDBOX_IMAGE):
        self.image = image

    async def execute(
        self,
        command: str,
        workspace: str,
        mode: str | SandboxMode,
        timeout_ms: int = 60000,
        cwd: str | None = None,
    ) -> dict[str, Any]:
        """在沙箱中执行命令。

        Args:
            command:    要执行的 shell 命令
            workspace:  工作区绝对路径 (沙箱边界)
            mode:       沙箱模式 read-only / workspace-write / danger-full-access
            timeout_ms: 超时毫秒
            cwd:        工作目录 (相对 workspace 或绝对), 默认 workspace 根

        Returns:
            {"success": bool, "stdout": str, "stderr": str,
             "returncode": int, "sandboxed": bool,
             "method": "docker"|"process"|"none"|"policy"}
        """
        mode_enum = resolve_sandbox_mode(mode)
        timeout_s = max(int(timeout_ms) / 1000, 1)

        # 1. 公共安全层: 命令黑名单 (所有模式均拦截高危命令, 沙箱前先检查)
        denial = _check_shell_blacklist(command)
        if denial:
            logger.warning(f"[sandbox] 命令命中黑名单: {denial} | cmd={command[:120]}")
            return _blocked_result(denial)

        # 2. DANGER_FULL_ACCESS: 直接执行, 无沙箱无网络隔离
        if mode_enum == SandboxMode.DANGER_FULL_ACCESS:
            return await self._execute_raw(command, workspace, timeout_s, cwd)

        # 3. 网络命令拦截 (READ_ONLY / WORKSPACE_WRITE)
        net_denial = check_network_command(command)
        if net_denial:
            logger.warning(f"[sandbox] {net_denial} | cmd={command[:120]}")
            return _blocked_result(net_denial)

        # 4. Docker 隔离 (优先): 仅当 Docker 可用且镜像本地存在时启用
        if is_docker_available() and _docker_image_exists(self.image):
            try:
                return await self._execute_docker(
                    command, workspace, mode_enum, timeout_s, cwd
                )
            except Exception as e:
                # 容器执行失败 (挂载/权限/镜像异常等) -> 降级进程级
                logger.warning(f"Docker 沙箱执行失败, 降级为进程级隔离: {e}")

        # 5. 进程级隔离 (降级 / Docker 不可用)
        return await self._execute_process(command, workspace, mode_enum, timeout_s, cwd)

    # ---- DANGER: 直接执行 (无沙箱) -------------------------------------

    async def _execute_raw(
        self, command: str, workspace: str, timeout_s: float, cwd: str | None
    ) -> dict[str, Any]:
        """直接在本机执行 (DANGER_FULL_ACCESS), 无沙箱无网络隔离。"""
        cwd_path = self._resolve_cwd(cwd, workspace)
        shell_args = self._native_shell_args(command)
        logger.debug(f"[sandbox:none] 直接执行 (无沙箱): {command[:120]}")
        return await self._run_subprocess(
            shell_args, cwd=str(cwd_path), timeout_s=timeout_s,
            env=None, method="none", sandboxed=False,
        )

    # ---- Docker 隔离 ----------------------------------------------------

    async def _execute_docker(
        self,
        command: str,
        workspace: str,
        mode: SandboxMode,
        timeout_s: float,
        cwd: str | None,
    ) -> dict[str, Any]:
        """Docker 容器内执行。

        - READ_ONLY:      只读挂载 (:ro), 容器内写操作被文件系统拒绝
        - WORKSPACE_WRITE: 读写挂载 (:rw), 写操作仅限 /workspace (宿主机工作区)
        - 网络:           --network none (内核级隔离)
        - 资源限制:       512m 内存 / 1 CPU (防资源滥用)
        """
        host_path = str(Path(workspace).resolve()).replace("\\", "/")
        mount_mode = "ro" if mode == SandboxMode.READ_ONLY else "rw"
        volume = f"{host_path}:/workspace:{mount_mode}"
        container_cwd = self._container_cwd(cwd, workspace)

        docker_args = [
            "docker", "run", "--rm",
            "--network", "none",
            "--memory", "512m",
            "--cpus", "1.0",
            "-v", volume,
            "-w", container_cwd,
            self.image,
            "/bin/sh", "-c", command,
        ]
        logger.debug(
            f"[sandbox:docker] mode={mode.value} mount={mount_mode} "
            f"cwd={container_cwd} cmd={command[:120]}"
        )
        # docker CLI 继承宿主环境即可 (PATH 用于定位 docker); 容器内环境由 docker 重置
        return await self._run_subprocess(
            docker_args, cwd=None, timeout_s=timeout_s,
            env=None, method="docker", sandboxed=True,
        )

    # ---- 进程级隔离 (降级) ---------------------------------------------

    async def _execute_process(
        self,
        command: str,
        workspace: str,
        mode: SandboxMode,
        timeout_s: float,
        cwd: str | None,
    ) -> dict[str, Any]:
        """进程级隔离 (Docker 不可用时降级)。

        防护措施:
        - 工作目录锁定到 workspace (越界/不存在则回退 workspace)
        - 环境变量清理 (移除敏感凭证变量)
        - 超时控制 + 输出截断
        - 命令黑名单已在 execute() 入口检查
        - 网络命令已在 execute() 入口拦截 (READ_ONLY/WORKSPACE_WRITE)

        注: 进程级无法做到内核级写路径限制, READ_ONLY 的写防护为 best-effort。
        """
        cwd_path = self._resolve_cwd(cwd, workspace)
        shell_args = self._native_shell_args(command)
        cleaned_env = _clean_env()
        logger.debug(
            f"[sandbox:process] mode={mode.value} cwd={cwd_path} cmd={command[:120]}"
        )
        return await self._run_subprocess(
            shell_args, cwd=str(cwd_path), timeout_s=timeout_s,
            env=cleaned_env, method="process", sandboxed=True,
        )

    # ---- 底层 subprocess 执行 ------------------------------------------

    async def _run_subprocess(
        self,
        args: list[str],
        cwd: str | None,
        timeout_s: float,
        env: dict[str, str] | None,
        method: str,
        sandboxed: bool,
    ) -> dict[str, Any]:
        """统一执行子进程, 处理超时 / 输出截断 / 错误。"""
        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.DEVNULL,
                cwd=cwd,
                env=env,
            )
        except FileNotFoundError as e:
            return _error_result(f"执行器启动失败 (命令未找到): {e}", method, sandboxed)
        except Exception as e:
            return _error_result(f"执行器启动异常: {e}", method, sandboxed)

        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=timeout_s
            )
        except asyncio.TimeoutError:
            await _kill_proc(proc)
            return {
                "success": False,
                "stdout": "",
                "stderr": f"命令超时 ({int(timeout_s * 1000)}ms)",
                "returncode": -1,
                "sandboxed": sandboxed,
                "method": method,
            }
        except Exception as e:
            await _kill_proc(proc)
            return _error_result(f"执行异常: {e}", method, sandboxed)

        stdout = _decode(stdout_b)[:MAX_STDOUT]
        stderr = _decode(stderr_b)[:MAX_STDERR]
        returncode = proc.returncode if proc.returncode is not None else -1
        return {
            "success": returncode == 0,
            "stdout": stdout,
            "stderr": stderr,
            "returncode": returncode,
            "sandboxed": sandboxed,
            "method": method,
        }

    # ---- 路径 / Shell 工具 ---------------------------------------------

    @staticmethod
    def _resolve_cwd(cwd: str | None, workspace: str) -> Path:
        """解析工作目录, 锁定在 workspace 下 (越界/不存在则回退 workspace)。"""
        ws = Path(workspace).resolve()
        if not cwd:
            return ws
        p = Path(cwd)
        target = p.resolve() if p.is_absolute() else (ws / p).resolve()
        if not target.exists() or not _is_within(target, ws):
            return ws
        return target

    @staticmethod
    def _container_cwd(cwd: str | None, workspace: str) -> str:
        """计算容器内工作目录 (workspace 挂载于 /workspace)。"""
        if not cwd:
            return "/workspace"
        ws = Path(workspace).resolve()
        p = Path(cwd)
        target = p.resolve() if p.is_absolute() else (ws / p).resolve()
        try:
            rel = target.relative_to(ws)
        except ValueError:
            return "/workspace"
        rel_str = rel.as_posix()
        return "/workspace" if rel_str in ("", ".") else f"/workspace/{rel_str}"

    @staticmethod
    def _native_shell_args(command: str) -> list[str]:
        """本机 shell 调用参数 (DANGER / 进程级降级用)。"""
        if IS_WINDOWS:
            return ["powershell", "-NoProfile", "-Command", command]
        return ["/bin/bash", "-c", command]


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def _is_within(child: Path, parent: Path) -> bool:
    """child 是否在 parent 目录内。"""
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def _decode(data: bytes | None) -> str:
    """解码子进程输出 (容错多编码)。"""
    if not data:
        return ""
    for enc in ("utf-8", "gbk", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


async def _kill_proc(proc: asyncio.subprocess.Process) -> None:
    """尽力终止子进程 (超时/异常清理)。"""
    try:
        if proc.returncode is None:
            proc.kill()
            await asyncio.wait_for(proc.wait(), timeout=3)
    except Exception:
        pass


def _blocked_result(reason: str) -> dict[str, Any]:
    """构造被安全策略拦截的结果 (黑名单 / 网络命令)。"""
    return {
        "success": False,
        "stdout": "",
        "stderr": f"命令被安全策略拦截: {reason}",
        "returncode": -1,
        "sandboxed": True,
        "method": "policy",
    }


def _error_result(message: str, method: str, sandboxed: bool) -> dict[str, Any]:
    """构造执行器错误结果。"""
    return {
        "success": False,
        "stdout": "",
        "stderr": message,
        "returncode": -1,
        "sandboxed": sandboxed,
        "method": method,
    }


# ---------------------------------------------------------------------------
# 对外入口 (模块级便捷函数)
# ---------------------------------------------------------------------------

# 全局默认执行器实例 (复用; Docker 检测开销由 is_docker_available 缓存承担)
_default_executor = SandboxExecutor()


async def execute_in_sandbox(
    command: str,
    workspace: str,
    mode: str,
    timeout_ms: int = 60000,
    cwd: str | None = None,
) -> dict[str, Any]:
    """在沙箱中执行命令 (模块级便捷入口)。

    Args:
        command:    要执行的 shell 命令
        workspace:  工作区绝对路径 (沙箱边界)
        mode:       沙箱模式 read-only / workspace-write / danger-full-access
        timeout_ms: 超时毫秒, 默认 60000
        cwd:        工作目录 (相对 workspace 或绝对), 默认 workspace 根

    Returns:
        dict: {"success": bool, "stdout": str, "stderr": str,
               "returncode": int, "sandboxed": bool,
               "method": "docker"|"process"|"none"|"policy"}

    沙箱策略:
        read-only           -> 只读 + 网络隔离 (Docker :ro + --network none)
        workspace-write     -> 仅写工作区 + 网络隔离 (Docker :rw + --network none)
        danger-full-access  -> 完全放开, 直接本机执行 (仍过命令黑名单)

    降级: Docker 不可用/镜像缺失/容器失败时自动降级为进程级隔离。
    """
    return await _default_executor.execute(command, workspace, mode, timeout_ms, cwd)
