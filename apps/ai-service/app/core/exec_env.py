# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/exec_env.py
"""Shell 环境策略(2026-09-19 第二十六批,对标 Codex protocol/src/shell_environment.rs)。

为工具子进程构造受控环境,六步算法(Codex populate_env 忠实移植):

1. **inherit 起点**:ALL(全部继承)/ NONE(空)/ CORE(仅核心变量,
   Windows 与 Unix 各有一套白名单,大小写不敏感匹配);
2. **默认排除**(可用 ignore_default_excludes 关闭):名称含
   KEY/SECRET/TOKEN(大小写不敏感)的变量剔除;
3. **自定义 exclude**:glob 模式(`*`/`?`)剔除;
4. **set 覆盖**:显式 (key, value) 插入,Windows 下先按大小写不敏感
   移除旧键(避免同键异义残留);
5. **include_only**:非空时仅保留匹配变量;
6. **注入 thread_id**(IHUI_THREAD_ID)+ **剥离不可继承变量**
   (NON_INHERITABLE_ENV_VARS,启动上下文/身份令牌类,连用户
   override 也无法恢复)。

Windows 兜底:inherit 结果缺 PATHEXT 时补默认值(Codex create_env 同款)。
POSIX 兜底(G-998139):出口 PATH 必含最小系统 bootstrap 目录集
(继承条目在前、缺的追加在后并去重;PATH 缺失时整体兜底),并配套
``resolve_stdio_command`` 显式候选序解析(结果+试过候选成对出口)。
"""

from __future__ import annotations

import fnmatch
import os
import sys
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from enum import StrEnum

CODEX_THREAD_ID_ENV_VAR = "IHUI_THREAD_ID"
CODEX_SESSION_ID_ENV_VAR = "IHUI_SESSION_ID"

# 模型可达子进程绝不可继承的启动上下文变量(大小写不敏感剥离)
NON_INHERITABLE_ENV_VARS: tuple[str, ...] = (
    "IHUI_EXEC_SERVER_NOISE_AUTH_TOKEN",
    "NODE_REPL_AUTH_TOKEN",
    "OPENAI_FEDERATION_RULE_ID",
    "OPENAI_IDENTITY_TOKEN_FILE",
    "OPENAI_WORKLOAD_IDENTITY_CONTEXT",
    "IHUI_ADMIN_PASSWORD",
)

_UNIX_CORE_ENV_VARS: tuple[str, ...] = (
    "PATH", "SHELL", "TMPDIR", "TEMP", "TMP", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "LOGNAME", "USER",
)

_WINDOWS_CORE_ENV_VARS: tuple[str, ...] = (
    # 核心路径解析
    "PATH", "PATHEXT",
    # Shell 与系统根
    "SHELL", "COMSPEC", "SYSTEMROOT", "WINDIR", "SYSTEMDRIVE",
    # 用户上下文与配置
    "USERNAME", "USERDOMAIN", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
    # 程序位置
    "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432", "PROGRAMDATA",
    # 应用数据与缓存
    "LOCALAPPDATA", "APPDATA",
    # 临时目录
    "TEMP", "TMP", "TMPDIR",
    # 常见 shell/pwsh 提示
    "POWERSHELL", "PWSH",
)

_WINDOWS_PATHEXT_DEFAULT = ".COM;.EXE;.BAT;.CMD"

# ============================================================================
# G-998139(拍板:要):POSIX bootstrap PATH 兜底 + 显式候选可执行性解析。
# 上游参考(zcode-cli):runtimeLoginShellEnvCapture.ts:8-11,49-51(最小系统 PATH,
# darwin 另含 /opt/homebrew/bin;探测失败时它同时是**最终兜底**而非只用于探测)、
# runtimeToolResolver.ts:5-12,28-57,72-101(accessSync(X_OK) 显式候选序 + 找不到
# 大声喊,PATH 前置/追加共用一份去重)。拍板边界:**不做** login shell 快照采集。
# 上游同型事故:服务由非交互 shell 启动,PATH 只剩系统目录 ⇒ 裸名 spawn("npx")
# 找不到 Homebrew/NVM 里的入口(本仓 AGENTS §5b 记过 Windows 侧同型死路径)。
# ============================================================================

