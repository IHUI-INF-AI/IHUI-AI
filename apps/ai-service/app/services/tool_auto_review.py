# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Auto 档逐工具授权审查闸(2026-11-14 立,对标 DSH experimental-auto-review)。

与 `guardian_review` 的分工:
- guardian 只回答"有没有更安全的等价路径",结论是**给用户看的建议**,不改变执行;
- 本模块回答"这个调用能不能在无人确认的情况下执行",结论是**闸门**:
  `allow` 放行 / `deny` 拒绝 / `escalate` 交回人工审批。

安全地板(任何一条不满足都不得自动放行):
1. 默认 OFF(env `TOOL_AUTO_REVIEW_ENABLED`),只在 `permission_mode=acceptEdits`
   且原本判定"需人工审批"时被调用;
2. 独立请求(复用 guardian 的 `default_guardian_judge`,零执行链上下文);
3. 网关 stub / 超时 / 异常 / JSON 不合合同 ⇒ 一律 `escalate`(fail-closed);
4. 本地静态扫描 `scan_tool_args` 命中 dangerous ⇒ 即使模型说 allow 也降级为
   `escalate`(模型结论不豁免既有安全链);
5. 只缓存确定性的 allow/deny,escalate 是瞬时态,不缓存。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from collections import OrderedDict
from dataclasses import dataclass, replace
from typing import Any, Final, Literal, cast

from .completion_verification import JudgeCall, JudgeResponse
from .guardian_review import (
    GuardianJudgeUnavailable,
    default_guardian_judge,
    summarize_impact,
)
from .tool_input_scanner import scan_tool_args

logger = logging.getLogger(__name__)

AutoReviewDecision = Literal["allow", "deny", "escalate"]

_DECISIONS: Final = frozenset({"allow", "deny", "escalate"})
_RISKS: Final = frozenset({"low", "medium", "high"})

_DEFAULT_TIMEOUT_S: Final = 5.0
_MAX_TIMEOUT_S: Final = 20.0
_DEFAULT_CACHE_MAX: Final = 200
_ARGS_SUMMARY_MAX_CHARS: Final = 1500

AutoReviewJudge = JudgeCall


class AutoReviewResponseInvalid(RuntimeError):
    """审查响应回了东西,但不满足 JSON 合同。"""


