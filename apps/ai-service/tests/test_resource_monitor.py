"""resource_monitor.py 单元测试(2026-07-23)。

覆盖:
- 降级模式(测试环境无 psutil):start 立即返回 / stop 返回 [] / terminated False
- is_psutil_available() / ResourceViolation dataclass
- 假 psutil 注入后有 psutil + 无限制不启动 task
- 内存超限:记录违规(kill_on_violation=False 不 kill / True kill 整个进程树)
- 进程树 RSS 聚合(parent + child 超 limit)
- CPU 时间超限 + 进程树 CPU 聚合
- 无违规持续循环直到 stop / AccessDenied 跳过本轮(continue)
- NoSuchProcess(Process 构造 / children)退出循环 / 通用异常退出循环
- stop 取消运行中 task / _terminate_tree 吞掉 kill 异常

隔离:monkeypatch 注入假 psutil 模块(NoSuchProcess / AccessDenied / Process 工厂)+ 假 Process。
不依赖真实系统指标,不连真实进程。不 monkeypatch asyncio.sleep(避免污染全局 asyncio)。
"""
from __future__ import annotations

import asyncio
import types

import pytest

from app.services.resource_monitor import (
    ResourceMonitor,
    ResourceViolation,
    is_psutil_available,
)


# =============================================================================
# 假 psutil 基础设施
# =============================================================================


class FakeNoSuchProcess(Exception):
    pass


class FakeAccessDenied(Exception):
    pass


class _FakeCpuTimes:
    def __init__(self, user, system):
        self.user = user
        self.system = system


class _FakeMemoryInfo:
    def __init__(self, rss):
        self.rss = rss


class FakeProcess:
    """可控假 Process。memory_info 首次抛异常后恢复(测 continue 分支)。"""

    def __init__(self, pid, *, rss_bytes=0, cpu_user=0.0, cpu_system=0.0,
                 children=None, memory_info_exc=None, cpu_times_exc=None,
                 children_exc=None, kill_exc=None):
        self.pid = pid
        self._rss = rss_bytes
        self._cpu_user = cpu_user
        self._cpu_system = cpu_system
        self._children = list(children) if children else []
        self._memory_info_exc = memory_info_exc
        self._cpu_times_exc = cpu_times_exc
        self._children_exc = children_exc
        self._kill_exc = kill_exc
        self.memory_info_calls = 0
        self.cpu_times_calls = 0
        self.children_calls = 0
        self.killed = False

    def children(self, recursive=True):
        self.children_calls += 1
        if self._children_exc:
            raise self._children_exc
        return list(self._children)

    def memory_info(self):
        self.memory_info_calls += 1
        if self._memory_info_exc and self.memory_info_calls == 1:
            raise self._memory_info_exc
        return _FakeMemoryInfo(self._rss)

    def cpu_times(self):
        self.cpu_times_calls += 1
        if self._cpu_times_exc:
            raise self._cpu_times_exc
        return _FakeCpuTimes(self._cpu_user, self._cpu_system)

    def kill(self):
        if self._kill_exc:
            raise self._kill_exc
        self.killed = True


def _install_fake_psutil(monkeypatch, process_factory):
    """注入假 psutil 模块 + 置 _PSUTIL_AVAILABLE=True。"""
    fake = types.SimpleNamespace(
        NoSuchProcess=FakeNoSuchProcess,
        AccessDenied=FakeAccessDenied,
        Process=process_factory,
    )
    monkeypatch.setattr("app.services.resource_monitor._PSUTIL_AVAILABLE", True)
    monkeypatch.setattr("app.services.resource_monitor.psutil", fake)
    return fake


def _factory_raising(exc):
    def factory(pid):
        raise exc
    return factory


# =============================================================================
# 降级模式(真实测试环境无 psutil)
# =============================================================================


def test_is_psutil_available_false_in_test_env():
    """测试环境未安装 psutil → is_psutil_available() False。"""
    assert is_psutil_available() is False


