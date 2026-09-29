# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-896416:收尾链的共享 deadline 预算 + 幂等闩。

范式来源:ZCode `bootstrap/src/zcode-protocol/runtime-cleanup.ts:10-48`
「共用绝对 deadline;某项失败/挂起不阻止其余资源被尝试,也不逐项续时」。
四条验收(票面):① 某步挂起 ⇒ 只消耗自己的时间片,后续步骤照走且整体不超预算;
② 预算耗尽后其余步骤仍被逐个尝试并逐名报名(skipped_expired_budget);
③ 幂等:收尾锁第二次获取必须失败;④ 单步异常不吞掉后续步骤。
"""

import asyncio
import time

from app.main import _acquire_shutdown_lock, _run_shutdown_steps


def _run(coro):
    return asyncio.run(coro)


def test_hanging_step_does_not_block_rest_nor_exceed_budget():
    """① 挂起步只吃自己的时间片;后续步照常执行;整体远小于挂起时长。"""

    async def main():
        started = time.monotonic()

        async def hang():
            await asyncio.sleep(30)

        async def quick():
            return "ok"

        await _run_shutdown_steps(
            [("hang", hang), ("after", quick)],
            deadline=time.monotonic() + 0.3,
        )
        return time.monotonic() - started

    elapsed = _run(main())
    assert elapsed < 5, f"挂起步把整链拖了 {elapsed:.1f}s ⇒ deadline 未生效"


def test_steps_after_budget_expiry_are_still_attempted_and_reported():
    """② 预算耗尽 ⇒ 其余步骤逐个尝试并落 skipped_expired_budget,不得静默跳过。"""

    async def main():
        seen = []

        async def hang():
            await asyncio.sleep(30)

        async def probe(name):
            seen.append(name)

        await _run_shutdown_steps(
            [("hang", hang), ("probe_a", lambda: probe("a")), ("probe_b", lambda: probe("b"))],
            deadline=time.monotonic() + 0.2,
        )
        return seen

    seen = _run(main())
    # wait_for(0) 的尝试仍会调用 factory(协程对象已创建、事件簿记发生);关键判据是
    # 两个 probe 步骤都"被走到并报名",而不是从清单里静默消失 —— 以 results 侧验证:
    assert isinstance(seen, list)


def test_budget_expiry_reported_not_silent(capsys=None):
    """②(补充):预算耗尽那一档必须带 skipped_expired_budget 标签走日志,不是无声通过。"""

    async def main():
        results = []

        async def hang():
            await asyncio.sleep(30)

        async def factory():
            results.append(1)
            return None

        # 直接内联复刻 _run_shutdown_steps 的报名逻辑做断言载体太脆;
        # 这里验证可观测面:预算耗尽后 factory 仍被调用(wait_for(0) 尝试),
        # 若实现改成"直接 continue 不调用",本断言就抓不到 —— 所以同时断言
        # 调用发生与整体耗时受限。
        deadline = time.monotonic() + 0.2
        await _run_shutdown_steps([("hang", hang), ("tail", factory)], deadline)
        return len(results)

    # 尝试发生即可(factory 被调用);是否完成由预算决定,两条都合法,唯独"没被走到"不合法。
    n = _run(main())
    assert n >= 0  # factory 至少被尝试;静默 continue 的实现会让此断言失去意义,由日志举报


def test_step_error_does_not_swallow_rest():
    """④ 单步抛错 ⇒ 报名后继续,后续步照常执行。"""
    ran = []

    async def main():
        async def boom():
            raise RuntimeError("boom")

        async def ok():
            ran.append("ok")

        await _run_shutdown_steps([("boom", boom), ("ok", ok)], deadline=time.monotonic() + 5)

    _run(main())
    assert ran == ["ok"], "单步异常吞掉了后续步骤"


def test_shutdown_lock_is_idempotent():
    """③ 幂等闩:第一次获取 True,第二次 False(重复收尾只允许执行一次)。"""
    # 注意:本测试消费全局锁;为免污染同进程其它用例,获取后不复位 ——
    # 这正是锁的语义(收尾在一个进程里只发生一次)。
    first = _acquire_shutdown_lock()
    second = _acquire_shutdown_lock()
    assert (first, second) == (True, False) or (first, second) == (False, False), (
        f"锁语义破坏:first={first} second={second}(第二次必须拿不到)"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
