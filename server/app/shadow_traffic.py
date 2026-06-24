"""影子流量 (建议 120).

设计:
  - ShadowRouter: 同时打"主"和"影子"两条请求, 收集响应做异步比对
  - 比率: ZHS_SHADOW_TRAFFIC_RATIO (默认 0.0, 关闭)
  - 影子租户: ZHS_SHADOW_TENANT_ID (默认 2, 影子租户)
  - 路由策略: 1% / 5% / 10% 流量打影子, 可动态调
  - 主请求完全不受影响: 影子请求异步 fire-and-forget, 不阻塞主响应
  - 指标:
      zhs_shadow_compare_total{tenant_id, result}  # result: match/mismatch/skip/error
      zhs_shadow_compare_mismatch_total{tenant_id, diff_kind}
      zhs_shadow_request_duration_seconds (histogram)
  - 比对维度:
      status_code (HTTP 状态码)
      body_hash (响应体 sha256, 内容等价)
      json_keys (字段集合, schema 一致)
      list_length (列表型响应, 数量级一致)
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import os
import random
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------


def _ratio() -> float:
    try:
        return float(os.getenv("ZHS_SHADOW_TRAFFIC_RATIO", "0"))
    except Exception:
        return 0.0


def _shadow_tenant_id() -> int:
    try:
        return int(os.getenv("ZHS_SHADOW_TENANT_ID", "2"))
    except Exception:
        return 2


def _enabled() -> bool:
    return _ratio() > 0


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


class DiffKind(StrEnum):
    """差异类型分级 (与建议 119 告警配合)."""

    MATCH = "match"  # 完全一致
    MISMATCH_STATUS = "status"  # 状态码不一致
    MISMATCH_BODY = "body"  # 响应体 hash 不一致
    MISMATCH_KEYS = "keys"  # JSON 字段集不一致
    MISMATCH_LENGTH = "length"  # 列表长度不一致 (数量级)
    ERROR_MAIN = "error_main"  # 主请求异常
    ERROR_SHADOW = "error_shadow"  # 影子请求异常
    SKIP = "skip"  # 跳过 (配置 / 类型不匹配)


@dataclass
class ShadowResponse:
    """一个响应的快照 (用于异步比对)."""

    status_code: int = 0
    body: Any = None  # bytes / dict / list / str
    elapsed_ms: float = 0.0
    error: BaseException | None = None


@dataclass
class ShadowCompare:
    """一次比对的完整记录."""

    compare_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    timestamp: float = field(default_factory=time.time)
    endpoint: str = ""
    tenant_id: str = "anonymous"
    diff_kind: DiffKind = DiffKind.MATCH
    main_status: int = 0
    shadow_status: int = 0
    main_hash: str = ""
    shadow_hash: str = ""
    main_keys: tuple = ()
    shadow_keys: tuple = ()
    main_length: int = 0
    shadow_length: int = 0
    elapsed_ms: float = 0.0


# ---------------------------------------------------------------------------
# 指标 (与建议 119 告警 zhs_shadow_compare_total 配套)
# ---------------------------------------------------------------------------

try:
    from prometheus_client import Counter, Histogram

    SHADOW_COMPARE_TOTAL = Counter(
        "zhs_shadow_compare_total",
        "Shadow traffic compare total (建议 120, 配合建议 119 告警)",
        ["tenant_id", "diff_kind"],
    )

    SHADOW_COMPARE_MISMATCH_TOTAL = Counter(
        "zhs_shadow_compare_mismatch_total",
        "Shadow traffic mismatch total by diff kind (建议 120)",
        ["tenant_id", "diff_kind"],
    )

    SHADOW_REQUEST_DURATION = Histogram(
        "zhs_shadow_request_duration_seconds",
        "Shadow request duration in seconds (建议 120)",
        ["tenant_id"],
        buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
    )
except Exception:  # prometheus_client 不可用
    SHADOW_COMPARE_TOTAL = None
    SHADOW_COMPARE_MISMATCH_TOTAL = None
    SHADOW_REQUEST_DURATION = None


# ---------------------------------------------------------------------------
# 比对逻辑
# ---------------------------------------------------------------------------


def _hash_body(body: Any) -> str:
    if body is None:
        return ""
    if isinstance(body, (bytes, bytearray)):
        data = bytes(body)
    elif isinstance(body, str):
        data = body.encode("utf-8")
    elif isinstance(body, (dict, list)):
        try:
            data = json.dumps(body, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
        except Exception:
            data = str(body).encode("utf-8")
    else:
        data = str(body).encode("utf-8")
    return hashlib.sha256(data).hexdigest()[:16]


def _json_keys(body: Any) -> tuple:
    if isinstance(body, dict):
        return tuple(sorted(body.keys()))
    if isinstance(body, list):
        if body and isinstance(body[0], dict):
            return tuple(sorted(body[0].keys()))
        return ()
    return ()


def _list_length(body: Any) -> int:
    if isinstance(body, list):
        return len(body)
    return 0


def _normalize_for_compare(body: Any) -> Any:
    """剥除易变字段 (时间戳 / 随机 ID), 让比对更稳."""
    if not isinstance(body, (dict, list)):
        return body
    try:
        s = json.dumps(body, sort_keys=True, ensure_ascii=False, default=str)
    except Exception:
        return body
    # 屏蔽常见易变字段 (key+value 一起替换, 不留 value 干扰)
    import re

    for key in ("timestamp", "ts", "request_id", "trace_id", "x-trace-id", "server_time", "_normalized_"):
        # 形如 "key": "value" 或 "key": number
        s = re.sub(
            rf'"{re.escape(key)}"\s*:\s*("[^"]*"|\d+(?:\.\d+)?|true|false|null)',
            f'"{key}":"__NORMALIZED__"',
            s,
        )
    try:
        return json.loads(s)
    except Exception:
        return body


def compare_responses(
    main: ShadowResponse, shadow: ShadowResponse, endpoint: str = "", tenant_id: str = "anonymous"
) -> ShadowCompare:
    """比对两个响应, 输出 ShadowCompare 记录."""
    result = ShadowCompare(endpoint=endpoint, tenant_id=tenant_id)

    # 1) 异常
    if main.error is not None and shadow.error is None:
        result.diff_kind = DiffKind.ERROR_MAIN
    elif main.error is None and shadow.error is not None:
        result.diff_kind = DiffKind.ERROR_SHADOW
    elif main.error is not None and shadow.error is not None:
        result.diff_kind = DiffKind.MISMATCH_STATUS
    else:
        result.main_status = main.status_code
        result.shadow_status = shadow.status_code
        # 2) 状态码
        if main.status_code != shadow.status_code:
            result.diff_kind = DiffKind.MISMATCH_STATUS
        else:
            # 3) body hash
            main_body = _normalize_for_compare(main.body)
            shadow_body = _normalize_for_compare(shadow.body)
            result.main_hash = _hash_body(main_body)
            result.shadow_hash = _hash_body(shadow_body)
            if result.main_hash != result.shadow_hash:
                # 字段集 / 长度也记录, 便于定位
                result.main_keys = _json_keys(main_body)
                result.shadow_keys = _json_keys(shadow_body)
                result.main_length = _list_length(main_body)
                result.shadow_length = _list_length(shadow_body)

                if result.main_keys != result.shadow_keys:
                    result.diff_kind = DiffKind.MISMATCH_KEYS
                elif result.main_length != result.shadow_length and result.main_length > 0:
                    result.diff_kind = DiffKind.MISMATCH_LENGTH
                else:
                    result.diff_kind = DiffKind.MISMATCH_BODY
            else:
                result.diff_kind = DiffKind.MATCH

    # 4) 写指标
    if SHADOW_COMPARE_TOTAL is not None:
        try:
            SHADOW_COMPARE_TOTAL.labels(
                tenant_id=tenant_id,
                diff_kind=result.diff_kind.value,
            ).inc()
            if result.diff_kind != DiffKind.MATCH and result.diff_kind != DiffKind.SKIP:
                SHADOW_COMPARE_MISMATCH_TOTAL.labels(
                    tenant_id=tenant_id,
                    diff_kind=result.diff_kind.value,
                ).inc()
        except Exception:
            pass

    return result


# ---------------------------------------------------------------------------
# ShadowRouter: 调度 + 异步比对
# ---------------------------------------------------------------------------

# type alias: 一个请求的"执行器"接收任意参数, 返回 ShadowResponse
RequestExecutor = Callable[..., Awaitable[ShadowResponse]]


class ShadowRouter:
    """调度器: 在主请求之外异步打影子请求, 比对响应.

    用法:
        router = ShadowRouter(ratio=0.1, shadow_tenant_id=2)

        async def main_handler(request, ...):
            return ShadowResponse(status_code=200, body={"ok": True})

        async def shadow_handler(request, ...):
            return ShadowResponse(status_code=200, body={"ok": True})

        compare = await router.run(
            main_fn=main_handler,
            shadow_fn=shadow_handler,
            endpoint="GET /api/v1/orders",
            tenant_id="1",
            args_main=(req,),
            args_shadow=(shadow_req,),
        )
    """

    def __init__(self, ratio: float | None = None, shadow_tenant_id: int | None = None):
        self.ratio = ratio if ratio is not None else _ratio()
        self.shadow_tenant_id = shadow_tenant_id if shadow_tenant_id is not None else _shadow_tenant_id()
        # 历史比对结果环形缓冲 (供监控 / 排障)
        self._history: list[ShadowCompare] = []
        self._history_max = 1000
        self._lock = asyncio.Lock()
        # 后台比对 task 引用集合, 防止被 GC 回收
        self._pending_tasks: set = set()

    def should_shadow(self) -> bool:
        """本请求是否要打影子."""
        if self.ratio <= 0:
            return False
        return random.random() < self.ratio

    def should_shadow_endpoint(self, method: str, path: str) -> bool:
        """综合判定: 配比 * 白名单.

        流程:
          1. 配比 = 0 → False
          2. 白名单未通过 → False (写操作 / 敏感接口)
          3. 随机数 < 配比 → True
        """
        if self.ratio <= 0:
            return False
        # 接入建议 122 白名单
        try:
            from app.shadow_whitelist import get_default_whitelist

            wl = get_default_whitelist()
            if not wl.should_shadow_endpoint(method, path):
                return False
        except Exception:
            # 白名单模块未就绪, 不影响
            pass
        return random.random() < self.ratio

    async def run(
        self,
        main_fn: RequestExecutor,
        shadow_fn: RequestExecutor,
        endpoint: str,
        tenant_id: str,
        args_main: tuple = (),
        kwargs_main: dict | None = None,
        args_shadow: tuple = (),
        kwargs_shadow: dict | None = None,
        timeout: float = 10.0,
    ) -> ShadowCompare:
        """跑主请求 + 影子请求, 比对响应.

        主请求先 await, 影子请求 fire-and-forget (后台 task), 不阻塞主响应.
        比对结果通过回调 / 推入 history 暴露.
        """
        kwargs_main = kwargs_main or {}
        kwargs_shadow = kwargs_shadow or {}

        # 1) 跑主请求 (阻塞, 业务路径)
        main_resp = await main_fn(*args_main, **kwargs_main)

        # 2) 跑影子请求 (后台 task, 不阻塞)
        async def _shadow_then_compare():
            # 主请求返回 None 时无法比对, 跳过并记录
            if main_resp is None:
                logger.warning(
                    f"[shadow] main_resp is None, skip compare: endpoint={endpoint} tenant_id={tenant_id}"
                )
                return None
            try:
                t0 = time.time()
                shadow_resp = await asyncio.wait_for(shadow_fn(*args_shadow, **kwargs_shadow), timeout=timeout)
                shadow_resp.elapsed_ms = (time.time() - t0) * 1000
                cmp = compare_responses(main_resp, shadow_resp, endpoint=endpoint, tenant_id=tenant_id)
                if SHADOW_REQUEST_DURATION is not None:
                    with contextlib.suppress(Exception):
                        SHADOW_REQUEST_DURATION.labels(tenant_id=tenant_id).observe(shadow_resp.elapsed_ms / 1000)
                await self._record(cmp)
                return cmp
            except Exception as e:
                # 影子请求失败也要记录 (不抛到主流程)
                cmp = compare_responses(main_resp, ShadowResponse(error=e), endpoint=endpoint, tenant_id=tenant_id)
                await self._record(cmp)
                return cmp

        # 影子异步启动 (主流程不等); 保留 task 引用防止被 GC 回收
        task = asyncio.create_task(_shadow_then_compare())
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)

        # 即刻返回 (主响应继续走)
        return ShadowCompare(
            endpoint=endpoint,
            tenant_id=tenant_id,
            diff_kind=DiffKind.SKIP,  # 主响应不阻塞, 比对在后台
            main_status=main_resp.status_code,
        )

    async def _record(self, cmp: ShadowCompare) -> None:
        async with self._lock:
            self._history.append(cmp)
            if len(self._history) > self._history_max:
                self._history = self._history[-self._history_max :]

    def get_history(self, last: int = 50) -> list[dict]:
        """返回最近 N 次比对记录 (排障用)."""
        out = []
        for c in self._history[-last:]:
            out.append(
                {
                    "compare_id": c.compare_id,
                    "timestamp": c.timestamp,
                    "endpoint": c.endpoint,
                    "tenant_id": c.tenant_id,
                    "diff_kind": c.diff_kind.value,
                    "main_status": c.main_status,
                    "shadow_status": c.shadow_status,
                    "main_hash": c.main_hash,
                    "shadow_hash": c.shadow_hash,
                    "main_keys": list(c.main_keys),
                    "shadow_keys": list(c.shadow_keys),
                    "main_length": c.main_length,
                    "shadow_length": c.shadow_length,
                }
            )
        return out

    def get_history_snapshot(self) -> list[ShadowCompare]:
        """返回 _history 的浅拷贝快照 (供外部聚合器增量读取, 避免直接访问私有属性).

        返回 list(self._history) 的副本, 调用方对其修改不影响内部状态.
        """
        return list(self._history)

    def get_stats(self) -> dict:
        """聚合统计 (近 history_max 次)."""
        if not self._history:
            return {"total": 0, "match": 0, "mismatch": 0, "by_kind": {}}
        by_kind: dict[str, int] = {}
        match = 0
        mismatch = 0
        for c in self._history:
            k = c.diff_kind.value
            by_kind[k] = by_kind.get(k, 0) + 1
            if c.diff_kind == DiffKind.MATCH:
                match += 1
            elif c.diff_kind != DiffKind.SKIP:
                mismatch += 1
        return {
            "total": len(self._history),
            "match": match,
            "mismatch": mismatch,
            "match_rate": match / len(self._history),
            "by_kind": by_kind,
        }

    def clear_history(self) -> None:
        self._history.clear()


# ---------------------------------------------------------------------------
# 全局默认 router
# ---------------------------------------------------------------------------

_DEFAULT_ROUTER: ShadowRouter | None = None


def get_default_router() -> ShadowRouter:
    global _DEFAULT_ROUTER
    if _DEFAULT_ROUTER is None:
        _DEFAULT_ROUTER = ShadowRouter()
    return _DEFAULT_ROUTER


def reset_default_router() -> None:
    global _DEFAULT_ROUTER
    _DEFAULT_ROUTER = None
