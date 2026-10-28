# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""core/background_tasks.spawn 行为锁(2026-10-25,守门 247 的同批配套)。

钉住的不变量:
1. 提交即被模块级集合强引用 —— 外部引用全部丢弃 + gc.collect() 后任务仍须活到完成
   (旧形态裸 `asyncio.create_task(...)` 正是死在这一格:事件循环只握弱引用);
2. 完成后自动摘除,登记集合不无限积累(泄漏的反方向也要锁);
3. 失败任务同样被摘除且不卡集合(异常可被 await 侧观测);
4. 无 running loop ⇒ RuntimeError(hook_engine/mcp_client 等调用方的 try/except 降级面
   依赖这一语义,与 asyncio.create_task 保持一致)。
"""

from __future__ import annotations

import asyncio
import gc
import threading

from app.core.background_tasks import pending_count, spawn


async def test_survives_gc_without_external_reference() -> None:
    """核心锁:不留任何外部变量引用,任务也必须跑到完成(弱引用形态会被 GC 半路吞)。"""
    done_flag = {"v": False}

    async def slow_work() -> None:
        await asyncio.sleep(0.4)
        done_flag["v"] = True

    before = pending_count()
    spawn(slow_work(), name="gc-survival-probe")
    assert pending_count() == before + 1

    # 刻意压 GC:旧形态在这里就会被回收、永不完成
    gc.collect()
    await asyncio.sleep(0.6)
    assert done_flag["v"] is True, "任务在失去外部引用后被 GC 回收 —— 强引用登记失效"
    await asyncio.sleep(0.05)  # done 回调落地
    assert pending_count() == before, "完成后未从登记集合摘除(泄漏的反方向)"


async def test_error_task_is_dropped_not_stuck() -> None:
    class Boom(RuntimeError):
        pass

    async def fail() -> None:
        raise Boom

    before = pending_count()
    task = spawn(fail())
    assert pending_count() == before + 1
    try:
        await task
    except Boom:
        pass
    await asyncio.sleep(0)
    assert pending_count() == before


def test_requires_running_loop_raises_runtime_error() -> None:
    """无 running loop(纯同步线程)必须抛 RuntimeError —— 降级面语义锁。

    同步函数而非 async pytest:线程里天然没有 loop,直接量 spawn 的异常出口。
    """
    err: dict[str, object] = {}

    async def noop() -> None:
        return None

    def _no_loop() -> None:
        try:
            spawn(noop())
        except RuntimeError as exc:
            err["rt"] = exc

    t = threading.Thread(target=_no_loop)
    t.start()
    t.join()
    assert isinstance(err.get("rt"), RuntimeError), (
        "无 running loop 时必须抛 RuntimeError —— 调用方(hook_engine/mcp_client)的"
        " try/except RuntimeError 降级依赖这一语义"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
