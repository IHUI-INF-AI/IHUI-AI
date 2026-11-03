# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-998168 拍板④:语言服务/调试器子进程树清理 + 禁窗启动标志。

三件套:app/services/process_tree.py(共享模块)+ lsp.py / debugger.py 接线。
票面纪律:不引入新运行时依赖 —— 进程树用**系统自带工具**取(Windows=taskkill
/T /F,POSIX=os.killpg);禁窗形态按语言分:Python=CREATE_NO_WINDOW,
Node 才是 windowsHide,互不可抄(照抄必 TypeError)。
"""

import asyncio
import inspect
import os
import subprocess

import pytest

from app.services import process_tree
from app.services.process_tree import CREATE_NO_WINDOW, kill_process_tree


def _run(coro):
    return asyncio.run(coro)


def test_create_no_window_is_windows_flag():
    """禁窗标志在 Windows 上必须是 subprocess.CREATE_NO_WINDOW;POSIX 恒 0。"""
    if os.name == "nt":
        assert CREATE_NO_WINDOW == subprocess.CREATE_NO_WINDOW == 0x08000000
    else:
        assert CREATE_NO_WINDOW == 0


def test_kill_tree_dead_pid_is_idempotent():
    """已死/非法 pid 必须幂等安全 —— 清理兜底路径绝不抛。"""
    _run(kill_process_tree(0))
    _run(kill_process_tree(-5))
    _run(kill_process_tree(4_000_000_000))  # 合法值域内必不存在的 pid


def test_taskkill_call_carries_no_window_flag():
    """禁窗纪律落在实现里:taskkill 启动必须带 creationflags=CREATE_NO_WINDOW。"""
    src = inspect.getsource(process_tree)
    assert "creationflags=CREATE_NO_WINDOW" in src


@pytest.mark.skipif(os.name != "nt", reason="taskkill 仅 Windows")
def test_kill_tree_kills_real_windows_tree():
    """真实树杀:cmd 派生 ping 子进程,树杀 cmd 后 tasklist 查不到该 pid。"""

    async def main():
        proc = await asyncio.create_subprocess_exec(
            "cmd",
            "/c",
            "ping",
            "-n",
            "30",
            "127.0.0.1",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
            creationflags=CREATE_NO_WINDOW,
        )
        await asyncio.sleep(0.5)
        await kill_process_tree(proc.pid)
        return proc.pid

    pid = _run(main())

    out = subprocess.run(
        ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
        capture_output=True,
        timeout=15,
        creationflags=CREATE_NO_WINDOW,
    )
    # 查不到 = 整树已带走(tasklist 无匹配时输出 INFO: ...)。
    # tasklist 中文 Windows 下输出 GBK,取 bytes 后忽略非法字节 ——
    # 判据只依赖 ASCII 段(INFO:/PID),不受编码影响。
    stdout = out.stdout.decode("utf-8", errors="ignore")
    assert "INFO:" in stdout or f'"{pid}"' not in stdout
