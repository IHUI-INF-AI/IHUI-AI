# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Guardian 独立复核代理(V3 #80,2026-09-27 立)。

用户点 approve **之前**,由一条与执行链完全独立的复核请求判断:这个高危操作
是否存在**更安全的等价路径**(只读替代 / 更窄权限 / 更小删除面 / 可逆形式)。

独立性口径(与 completion_verification 的独立校验轮同一套标准):
- 复核走 `llm_gateway.complete` **另起一次独立请求**,消息面只含本模块构造的
  最小输入(工具名 + 参数摘要 + 影响面),**不携带**被复核那条链的任何上下文
  (执行者的对话历史 / 推理 / 自述都不进提示词);
- 网关 stub 模式(无凭据自答)**不构成独立判定** —— 一律落 `not_reviewed`,
  绝不因为"回了东西"就出合格证(与 completion_verification._default_judge_call
  的 stub 判据同源)。

三态是本协议的全部价值(本仓最高频失效型是"把没判写成判过了"):
- `reviewed_no_alternative`  = 真复核了,未提出更安全路径;
- `reviewed_alternative_found` = 真复核了,提出了建议;`safer_alternative.applicable`
  标出建议是否通过确定性校验、可被机器执行;
- `not_reviewed`             = 没有复核(开关关 / 超时 / 无凭据 / 网关错误 / 响应
  不可解析),**必须**带 `unavailable_reason`,调用方与用户可分辨。
  任何失败分支都不得折叠进前两个状态。

替代路径的执行边界(确定性、服务端说了算):
- 复核代理只被允许提出**同一工具**的更窄参数;换工具的建议在服务端直接丢弃
  (payload 里仍给叙述,但不适用);
- 建议参数必须再过一遍本地静态扫描 `tool_input_scanner.scan_tool_args`,自身
  仍危险即 `applicable=False`(模型"建议"不豁免既有安全链);
- 只有用户**明确勾选**改用替代(`accept_alternative`,默认 False=维持原请求)
  且建议 applicable,执行参数才会被替换。

开关默认 OFF(env `GUARDIAN_REVIEW_ENABLED=1` 开启),与 guarded_tool_pipeline
"全部开关默认 off ⇒ 行为零变化"同形态;但**关闭时调用出口依然被调用**并返回
显式 `not_reviewed("disabled")` —— 关掉的是复核,不是三态。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Final, Literal, cast

from .completion_verification import JudgeCall, JudgeResponse
from .tool_input_scanner import scan_tool_args

logger = logging.getLogger(__name__)

# ---------------- 三态状态常量(字面量是线协议,不得改动) ----------------

GUARDIAN_REVIEW_STATUS_NOT_REVIEWED: Final = "not_reviewed"
GUARDIAN_REVIEW_STATUS_NO_ALTERNATIVE: Final = "reviewed_no_alternative"
GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND: Final = "reviewed_alternative_found"

GuardianReviewStatus = Literal[
    "not_reviewed", "reviewed_no_alternative", "reviewed_alternative_found"
]

# not_reviewed 的机器可读原因(封闭集;新增取值属协议变更)。
GuardianUnavailableReason = Literal[
    "disabled",  # 开关未开(默认态)
    "timeout",  # 复核请求超时
    "no_credentials",  # 网关 stub 模式 = 本机无可用凭据,未发生真实推理
    "gateway_error",  # 网关抛错 / 返回形态不可用
    "malformed_response",  # 回了东西但不是可校验的 JSON 合同
]

# ---------------- 配置出口(env,与 TOOL_APPROVAL_* 同形态) ----------------

_DEFAULT_REVIEW_TIMEOUT_S: Final = 8.0
# 复核上限刻意小于审批默认等待(60s):复核不得把弹窗拖成摆设。
_MAX_REVIEW_TIMEOUT_S: Final = 30.0

# 进提示词/回传的摘要尺寸上限
_ARGS_SUMMARY_MAX_CHARS: Final = 1500
_EVENT_PREVIEW_MAX_CHARS: Final = 200
_ALTERNATIVE_MAX_JSON_CHARS: Final = 4000


