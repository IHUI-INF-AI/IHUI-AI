# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令强杀后有界等待(kill_timeout_ms 对齐)测试。

覆盖:
1. 执行器/容器/契约三处 kill 等待常量相等(防两处漂移)
2. _cleanup_proc:SIGKILL 后 wait 有界,进程赖着不走时返回 survived=True
3. timeout 事件如实携带 killSurvived,不冒充"进程已终止"(源码级变异锁)
4. 超时路径整体有界:清理阶段不再出现无界 await proc.wait()
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core.exec_params import IO_DRAIN_TIMEOUT_MS
from app.services import command_streamer as cs
from app.services import container_runtime as cr


class _NeverExitProc:
    """模拟 SIGKILL 后仍不退出的进程:returncode 恒 None,wait() 永不自行返回。"""

    def __init__(self):
        self.returncode = None
        self.terminate_calls = 0
        self.kill_calls = 0

    def terminate(self):
        self.terminate_calls += 1

    def kill(self):
        self.kill_calls += 1

    async def wait(self):
        await asyncio.Event().wait()  # 永不返回,只能被外层 wait_for 掐断


class _DoneTask:
    """已经完成的 task 替身:_cleanup_proc 只调 done() 与 await(已 done 不 await)。"""

    def done(self):
        return True

    def __await__(self):
        async def _noop():
            return None
        return _noop().__await__()


class TestKillWaitContract:
    def test_three_constants_agree(self):
        """三处 kill 等待界必须同档 —— 任一处改动必须同步另两处。"""
        assert cs._KILL_WAIT_TIMEOUT * 1000 == IO_DRAIN_TIMEOUT_MS
        assert cr.KILL_WAIT_TIMEOUT_SEC == cs._KILL_WAIT_TIMEOUT

    @pytest.mark.asyncio
    async def test_cleanup_bounded_when_proc_survives_kill(self, monkeypatch):
        """SIGKILL 后进程仍活 ⇒ 有界返回 survived=True,不悬挂。"""
        # 把 SIGTERM 宽限压到 0,让路径立刻走到 SIGKILL 档(本测试只验 kill 后等待)。
        monkeypatch.setattr(cs, "_GRACE_PERIOD", 0.0)
        proc = _NeverExitProc()
        # 外层兜底:若实现退回无界 wait,本测试挂死即暴露病灶。
        survived = await asyncio.wait_for(
            cs._cleanup_proc(proc, _DoneTask(), _DoneTask(), timed_out=True),
            timeout=cs._KILL_WAIT_TIMEOUT + 2.0,
        )
        assert survived is True
        assert proc.terminate_calls == 1
        assert proc.kill_calls == 1


class TestNoSilentSuccess:
    def test_timeout_event_carries_kill_survived(self):
        """timeout 事件必须如实带 killSurvived 字段,不冒充"进程已终止"。"""
        src = Path(cs.__file__).read_text(encoding="utf-8")
        marker = '"killSurvived": kill_survived'
        assert marker in src, "timeout 事件缺少 killSurvived 字段"
        # 变异锁:抹掉该字段后判据必须不再命中(证明这把尺子有牙)
        assert marker not in src.replace(marker, "", 1)

    def test_no_unbounded_wait_after_kill(self):
        """清理路径不得残留裸 await proc.wait() —— 有界 wait_for 才算修复。"""
        src = Path(cs.__file__).read_text(encoding="utf-8")
        start = src.index("async def _cleanup_proc")
        end = src.index("async def stream_command", start)
        body = src[start:end]
        assert "await proc.wait()" not in body, "仍有裸 await proc.wait() 无界等待"
        assert "asyncio.wait_for(proc.wait()" in body

    def test_container_kill_wait_bounded(self):
        """container_runtime 超时强杀后也必须走有界等待。"""
        src = Path(cr.__file__).read_text(encoding="utf-8")
        assert "asyncio.wait_for(proc.wait(), timeout=KILL_WAIT_TIMEOUT_SEC)" in src
        assert "kill_survived" in src
