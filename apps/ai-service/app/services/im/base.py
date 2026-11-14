# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IM 适配器契约与出站共用判据(round 8 · C4)。

立因
----
对照取证(W3/W10,NATIVE-DELTA 2026-11-14):WorkBuddy 用 `@genie/im-channels-native`
内嵌腾讯 TIM C SDK,企业微信侧另有 `wecom-cli` + Agent 授权确认;本仓
`app/services/im/` 只有 `FeishuLarkAdapter` 单通道,且**没有可测的出站契约** ——
每个通道各写一套成功/失败形状,幂等、配额、未授权频道这些判据无处安放。

本模块只做两件事:
1. **契约**:`OutboundMessage` / `SendResult` / `ImAdapter` 三个稳定形状;
2. **共用判据**:`OutboundGuard` 把「幂等键 / 每频道滑动窗口配额」收成一份纯逻辑,
   飞书与企微适配器共用,不复制第二套。

四态口径(与仓内 `QueueStatus` 同纪律,不并桶)
--------------------------------------------
- `sent`      —— provider 明确接受;
- `skipped`   —— 判据决定**合法不发**(重复键 / 配额到顶),不是失败;
- `unjudged`  —— 取不到输入(缺凭据 / 未知频道 / 空文本 / 超长),按 §0.3 不发并点名原因;
- `failed`    —— 已发起但 provider 拒绝 / 网络失败。

刻意不做什么
------------
- 不读环境变量、不建连接、不写磁盘:凭据与 HTTP 客户端由调用方注入(便于离线测试)。
- 不把 `skipped` / `unjudged` 折成 `sent` 或 `failed`:四种结论各自可观测。
- 不做重试:重复发送由幂等键挡,重试由调用方显式决定(避免隐式双发)。
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol, runtime_checkable

# 判据原因码(单一真相源:适配器与测试都引用这些常量,不各自写字面量)
REASON_DELIVERED = "delivered"
REASON_DUPLICATE = "duplicate"
REASON_QUOTA_EXCEEDED = "quota_exceeded"
REASON_CREDENTIAL_MISSING = "credential_missing"
REASON_CHANNEL_UNKNOWN = "channel_unknown"
REASON_EMPTY_TEXT = "empty_text"
REASON_TEXT_TOO_LONG = "text_too_long"
REASON_PROVIDER_REJECTED = "provider_rejected"
REASON_TRANSPORT_ERROR = "transport_error"
REASON_HTTP_ERROR = "http_error"
REASON_INVALID_RESPONSE = "invalid_response"


class SendStatus(StrEnum):
    """一次出站尝试的结论;**四态不得并桶**。"""

    SENT = "sent"
    SKIPPED = "skipped"
    UNJUDGED = "unjudged"
    FAILED = "failed"


@dataclass(frozen=True)
class OutboundMessage:
    """通道无关的出站消息。

    `idempotency_key` 是调用方给出的稳定身份(如入站消息 ID);同一通道内重复提交
    会在 `dedupe_ttl_s` 窗口内被判 `skipped/duplicate`,不会二次外发。
    """

    channel: str
    text: str
    idempotency_key: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SendResult:
    """通道无关的出站结论。

    `reason_code` 只取本模块的原因码常量;`detail` 供排障,但**不得**包含凭据原文。
    """

    status: SendStatus
    platform: str
    channel: str
    reason_code: str
    message_id: str | None = None
    detail: dict[str, Any] | None = None

    @property
    def ok(self) -> bool:
        """只有 provider 明确接受才算成功;skip/unjudged/failed 一律 False。"""
        return self.status is SendStatus.SENT


@runtime_checkable
class ImAdapter(Protocol):
    """IM 通道适配器契约(结构性类型,不要求继承)。"""

    platform: str

    async def send(self, message: OutboundMessage) -> SendResult:
        """发送一条消息;任何异常都应收敛成 `SendResult`,不向调用方抛。"""
        ...


