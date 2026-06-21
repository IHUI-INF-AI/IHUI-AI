"""Phase 12 建议 4: LLM 告警摘要 — SSE 流式 + LRU 缓存.

目的:
  原 alert_llm_summary.py 一次性返回完整摘要. 升级:
  1. SSE (Server-Sent Events) 流式输出 — FastAPI StreamingResponse
  2. LRU 缓存 — 同 alert 复用上次结果, 节省 LLM 调用
  3. 缓存键 — 基于 alert 关键字段 (alertname/severity/service/region/summary)
  4. TTL — 默认 5 分钟, 过期重新生成

用法 (FastAPI 端点):
  @app.get("/v1/summarize/stream")
  async def stream(alert: dict):
      return StreamingResponse(
          alert_llm_stream.stream_summary(alert),
          media_type="text/event-stream",
      )

  # 普通端点 (带缓存)
  summary = alert_llm_stream.summarize_alert_cached(alert)
"""

from __future__ import annotations

import hashlib
import json

# 复用基础模块 (mock 模板 + _call_openai_compatible)
import sys
import time
from collections import OrderedDict
from collections.abc import Iterator
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "scripts" / "ops"))


# ---------------------------------------------------------------------------
# 1. LRU + TTL 缓存
# ---------------------------------------------------------------------------


class LruTtlCache:
    """LRU + TTL 内存缓存 (线程不安全, 外部加锁)."""

    def __init__(self, max_size: int = 1024, ttl_seconds: float = 300.0):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._data: OrderedDict[str, tuple[float, str]] = OrderedDict()

    def get(self, key: str) -> str | None:
        """获取值, 过期返回 None."""
        if key not in self._data:
            return None
        ts, val = self._data[key]
        if time.time() - ts > self.ttl:
            self._data.pop(key, None)
            return None
        # 命中移到末尾 (LRU)
        self._data.move_to_end(key)
        return val

    def set(self, key: str, val: str) -> None:
        """设置值, 超 max_size 弹出最旧."""
        self._data[key] = (time.time(), val)
        self._data.move_to_end(key)
        while len(self._data) > self.max_size:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()

    def __len__(self) -> int:
        return len(self._data)

    def __bool__(self) -> bool:
        # 空实例也算 truthy, 避免 `cache or _DEFAULT_CACHE` 误判
        return True


# 全局默认缓存 (单例)
_DEFAULT_CACHE = LruTtlCache(max_size=1024, ttl_seconds=300.0)


def get_default_cache() -> LruTtlCache:
    return _DEFAULT_CACHE


# ---------------------------------------------------------------------------
# 2. 缓存键
# ---------------------------------------------------------------------------


def cache_key(alert: dict[str, Any]) -> str:
    """生成缓存键, 基于关键字段 (排除 ts/ttl/client_ip 等)."""
    key_fields = {
        "alertname": alert.get("alertname", ""),
        "severity": alert.get("severity", ""),
        "service": alert.get("service", ""),
        "summary": alert.get("summary", ""),
        "region": alert.get("labels", {}).get("region", ""),
        "tenant": alert.get("labels", {}).get("tenant", ""),
    }
    raw = json.dumps(key_fields, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# 3. 缓存版摘要
# ---------------------------------------------------------------------------


def summarize_alert_cached(alert: dict[str, Any], *, force_mock: bool = False, cache: LruTtlCache | None = None) -> str:
    """带缓存的摘要.

    命中缓存 → 直接返回; 未命中 → 调用 summarize_alert + 写入缓存.
    """
    cache = cache or _DEFAULT_CACHE
    key = cache_key(alert)
    hit = cache.get(key)
    if hit is not None:
        return hit
    # 复用基础模块的 summarize_alert
    from alert_llm_summary import summarize_alert

    val = summarize_alert(alert, force_mock=force_mock)
    cache.set(key, val)
    return val


# ---------------------------------------------------------------------------
# 4. SSE 流式
# ---------------------------------------------------------------------------


def _chunk_text(text: str, chunk_size: int = 4) -> Iterator[str]:
    """按 chunk_size 字切分文本 (中文按字符)."""
    for i in range(0, len(text), chunk_size):
        yield text[i : i + chunk_size]


def stream_summary(
    alert: dict[str, Any],
    *,
    force_mock: bool = False,
    cache: LruTtlCache | None = None,
    chunk_size: int = 4,
    delay_ms: int = 30,
) -> Iterator[dict[str, str]]:
    """SSE 格式流式输出摘要.

    Yields:
        dict: SSE 事件 {"event": "data|done|error", "data": "..."}
    """
    cache = cache or _DEFAULT_CACHE
    key = cache_key(alert)
    hit = cache.get(key)
    if hit is not None:
        # 缓存命中, 单事件返回
        yield {"event": "cache_hit", "data": json.dumps({"key": key, "summary": hit}, ensure_ascii=False)}
        yield {"event": "done", "data": json.dumps({"summary": hit, "cached": True}, ensure_ascii=False)}
        return

    # 缓存未命中, 流式生成
    try:
        # 真实 LLM: 调用 stream; mock: 拆模板
        # 当前实现统一走 summarize_alert 然后切块, 简化测试
        from alert_llm_summary import summarize_alert

        full = summarize_alert(alert, force_mock=force_mock)
    except Exception as e:
        yield {"event": "error", "data": json.dumps({"error": str(e)}, ensure_ascii=False)}
        return

    # 流式输出 (按 chunk_size 切)
    accumulated = ""
    for chunk in _chunk_text(full, chunk_size=chunk_size):
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
# 5. CLI 演示
# ---------------------------------------------------------------------------


def main() -> int:
    """CLI 演示: 输入 JSON 数组, 每行输出 SSE 事件."""

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
        for ev in stream_summary(alert, force_mock=True, delay_ms=0):
            print(f"event: {ev['event']}")
            print(f"data: {ev['data']}")
            print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
