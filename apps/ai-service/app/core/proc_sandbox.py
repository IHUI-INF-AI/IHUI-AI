# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""引擎子进程 OS 级沙箱(2026-09-18 第八批,对标 Codex execpolicy 的内核沙箱层)。

Windows 实现为 Job Object(codex 在 Linux/macOS 用 landlock/seatbelt,生产为
Windows,Job Object 即内核级等价物):

- KILL_ON_JOB_CLOSE:父进程(引擎)死亡 → 沙箱内全部子进程被内核回收,防孤儿
- PROCESS_MEMORY_LIMIT:单进程内存上限,防内存炸弹
- ACTIVE_PROCESS_LIMIT:进程数上限,防 fork 炸弹
- UI 限制:禁剪贴板读/写、禁改系统参数、禁句柄继承到用户桌面对象

非 Windows 或任何失败均静默降级(返回 active=False + reason),绝不影响主流程。
纯 ctypes 标准库,零新增依赖。
"""

import asyncio
import ctypes
import os
from typing import Any

__all__ = ["apply_job_sandbox"]

# JobObjectInformationClass
_JobObjectExtendedLimitInformation = 9
_JobObjectBasicUIRestrictions = 4

# JOBOBJECT_EXTENDED_LIMIT_INFORMATION.LimitFlags
_JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x00000008
_JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100
_JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000

# JOBOBJECT_BASIC_UI_RESTRICTIONS
_JOB_OBJECT_UILIMIT_EXITWINDOWS = 0x00000001
_JOB_OBJECT_UILIMIT_READCLIPBOARD = 0x00000002
_JOB_OBJECT_UILIMIT_DISPLAYSETTINGS = 0x00000004
_JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS = 0x00000008
_JOB_OBJECT_UILIMIT_WRITECLIPBOARD = 0x00000010
_JOB_OBJECT_UILIMIT_GLOBALATOMS = 0x00000020
_JOB_OBJECT_UILIMIT_HANDLES = 0x00000040

_UI_RESTRICTIONS = (
    _JOB_OBJECT_UILIMIT_EXITWINDOWS
    | _JOB_OBJECT_UILIMIT_READCLIPBOARD
    | _JOB_OBJECT_UILIMIT_DISPLAYSETTINGS
    | _JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS
    | _JOB_OBJECT_UILIMIT_WRITECLIPBOARD
    | _JOB_OBJECT_UILIMIT_GLOBALATOMS
    | _JOB_OBJECT_UILIMIT_HANDLES
)

_DEFAULT_MEMORY_LIMIT = 1536 * 1024 * 1024  # 单进程 1.5GB
_DEFAULT_ACTIVE_PROCESS_LIMIT = 16  # 进程数上限(fork 炸弹防护)


class _IO_COUNTERS(ctypes.Structure):
    _fields_ = [
        (name, ctypes.c_uint64)
        for name in (
            "ReadOperationCount",
            "WriteOperationCount",
            "OtherOperationCount",
            "ReadTransferCount",
            "WriteTransferCount",
            "OtherTransferCount",
        )
    ]


class _JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
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


class _JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", _JOBOBJECT_BASIC_LIMIT_INFORMATION),
        ("IoInfo", _IO_COUNTERS),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


def apply_job_sandbox(
    proc: asyncio.subprocess.Process,
    *,
    memory_limit: int = _DEFAULT_MEMORY_LIMIT,
    active_process_limit: int = _DEFAULT_ACTIVE_PROCESS_LIMIT,
) -> dict[str, Any]:
    """把子进程(及其后代)收入 Windows Job Object 沙箱。

    Returns:
        {"active": True, "memoryLimit": ..., "activeProcessLimit": ...}
        或 {"active": False, "reason": "..."}(非 Windows / 已退出 / 调用失败)。
    """
    if os.name != "nt":
        return {"active": False, "reason": "non-windows(仅生产 Windows 生效)"}
    pid = getattr(proc, "pid", None)
    if not pid:
        return {"active": False, "reason": "process pid 不可用"}
    kernel32 = ctypes.windll.kernel32
    PROCESS_SET_QUOTA = 0x0100
    PROCESS_TERMINATE = 0x0001
    handle = kernel32.OpenProcess(
        PROCESS_SET_QUOTA | PROCESS_TERMINATE, False, int(pid)
    )
    if not handle:
        return {
            "active": False,
            "reason": f"OpenProcess({pid}) 失败: {ctypes.GetLastError()}",
        }
    try:
        job = kernel32.CreateJobObjectW(None, None)
        if not job:
            return {"active": False, "reason": f"CreateJobObjectW 失败: {ctypes.GetLastError()}"}

        limits = _JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        limits.BasicLimitInformation.LimitFlags = (
            _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            | _JOB_OBJECT_LIMIT_PROCESS_MEMORY
            | _JOB_OBJECT_LIMIT_ACTIVE_PROCESS
        )
        limits.ProcessMemoryLimit = memory_limit
        limits.BasicLimitInformation.ActiveProcessLimit = active_process_limit
        ok = kernel32.SetInformationJobObject(
            job,
            _JobObjectExtendedLimitInformation,
            ctypes.byref(limits),
            ctypes.sizeof(limits),
        )
        if not ok:
            kernel32.CloseHandle(job)
            return {"active": False, "reason": f"SetInformationJobObject 失败: {ctypes.GetLastError()}"}

        ui_limits = ctypes.c_uint32(_UI_RESTRICTIONS)
        ok = kernel32.SetInformationJobObject(
            job,
            _JobObjectBasicUIRestrictions,
            ctypes.byref(ui_limits),
            ctypes.sizeof(ui_limits),
        )
        if not ok:
            kernel32.CloseHandle(job)
            return {"active": False, "reason": f"UI 限制设置失败: {ctypes.GetLastError()}"}

        if not kernel32.AssignProcessToJobObject(job, handle):
            kernel32.CloseHandle(job)
            return {"active": False, "reason": f"AssignProcessToJobObject 失败: {ctypes.GetLastError()}"}

        return {
            "active": True,
            "memoryLimit": memory_limit,
            "activeProcessLimit": active_process_limit,
            "killOnClose": True,
            "uiRestrictions": "clipboard/systemparams/handles/globalatoms/display/exitwindows",
        }
    except Exception as e:  # noqa: BLE001 - 沙箱失败绝不影响子进程主流程
        return {"active": False, "reason": f"沙箱异常: {e}"}
