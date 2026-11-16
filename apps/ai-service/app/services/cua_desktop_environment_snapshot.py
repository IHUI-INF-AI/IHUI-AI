# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""CUA 桌面环境快照 — 复现 Codex 26.1111 windows-account.node 性能/进程枚举面。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/native-plugin-mechanisms-deep.md`` §2
(windows-account.node,ASCII 字符串抽取,导出面 + 失败文案级证据)::

    getSystemPerformanceSnapshot → 字段: systemTotalMemoryBytes /
      systemFreeMemoryBytes / systemCommitTotalBytes / systemCommitLimitBytes /
      systemKernelPagedPoolBytes / systemKernelNonpagedPoolBytes /
      mainProcessHandleCount / systemHandleCount / systemProcessCount /
      systemThreadCount / systemUptimeMs
    listProcesses → 每进程: parentPid / executableName / executablePath /
      commandLine / creationTimeMs
    getWebBrowserState → browserIsRunning / browserHasVisibleWindow
    失败文案: "Unable to read the Windows process snapshot"
    Win32 面: NtQueryInformationProcess(父PID/命令行)、CreateToolhelp32Snapshot 族

Codex 语义:这是 CUA"看清桌面上有什么"的前提 —— 环境感知第一批能力:
- **性能快照**:内存/提交/内核池/句柄/进程线程数/uptime,判资源是否够跑任务;
- **进程表**:父PID/可执行名/路径/命令行/创建时间,定位目标应用与浏览器进程;
- **浏览器状态**:是否在跑 + 是否有可见窗口(判浏览器是否被用户占用)。

对照 IHUI 缺口
--------------
TPM 信任根(device_key_trust_root)与浏览器可见性(browser_visibility)已落地;
``environment_context`` 管 env/网络/FS,``shell_snapshot`` 管 bash 环境 —— 都不是
Windows 桌面级**性能/进程**快照。本模块补齐这两类的**字段校验 + 归一纯逻辑层**:
不真调 Win32(零 IO),只把原生层采回的原始字段校验成可信快照,供 CUA 判资源/
定位进程/判浏览器占用。

设计要点(纯函数,零 IO)
------------------------
1. ``PerformanceSnapshot`` + ``validate_performance_snapshot``:字段齐备性 +
   非负整数校验 + 派生量(内存使用率、提交占比);
2. ``ProcessEntry`` + ``validate_process_list``:每进程字段校验 + PID 去重 +
   按 executableName 索引;
3. ``BrowserRunningState`` + ``validate_browser_state``:browserIsRunning /
   browserHasVisibleWindow 二态校验 + "在跑但无可见窗"= 后台占用 判定;
4. 与既有层关系:不接管真采集(那在 Tauri/desktop 侧),只做采回后的可信化。

刻意不做什么
------------
- 不连 Win32/psutil,不起进程,零 IO:本模块是**采回数据的可信化闸**;
- 不做进程杀/启(那是执行面,有独立审批),只做只读快照的可信化。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# ── 系统性能快照 ────────────────────────────────────────────────────────────

_PERF_INT_FIELDS: tuple[str, ...] = (
    "systemTotalMemoryBytes",
    "systemFreeMemoryBytes",
    "systemCommitTotalBytes",
    "systemCommitLimitBytes",
    "systemKernelPagedPoolBytes",
    "systemKernelNonpagedPoolBytes",
    "mainProcessHandleCount",
    "systemHandleCount",
    "systemProcessCount",
    "systemThreadCount",
    "systemUptimeMs",
)


@dataclass(frozen=True)
class PerformanceSnapshot:
    """归一后的系统性能快照(Codex getSystemPerformanceSnapshot 字段)。"""

    fields: dict[str, int]  # 校验通过的非负整数字段
    memory_used_ratio: float  # 派生:已用内存占比(0~1)
    commit_ratio: float  # 派生:提交内存占提交上限比(0~1,无上限为 0)
    warnings: tuple[str, ...] = ()  # 校验中发现的非致命异常(字段缺失/异常值)


