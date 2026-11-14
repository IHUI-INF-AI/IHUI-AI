# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""企业微信群机器人 Webhook 适配器(round 8 · C4)。

对照取证(NATIVE-DELTA W10):WorkBuddy 侧用 `wecom-cli.exe` + `WeComAgentConfirmSDK.dll`
做企业微信接入与二次确认;本仓 `app/services/im/` 只有飞书单适配器。本模块按
**公开的群机器人 Webhook 契约**实现第二通道,与 `base.py` 的 `ImAdapter` /
`SendResult` / `OutboundGuard` 共用同一套判据,不复制幂等/配额逻辑。

协议事实(公开文档,非逆向)
--------------------------
- 端点:`POST https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=<webhook_key>`;
- 文本消息体:`{"msgtype":"text","text":{"content":"..."}}`;
- 成功:`{"errcode":0,"errmsg":"ok"}`;非 0 即 provider 拒绝;
- 文本 content 上限 **2048 字节**(UTF-8),超限不截断(静默截断会改变语义)。

安全口径
--------
- key 只从构造参数 / `IM_WECOM_WEBHOOK_KEYS`(JSON 映射)或 `IM_WECOM_WEBHOOK_KEY`
  (单通道 `default`)读取;**不写日志、不进 `SendResult.detail`、不回显**;
- 任何异常文本先做 key 原文替换与 `key=...` 通用脱敏,再落 `detail`;
- 不做重试:重复外发由 `OutboundGuard` 的幂等键挡,重试由调用方显式决定。

状态口径:成功 `sent`;重复/配额 `skipped`;缺 key/未知频道/空文本/超长 `unjudged`;
provider 拒绝/网络/HTTP/坏响应 `failed`。四态不并桶(`base.SendStatus`)。
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Mapping
from typing import Any

import httpx

from .base import (
    REASON_CHANNEL_UNKNOWN,
    REASON_CREDENTIAL_MISSING,
    REASON_DELIVERED,
    REASON_EMPTY_TEXT,
    REASON_HTTP_ERROR,
    REASON_INVALID_RESPONSE,
    REASON_PROVIDER_REJECTED,
    REASON_TEXT_TOO_LONG,
    REASON_TRANSPORT_ERROR,
    OutboundGuard,
    OutboundMessage,
    SendResult,
    SendStatus,
)

WECOM_WEBHOOK_URL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send"

# 文本 content 的 UTF-8 字节上限(企业微信群机器人公开限制)。
MAX_TEXT_BYTES = 2048

DEFAULT_CHANNEL = "default"

ENV_KEYS_JSON = "IM_WECOM_WEBHOOK_KEYS"
ENV_SINGLE_KEY = "IM_WECOM_WEBHOOK_KEY"

_URL_KEY_RE = re.compile(r"(?i)(key=)[^&\s\"']+")


def _redact(text: str, secrets: tuple[str, ...]) -> str:
    """凭据脱敏:先逐字替换 key 原文,再把 `key=...` 统一打码。"""
    out = text
    for secret in secrets:
        if secret:
            out = out.replace(secret, "***")
    return _URL_KEY_RE.sub(r"\1***", out)


