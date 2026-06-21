"""PagerDuty Events API v2 适配器 (Phase 10-C).

设计:
  - 严格遵循 PagerDuty Events v2 协议: POST {api_url}
  - payload 字段: summary / timestamp / source / severity / component / group / class / custom_details
  - severity 映射: critical / error / warning / info
  - dedup_key 自动从 alertname + service 生成 (业务防重)
  - 支持 trigger / acknowledge / resolve 三种 event_action
  - 支持入站 webhook 签名校验 (X-PagerDuty-Signature: HMAC-SHA256 of body, base64)
  - 失败重试 1 次 + 失败降级到 logger
  - 与现有 push_alert 统一接口风格一致
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from datetime import UTC, datetime

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 5.0
_PUSH_RETRY = 1

# 严重度映射: 业务 severity -> PagerDuty severity
SEVERITY_MAP = {
    "critical": "critical",
    "error": "error",
    "warning": "warning",
    "info": "info",
    "firing": "error",
    "resolved": "info",
}


def _map_severity(severity: str) -> str:
    """业务侧 severity -> PagerDuty severity."""
    return SEVERITY_MAP.get((severity or "").lower(), "warning")


def _build_event(
    routing_key: str,
    event_action: str,
    dedup_key: str,
    summary: str,
    source: str,
    severity: str,
    component: str | None = None,
    group: str | None = None,
    cls: str | None = None,
    custom_details: dict | None = None,
    timestamp: str | None = None,
) -> dict:
    """构造 PagerDuty Events v2 event payload.

    严格匹配官方协议: https://developer.pagerduty.com/docs/events-api-v2/overview/
    """
    payload = {
        "summary": summary,
        "source": source,
        "severity": _map_severity(severity),
    }
    if timestamp is None:
        timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    payload["timestamp"] = timestamp
    if component:
        payload["component"] = component
    if group:
        payload["group"] = group
    if cls:
        payload["class"] = cls
    if custom_details:
        payload["custom_details"] = custom_details
    return {
        "routing_key": routing_key,
        "event_action": event_action,
        "dedup_key": dedup_key,
        "payload": payload,
    }


def make_dedup_key(alertname: str, service: str = "", instance: str = "") -> str:
    """业务级 dedup_key: alertname + service + instance, 稳定去重.

    同一告警源在 PagerDuty 侧只产生一个 incident (open → resolved 链路清晰).
    """
    parts = [p for p in [alertname, service, instance] if p]
    return "/".join(parts) or "zhs/unknown"


async def _post_with_retry(client_factory, url: str, body: dict, success_check) -> tuple[bool, str]:
    """统一 POST + 重试封装. 与 alert_service._post_with_retry 同语义."""
    import asyncio

    last_err = ""
    for attempt in range(_PUSH_RETRY + 1):
        try:
            async with client_factory() as client:
                resp = await client.post(url, json=body)
                if resp.status_code in (200, 201, 202) and success_check(resp):
                    return True, "ok"
                last_err = f"http={resp.status_code} body={resp.text[:200]}"
        except Exception as e:
            last_err = f"err={e}"
        if attempt < _PUSH_RETRY:
            await asyncio.sleep(0.3 * (attempt + 1))
    return False, last_err


async def push_pagerduty(
    routing_key: str,
    title: str,
    message: str,
    severity: str = "warning",
    dedup_key: str | None = None,
    source: str = "zhs-platform",
    component: str | None = None,
    group: str | None = None,
    cls: str | None = None,
    custom_details: dict | None = None,
    event_action: str = "trigger",
    api_url: str | None = None,
) -> bool:
    """推送到 PagerDuty Events API v2.

    Args:
        routing_key: PagerDuty Integration Key (32 位 hex 串)
        title: 告警标题 (会作为 payload.summary)
        message: 告警详情 (会作为 payload.custom_details.message)
        severity: 业务严重度
        dedup_key: 业务去重键, 缺省 = "zhs/unknown"
        source: 来源标识 (e.g. "zhs-platform:api")
        component: 组件 (e.g. "database")
        group: 分组 (e.g. "prod-api")
        cls: 类别 (e.g. "deploy")
        custom_details: 透传的自定义字段
        event_action: trigger / acknowledge / resolve
        api_url: PagerDuty API URL, 缺省取 settings.PAGERDUTY_API_URL

    Returns:
        bool: 推送是否成功
    """
    if not routing_key:
        logger.warning("PagerDuty routing_key 未配置, 跳过推送")
        return False
    url = api_url or settings.PAGERDUTY_API_URL
    if not url:
        logger.warning("PagerDuty api_url 未配置, 跳过推送")
        return False

    details = dict(custom_details or {})
    details.setdefault("message", message)

    body = _build_event(
        routing_key=routing_key,
        event_action=event_action,
        dedup_key=dedup_key or "zhs/unknown",
        summary=title,
        source=source,
        severity=severity,
        component=component,
        group=group,
        cls=cls,
        custom_details=details,
    )

    def _client():
        return httpx.AsyncClient(timeout=_HTTP_TIMEOUT)

    def _check(resp):
        # PagerDuty v2 成功响应: {"status": "success", "message": ..., "dedup_key": ...}
        # 兼容演练/mock: {"received": true} / {"ok": true}
        try:
            j = resp.json()
            if j.get("status") == "success":
                return True
            return bool(j.get("ok") is True or j.get("received") is True)
        except Exception:
            return False

    ok, info = await _post_with_retry(_client, url, body, _check)
    if not ok:
        logger.warning(f"PagerDuty push failed: {info}")
    return ok


def verify_pagerduty_webhook_signature(body: bytes, signature_header: str, secret: str) -> bool:
    """校验 PagerDuty 入站 webhook 签名 (X-PagerDuty-Signature).

    PagerDuty 签名: HMAC-SHA256(secret, body), base64 编码, 头格式:
        X-PagerDuty-Signature: v1=<base64>
    多版本时可同时存在多个 (空格分隔), 这里只校验 v1.

    Args:
        body: 原始请求体 (bytes, 必须与签名时一致)
        signature_header: X-PagerDuty-Signature 头值
        secret: 共享密钥

    Returns:
        bool: 签名是否合法
    """
    if not body or not signature_header or not secret:
        return False
    expected = base64.b64encode(hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()).decode("ascii")
    # 多版本头解析: "v1=xxx v1=yyy"
    parts = []
    for piece in signature_header.split():
        if "=" in piece:
            v, _, val = piece.partition("=")
            if v.strip() == "v1":
                parts.append(val.strip())
    if not parts:
        return False
    # 任意一个匹配即通过 (PagerDuty 实际可能轮换多个签名)
    return any(hmac.compare_digest(p.encode("ascii"), expected.encode("ascii")) for p in parts)


def sign_pagerduty_webhook_body(body: bytes, secret: str) -> str:
    """生成 PagerDuty 出站签名 (用于自测 / 演练 outbound 模拟).

    Args:
        body: 原始请求体 bytes
        secret: 共享密钥

    Returns:
        str: 形如 "v1=base64..."
    """
    sig = base64.b64encode(hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()).decode("ascii")
    return f"v1={sig}"


def from_prometheus_alert(alert: dict) -> dict:
    """将 Prometheus/Alertmanager 告警转 PagerDuty 事件参数.

    提取 labels.alertname / severity / instance / service 作为 dedup/source 字段,
    把 annotations.description / summary 透传到 custom_details.

    Args:
        alert: 符合 Alertmanager 4 格式的 dict

    Returns:
        dict: 可直接 unpack 到 push_pagerduty() 的 kwargs
    """
    labels = alert.get("labels", {}) or {}
    annotations = alert.get("annotations", {}) or {}
    alertname = labels.get("alertname", "UnknownAlert")
    severity = labels.get("severity", "warning")
    service = labels.get("service", "")
    instance = labels.get("instance", "")
    is_resolved = alert.get("status", "firing") == "resolved"
    return {
        "title": f"[{alertname}] {annotations.get('summary', alertname)}",
        "message": annotations.get("description", ""),
        "severity": "info" if is_resolved else severity,
        "dedup_key": make_dedup_key(alertname, service, instance),
        "source": f"zhs-platform:{service}" if service else "zhs-platform",
        "component": labels.get("component"),
        "group": service or None,
        "cls": labels.get("class"),
        "custom_details": {
            "alertname": alertname,
            "service": service,
            "instance": instance,
            "status": alert.get("status", "firing"),
            "annotations": annotations,
        },
        "event_action": "resolve" if is_resolved else "trigger",
    }
