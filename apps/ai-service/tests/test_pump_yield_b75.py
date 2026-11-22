# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b75 批吸收测试:常驻轮询泵让出主事件循环判据(b75-2#3,观察票验证动作)。

上游判据(browserScreenshotActivityController.ts:233-237):立即完成的 await
不等于让出 —— 泵若"直接续泵",Promise/协程 continuation 无限占用微任务队列,
超时/watchdog/IPC 全部饿死。本仓审计结论:dag_scheduler._watchdog(dag_scheduler.py:1045)
与 capability_gate.await_with_progress_heartbeat._pump(capability_gate.py:999)
每轮均经真实定时器 asyncio.sleep(间隔) 挂起让出,无忙循环实例。

本测试把上游验收动作("对立即返回的探测构造 1000 连续循环,事件循环内
1s 定时器仍按时触发")钉成可执行回归:_pump 在 report 立即返回、interval_s=0
(sleep(0) 等价让出点)下连续循环 ≥1000 轮,同一事件循环内的 1s 定时器必须
按时触发(漂移 ≤0.1s)。若未来有人把泵改成无让出点的直续循环,本用例先红。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.capability_gate import await_with_progress_heartbeat


async def test_heartbeat_pump_immediate_report_keeps_event_loop_responsive() -> None:
    """report 立即返回 + sleep(0) 让出点 ×1000+ 轮,1s 定时器按时触发。"""
    loop = asyncio.get_running_loop()
    t0 = loop.time()
    fired_drift = 999.0
    rounds = 0

    def on_timer() -> None:
        nonlocal fired_drift
        fired_drift = loop.time() - t0 - 1.0

    async def report(tick: float, message: str) -> None:
        nonlocal rounds
        rounds += 1

    stop = asyncio.Event()

    async def inner() -> None:
        await stop.wait()

    timer = loop.call_later(1.0, on_timer)
    pump_task = asyncio.create_task(
        await_with_progress_heartbeat(inner(), report, interval_s=0.0, label="b75-2#3-audit")
    )
    await asyncio.sleep(1.05)
    stop.set()
    await pump_task
    timer.cancel()
    # 泵确实循环了 ≥1000 轮(上游验收构造),且事件循环未被饿死
    assert rounds >= 1000
    # 1s 定时器按时触发:泵每轮经 asyncio.sleep(0) 让出,定时器漂移 ≤0.1s
    assert fired_drift == pytest.approx(0.0, abs=0.1)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
