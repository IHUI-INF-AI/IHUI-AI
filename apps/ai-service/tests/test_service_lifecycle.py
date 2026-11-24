# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""service_lifecycle 单测 — 钉住 Codex 微服务三件套复现行为。"""

from __future__ import annotations

import asyncio
import random

import pytest

from app.services.service_lifecycle import (
    ReconcileAction,
    RetryExhaustedError,
    RetryPolicy,
    ServiceLifecycle,
    apply_reconcile,
    is_transient_status,
    plan_reconcile,
    rpc_retry,
)


class TestRpcRetry:
    async def test_success_first_try(self) -> None:
        calls = 0

        async def op() -> int:
            nonlocal calls
            calls += 1
            return 42

        assert await rpc_retry(op) == 42
        assert calls == 1

    async def test_retry_then_success(self) -> None:
        calls = 0
        slept: list[float] = []

        async def op() -> str:
            nonlocal calls
            calls += 1
            if calls < 3:
                raise ConnectionError("boom")
            return "ok"

        async def fake_sleep(d: float) -> None:
            slept.append(d)

        assert await rpc_retry(op, sleep=fake_sleep, rng=random.Random(1)) == "ok"
        assert calls == 3
        assert len(slept) == 2  # 失败 2 次各退避一次

    async def test_non_retryable_raises_immediately(self) -> None:
        calls = 0

        async def op() -> None:
            nonlocal calls
            calls += 1
            raise ValueError("bad input")

        with pytest.raises(ValueError):
            await rpc_retry(op)
        assert calls == 1  # 不可重试异常不重试

    async def test_exhaustion_raises(self) -> None:
        calls = 0

        async def op() -> None:
            nonlocal calls
            calls += 1
            raise ConnectionError("always")

        with pytest.raises(RetryExhaustedError):
            await rpc_retry(op, RetryPolicy(max_attempts=3), sleep=_nosleep)
        assert calls == 3

    async def test_custom_retryable(self) -> None:
        policy = RetryPolicy(max_attempts=2, retryable=lambda e: isinstance(e, KeyError))

        async def op() -> None:
            raise KeyError("k")

        with pytest.raises(RetryExhaustedError):
            await rpc_retry(op, policy, sleep=_nosleep)

    async def test_backoff_is_bounded(self) -> None:
        pol = RetryPolicy(base_delay_s=1.0, multiplier=2.0, max_delay_s=3.0)
        rng = random.Random(7)
        for attempt in range(10):
            assert pol.delay_for(attempt, rng) <= 3.0


async def _nosleep(_: float) -> None:
    return None


class TestTransientStatus:
    @pytest.mark.parametrize("code", [429, 500, 502, 503, 504])
    def test_transient(self, code: int) -> None:
        assert is_transient_status(code) is True

    @pytest.mark.parametrize("code", [200, 301, 400, 401, 403, 404])
    def test_not_transient(self, code: int) -> None:
        assert is_transient_status(code) is False


class TestPlanReconcile:
    def test_add_update_remove(self) -> None:
        desired = {"a": 1, "b": 2, "c": 3}
        actual = {"b": 99, "c": 3, "z": 0}
        actions = plan_reconcile(desired, actual)
        kinds = {(a.key, a.kind) for a in actions}
        assert ("a", "add") in kinds
        assert ("b", "update") in kinds
        assert ("z", "remove") in kinds
        assert ("c", "update") not in kinds  # 值相等不动

    def test_no_change_no_actions(self) -> None:
        assert plan_reconcile({"x": 1}, {"x": 1}) == []

    def test_custom_equal(self) -> None:
        # 忽略大小写比较: 大小写差异不算变更
        actions = plan_reconcile(
            {"h": "ABC"}, {"h": "abc"}, equal=lambda a, b: a.lower() == b.lower()
        )
        assert actions == []

    def test_pure_function_no_mutation(self) -> None:
        actual = {"a": 1}
        plan_reconcile({"b": 2}, actual)
        assert actual == {"a": 1}  # 入参未被改

    def test_apply_reconcile_idempotent(self) -> None:
        desired = {"a": 1, "b": 2}
        actual = {"a": 9, "z": 3}
        actions = plan_reconcile(desired, actual)
        once = apply_reconcile(actual, actions)
        assert once == desired
        # 再对账一次: 已达期望态, 无动作
        assert plan_reconcile(desired, once) == []

    def test_deterministic_order(self) -> None:
        desired = {"c": 1, "a": 1, "b": 1}
        actual: dict[str, int] = {}
        acts = plan_reconcile(desired, actual)
        assert [a.key for a in acts] == ["a", "b", "c"]  # 同类内按 key 稳定


class TestServiceLifecycle:
    async def test_ensure_connected_lazy(self) -> None:
        calls = 0

        async def connect() -> str:
            nonlocal calls
            calls += 1
            return "conn"

        svc = ServiceLifecycle("s", connect=connect)
        assert svc.connected is False
        assert await svc.ensure_connected() == "conn"
        assert calls == 1
        # 再调复用, 不重连
        await svc.ensure_connected()
        assert calls == 1

    async def test_concurrent_ensure_connected_single_connect(self) -> None:
        calls = 0

        async def connect() -> int:
            nonlocal calls
            calls += 1
            await asyncio.sleep(0.01)  # 模拟慢初始化
            return 1

        svc = ServiceLifecycle("s", connect=connect)
        results = await asyncio.gather(*(svc.ensure_connected() for _ in range(8)))
        assert all(r == 1 for r in results)
        assert calls == 1  # 并发下只连一次

    async def test_connect_failure_retries(self) -> None:
        calls = 0

        async def connect() -> str:
            nonlocal calls
            calls += 1
            raise ConnectionError("down")

        svc = ServiceLifecycle("s", connect=connect)
        with pytest.raises(RetryExhaustedError):
            await svc.ensure_connected()
        assert calls == RetryPolicy().max_attempts  # 走了 rpc_retry 默认重试

    async def test_stop_allows_reconnect(self) -> None:
        calls = 0
        closed: list[str] = []

        async def connect() -> str:
            nonlocal calls
            calls += 1
            return "c"

        async def disconnect(conn: str) -> None:
            closed.append(conn)

        svc = ServiceLifecycle("s", connect=connect, disconnect=disconnect)
        await svc.ensure_connected()
        await svc.stop()
        assert svc.connected is False
        assert closed == ["c"]
        await svc.ensure_connected()  # 可重连
        assert calls == 2

    async def test_dispose_blocks_reconnect(self) -> None:
        async def connect() -> str:
            return "c"

        svc = ServiceLifecycle("s", connect=connect)
        await svc.ensure_connected()
        await svc.dispose()
        with pytest.raises(RuntimeError, match="disposed"):
            await svc.ensure_connected()

    async def test_no_connect_raises(self) -> None:
        svc = ServiceLifecycle("bare")
        with pytest.raises(RuntimeError, match="no connect"):
            await svc.ensure_connected()


def test_reconcile_action_shape() -> None:
    a = ReconcileAction("add", "k", desired=1)
    assert a.kind == "add"
    assert a.actual is None
