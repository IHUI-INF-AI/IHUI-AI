"""通用 webhook 适配器 (Phase 10-E) -- Slack / Teams / Custom.

设计:
  - Slack Incoming Webhook: 简单 text 格式
  - Microsoft Teams Incoming Webhook: MessageCard 格式 (legacy, 简单标题+文本)
  - Generic Custom Webhook: 通用 JSON, 透传所有告警字段, 支持自定义 auth header
  - 与 alert_service 已有 _post_with_retry 重试风格保持一致
  - 失败不影响其他通道 (在 push_alert 里并发处理)
"""

from __future__ import annotations

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 5.0
_PUSH_RETRY = 1


async def _post_with_retry(
    client_factory, url: str, body: dict, headers: dict | None, success_check
) -> tuple[bool, str]:
    """统一 POST + 重试封装."""
    last_err = ""
    for attempt in range(_PUSH_RETRY + 1):
        try:
            async with client_factory() as client:
                resp = await client.post(url, json=body, headers=headers or {})
                if resp.status_code in (200, 201, 202) and success_check(
                    resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                ):
                    return True, "ok"
                # 一些 webhook 返纯 "ok" 文本
                if resp.status_code in (200, 201, 202) and resp.text.strip().lower() == "ok":
                    return True, "ok"
                last_err = f"http={resp.status_code} body={resp.text[:200]}"
        except Exception as e:
            last_err = f"err={e}"
        if attempt < _PUSH_RETRY:
            await asyncio.sleep(0.3 * (attempt + 1))
    return False, last_err


# ---------------------------------------------------------------------------
# Slack Incoming Webhook
# ---------------------------------------------------------------------------


def build_slack_payload(title: str, message: str, severity: str = "warning") -> dict:
    """构造 Slack Incoming Webhook payload (Block Kit 简化版)."""
    emoji_map = {
        "critical": ":rotating_light:",
        "error": ":x:",
        "warning": ":warning:",
        "info": ":information_source:",
    }
    emoji = emoji_map.get((severity or "").lower(), ":bell:")
    return {
        "text": f"{emoji} *{title}*\n{message}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{emoji} *{title}*\n{message}",
                },
            }
        ],
    }


async def push_slack(webhook: str, title: str, message: str, severity: str = "warning") -> bool:
    """推送到 Slack Incoming Webhook.

    Slack 成功响应: 纯文本 "ok".
    """
    if not webhook:
        return False
    body = build_slack_payload(title, message, severity)

    def _client():
        return httpx.AsyncClient(timeout=_HTTP_TIMEOUT)

    def _check(_):
        return True  # Slack 返 "ok" 文本, 由 _post_with_retry 第二段逻辑处理

    ok, info = await _post_with_retry(_client, webhook, body, None, _check)
    if not ok:
        logger.warning(f"Slack push failed: {info}")
    return ok


# ---------------------------------------------------------------------------
# Microsoft Teams Incoming Webhook (MessageCard 简化)
# ---------------------------------------------------------------------------


def build_teams_payload(title: str, message: str, severity: str = "warning") -> dict:
    """构造 Teams Incoming Webhook payload (MessageCard 风格)."""
    color_map = {
        "critical": "FF0000",
        "error": "FF6600",
        "warning": "FFAA00",
        "info": "0078D7",
    }
    return {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": color_map.get((severity or "").lower(), "FFAA00"),
        "summary": title,
        "title": title,
        "text": message,
    }


async def push_teams(webhook: str, title: str, message: str, severity: str = "warning") -> bool:
    """推送到 Microsoft Teams Incoming Webhook.

    Teams 成功响应: 数字 "1" 文本.
    """
    if not webhook:
        return False
    body = build_teams_payload(title, message, severity)

    def _client():
        return httpx.AsyncClient(timeout=_HTTP_TIMEOUT)

    def _check(_):
        return True

    ok, info = await _post_with_retry(_client, webhook, body, None, _check)
    if not ok:
        logger.warning(f"Teams push failed: {info}")
    return ok


# ---------------------------------------------------------------------------
# Generic Custom Webhook
# ---------------------------------------------------------------------------


def build_generic_payload(title: str, message: str, severity: str = "warning", source: str = "zhs-platform") -> dict:
    """构造通用 JSON webhook payload (扁平结构, 易于下游系统解析)."""
    return {
        "title": title,
        "message": message,
        "severity": severity,
        "source": source,
    }


async def push_generic_webhook(
    url: str,
    title: str,
    message: str,
    severity: str = "warning",
    auth_header: str | None = None,
    source: str = "zhs-platform",
) -> bool:
    """推送到通用自定义 webhook (任意支持 POST + JSON 的端点).

    Args:
        url: 目标 URL
        title: 告警标题
        message: 告警详情
        severity: 严重度
        auth_header: 可选 Authorization 头 (e.g. "Bearer xxx")
        source: 标识来源

    Returns:
        bool: 2xx 视为成功
    """
    if not url:
        return False
    body = build_generic_payload(title, message, severity, source)
    headers = {"Content-Type": "application/json"}
    if auth_header:
        headers["Authorization"] = auth_header

    def _client():
        return httpx.AsyncClient(timeout=_HTTP_TIMEOUT)

    def _check(j):
        # 自定义 webhook 没统一响应格式, 只要 2xx 就视为成功 (外层已判定 status_code)
        return True

    ok, info = await _post_with_retry(_client, url, body, headers, _check)
    if not ok:
        logger.warning(f"Generic webhook push failed: {info}")
    return ok
