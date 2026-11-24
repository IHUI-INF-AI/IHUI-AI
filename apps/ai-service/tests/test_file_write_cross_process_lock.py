# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨进程写锁:同一路径读-改-写在多进程间也必须串行。

钉住四件事:
① 同进程第二个句柄也拿不到同一路径的 OS 锁(说明锁不是协程级装饰);
② 锁被别的进程持有时,write_file 显式失败且原文件一字节不变;
③ 正常写完锁必须释放,连续两次写不会自锁;
④ 持锁进程被杀死后,下一次写立即恢复(OS 锁随进程死亡释放,无 stale 死锁)。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from app.services import file_write_gate, mcp_server


@pytest.fixture(autouse=True)
def _isolated_workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    mcp_server._reset_file_base_store()
    file_write_gate.reset_path_write_locks()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    monkeypatch.setattr(file_write_gate, "_CROSS_PROCESS_LOCK_TIMEOUT", 0.2)
    yield tmp_path
    mcp_server._reset_file_base_store()
    file_write_gate.reset_path_write_locks()


def test_same_process_second_handle_conflicts(tmp_path: Path) -> None:
    key = file_write_gate._lock_key(str(tmp_path / "a.txt"))
    fd = file_write_gate._acquire_os_lock_blocking(key, 1.0)
    try:
        with pytest.raises(TimeoutError):
            file_write_gate._acquire_os_lock_blocking(key, 0.05)
    finally:
        file_write_gate._release_os_lock(fd)


async def test_write_file_fails_closed_when_lock_held(tmp_path: Path) -> None:
    p = tmp_path / "guarded.txt"
    p.write_text("old\n", encoding="utf-8")
    key = file_write_gate._lock_key(str(p))
    fd = file_write_gate._acquire_os_lock_blocking(key, 1.0)
    try:
        result = await mcp_server._tool_write_file({"path": str(p), "content": "new\n"})
        assert result["ok"] is False
        assert "路径写锁超时" in result["error"]
        assert p.read_text(encoding="utf-8") == "old\n"
    finally:
        file_write_gate._release_os_lock(fd)


async def test_lock_is_released_after_write(tmp_path: Path) -> None:
    p = tmp_path / "twice.txt"
    first = await mcp_server._tool_write_file({"path": str(p), "content": "one\n"})
    second = await mcp_server._tool_write_file({"path": str(p), "content": "two\n"})
    assert first["ok"] is True
    assert second["ok"] is True
    assert p.read_text(encoding="utf-8") == "two\n"


def test_cross_process_holder_blocks_then_release_on_death(tmp_path: Path) -> None:
    p = tmp_path / "cross.txt"
    p.write_text("old\n", encoding="utf-8")
    key = file_write_gate._lock_key(str(p))
    service_dir = Path(__file__).resolve().parents[1]
    script = (
        "import sys, time\n"
        "from app.services import file_write_gate as g\n"
        "fd = g._acquire_os_lock_blocking(sys.argv[1], 5.0)\n"
        "print('LOCKED', flush=True)\n"
        "time.sleep(30)\n"
    )
    proc = subprocess.Popen(
        [sys.executable, "-c", script, key],
        cwd=str(service_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        assert proc.stdout is not None
        line = proc.stdout.readline()
        assert "LOCKED" in line, f"子进程未拿到锁: {line!r} {proc.stderr.read() if proc.stderr else ''}"

        result = asyncio_run(
            mcp_server._tool_write_file({"path": str(p), "content": "new\n"})
        )
        assert result["ok"] is False
        assert "路径写锁超时" in result["error"]
        assert p.read_text(encoding="utf-8") == "old\n"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:  # pragma: no cover - 清理兜底
            proc.kill()
            proc.wait(timeout=10)

    # 进程死亡 ⇒ OS 释放锁 ⇒ 不再需要 stale 回收,下一次写立即成功
    recovered = asyncio_run(
        mcp_server._tool_write_file({"path": str(p), "content": "after\n"})
    )
    assert recovered["ok"] is True
    assert p.read_text(encoding="utf-8") == "after\n"


def asyncio_run(coro):  # noqa: ANN001, ANN201 - 测试内同步上下文里跑一次协程
    import asyncio

    return asyncio.run(coro)
