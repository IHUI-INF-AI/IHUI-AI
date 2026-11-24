# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器登录凭据 handoff 协议 — 统一实现 26.1111 browserAuth.request()。

设计依据
--------
``内部规格``(R11e,明文
371 行 browserAuth.md 按行为规格)。核心不变量::

    "Browser-client validates, fills, and submits those values without
     returning them to you."(凭据值永不返回给调用方/模型)

    请求形状:只放非秘密元数据 + 选择器;禁含秘密/cookie/完整 URL/query/JS/
    DOM 片段/页面内容。origin 只用规范 origin(scheme+host+port,无 path/
    query/fragment)。

    结果永不含凭据值(The result never contains credential values)。
    unavailable / submission_failed 绝不 fallback 到 chat/直接凭据输入。

对照 IHUI 缺口
--------------
- IHUI 无任何登录凭据 handoff 层(grep browserAuth/credential_handoff/零回传 全无);
- ``ui_action_bridge`` 有 fill_password 类动作,但模型可见凭据值 ⇒ 违反"零回传"
  第一红线。

设计要点(纯函数,零 IO)
------------------------
1. **AuthStatus 结果状态机**(Codex 9 态逐项):每态配明确处置;
   ``unavailable`` / ``submission_failed`` 绝不降级到 chat;
2. **凭据零回传** ``AuthResult``:只含 status + 非秘密诊断,**无凭据值字段**;
3. **请求消毒** ``sanitize_auth_request``:请求只允许白名单字段(origin/fields/
   submit/qr_code),拒绝 secret/cookie/全 URL/query/JS/DOM 片段;
   origin 归一到 scheme+host+port;
4. **跨域/iframe 提交拒绝**(Codex 独立拒绝类):paused_iframe/iframe_origin/
   child_frame_origin 防凭据发到错误 origin;
5. **未知结果判定**:spinner/空白页/陈旧 tab/超时 = 既非成功也非失败。

与既有层的关系
--------------
- 只做"凭据 handoff 协议状态机 + 请求消毒",不真填表、不连浏览器(那是 client
  侧);模型面只见状态枚举与非秘密诊断,凭据值在 client 侧填写后即弃;
- 与 ``session_taint``(不可信内容/出口审批)、``browser_confirmation_policy``
  (动作确认)互补:本模块守"凭据永不回传"这条最敏感红线。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from urllib.parse import urlsplit


class AuthStatus(StrEnum):
    """browserAuth 结果状态(Codex 9 态,逐项对齐)。"""

    SUBMITTED = "submitted"  # 已点/已填/已提交;不证明登录成功
    LOCATOR_INVALID = "locator_invalid"  # 选择器陈旧,须重勘察
    PAGE_CHANGED = "page_changed"  # 页面已变,请求陈旧
    ORIGIN_CHANGED = "origin_changed"  # origin 已变,请求不安全
    EXPIRED = "expired"  # 授权窗口已过
    DECLINED_USER_TOOK_OVER = "declined_user_took_over"  # 用户接管,结果未知
    DECLINED = "declined"  # 用户选择不继续
    CANCELLED = "cancelled"  # 用户取消
    UNAVAILABLE = "unavailable"  # 能力不可用
    SUBMISSION_FAILED = "submission_failed"  # 提交失败


STATUSES: tuple[str, ...] = tuple(s.value for s in AuthStatus)


# 绝不降级到 chat/直接凭据输入的状态(Codex 硬红线 8/9)
NEVER_FALLBACK_TO_CHAT: frozenset[str] = frozenset(
    {AuthStatus.UNAVAILABLE.value, AuthStatus.SUBMISSION_FAILED.value}
)


class RejectionReason(StrEnum):
    """提交拒绝原因(Codex submission_diagnostics,跨域/iframe 为独立类)。"""

    REQUEST_URL_INVALID = "request_url_invalid"
    REQUEST_SCHEME = "request_scheme"
    REQUEST_ORIGIN = "request_origin"
    PAUSED_IFRAME = "paused_iframe"
    IFRAME_ORIGIN = "iframe_origin"
    CHILD_FRAME_ORIGIN = "child_frame_origin"


REJECTION_REASONS: tuple[str, ...] = tuple(r.value for r in RejectionReason)