class WeComWebhookAdapter:
    """企业微信群机器人适配器(一个实例可管多个具名频道)。

    `channels` 是 `频道别名 → webhook key` 的映射;`message.channel` 必须命中别名,
    否则判 `unjudged/channel_unknown`(含"别名在但 key 为空"的 `credential_missing`)。
    """

    platform = "wecom"

    def __init__(
        self,
        channels: Mapping[str, str],
        *,
        guard: OutboundGuard | None = None,
        client: httpx.AsyncClient | None = None,
        timeout_s: float = 10.0,
        base_url: str = WECOM_WEBHOOK_URL,
    ) -> None:
        self._channels: dict[str, str] = {str(name): str(key) for name, key in channels.items()}
        # 默认自带一份有界判据:即便调用方忘记注入,也不会无幂等/无配额地外发。
        self._guard: OutboundGuard = guard if guard is not None else OutboundGuard()
        self._base_url = base_url
        self._owns_client = client is None
        self._client: httpx.AsyncClient = client or httpx.AsyncClient(timeout=timeout_s)

    @property
    def known_channels(self) -> tuple[str, ...]:
        """已知频道别名(不含 key;供日志/诊断使用)。"""
        return tuple(sorted(self._channels))

    @classmethod
    def from_env(
        cls,
        *,
        guard: OutboundGuard | None = None,
        client: httpx.AsyncClient | None = None,
        environ: Mapping[str, str] | None = None,
    ) -> WeComWebhookAdapter:
        """从环境读取凭据;取不到就是空映射(发送时判 `channel_unknown`)。

        `IM_WECOM_WEBHOOK_KEYS` 优先(JSON 对象);否则 `IM_WECOM_WEBHOOK_KEY`
        映射为 `default` 单通道。JSON 坏掉不抛异常 —— 留空并由 `send` 具名拒绝,
        避免一个坏 env 让服务启动整体失败。
        """
        env = os.environ if environ is None else environ
        channels: dict[str, str] = {}
        raw_json = (env.get(ENV_KEYS_JSON) or "").strip()
        if raw_json:
            try:
                parsed = json.loads(raw_json)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, dict):
                channels = {
                    str(name): str(key)
                    for name, key in parsed.items()
                    if isinstance(name, str) and isinstance(key, str)
                }
        if not channels:
            single = (env.get(ENV_SINGLE_KEY) or "").strip()
            if single:
                channels = {DEFAULT_CHANNEL: single}
        return cls(channels, guard=guard, client=client)

    async def aclose(self) -> None:
        """只关闭自己创建的 HTTP 客户端(注入的客户端归调用方)。"""
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> WeComWebhookAdapter:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    def _result(
        self,
        status: SendStatus,
        channel: str,
        reason_code: str,
        *,
        detail: dict[str, Any] | None = None,
    ) -> SendResult:
        return SendResult(
            status=status,
            platform=self.platform,
            channel=channel,
            reason_code=reason_code,
            detail=detail,
        )

    async def send(self, message: OutboundMessage) -> SendResult:
        """发送一条文本消息;不抛异常,所有结论走 `SendResult`。"""
        channel = message.channel
        if channel not in self._channels:
            return self._result(
                SendStatus.UNJUDGED,
                channel,
                REASON_CHANNEL_UNKNOWN,
                detail={"known_channels": list(self.known_channels)},
            )
        key = self._channels[channel].strip()
        if not key:
            return self._result(
                SendStatus.UNJUDGED, channel, REASON_CREDENTIAL_MISSING
            )
        text = message.text
        if not text.strip():
            return self._result(SendStatus.UNJUDGED, channel, REASON_EMPTY_TEXT)
        size = len(text.encode("utf-8"))
        if size > MAX_TEXT_BYTES:
            return self._result(
                SendStatus.UNJUDGED,
                channel,
                REASON_TEXT_TOO_LONG,
                detail={"bytes": size, "limit": MAX_TEXT_BYTES},
            )
        blocked = self._guard.check(self.platform, message)
        if blocked is not None:
            return blocked

        payload = {"msgtype": "text", "text": {"content": text}}
        try:
            response = await self._client.post(
                self._base_url, params={"key": key}, json=payload
            )
        except Exception as exc:  # noqa: BLE001 - 契约要求任何异常都收敛为 SendResult
            self._guard.record(self.platform, message, delivered=False)
            return self._result(
                SendStatus.FAILED,
                channel,
                REASON_TRANSPORT_ERROR,
                detail={"error": _redact(f"{type(exc).__name__}: {exc}", (key,))},
            )

        if response.status_code >= 400:
            self._guard.record(self.platform, message, delivered=False)
            return self._result(
                SendStatus.FAILED,
                channel,
                REASON_HTTP_ERROR,
                detail={"status": response.status_code},
            )
        try:
            data = response.json()
        except ValueError:
            self._guard.record(self.platform, message, delivered=False)
            return self._result(
                SendStatus.FAILED,
                channel,
                REASON_INVALID_RESPONSE,
                detail={"body_prefix": _redact(response.text[:200], (key,))},
            )
        errcode = data.get("errcode") if isinstance(data, dict) else None
        if errcode == 0:
            self._guard.record(self.platform, message, delivered=True)
            return self._result(
                SendStatus.SENT,
                channel,
                REASON_DELIVERED,
                detail={"errcode": 0},
            )
        errmsg = data.get("errmsg") if isinstance(data, dict) else None
        self._guard.record(self.platform, message, delivered=False)
        return self._result(
            SendStatus.FAILED,
            channel,
            REASON_PROVIDER_REJECTED,
            detail={
                "errcode": errcode,
                "errmsg": _redact(str(errmsg), (key,)) if errmsg is not None else None,
            },
        )


__all__ = [
    "DEFAULT_CHANNEL",
    "ENV_KEYS_JSON",
    "ENV_SINGLE_KEY",
    "MAX_TEXT_BYTES",
    "WECOM_WEBHOOK_URL",
    "WeComWebhookAdapter",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
