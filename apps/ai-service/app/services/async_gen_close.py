# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""借来的异步生成器的确定性关停出口(唯一实现)。

立因:本项目三处流式消费方(llm_gateway 原生适配器分支 / routers.llm 的 SSE 流 /
publish.ai_assistant._astream)把一个 async 生成器"借"过来 `async for`,而在
error→fallback 的 `return`、客户端断开的 `break`、以及流中途抛错这三条被弃路径上,
都没有向那个仍悬挂在半读态的生成器要回资源 —— 表现是 `finally` 里那句关连接的代码
要等 GC + `loop.shutdown_asyncgens` 才跑,provider 侧的 `async with client.stream(...)`
因此在半读状态上停留不确定的时间(anthropic_provider 那一型)。

判据口径(三处必须同形,不得自创第二种):

    gen = <借来的异步生成器>
    try:
        async for x in gen:
            ...
    finally:
        await aclose_async_gen(gen, label=...)

两条不可漂的语义:

1. **幂等**:对已耗尽 / 已关闭的 async generator,`aclose()` 是合法 no-op —— 所以
   正常耗尽路径重复调用不会有副作用,也不会"二次回滚"。
2. **绝不掩盖原异常**:关停自身的失败在这里被吞掉并留日志,而不是让 `finally` 抛出的
   新异常替换掉调用栈上正在传播的那个原始异常(Python 会把后者挂成 `__context__`,
   但账面看到的错误已经换了一个 —— 排障时被指错方向)。因此本出口永不抛错。

`except Exception` 是刻意的窄口径:`GeneratorExit` / `asyncio.CancelledError` 属
`BaseException`,在取消作用域内必须照常向上传播,不得被这里咽掉。
"""

from __future__ import annotations

from app.core.logging import get_logger

logger = get_logger(__name__)


async def aclose_async_gen(gen: object | None, *, label: str = "") -> bool:
    """关停一个借来的异步生成器;永不抛错,返回是否真的执行了关停。

    - `gen is None` 或未提供 `aclose`(不是异步生成器)⇒ 返回 False,不动作。
    - 关停自身抛错 ⇒ 记 warning 并返回 False,**不向上抛**(见模块 docstring 第 2 条)。
    """
    if gen is None:
        return False
    aclose = getattr(gen, "aclose", None)
    if not callable(aclose):
        # 不是异步生成器:调用方多半把同步可迭代对象递了进来,这是接线错误而不是
        # 运行时故障 —— 报名但不改判流程,否则一个类型笔误会打断整条流。
        logger.warning("[async_gen_close] 无可关停对象 label=%s type=%s", label, type(gen).__name__)
        return False
    try:
        await aclose()
    except Exception as exc:  # noqa: BLE001 - 关停失败绝不掩盖原异常
        logger.warning("[async_gen_close] aclose 失败 label=%s err=%s", label, exc)
        return False
    return True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