# 跨域/iframe 类拒绝(防凭据发到错误 origin 的独立防线)
CROSS_ORIGIN_REASONS: frozenset[str] = frozenset(
    {
        RejectionReason.PAUSED_IFRAME.value,
        RejectionReason.IFRAME_ORIGIN.value,
        RejectionReason.CHILD_FRAME_ORIGIN.value,
    }
)


@dataclass(frozen=True)
class AuthResult:
    """凭据 handoff 结果(**永不含凭据值**,Codex 第一不变量)。

    只含 status + 非秘密诊断;无任何 credential/password/token 字段。
    """

    status: str  # ``AuthStatus`` 之一
    detail: str  # 非秘密处置说明
    rejection_reason: str | None = None  # 拒绝原因(枚举值,非秘密)
    is_cross_origin_rejection: bool = False  # 是否跨域/iframe 类拒绝
    never_fallback_to_chat: bool = False  # 是否禁降级到 chat

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "detail": self.detail,
            "rejection_reason": self.rejection_reason,
            "is_cross_origin_rejection": self.is_cross_origin_rejection,
            "never_fallback_to_chat": self.never_fallback_to_chat,
        }
    # 注:刻意不含任何凭据值字段;模型面只见状态与处置。


def handle_auth_result(status: str, *, rejection_reason: str | None = None) -> AuthResult:
    """把一个 browserAuth 状态归为结果(**无凭据值**),配明确处置(纯函数)。

    Codex 9 态逐项处置;unavailable/submission_failed 绝不降级到 chat。
    """
    key = (status or "").strip().lower()
    if key not in STATUSES:
        return AuthResult(
            status="unknown",
            detail=f"状态 {status!r} 不在封闭集,按未知处理:重勘察当前页,不假设成功。",
        )
    cross = key in {AuthStatus.ORIGIN_CHANGED.value} or (
        rejection_reason in CROSS_ORIGIN_REASONS
    )
    never_fb = key in NEVER_FALLBACK_TO_CHAT
    detail = _STATUS_DETAIL[key]
    return AuthResult(
        status=key,
        detail=detail,
        rejection_reason=rejection_reason if rejection_reason in REJECTION_REASONS else None,
        is_cross_origin_rejection=cross,
        never_fallback_to_chat=never_fb,
    )


_STATUS_DETAIL: dict[str, str] = {
    AuthStatus.SUBMITTED.value: (
        "凭据已提交但不证明登录成功:回到 transition-inspection 步,用新鲜可见证据验证目标域。"
    ),
    AuthStatus.LOCATOR_INVALID.value: "选择器陈旧:重勘察当前可见字段,发修正的新请求,不猜。",
    AuthStatus.PAGE_CHANGED.value: "页面已变:重勘察后发新请求。",
    AuthStatus.ORIGIN_CHANGED.value: (
        "origin 已变(请求不安全):停,重勘察确认当前 origin 与留存 targetOrigin 一致再发。"
    ),
    AuthStatus.EXPIRED.value: "授权窗口已过:重勘察后发新请求(输入可能已发生)。",
    AuthStatus.DECLINED_USER_TOOK_OVER.value: (
        "用户接管云浏览器,其操作与最终状态未知:新鲜 DOM 检最终页,不碰手动登录中间态。"
    ),
    AuthStatus.DECLINED.value: "用户选择不继续:尊重,不重试除非用户要求。",
    AuthStatus.CANCELLED.value: "用户取消:尊重,不重试除非用户要求。",
    AuthStatus.UNAVAILABLE.value: (
        "能力不可用:停止自动凭据输入,绝不 fallback 到 chat/直接凭据输入,"
        "礼貌拒绝且不解释原因。"
    ),
    AuthStatus.SUBMISSION_FAILED.value: (
        "提交失败:绝不 fallback 到 chat/直接凭据输入;仅当站点可见报错才报。"
    ),
}


# ── 请求消毒(只放非秘密元数据 + 选择器) ─────────────────────────────────────


# 请求顶层允许字段(Codex 请求形状)
_ALLOWED_TOP = frozenset({"origin", "fields", "submit", "qr_code", "account_identifier"})
# 单字段允许键
_ALLOWED_FIELD_KEYS = frozenset({"id", "label", "type", "autocomplete", "required", "selector"})
# 禁词:出现即判含秘密/页面内容(Codex 禁含项)
_FORBIDDEN_KEYS = frozenset(
    {"secret", "password_value", "token", "cookie", "credential", "value", "url", "query", "js", "html"}
)


