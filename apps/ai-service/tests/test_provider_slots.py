# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

"""provider 并发槽与重试分档测试(2026-10-19 立,灭"自伤并发")。
覆盖:stepfun 4 槽上限(第 5 个调用排队而不是被拒)/ 排队 gauge 先增后落 /
空 provider_code 放行(stub 场景不被闸)/ settings JSON 覆盖 /
provider_caps 对 stepfun/agnes 的 request_max_retries=1(重试降档)。
"""

import asyncio

import pytest

from app.core import provider_slots as ps
from app.core.provider_caps import PROVIDER_CAPS, apply_provider_overrides


@pytest.fixture(autouse=True)
def _reset_slots():
    ps.reset_for_tests()
    yield
    ps.reset_for_tests()


def _prom_gauge_value(name: str, labels: dict) -> float:
    from prometheus_client import REGISTRY

    value = REGISTRY.get_sample_value(name, labels)
    return float(value) if value is not None else -1.0


def test_stepfun_slot_caps_at_four_and_queues_fifth():
    """stepfun 上限 4:前 4 个并发持有,第 5 个排队(await,不被拒)。"""

    async def scenario():
        entered = asyncio.Event()
        release = asyncio.Event()
        inside = {"n": 0, "max": 0}

        async def worker():
            async with ps.provider_slot("stepfun"):
                inside["n"] += 1
                inside["max"] = max(inside["max"], inside["n"])
                entered.set()
                await release.wait()
                inside["n"] -= 1

        tasks = [asyncio.create_task(worker()) for _ in range(5)]
        # 等前 4 个都进场(第 5 个排队):轮询 in_use gauge 到 4,不数 entered 次数
        # (数次数会被事件循环调度时序戏耍)
        deadline = asyncio.get_event_loop().time() + 3
        while _prom_gauge_value("llm_provider_slot_in_use", {"provider": "stepfun"}) < 4.0:
            if asyncio.get_event_loop().time() > deadline:
                raise AssertionError("5 个 worker 未能填满 4 槽(调度异常?)")
            await asyncio.sleep(0.01)
        await asyncio.sleep(0.05)
        assert inside["max"] == 4, "并发持有数不得超过上限 4"
        # 排队 gauge 应显示 1 个在等
        assert _prom_gauge_value("llm_provider_slot_waiting", {"provider": "stepfun"}) == 1.0
        release.set()
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=5)
        # 第 5 个也进过场(排队通过,不是被拒):max 仍为 4(串行补位)
        assert inside["max"] == 4
        assert _prom_gauge_value("llm_provider_slot_in_use", {"provider": "stepfun"}) == 0.0
        assert _prom_gauge_value("llm_provider_slot_waiting", {"provider": "stepfun"}) == 0.0

    asyncio.run(scenario())


def test_empty_provider_code_passes_through():
    """空 provider_code 直接放行(stub/无 provider 场景不该被闸)。"""

    async def scenario():
        async with ps.provider_slot(""):
            pass  # 不抛即通过

    asyncio.run(scenario())


def test_unknown_provider_uses_default_limit():
    """未登记的 provider 用默认 8(不炸,可用)。"""

    async def scenario():
        sem = ps._semaphore_for("some_new_provider")
        assert sem._value == 8

    asyncio.run(scenario())


def test_provider_caps_retries_downgraded_for_free_tier():
    """stepfun/agnes 的 request_max_retries=1(2026-10-19 降档,防重试挤占并发)。"""
    assert PROVIDER_CAPS["stepfun"].request_max_retries == 1
    assert PROVIDER_CAPS["agnes"].request_max_retries == 1
    # apply_provider_overrides 把 1 写进 call_kwargs(调用方没显式给时)
    kwargs: dict = {}
    apply_provider_overrides(kwargs, "stepfun")
    assert kwargs["num_retries"] == 1
    # 调用方显式值永远优先
    kwargs2 = {"num_retries": 3}
    apply_provider_overrides(kwargs2, "stepfun")
    assert kwargs2["num_retries"] == 3
