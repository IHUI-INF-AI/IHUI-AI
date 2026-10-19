# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""provider 级并发槽(2026-10-19 立,灭"自伤并发")。

背景实测(2026-10-19):stepfun 免费档上游并发上限 5,本系统并发打到 6
⇒ RateLimitError(concurrency reached)⇒ combo 四腿全灭 ⇒ 用户 502。
全天 53 次,集中在 00/06/18 时整点 —— system-worker 批任务 + 主聊 +
部署期健康探测叠加的结果,不是上游故障,是自己挤自己。

设计:
- 按 provider 惰性创建 asyncio.Semaphore(第一次用到才建,不为未用 provider
  占资源);上限来自 settings.provider_slot_limits(JSON),未配的 provider
  走 default(8)。
- stepfun/agnes 这类免费档默认 4:上游 limit 5 留 1 个余量给"正在飞"的
  在途请求与人工探测 —— 打到 4 就排队,而不是打到 5 被拒后重试(重试也占
  并发槽,越重试越挤,这是当天日志里 "LiteLLM Retried: 2 times" 的放大链)。
- 观测:在等/在用两个 gauge,大屏可直接看"谁在排队",排队本身就是
  "该升级该 provider 或该错峰"的信号,不需要等告警。

纪律(照抄 AGENTS.md §0):
- 槽是"自用的闸",不伪装上游能力;上游真实上限只有厂商知道,这里的数字是
  本系统的自律值,改数字只改 settings,不动调用点。
- 排队永不让路:acquire 用 await(不用 acquire_nowait 丢请求),丢请求比
  排队更糟(用户看到 502 而不是慢一点)。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator

from prometheus_client import Gauge

logger = logging.getLogger(__name__)

# 排队/在用 gauge(按 provider):值是瞬时快照,semaphore 交出即回落。
_provider_slot_waiting = Gauge(
    "llm_provider_slot_waiting",
    "Callers currently waiting for this provider's concurrency slot",
    ["provider"],
)
_provider_slot_in_use = Gauge(
    "llm_provider_slot_in_use",
    "Concurrency slots currently held for this provider",
    ["provider"],
)

# 免费/中转档的自律上限:上游 limit 5 留 1 余量。扩容/缩容只改这里+settings 覆盖。
_DEFAULT_SLOT_LIMITS: dict[str, int] = {
    "stepfun": 4,
    "agnes": 4,
}

_DEFAULT_SLOT_LIMIT = 8

_semaphores: dict[str, asyncio.Semaphore] = {}
_limits: dict[str, int] | None = None  # 惰性装载,None=未装载


def _load_limits() -> dict[str, int]:
    """合并 settings.provider_slot_limits(JSON 字符串)与内置默认。

    settings 为空/非法 JSON 时只用内置默认(解析失败只 warn,不炸调用链)。
    装载一次后缓存;改配置要重启进程(与项目其它 settings 字段同语义)。
    """
    global _limits
    if _limits is not None:
        return _limits
    merged = dict(_DEFAULT_SLOT_LIMITS)
    raw = ""
    try:
        from .config import settings  # 延迟导入避免与 config 的循环依赖

        raw = (settings.provider_slot_limits or "").strip()
    except Exception as e:  # noqa: BLE001 - 配置读不到不该炸调用链,用默认值
        logger.warning("provider_slot_limits 读取失败,用内置默认: %s", e)
    if raw:
        try:
            override = json.loads(raw)
            if isinstance(override, dict):
                for key, value in override.items():
                    if isinstance(value, int) and value > 0:
                        merged[str(key)] = value
        except (ValueError, TypeError) as e:
            logger.warning("provider_slot_limits 不是合法 JSON,忽略: %s", e)
    _limits = merged
    return merged


def _semaphore_for(provider_code: str) -> asyncio.Semaphore:
    limits = _load_limits()
    limit = limits.get(provider_code, _DEFAULT_SLOT_LIMIT)
    sem = _semaphores.get(provider_code)
    if sem is None:
        sem = asyncio.Semaphore(limit)
        _semaphores[provider_code] = sem
    return sem


@contextlib.asynccontextmanager
async def provider_slot(provider_code: str) -> AsyncIterator[None]:
    """按 provider 限并发地包住一次上游调用(排队永不让路)。

    用法:
        async with provider_slot(provider_code):
            resp = await litellm.acompletion(**call_kwargs)

    provider_code 为空串时放行(本地 stub/无 provider 场景不该被闸)。
    gauge 在 finally 里减,异常路径也精确回落。
    """
    if not provider_code:
        yield
        return
    sem = _semaphore_for(provider_code)
    _provider_slot_waiting.labels(provider=provider_code).inc()
    try:
        await sem.acquire()
    finally:
        _provider_slot_waiting.labels(provider=provider_code).dec()
    _provider_slot_in_use.labels(provider=provider_code).inc()
    try:
        yield
    finally:
        _provider_slot_in_use.labels(provider=provider_code).dec()
        sem.release()


def reset_for_tests() -> None:
    """测试专用:清空惰性缓存,让每个用例从干净状态装载。"""
    global _limits
    _semaphores.clear()
    _limits = None
