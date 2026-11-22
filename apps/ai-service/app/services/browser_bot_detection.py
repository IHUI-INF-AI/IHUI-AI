# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器反爬/挑战拦截面结构化上报 — 统一实现 26.1111 tab.capabilities.botDetection。

设计依据
--------
``内部规格`` §3(tab 级 botDetection)
+ §4.4(上报边界),明文按行为规格 ``tab/browserDetection.md``::

    botDetection: report({reason}) 上报被反爬/CAPTCHA 拦。7 个枚举 reason:
      captcha_failed / access_denied / challenge_loop / sign_in_blocked /
      add_to_cart_blocked / purchase_blocked / unexpected_bot_error。
    隐私设计: "The runtime records only the parsed hostname, never the full URL"
    (只存 hostname 不存全 URL)。
    边界: "Do not use ... for a bare HTTP status code" — 裸 HTTP 状态码 /
    代理 egress 拒绝 / DNS / TLS / 超时不算 bot detection(防误报)。

对照 IHUI 缺口
--------------
- ``browser_hub._looks_like_challenge`` 只给布尔"疑似挑战页",无结构化分类、无 reason 枚举;
- 网络错误(ec/dns/tls/timeout/egress 拒绝)与"被反爬拦"混为一谈,易误报;
- 无 hostname-only 隐私口径 —— 上报若带全 URL,敏感 query 会泄漏进遥测。

设计要点(纯函数,零 IO)
------------------------
1. **7 类 reason 封闭枚举**(与 Codex 逐项对齐,不私自增删);
2. **分类函数**:有"当前 URL + 可见页面证据"才归类;裸 HTTP 状态码 /
   egress 拒绝 / DNS / TLS / 超时一律判为非反爬(排除项);
3. **hostname-only**:解析 URL 只保留 hostname,丢弃 scheme/port/path/query/
   fragment,防敏感 query 泄漏;解析失败返回 None(不猜);
4. **上报记录**:只含 hostname + reason + 可见证据文本,**永不存全 URL**。

与既有层的关系
--------------
- 只做"分类 + 结构化",不代替"告知用户被拦"或"换可信来源"(Codex §4.4:上报是内部
  遥测);是否停/续由调用方按周围 Browser Safety 指引决定;
- 与 ``browser_confirmation_policy``(动作确认)、``cdp_method_gate``(命令门)互补。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from urllib.parse import urlsplit


class BotDetectionReason(StrEnum):
    """反爬/挑战拦截面封闭分类(Codex 7 类,逐项对齐,不私自增删)。"""

    CAPTCHA_FAILED = "captcha_failed"  # CAPTCHA 解答失败/未通过
    ACCESS_DENIED = "access_denied"  # 明确拒绝访问(WAF/反爬拦截页)
    CHALLENGE_LOOP = "challenge_loop"  # 挑战页反复出现,无法通过
    SIGN_IN_BLOCKED = "sign_in_blocked"  # 登录被反爬/风控拦
    ADD_TO_CART_BLOCKED = "add_to_cart_blocked"  # 加购被拦(电商风控)
    PURCHASE_BLOCKED = "purchase_blocked"  # 结算/下单被拦(电商风控)
    UNEXPECTED_BOT_ERROR = "unexpected_bot_error"  # 其他未预期的 bot 拦截


REASONS: tuple[str, ...] = tuple(r.value for r in BotDetectionReason)


@dataclass(frozen=True)
class NonBotCause(StrEnum):
    """判为"非反爬"的基础设施/传输层原因(Codex 排除项,防误报)。"""

    BARE_HTTP_STATUS = "bare_http_status"  # 裸 HTTP 状态码(403/429/503 等)
    PROXY_EGRESS_DENIED = "proxy_egress_denied"  # 代理出口拒绝
    DNS_FAILURE = "dns_failure"  # DNS 解析失败
    TLS_ERROR = "tls_error"  # TLS/证书错误
    TIMEOUT = "timeout"  # 连接/响应超时


NON_BOT_CAUSES: tuple[str, ...] = tuple(c.value for c in NonBotCause)


@dataclass(frozen=True)
class BotDetectionReport:
    """一次反爬拦截的结构化上报记录(hostname-only,永不存全 URL)。"""

    hostname: str  # 仅解析出的 hostname,不含 scheme/port/path/query
    reason: str  # ``BotDetectionReason`` 之一
    visible_evidence: str  # 可见页面的证据文本(供人工复核,非全 URL)
    parsed_from_url: str  # 来源 URL 的 hostname 解析状态说明

    def to_dict(self) -> dict[str, str]:
        return {
            "hostname": self.hostname,
            "reason": self.reason,
            "visible_evidence": self.visible_evidence,
            "parsed_from_url": self.parsed_from_url,
        }