def guardian_review_enabled_from_env() -> bool:
    """总开关:默认 OFF。env GUARDIAN_REVIEW_ENABLED ∈ 1/true/yes/on 开启。"""
    return os.environ.get("GUARDIAN_REVIEW_ENABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def guardian_review_timeout_s_from_env() -> float:
    """复核超时(env GUARDIAN_REVIEW_TIMEOUT_S,默认 8s,封顶 30s)。"""
    raw = os.environ.get("GUARDIAN_REVIEW_TIMEOUT_S", "")
    try:
        value = float(raw)
    except ValueError:
        return _DEFAULT_REVIEW_TIMEOUT_S
    if value <= 0:
        return _DEFAULT_REVIEW_TIMEOUT_S
    return min(value, _MAX_REVIEW_TIMEOUT_S)


_UNAVAILABLE_REASONS: Final = frozenset(
    {"disabled", "timeout", "no_credentials", "gateway_error", "malformed_response"}
)

# ---------------- 异常(失败一律显式,不静默) ----------------


class GuardianJudgeUnavailable(RuntimeError):
    """复核请求本身不可用;reason 归一到 GuardianUnavailableReason 封闭集内。"""

    def __init__(self, reason: str, detail: str = "") -> None:
        super().__init__(detail or reason)
        normalized = reason if reason in _UNAVAILABLE_REASONS else "gateway_error"
        self.reason: GuardianUnavailableReason = cast(
            "GuardianUnavailableReason", normalized
        )


class GuardianResponseInvalid(RuntimeError):
    """复核回了东西,但不满足 JSON 合同。"""

# ---------------- 结果结构 ----------------


@dataclass(frozen=True)
class SaferAlternative:
    """复核代理提出的更安全等价路径(仅同工具、更窄参数)。"""

    tool_name: str
    args: dict[str, Any]
    rationale: str
    applicable: bool
    rejected_reason: str | None = None

    def to_event_payload(self) -> dict[str, Any]:
        """事件面只带预览(与 args_preview 截断 200 的既有口径一致),不带全量参数。"""
        try:
            preview = json.dumps(self.args, ensure_ascii=False)[:_EVENT_PREVIEW_MAX_CHARS]
        except (TypeError, ValueError):
            preview = str(self.args)[:_EVENT_PREVIEW_MAX_CHARS]
        return {
            "tool_name": self.tool_name,
            "args_preview": preview,
            "rationale": self.rationale,
            "applicable": self.applicable,
            "rejected_reason": self.rejected_reason,
        }


@dataclass(frozen=True)
class GuardianReviewResult:
    """一次复核的三态结论。status=not_reviewed 时 unavailable_reason 必非空。"""

    status: GuardianReviewStatus
    unavailable_reason: GuardianUnavailableReason | None = None
    summary: str | None = None
    risk_note: str | None = None
    alternative: SaferAlternative | None = None
    reviewer_model: str | None = None
    independent_request_made: bool = False
    latency_ms: float = 0.0

    @property
    def reviewed(self) -> bool:
        return self.status != GUARDIAN_REVIEW_STATUS_NOT_REVIEWED

    def applicable_alternative(self, tool_name: str) -> SaferAlternative | None:
        """仅当"复核判有更安全路径 + 建议通过确定性校验 + 工具名与执行对象一致"时返回。"""
        alt = self.alternative
        if (
            self.status != GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND
            or alt is None
            or not alt.applicable
            or alt.tool_name != tool_name
        ):
            return None
        return alt

    def to_event_payload(self) -> dict[str, Any]:
        """给 tool.approval 事件的载荷。

        形状锁(由守门 check-guardian-review-wired 判据钉死):返回值**永远**含
        "status" 与 "unavailable_reason" 两键 —— 缺席与"无风险"必须可分辨,
        未复核态永远带原因。
        """
        payload: dict[str, Any] = {
            "status": self.status,
            "unavailable_reason": self.unavailable_reason,
            "summary": self.summary,
            "risk_note": self.risk_note,
            "independent_request_made": self.independent_request_made,
            "reviewer_model": self.reviewer_model,
            "latency_ms": self.latency_ms,
        }
        if self.alternative is not None:
            payload["safer_alternative"] = self.alternative.to_event_payload()
        return payload


def _not_reviewed(
    reason: GuardianUnavailableReason, *, latency_ms: float = 0.0
) -> GuardianReviewResult:
    """not_reviewed 的唯一构造口:任何失败路径都从这里出,保证带原因、不折叠。"""
    return GuardianReviewResult(
        status=GUARDIAN_REVIEW_STATUS_NOT_REVIEWED,
        unavailable_reason=reason,
        independent_request_made=False,
        latency_ms=latency_ms,
    )


def unavailable_review(reason: str, *, latency_ms: float = 0.0) -> GuardianReviewResult:
    """调用方兜底出口:复核调用自身抛异常时构造**显式**未复核结论。

    存在的意义:审批链不得被复核拖崩(弹窗仍要发),但"没判"必须原样标成
    not_reviewed + 原因 —— 冒泡会杀掉审批,折叠成"无风险"会骗过用户,两条都不许。
    """
    normalized = reason if reason in _UNAVAILABLE_REASONS else "gateway_error"
    return _not_reviewed(cast("GuardianUnavailableReason", normalized), latency_ms=latency_ms)


# ---------------- 复核输入(判据输入 = 工具名 + 参数摘要 + 影响面) ----------------


def _clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "…"


def summarize_impact(tool_name: str, args: dict[str, Any]) -> str:
    """确定性影响面摘要(本地静态扫描,不经模型)。

    把既有 tool_input_scanner 的命中类别作为"机器风险线索"喂给复核代理,
    同时列出入参字段名 —— 复核的输入必须包含影响面,而这里的影响面全部来自
    被复核的那次调用本身,不来自执行链上下文。
    """
    scan = scan_tool_args(args, tool_name=tool_name)
    kinds = sorted(scan.kinds)
    keys = sorted(str(k) for k in args)
    lines = [
        f"工具: {tool_name}",
        f"入参字段: {', '.join(keys) if keys else '(无)'}",
        f"静态扫描: dangerous={scan.dangerous}" + (f" 命中={kinds}" if kinds else ""),
    ]
    for f in scan.findings[:5]:
        lines.append(f"  - [{f.kind}] {f.field}: {f.value}")
    return "\n".join(lines)


def build_review_messages(tool_name: str, args: dict[str, Any]) -> list[dict[str, str]]:
    """构造复核提示词(独立请求,零上下文)。"""
    try:
        args_summary = json.dumps(args, ensure_ascii=False, sort_keys=True, default=str)
    except (TypeError, ValueError):
        args_summary = str(args)
    args_summary = _clip(args_summary, _ARGS_SUMMARY_MAX_CHARS)
    user_block = (
        f"{summarize_impact(tool_name, args)}\n"
        f"参数摘要(截断): {args_summary}"
    )
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_block},
    ]