@dataclass(frozen=True)
class SanitizeOutcome:
    """请求消毒结果。"""

    ok: bool
    origin: str | None  # 归一后的规范 origin(scheme+host+port)
    dropped_keys: tuple[str, ...]  # 被剔除的禁止键
    detail: str


def normalize_origin(url_or_origin: str) -> str | None:
    """把 URL/origin 归一到规范 origin(scheme+host+port,无 path/query/fragment)。

    解析失败返回 None(不猜)。Codex:origin 只用当前规范 origin。
    """
    if not url_or_origin or not url_or_origin.strip():
        return None
    text = url_or_origin.strip()
    if "://" not in text:
        text = "https://" + text  # 仅用于解析;输出仍只留 scheme+host+port
    try:
        parts = urlsplit(text)
        port = parts.port  # 访问 .port 可能抛 ValueError(非法端口)
    except ValueError:
        return None
    if not parts.scheme or not parts.hostname:
        return None
    port_s = f":{port}" if port else ""
    return f"{parts.scheme.lower()}://{parts.hostname.lower()}{port_s}"


def sanitize_auth_request(request: dict[str, object]) -> SanitizeOutcome:
    """消毒一个 browserAuth 请求:只允许非秘密元数据 + 选择器(纯函数)。

    - 剔除禁止键(secret/cookie/全 URL/query/JS/DOM 片段/凭据值);
    - origin 归一到规范 origin(无 path/query/fragment);
    - fields 只保留白名单键;
    - 缺 origin 或 fields/qr_code 全缺 = 不合格。
    """
    if not isinstance(request, dict):
        return SanitizeOutcome(False, None, (), "请求不是对象,拒绝。")
    dropped: list[str] = []
    rejected = False
    for k in request:
        if k.lower() in _FORBIDDEN_KEYS:
            # 顶层出现秘密类键(secret/cookie/凭据值)→ 整体拒绝(Codex 硬红线)
            rejected = True
            dropped.append(str(k))
        elif k.lower() not in _ALLOWED_TOP:
            dropped.append(str(k))
    if rejected:
        return SanitizeOutcome(
            False, None, tuple(dropped), "请求含秘密类键,整体拒绝(凭据值不得进请求面)。"
        )
    origin_raw = request.get("origin")
    origin = normalize_origin(str(origin_raw)) if isinstance(origin_raw, str) else None
    if origin is None:
        return SanitizeOutcome(False, None, tuple(dropped), "缺合法 origin,拒绝(无法锁定目标站)。")
    has_fields = isinstance(request.get("fields"), list) and bool(request["fields"])
    has_qr = bool(request.get("qr_code"))
    if not (has_fields or has_qr):
        return SanitizeOutcome(False, origin, tuple(dropped), "fields 与 qr_code 全缺,拒绝。")
    # 校验 fields 内不得带禁止键(isinstance 已收窄到 list)
    fields_raw = request.get("fields")
    if isinstance(fields_raw, list) and fields_raw:
        for f in fields_raw:
            if isinstance(f, dict):
                for k in f:
                    if str(k).lower() in _FORBIDDEN_KEYS or str(k).lower() not in _ALLOWED_FIELD_KEYS:
                        dropped.append(f"fields.{k}")
    return SanitizeOutcome(
        ok=True,
        origin=origin,
        dropped_keys=tuple(dropped),
        detail="请求已消毒:只含非秘密元数据 + 选择器,凭据值不在请求面。",
    )


# ── submission_diagnostics(提交过程非秘密遥测,Codex §6) ─────────────────────


class AttemptEvent(StrEnum):
    """提交尝试事件(Codex §6 attempt_events[] 逐项,顺序即典型时序)。"""

    PROMPT_COMPLETED = "prompt_completed"
    FIELD_FILL_STARTED = "field_fill_started"
    FIELD_FILL_COMPLETED = "field_fill_completed"
    FIELD_FILL_UNCERTAIN = "field_fill_uncertain"
    URL_CHANGED = "url_changed"
    DOCUMENT_CHANGED = "document_changed"
    FRAME_CHANGED = "frame_changed"
    REINSPECTION_STARTED = "reinspection_started"
    REINSPECTION_COMPLETED = "reinspection_completed"
    SITE_REQUEST = "site_request"
    SITE_NAVIGATION = "site_navigation"
    SITE_SUBMISSION_VERIFIED = "site_submission_verified"
    SUBMIT_STARTED = "submit_started"
    ATTEMPT_COMPLETED = "attempt_completed"