_POSIX_BOOTSTRAP_PATH_DIRS: tuple[str, ...] = (
    "/usr/local/sbin",
    "/usr/local/bin",
    "/usr/sbin",
    "/usr/bin",
    "/sbin",
    "/bin",
)
_POSIX_DARWIN_EXTRA_BOOTSTRAP_DIRS: tuple[str, ...] = ("/opt/homebrew/bin",)


def bootstrap_path_dirs(*, darwin: bool | None = None) -> tuple[str, ...]:
    """POSIX 最小系统 PATH 目录集(纯数据兜底集,拍板:不做 login shell 快照采集)。

    darwin 追加档缺省按当前平台判定;显式传参供跨平台驱动/测试。
    该集合只应经 :func:`ensure_posix_bootstrap_path` 注入 POSIX 出口环境;
    Windows 侧走 PATHEXT 兜底那一档,不使用本集合。
    """
    is_darwin = sys.platform == "darwin" if darwin is None else darwin
    dirs = list(_POSIX_BOOTSTRAP_PATH_DIRS)
    if is_darwin:
        dirs.extend(_POSIX_DARWIN_EXTRA_BOOTSTRAP_DIRS)
    return tuple(dirs)


def merge_path_entries(current: str | None, additions: Iterable[str], *, separator: str = ":") -> str:
    """PATH 前置/追加共用的同一份去重(上游 runtimeCommandEnv 同款):
    既有条目保持原序在前(不抢用户/继承条目的优先级),缺的 ``additions`` 追加在后。"""
    existing = [p for p in (current or "").split(separator) if p]
    seen = set(existing)
    merged = list(existing)
    for d in additions:
        if d and d not in seen:
            merged.append(d)
            seen.add(d)
    return separator.join(merged)


def _get_env_value_ci(env_map: Mapping[str, str], name: str) -> tuple[str | None, str | None]:
    """大小写不敏感取环境变量,返回 (实际键名, 值);不存在返回 (None, None)。"""
    upper = name.upper()
    for k, v in env_map.items():
        if k.upper() == upper:
            return k, v
    return None, None


def ensure_posix_bootstrap_path(env_map: dict[str, str], *, darwin: bool | None = None) -> dict[str, str]:
    """POSIX 出口兜底:出口 PATH **必含** bootstrap 目录集合(最终兜底,非仅探测用)。

    语义:继承/用户既有 PATH 条目保持在前,缺的 bootstrap 目录追加在后并去重;
    PATH 整体缺失(无键或空串)时,出口 PATH 即 bootstrap 集合本身。
    仅应在 POSIX 分支调用(create_env_from_vars 已按平台分流)。
    """
    key, current = _get_env_value_ci(env_map, "PATH")
    merged = merge_path_entries(current, bootstrap_path_dirs(darwin=darwin))
    env_map[key if key is not None else "PATH"] = merged
    return env_map


@dataclass(frozen=True)
class ExecutableResolution:
    """候选序解析器的"结果 + 出处"成对出口(对齐 §5d/守门 103 纪律):
    解析器必须同时交代**解析到哪**与**试过哪些候选**。

    ``resolved`` 未找到时为 ``None`` —— **绝不返回空字符串冒充已解析**。
    """

    command: str  # 原始命令名(原样回传)
    resolved: str | None  # 解析出的路径;未找到为 None
    tried: tuple[str, ...]  # 依次试过的候选(找不到时原样进报错文案,大声喊的依据)

    @property
    def ok(self) -> bool:
        return self.resolved is not None


def _is_executable_file(candidate: str) -> bool:
    try:
        return os.path.isfile(candidate) and os.access(candidate, os.X_OK)
    except OSError:
        return False