async def test_start_no_psutil_returns_immediately():
    """无 psutil 时 start() 立即返回,不创建 task。"""
    mon = ResourceMonitor(pid=1234, memory_mb=100)
    await mon.start()
    assert mon._task is None


async def test_stop_no_task_returns_empty():
    """无 task 时 stop() 返回空列表。"""
    mon = ResourceMonitor(pid=1234, memory_mb=100)
    v = await mon.stop()
    assert v == []


def test_terminated_default_false():
    """新实例 terminated 默认 False。"""
    mon = ResourceMonitor(pid=1234, memory_mb=100)
    assert mon.terminated is False


def test_resource_violation_dataclass_fields():
    """ResourceViolation 三字段。"""
    v = ResourceViolation(resource="memory", limit=100.0, actual=150.0)
    assert v.resource == "memory"
    assert v.limit == 100.0
    assert v.actual == 150.0


# =============================================================================
# 有 psutil + 无限制
# =============================================================================


async def test_start_with_psutil_but_no_limits_no_task(monkeypatch):
    """有 psutil 但未配置 memory_mb/cpu_seconds → start 不创建 task。"""
    _install_fake_psutil(monkeypatch, lambda pid: FakeProcess(pid))
    mon = ResourceMonitor(pid=1234)  # 无限制
    await mon.start()
    assert mon._task is None


# =============================================================================
# 内存超限
# =============================================================================


async def test_memory_violation_recorded_no_kill(monkeypatch):
    """kill_on_violation=False:记录 memory 违规 + 标记 terminated,不 kill 进程。"""
    proc = FakeProcess(pid=1234, rss_bytes=200 * 1024 * 1024)  # 200MB
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, kill_on_violation=False, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is True
    assert len(mon._violations) == 1
    v = mon._violations[0]
    assert v.resource == "memory"
    assert v.limit == 100
    assert abs(v.actual - 200.0) < 0.01
    assert proc.killed is False  # 未 kill
    await mon.stop()


async def test_memory_violation_kills_process_tree(monkeypatch):
    """kill_on_violation=True:超限后 kill 整个进程树(子进程也被 kill)。"""
    child = FakeProcess(pid=1235, rss_bytes=0)
    proc = FakeProcess(pid=1234, rss_bytes=200 * 1024 * 1024, children=[child])
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, kill_on_violation=True, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is True
    assert proc.killed is True
    assert child.killed is True
    assert len(mon._violations) == 1
    await mon.stop()


async def test_children_rss_aggregated(monkeypatch):
    """进程树 RSS 聚合:parent 50MB + child 80MB = 130MB > 100MB limit。"""
    child = FakeProcess(pid=1235, rss_bytes=80 * 1024 * 1024)
    proc = FakeProcess(pid=1234, rss_bytes=50 * 1024 * 1024, children=[child])
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, kill_on_violation=False, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is True
    v = mon._violations[0]
    assert v.resource == "memory"
    assert abs(v.actual - 130.0) < 0.01
    await mon.stop()


# =============================================================================
# CPU 时间超限
# =============================================================================


async def test_cpu_violation_recorded(monkeypatch):
    """CPU 时间超限:total 110s > 100s limit(内存未超)。"""
    proc = FakeProcess(pid=1234, rss_bytes=10 * 1024 * 1024, cpu_user=50.0, cpu_system=60.0)
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(
        pid=1234, memory_mb=100, cpu_seconds=100,
        kill_on_violation=False, poll_interval_s=0.001,
    )
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is True
    v = mon._violations[0]
    assert v.resource == "cpu_seconds"
    assert v.limit == 100
    assert abs(v.actual - 110.0) < 0.01
    await mon.stop()


