# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core/responses_retry.py
"""Responses 流重试与传输降级决策(2026-09-20 第五十六批,对标 Codex responses_retry.rs)。

与 agent_loop_v2._llm_call_with_retry 的指数退避互补,本模块聚焦 **Responses API
流式连接** 的重试决策,逻辑逐条对齐 codex-rs core/src/responses_retry.rs:

- **无限重连(UnboundedConnectionRetries)**:仅对 Sampling 类请求、连接级失败、非内部
  会话、非 Amazon Bedrock provider 生效;延迟从 5s 起每轮翻倍并封顶 60s,期间只提示
  "Reconnecting... waiting for network",不计入普通重试额度。
- **传输降级(fallback transport)**:普通重试耗尽且存在 HTTPS fallback 传输时,清零重试
  计数并切换传输,提示 "Falling back from WebSockets to HTTPS transport."。
- **普通重试**:指数退避 200ms × 2^(n-1),server 下发的 retry_delay 优先;release 构建
  隐藏首次 websocket 重连提示以减少噪音(debug_assertions 时仍全量提示)。
- **耗尽**:返回 exhausted 决策并保留 ExhaustedResponseRetry(turn_id, retry_at),
  retry_at 由 server_retry_delay 叠加单调时钟决定(否则为 None)。

纯决策函数 decide_stream_retry 不抛异常、无副作用 IO,便于单测;
handle_retryable_stream_error 为其 async 外壳,按 action 执行 asyncio.sleep
(exhausted 不 sleep)且静默吞掉一切异常。
"""

from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass
from typing import Callable, Optional


# --- 常量(对标 codex-rs 同名 const)---------------------------------------
INITIAL_CONNECTION_RETRY_DELAY: float = 5.0
MAX_CONNECTION_RETRY_DELAY: float = 60.0
DEFAULT_STREAM_MAX_RETRIES: int = 5
DEFAULT_REQUEST_MAX_RETRIES: int = 4
HARD_MAX_RETRIES_CAP: int = 100
DEFAULT_STREAM_IDLE_TIMEOUT_MS: int = 300_000


def backoff(retry_count: int) -> float:
    """指数退避(对标 codex util::backoff)。

    200ms × 2^(attempt-1);attempt 0 与 1 均返回 200ms(0.2s)。
    """
    return 0.2 * (2.0 ** max(retry_count - 1, 0))


def jittered(delay: float, rng: random.Random) -> float:
    """对退避加 ±10% 抖动(对标 codex jitter 风格)。

    delay × (0.9 + rng.random() × 0.2);rng 可注入便于测试。
    """
    return delay * (0.9 + rng.random() * 0.2)


@dataclass
class ResponsesStreamRetryState:
    """流式重试状态(对标 codex ResponsesStreamRetryState)。"""

    retries: int = 0
    connection_retries: int = 0
    connection_retry_delay: float = INITIAL_CONNECTION_RETRY_DELAY


@dataclass
class ExhaustedResponseRetry:
    """普通重试耗尽后保留的 server 重试建议(对标 codex ExhaustedResponseRetry)。"""

    turn_id: str
    retry_at: Optional[float]


@dataclass
class RetryDecision:
    """一次重试决策的结果(纯数据,无副作用)。"""

    action: str = "retry"
    delay: float = 0.0
    notify_message: Optional[str] = None
    report_error: bool = False
    exhausted: Optional[ExhaustedResponseRetry] = None