@dataclass
class OutboundGuard:
    """幂等 + 每频道配额共用的纯判据(进程内、有界)。

    判据顺序(先便宜后昂贵,且失效方向恒为「不发」):
      ① 幂等:同 `(platform, channel, idempotency_key)` 已成功发过且在 TTL 内
         ⇒ `skipped/duplicate`;
      ② 配额:同 `(platform, channel)` 在滑动窗口内的**尝试次数**已达上限
         ⇒ `skipped/quota_exceeded`(失败尝试也计数,防重试风暴);
      ③ 否则放行(返回 None)。

    刻意不做什么:不在这里做 HTTP、不抛异常、不做重试;不把配额判成 failed
    —— 配额到顶是「按策略不发」,与 provider 拒绝是两回事。
    """

    max_per_window: int = 20
    window_s: float = 60.0
    dedupe_ttl_s: float = 300.0
    max_tracked: int = 1024
    _attempts: deque[tuple[float, str, str]] = field(
        init=False, repr=False, default_factory=deque
    )
    _delivered: dict[tuple[str, str, str], float] = field(
        init=False, repr=False, default_factory=dict
    )

    def _prune(self, now: float) -> None:
        while self._attempts and now - self._attempts[0][0] > self.window_s:
            self._attempts.popleft()
        expired = [
            key for key, ts in self._delivered.items() if now - ts > self.dedupe_ttl_s
        ]
        for key in expired:
            del self._delivered[key]
        while len(self._attempts) > self.max_tracked:
            self._attempts.popleft()
        while len(self._delivered) > self.max_tracked:
            oldest = min(self._delivered, key=self._delivered.__getitem__)
            del self._delivered[oldest]

    def check(
        self, platform: str, message: OutboundMessage, *, now: float | None = None
    ) -> SendResult | None:
        """放行返回 None;否则返回 `skipped` 结论(带原因码)。"""
        ts = time.monotonic() if now is None else now
        self._prune(ts)
        delivery_key = (platform, message.channel, message.idempotency_key)
        if delivery_key in self._delivered:
            return SendResult(
                status=SendStatus.SKIPPED,
                platform=platform,
                channel=message.channel,
                reason_code=REASON_DUPLICATE,
                detail={"idempotency_key": message.idempotency_key},
            )
        used = sum(
            1
            for stamp, plat, channel in self._attempts
            if plat == platform and channel == message.channel
        )
        if used >= self.max_per_window:
            return SendResult(
                status=SendStatus.SKIPPED,
                platform=platform,
                channel=message.channel,
                reason_code=REASON_QUOTA_EXCEEDED,
                detail={"used": used, "limit": self.max_per_window, "window_s": self.window_s},
            )
        return None

    def record(
        self,
        platform: str,
        message: OutboundMessage,
        *,
        delivered: bool,
        now: float | None = None,
    ) -> None:
        """登记一次**已发起**的尝试;只有 `delivered=True` 才进入幂等窗口。"""
        ts = time.monotonic() if now is None else now
        self._attempts.append((ts, platform, message.channel))
        if delivered:
            self._delivered[(platform, message.channel, message.idempotency_key)] = ts
        self._prune(ts)


__all__ = [
    "ImAdapter",
    "OutboundGuard",
    "OutboundMessage",
    "REASON_CHANNEL_UNKNOWN",
    "REASON_CREDENTIAL_MISSING",
    "REASON_DELIVERED",
    "REASON_DUPLICATE",
    "REASON_EMPTY_TEXT",
    "REASON_HTTP_ERROR",
    "REASON_INVALID_RESPONSE",
    "REASON_PROVIDER_REJECTED",
    "REASON_QUOTA_EXCEEDED",
    "REASON_TEXT_TOO_LONG",
    "REASON_TRANSPORT_ERROR",
    "SendResult",
    "SendStatus",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