class PerformanceSnapshotError(ValueError):
    """性能快照不可信(致命字段缺失/负值/类型错)。"""


def validate_performance_snapshot(raw: dict[str, Any]) -> PerformanceSnapshot:
    """把原生层采回的性能快照校验归一为可信 PerformanceSnapshot(纯函数)。

    - 11 个整数字段须非负整数(缺致命字段即抛,防资源判断踩空);
    - free > total、commitTotal > commitLimit 视为异常值,记 warning 不致命
      (Windows 计数器偶发抖动,不该让整个快照作废);
    - 派生 memory_used_ratio = (total-free)/total(total=0 时为 0,不除零)。
    """
    if not isinstance(raw, dict):
        raise PerformanceSnapshotError("性能快照须为对象")
    warnings: list[str] = []
    fields: dict[str, int] = {}
    for key in _PERF_INT_FIELDS:
        val = raw.get(key)
        if val is None:
            # total/free 是致命字段(缺了无法判资源);其余可缺并记 warning
            if key in ("systemTotalMemoryBytes", "systemFreeMemoryBytes"):
                raise PerformanceSnapshotError(f"性能快照缺致命字段 {key}")
            warnings.append(f"缺字段 {key}(非致命,按 0 处理)")
            fields[key] = 0
            continue
        if isinstance(val, bool) or not isinstance(val, int):
            raise PerformanceSnapshotError(f"{key} 须整数,得到 {val!r}")
        if val < 0:
            raise PerformanceSnapshotError(f"{key} 须非负,得到 {val}")
        fields[key] = val

    total = fields["systemTotalMemoryBytes"]
    free = fields["systemFreeMemoryBytes"]
    if free > total:
        warnings.append(f"free({free}) > total({total}):计数器抖动,按 0 使用率处理")

    commit_total = fields["systemCommitTotalBytes"]
    commit_limit = fields["systemCommitLimitBytes"]
    commit_ratio = (commit_total / commit_limit) if commit_limit > 0 else 0.0
    if commit_total > commit_limit:
        warnings.append(f"commitTotal({commit_total}) > commitLimit({commit_limit})")

    used = max(0, total - min(free, total))
    memory_used_ratio = (used / total) if total > 0 else 0.0
    return PerformanceSnapshot(
        fields=fields,
        memory_used_ratio=memory_used_ratio,
        commit_ratio=commit_ratio,
        warnings=tuple(warnings),
    )


# ── 进程表 ──────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ProcessEntry:
    """归一后的单进程条目(Codex listProcesses 字段)。"""

    pid: int
    parent_pid: int | None
    executable_name: str
    executable_path: str | None
    command_line: str | None
    creation_time_ms: int | None


@dataclass(frozen=True)
class ProcessListSnapshot:
    """归一后的进程表快照。"""

    entries: tuple[ProcessEntry, ...]
    by_name: dict[str, tuple[ProcessEntry, ...]]  # executableName(小写)→ 进程
    duplicates_dropped: tuple[int, ...]  # 被去重的 PID(同 PID 后者胜出)
    invalid_dropped: int  # 被丢弃的非法条目数


class ProcessListError(ValueError):
    """进程表整体不可信(非列表/全空)。"""