def resolve_stdio_command(command: str, env: Mapping[str, str] | None = None) -> ExecutableResolution:
    """显式候选序解析 stdio 命令(对标上游 runtimeToolResolver 的 accessSync(X_OK) 判据)。

    - 显式路径(含目录分隔)⇒ 候选即自身,可执行才算解析到;
    - 裸名 ⇒ 依次试 PATH 各目录(取自传入 ``env``,大小写不敏感)+ POSIX bootstrap
      目录集;Windows 目录内按 PATHEXT(缺省补 _WINDOWS_PATHEXT_DEFAULT)枚举扩展。
    - 找不到 ⇒ ``resolved=None`` 且 ``tried`` 为完整候选序 —— 调用侧必须拿 ``tried``
      大声喊(带候选列表报错),不得静默回落裸名 spawn。
    """
    if not command:
        return ExecutableResolution(command, None, ())
    env_map: dict[str, str] = dict(env) if env is not None else dict(os.environ)
    if os.sep in command or "/" in command or "\\" in command:
        # 显式路径:候选即自身(解析器只核可执行性,不替调用方猜相对基准)
        tried = (command,)
        return ExecutableResolution(command, command if _is_executable_file(command) else None, tried)

    path_value = _get_env_value_ci(env_map, "PATH")[1] or ""
    dir_sep = ";" if sys.platform == "win32" else ":"
    dirs = [d for d in path_value.split(dir_sep) if d]
    for d in bootstrap_path_dirs():
        if d not in dirs:
            dirs.append(d)

    tried: list[str] = []
    for d in dirs:
        base = os.path.join(d, command)
        if sys.platform == "win32":
            exts_raw = _get_env_value_ci(env_map, "PATHEXT")[1] or _WINDOWS_PATHEXT_DEFAULT
            for ext in (e for e in exts_raw.split(";") if e):
                candidate = base + ext
                tried.append(candidate)
                if _is_executable_file(candidate):
                    return ExecutableResolution(command, candidate, tuple(tried))
        tried.append(base)
        if _is_executable_file(base):
            return ExecutableResolution(command, base, tuple(tried))
    return ExecutableResolution(command, None, tuple(tried))


class ShellEnvironmentPolicyInherit(StrEnum):
    """inherit 策略(对标 ShellEnvironmentPolicyInherit)。"""

    ALL = "all"
    NONE = "none"
    CORE = "core"


class EnvironmentVariablePattern:
    """变量名 glob 模式(`*`/`?` 通配;可大小写不敏感)。"""

    __slots__ = ("_pattern", "case_insensitive")

    def __init__(self, pattern: str, case_insensitive: bool = False) -> None:
        self._pattern = pattern
        self.case_insensitive = case_insensitive

    @classmethod
    def new_case_insensitive(cls, pattern: str) -> EnvironmentVariablePattern:
        return cls(pattern, case_insensitive=True)

    def matches(self, name: str) -> bool:
        hay, needle = name, self._pattern
        if self.case_insensitive:
            hay, needle = hay.lower(), needle.lower()
        return fnmatch.fnmatchcase(hay, needle)

    def __repr__(self) -> str:  # pragma: no cover - 调试辅助
        return f"EnvPattern({self._pattern!r}, ci={self.case_insensitive})"


def is_non_inheritable_env_var(name: str) -> bool:
    upper = name.upper()
    return any(restricted.upper() == upper for restricted in NON_INHERITABLE_ENV_VARS)


def scrub_non_inheritable_env_vars(env: Mapping[str, str]) -> dict[str, str]:
    """从环境映射剥离不可继承变量(连显式 override 也剥,Codex 同款)。"""
    return {k: v for k, v in env.items() if not is_non_inheritable_env_var(k)}


@dataclass
class ShellEnvironmentPolicy:
    """Shell 环境策略(对标 config_types::ShellEnvironmentPolicy)。"""

    inherit: ShellEnvironmentPolicyInherit = ShellEnvironmentPolicyInherit.ALL
    # True = 跳过 KEY/SECRET/TOKEN 默认排除(Codex Default 即 true,忠实镜像)
    ignore_default_excludes: bool = True
    exclude: list[EnvironmentVariablePattern] = field(default_factory=list)
    set: dict[str, str] = field(default_factory=dict)
    include_only: list[EnvironmentVariablePattern] = field(default_factory=list)
    use_profile: bool = False