async def test_children_cpu_aggregated(monkeypatch):
    """进程树 CPU 聚合:parent 10s + child 100s = 110s > 100s limit。"""
    child = FakeProcess(pid=1235, cpu_user=50.0, cpu_system=50.0)
    proc = FakeProcess(
        pid=1234, rss_bytes=10 * 1024 * 1024,
        cpu_user=10.0, cpu_system=0.0, children=[child],
    )
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(
        pid=1234, memory_mb=100, cpu_seconds=100,
        kill_on_violation=False, poll_interval_s=0.001,
    )
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is True
    assert mon._violations[0].resource == "cpu_seconds"
    assert abs(mon._violations[0].actual - 110.0) < 0.01
    await mon.stop()


# =============================================================================
# 无违规 / 异常分支
# =============================================================================


async def test_no_violation_continues_until_stopped(monkeypatch):
    """指标均未超限 → 循环持续,stop 后无违规、未 kill。"""
    proc = FakeProcess(pid=1234, rss_bytes=10 * 1024 * 1024, cpu_user=1.0, cpu_system=0.5)
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, cpu_seconds=100, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is False
    assert mon._violations == []
    v = await mon.stop()
    assert v == []
    assert proc.killed is False


async def test_access_denied_memory_info_skips_round(monkeypatch):
    """memory_info 首次抛 AccessDenied → continue 跳过本轮,后续成功无违规。"""
    proc = FakeProcess(pid=1234, rss_bytes=10 * 1024 * 1024, memory_info_exc=FakeAccessDenied())
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert proc.memory_info_calls >= 2  # 第一次跳过,第二次+成功
    assert mon.terminated is False
    assert mon._violations == []
    await mon.stop()


async def test_no_such_process_in_constructor_exits(monkeypatch):
    """psutil.Process(pid) 抛 NoSuchProcess → _loop 立即返回,无违规。"""
    _install_fake_psutil(monkeypatch, _factory_raising(FakeNoSuchProcess()))
    mon = ResourceMonitor(pid=9999, memory_mb=100, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is False
    assert mon._violations == []
    await mon.stop()


async def test_no_such_process_in_children_exits_loop(monkeypatch):
    """children() 抛 NoSuchProcess → 外层 except 捕获,循环退出。"""
    proc = FakeProcess(pid=1234, children_exc=FakeNoSuchProcess())
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is False
    assert mon._violations == []
    await mon.stop()


async def test_unexpected_exception_exits_loop(monkeypatch):
    """children() 抛通用异常 → except Exception 捕获,循环退出。"""
    proc = FakeProcess(pid=1234, children_exc=RuntimeError("boom"))
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is False
    assert mon._violations == []
    await mon.stop()


async def test_stop_cancels_running_task(monkeypatch):
    """stop() 取消运行中 task(正在 sleep)。"""
    proc = FakeProcess(pid=1234, rss_bytes=10 * 1024 * 1024, cpu_user=1.0, cpu_system=0.5)
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, cpu_seconds=100, poll_interval_s=1.0)
    await mon.start()
    assert mon._task is not None
    await asyncio.sleep(0.05)  # 让循环进入 sleep(1.0)
    assert not mon._task.done()
    v = await mon.stop()
    assert mon._task.done()
    assert v == []


async def test_terminate_tree_swallows_kill_exceptions(monkeypatch):
    """_terminate_tree:child/proc kill 抛异常被吞,仍标记 terminated。"""
    bad_child = FakeProcess(pid=1235, kill_exc=FakeAccessDenied())
    proc = FakeProcess(
        pid=1234, rss_bytes=200 * 1024 * 1024,
        children=[bad_child], kill_exc=FakeNoSuchProcess(),
    )
    _install_fake_psutil(monkeypatch, lambda pid: proc)
    mon = ResourceMonitor(pid=1234, memory_mb=100, kill_on_violation=True, poll_interval_s=0.001)
    await mon.start()
    await asyncio.sleep(0.02)
    assert mon.terminated is True
    assert len(mon._violations) == 1
    await mon.stop()
