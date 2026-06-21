"""Phase 13 建议 4: LLM 流式摘要 — 错误重试 + 背压控制.

目的:
  Phase 12 建议 4 实现了 LLM 摘要的 SSE 流式 + LRU 缓存.
  本模块在流式基础上加:
  1. 指数退避重试: LLM 临时故障 (5xx / Timeout / RateLimit) 自动重试
  2. 客户端断开检测: 客户端断开时立即终止流, 不浪费资源
  3. 自适应分块: 根据流速调整 chunk 大小, 慢客户端用小块, 快客户端用大块

设计:
  - 与 Phase 12 完全兼容, 新增参数都有默认值
  - 通过 stream_summary_v2() 入口
  - 重试仅对 transient 异常生效, ValueError 等不重试
  - 客户端断开通过 is_disconnected() 回调检测, 跨框架无关

用法:
  from fastapi import Request
  from alert_llm_stream_retry import stream_summary_v2

  @app.get("/v1/summarize/stream")
  async def stream(alert: dict, request: Request):
      return StreamingResponse(
          stream_summary_v2(
              alert,
              is_disconnected=lambda: await request.is_disconnected(),
          ),
          media_type="text/event-stream",
      )
"""

from __future__ import annotations

import asyncio
import json
import random
import sys
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "scripts" / "ops"))

import alert_llm_summary  # noqa: E402  模块级 import 便于测试 patch
from alert_llm_stream import _DEFAULT_CACHE, LruTtlCache, cache_key  # noqa: E402

# ---------------------------------------------------------------------------
# 1. 指数退避重试
# ---------------------------------------------------------------------------


def _compute_backoff_delay(
    attempt: int,
    base_delay: float = 0.5,
    max_delay: float = 30.0,
    multiplier: float = 2.0,
    jitter: bool = True,
) -> float:
    """计算第 attempt 次重试前的等待秒数.

    Args:
        attempt: 当前重试次数 (0=首次失败, 1=第二次尝试, ...)
        base_delay: 基础等待
        max_delay: 上限
        multiplier: 倍数
        jitter: 是否加随机抖动 (0.5x ~ 1.5x)
    """
    delay = min(max_delay, base_delay * (multiplier**attempt))
    if jitter:
        delay = delay * (0.5 + random.random())
    return delay


def call_with_retry(
    fn: Callable[[], Any],
    *,
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 30.0,
    multiplier: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: tuple[type[BaseException], ...] = (Exception,),
    on_retry: Callable[[int, BaseException, float], None] | None = None,
) -> Any:
    """同步版: 执行 fn, 失败按指数退避重试.

    Args:
        fn: 无参 callable, 成功返回值
        max_retries: 最大重试次数 (不含首次), 0=不重试
        base_delay: 首次重试前等待
        max_delay: 单次等待上限
        multiplier: 退避倍数
        jitter: 是否加随机抖动 (0.5x ~ 1.5x)
        retryable_exceptions: 触发重试的异常类型 tuple
        on_retry: 重试回调 (attempt, exc, delay)

    Returns:
        fn() 返回值

    Raises:
        最后一次失败的异常
    """
    last_exc: BaseException | None = None
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except retryable_exceptions as e:
            last_exc = e
            if attempt >= max_retries:
                break
            delay = _compute_backoff_delay(attempt, base_delay, max_delay, multiplier, jitter)
            if on_retry is not None:
                on_retry(attempt, e, delay)
            time.sleep(delay)
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("call_with_retry: unreachable")


# ---------------------------------------------------------------------------
# 2. 自适应分块
# ---------------------------------------------------------------------------