ATTEMPT_EVENTS: tuple[str, ...] = tuple(e.value for e in AttemptEvent)


class SubmissionPhase(StrEnum):
    """提交所处阶段(Codex §6 拒绝记录的 submission_phase)。"""

    PREPARE = "prepare"
    FILL = "fill"
    SUBMIT = "submit"
    VERIFY = "verify"


SUBMISSION_PHASES: tuple[str, ...] = tuple(p.value for p in SubmissionPhase)


class SubmissionMode(StrEnum):
    """提交模式(Codex §6:ordinary | private)。"""

    ORDINARY = "ordinary"
    PRIVATE = "private"


SUBMISSION_MODES: tuple[str, ...] = tuple(m.value for m in SubmissionMode)

# 拒绝记录 schema 版本(Codex §6:schema_version: 1)
DIAGNOSTICS_SCHEMA_VERSION = 1


@dataclass(frozen=True)
class RejectionRecord:
    """一次拒绝的结构化记录(Codex §6:outcome+reason+request_class+submission_phase)。

    全为非秘密枚举/类别,永不含凭据值。
    """

    outcome: str  # 拒绝 outcome(通常 = AuthStatus 拒绝态)
    reason: str  # ``RejectionReason`` 之一
    request_class: str  # 请求类别(非秘密:ordinary/private 等)
    submission_phase: str  # ``SubmissionPhase`` 之一

    def to_dict(self) -> dict[str, str]:
        return {
            "outcome": self.outcome,
            "reason": self.reason,
            "request_class": self.request_class,
            "submission_phase": self.submission_phase,
        }


@dataclass(frozen=True)
class SubmissionDiagnostics:
    """提交诊断(非秘密遥测,Codex §6)。

    含 attempt_events[] + first/terminal_rejection + mode + schema_version;
    **永不含凭据值**。
    """

    attempt_events: tuple[str, ...]
    submission_mode: str  # ``SubmissionMode`` 之一
    schema_version: int
    first_rejection: RejectionRecord | None
    terminal_rejection: RejectionRecord | None

    def to_dict(self) -> dict[str, object]:
        return {
            "attempt_events": list(self.attempt_events),
            "submission_mode": self.submission_mode,
            "schema_version": self.schema_version,
            "first_rejection": (
                self.first_rejection.to_dict() if self.first_rejection else None
            ),
            "terminal_rejection": (
                self.terminal_rejection.to_dict() if self.terminal_rejection else None
            ),
        }


def build_submission_diagnostics(
    *,
    attempt_events: list[str],
    submission_mode: str = SubmissionMode.ORDINARY.value,
    first_rejection: RejectionRecord | None = None,
    terminal_rejection: RejectionRecord | None = None,
) -> SubmissionDiagnostics:
    """构造提交诊断(纯函数):过滤非法事件,保留合法序,归一 mode。"""
    valid_events = tuple(e for e in attempt_events if e in ATTEMPT_EVENTS)
    mode = submission_mode if submission_mode in SUBMISSION_MODES else SubmissionMode.ORDINARY.value
    return SubmissionDiagnostics(
        attempt_events=valid_events,
        submission_mode=mode,
        schema_version=DIAGNOSTICS_SCHEMA_VERSION,
        first_rejection=first_rejection,
        terminal_rejection=terminal_rejection,
    )


__all__ = [
    "AuthStatus",
    "STATUSES",
    "NEVER_FALLBACK_TO_CHAT",
    "RejectionReason",
    "REJECTION_REASONS",
    "CROSS_ORIGIN_REASONS",
    "AuthResult",
    "handle_auth_result",
    "SanitizeOutcome",
    "normalize_origin",
    "sanitize_auth_request",
    "AttemptEvent",
    "ATTEMPT_EVENTS",
    "SubmissionPhase",
    "SUBMISSION_PHASES",
    "SubmissionMode",
    "SUBMISSION_MODES",
    "RejectionRecord",
    "SubmissionDiagnostics",
    "build_submission_diagnostics",
]
