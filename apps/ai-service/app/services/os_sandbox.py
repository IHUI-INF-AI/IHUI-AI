# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""OS 级沙箱引擎 — 内核强制的资源/访问隔离(纯标准库 + ctypes)。

三大后端:
- ``win_job``      : Windows Job Object(内存/CPU 时间/进程数限额、kill-on-close)
                     + CreateRestrictedToken 受限令牌(DISABLE_MAX_PRIVILEGE,
                     可选 LUA_TOKEN 降级到链接令牌);进程以 CREATE_SUSPENDED 创建
                     → AssignProcessToJobObject → ResumeThread,自始受约束。
- ``linux_bwrap``  : Landlock ABI v4 ruleset 字节构造 + bwrap 参数构造
                     + setrlimit 回退链(landlock → bwrap → rlimit)。
- ``mac_seatbelt`` : Seatbelt .sb profile 文本生成器 + sandbox-exec 参数构造。

策略模型 ``SandboxPolicy``:readable/writable/denied 路径 ACL 矩阵(deny 优先、
write ⊆ read 不变式)、网络 allow/deny、环境变量白名单、超时、内存/CPU 上限。
统一入口 ``SandboxHandle(policy).run(cmd) -> ExecResult``。

诚实声明:Windows 上文件系统 ACL 为应用层护栏(启动前校验 argv/cwd;内核级
per-path ACL 需 DACL 改写,代价过重);资源限额与令牌限制为 OS-enforced。
Linux/macOS 后端在本仓库以纯函数构造正确性测试覆盖(Windows 开发机无法真跑)。
"""

from __future__ import annotations

import ctypes
import os
import shlex
import struct
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable, Mapping, Sequence
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "ExecResult",
    "PolicyError",
    "SandboxError",
    "SandboxHandle",
    "SandboxPolicy",
    "WinApiError",
    "build_bwrap_argv",
    "build_child_env",
    "create_restricted_token",
    "current_process_privilege_count",
    "get_default_backend",
    "landlock_path_beneath_bytes",
    "landlock_rules_bytes",
    "landlock_ruleset_attr_bytes",
    "rlimit_spec",
    "seatbelt_argv",
    "seatbelt_profile",
    "token_privilege_count",
    "validate_command_paths",
]

# ============================================================
# 异常层次
# ============================================================


class SandboxError(Exception):
    """OS 沙箱基类异常。"""


class PolicyError(SandboxError):
    """策略非法/冲突(限额非正、write ⊄ read、deny 与 write 重叠等)。"""


class WinApiError(SandboxError):
    """Win32 API(ctypes)调用失败,携带 GetLastError 原始码。"""

    def __init__(self, message: str, winerror: int | None = None) -> None:
        super().__init__(message if winerror is None else f"{message} (WinError={winerror})")
        self.winerror = winerror


class CapabilityMissingError(SandboxError):
    """当前平台缺少所需隔离能力(非 Windows 上调 Job Object 等)。"""


# ============================================================
# 策略模型:SandboxPolicy(readable/writable/denied ACL 矩阵)
# ============================================================


def _normalize_path(raw: str) -> str:
    """路径归一化:反斜杠→正斜杠、解析 . 与 ..、盘符小写、去尾斜杠。"""
    text = str(raw).strip().replace("\\", "/")
    if not text:
        return ""
    has_drive = len(text) >= 2 and text[1] == ":" and text[0].isalpha()
    is_abs = text.startswith("/") or has_drive
    parts: list[str] = []
    for seg in text.split("/"):
        if seg in ("", "."):
            continue
        if seg == "..":
            if parts and parts[-1] != "..":
                parts.pop()
            elif not is_abs:
                parts.append("..")
        else:
            parts.append(seg)
    body = "/".join(parts)
    if has_drive:
        return f"{text[0].lower()}:{'/' + body if body else ''}"
    if is_abs:
        return "/" + body
    return body if body else "."


def _is_abs_path(raw: str) -> bool:
    """绝对路径判断(POSIX / 开头、Windows 盘符或 UNC)。"""
    text = str(raw).replace("\\", "/")
    return text.startswith("/") or (len(text) >= 2 and text[1] == ":" and text[0].isalpha())


def _resolve_against_base(path: str, base_dir: str) -> str:
    """相对路径按 base_dir 展开后归一化;绝对路径直接归一化。"""
    if _is_abs_path(path) or not base_dir:
        return _normalize_path(path)
    return _normalize_path(base_dir + "/" + path)


def _path_hit(rule: str, target: str, *, base_dir: str) -> bool:
    """规则命中判断:目录前缀语义(rule 及其全部子孙命中);``*`` 匹配单段。"""
    r = _resolve_against_base(rule, base_dir)
    t = _resolve_against_base(target, base_dir)
    if r in ("", ".", "/"):
        return True
    if "*" in r:
        rsegs = r.rstrip("/").split("/")
        tsegs = t.rstrip("/").split("/")
        # 目录前缀语义:规则段序列可以是目标路径的前缀段
        if len(rsegs) > len(tsegs):
            return False
        return all(
            rp == tp or rp == "*" for rp, tp in zip(rsegs, tsegs[: len(rsegs)], strict=False)
        )
    r = r.rstrip("/")
    return t == r or t.startswith(r + "/")


@dataclass
class SandboxPolicy:
    """OS 沙箱策略:路径 ACL 矩阵 + 网络 + env 白名单 + 超时/内存/CPU 上限。

    语义约定:
    - denied_paths 优先级最高:命中即拒绝读与写;
    - readable_paths 为空 = 不限制读取(denied 仍生效);
    - writable_paths 为空 = 禁止一切写入;
    - write ⊆ read 不变式:writable 中每条路径必须被某条 readable 覆盖。
    """

    readable_paths: list[str] = field(default_factory=list)
    writable_paths: list[str] = field(default_factory=list)
    denied_paths: list[str] = field(default_factory=list)
    allow_network: bool = False
    env_whitelist: list[str] = field(default_factory=list)
    timeout_s: int = 30
    memory_mb: int = 512
    cpu_seconds: int = 300
    max_processes: int = 64
    #: Windows 专用:是否用 CreateRestrictedToken 降权运行子进程
    restrict_token: bool = True
    #: 相对路径展开基准目录(空 = 当前工作目录)
    base_dir: str = ""

    def __post_init__(self) -> None:
        for name in ("timeout_s", "memory_mb", "cpu_seconds", "max_processes"):
            value = getattr(self, name)
            if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                raise PolicyError(f"{name} 必须为正整数,得到 {value!r}")
        self.validate()

    # ---------- ACL 查询 ----------

    def _base(self) -> str:
        return self.base_dir or os.getcwd()

    def is_denied(self, path: str) -> bool:
        """路径是否命中 denied 矩阵(deny 优先)。"""
        return any(_path_hit(d, path, base_dir=self._base()) for d in self.denied_paths)

    def can_read(self, path: str) -> bool:
        """路径可读性:deny 优先;readable 为空表示不限制读取。"""
        if self.is_denied(path):
            return False
        if not self.readable_paths:
            return True
        return any(_path_hit(r, path, base_dir=self._base()) for r in self.readable_paths)

    def can_write(self, path: str) -> bool:
        """路径可写性:deny 优先;writable 为空表示禁止一切写入。"""
        if self.is_denied(path):
            return False
        return any(_path_hit(w, path, base_dir=self._base()) for w in self.writable_paths)

    def acl_for(self, path: str) -> tuple[bool, bool]:
        """返回 (可读, 可写) 二元组 —— ACL 矩阵查询入口。"""
        return (self.can_read(path), self.can_write(path))

    # ---------- 校验 ----------

    def validate(self) -> None:
        """write ⊆ read 不变式 + denied 不得覆盖 writable;违反抛 PolicyError。"""
        if self.readable_paths:
            for w in self.writable_paths:
                if not any(_path_hit(r, w, base_dir=self._base()) for r in self.readable_paths):
                    raise PolicyError(f"策略冲突: writable '{w}' 未被任何 readable 覆盖")
        for w in self.writable_paths:
            for d in self.denied_paths:
                if _path_hit(d, w, base_dir=self._base()):
                    raise PolicyError(f"策略冲突: denied '{d}' 覆盖 writable '{w}'")

    # ---------- 序列化 ----------

    def to_dict(self) -> dict[str, Any]:
        """转 JSON 可序列化 dict。"""
        return {
            "readable_paths": list(self.readable_paths),
            "writable_paths": list(self.writable_paths),
            "denied_paths": list(self.denied_paths),
            "allow_network": self.allow_network,
            "env_whitelist": list(self.env_whitelist),
            "timeout_s": self.timeout_s,
            "memory_mb": self.memory_mb,
            "cpu_seconds": self.cpu_seconds,
            "max_processes": self.max_processes,
            "restrict_token": self.restrict_token,
            "base_dir": self.base_dir,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> SandboxPolicy:
        """从 dict 构造(未知字段拒绝)。"""
        known = {
            "readable_paths", "writable_paths", "denied_paths", "allow_network",
            "env_whitelist", "timeout_s", "memory_mb", "cpu_seconds",
            "max_processes", "restrict_token", "base_dir",
        }
        unknown = set(data) - known
        if unknown:
            raise PolicyError(f"未知 policy 字段: {sorted(unknown)}")
        return cls(
            readable_paths=[str(x) for x in data.get("readable_paths", [])],
            writable_paths=[str(x) for x in data.get("writable_paths", [])],
            denied_paths=[str(x) for x in data.get("denied_paths", [])],
            allow_network=bool(data.get("allow_network", False)),
            env_whitelist=[str(x) for x in data.get("env_whitelist", [])],
            timeout_s=int(data.get("timeout_s", 30)),
            memory_mb=int(data.get("memory_mb", 512)),
            cpu_seconds=int(data.get("cpu_seconds", 300)),
            max_processes=int(data.get("max_processes", 64)),
            restrict_token=bool(data.get("restrict_token", True)),
            base_dir=str(data.get("base_dir", "")),
        )


#: Windows 子进程必需的系统环境变量(不受白名单裁剪,否则进程无法启动)
_WIN_MANDATORY_ENV = ("SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "PATH", "TEMP", "TMP")


def build_child_env(
    policy: SandboxPolicy,
    environ: Mapping[str, str],
    extra: Mapping[str, str] | None = None,
) -> dict[str, str]:
    """按 env_whitelist 裁剪子进程环境;Windows 上强制保留系统必需变量。"""
    child: dict[str, str] = {}
    for key in policy.env_whitelist:
        if key in environ:
            child[key] = environ[key]
    if sys.platform == "win32":
        for key in _WIN_MANDATORY_ENV:
            if key in environ:
                child[key] = environ[key]
    if extra:
        child.update(extra)
    return child


# ============================================================
# 执行结果
# ============================================================


@dataclass
class ExecResult:
    """沙箱内命令执行结果。"""

    cmd: list[str]
    returncode: int
    stdout: str
    stderr: str
    duration_ms: float
    backend: str
    timed_out: bool = False
    killed_by_limit: bool = False

    @property
    def ok(self) -> bool:
        """正常退出(退出码 0 且未超时)。"""
        return self.returncode == 0 and not self.timed_out


# ============================================================
# 后端探测
# ============================================================

BACKEND_WIN_JOB = "win_job"
BACKEND_LINUX_BWRAP = "linux_bwrap"
BACKEND_MAC_SEATBELT = "mac_seatbelt"


def get_default_backend() -> str:
    """平台探测:返回当前 OS 的默认沙箱后端名。

    Raises:
        CapabilityMissingError: 平台不受支持。
    """
    if sys.platform == "win32":
        return BACKEND_WIN_JOB
    if sys.platform.startswith("linux"):
        return BACKEND_LINUX_BWRAP
    if sys.platform == "darwin":
        return BACKEND_MAC_SEATBELT
    raise CapabilityMissingError(f"不支持的平台: {sys.platform}")


# ============================================================
# Windows 后端:Job Object + CreateRestrictedToken
# ============================================================

# ---- Win32 常量 ----
CREATE_SUSPENDED = 0x00000004
CREATE_UNICODE_ENVIRONMENT = 0x00000400
WAIT_TIMEOUT = 0x00000102
STILL_ACTIVE = 259
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_TERMINATE = 0x0001
STARTF_USESTDHANDLES = 0x00000100
THREAD_RESUME_FAILED = 0xFFFFFFFF

JobObjectExtendedLimitInformation = 9

JOB_OBJECT_LIMIT_PROCESS_TIME = 0x00000002
JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x00000008
JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100
JOB_OBJECT_LIMIT_JOB_MEMORY = 0x00000200
JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000

# CreateRestrictedToken flags
DISABLE_MAX_PRIVILEGE = 0x00000001
LUA_TOKEN = 0x00000002

# TOKEN_INFORMATION_CLASS
TokenPrivileges = 3
TokenElevation = 20

# OpenProcessToken access
_TOKEN_DUPLICATE = 0x0002
_TOKEN_QUERY = 0x0008
_TOKEN_QUERY_SOURCE = 0x0010
_TOKEN_ADJUST_PRIVILEGES = 0x0020
_TOKEN_ADJUST_DEFAULT = 0x0080

# SetHandleInformation
_HANDLE_FLAG_INHERIT = 0x00000001

# job 限制强杀的典型 NTSTATUS(退出码启发式)
_JOB_KILL_CODES = {0xC00000FD, 0xC0000017, 0xC000012D}


class IO_COUNTERS(ctypes.Structure):
    """Win32 IO_COUNTERS(6 × u64)。"""

    _fields_ = [
        ("ReadOperationCount", ctypes.c_uint64),
        ("WriteOperationCount", ctypes.c_uint64),
        ("OtherOperationCount", ctypes.c_uint64),
        ("ReadTransferCount", ctypes.c_uint64),
        ("WriteTransferCount", ctypes.c_uint64),
        ("OtherTransferCount", ctypes.c_uint64),
    ]


class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
    """Win32 JOBOBJECT_BASIC_LIMIT_INFORMATION。"""

    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64),
        ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", ctypes.c_uint32),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", ctypes.c_uint32),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", ctypes.c_uint32),
        ("SchedulingClass", ctypes.c_uint32),
    ]


class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
    """Win32 JOBOBJECT_EXTENDED_LIMIT_INFORMATION(含内存限额字段)。"""

    _fields_ = [
        ("BasicLimitInformation", JOBOBJECT_BASIC_LIMIT_INFORMATION),
        ("IoInfo", IO_COUNTERS),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


class STARTUPINFOW(ctypes.Structure):
    """Win32 STARTUPINFOW。"""

    _fields_ = [
        ("cb", ctypes.c_uint32),
        ("lpReserved", ctypes.c_wchar_p),
        ("lpDesktop", ctypes.c_wchar_p),
        ("lpTitle", ctypes.c_wchar_p),
        ("dwX", ctypes.c_uint32),
        ("dwY", ctypes.c_uint32),
        ("dwXSize", ctypes.c_uint32),
        ("dwYSize", ctypes.c_uint32),
        ("dwXCountChars", ctypes.c_uint32),
        ("dwYCountChars", ctypes.c_uint32),
        ("dwFillAttribute", ctypes.c_uint32),
        ("dwFlags", ctypes.c_uint32),
        ("wShowWindow", ctypes.c_uint16),
        ("cbReserved2", ctypes.c_uint16),
        ("lpReserved2", ctypes.c_void_p),
        ("hStdInput", ctypes.c_void_p),
        ("hStdOutput", ctypes.c_void_p),
        ("hStdError", ctypes.c_void_p),
    ]


class PROCESS_INFORMATION(ctypes.Structure):
    """Win32 PROCESS_INFORMATION。"""

    _fields_ = [
        ("hProcess", ctypes.c_void_p),
        ("hThread", ctypes.c_void_p),
        ("dwProcessId", ctypes.c_uint32),
        ("dwThreadId", ctypes.c_uint32),
    ]


_kernel32_ref: Any = None
_advapi32_ref: Any = None


def _require_windows() -> None:
    if sys.platform != "win32":
        raise CapabilityMissingError("该 Windows 后端仅在 win32 平台可用")


def _kernel32() -> Any:
    """惰性获取并配置 kernel32 函数原型(仅 Windows)。"""
    global _kernel32_ref
    if _kernel32_ref is not None:
        return _kernel32_ref
    _require_windows()
    if sys.platform != "win32":  # pragma: no cover - _require_windows 已抛
        raise RuntimeError("Windows-only")
    # sys.platform 收窄让 mypy 按目标平台选择 ctypes 存根(Windows 有 windll),
    # Linux CI 检查时该分支被判定不可达而跳过,双向零报错(2026-09-10)
    k32: Any = ctypes.windll.kernel32
    k32.CreateJobObjectW.restype = ctypes.c_void_p
    k32.CreateJobObjectW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p]
    k32.SetInformationJobObject.restype = ctypes.c_int32
    k32.SetInformationJobObject.argtypes = [
        ctypes.c_void_p, ctypes.c_int32, ctypes.c_void_p, ctypes.c_uint32,
    ]
    k32.QueryInformationJobObject.restype = ctypes.c_int32
    k32.QueryInformationJobObject.argtypes = [
        ctypes.c_void_p, ctypes.c_int32, ctypes.c_void_p, ctypes.c_uint32,
        ctypes.POINTER(ctypes.c_uint32),
    ]
    k32.AssignProcessToJobObject.restype = ctypes.c_int32
    k32.AssignProcessToJobObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    k32.CloseHandle.restype = ctypes.c_int32
    k32.CloseHandle.argtypes = [ctypes.c_void_p]
    k32.CreateProcessW.restype = ctypes.c_int32
    k32.CreateProcessW.argtypes = [
        ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_void_p, ctypes.c_void_p,
        ctypes.c_int32, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_wchar_p,
        ctypes.POINTER(STARTUPINFOW), ctypes.POINTER(PROCESS_INFORMATION),
    ]
    k32.ResumeThread.restype = ctypes.c_uint32
    k32.ResumeThread.argtypes = [ctypes.c_void_p]
    k32.WaitForSingleObject.restype = ctypes.c_uint32
    k32.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
    k32.TerminateProcess.restype = ctypes.c_int32
    k32.TerminateProcess.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
    k32.GetExitCodeProcess.restype = ctypes.c_int32
    k32.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
    k32.OpenProcess.restype = ctypes.c_void_p
    k32.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int32, ctypes.c_uint32]
    k32.GetProcessId.restype = ctypes.c_uint32
    k32.GetProcessId.argtypes = [ctypes.c_void_p]
    k32.SetHandleInformation.restype = ctypes.c_int32
    k32.SetHandleInformation.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32]
    k32.GetLastError.restype = ctypes.c_uint32
    k32.GetLastError.argtypes = []
    _kernel32_ref = k32
    return k32


def _advapi32() -> Any:
    """惰性获取并配置 advapi32 函数原型(令牌相关,仅 Windows)。"""
    global _advapi32_ref
    if _advapi32_ref is not None:
        return _advapi32_ref
    _require_windows()
    if sys.platform != "win32":  # pragma: no cover - _require_windows 已抛
        raise RuntimeError("Windows-only")
    a32: Any = ctypes.windll.advapi32
    a32.OpenProcessToken.restype = ctypes.c_int32
    a32.OpenProcessToken.argtypes = [
        ctypes.c_void_p, ctypes.c_uint32, ctypes.POINTER(ctypes.c_void_p),
    ]
    a32.GetTokenInformation.restype = ctypes.c_int32
    a32.GetTokenInformation.argtypes = [
        ctypes.c_void_p, ctypes.c_int32, ctypes.c_void_p, ctypes.c_uint32,
        ctypes.POINTER(ctypes.c_uint32),
    ]
    a32.CreateRestrictedToken.restype = ctypes.c_int32
    a32.CreateRestrictedToken.argtypes = [
        ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p,
        ctypes.c_uint32, ctypes.c_void_p, ctypes.c_uint32, ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_void_p),
    ]
    a32.SetThreadToken.restype = ctypes.c_int32
    a32.SetThreadToken.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    a32.DuplicateTokenEx.restype = ctypes.c_int32
    a32.DuplicateTokenEx.argtypes = [
        ctypes.c_void_p, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_int32,
        ctypes.c_int32, ctypes.POINTER(ctypes.c_void_p),
    ]
    a32.CreateProcessAsUserW.restype = ctypes.c_int32
    a32.CreateProcessAsUserW.argtypes = [
        ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_void_p,
        ctypes.c_void_p, ctypes.c_int32, ctypes.c_uint32, ctypes.c_void_p,
        ctypes.c_wchar_p, ctypes.POINTER(STARTUPINFOW), ctypes.POINTER(PROCESS_INFORMATION),
    ]
    _advapi32_ref = a32
    return a32


def _winerr() -> int:
    try:
        return int(_kernel32().GetLastError())
    except Exception:
        return 0


def close_win_handle(handle: int) -> None:
    """CloseHandle(幂等,0 入参忽略)。"""
    if handle:
        _kernel32().CloseHandle(ctypes.c_void_p(handle))


class WinJob:
    """Job Object 句柄封装:create → set_limits → assign → close(kill-on-close)。"""

    def __init__(self, handle: int) -> None:
        self._handle = handle

    @property
    def handle(self) -> int:
        """原始 HANDLE 整数值。"""
        return self._handle

    @classmethod
    def create(cls, name: str | None = None) -> WinJob:
        """CreateJobObjectW,失败抛 WinApiError。"""
        _require_windows()
        handle = _kernel32().CreateJobObjectW(None, name)
        if not handle:
            raise WinApiError("CreateJobObjectW 失败", winerror=_winerr())
        return cls(int(handle))

    def build_limits_struct(
        self, policy: SandboxPolicy, kill_on_close: bool
    ) -> JOBOBJECT_EXTENDED_LIMIT_INFORMATION:
        """按策略填充扩展限额结构(纯计算,便于单测标志位/数值)。"""
        info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        flags = (
            JOB_OBJECT_LIMIT_PROCESS_MEMORY
            | JOB_OBJECT_LIMIT_JOB_MEMORY
            | JOB_OBJECT_LIMIT_PROCESS_TIME
            | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
        )
        if kill_on_close:
            flags |= JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        info.BasicLimitInformation.PerProcessUserTimeLimit = policy.cpu_seconds * 10_000_000
        info.BasicLimitInformation.LimitFlags = flags
        info.BasicLimitInformation.ActiveProcessLimit = policy.max_processes
        mem_bytes = policy.memory_mb * 1024 * 1024
        info.ProcessMemoryLimit = mem_bytes
        info.JobMemoryLimit = mem_bytes
        return info

    def set_limits(self, policy: SandboxPolicy, *, kill_on_close: bool = True) -> None:
        """SetInformationJobObject(ExtendedLimit):内存/CPU 时间/进程数 + kill-on-close。"""
        _require_windows()
        info = self.build_limits_struct(policy, kill_on_close)
        ok = _kernel32().SetInformationJobObject(
            ctypes.c_void_p(self._handle),
            JobObjectExtendedLimitInformation,
            ctypes.byref(info),
            ctypes.sizeof(info),
        )
        if not ok:
            raise WinApiError("SetInformationJobObject(ExtendedLimit) 失败", winerror=_winerr())

    def query_limits(self) -> JOBOBJECT_EXTENDED_LIMIT_INFORMATION:
        """QueryInformationJobObject 读回限额(验证 OS 侧真实生效)。"""
        _require_windows()
        info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        returned = ctypes.c_uint32(0)
        ok = _kernel32().QueryInformationJobObject(
            ctypes.c_void_p(self._handle),
            JobObjectExtendedLimitInformation,
            ctypes.byref(info),
            ctypes.sizeof(info),
            ctypes.byref(returned),
        )
        if not ok:
            raise WinApiError("QueryInformationJobObject 失败", winerror=_winerr())
        return info

    def assign(self, process_handle: int) -> None:
        """AssignProcessToJobObject(现代 Windows 支持 job 嵌套)。"""
        _require_windows()
        ok = _kernel32().AssignProcessToJobObject(
            ctypes.c_void_p(self._handle), ctypes.c_void_p(process_handle)
        )
        if not ok:
            raise WinApiError("AssignProcessToJobObject 失败", winerror=_winerr())

    def close(self) -> None:
        """CloseHandle(job) — kill_on_close 置位时内核立即终止 job 内全部进程。"""
        if self._handle:
            _kernel32().CloseHandle(ctypes.c_void_p(self._handle))
            self._handle = 0

    def __enter__(self) -> WinJob:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def _token_privileges_raw(token: int) -> list[tuple[int, int]]:
    """GetTokenInformation(TokenPrivileges) → [(luid, attributes), ...]。"""
    a32 = _advapi32()
    needed = ctypes.c_uint32(0)
    a32.GetTokenInformation(
        ctypes.c_void_p(token), TokenPrivileges, None, 0, ctypes.byref(needed)
    )
    size = int(needed.value)
    if size <= 0:
        raise WinApiError("GetTokenInformation(TokenPrivileges) 尺寸查询失败", winerror=_winerr())
    buf = ctypes.create_string_buffer(size)
    ok = a32.GetTokenInformation(
        ctypes.c_void_p(token), TokenPrivileges, ctypes.cast(buf, ctypes.c_void_p),
        size, ctypes.byref(needed),
    )
    if not ok:
        raise WinApiError("GetTokenInformation(TokenPrivileges) 失败", winerror=_winerr())
    raw = buf.raw[: int(needed.value)]
    count = struct.unpack_from("<I", raw, 0)[0]
    out: list[tuple[int, int]] = []
    for i in range(int(count)):
        low, high, attrs = struct.unpack_from("<III", raw, 4 + i * 12)
        out.append((low | (high << 32), attrs))
    return out


def token_privilege_count(token: int) -> int:
    """令牌特权条数(受限令牌应显著少于原始令牌)。"""
    return len(_token_privileges_raw(token))


def current_process_privilege_count() -> int:
    """当前进程令牌的特权条数(供沙箱子进程自证降权效果)。"""
    _require_windows()
    tok = ctypes.c_void_p(0)
    if not _advapi32().OpenProcessToken(
        ctypes.c_void_p(-1), _TOKEN_QUERY, ctypes.byref(tok)
    ):
        raise WinApiError("OpenProcessToken 失败", winerror=_winerr())
    try:
        return token_privilege_count(tok.value or 0)
    finally:
        close_win_handle(tok.value or 0)


def _token_is_elevated(token: int) -> bool:
    """TokenElevation.TokenIsElevated。"""
    buf = ctypes.create_string_buffer(4)
    needed = ctypes.c_uint32(0)
    ok = _advapi32().GetTokenInformation(
        ctypes.c_void_p(token), TokenElevation, ctypes.cast(buf, ctypes.c_void_p),
        4, ctypes.byref(needed),
    )
    if not ok:
        return False
    return bool(struct.unpack_from("<I", buf.raw, 0)[0] == 1)


def create_restricted_token() -> int:
    """CreateRestrictedToken 受限令牌。

    - DISABLE_MAX_PRIVILEGE:剥离除 SeChangeNotifyPrivilege 外的全部特权;
    - 若当前令牌已提升(管理员),追加 LUA_TOKEN 降级到链接(标准用户)令牌;
    - 经 DuplicateTokenEx 转主令牌(CreateRestrictedToken 原始句柄不能直接用于
      CreateProcessAsUserW,实测报 ERROR_ACCESS_DENIED)。
    返回新令牌 HANDLE(调用方负责 close_win_handle)。
    """
    _require_windows()
    a32 = _advapi32()
    base = ctypes.c_void_p(0)
    access = (
        _TOKEN_DUPLICATE | _TOKEN_QUERY | _TOKEN_QUERY_SOURCE
        | _TOKEN_ADJUST_PRIVILEGES | _TOKEN_ADJUST_DEFAULT
    )
    if not a32.OpenProcessToken(ctypes.c_void_p(-1), access, ctypes.byref(base)):
        raise WinApiError("OpenProcessToken 失败", winerror=_winerr())
    restricted = 0
    try:
        flags = DISABLE_MAX_PRIVILEGE
        if _token_is_elevated(base.value or 0):
            flags |= LUA_TOKEN
        new_tok = ctypes.c_void_p(0)
        ok = a32.CreateRestrictedToken(
            base, flags, 0, None, 0, None, 0, None, ctypes.byref(new_tok),
        )
        if not ok:
            # 追加 LUA_TOKEN 失败时回退仅 DISABLE_MAX_PRIVILEGE
            ok = a32.CreateRestrictedToken(
                base, DISABLE_MAX_PRIVILEGE, 0, None, 0, None, 0, None, ctypes.byref(new_tok),
            )
        if not ok:
            raise WinApiError("CreateRestrictedToken 失败", winerror=_winerr())
        restricted = new_tok.value or 0
        primary = ctypes.c_void_p(0)
        if not a32.DuplicateTokenEx(
            ctypes.c_void_p(restricted), 0x02000000,  # MAXIMUM_ALLOWED
            None, 2, 1,  # SecurityImpersonation / TokenPrimary
            ctypes.byref(primary),
        ):
            raise WinApiError("DuplicateTokenEx 失败", winerror=_winerr())
        return primary.value or 0
    finally:
        close_win_handle(base.value or 0)
        if restricted:
            close_win_handle(restricted)


def _quote_windows_arg(text: str) -> str:
    """Windows CommandLineToArgvW 兼容引用。"""
    if text and not any(c in text for c in ' \t"&<>|^'):
        return text
    escaped = ""
    backslashes = 0
    for ch in text:
        if ch == "\\":
            backslashes += 1
            continue
        if ch == '"':
            escaped += "\\" * (backslashes * 2 + 1) + '"'
        else:
            escaped += "\\" * backslashes + ch
        backslashes = 0
    escaped += "\\" * (backslashes * 2)
    return '"' + escaped + '"'


def build_windows_command_line(argv: Sequence[str]) -> str:
    """argv → CreateProcessW 命令行串(公开以便单测引用逻辑)。"""
    return " ".join(_quote_windows_arg(str(a)) for a in argv)


def _build_env_block(env: Mapping[str, str]) -> Any:
    """构造 CreateProcessW 的 Unicode 环境块(\\0 分隔、\\0\\0 结尾)。"""
    if not env:
        return None
    items = sorted(f"{k}={v}" for k, v in env.items())
    buf = ctypes.create_unicode_buffer("\0".join(items) + "\0\0")
    return ctypes.cast(buf, ctypes.c_void_p)


def _resolve_executable(argv: Sequence[str], cwd: str) -> str:
    """argv[0] → 绝对可执行路径(找不到回退原名交给系统 SearchPath)。"""
    import shutil
    first = str(argv[0])
    if os.path.isabs(first):
        return first
    local = os.path.join(cwd or ".", first)
    if os.path.isfile(local):
        return os.path.abspath(local)
    found = shutil.which(first)
    return found or first


def _make_handle_inheritable(handle: int) -> None:
    ok = _kernel32().SetHandleInformation(
        ctypes.c_void_p(handle), _HANDLE_FLAG_INHERIT, _HANDLE_FLAG_INHERIT
    )
    if not ok:
        raise WinApiError("SetHandleInformation 失败", winerror=_winerr())


def is_pid_alive(pid: int) -> bool:
    """OpenProcess + GetExitCodeProcess == STILL_ACTIVE 的存活探测。"""
    _require_windows()
    k32 = _kernel32()
    handle = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE, 0, pid)
    if not handle:
        return False
    try:
        code = ctypes.c_uint32(0)
        if not k32.GetExitCodeProcess(ctypes.c_void_p(int(handle)), ctypes.byref(code)):
            return False
        return int(code.value) == STILL_ACTIVE
    finally:
        k32.CloseHandle(ctypes.c_void_p(int(handle)))


# ---- 应用层路径护栏(Windows 无内核 per-path ACL 时的诚实退路)----

_WRITE_INTENT_FLAGS = {
    "-o", "--output", "--outfile", "-f", "--file", "--dir", "--directory",
    "--out-dir", "--target", "--dest", "--destination", "-C",
}


def _looks_like_path(text: str) -> bool:
    """粗判 token 是否像文件路径(绝对路径或带分隔符+扩展名的相对路径)。"""
    if not text:
        return False
    lowered = text.replace("\\", "/")
    if lowered.startswith("/"):
        return True
    if len(lowered) >= 2 and lowered[1] == ":" and lowered[0].isalpha():
        return True
    last = lowered.rsplit("/", 1)[-1]
    return "/" in lowered and "." in last


def validate_command_paths(
    policy: SandboxPolicy,
    argv: Sequence[str],
    *,
    cwd: str | None = None,
) -> list[str]:
    """启动前策略校验,返回违规描述列表(空 = 通过)。

    校验面:argv 各 token 的路径(含写意图 flag 的值按写入校验)与 cwd 读权限。
    """
    violations: list[str] = []
    pending_write = False
    for token in argv:
        t = str(token)
        flag_head = t.split("=", 1)[0]
        if flag_head in _WRITE_INTENT_FLAGS:
            pending_write = True
            if "=" in t:
                if not policy.can_write(t.split("=", 1)[1]):
                    violations.append(f"写入越权: {t}")
                pending_write = False
            continue
        if _looks_like_path(t):
            if pending_write:
                if not policy.can_write(t):
                    violations.append(f"写入越权: {t}")
            elif not policy.can_read(t):
                violations.append(f"读取越权: {t}")
        pending_write = False
    if cwd is not None and not policy.can_read(cwd):
        violations.append(f"读取越权: cwd={cwd}")
    return violations


class WinJobBackend:
    """Windows 后端:Job Object 限额 + 受限令牌 + CREATE_SUSPENDED→assign→resume。"""

    backend_name = BACKEND_WIN_JOB

    def __init__(self, policy: SandboxPolicy) -> None:
        self.policy = policy

    @staticmethod
    def check_available() -> None:
        """非 Windows 平台抛 CapabilityMissingError。"""
        _require_windows()

    def run(
        self,
        argv: Sequence[str],
        cwd: str = ".",
        env: Mapping[str, str] | None = None,
    ) -> ExecResult:
        """在 Job Object + 受限令牌内执行 argv(不抛 CalledProcessError)。

        Raises:
            SandboxError: argv 为空、路径越权或 Win32 API 失败。
        """
        self.check_available()
        cmd = [str(a) for a in argv]
        if not cmd:
            raise SandboxError("argv 不能为空")
        violations = validate_command_paths(self.policy, cmd, cwd=cwd)
        if violations:
            raise SandboxError("命令路径越权: " + "; ".join(violations))
        # 白名单过滤一切环境来源(继承 + 调用方传入),仅系统必需变量豁免
        merged_env: dict[str, str] = dict(os.environ)
        merged_env.update(env or {})
        child_env = build_child_env(self.policy, merged_env)
        start = time.monotonic()
        timed_out = False
        token_degraded = False
        job = WinJob.create()
        tmpdir = ""
        try:
            job.set_limits(self.policy, kill_on_close=True)
            tmpdir = tempfile.mkdtemp(prefix="ihui_osbox_")
            out_path = os.path.join(tmpdir, "stdout.bin")
            err_path = os.path.join(tmpdir, "stderr.bin")
            out_fd = os.open(out_path, os.O_RDWR | os.O_CREAT | os.O_TRUNC)
            err_fd = os.open(err_path, os.O_RDWR | os.O_CREAT | os.O_TRUNC)
            in_fd = os.open(os.devnull, os.O_RDONLY)
            proc_handle = 0
            thread_handle = 0
            token = 0
            try:
                token = create_restricted_token() if self.policy.restrict_token else 0
                proc_handle, thread_handle, _pid = self._spawn(
                    cmd, cwd, child_env, (in_fd, out_fd, err_fd), token,
                )
                if proc_handle == 0 and token:
                    # 受限令牌下 CreateProcessW 失败 → 回退原始令牌重试(标记降级)
                    token_degraded = True
                    proc_handle, thread_handle, _pid = self._spawn(
                        cmd, cwd, child_env, (in_fd, out_fd, err_fd), 0,
                    )
                if proc_handle == 0:
                    raise WinApiError("CreateProcessW 失败", winerror=_winerr())
                job.assign(proc_handle)
                ret = _kernel32().ResumeThread(ctypes.c_void_p(thread_handle))
                if ret == THREAD_RESUME_FAILED:
                    raise WinApiError("ResumeThread 失败", winerror=_winerr())
                wait = _kernel32().WaitForSingleObject(
                    ctypes.c_void_p(proc_handle), int(self.policy.timeout_s * 1000)
                )
                if wait == WAIT_TIMEOUT:
                    timed_out = True
                    _kernel32().TerminateProcess(ctypes.c_void_p(proc_handle), 1)
                    _kernel32().WaitForSingleObject(ctypes.c_void_p(proc_handle), 5000)
                exit_code = self._exit_code(proc_handle)
            finally:
                if thread_handle:
                    close_win_handle(thread_handle)
                if proc_handle:
                    close_win_handle(proc_handle)
                if token:
                    close_win_handle(token)
                for fd in (in_fd, out_fd, err_fd):
                    with suppress(OSError):
                        os.close(fd)
            stdout_text = self._read_file(out_path)
            stderr_text = self._read_file(err_path)
            if token_degraded:
                stderr_text += "\n[win_job] 受限令牌降级:CreateProcessW 回退原始令牌"
            killed = (not timed_out) and self._killed_by_limit(exit_code, stderr_text)
            return ExecResult(
                cmd=cmd,
                returncode=exit_code,
                stdout=stdout_text,
                stderr=stderr_text,
                duration_ms=(time.monotonic() - start) * 1000,
                backend=self.backend_name,
                timed_out=timed_out,
                killed_by_limit=killed,
            )
        finally:
            # 关闭 job:kill_on_close 保证残留(孙)进程一并死亡
            job.close()
            if tmpdir:
                import shutil
                shutil.rmtree(tmpdir, ignore_errors=True)

    def _spawn(
        self,
        argv: Sequence[str],
        cwd: str,
        env: Mapping[str, str],
        std_fds: tuple[int, int, int],
        token: int,
    ) -> tuple[int, int, int]:
        """CREATE_SUSPENDED 创建进程,返回 (hProcess, hThread, pid)。

        token 非零时走 CreateProcessAsUserW(受限主令牌,子进程真实继承降权);
        否则走 CreateProcessW。失败返回 (0, 0, 0) 由调用方判定降级/报错。
        """
        import msvcrt
        k32 = _kernel32()
        a32 = _advapi32()
        exe = _resolve_executable(argv, cwd)
        cmdline_buf = ctypes.create_unicode_buffer(build_windows_command_line(argv))
        si = STARTUPINFOW()
        si.cb = ctypes.sizeof(STARTUPINFOW)
        si.dwFlags = STARTF_USESTDHANDLES
        si.lpDesktop = "Winsta0\\Default"  # 受限令牌下必须显式指定桌面
        if sys.platform != "win32":  # pragma: no cover - Windows-only 路径
            raise RuntimeError("Windows-only")
        si.hStdInput = msvcrt.get_osfhandle(std_fds[0])
        si.hStdOutput = msvcrt.get_osfhandle(std_fds[1])
        si.hStdError = msvcrt.get_osfhandle(std_fds[2])
        for h in (si.hStdInput, si.hStdOutput, si.hStdError):
            _make_handle_inheritable(int(h))
        pi = PROCESS_INFORMATION()
        flags = CREATE_SUSPENDED | (CREATE_UNICODE_ENVIRONMENT if env else 0)
        abs_cwd = os.path.abspath(cwd or ".")
        if token:
            ok = a32.CreateProcessAsUserW(
                ctypes.c_void_p(token),
                exe,
                ctypes.cast(cmdline_buf, ctypes.c_wchar_p),
                None,
                None,
                1,  # bInheritHandles
                flags,
                _build_env_block(env),
                abs_cwd,
                ctypes.byref(si),
                ctypes.byref(pi),
            )
        else:
            ok = k32.CreateProcessW(
                exe,
                ctypes.cast(cmdline_buf, ctypes.c_wchar_p),
                None,
                None,
                1,  # bInheritHandles
                flags,
                _build_env_block(env),
                abs_cwd,
                ctypes.byref(si),
                ctypes.byref(pi),
            )
        if not ok:
            return (0, 0, 0)
        return (int(pi.hProcess or 0), int(pi.hThread or 0), int(pi.dwProcessId))

    @staticmethod
    def _exit_code(process_handle: int) -> int:
        code = ctypes.c_uint32(0)
        if not _kernel32().GetExitCodeProcess(ctypes.c_void_p(process_handle), ctypes.byref(code)):
            raise WinApiError("GetExitCodeProcess 失败", winerror=_winerr())
        value = int(code.value)
        return value - 0x100000000 if value > 0x7FFFFFFF else value

    @staticmethod
    def _read_file(path: str) -> str:
        try:
            with open(path, "rb") as fh:
                return fh.read().decode("utf-8", errors="replace")
        except OSError:
            return ""

    @staticmethod
    def _killed_by_limit(exit_code: int, stderr_text: str) -> bool:
        """限额触发判定:NTSTATUS 强杀码,或子进程因提交上限抛 MemoryError。"""
        if (exit_code & 0xFFFFFFFF) in _JOB_KILL_CODES:
            return True
        return exit_code != 0 and "MemoryError" in stderr_text


# ============================================================
# Linux 后端:Landlock ABI v4 + bwrap + rlimit 回退链
# ============================================================

# Landlock ABI v4 文件系统访问位(内核 uapi 顺序)
LANDLOCK_ACCESS_FS_EXECUTE = 1 << 0
LANDLOCK_ACCESS_FS_WRITE_FILE = 1 << 1
LANDLOCK_ACCESS_FS_READ_FILE = 1 << 2
LANDLOCK_ACCESS_FS_READ_DIR = 1 << 3
LANDLOCK_ACCESS_FS_REMOVE_DIR = 1 << 4
LANDLOCK_ACCESS_FS_REMOVE_FILE = 1 << 5
LANDLOCK_ACCESS_FS_MAKE_CHAR = 1 << 6
LANDLOCK_ACCESS_FS_MAKE_DIR = 1 << 7
LANDLOCK_ACCESS_FS_MAKE_REG = 1 << 8
LANDLOCK_ACCESS_FS_MAKE_SOCK = 1 << 9
LANDLOCK_ACCESS_FS_MAKE_FIFO = 1 << 10
LANDLOCK_ACCESS_FS_MAKE_BLOCK = 1 << 11
LANDLOCK_ACCESS_FS_MAKE_SYM = 1 << 12
LANDLOCK_ACCESS_FS_REFER = 1 << 13        # ABI v2+
LANDLOCK_ACCESS_FS_TRUNCATE = 1 << 14     # ABI v3+

LANDLOCK_READ_MASK = (
    LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR
)
LANDLOCK_WRITE_MASK = (
    LANDLOCK_ACCESS_FS_WRITE_FILE | LANDLOCK_ACCESS_FS_REMOVE_DIR
    | LANDLOCK_ACCESS_FS_REMOVE_FILE | LANDLOCK_ACCESS_FS_MAKE_CHAR
    | LANDLOCK_ACCESS_FS_MAKE_DIR | LANDLOCK_ACCESS_FS_MAKE_REG
    | LANDLOCK_ACCESS_FS_MAKE_SOCK | LANDLOCK_ACCESS_FS_MAKE_FIFO
    | LANDLOCK_ACCESS_FS_MAKE_BLOCK | LANDLOCK_ACCESS_FS_MAKE_SYM
    | LANDLOCK_ACCESS_FS_REFER | LANDLOCK_ACCESS_FS_TRUNCATE
)
# ABI v4 网络访问位
LANDLOCK_ACCESS_NET_BIND_TCP = 1 << 0
LANDLOCK_ACCESS_NET_CONNECT_TCP = 1 << 1

LANDLOCK_RULE_PATH_BENEATH = 1
#: ABI v4 的 landlock_ruleset_attr 尺寸:handled_access_fs(u64) + handled_access_net(u64)
LANDLOCK_RULESET_ATTR_SIZE_V4 = 16
#: landlock_path_beneath_attr 尺寸:allowed_access(u64) + parent_fd(i32),packed=12
LANDLOCK_PATH_BENEATH_SIZE = 12


def landlock_fs_access_mask(policy: SandboxPolicy) -> int:
    """ruleset 需要接管的 FS 访问位集合(按策略是否限制读/写推导)。"""
    mask = 0
    if policy.readable_paths:
        mask |= LANDLOCK_READ_MASK
    if policy.writable_paths:
        mask |= LANDLOCK_WRITE_MASK
    return mask


def landlock_net_access_mask(policy: SandboxPolicy) -> int:
    """ruleset 需要接管的网络访问位:allow_network 时不接管(0 = 不受 landlock 约束)。"""
    return 0 if policy.allow_network else (
        LANDLOCK_ACCESS_NET_BIND_TCP | LANDLOCK_ACCESS_NET_CONNECT_TCP
    )


def landlock_ruleset_attr_bytes(policy: SandboxPolicy) -> bytes:
    """构造 ABI v4 ``struct landlock_ruleset_attr`` 字节(小端,供 syscall 传入)。"""
    return struct.pack("<QQ", landlock_fs_access_mask(policy), landlock_net_access_mask(policy))


def landlock_path_beneath_bytes(allowed_access: int, parent_fd: int) -> bytes:
    """构造 ``struct landlock_path_beneath_attr`` 12 字节(packed)。"""
    return struct.pack("<Qi", allowed_access, parent_fd)


def landlock_rules_bytes(
    policy: SandboxPolicy,
    fds: Mapping[str, int],
) -> list[tuple[int, bytes]]:
    """按策略与已 open 的目录 fd 表生成 path_beneath 规则序列。

    返回 ``[(LANDLOCK_RULE_PATH_BENEATH, 12字节), ...]``;writable 目录获得
    read|write 全掩码,readable 目录仅读掩码;fds 中缺失的路径跳过。
    """
    rules: list[tuple[int, bytes]] = []
    seen: set[str] = set()
    for path in policy.readable_paths:
        norm = _normalize_path(path)
        if norm in seen or norm not in fds:
            continue
        seen.add(norm)
        rules.append((
            LANDLOCK_RULE_PATH_BENEATH,
            landlock_path_beneath_bytes(LANDLOCK_READ_MASK, fds[norm]),
        ))
    for path in policy.writable_paths:
        norm = _normalize_path(path)
        if norm not in fds:
            continue
        rules.append((
            LANDLOCK_RULE_PATH_BENEATH,
            landlock_path_beneath_bytes(LANDLOCK_READ_MASK | LANDLOCK_WRITE_MASK, fds[norm]),
        ))
    return rules


def build_bwrap_argv(
    policy: SandboxPolicy,
    argv: Sequence[str],
    env: Mapping[str, str] | None = None,
) -> list[str]:
    """构造 bubblewrap 命令行前缀(含策略绑定),末尾 ``--`` 接真实 argv。

    映射规则:readable → ``--ro-bind``;writable → ``--bind``;denied → ``--tmpfs``
    (遮蔽);deny 网络 → ``--unshare-all`` 且不加 ``--share-net``;
    env 白名单 → ``--clearenv`` + ``--setenv``。
    """
    args: list[str] = ["bwrap", "--die-with-parent", "--new-session", "--unshare-all"]
    if policy.allow_network:
        args.append("--share-net")
    args.extend(["--dev", "/dev", "--proc", "/proc"])
    for path in policy.readable_paths:
        p = _normalize_path(path)
        args.extend(["--ro-bind", p, p])
    for path in policy.writable_paths:
        p = _normalize_path(path)
        args.extend(["--bind", p, p])
    for path in policy.denied_paths:
        p = _normalize_path(path)
        args.extend(["--tmpfs", p])
    if policy.env_whitelist:
        args.append("--clearenv")
        source: Mapping[str, str] = env if env is not None else os.environ
        for key in policy.env_whitelist:
            value = source.get(key)
            if value is not None:
                args.extend(["--setenv", key, value])
    args.append("--")
    args.extend(str(a) for a in argv)
    return args


def rlimit_spec(policy: SandboxPolicy) -> list[tuple[str, int, int]]:
    """rlimit 回退层:(资源名, soft, hard) 列表。

    - RLIMIT_AS ← memory_mb(字节)
    - RLIMIT_CPU ← cpu_seconds(soft=上限,hard=+1 宽限)
    - RLIMIT_NPROC ← max_processes
    """
    return [
        ("RLIMIT_AS", policy.memory_mb * 1024 * 1024, policy.memory_mb * 1024 * 1024),
        ("RLIMIT_CPU", policy.cpu_seconds, policy.cpu_seconds + 1),
        ("RLIMIT_NPROC", policy.max_processes, policy.max_processes),
    ]


def make_rlimit_preexec(policy: SandboxPolicy) -> Callable[[], None]:
    """生成 subprocess.preexec_fn:在 fork 后 exec 前应用 setrlimit 链。

    Raises:
        CapabilityMissingError: 非 POSIX 平台(resource 模块不可用)。
    """
    if sys.platform == "win32":
        raise CapabilityMissingError("rlimit 回退链仅在 POSIX 可用")

    def _apply() -> None:
        import resource
        for name, soft, hard in rlimit_spec(policy):
            resource.setrlimit(getattr(resource, name), (soft, hard))

    return _apply


def linux_strategy_chain() -> tuple[str, ...]:
    """Linux 隔离能力回退顺序(强 → 弱):landlock → bwrap → rlimit。"""
    return ("landlock", "bwrap", "rlimit")


class LinuxSandboxBackend:
    """Linux 后端:bwrap(若安装)+ rlimit preexec;landlock 构造层供内核集成。"""

    backend_name = BACKEND_LINUX_BWRAP

    def __init__(self, policy: SandboxPolicy) -> None:
        self.policy = policy

    @staticmethod
    def check_available() -> None:
        """非 Linux 平台抛 CapabilityMissingError。"""
        if not sys.platform.startswith("linux"):
            raise CapabilityMissingError("linux_bwrap 需要 Linux 平台")

    def run(
        self,
        argv: Sequence[str],
        cwd: str = ".",
        env: Mapping[str, str] | None = None,
    ) -> ExecResult:
        """bwrap 前缀(可用时)+ argv,preexec 应用 rlimit;超时由 policy.timeout_s 控制。"""
        self.check_available()
        import shutil
        cmd = [str(a) for a in argv]
        if not cmd:
            raise SandboxError("argv 不能为空")
        violations = validate_command_paths(self.policy, cmd, cwd=cwd)
        if violations:
            raise SandboxError("命令路径越权: " + "; ".join(violations))
        full = (
            build_bwrap_argv(self.policy, cmd, env)
            if shutil.which("bwrap")
            else list(cmd)
        )
        merged_env: dict[str, str] = dict(os.environ)
        merged_env.update(env or {})
        child_env = build_child_env(self.policy, merged_env)
        start = time.monotonic()
        timed_out = False
        try:
            proc = subprocess.run(
                full, cwd=cwd, capture_output=True, timeout=self.policy.timeout_s,
                env=child_env, preexec_fn=make_rlimit_preexec(self.policy), check=False,
            )
            returncode: int = int(proc.returncode)
            stdout_b: bytes = proc.stdout or b""
            stderr_b: bytes = proc.stderr or b""
        except subprocess.TimeoutExpired as e:
            timed_out = True
            returncode = -9
            stdout_b = e.stdout if isinstance(e.stdout, bytes) else b""
            stderr_b = e.stderr if isinstance(e.stderr, bytes) else b""
        return ExecResult(
            cmd=full,
            returncode=returncode,
            stdout=stdout_b.decode("utf-8", errors="replace"),
            stderr=stderr_b.decode("utf-8", errors="replace"),
            duration_ms=(time.monotonic() - start) * 1000,
            backend=self.backend_name,
            timed_out=timed_out,
        )


# ============================================================
# macOS 后端:Seatbelt .sb profile 生成器
# ============================================================

_SEATBELT_BASE_ALLOW = """\
(version 1)
(deny default)
(allow process*)
(allow signal (target same-sandbox))
(allow process-fork)
(allow file-read-metadata)
(allow file-test-existence)
(allow sysctl-read)
(allow mach-lookup)
(allow ipc-posix-shm)
(allow file-ioctl)"""


def _sb_quote(text: str) -> str:
    """Seatbelt 字符串转义(反斜杠与双引号)。"""
    return text.replace("\\", "\\\\").replace('"', '\\"')


def seatbelt_profile(policy: SandboxPolicy) -> str:
    """生成 Seatbelt ``.sb`` profile 文本(sandbox-exec -p 直接可用)。

    结构:deny default → 基础允许 → 网络 allow/deny → readable ``file-read*``
    subpath → writable ``file-write*`` subpath → denied 显式 deny(最后声明,
    Seatbelt 后写规则优先)。readable 为空 = 全盘可读(仅 denied 生效)。
    """
    lines: list[str] = [_SEATBELT_BASE_ALLOW]
    if policy.allow_network:
        lines.append("(allow network*)")
    else:
        lines.append("(deny network*)")
    if not policy.readable_paths:
        lines.append('(allow file-read* (subpath "/"))')
    for path in policy.readable_paths:
        p = _sb_quote(_normalize_path(path))
        lines.append(f'(allow file-read* (subpath "{p}"))')
    for path in policy.writable_paths:
        p = _sb_quote(_normalize_path(path))
        lines.append(f'(allow file-write* (subpath "{p}"))')
    for path in policy.denied_paths:
        p = _sb_quote(_normalize_path(path))
        lines.append(f'(deny file-read* (subpath "{p}"))')
        lines.append(f'(deny file-write* (subpath "{p}"))')
    return "\n".join(lines) + "\n"


def seatbelt_argv(policy: SandboxPolicy, argv: Sequence[str]) -> list[str]:
    """sandbox-exec 包装 argv:[sandbox-exec, -p, <profile>, *argv]。"""
    return ["sandbox-exec", "-p", seatbelt_profile(policy), *[str(a) for a in argv]]


class MacSeatbeltBackend:
    """macOS 后端:sandbox-exec -p <seatbelt profile> 包装执行。"""

    backend_name = BACKEND_MAC_SEATBELT

    def __init__(self, policy: SandboxPolicy) -> None:
        self.policy = policy

    @staticmethod
    def check_available() -> None:
        """非 darwin 平台抛 CapabilityMissingError。"""
        if sys.platform != "darwin":
            raise CapabilityMissingError("mac_seatbelt 需要 macOS(darwin)平台")

    def run(
        self,
        argv: Sequence[str],
        cwd: str = ".",
        env: Mapping[str, str] | None = None,
    ) -> ExecResult:
        """seatbelt_argv 包装 + subprocess 执行(rlimit 补充资源限额)。"""
        self.check_available()
        cmd = [str(a) for a in argv]
        if not cmd:
            raise SandboxError("argv 不能为空")
        violations = validate_command_paths(self.policy, cmd, cwd=cwd)
        if violations:
            raise SandboxError("命令路径越权: " + "; ".join(violations))
        full = seatbelt_argv(self.policy, cmd)
        start = time.monotonic()
        timed_out = False
        try:
            proc = subprocess.run(
                full, cwd=cwd, capture_output=True, timeout=self.policy.timeout_s,
                preexec_fn=make_rlimit_preexec(self.policy), check=False,
            )
            returncode: int = int(proc.returncode)
            stdout_b: bytes = proc.stdout or b""
            stderr_b: bytes = proc.stderr or b""
        except subprocess.TimeoutExpired as e:
            timed_out = True
            returncode = -9
            stdout_b = e.stdout if isinstance(e.stdout, bytes) else b""
            stderr_b = e.stderr if isinstance(e.stderr, bytes) else b""
        return ExecResult(
            cmd=full,
            returncode=returncode,
            stdout=stdout_b.decode("utf-8", errors="replace"),
            stderr=stderr_b.decode("utf-8", errors="replace"),
            duration_ms=(time.monotonic() - start) * 1000,
            backend=self.backend_name,
            timed_out=timed_out,
        )


# ============================================================
# 统一入口:SandboxHandle
# ============================================================

_BACKENDS: dict[str, type[Any]] = {
    BACKEND_WIN_JOB: WinJobBackend,
    BACKEND_LINUX_BWRAP: LinuxSandboxBackend,
    BACKEND_MAC_SEATBELT: MacSeatbeltBackend,
}


class SandboxHandle:
    """沙箱句柄:绑定策略与后端,``run(cmd) -> ExecResult``。"""

    def __init__(self, policy: SandboxPolicy, backend: str | None = None) -> None:
        self.policy = policy
        self.backend = backend or get_default_backend()
        if self.backend not in _BACKENDS:
            raise CapabilityMissingError(f"未知沙箱后端: {self.backend}")
        self._impl: WinJobBackend | LinuxSandboxBackend | MacSeatbeltBackend = (
            _BACKENDS[self.backend](policy)
        )

    def run(
        self,
        cmd: str | Sequence[str],
        cwd: str = ".",
        env: Mapping[str, str] | None = None,
    ) -> ExecResult:
        """执行命令:str 按平台 shlex 拆分(Windows 用 posix=False 保留反斜杠)。"""
        if isinstance(cmd, str):
            argv = shlex.split(cmd, posix=sys.platform != "win32")
        else:
            argv = [str(a) for a in cmd]
        return self._impl.run(argv, cwd=cwd, env=env)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