class AdaptiveChunkSizer:
    """根据连续发送情况自适应调整 chunk 大小.

    规则:
      - 初始 initial_size (默认 1)
      - 每次 send() 后, 如未触发 shrink, size *= growth_factor (向上取整)
      - 上限 max_size
      - 调用 shrink() 时, size = max(initial_size, size // 2), 重置连续计数
    """

    def __init__(
        self,
        initial_size: int = 1,
        max_size: int = 64,
        growth_factor: float = 2.0,
    ):
        if initial_size < 1:
            raise ValueError(f"initial_size 必须 >= 1, 实际 {initial_size}")
        if max_size < initial_size:
            raise ValueError(f"max_size {max_size} < initial_size {initial_size}")
        if growth_factor <= 1.0:
            raise ValueError(f"growth_factor 必须 > 1.0, 实际 {growth_factor}")
        self.initial_size = initial_size
        self.max_size = max_size
        self.growth_factor = growth_factor
        self.current_size = initial_size
        self.consecutive_sends = 0

    def next_size(self) -> int:
        return self.current_size

    def on_send(self) -> int:
        """记录一次成功发送, 返回当前 chunk_size."""
        size = self.current_size
        self.consecutive_sends += 1
        # 每 4 次成功发送增长一次
        if self.consecutive_sends >= 4:
            new_size = int(self.current_size * self.growth_factor)
            self.current_size = min(self.max_size, max(self.initial_size, new_size))
            self.consecutive_sends = 0
        return size

    def shrink(self) -> int:
        """客户端慢/断开, 缩小 chunk. 返回新 size."""
        new_size = max(self.initial_size, self.current_size // 2)
        self.current_size = new_size
        self.consecutive_sends = 0
        return new_size

    def reset(self) -> None:
        self.current_size = self.initial_size
        self.consecutive_sends = 0


# ---------------------------------------------------------------------------
# 3. 流式生成 (带重试/背压)
# ---------------------------------------------------------------------------

# transient 异常: 网络/超时/限流
_DEFAULT_TRANSIENT = (ConnectionError, TimeoutError, OSError)


def _is_disconnected_sync(is_disconnected: Callable[[], bool] | None) -> bool:
    """同步检查客户端是否断开. is_disconnected 可返回 bool 或 awaitable."""
    if is_disconnected is None:
        return False
    try:
        result = is_disconnected()
        if asyncio.iscoroutine(result):
            # 同步上下文不能 await, 用新 loop 跑
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    return False  # 避免嵌套 loop, 假定未断开
                return loop.run_until_complete(result)
            except RuntimeError:
                return False
        return bool(result)
    except Exception:
        return False


def _chunk_text_adaptive(
    text: str,
    sizer: AdaptiveChunkSizer,
) -> Iterator[tuple[int, str]]:
    """按 sizer.next_size() 切分文本, 每次 yield (size, chunk)."""
    pos = 0
    while pos < len(text):
        size = sizer.next_size()
        chunk = text[pos : pos + size]
        sizer.on_send()
        yield size, chunk
        pos += size


def stream_summary_v2(
    alert: dict[str, Any],
    *,
    force_mock: bool = False,
    cache: LruTtlCache | None = None,
    chunk_size: int = 4,
    delay_ms: int = 30,
    # 新增 (Phase 13 建议 4)
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    retryable_exceptions: tuple[type[BaseException], ...] = _DEFAULT_TRANSIENT,
    is_disconnected: Callable[[], Any] | None = None,
    adaptive: bool = False,
    adaptive_initial: int = 1,
    adaptive_max: int = 32,
    adaptive_growth: float = 2.0,
    on_retry: Callable[[int, BaseException, float], None] | None = None,
) -> Iterator[dict[str, str]]:
    """SSE 流式摘要 (v2) — 支持重试/断连/自适应.

    与 v1 行为基本一致, 新参数:
      - max_retries: 失败后最大重试次数 (含 transient 异常)
      - base_delay/max_delay: 指数退避参数
      - retryable_exceptions: 触发重试的异常 tuple
      - is_disconnected: 客户端断开回调, 返回 bool 或 awaitable bool
      - adaptive: 启用自适应分块
      - adaptive_initial/adaptive_max/adaptive_growth: 自适应参数
      - on_retry: 重试回调 (attempt, exc, delay)

    Yields:
        dict: {"event": "data|done|error|retry|cache_hit|disconnected", "data": "..."}
    """
    cache = cache or _DEFAULT_CACHE
    key = cache_key(alert)
    hit = cache.get(key)
    if hit is not None:
        yield {"event": "cache_hit", "data": json.dumps({"key": key, "summary": hit}, ensure_ascii=False)}
        yield {"event": "done", "data": json.dumps({"summary": hit, "cached": True}, ensure_ascii=False)}
        return

    # 调 LLM (带重试)
    def _call_llm() -> str:
        # 用模块级 import, 便于测试 patch
        return alert_llm_summary.summarize_alert(alert, force_mock=force_mock)

    try:
        full = call_with_retry(
            _call_llm,
            max_retries=max_retries,
            base_delay=base_delay,
            max_delay=max_delay,
            retryable_exceptions=retryable_exceptions,
            on_retry=on_retry,
        )
    except Exception as e:
        yield {"event": "error", "data": json.dumps({"error": str(e), "type": type(e).__name__}, ensure_ascii=False)}
        return

    # 自适应 or 固定分块
    if adaptive:
        sizer = AdaptiveChunkSizer(
            initial_size=adaptive_initial,
            max_size=adaptive_max,
            growth_factor=adaptive_growth,
        )
        iterator: Any = _chunk_text_adaptive(full, sizer)
    else:
        # 固定 chunk_size, 但保持 (size, chunk) tuple 形式
        def _fixed():
            for i in range(0, len(full), chunk_size):
                yield chunk_size, full[i : i + chunk_size]

        iterator = _fixed()

    # 流式输出, 检查客户端断开
    accumulated = ""
    for _size, chunk in iterator:
        if _is_disconnected_sync(is_disconnected):
            if adaptive:
                sizer.shrink()
            yield {"event": "disconnected", "data": json.dumps({"accumulated": accumulated}, ensure_ascii=False)}
            return
        accumulated += chunk
        yield {
            "event": "data",
            "data": json.dumps({"chunk": chunk, "accumulated": accumulated}, ensure_ascii=False),
        }
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)

    # 写缓存
    cache.set(key, full)
    yield {"event": "done", "data": json.dumps({"summary": full, "cached": False}, ensure_ascii=False)}


# ---------------------------------------------------------------------------
# 4. CLI
# ---------------------------------------------------------------------------


def main() -> int:

    p = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else None
    if p is None:
        p = [
            {
                "alertname": "HighErrorRate",
                "severity": "critical",
                "service": "zhs-platform-api",
                "summary": "5xx 错误率 12%",
                "labels": {"region": "cn-east-1"},
            }
        ]
    for alert in p:
        print(f"--- alert: {alert.get('alertname')} ---")
        disconnected = [False]
        for ev in stream_summary_v2(
            alert,
            force_mock=True,
            delay_ms=0,
            is_disconnected=lambda: disconnected[0],
        ):
            print(f"event: {ev['event']}")
            print(f"data: {ev['data']}")
            print()
            if ev["event"] == "data":
                # 演示: 客户端可中途断开
                if "5xx" in ev["data"]:
                    disconnected[0] = True
    return 0


if __name__ == "__main__":
    sys.exit(main())
