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
    """populate_env + Windows PATHEXT 兜底(对标 create_env_from_vars)。"""
    env_map = populate_env(vars, policy, thread_id)
    if sys.platform == "win32":
        if not any(k.upper() == "PATHEXT" for k in env_map):
            env_map["PATHEXT"] = _WINDOWS_PATHEXT_DEFAULT
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
