# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""cua_desktop_environment_snapshot 判据钉(统一实现 windows-account.node)。

钉住:性能快照字段齐备+非负校验+派生量、致命字段缺失即抛、计数器抖动记
warning 不致命、进程表 PID 去重+非法丢弃+按名索引、浏览器状态二态+占用/后台
派生。零 IO。
"""

import pytest

from app.services.cua_desktop_environment_snapshot import (
    BrowserStateError,
    PerformanceSnapshotError,
    ProcessListError,
    find_process_by_name,
    validate_browser_state,
    validate_performance_snapshot,
    validate_process_list,
)

# ── 性能快照 ────────────────────────────────────────────────────────────────


def _perf_raw(**overrides):
    base = {
        "systemTotalMemoryBytes": 16_000_000_000,
        "systemFreeMemoryBytes": 8_000_000_000,
        "systemCommitTotalBytes": 4_000_000_000,
        "systemCommitLimitBytes": 20_000_000_000,
        "systemKernelPagedPoolBytes": 1_000_000,
        "systemKernelNonpagedPoolBytes": 500_000,
        "mainProcessHandleCount": 1024,
        "systemHandleCount": 100_000,
        "systemProcessCount": 200,
        "systemThreadCount": 3000,
        "systemUptimeMs": 86_400_000,
    }
    base.update(overrides)
    return base


def test_perf_snapshot_valid_and_derived():
    """合法快照:派生内存使用率 = (total-free)/total = 0.5。"""
    snap = validate_performance_snapshot(_perf_raw())
    assert snap.memory_used_ratio == pytest.approx(0.5)
    assert snap.commit_ratio == pytest.approx(0.2)
    assert snap.fields["systemProcessCount"] == 200
    assert snap.warnings == ()


def test_perf_missing_fatal_field_raises():
    """缺 total/free 致命字段即抛(防资源判断踩空)。"""
    raw = _perf_raw()
    del raw["systemTotalMemoryBytes"]
    with pytest.raises(PerformanceSnapshotError):
        validate_performance_snapshot(raw)


def test_perf_missing_nonfatal_field_warns():
    """缺非致命字段(如 uptime)记 warning 不抛,按 0 处理。"""
    raw = _perf_raw()
    del raw["systemUptimeMs"]
    snap = validate_performance_snapshot(raw)
    assert snap.fields["systemUptimeMs"] == 0
    assert any("systemUptimeMs" in w for w in snap.warnings)


def test_perf_negative_value_raises():
    """负值即抛(计数器不可为负)。"""
    with pytest.raises(PerformanceSnapshotError):
        validate_performance_snapshot(_perf_raw(systemFreeMemoryBytes=-1))


def test_perf_free_gt_total_warns():
    """free > total 计数器抖动:记 warning,使用率按 0,不致命。"""
    snap = validate_performance_snapshot(_perf_raw(systemFreeMemoryBytes=99_000_000_000))
    assert snap.memory_used_ratio == 0.0
    assert any("free" in w and "total" in w for w in snap.warnings)


def test_perf_zero_total_no_divzero():
    """total=0 不除零,使用率为 0。"""
    snap = validate_performance_snapshot(_perf_raw(systemTotalMemoryBytes=0, systemFreeMemoryBytes=0))
    assert snap.memory_used_ratio == 0.0


def test_perf_bool_rejected():
    """bool 不是合法整数(防 Python bool==int 陷阱)。"""
    with pytest.raises(PerformanceSnapshotError):
        validate_performance_snapshot(_perf_raw(systemProcessCount=True))


# ── 进程表 ──────────────────────────────────────────────────────────────────


def _proc(pid, name, **kw):
    return {"pid": pid, "executableName": name, **kw}


def test_process_list_valid_and_index():
    """合法进程表:按名(小写)索引可查。"""
    snap = validate_process_list([_proc(100, "chrome.exe"), _proc(200, "Code.exe")])
    assert len(snap.entries) == 2
    assert snap.invalid_dropped == 0
    hits = find_process_by_name(snap, "CHROME.EXE")
    assert len(hits) == 1 and hits[0].pid == 100


def test_process_list_dedup_same_pid():
    """同 PID 后者覆盖前者(Windows 快照偶发重复),记 duplicates_dropped。"""
    snap = validate_process_list([_proc(100, "a.exe"), _proc(100, "b.exe")])
    assert len(snap.entries) == 1
    assert snap.entries[0].executable_name == "b.exe"
    assert snap.duplicates_dropped == (100,)


def test_process_list_invalid_dropped():
    """缺 pid/name 或 pid 负数/非串 name 的条目丢弃计 invalid。"""
    snap = validate_process_list(
        [
            _proc(100, "ok.exe"),
            {"executableName": "no-pid.exe"},
            {"pid": 200},
            _proc(-1, "neg.exe"),
            _proc(300, "  "),  # 空白名
            "not-a-dict",
        ]
    )
    assert len(snap.entries) == 1
    assert snap.entries[0].pid == 100
    assert snap.invalid_dropped == 5


def test_process_list_empty_raises():
    """全空/全非法进程表即抛(对齐 Codex 失败文案语义)。"""
    with pytest.raises(ProcessListError):
        validate_process_list([])


def test_process_optional_fields_coerced():
    """可选字段(parent/path/cmdline/creation)非法值归一为 None。"""
    snap = validate_process_list(
        [_proc(100, "x.exe", parentPid="bad", executablePath="", commandLine=None, creationTimeMs=-5)]
    )
    e = snap.entries[0]
    assert e.parent_pid is None
    assert e.executable_path is None
    assert e.command_line is None
    assert e.creation_time_ms is None


# ── 浏览器状态 ──────────────────────────────────────────────────────────────


def test_browser_state_occupied_by_user():
    """在跑且有可见窗 = 可能被用户用,agent 须谨慎。"""
    st = validate_browser_state({"browserIsRunning": True, "browserHasVisibleWindow": True})
    assert st.occupied_by_user is True
    assert st.background_only is False
    assert "谨慎" in st.detail


def test_browser_state_background_only():
    """在跑但无可见窗 = 后台占用,可受控操作。"""
    st = validate_browser_state({"browserIsRunning": True, "browserHasVisibleWindow": False})
    assert st.occupied_by_user is False
    assert st.background_only is True


def test_browser_state_not_running():
    """未运行。"""
    st = validate_browser_state({"browserIsRunning": False, "browserHasVisibleWindow": False})
    assert st.is_running is False
    assert st.occupied_by_user is False


def test_browser_state_non_bool_raises():
    """字段须布尔。"""
    with pytest.raises(BrowserStateError):
        validate_browser_state({"browserIsRunning": 1, "browserHasVisibleWindow": False})
