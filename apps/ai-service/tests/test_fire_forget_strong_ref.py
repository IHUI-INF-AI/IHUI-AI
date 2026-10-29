# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""fire-and-forget 任务强引用回归锁(2026-10-25,exec_params CancellationToken / memory_graph)。

缺陷原型:`asyncio.create_task(...)` 返回值丢弃 ⇒ 事件循环对任务只握弱引用,任务可能在
半路被 GC,症状是"联动/抽取偶尔什么都没发生且零报错"(CPython asyncio 文档明写的陷阱)。

两档锁:
- 结构档(对旧实现 100% 判别):token 槽位必须真的持有 task,memory_graph 必须经唯一出口
  background_tasks.spawn() 提交 —— 旧形态(裸 create_task)连槽位都没有、pending 也不涨;
- 行为档:GC 之后取消仍须传播、抽取仍须跑到完成。

变异自证(HEAD=旧形态面):本文件 7 例中至少结构档 3 例红(旧代码无 _propagate_task /
_watches_task,且 memory_graph 不经 spawn ⇒ pending_count 不增),这是判定"锁有牙"的
依据,不是口头声称。
"""

import asyncio
import gc

from app.core.exec_params import CancellationToken, cancel_when_either


async def test_child_token_watcher_is_strongly_held():
    """结构档:_link 必须把 propagate 任务挂到子 token 上(旧实现丢弃返回值 ⇒ 无此属性)。"""
    parent = CancellationToken()
    child = parent.child_token()
    await asyncio.sleep(0)  # 让 _propagate 进到 await wait() 挂起点
    assert getattr(child, "_propagate_task", None) is not None
    assert not child._propagate_task.done()


async def test_child_propagation_survives_gc():
    """行为档:引用回收压力后,父取消仍须联动子 token;反向不传播。"""
    parent = CancellationToken()
    child = parent.child_token()
    await asyncio.sleep(0)
    gc.collect()
    parent.cancel()
    await asyncio.sleep(0)
    assert child.is_cancelled


async def test_reverse_propagation_does_not_leak():
    """反向不传播纪律:子 token 取消不得波及父(全新 parent,与 GC 场景互不污染)。"""
    parent = CancellationToken()
    child2 = parent.child_token()
    await asyncio.sleep(0)
    child2.cancel()
    assert not parent.is_cancelled
    parent2 = CancellationToken()
    c = parent2.child_token()
    await asyncio.sleep(0)
    c.cancel()
    assert not parent2.is_cancelled


async def test_cancel_when_either_watcher_is_held_and_works():
    """结构+行为:第二个源的 watcher 有强槽,且取消任一源都组合生效。"""
    a = CancellationToken()
    b = CancellationToken()
    combined = cancel_when_either(a, b)
    await asyncio.sleep(0)
    assert getattr(combined, "_watches_task", None) is not None
    b.cancel()
    await asyncio.sleep(0)
    assert combined.is_cancelled


async def test_cancel_when_either_first_source_still_propagates():
    a = CancellationToken()
    b = CancellationToken()
    combined = cancel_when_either(a, b)
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    a.cancel()
    await asyncio.sleep(0)
    assert combined.is_cancelled


async def test_memory_graph_fire_and_forget_keeps_reference(monkeypatch):
    """结构档:memory_graph 的 fire-and-forget 抽取必须被唯一出口 spawn() 持到完成。"""
    from app.core import background_tasks
    from app.services import memory_graph as mg

    started = asyncio.Event()
    release = asyncio.Event()

    async def _slow_extract(_owner: str) -> None:
        started.set()
        await release.wait()

    monkeypatch.setattr(mg, "extract_and_store_edges", _slow_extract)
    before = background_tasks.pending_count()
    mg.fire_and_forget_extract("owner-1")
    assert started and not started.is_set()  # 尚未被调度,但引用已在
    assert background_tasks.pending_count() == before + 1
    await started.wait()
    release.set()
    for _ in range(50):  # done 回调经 call_soon 调度,给足轮次让它落位
        if background_tasks.pending_count() == before:
            break
        await asyncio.sleep(0)
    assert background_tasks.pending_count() == before  # 摘除,不会永久积累


async def test_memory_graph_without_loop_is_noop():
    """无 running loop 时保持原降级(不崩、不排队、只 warning)。"""
    from app.core import background_tasks
    from app.services import memory_graph as mg

    before = background_tasks.pending_count()
    # 同步栈上没有 running loop? asyncio_mode=auto 的测试线程在 loop 内 ——
    # 这里用线程切出去量"纯同步面"降级。
    import threading

    result: dict[str, object] = {}

    def _sync_ctx() -> None:
        try:
            mg.fire_and_forget_extract("owner-no-loop")
            result["ok"] = True
        except RuntimeError as exc:  # 不得抛
            result["err"] = str(exc)

    t = threading.Thread(target=_sync_ctx)
    t.start()
    t.join()
    assert result.get("ok") is True
    assert background_tasks.pending_count() == before
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
