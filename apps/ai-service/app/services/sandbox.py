# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱执行器 — 对标 Hermes Agent 的 6 种执行后端。

Local:本地 subprocess,白黑名单 + 超时
Docker:通过 docker run 命令在容器内执行(不装 docker SDK,用 subprocess 调 docker CLI)
SSH:通过 ssh 命令在远程主机执行(不装 paramiko,用 subprocess 调 ssh CLI)
Modal:Modal 无服务器后端,通过 httpx 调 Modal HTTP API(不装 modal-python SDK)
Daytona:Daytona 云开发环境后端,通过 httpx 调 Daytona HTTP API(不装 daytona-sdk)
Singularity:HPC 集群后端,通过 subprocess 调 singularity CLI(类似 docker)
"""

import asyncio
import contextlib
import logging
import os
import re
import shlex
import sys
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


def _exec_shell_detect_enabled_from_env() -> bool:
    """批58 接线(对标 codex shell_detect.rs):经 shell_detect 派生执行 argv。

    默认 off:走现状 create_subprocess_shell(逐字节等价);设为 on/1/true/yes 时
    经 detect_shell_type + derive_exec_args 派生显式 argv,避免隐式 shell 差异。
    """
    return os.environ.get("EXEC_SHELL_DETECT_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _exec_capture_policy_enabled_from_env() -> bool:
    """批58 接线(对标 codex exec.rs):输出捕获策略档位。

    默认 off:输出原样返回(逐字节等价);设为 on/1/true/yes 时按
    EXEC_CAPTURE_POLICY(默认 shell_tool)档位对 stdout/stderr 施加保留上限。
    """
    return os.environ.get("EXEC_CAPTURE_POLICY_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )


def _derive_windows_exec_args(command: str) -> list[str] | None:
    """Windows 下经 shell_detect 派生显式执行 argv;off 或派生失败返回 None。

    返回 None 时调用方回落 create_subprocess_shell,保证 off 路径与现状逐字节等价;
    任何异常均降级返回 None(绝不阻塞命令执行)。
    """
    if not _exec_shell_detect_enabled_from_env():
        return None
    try:
        from app.core.shell_detect import (
            ShellType,
            derive_exec_args,
            detect_shell_type,
            find_shell,
        )

        shell_path = find_shell(ShellType.Cmd) or os.environ.get("COMSPEC") or "cmd.exe"
        shell_type = detect_shell_type(shell_path)
        argv = derive_exec_args(shell_type, shell_path, command)
        return argv if argv else None
    except Exception as e:  # noqa: BLE001 - 派生失败降级回落现状
        logger.warning("shell_detect 派生失败(回落 create_subprocess_shell): %s", e)
        return None


def _apply_exec_capture_policy(stdout: str, stderr: str) -> tuple[str, str]:
    """按 ExecCapturePolicy 档位对输出施加保留上限(仅 on 时调用)。

    未配置上限或档位无上限时原样返回;异常降级原样返回(绝不吞掉输出)。
    """
    try:
        from app.core.exec_params import ExecCapturePolicy

        raw = os.environ.get("EXEC_CAPTURE_POLICY", ExecCapturePolicy.SHELL_TOOL.value)
        policy = ExecCapturePolicy(raw.strip())
        cap = policy.retained_bytes_cap()
        if cap is None:
            return stdout, stderr
        if len(stdout) > cap:
            stdout = stdout[:cap] + "\n…[输出已按捕获策略截断]"
        if len(stderr) > cap:
            stderr = stderr[:cap] + "\n…[输出已按捕获策略截断]"
        return stdout, stderr
    except Exception as e:  # noqa: BLE001 - 策略应用失败降级原样返回
        logger.warning("输出捕获策略应用失败(降级原样返回): %s", e)
        return stdout, stderr


class SandboxError(Exception):
    """沙箱安全异常(灾难性命令拦截,2026-07-22 立)。"""


# ===========================================================================
# G-212 第十一批(2026-10-22):沙箱默认严档(safe by default)
# ---------------------------------------------------------------------------
# 立项依据(改动前现读):本模块 ``execute()`` 的缺省值是「local + timeout=60
# + workdir="." + 继承整份 os.environ」,且没有档位名、没有超时上限、没有网络
# 开关;``_execute_local`` 只要首 token 在白名单内就会把宿主环境原样交给子进程。
# 于是"未配置"等于"最宽松":网络可达(白名单里的 python/node/pytest 都能发请求)、
# 写路径等于调用方给的任意 workdir、子进程能读到宿主全部密钥。
#
# 严档语义(缺省即此档,不需要任何配置):
#   - network: 拒绝;显式请求 allow_network=True 在严档下直接拒绝执行;
#   - timeout: 必须是正整数秒,且被压到 60s 上限(超出部分截断并留审计日志);
#   - workdir: 必须落在服务端工作区根(MCP_WORKSPACE_ROOTS,缺省=进程 cwd)内;
#   - env: 只给系统运行时必需的少量变量 + 调用方显式传入的 env,不再整份继承;
#   - 命令: 沿用下方 _ALLOWED_PREFIXES 白名单与 _DANGEROUS_PATTERNS 黑名单。
#
# 放宽通道(必须显式 opt-in):环境变量 ``SANDBOX_EXEC_TIER=relaxed``。选了
# relaxed 会打印一条 WARNING 审计日志(含档位名);档位值拼错/未知一律
# fail-closed 抛 SandboxError,**不回退**到严档、也不猜。
# ===========================================================================

SANDBOX_TIER_STRICT = "strict"
SANDBOX_TIER_RELAXED = "relaxed"
DEFAULT_SANDBOX_TIER = SANDBOX_TIER_STRICT
#: 唯一的放宽开关名(取值: strict / relaxed;空/未设置 = strict)
SANDBOX_TIER_ENV = "SANDBOX_EXEC_TIER"
#: 严档超时上限(秒)。既有调用方缺省 timeout=60,故取 60 不改变既有基线。
STRICT_TIMEOUT_CEILING_S = 60
#: 放宽档超时上限(秒),仍须显式 opt-in 才生效。
RELAXED_TIMEOUT_CEILING_S = 3600


@dataclass(frozen=True)
class SandboxExecutionProfile:
    """执行档位:只由服务端配置决定,调用方参数只能在档位内收窄。"""

    tier: str
    allow_network: bool
    full_env: bool
    allow_unconfined_workdir: bool
    timeout_ceiling_s: int


#: 档位登记表(唯一真源)。新增档位必须同时补 tests/test_g212_sandbox_strict_default.py。
SANDBOX_EXECUTION_PROFILES: dict[str, SandboxExecutionProfile] = {
    SANDBOX_TIER_STRICT: SandboxExecutionProfile(
        tier=SANDBOX_TIER_STRICT,
        allow_network=False,
        full_env=False,
        allow_unconfined_workdir=False,
        timeout_ceiling_s=STRICT_TIMEOUT_CEILING_S,
    ),
    SANDBOX_TIER_RELAXED: SandboxExecutionProfile(
        tier=SANDBOX_TIER_RELAXED,
        allow_network=True,
        full_env=True,
        allow_unconfined_workdir=True,
        timeout_ceiling_s=RELAXED_TIMEOUT_CEILING_S,
    ),
}

#: 严档下允许继承的宿主环境变量:只放系统运行时必需项,不放任何密钥类键。
_STRICT_ENV_ALLOWLIST: tuple[str, ...] = (
    "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "PATHEXT",
    "PATH", "TEMP", "TMP", "HOME", "USERPROFILE", "LANG", "LC_ALL", "TZ",
    "PYTHONPATH", "PYTHONHOME", "PYTHONIOENCODING", "VIRTUAL_ENV",
)


def resolve_execution_profile(raw: str | None = None) -> SandboxExecutionProfile:
    """档位名 → 档位条目。缺省/空串 = strict;未知值 → SandboxError(fail-closed)。"""
    value = os.environ.get(SANDBOX_TIER_ENV, "") if raw is None else raw
    key = value.strip().lower() if isinstance(value, str) else ""
    if not key:
        return SANDBOX_EXECUTION_PROFILES[DEFAULT_SANDBOX_TIER]
    profile = SANDBOX_EXECUTION_PROFILES.get(key)
    if profile is None:
        raise SandboxError(
            f"未知沙箱执行档位: {value!r};可用档位: "
            f"{sorted(SANDBOX_EXECUTION_PROFILES)} (设置 {SANDBOX_TIER_ENV}=relaxed 才放宽)"
        )
    return profile


def _workspace_roots() -> list[str]:
    """服务端工作区根:与 mcp_server._get_workspace_roots 同一配置键与解析口径。

    空值(本仓 .env.example 即 ``MCP_WORKSPACE_ROOTS=``)按 config.py 的契约
    "空=用当前工作目录"回落到进程 cwd —— 回落目标仍是服务端自身工作区的有界
    根,不是"放行任意路径";只有显式配置了根目录才按配置收敛。
    """
    raw = os.environ.get("MCP_WORKSPACE_ROOTS", "") or ""
    roots = [os.path.abspath(root) for root in raw.split(os.pathsep) if root.strip()]
    return roots or [os.path.abspath(os.getcwd())]


def _path_within(path: str, root: str) -> bool:
    """组件级前缀判断(不做字符串 startsWith,防 /work 命中 /workspace-evil)。"""
    path_norm = os.path.normcase(os.path.abspath(path))
    root_norm = os.path.normcase(os.path.abspath(root))
    try:
        relative = os.path.relpath(path_norm, root_norm)
    except ValueError:
        return False
    return relative == "." or (
        not relative.startswith("..") and not os.path.isabs(relative)
    )


def _resolve_workdir(profile: SandboxExecutionProfile, workdir: str | None) -> str:
    """workdir 收敛:严档必须落在工作区根内;放宽档才允许越界(并留审计)。"""
    candidate = os.path.abspath(workdir or ".")
    if profile.allow_unconfined_workdir:
        return candidate
    roots = _workspace_roots()
    if not any(_path_within(candidate, root) for root in roots):
        raise SandboxError(
            f"workdir 越出服务端工作区根(MCP_WORKSPACE_ROOTS): {candidate};"
            f"根集合: {roots}"
        )
    return candidate


def _resolve_timeout(profile: SandboxExecutionProfile, timeout: int) -> int:
    """超时收敛:非法值拒绝执行;超出档位上限时截断并留审计日志。"""
    if isinstance(timeout, bool) or not isinstance(timeout, int) or timeout <= 0:
        raise SandboxError(f"timeout 必须为正整数秒,得到 {timeout!r}")
    if timeout > profile.timeout_ceiling_s:
        logger.warning(
            "sandbox timeout 超出档位上限,已截断 tier=%s ceiling=%ss requested=%ss",
            profile.tier, profile.timeout_ceiling_s, timeout,
        )
        return profile.timeout_ceiling_s
    return timeout


def _strict_child_env(extra: dict[str, str] | None) -> dict[str, str]:
    """严档子进程环境:系统必需变量白名单 + 调用方显式传入的键。"""
    child = {key: os.environ[key] for key in _STRICT_ENV_ALLOWLIST if key in os.environ}
    if extra:
        child.update(extra)
    return child


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

# 灾难性命令模式(补充黑名单,匹配即抛 SandboxError,防止 python -c 等绕过,2026-07-22 立)
# 与 _DANGEROUS_PATTERNS 区别:后者返回错误结果,前者直接抛异常(灾难性不可恢复)
_DESTRUCTIVE_PATTERNS: list[tuple[str, str]] = [
    (r"rm\s+-rf?\s+/(?:\s|$|/.*)", "rm -rf / (删除根目录)"),
    (r"rm\s+-rf?\s+~(?:\s|$)", "rm -rf ~ (删除家目录)"),
    (r"rm\s+-rf?\s+\$HOME(?:\s|$)", "rm -rf $HOME (删除家目录)"),
    (r"\bmkfs\b", "mkfs (格式化文件系统)"),
    (r"dd\s+.*\bof=/dev/", "dd of=/dev/ (写入块设备)"),
    (r":\s*\(\)\s*\{\s*:\|.*?\}\s*;", ":(){:|:&};: (fork bomb)"),
    (r">\s*/dev/sd", "> /dev/sda (覆写磁盘设备)"),
    (r"chmod\s+-R\s+777\s+/(?:\s|$)", "chmod -R 777 / (全盘权限开放)"),
]


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
        allow_network: bool = False,
    ) -> SandboxResult:
        """执行命令(默认严档:网络拒绝 / 超时上限 / workdir 收敛 / env 白名单)。

        Args:
            command: 要执行的命令
            backend: local/docker/ssh/modal/daytona/singularity
            timeout: 超时秒数(严档上限 STRICT_TIMEOUT_CEILING_S)
            workdir: 工作目录(严档必须落在工作区根内)
            docker_image: Docker 镜像(backend=docker 时,兼容旧字段)
            ssh_host: SSH 主机(backend=ssh 时)
            ssh_user: SSH 用户名
            env: 环境变量(严档只合并白名单 + 这些显式键)
            image: 镜像/函数标识(backend=modal/daytona/singularity 时优先使用,缺省回退 docker_image)
            resource_limits: 资源限制(cpu/memory/gpu 等,透传到后端)
            allow_network: 显式请求网络;严档下拒绝执行,仅 relaxed 档放行
        """
        profile = resolve_execution_profile()
        timeout = _resolve_timeout(profile, timeout)
        workdir = _resolve_workdir(profile, workdir)
        if allow_network and not profile.allow_network:
            logger.warning(
                "sandbox 网络访问被严档拒绝 tier=%s backend=%s cmd=%r "
                "(显式放宽: %s=relaxed)",
                profile.tier, backend, command[:200], SANDBOX_TIER_ENV,
            )
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr=(
                    f"网络访问默认拒绝(tier={profile.tier});"
                    f"如确需网络,显式设置 {SANDBOX_TIER_ENV}=relaxed 后重试"
                ),
                duration_ms=0, backend=backend, timed_out=False,
            )
        if profile.tier != SANDBOX_TIER_STRICT:
            logger.warning(
                "sandbox 放宽档生效 tier=%s backend=%s timeout=%ss workdir=%s "
                "network=%s env=%s",
                profile.tier, backend, timeout, workdir,
                allow_network, "full" if profile.full_env else "allowlist",
            )
        if backend == "local":
            return await self._execute_local(command, timeout, workdir, env, profile)
        if backend == "docker":
            return await self._execute_docker(
                command, timeout, workdir, docker_image, env, allow_network, profile,
            )
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
    def _log_exec(
        backend: str,
        command: str,
        exit_code: int,
        duration_ms: float,
        tier: str = "",
    ) -> None:
        """记录单次执行日志(命令截断 200 字符,含执行档位名)。"""
        logger.info(
            "sandbox exec backend=%s tier=%s cmd=%r exit=%d duration_ms=%.1f",
            backend, tier or DEFAULT_SANDBOX_TIER, command[:200], exit_code, duration_ms,
        )

    @staticmethod
    def _check_dangerous_patterns(cmd: str) -> list[str]:
        """检测灾难性命令模式(补充黑名单,防止 python -c 等绕过,2026-07-22 立)。

        与 _DANGEROUS_PATTERNS 黑名单互补:黑名单拦截 Shell 注入和一般危险操作(返回错误结果),
        本方法拦截不可恢复的灾难性命令(调用方应抛 SandboxError)。

        Returns:
            匹配到的模式描述列表,空列表表示无匹配。
        """
        matched: list[str] = []
        for pattern, desc in _DESTRUCTIVE_PATTERNS:
            if re.search(pattern, cmd):
                matched.append(desc)
        return matched

    async def _execute_local(
        self,
        command: str,
        timeout: int,
        workdir: str,
        env: dict[str, str] | None,
        profile: SandboxExecutionProfile | None = None,
    ) -> SandboxResult:
        """本地执行(白黑名单 + subprocess),默认按严档收敛限制。

        Local backend 无法在内核层隔离网络(无容器边界),严档因此**默认拒绝**
        网络请求:调用方若在网络相关命令上需要放行,必须显式设置
        ``SANDBOX_EXEC_TIER=relaxed``;本地执行仍受白名单/黑名单/超时约束。
        如需网络隔离,请使用 docker backend(--network=none)。
        """
        profile = profile or resolve_execution_profile()
        timeout = _resolve_timeout(profile, timeout)
        workdir = _resolve_workdir(profile, workdir)
        start = time.monotonic()
        # 0. 灾难性命令拦截(补充黑名单,防止 python -c 等绕过,2026-07-22 立)
        destructive = self._check_dangerous_patterns(command)
        if destructive:
            raise SandboxError(f"危险命令被拦截: {destructive}")
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
        # 3. 执行(asyncio subprocess + 超时);严档只继承白名单环境变量
        try:
            if profile.full_env:
                full_env = {**os.environ, **env} if env else None
            else:
                full_env = _strict_child_env(env)
            logger.info(
                "sandbox exec start backend=local tier=%s timeout=%ss workdir=%s "
                "network=%s env=%s",
                profile.tier, timeout, workdir,
                "allow" if profile.allow_network else "deny",
                "full" if profile.full_env else "allowlist",
            )

            if sys.platform == "win32":
                # Windows: shell 内置命令需用 shell 执行
                # 批 58:EXEC_SHELL_DETECT_ENABLED on 时经 shell_detect 派生 argv(cmd.exe /c),
                # 行为等价于 create_subprocess_shell;off 或派生失败走现状,逐字节等价。
                derived = _derive_windows_exec_args(command)
                if derived is not None:
                    proc = await asyncio.create_subprocess_exec(
                        *derived,
                        cwd=workdir,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        env=full_env,
                    )
                else:
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
            except TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    proc.kill()
                return SandboxResult(
                    exit_code=-1, stdout="",
                    stderr=f"command timed out ({timeout}s)",
                    duration_ms=(time.monotonic() - start) * 1000,
                    backend="local", timed_out=True,
                )
            stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
            # 批58:EXEC_CAPTURE_POLICY_ENABLED on 时按档位施加输出保留上限
            if _exec_capture_policy_enabled_from_env():
                stdout, stderr = _apply_exec_capture_policy(stdout, stderr)
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
        allow_network: bool = False,
        profile: SandboxExecutionProfile | None = None,
    ) -> SandboxResult:
        """Docker 容器执行(通过 docker run CLI)。

        构造:docker run --rm --network=none --cap-drop=ALL
        --security-opt=no-new-privileges --pids-limit 64 --memory 512m --cpus 1
        -w <workdir> [-e KEY=VAL...] <image> sh -c "<command>"
        不挂载宿主机文件系统(安全隔离),如需文件传递用 stdin。
        --network=none:默认禁止容器网络;只有显式 allow_network=True 且档位为
        relaxed 时才切到 bridge(请求仍会留审计日志)。
        """
        profile = profile or resolve_execution_profile()
        timeout = _resolve_timeout(profile, timeout)
        if allow_network and not profile.allow_network:
            return SandboxResult(
                exit_code=-1, stdout="",
                stderr=(
                    f"网络访问默认拒绝(tier={profile.tier});"
                    f"如确需网络,显式设置 {SANDBOX_TIER_ENV}=relaxed 后重试"
                ),
                duration_ms=0, backend="docker", timed_out=False,
            )
        network_mode = "bridge" if allow_network else "none"
        start = time.monotonic()
        args: list[str] = [
            "docker", "run", "--rm", f"--network={network_mode}",
            "--cap-drop=ALL", "--security-opt=no-new-privileges",
            "--pids-limit", "64", "--memory", "512m", "--cpus", "1",
            "-w", workdir,
        ]
        logger.info(
            "sandbox exec start backend=docker tier=%s timeout=%ss workdir=%s "
            "network=%s",
            profile.tier, timeout, workdir, network_mode,
        )
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
            except TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    proc.kill()
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
            except TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    proc.kill()
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
            except TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    probe.kill()
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
            except TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    proc.kill()
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