_SYSTEM_PROMPT: Final = (
    "你是高危操作审批前的独立安全复核代理,与提出该操作的那条执行链无关。"
    "输入是一次待审批的工具调用:工具名、参数摘要、影响面。"
    "判断它是否存在更安全的等价路径:只读替代、更窄权限、更小的删除面、可逆形式。\n"
    "只输出一个 JSON 对象,不要输出任何其他文字,合同:\n"
    '{"has_safer_path": true|false, '
    '"safer_summary": "给用户看的一句话建议(没有更安全路径时为空字符串)", '
    '"alternative": {"args": {同一工具的建议参数对象}, "rationale": "为什么更安全"} 或 null, '
    '"risk_note": "维持原请求需要注意的风险(可为空字符串)"}\n'
    "规则:alternative 只允许是**同一个工具**的更窄/可逆参数,不得建议换用其他工具;"
    "没有把握时 alternative 给 null;has_safer_path=false 时 safer_summary 与 alternative 均为空/null;"
    "不得以'该操作大概无害'为由虚构 has_safer_path。"
)


# ---------------- 复核出口(默认走 llm_gateway 独立请求;可注入) ----------------

GuardianJudge = JudgeCall  # 注入点类型与 completion_verification 的 judge 同形


async def default_guardian_judge(messages: list[dict[str, str]]) -> JudgeResponse:
    """默认复核通道:经 llm_gateway 另起一次独立请求。

    延迟 import —— 本模块要能在无 AI 凭据/无网络的环境里被 import 与单测
    (与 completion_verification._default_judge_call 同一动机与口径)。
    """
    from ..core.llm_gateway import llm_gateway

    try:
        resp = await llm_gateway.complete(messages, temperature=0.0, max_tokens=512)
    except GuardianJudgeUnavailable:
        raise
    except Exception as exc:
        raise GuardianJudgeUnavailable(
            "gateway_error", f"{type(exc).__name__}: {exc}"
        ) from exc
    if not isinstance(resp, dict):
        raise GuardianJudgeUnavailable("gateway_error", f"网关返回非对象: {type(resp).__name__}")
    # stub 模式(无凭据时网关自答 stub)不构成独立判定,必须当成不可用
    if resp.get("stub"):
        raise GuardianJudgeUnavailable("no_credentials", "网关处于 stub 模式,未发生真实推理")
    content = resp.get("content")
    if not isinstance(content, str) or not content.strip():
        raise GuardianJudgeUnavailable("gateway_error", "网关返回空 content")
    model = resp.get("model")
    return JudgeResponse(content=content, model=model if isinstance(model, str) else None)