def populate_env(
    vars: Iterable[tuple[str, str]],
    policy: ShellEnvironmentPolicy,
    thread_id: str | None = None,
) -> dict[str, str]:
    """六步环境构造算法(对标 populate_env,Windows set 覆盖语义含全平台)。"""
    is_windows = sys.platform == "win32"

    # Step 1 - inherit 起点
    if policy.inherit is ShellEnvironmentPolicyInherit.ALL:
        env_map: dict[str, str] = dict(vars)
    elif policy.inherit is ShellEnvironmentPolicyInherit.NONE:
        env_map = {}
    else:  # CORE
        core = _WINDOWS_CORE_ENV_VARS if is_windows else _UNIX_CORE_ENV_VARS
        core_upper = {c.upper() for c in core}
        env_map = {k: v for k, v in vars if k.upper() in core_upper}

    def matches_any(name: str, patterns: list[EnvironmentVariablePattern]) -> bool:
        return any(p.matches(name) for p in patterns)

    # Step 2 - 默认排除(KEY/SECRET/TOKEN)
    if not policy.ignore_default_excludes:
        default_excludes = [
            EnvironmentVariablePattern.new_case_insensitive("*KEY*"),
            EnvironmentVariablePattern.new_case_insensitive("*SECRET*"),
            EnvironmentVariablePattern.new_case_insensitive("*TOKEN*"),
        ]
        env_map = {k: v for k, v in env_map.items() if not matches_any(k, default_excludes)}

    # Step 3 - 自定义 exclude
    if policy.exclude:
        env_map = {k: v for k, v in env_map.items() if not matches_any(k, policy.exclude)}

    # Step 4 - set 覆盖(Windows 先大小写不敏感移除旧键)
    for key, val in policy.set.items():
        if is_windows:
            env_map = {k: v for k, v in env_map.items() if k.upper() != key.upper()}
        env_map[key] = val

    # Step 5 - include_only
    if policy.include_only:
        env_map = {k: v for k, v in env_map.items() if matches_any(k, policy.include_only)}

    # Step 6 - thread_id 注入 + 不可继承剥离
    if thread_id:
        env_map[CODEX_THREAD_ID_ENV_VAR] = thread_id
    env_map = {k: v for k, v in env_map.items() if not is_non_inheritable_env_var(k)}

    return env_map


def create_env_from_vars(
    vars: Iterable[tuple[str, str]],
    policy: ShellEnvironmentPolicy,
    thread_id: str | None = None,
) -> dict[str, str]:
    """populate_env + 平台出口兜底(对标 create_env_from_vars):
    Windows 补 PATHEXT 缺省;POSIX 补 bootstrap PATH 兜底(G-998139,拍板:要)。"""
    env_map = populate_env(vars, policy, thread_id)
    if sys.platform == "win32":
        if not any(k.upper() == "PATHEXT" for k in env_map):
            env_map["PATHEXT"] = _WINDOWS_PATHEXT_DEFAULT
    else:
        env_map = ensure_posix_bootstrap_path(env_map)
    return env_map


def create_env(policy: ShellEnvironmentPolicy, thread_id: str | None = None) -> dict[str, str]:
    """从当前进程环境构造(对标 create_env)。"""
    return create_env_from_vars(os.environ.items(), policy, thread_id)


def inject_session_env(env: dict[str, str], session_id: str, harness_version: str) -> None:
    """向子进程环境注入会话身份与 harness 版本(对标 inject_session_env)。"""
    env[CODEX_SESSION_ID_ENV_VAR] = session_id
    if sys.platform == "win32":
        # Windows 环境变量大小写不敏感:先移除同名异写键再插入
        env.pop("IHUI_VERSION", None)
    env["IHUI_VERSION"] = harness_version
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
