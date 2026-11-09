# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""全仓同步阻塞调用治理的回归钉子(BUG-0006 同报告后续)。

锁两件事:
1. 子进程 / 文件写这类同步调用必须真正离开事件循环执行(而不是只把
   `def` 改成 `async def` 的假修复);
2. 迁移后外部行为与超时语义保持不变(``timeout=30`` / ``check=False`` /
   ``cwd`` 原样透传,草稿内容与落盘结果一致)。
"""

from __future__ import annotations

import asyncio
import importlib
import pathlib
import subprocess
import time

from app.services import mcp_server

init_agents_md_mod = importlib.import_module("app.tools.init_agents_md")


async def _ticker(ticks: list[int], duration: float = 0.2) -> None:
    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        ticks.append(1)
        await asyncio.sleep(0.01)


def test_git_operations_offloads_subprocess_and_keeps_timeout(tmp_path, monkeypatch):
    """`_tool_git_operations` 的 subprocess.run 必须在线程池执行。"""
    monkeypatch.setattr(
        mcp_server, "_validate_path_in_workspace", lambda _p: (True, str(tmp_path))
    )
    captured: dict = {}

    def slow_run(*args, **kwargs):
        captured.update(kwargs)
        time.sleep(0.12)  # 模拟 git 卡顿;若在事件循环里执行,ticker 会被饿死
        return subprocess.CompletedProcess(
            args=list(args), returncode=0, stdout="ok\n", stderr=""
        )

    monkeypatch.setattr(subprocess, "run", slow_run)
    ticks: list[int] = []

    async def scenario():
        ticker = asyncio.create_task(_ticker(ticks))
        result = await mcp_server._tool_git_operations(
            {"action": "status", "repo": str(tmp_path)}
        )
        await ticker
        return result

    result = asyncio.run(scenario())

    assert result["ok"] is True
    assert result["output"].strip() == "ok"
    # 超时与执行语义原样保留
    assert captured["timeout"] == 30
    assert captured["check"] is False
    assert captured["cwd"] == str(tmp_path)
    assert captured["text"] is True
    # 同步阻塞期间事件循环仍能推进(修复前 ticks 恒为 1 左右)
    assert len(ticks) >= 5


def test_init_agents_md_offloads_draft_write(tmp_path, monkeypatch):
    """`init_agents_md` 的草稿写盘必须在线程池执行。"""
    real_write = pathlib.Path.write_text
    calls: list[str] = []

    def slow_write(self, data, *args, **kwargs):
        calls.append(str(self))
        time.sleep(0.12)  # 模拟大文件写盘
        return real_write(self, data, *args, **kwargs)

    (tmp_path / "README.md").write_text("# Demo\n", encoding="utf-8")
    monkeypatch.setattr(pathlib.Path, "write_text", slow_write)
    ticks: list[int] = []

    async def scenario():
        ticker = asyncio.create_task(_ticker(ticks))
        result = await init_agents_md_mod.init_agents_md(
            {"workspace_root": str(tmp_path), "output_path": "AGENTS.md"}
        )
        await ticker
        return result

    result = asyncio.run(scenario())

    assert result["ok"] is True
    assert (tmp_path / "AGENTS.md").is_file()
    assert any(str(tmp_path / "AGENTS.md") == c for c in calls)
    # 写盘阻塞期间事件循环仍能推进
    assert len(ticks) >= 5


def test_worktree_ensure_gitignore_offloads_file_io(tmp_path, monkeypatch):
    """`ensure_gitignore` 的读写落盘必须在线程池执行,且追加语义不变。"""
    from app.services import worktree

    real_ensure = worktree._ensure_gitignore_file
    ticks: list[int] = []

    def slow_ensure(path: str) -> None:
        time.sleep(0.12)  # 模拟被占用的 .gitignore 读写
        real_ensure(path)

    monkeypatch.setattr(worktree, "_ensure_gitignore_file", slow_ensure)

    async def scenario():
        ticker = asyncio.create_task(_ticker(ticks))
        await worktree.ensure_gitignore(str(tmp_path))
        await ticker

    asyncio.run(scenario())

    content = (tmp_path / ".gitignore").read_text(encoding="utf-8")
    assert content == ".worktrees/\n"
    assert len(ticks) >= 5


def test_checkin_batch_marker_start_offloads_write(tmp_path):
    """`CheckinBatchMarker.start()` 的 marker 写盘必须在线程池执行。"""
    from app.services.checkin_batch_marker import CheckinBatchMarker

    marker = CheckinBatchMarker("回归批次", path=tmp_path / "marker.json")
    real_write = marker.write
    ticks: list[int] = []

    def slow_write() -> bool:
        time.sleep(0.12)  # 模拟磁盘抖动
        return real_write()

    marker.write = slow_write  # type: ignore[method-assign]

    async def scenario():
        ticker = asyncio.create_task(_ticker(ticks))
        ok = await marker.start()
        await ticker
        await marker.stop()
        return ok

    ok = asyncio.run(scenario())

    assert ok is True
    assert len(ticks) >= 5

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