def auto_review_enabled_from_env() -> bool:
    """总开关:默认 OFF。"""
    return os.environ.get("TOOL_AUTO_REVIEW_ENABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def auto_review_timeout_s_from_env() -> float:
    """审查超时(默认 5s,封顶 20s):审查不得把工具执行拖成秒级卡顿。"""
    raw = os.environ.get("TOOL_AUTO_REVIEW_TIMEOUT_S", "")
    try:
        value = float(raw)
    except ValueError:
        return _DEFAULT_TIMEOUT_S
    if value <= 0:
        return _DEFAULT_TIMEOUT_S
    return min(value, _MAX_TIMEOUT_S)


def auto_review_cache_max_from_env() -> int:
    raw = os.environ.get("TOOL_AUTO_REVIEW_CACHE_MAX", "")
    try:
        value = int(raw)
    except ValueError:
        return _DEFAULT_CACHE_MAX
    return max(0, min(value, 2000))


@dataclass(frozen=True)
class AutoReviewResult:
    decision: AutoReviewDecision
    reason: str
    risk: str | None = None
    reviewer_model: str | None = None
    independent_request_made: bool = False
    cached: bool = False
    fail_reason: str | None = None
    latency_ms: float = 0.0

    def to_event_payload(self) -> dict[str, Any]:
        """挂到 tool.approval / tool-result 上的可选键(缺席 = 未启用审查)。"""
        return {
            "decision": self.decision,
            "reason": self.reason,
            "risk": self.risk,
            "reviewer_model": self.reviewer_model,
            "independent_request_made": self.independent_request_made,
            "cached": self.cached,
            "fail_reason": self.fail_reason,
            "latency_ms": self.latency_ms,
        }


def _escalate(
    reason: str,
    *,
    fail_reason: str | None = None,
    latency_ms: float = 0.0,
) -> AutoReviewResult:
    """所有失败路径的唯一出口:必须交回人工,不许折叠成 allow。"""
    return AutoReviewResult(
        decision="escalate",
        reason=reason,
        fail_reason=fail_reason,
        independent_request_made=False,
        latency_ms=latency_ms,
    )


_SYSTEM_PROMPT: Final = (
    "你是工具执行的独立授权审查器,与提出该调用的执行链无关。"
    "输入是一次原本需要人工确认的工具调用:工具名、参数摘要、影响面。"
    "判断它能否在无人确认的情况下执行。只输出一个 JSON 对象,不要输出其他文字,合同:\n"
    '{"decision": "allow"|"deny"|"escalate", "reason": "一句话理由", '
    '"risk": "low"|"medium"|"high"}\n'
    "规则:只读、可逆、作用域明确的调用可以 allow;删除/覆盖/外送数据/提权/不可逆"
    "或影响面不确定时 deny 或 escalate;没有把握一律 escalate;"
    "不得因为'看起来无害'而 allow。"
)


def build_auto_review_messages(
    tool_name: str, args: dict[str, Any]
) -> list[dict[str, str]]:
    """独立请求的消息面:只含本次调用本身,不携带对话历史/推理/自述。"""
    try:
        args_summary = json.dumps(args, ensure_ascii=False, sort_keys=True, default=str)
    except (TypeError, ValueError):
        args_summary = str(args)
    if len(args_summary) > _ARGS_SUMMARY_MAX_CHARS:
        args_summary = args_summary[:_ARGS_SUMMARY_MAX_CHARS] + "…"
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"{summarize_impact(tool_name, args)}\n参数摘要(截断): {args_summary}",
        },
    ]


