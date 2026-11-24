# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨进程文件锁 + 崩溃接管 process_file_lock 的边界钉住(对齐 withFileLock/takeOverExitedLock)。

超越既有 write_bytes_atomic(只保单次写原子)的轴,每个都有测试钉住:
  ① 跨进程互斥 —— 并发持锁互斥,退出释放;
  ② 崩溃接管 —— 持有者已死(pid 不存在)⇒ 下一进程接管,不永久占死;
  ③ 超时 —— 持有者存活时拿不到锁 ⇒ TimeoutError;
  ④ token 校验 —— 释锁只删自己的锁,不误删后来者的锁。
"""

from __future__ import annotations

import json
import os
import socket
import threading

import pytest

from app.utils import atomic_io


def test_process_alive_current_pid() -> None:
    assert atomic_io._process_alive(os.getpid()) is True


def test_process_alive_bogus_pid() -> None:
    # 选用一个几乎不可能存在的 pid(负数/0 直接 False)
    assert atomic_io._process_alive(-1) is False
    assert atomic_io._process_alive(0) is False


def test_lock_mutual_exclusion(tmp_path) -> None:
    """① 并发持锁互斥:持锁期间第二个获取者阻塞,释放后可拿到。"""
    target = tmp_path / "state.json"
    order: list[str] = []

    with atomic_io.process_file_lock(target):
        lock_file = target.with_name(target.name + ".lock")
        assert lock_file.is_file()
        order.append("held")
    # 退出后锁释放
    assert not target.with_name(target.name + ".lock").exists()
    # 可再次获取(可重入到下一次临界区)
    with atomic_io.process_file_lock(target):
        order.append("reheld")
    assert order == ["held", "reheld"]


def test_takeover_dead_holder(tmp_path) -> None:
    """② 崩溃接管:锁记录里 pid 已死 ⇒ 直接接管,不超时。"""
    target = tmp_path / "state.json"
    lock_file = target.with_name(target.name + ".lock")
    # 伪造一个"持有者已死"的锁记录
    lock_file.write_text(
        json.dumps(
            {"pid": 999999999, "hostname": socket.gethostname(), "token": "dead"}
        ),
        encoding="utf-8",
    )
    with atomic_io.process_file_lock(target, max_wait_seconds=1.0):
        record = json.loads(lock_file.read_text(encoding="utf-8"))
        assert record["pid"] == os.getpid()
        assert record["token"] != "dead"  # 已改写为接管者自己的 token


def test_timeout_when_holder_alive(tmp_path) -> None:
    """③ 持有者存活 ⇒ 等待超时抛 TimeoutError,不接管。"""
    target = tmp_path / "state.json"
    with atomic_io.process_file_lock(target):
        with pytest.raises(TimeoutError):
            with atomic_io.process_file_lock(target, max_wait_seconds=0.1):
                pass  # 不应进入


def test_release_only_own_token(tmp_path) -> None:
    """④ token 校验:外部篡改锁记录后,释锁不误删不属于自己那把锁。"""
    target = tmp_path / "state.json"
    lock_file = target.with_name(target.name + ".lock")
    with atomic_io.process_file_lock(target):
        # 模拟:临界区内锁记录被后来者覆盖成别的 token
        lock_file.write_text(
            json.dumps({"pid": os.getpid(), "hostname": socket.gethostname(), "token": "someone-else"}),
            encoding="utf-8",
        )
    # 释锁时发现 token 不匹配 ⇒ 不删(后来者的锁保留)
    assert lock_file.is_file()


def test_concurrent_processes_mutual_exclusion(tmp_path) -> None:
    """多线程(模拟多进程)临界区互斥:计数器最终等于并发数,无丢失更新。"""
    target = tmp_path / "counter"
    target.write_text("0", encoding="utf-8")
    n_threads, n_increments = 4, 20
    errors: list[str] = []

    def worker() -> None:
        for _ in range(n_increments):
            try:
                with atomic_io.process_file_lock(target, max_wait_seconds=5.0):
                    current = int(target.read_text(encoding="utf-8"))
                    # 读-改-写在锁内完成,模拟独占更新
                    target.write_text(str(current + 1), encoding="utf-8")
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))

    threads = [threading.Thread(target=worker) for _ in range(n_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []
    assert int(target.read_text(encoding="utf-8")) == n_threads * n_increments
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
