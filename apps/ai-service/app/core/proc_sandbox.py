# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""引擎子进程 OS 级沙箱(2026-09-18 第八批,对标 Codex execpolicy 的内核沙箱层)。

Windows 实现为 Job Object(codex 在 Linux/macOS 用 landlock/seatbelt,生产为
Windows,Job Object 即内核级等价物):

- KILL_ON_JOB_CLOSE:父进程(引擎)死亡 → 沙箱内全部子进程被内核回收,防孤儿
- PROCESS_MEMORY_LIMIT:单进程内存上限,防内存炸弹
- ACTIVE_PROCESS_LIMIT:进程数上限,防 fork 炸弹
- UI 限制:禁剪贴板读/写、禁改系统参数、禁句柄继承到用户桌面对象

非 Windows 或任何失败均静默降级(返回 active=False + reason),绝不影响主流程。
纯 ctypes 标准库,零新增依赖。

计量与版本可追溯(2026-10-31 立,§5e-3「量与拦必须同批」):
本函数的**每一个** return 分支都在同一批里往 ``core.sandbox_metrics`` 落一枚 guard 计数
(enforced / degraded / undetermined + 稳定 reason_id),并把生效策略的版本标识随返回值
一起带出去(``policyVersion``)。理由:降级分支的语义是"这一层护栏没装上",静默返回
就等于没人知道有多少子进程在无护栏状态下跑过。版本算不出来时 ``policyVersion`` 落
字面 ``"undetermined"`` —— 不得用空串或某个默认号冒充"有版本"。
"""

import asyncio
import ctypes
import sys
from typing import Any

from app.core.sandbox_metrics import (
    GUARD_STATE_DEGRADED,
    GUARD_STATE_ENFORCED,
    GUARD_STATE_UNDETERMINED,
    policy_version_state,
    record_guard_state,
)

__all__ = ["apply_job_sandbox"]

# guard 计数用的稳定 reason 身份:**逐条对应下面的 return 分支**,是人给的短名,
# 不含 GetLastError 数字与异常原文(那些留在返回 dict 的 reason 里给人看)。
# 新增分支必须在这里登记一枚,否则该分支的计数会被 sandbox_metrics 折成 unclassified。
_REASON_PID_UNAVAILABLE = "pid_unavailable"
_REASON_OPEN_PROCESS_FAILED = "open_process_failed"
_REASON_CREATE_JOB_FAILED = "create_job_failed"
_REASON_SET_LIMITS_FAILED = "set_limits_failed"
_REASON_SET_UI_LIMITS_FAILED = "set_ui_limits_failed"
_REASON_ASSIGN_FAILED = "assign_failed"
_REASON_EXCEPTION = "exception"
_REASON_NON_WINDOWS = "non_windows_platform"
_REASON_JOB_ASSIGNED = "job_object_assigned"


def _policy_version_label() -> str:
    """生效策略的版本标识。

    算不出来时返回的就是 sandbox_metrics 里那个字面 ``undetermined`` —— 不猜版本号、
    不用空串或默认号冒充"有版本"(§0.3:没判绝不写成判过)。
    """
    return str(policy_version_state()["versionId"])

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


def _degraded(reason_id: str, reason: str) -> dict[str, Any]:
    """降级出口(护栏没装上):计数与返回同批,不留"静默拒绝"那一格。

    ``reason_id`` 进时序身份,``reason`` 只进返回值给人看 —— 后者含 GetLastError
    数字,当身份用会造出一串会抖的序列(§5e-3 同族纪律)。
    """
    record_guard_state(GUARD_STATE_DEGRADED, reason_id)
    return {"active": False, "reason": reason, "policyVersion": _policy_version_label()}


def _undetermined(reason_id: str, reason: str) -> dict[str, Any]:
    """未判定出口(这一步本身没判成):与降级分开记,两者含义不同。

    降级 == 知道这台机/这个进程装不上护栏;未判定 == 连"装没装"都没量出来。
    并桶等于把"没量"说成"量到了坏的"。
    """
    record_guard_state(GUARD_STATE_UNDETERMINED, reason_id)
    return {"active": False, "reason": reason, "policyVersion": _policy_version_label()}


def apply_job_sandbox(
    proc: asyncio.subprocess.Process,
    *,
    memory_limit: int = _DEFAULT_MEMORY_LIMIT,
    active_process_limit: int = _DEFAULT_ACTIVE_PROCESS_LIMIT,
) -> dict[str, Any]:
    """把子进程(及其后代)收入 Windows Job Object 沙箱。

    Returns:
        {"active": True, "memoryLimit": ..., "activeProcessLimit": ...,
         "policyVersion": "sbx-p1-<fp>"}
        或 {"active": False, "reason": "...", "policyVersion": ...}
        (非 Windows / 已退出 / 调用失败)。

    拦截语义与升级前完全一致:本函数不新增、不放宽、不改动任何判定条件,
    只在**既有的每个 return 分支**上同批落一枚 guard 计数(§5e-3)。
    """
    # 平台判据用 sys.platform,且把整个 Windows 实现包进该分支:typeshed 只按
    # sys.platform 收窄模块属性可用性(ctypes.windll / ctypes.GetLastError 都是
    # win32-only)。写成「非 win32 就提前 return」不解决问题 —— mypy 消除的是被
    # 证伪的分支体,提前 return 之后的代码在 Linux 面照样被分析。
    if sys.platform == "win32":
        pid = getattr(proc, "pid", None)
        if not pid:
            return _degraded(_REASON_PID_UNAVAILABLE, "process pid 不可用")
        kernel32 = ctypes.windll.kernel32
        PROCESS_SET_QUOTA = 0x0100
        PROCESS_TERMINATE = 0x0001
        handle = kernel32.OpenProcess(
            PROCESS_SET_QUOTA | PROCESS_TERMINATE, False, int(pid)
        )
        if not handle:
            return _degraded(
                _REASON_OPEN_PROCESS_FAILED,
                f"OpenProcess({pid}) 失败: {ctypes.GetLastError()}",
            )
        try:
            job = kernel32.CreateJobObjectW(None, None)
            if not job:
                return _degraded(
                    _REASON_CREATE_JOB_FAILED,
                    f"CreateJobObjectW 失败: {ctypes.GetLastError()}",
                )

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
                return _degraded(
                    _REASON_SET_LIMITS_FAILED,
                    f"SetInformationJobObject 失败: {ctypes.GetLastError()}",
                )

            ui_limits = ctypes.c_uint32(_UI_RESTRICTIONS)
            ok = kernel32.SetInformationJobObject(
                job,
                _JobObjectBasicUIRestrictions,
                ctypes.byref(ui_limits),
                ctypes.sizeof(ui_limits),
            )
            if not ok:
                kernel32.CloseHandle(job)
                return _degraded(
                    _REASON_SET_UI_LIMITS_FAILED, f"UI 限制设置失败: {ctypes.GetLastError()}"
                )

            if not kernel32.AssignProcessToJobObject(job, handle):
                kernel32.CloseHandle(job)
                return _degraded(
                    _REASON_ASSIGN_FAILED,
                    f"AssignProcessToJobObject 失败: {ctypes.GetLastError()}",
                )

            record_guard_state(GUARD_STATE_ENFORCED, _REASON_JOB_ASSIGNED)
            return {
                "active": True,
                "memoryLimit": memory_limit,
                "activeProcessLimit": active_process_limit,
                "killOnClose": True,
                "uiRestrictions": "clipboard/systemparams/handles/globalatoms/display/exitwindows",
                "policyVersion": _policy_version_label(),
            }
        except Exception as e:  # noqa: BLE001 - 沙箱失败绝不影响子进程主流程
            # 异常路径是"没判成"而不是"判成坏的":并到 degraded 会把一次 API
            # 抖动读成一次确定的降级(§0.3)。
            return _undetermined(_REASON_EXCEPTION, f"沙箱异常: {e}")
    return _degraded(_REASON_NON_WINDOWS, "non-windows(仅生产 Windows 生效)")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
