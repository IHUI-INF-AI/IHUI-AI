# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""过期资源清扫守护(2026-10-15 立,goal 第 53 轮)。

成因:``app.services.debugger`` 与 ``app.services.agent_checkpoint`` 两处各自实现了
``cleanup_expired()``,但全仓**零调用者**(`git grep -n cleanup_expired HEAD -- apps/ai-service`
现读只有定义与一行注释,而注释本身写的是"过期留给 cleanup_expired 清理"—— 把回收责任交给了
一个没人跑的函数)。于是调试会话与检查点只增不减:每 worker 进程的内存字典与 PG 兜底档都无上限增长,
而 debug 面板轮询持续 ``session.touch()``,让 idle 判据永远量不到过期。这是本仓记过多次的
"造好没装车"型(§0.9:机制在而无人调 = 没有)。

装配:随 lifespan 挂载(见 ``app/main.py``),与 cookie 保活守护同一档,但**默认开**——
回收动作本身不产生业务副作用,关掉它只会把泄漏留给下一次;提供
``EXPIRY_JANITOR_ENABLED=0`` 显式关档,以及 ``EXPIRY_JANITOR_INTERVAL_SECONDS`` 调间隔。

纪律:过期判据**不在本模块重造**,一律复用各 manager 自己的 ``cleanup_expired()``
(§0.6 单一真相源)。本模块只做"按时敲它们一下"和"一家失败不拖死另一家"。
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Iterable, Protocol

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 300.0
MIN_INTERVAL_SECONDS = 30.0

_FALSY = {"0", "false", "off", "no"}


class ExpirySweepable(Protocol):
    """带自带过期回收出口的 manager 形态。"""

    async def cleanup_expired(self) -> int: ...


def _enabled_from_env() -> bool:
    return os.getenv("EXPIRY_JANITOR_ENABLED", "1").strip().lower() not in _FALSY


def interval_seconds_from_env() -> float:
    """数值档必须校验并当场说明后回落。

    ``int(os.getenv(k, 默认))`` 拿到垃圾值会直接抛,或在别的语言里得到 NaN 后
    ``n > NaN`` 恒假 ⇒ 守护静默不跑。这里读不出来 ⇒ 打一行 warning 再回落默认档。
    """
    raw = os.getenv("EXPIRY_JANITOR_INTERVAL_SECONDS")
    if raw is None or not raw.strip():
        return DEFAULT_INTERVAL_SECONDS
    try:
        value = float(raw)
    except ValueError:
        logger.warning(
            "[expiry_janitor] EXPIRY_JANITOR_INTERVAL_SECONDS=%r 读不出数 ⇒ 回落默认 %ss",
            raw,
            DEFAULT_INTERVAL_SECONDS,
        )
        return DEFAULT_INTERVAL_SECONDS
    if value != value or value <= 0:  # NaN / 非正值
        logger.warning("[expiry_janitor] 间隔=%r 不是正数 ⇒ 回落默认 %ss", value, DEFAULT_INTERVAL_SECONDS)
        return DEFAULT_INTERVAL_SECONDS
    if value < MIN_INTERVAL_SECONDS:
        logger.info("[expiry_janitor] 间隔 %.1fs 抬到下限 %.1fs", value, MIN_INTERVAL_SECONDS)
        return MIN_INTERVAL_SECONDS
    return value


def default_sweepables() -> list[ExpirySweepable]:
    """惰性取两个在册 manager(不在模块求值时构造,避免导入即开连接)。"""
    from app.services.agent_checkpoint import get_agent_checkpoint_manager
    from app.services.debugger import get_debug_manager

    return [get_debug_manager(), get_agent_checkpoint_manager()]


async def sweep_once(managers: Iterable[ExpirySweepable] | None = None) -> dict[str, int]:
    """敲一遍各 manager 的自带回收出口;一家抛异常不拖死其余。"""
    targets = list(managers) if managers is not None else default_sweepables()
    results: dict[str, int] = {}
    for target in targets:
        name = type(target).__name__
        try:
            results[name] = int(await target.cleanup_expired())
        except Exception as exc:  # 一家坏 ⇒ 其余照收,坏的那家如实记 -1 而不是静默
            logger.warning("[expiry_janitor] %s.cleanup_expired 失败(忽略): %s", name, exc)
            results[name] = -1
    return results


_task: asyncio.Task[Any] | None = None


def _running_task() -> asyncio.Task[Any] | None:
    if _task is not None and not _task.done():
        return _task
    return None


async def _loop(interval: float) -> None:
    while True:
        await asyncio.sleep(interval)
        await sweep_once()


def ensure_started() -> asyncio.Task[Any] | None:
    """幂等装载:已开 ⇒ 返回同一个任务;关档 ⇒ None(no-op)。"""
    global _task
    if not _enabled_from_env():
        logger.info("[expiry_janitor] EXPIRY_JANITOR_ENABLED 关档 ⇒ 不装载(未判定为已运行)")
        return None
    existing = _running_task()
    if existing is not None:
        return existing
    interval = interval_seconds_from_env()
    _task = asyncio.create_task(_loop(interval), name="expiry-janitor")
    logger.info("[expiry_janitor] 已装载,间隔 %.0fs", interval)
    return _task


def stop() -> None:
    """lifespan 收尾:取消任务并复位闩,让重进 lifespan 的测试拿到干净状态。"""
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
