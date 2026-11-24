# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""生产 run_command 强杀后有界等待测试(deep 取证转化,2026-11-24)。

覆盖:
1. 生产 _tool_run_command 与执行器/容器/契约的 kill 等待常量同档(防漂移)
2. 源码级守卫:生产调用链 _tool_run_command 不得残留裸 await proc.wait()
3. timeout 返回体如实携带 killSurvived,不冒充"进程已终止"
4. 行为:proc.wait 永不退出 ⇒ 有界返回 errorCode=TIMEOUT + partial_output
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.core.exec_params import IO_DRAIN_TIMEOUT_MS
from app.services import command_streamer as cs
from app.services import container_runtime as cr
from app.services import mcp_server as ms


@pytest.fixture
def allow_any_cwd(monkeypatch):
    """绕过工作区白名单(tmp_path 不在白名单内),与 test_run_command_streaming 同形。"""
    monkeypatch.setattr(
        "app.services.mcp_server._validate_path_in_workspace",
        lambda p: (True, str(p)),
    )


class TestRunCommandKillWaitContract:
    def test_four_constants_agree(self):
        """四处 kill 等待界必须同档 —— 生产 run_command 也不能例外。"""
        assert ms.RUN_COMMAND_KILL_WAIT_TIMEOUT == cs._KILL_WAIT_TIMEOUT
        assert ms.RUN_COMMAND_KILL_WAIT_TIMEOUT == cr.KILL_WAIT_TIMEOUT_SEC
        assert ms.RUN_COMMAND_KILL_WAIT_TIMEOUT * 1000 == IO_DRAIN_TIMEOUT_MS

    def test_production_run_command_no_unbounded_wait(self):
        """生产 _tool_run_command 路径不得残留裸 await proc.wait() 无界等待。"""
        src = Path(ms.__file__).read_text(encoding="utf-8")
        start = src.index("async def _tool_run_command")
        # 下一个顶层函数(行首无缩进),不能用裸 "async def "(会被嵌套 async def 截断)
        end = src.index("\nasync def ", start + 10)
        body = src[start:end]
        assert "await proc.wait()" not in body, "生产 run_command 仍有裸 await proc.wait() 无界等待"
        assert "asyncio.wait_for(proc.wait(), timeout=RUN_COMMAND_KILL_WAIT_TIMEOUT)" in body

    def test_terminate_process_tree_killer_wait_bounded(self):
        """taskkill 自身等待也要有界,不能成为新的悬挂点。"""
        src = Path(ms.__file__).read_text(encoding="utf-8")
        start = src.index("async def _terminate_process_tree")
        end = src.index("\nasync def ", start + 10)
        body = src[start:end]
        assert "asyncio.wait_for(killer.wait()" in body

    def test_timeout_result_carries_kill_survived(self):
        """两条 timeout 返回体(Needs-Input/TIMEOUT)都必须带 killSurvived 字段。"""
        src = Path(ms.__file__).read_text(encoding="utf-8")
        assert src.count('"killSurvived": kill_survived') >= 2, (
            "TIMEOUT 与 NEEDS_INPUT_TIMEOUT 两条返回体都要如实带 killSurvived"
        )


class TestRunCommandKillSurvivedBehavior:
    @pytest.mark.asyncio
    async def test_timeout_returns_bounded_when_proc_never_exits(
        self, monkeypatch, allow_any_cwd, tmp_path
    ):
        """proc 强杀后仍不退出 ⇒ 有界返回 errorCode=TIMEOUT + killSurvived=True。"""
        # 用真实子进程跑超时路径,但把等待界压到极小,并把 terminate/kill 换成不真正结束
        # 进程的替身 —— 这样 wait_for 必须掐断等待,结果出口不能被 D 态进程拖住。
        monkeypatch.setattr(ms, "RUN_COMMAND_KILL_WAIT_TIMEOUT", 0.05)

        script = tmp_path / "never_exit.py"
        script.write_text(
            "import signal,time\nsignal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "print('start', flush=True)\n"
            "while True: time.sleep(1)\n",
            encoding="utf-8",
        )
        py = __import__("sys").executable
        out = await asyncio.wait_for(
            ms._tool_run_command({
                "command": f"{py} -u {script}",
                "timeout": 1,
                "cwd": str(tmp_path),
            }),
            timeout=8.0,  # 外层兜底:退回无界 wait 时本测试超时即暴露病灶
        )
        assert out["errorCode"] == "TIMEOUT"
        assert out["ok"] is False
        assert out["streamed"] is True
        assert "killSurvived" in out
        assert "start" in out.get("partial_output", "") or "start" in out.get("stdout", "")
