# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815970(2026-10-13)压缩纳入 _wait_interruptible 包裹测试。

主代码:agent_loop_v2.py 推理前压缩调用点已由裸 await 改为
``await self._wait_interruptible(self._maybe_compact_context(messages))``。
正反成对:

- 反(取消):压缩进行中置 _cancel_requested ⇒ 在 ≤0.25s 轮询窗口级别中断返回
  cancelled,且不发起重试轮(LLM 一次不调、_stream_retry_state 重试路径不进入);
- 正(完成):压缩正常完成 ⇒ 包裹层原样返回压缩结果,_stream_retry_state/退避
  计数逐字段不变(防把重试链路一起打断)。

最小 fake 驱动(不真调 LLM),构造方式对齐 test_agent_loop_compaction.py /
test_cancel_partial_assistant_persist.py 的既有风格(loop_box + 运行中置标志)。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

import app.services.compact_with_llm as cwl
from app.core.config import settings
from app.services import orchestration_hub
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition, _LoopInterrupted
from app.services.memory import memory_store


@pytest.fixture(autouse=True)
def _isolate_io(monkeypatch: pytest.MonkeyPatch) -> None:
    """焊死事件面 Redis 链路(§5 测试隔离):真实连接超时(每次 2-3s)会污染
    "≤0.25s 轮询窗口级返回"的 elapsed 判据 —— hook_engine 惰性读 settings.redis_url,
    orchestration_hub 在 import 期把 .env 地址固化进模块级 _REDIS_URL,两处都置空
    ⇒ emit/XADD 走"无 Redis → 内存降级"分支,零连接尝试。
    """
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(orchestration_hub, "_REDIS_URL", "")
    monkeypatch.setattr(memory_store, "_use_redis", False, raising=False)
    monkeypatch.setattr(memory_store, "_redis", None, raising=False)


def _big_history_messages() -> list[dict[str, Any]]:
    """长历史(触发真实压缩路径):system + 10 对长 user/assistant(≈16k tokens)。"""
    filler = "历史上下文内容," * 100
    msgs: list[dict[str, Any]] = [
        {"role": "system", "content": "你是天气助手,只回答天气。"}
    ]
    for i in range(10):
        msgs.append({"role": "user", "content": f"第{i}轮提问 {filler}"})
        msgs.append({"role": "assistant", "content": f"第{i}轮回答 {filler}"})
    msgs.append({"role": "user", "content": "北京天气"})
    return msgs


def _make_loop(llm_calls: list[int]) -> AgentLoopV2:
    """最小 loop:mock LLM 只计数;压缩配置显式开启。"""

    async def mock_llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
        llm_calls.append(len(messages))
        return {"content": "北京晴", "tool_calls": None}

    async def _executor(args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True}

    return AgentLoopV2(
        mock_llm,
        [
            ToolDefinition(
                name="get_weather",
                description="查询天气",
                parameters={"type": "object", "properties": {}},
                executor=_executor,
            )
        ],
        max_iterations=3,
        enable_checkpoint=False,
        session_id="g815970-compact-interruptible",
        compaction_enabled=True,
        compaction_context_limit=8000,
    )


async def test_cancel_during_compaction_interrupts_within_poll_window(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """反例:压缩(一次完整模型调用)在飞时置取消 ⇒ 轮询窗口级中断,不进重试路径。"""
    # LLM 语义压缩路径开关在 __init__ 读 env,须先设再构造
    monkeypatch.setenv("AGENT_COMPACTION_LLM_ENABLED", "on")
    llm_calls: list[int] = []
    loop = _make_loop(llm_calls)
    entered: dict[str, bool] = {}
    inner_cancelled: dict[str, bool] = {}

    async def fake_compact_with_llm(
        messages: list[dict[str, Any]],
        context_limit: int,
        llm_complete_fn: Any,
        **kwargs: Any,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        entered["ok"] = True
        # 真实形态:压缩在飞时用户按停止
        loop._cancel_requested = True
        try:
            await asyncio.sleep(2.0)  # 远大于 0.25s 轮询窗口
        except asyncio.CancelledError:
            inner_cancelled["hit"] = True
            raise
        return messages, {"compressed": False}  # pragma: no cover - 不应到达

    monkeypatch.setattr(cwl, "compact_with_llm", fake_compact_with_llm)

    started = time.perf_counter()
    result = await loop.run(_big_history_messages())
    elapsed = time.perf_counter() - started

    assert entered["ok"] is True, "压缩须确实在飞,否则本判据退化为空断言"
    assert inner_cancelled["hit"] is True, "包裹层必须 cancel 内部压缩任务(不悬挂)"
    assert result.stop_reason == "cancelled"
    assert result.success is False
    # ≤0.25s 轮询窗口级别返回:fake 睡 2.0s,若仍是裸 await 会跑满 2s 才轮到边界检查
    assert elapsed < 1.5
    # 不发起重试轮:LLM 一次都没调;_stream_retry_state 重试状态机从未建立
    assert llm_calls == []
    assert loop._stream_retry_state is None


async def test_compact_completion_passthrough_keeps_retry_state_intact() -> None:
    """正例:压缩正常完成 ⇒ 包裹层原样返回压缩结果;重试状态逐字段不变。"""

    class _RetryStateStub:
        """_stream_retry_state 形状替身(批57 重试决策状态机的决策面字段)。"""

        def __init__(self) -> None:
            self.attempt = 2
            self.backoff_seconds = 1.5
            self.consecutive_failures = 3
            self.notify_message = "retry-notify"

    loop = _make_loop([])
    sentinel = _RetryStateStub()
    loop._stream_retry_state = sentinel  # type: ignore[assignment]
    snapshot = dict(sentinel.__dict__)

    compacted: list[dict[str, Any]] = [
        {"role": "system", "content": "你是天气助手,只回答天气。"},
        {"role": "user", "content": "[上下文摘要] 此前多轮天气问答已压缩。"},
        {"role": "user", "content": "北京天气"},
    ]

    async def fake_compact(
        messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return compacted

    loop._maybe_compact_context = fake_compact  # type: ignore[method-assign]

    out = await loop._wait_interruptible(
        loop._maybe_compact_context([{"role": "user", "content": "x"}])
    )

    # 包裹层原样返回:同一对象、零加工
    assert out is compacted
    # _stream_retry_state/退避计数逐字段不变(同一实例、字段零漂移)
    assert loop._stream_retry_state is sentinel
    assert dict(sentinel.__dict__) == snapshot


async def test_wait_interruptible_poll_window_for_compact_coroutine() -> None:
    """直测包裹层窗口:取消置位后 ≤0.25s 轮询窗口级别抛 _LoopInterrupted("cancelled")。"""
    loop = _make_loop([])

    async def slow_compact(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        await asyncio.sleep(5.0)
        return messages  # pragma: no cover - 不应到达

    loop._maybe_compact_context = slow_compact  # type: ignore[method-assign]

    wrapper = asyncio.ensure_future(
        loop._wait_interruptible(
            loop._maybe_compact_context([{"role": "user", "content": "x"}])
        )
    )
    await asyncio.sleep(0.1)  # 让包裹层进入 0.25s 轮询等待
    t_flag = time.perf_counter()
    loop._cancel_requested = True
    with pytest.raises(_LoopInterrupted) as exc_info:
        await wrapper
    lag = time.perf_counter() - t_flag
    assert exc_info.value.reason == "cancelled"
    # 0.25s 轮询窗口 + 调度/清理余量(裸 await 会一直等到 5s 的 sleep 跑完)
    assert lag <= 0.6