def decide_stream_retry(
    state: ResponsesStreamRetryState,
    *,
    max_retries: int,
    is_connection_failed: bool,
    unbounded_connection_retries_enabled: bool,
    session_is_internal: bool,
    provider_is_bedrock: bool,
    fallback_transport_available: bool,
    server_retry_delay: Optional[float] = None,
    websocket_transport: bool = False,
    debug_assertions: bool = False,
    error_summary: Optional[str] = None,
    turn_id: str = "",
    clock: Callable[[], float] = time.monotonic,
) -> tuple[ResponsesStreamRetryState, RetryDecision]:
    """纯重试决策(对标 codex handle_retryable_response_stream_error 决策部分)。

    不抛异常、不直接 IO。硬上限 HARD_MAX_RETRIES_CAP 约束 max_retries。
    """
    capped_max_retries = min(int(max_retries), HARD_MAX_RETRIES_CAP)

    # 1) 无限重连分支:四条件齐备才走无界重连,不计普通重试额度。
    if (
        unbounded_connection_retries_enabled
        and is_connection_failed
        and not session_is_internal
        and not provider_is_bedrock
    ):
        delay = state.connection_retry_delay
        state.connection_retries += 1
        state.connection_retry_delay = min(
            state.connection_retry_delay * 2, MAX_CONNECTION_RETRY_DELAY
        )
        decision = RetryDecision(
            action="unbounded_retry",
            delay=delay,
            notify_message="Reconnecting... waiting for network",
            report_error=True,
        )
        return state, decision

    # 2) 传输降级分支:普通重试耗尽且存在 HTTPS fallback 传输。
    if state.retries >= capped_max_retries and fallback_transport_available:
        message = "Falling back from WebSockets to HTTPS transport."
        if error_summary:
            message = f"{message} {error_summary}"
        state.retries = 0
        decision = RetryDecision(
            action="switch_transport",
            delay=0.0,
            notify_message=message,
            report_error=False,
        )
        return state, decision

    # 3) 普通重试分支。
    if state.retries < capped_max_retries:
        state.retries += 1
        retry_count = state.retries
        delay = (
            server_retry_delay if server_retry_delay is not None else backoff(retry_count)
        )
        # release 隐藏首次 websocket 重连提示;debug 或走 HTTPS 时全量提示。
        report_error = (
            retry_count > 1 or debug_assertions or not websocket_transport
        )
        decision = RetryDecision(
            action="retry",
            delay=delay,
            notify_message=f"Reconnecting... {retry_count}/{capped_max_retries}",
            report_error=report_error,
        )
        return state, decision

    # 4) 耗尽分支:保留 server 重试建议(retry_at 由单调时钟 + server_retry_delay 决定)。
    retry_at: Optional[float] = None
    if server_retry_delay is not None:
        retry_at = clock() + server_retry_delay
    decision = RetryDecision(
        action="exhausted",
        delay=0.0,
        notify_message=None,
        report_error=False,
        exhausted=ExhaustedResponseRetry(turn_id=turn_id, retry_at=retry_at),
    )
    return state, decision


def is_retryable_error(error_type: str) -> bool:
    """错误是否可重试(对标 codex is_retryable 清单,采用 ihui _classify_error 分类)。

    可重试: timeout / connection / http_5xx / unknown
    不可重试: http_4xx / cancelled
    """
    return error_type in ("timeout", "connection", "http_5xx", "unknown")


async def handle_retryable_stream_error(
    state: ResponsesStreamRetryState,
    *,
    max_retries: int,
    is_connection_failed: bool,
    unbounded_connection_retries_enabled: bool,
    session_is_internal: bool,
    provider_is_bedrock: bool,
    fallback_transport_available: bool,
    server_retry_delay: Optional[float] = None,
    websocket_transport: bool = False,
    debug_assertions: bool = False,
    error_summary: Optional[str] = None,
    turn_id: str = "",
    clock: Callable[[], float] = time.monotonic,
) -> RetryDecision:
    """decide_stream_retry 的 async 外壳(对标 codex 同名 async fn)。

    按 action 执行 asyncio.sleep(delay);exhausted 不 sleep。
    决策函数本身不抛;本外壳静默吞掉一切异常,绝不向上抛。
    """
    try:
        _state, decision = decide_stream_retry(
            state,
            max_retries=max_retries,
            is_connection_failed=is_connection_failed,
            unbounded_connection_retries_enabled=unbounded_connection_retries_enabled,
            session_is_internal=session_is_internal,
            provider_is_bedrock=provider_is_bedrock,
            fallback_transport_available=fallback_transport_available,
            server_retry_delay=server_retry_delay,
            websocket_transport=websocket_transport,
            debug_assertions=debug_assertions,
            error_summary=error_summary,
            turn_id=turn_id,
            clock=clock,
        )
    except Exception:
        return RetryDecision(
            action="exhausted",
            delay=0.0,
            notify_message=None,
            report_error=False,
        )

    if decision.action != "exhausted":
        try:
            await asyncio.sleep(decision.delay)
        except Exception:
            pass
    return decision