@dataclass(frozen=True)
class BotDetectionDecision:
    """分类决策:是反爬拦截 / 是基础设施非反爬 / 证据不足不归类。"""

    is_bot_detection: bool
    reason: str | None  # is_bot_detection=True 时为 7 类之一,否则 None
    non_bot_cause: str | None  # 判为非反爬时的 ``NonBotCause`` 值
    detail: str  # 判定说明(非空)


def extract_hostname(url: str) -> tuple[str | None, str]:
    """从 URL 只提取 hostname(隐私:丢弃 scheme/port/path/query/fragment)。

    返回 ``(hostname, 状态说明)``;解析失败返回 ``(None, 原因)`` —— 不猜、不回落全 URL。
    """
    if not url or not url.strip():
        return (None, "empty_url")
    try:
        parts = urlsplit(url.strip())
    except ValueError as exc:
        return (None, f"url_parse_error:{exc.__class__.__name__}")
    hostname = (parts.hostname or "").lower()
    if not hostname:
        return (None, "no_hostname")
    return (hostname, "ok")


def classify_bot_detection(
    *,
    reason: str,
    visible_evidence: str = "",
    http_status: int | None = None,
    transport_error: str | None = None,
) -> BotDetectionDecision:
    """把一次"页面被拦"归为反爬上报 / 非反爬 / 证据不足(纯函数)。

    参数:
        reason: 见 ``BotDetectionReason``;未命中归 unexpected_bot_error 前须有证据。
        visible_evidence: 可见页面的证据文本(挑战页文案/captcha 元素等)。
        http_status: 若已知是裸 HTTP 状态码(403/429/503...),判为非反爬(Codex 排除项)。
        transport_error: 传输层错误类别(proxy_egress_denied/dns/tls/timeout)。
    """
    # ① 传输层/裸状态码恒判非反爬(防误报,Codex §4.4)
    if transport_error:
        cause = transport_error if transport_error in NON_BOT_CAUSES else NonBotCause.TIMEOUT
        return BotDetectionDecision(
            is_bot_detection=False,
            reason=None,
            non_bot_cause=cause,
            detail=f"传输层/出口错误 {cause},非反爬拦截(裸基础设施原因,不归类 bot detection)。",
        )
    if http_status is not None:
        return BotDetectionDecision(
            is_bot_detection=False,
            reason=None,
            non_bot_cause=NonBotCause.BARE_HTTP_STATUS,
            detail=f"裸 HTTP 状态码 {http_status},非反爬拦截(Codex:勿把裸状态码当 bot detection)。",
        )

    # ② 有 reason 且在封闭集 → 反爬上报
    reason_key = (reason or "").strip().lower()
    if reason_key in REASONS:
        # 归类须有可见证据支撑(§4.4:只在当前 URL + 可见页面有足够证据分类后才上报)
        if not (visible_evidence or "").strip():
            return BotDetectionDecision(
                is_bot_detection=False,
                reason=None,
                non_bot_cause=None,
                detail="reason 命中但无可见页面证据,不归类(防误报,须先取 DOM/截图证据)。",
            )
        return BotDetectionDecision(
            is_bot_detection=True,
            reason=reason_key,
            non_bot_cause=None,
            detail=f"反爬拦截 {reason_key},有可见页面证据支撑,可上报。",
        )

    # ③ reason 未命中 → 证据不足,不猜
    return BotDetectionDecision(
        is_bot_detection=False,
        reason=None,
        non_bot_cause=None,
        detail=f"reason={reason!r} 不在封闭集且无传输层信号,证据不足,不归类。",
    )


def build_report(
    *,
    url: str,
    reason: str,
    visible_evidence: str,
) -> tuple[BotDetectionReport | None, str]:
    """构造 hostname-only 上报记录;URL 解析失败返回 ``(None, 原因)``。

    纪律:记录里**永不存全 URL**,只存 hostname(Codex 隐私设计)。
    """
    hostname, status = extract_hostname(url)
    if hostname is None:
        return (None, f"无法构造上报:{status}(不回落全 URL)")
    report = BotDetectionReport(
        hostname=hostname,
        reason=reason,
        visible_evidence=visible_evidence,
        parsed_from_url=status,
    )
    return (report, "ok")


__all__ = [
    "BotDetectionReason",
    "REASONS",
    "NonBotCause",
    "NON_BOT_CAUSES",
    "BotDetectionReport",
    "BotDetectionDecision",
    "extract_hostname",
    "classify_bot_detection",
    "build_report",
]