# ---------------- 响应解析与确定性校验 ----------------


def parse_guardian_verdict(content: str) -> dict[str, Any]:
    """把复核代理的回复解析成结构化裁定;不满足合同即 raise(不降级成"无风险")。"""
    text = content.strip()
    # 容忍 ```json ... ``` 围栏包裹
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
        raise GuardianResponseInvalid(f"响应不是合法 JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise GuardianResponseInvalid("响应顶层不是 JSON 对象")
    has = parsed.get("has_safer_path")
    if not isinstance(has, bool):
        raise GuardianResponseInvalid("has_safer_path 缺失或不是布尔")
    summary = parsed.get("safer_summary")
    if summary is not None and not isinstance(summary, str):
        raise GuardianResponseInvalid("safer_summary 不是字符串")
    risk_note = parsed.get("risk_note")
    if risk_note is not None and not isinstance(risk_note, str):
        raise GuardianResponseInvalid("risk_note 不是字符串")
    alternative = parsed.get("alternative")
    if alternative is not None and not isinstance(alternative, dict):
        raise GuardianResponseInvalid("alternative 既不是对象也不是 null")
    return {
        "has_safer_path": has,
        "safer_summary": summary or "",
        "risk_note": risk_note or "",
        "alternative": alternative if isinstance(alternative, dict) else None,
    }


def validate_alternative(
    tool_name: str, alternative: dict[str, Any] | None
) -> SaferAlternative | None:
    """对模型建议做确定性校验(服务端只认同工具 + 静态扫描过得了的参数)。"""
    if alternative is None:
        return None
    raw_args = alternative.get("args")
    rationale = alternative.get("rationale")
    rationale_text = rationale if isinstance(rationale, str) else ""
    if not isinstance(raw_args, dict):
        return SaferAlternative(
            tool_name=tool_name,
            args={},
            rationale=rationale_text,
            applicable=False,
            rejected_reason="args_not_object",
        )
    try:
        dumped = json.dumps(raw_args, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        dumped = ""
    if not dumped or len(dumped) > _ALTERNATIVE_MAX_JSON_CHARS:
        return SaferAlternative(
            tool_name=tool_name,
            args={},
            rationale=rationale_text,
            applicable=False,
            rejected_reason="args_size_out_of_bounds",
        )
    # 建议参数必须仍然过本地危险扫描:模型"建议"不豁免既有安全链
    scan = scan_tool_args(raw_args, tool_name=tool_name)
    if scan.dangerous:
        return SaferAlternative(
            tool_name=tool_name,
            args={},
            rationale=rationale_text,
            applicable=False,
            rejected_reason="alternative_scans_dangerous:" + ",".join(sorted(scan.kinds)),
        )
    # 通过 json 往返做一次深拷贝归一:后续 tc.args 直接接管这份对象,不得与复核结果共享
    normalized: dict[str, Any] = json.loads(dumped)
    return SaferAlternative(
        tool_name=tool_name,
        args=normalized,
        rationale=rationale_text,
        applicable=True,
    )


# ---------------- 公开入口 ----------------


async def request_guardian_review(
    tool_name: str,
    args: dict[str, Any],
    *,
    judge: GuardianJudge | None = None,
    enabled: bool | None = None,
    timeout_s: float | None = None,
) -> GuardianReviewResult:
    """跑一次审批前独立复核。**任何失败分支都返回 not_reviewed + 原因,绝不返回 None、
    绝不折叠成"已复核/无风险"。**

    Args:
        tool_name: 待审批工具名
        args: 待审批参数(只进复核提示词,不改写原调用)
        judge: 注入点,默认走 llm_gateway 独立请求;单测传 fake 即可离线跑
        enabled: None = 取 env 开关;显式传值供测试/未来策略面
        timeout_s: None = 取 env;复核超时会落到 not_reviewed("timeout")

    Returns:
        GuardianReviewResult(三态之一)
    """
    t0 = time.monotonic()
    if enabled is None:
        enabled = guardian_review_enabled_from_env()
    if not enabled:
        # 关掉的是复核,不是三态:disabled 也是一次显式的 not_reviewed
        return _not_reviewed(
            "disabled", latency_ms=round((time.monotonic() - t0) * 1000.0, 3)
        )
    limit = guardian_review_timeout_s_from_env() if timeout_s is None else max(
        0.1, min(float(timeout_s), _MAX_REVIEW_TIMEOUT_S)
    )
    call: GuardianJudge = judge if judge is not None else default_guardian_judge
    messages = build_review_messages(tool_name, args)

    def _latency() -> float:
        return round((time.monotonic() - t0) * 1000.0, 3)

    try:
        resp = await asyncio.wait_for(call(messages), timeout=limit)
    except TimeoutError:
        logger.warning("guardian 复核超时(%.1fs),按未复核处理: tool=%s", limit, tool_name)
        return _not_reviewed("timeout", latency_ms=_latency())
    except GuardianJudgeUnavailable as e:
        logger.warning("guardian 复核不可用(%s): tool=%s %s", e.reason, tool_name, e)
        return _not_reviewed(e.reason, latency_ms=_latency())
    except Exception as e:  # noqa: BLE001 - 统一收敛成 not_reviewed("gateway_error"),显式留痕
        logger.warning("guardian 复核异常,按未复核处理: tool=%s %s", tool_name, e)
        return _not_reviewed("gateway_error", latency_ms=_latency())

    try:
        verdict = parse_guardian_verdict(resp.content)
    except GuardianResponseInvalid as e:
        logger.warning("guardian 复核响应不可解析,按未复核处理: tool=%s %s", tool_name, e)
        return _not_reviewed("malformed_response", latency_ms=_latency())

    has_safer = bool(verdict["has_safer_path"])
    alternative = validate_alternative(tool_name, verdict["alternative"])
    status: GuardianReviewStatus = (
        GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND
        if has_safer
        else GUARDIAN_REVIEW_STATUS_NO_ALTERNATIVE
    )
    return GuardianReviewResult(
        status=status,
        unavailable_reason=None,
        summary=(verdict["safer_summary"] or None) if has_safer else None,
        risk_note=verdict["risk_note"] or None,
        alternative=alternative,
        reviewer_model=resp.model,
        independent_request_made=True,
        latency_ms=_latency(),
    )


__all__ = [
    "GuardianJudge",
    "GuardianJudgeUnavailable",
    "GuardianResponseInvalid",
    "GuardianReviewResult",
    "GuardianReviewStatus",
    "GuardianUnavailableReason",
    "GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND",
    "GUARDIAN_REVIEW_STATUS_NOT_REVIEWED",
    "GUARDIAN_REVIEW_STATUS_NO_ALTERNATIVE",
    "SaferAlternative",
    "build_review_messages",
    "default_guardian_judge",
    "guardian_review_enabled_from_env",
    "guardian_review_timeout_s_from_env",
    "parse_guardian_verdict",
    "request_guardian_review",
    "summarize_impact",
    "validate_alternative",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