def validate_process_list(raw: list[Any]) -> ProcessListSnapshot:
    """把原生层采回的进程表校验归一(纯函数)。

    - raw 须为列表;
    - 每条须含 pid(int)+ executableName(非空串),否则丢弃计 invalid_dropped;
    - 同 PID 后者覆盖前者(Windows 快照偶发重复),被覆盖 PID 记 duplicates_dropped;
    - by_name 按 executableName 小写索引,便于 CUA 按名定位目标应用。
    """
    if not isinstance(raw, list):
        raise ProcessListError("进程表须为列表")
    entries: list[ProcessEntry] = []
    by_name: dict[str, list[ProcessEntry]] = {}
    seen_pids: set[int] = set()
    duplicates: list[int] = []
    invalid = 0

    for item in raw:
        if not isinstance(item, dict):
            invalid += 1
            continue
        pid = item.get("pid")
        name = item.get("executableName")
        if isinstance(pid, bool) or not isinstance(pid, int) or pid < 0:
            invalid += 1
            continue
        if not isinstance(name, str) or not name.strip():
            invalid += 1
            continue

        parent = item.get("parentPid")
        parent_pid = parent if isinstance(parent, int) and not isinstance(parent, bool) and parent >= 0 else None
        path = item.get("executablePath")
        cmdline = item.get("commandLine")
        creation = item.get("creationTimeMs")
        entry = ProcessEntry(
            pid=pid,
            parent_pid=parent_pid,
            executable_name=name.strip(),
            executable_path=path if isinstance(path, str) and path.strip() else None,
            command_line=cmdline if isinstance(cmdline, str) and cmdline.strip() else None,
            creation_time_ms=creation if isinstance(creation, int) and not isinstance(creation, bool) and creation >= 0 else None,
        )

        if pid in seen_pids:
            # 同 PID:移除旧的,记重复
            entries = [e for e in entries if e.pid != pid]
            for lst in by_name.values():
                lst[:] = [e for e in lst if e.pid != pid]
            duplicates.append(pid)
        seen_pids.add(pid)
        entries.append(entry)
        by_name.setdefault(entry.executable_name.lower(), []).append(entry)

    if not entries:
        raise ProcessListError("进程表为空(Unable to read the Windows process snapshot?)")
    frozen_by_name = {k: tuple(v) for k, v in by_name.items()}
    return ProcessListSnapshot(
        entries=tuple(entries),
        by_name=frozen_by_name,
        duplicates_dropped=tuple(duplicates),
        invalid_dropped=invalid,
    )


def find_process_by_name(snapshot: ProcessListSnapshot, name: str) -> tuple[ProcessEntry, ...]:
    """按可执行名(大小写不敏感)定位进程,便于 CUA 找浏览器/目标应用。"""
    return snapshot.by_name.get(name.strip().lower(), ())


# ── 浏览器运行状态 ──────────────────────────────────────────────────────────


@dataclass(frozen=True)
class BrowserRunningState:
    """归一后的浏览器运行状态(Codex getWebBrowserState)。"""

    is_running: bool
    has_visible_window: bool
    occupied_by_user: bool  # 派生:在跑且有可见窗 = 可能正被用户用,agent 须谨慎
    background_only: bool  # 派生:在跑但无可见窗 = 后台占用
    detail: str


class BrowserStateError(ValueError):
    """浏览器状态字段不可信。"""


def validate_browser_state(raw: dict[str, Any]) -> BrowserRunningState:
    """把原生层采回的浏览器状态校验归一(纯函数)。

    Codex §2:getWebBrowserState → browserIsRunning / browserHasVisibleWindow,
    CUA 用它判浏览器是否被用户占用(在跑且有可见窗 = 谨慎,别抢/别乱动)。
    """
    if not isinstance(raw, dict):
        raise BrowserStateError("浏览器状态须为对象")
    running = raw.get("browserIsRunning")
    visible = raw.get("browserHasVisibleWindow")
    for key, val in (("browserIsRunning", running), ("browserHasVisibleWindow", visible)):
        if not isinstance(val, bool):
            raise BrowserStateError(f"{key} 须布尔,得到 {val!r}")
    occupied = running and visible
    background_only = running and not visible
    if occupied:
        detail = "浏览器在跑且有可见窗口:可能正被用户使用,agent 须谨慎(优先复用/不抢)。"
    elif background_only:
        detail = "浏览器在跑但无可见窗口:后台占用,可受控操作。"
    else:
        detail = "浏览器未运行。"
    return BrowserRunningState(
        is_running=running,
        has_visible_window=visible,
        occupied_by_user=occupied,
        background_only=background_only,
        detail=detail,
    )


__all__ = [
    "PerformanceSnapshot",
    "PerformanceSnapshotError",
    "validate_performance_snapshot",
    "ProcessEntry",
    "ProcessListSnapshot",
    "ProcessListError",
    "validate_process_list",
    "find_process_by_name",
    "BrowserRunningState",
    "BrowserStateError",
    "validate_browser_state",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
