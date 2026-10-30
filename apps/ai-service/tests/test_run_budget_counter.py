# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""run 三维计数器(轮次 / 耗时 / 额度)回归测试。

判据三条:
  ① 三维自增:假时钟 + 假额度,不依赖真实计时,也不连任何存储;
  ② 超限语义:"还能不能再跑"只由 `_can_continue` 一个函数回答 —— 三个出口
     (`note_turn` 返回值 / `can_continue` / `budget_snapshot`)用桩证明同源;
  ③ 未提供的额度维必须如实是 None,不得用 0 冒充。
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest

from app.services import agent_run_control as run_control
from app.services.agent_checkpoint import AgentCheckpointManager
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition


class _NullLoop:
    """只满足 `PausableLoop` 协议;本文件不触发 pause。"""

    async def pause(self) -> str | None:
        return None


@pytest.fixture(autouse=True)
def _isolate_records() -> Iterator[None]:
    """登记表是进程内单例:前后各清一次,残留会让断言失去意义。"""
    run_control.clear_all()
    yield
    run_control.clear_all()


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[float]]:
    """假单调时钟:模块级 `_clock` 是耗时维的唯一取值点。"""
    now = [1000.0]
    monkeypatch.setattr(run_control, "_clock", lambda: now[0])
    yield now


async def test_three_dimensions_accumulate_with_fake_clock(clock: list[float]) -> None:
    await run_control.register_run(
        "s-budget", owner_user_id="u1", loop=_NullLoop(), max_turns=3
    )

    # 未开始跑:三维起零,额度维未提供(None,不是 0)。
    assert await run_control.budget_snapshot("s-budget") == {
        "turns_used": 0,
        "time_used_seconds": 0.0,
        "credits_used": None,
        "max_turns": 3,
        "can_continue": True,
    }

    clock[0] += 1.5
    assert await run_control.note_turn("s-budget", credits=0.25) is True
    clock[0] += 2.0
    assert await run_control.note_turn("s-budget", credits=0.5) is True

    snapshot = await run_control.budget_snapshot("s-budget")
    assert snapshot["turns_used"] == 2
    assert snapshot["time_used_seconds"] == pytest.approx(3.5)
    assert snapshot["credits_used"] == pytest.approx(0.75)


async def test_unknown_session_is_not_blocked(clock: list[float]) -> None:
    """无记录 = 未判定不拦;快照空字典与 snapshot_records 同形。"""
    assert await run_control.note_turn("never-registered") is True
    assert await run_control.can_continue("never-registered") is True
    assert await run_control.budget_snapshot("never-registered") == {}


async def test_limit_reached_blocks_continuation(clock: list[float]) -> None:
    """turns_used == max_turns 之后,"还能不能再跑"一律 False。"""
    await run_control.register_run(
        "s-limit", owner_user_id="u1", loop=_NullLoop(), max_turns=2
    )

    assert await run_control.note_turn("s-limit") is True  # 第 1 轮后还剩 1 轮
    assert await run_control.note_turn("s-limit") is False  # 第 2 轮后已达上限
    assert await run_control.note_turn("s-limit") is False  # 超限后保持 False
    assert await run_control.can_continue("s-limit") is False
    assert (await run_control.budget_snapshot("s-limit"))["can_continue"] is False


async def test_single_decision_exit(
    clock: list[float], monkeypatch: pytest.MonkeyPatch
) -> None:
    """把唯一判定换成桩:三个出口全部跟随 —— 说明没有第二份判定实现。"""
    await run_control.register_run(
        "s-single", owner_user_id="u1", loop=_NullLoop(), max_turns=99
    )
    monkeypatch.setattr(run_control, "_can_continue", lambda rec: False)

    assert await run_control.can_continue("s-single") is False
    assert await run_control.note_turn("s-single") is False
    assert (await run_control.budget_snapshot("s-single"))["can_continue"] is False


async def test_detach_clears_counter(clock: list[float]) -> None:
    """running 记录 detach 即删(既有语义),计数器随之不可读,不另造第二份台账。"""
    await run_control.register_run("s-detach", owner_user_id="u1", loop=_NullLoop())
    await run_control.note_turn("s-detach")
    assert await run_control.detach_run("s-detach", owner_user_id="u1") is True
    assert await run_control.budget_snapshot("s-detach") == {}


async def test_real_loop_counts_each_turn(monkeypatch: pytest.MonkeyPatch) -> None:
    """接线锁:真 loop 跑满 2 轮,计数必须由 `_run_loop` 每轮写实(不是测试自喂)。"""

    def _no_asyncpg_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("本用例不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_asyncpg_pool)
    monkeypatch.setattr("app.services.agent_checkpoint._PSYCOPG_AVAILABLE", False)

    counter = {"n": 0}

    async def mock_llm(messages: Any, tools: Any) -> dict[str, Any]:
        counter["n"] += 1
        n = counter["n"]
        return {
            "content": f"第 {n} 次查询",
            "tool_calls": [
                {"id": f"c{n}", "name": "get_weather", "args": {"city": f"城市{n}"}}
            ],
        }

    async def echo(args: dict[str, Any]) -> dict[str, str]:
        return {"echo": str(args.get("city", ""))}

    tool = ToolDefinition(
        name="get_weather",
        description="查询城市天气",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
        executor=echo,
    )
    loop = AgentLoopV2(
        mock_llm,
        [tool],
        max_iterations=2,
        enable_checkpoint=False,
        session_id="sess-real-counter",
        checkpoint_manager=AgentCheckpointManager(redis_url=None, db_url=None),
        user_id="u1",
        enable_memory=False,
    )
    await run_control.register_run(
        "sess-real-counter", owner_user_id="u1", loop=loop
    )
    await loop.run([{"role": "user", "content": "查两次天气"}])

    snapshot = await run_control.budget_snapshot("sess-real-counter")
    assert snapshot["turns_used"] == 2
    assert snapshot["max_turns"] == 2
    assert snapshot["credits_used"] is None  # 上游未提供成本,不编造
    assert snapshot["can_continue"] is False

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