def parse_auto_review_verdict(content: str) -> tuple[AutoReviewDecision, str, str | None]:
    """严格解析;不满足合同即 raise(调用方统一 escalate)。"""
    text = content.strip()
    if text.startswith("```"):
        first_nl = text.find("\n")
        if first_nl >= 0:
            text = text[first_nl + 1 :]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[: -len("```")]
        text = text.strip()
    try:
        parsed: Any = json.loads(text)
    except (TypeError, ValueError) as exc:
        raise AutoReviewResponseInvalid(f"响应不是合法 JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise AutoReviewResponseInvalid("响应顶层不是 JSON 对象")
    decision = parsed.get("decision")
    if not isinstance(decision, str) or decision not in _DECISIONS:
        raise AutoReviewResponseInvalid("decision 缺失或不在 allow/deny/escalate 内")
    reason = parsed.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise AutoReviewResponseInvalid("reason 缺失或为空")
    risk = parsed.get("risk")
    if risk is not None and (not isinstance(risk, str) or risk not in _RISKS):
        raise AutoReviewResponseInvalid("risk 不在 low/medium/high 内")
    return cast("AutoReviewDecision", decision), reason.strip(), risk


def auto_review_cache_key(tool_name: str, args: dict[str, Any]) -> str:
    """缓存键:工具 + 规范化参数 + 合同版本;参数无关内容不参与。"""
    try:
        payload = json.dumps(
            {"v": 1, "tool": tool_name, "args": args},
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        )
    except (TypeError, ValueError):
        payload = f"v=1|tool={tool_name}|args={args!r}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


_CACHE: "OrderedDict[str, AutoReviewResult]" = OrderedDict()


def clear_auto_review_cache() -> None:
    """测试/配置变更时清空缓存。"""
    _CACHE.clear()


def _cache_get(key: str) -> AutoReviewResult | None:
    hit = _CACHE.get(key)
    if hit is not None:
        _CACHE.move_to_end(key)
    return hit


def _cache_put(key: str, result: AutoReviewResult, max_size: int) -> None:
    if max_size <= 0:
        return
    _CACHE[key] = result
    _CACHE.move_to_end(key)
    while len(_CACHE) > max_size:
        _CACHE.popitem(last=False)


async def request_tool_auto_review(
    tool_name: str,
    args: dict[str, Any],
    *,
    judge: AutoReviewJudge | None = None,
    enabled: bool | None = None,
    timeout_s: float | None = None,
    cache_max: int | None = None,
) -> AutoReviewResult:
    """跑一次自动授权审查。任何失败分支都返回 `escalate` + 原因。"""
    t0 = time.monotonic()

    def _latency() -> float:
        return round((time.monotonic() - t0) * 1000.0, 3)

    if enabled is None:
        enabled = auto_review_enabled_from_env()
    if not enabled:
        return _escalate("自动审查未开启", fail_reason="disabled", latency_ms=_latency())

    key = auto_review_cache_key(tool_name, args)
    cached = _cache_get(key)
    if cached is not None:
        return replace(cached, cached=True, latency_ms=_latency())

    limit = (
        auto_review_timeout_s_from_env()
        if timeout_s is None
        else max(0.1, min(float(timeout_s), _MAX_TIMEOUT_S))
    )
    call: AutoReviewJudge = judge if judge is not None else default_guardian_judge
    messages = build_auto_review_messages(tool_name, args)

    try:
        resp: JudgeResponse = await asyncio.wait_for(call(messages), timeout=limit)
    except TimeoutError:
        logger.warning("auto-review 超时(%.1fs),交回人工: tool=%s", limit, tool_name)
        return _escalate("审查超时,交回人工确认", fail_reason="timeout", latency_ms=_latency())
    except GuardianJudgeUnavailable as exc:
        logger.warning("auto-review 不可用(%s): tool=%s %s", exc.reason, tool_name, exc)
        return _escalate("审查通道不可用,交回人工确认", fail_reason=exc.reason, latency_ms=_latency())
    except Exception as exc:  # noqa: BLE001 - 统一收敛为 escalate
        logger.warning("auto-review 异常,交回人工: tool=%s %s", tool_name, exc)
        return _escalate("审查异常,交回人工确认", fail_reason="gateway_error", latency_ms=_latency())

    try:
        decision, reason, risk = parse_auto_review_verdict(resp.content)
    except AutoReviewResponseInvalid as exc:
        logger.warning("auto-review 响应不合合同,交回人工: tool=%s %s", tool_name, exc)
        return _escalate(
            "审查响应不可解析,交回人工确认",
            fail_reason="malformed_response",
            latency_ms=_latency(),
        )

    # 静态扫描是本地确定性证据:模型 allow 也不能越过它。
    scan = scan_tool_args(args, tool_name=tool_name)
    if decision == "allow" and scan.dangerous:
        return _escalate(
            "静态扫描命中高危模式,不允许自动放行",
            fail_reason="static_scan_dangerous",
            latency_ms=_latency(),
        )

    result = AutoReviewResult(
        decision=decision,
        reason=reason,
        risk=risk,
        reviewer_model=resp.model,
        independent_request_made=True,
        latency_ms=_latency(),
    )
    if decision in ("allow", "deny"):
        _cache_put(
            key,
            replace(result, latency_ms=0.0, cached=False),
            auto_review_cache_max_from_env() if cache_max is None else max(0, cache_max),
        )
    return result


__all__ = [
    "AutoReviewDecision",
    "AutoReviewJudge",
    "AutoReviewResponseInvalid",
    "AutoReviewResult",
    "auto_review_cache_key",
    "auto_review_cache_max_from_env",
    "auto_review_enabled_from_env",
    "auto_review_timeout_s_from_env",
    "build_auto_review_messages",
    "clear_auto_review_cache",
    "parse_auto_review_verdict",
    "request_tool_auto_review",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
