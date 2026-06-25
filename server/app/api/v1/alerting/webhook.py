#!/usr/bin/env python3
"""T5 测试: Grafana 告警 webhook 端点.

功能:
1. 接收 Grafana 告警 webhook POST
2. 解析 payload 提取 labels + annotations
3. 根据 severity 转发到不同渠道 (钉钉/飞书/邮件)
4. 验证 webhook 签名 (X-Grafana-Webhook-Signature)
5. 记录告警历史到 Redis (供查询)
6. 静默 (silence) 支持
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field

from app.security import require_login, require_role

router = APIRouter(prefix="/api/v1/alerting", tags=["Alerting Webhook"])

# 内存告警历史 (生产用 Redis 替代)
_alert_history: list[dict] = []
# 静默规则 (label matchers)
_silences: list[dict] = []


class AlertLabel(BaseModel):
    """Grafana alert label."""

    alertname: str | None = None
    severity: str = "warning"
    team: str = "default"


class AlertPayload(BaseModel):
    """Grafana alert payload (simplified)."""

    receiver: str = ""
    status: str = "firing"  # firing / resolved
    alerts: list[dict] = Field(default_factory=list)
    groupLabels: dict[str, str] = Field(default_factory=dict)  # noqa: 5
    commonLabels: dict[str, str] = Field(default_factory=dict)  # noqa: 5
    commonAnnotations: dict[str, str] = Field(default_factory=dict)  # noqa: 5


@router.post("/webhook", summary="Receive Grafana alert webhook")
async def receive_webhook(
    request: Request,
    x_grafana_webhook_signature: str | None = Header(None, alias="X-Grafana-Webhook-Signature"),
):
    """接收 Grafana 告警 webhook.

    验证流程:
      1. 解析 JSON body
      2. 校验 X-Grafana-Webhook-Signature (HMAC-SHA256)
      3. 遍历 alerts, 根据 severity + team 路由
      4. 跳过 silenced 告警
      5. 记录到 _alert_history
    """
    import os
    raw = await request.body()

    # 1) 签名校验 (可选, 防止未授权 webhook 触发)
    secret = os.environ.get("GRAFANA_WEBHOOK_SECRET", "")
    if secret and x_grafana_webhook_signature:
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), raw, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, x_grafana_webhook_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
    elif secret and not x_grafana_webhook_signature:
        # 配置了 secret 但没带签名, 拒绝
        raise HTTPException(status_code=401, detail="Missing signature")

    # 2) 解析 payload
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON: %s", e)
        raise HTTPException(status_code=400, detail="请求体格式错误") from e

    status = data.get("status", "firing")
    alerts = data.get("alerts", [])

    received = []
    suppressed = []
    for alert in alerts:
        labels = alert.get("labels", {})
        alertname = labels.get("alertname", "unknown")
        severity = labels.get("severity", "warning")
        team = labels.get("team", "default")

        # 3) 静默检查
        if _is_silenced(labels):
            suppressed.append({"alertname": alertname, "reason": "silenced"})
            continue

        # 4) 路由分发
        target = _route_alert(severity, team)
        received.append({
            "alertname": alertname,
            "severity": severity,
            "team": team,
            "target": target,
            "status": status,
            "timestamp": time.time(),
        })
        # 5) 记录历史
        _alert_history.append({
            "alertname": alertname,
            "severity": severity,
            "team": team,
            "target": target,
            "status": status,
            "received_at": time.time(),
        })
        # 限制历史大小
        if len(_alert_history) > 1000:
            _alert_history.pop(0)

    logger.info(f"Alert webhook: {len(received)} received, {len(suppressed)} suppressed")
    return {
        "received": len(received),
        "suppressed": len(suppressed),
        "details": received + suppressed,
    }


def _route_alert(severity: str, team: str) -> str:
    """根据 severity + team 路由告警到不同渠道."""
    if severity == "critical":
        if team == "pay":
            return "dingtalk-pay"
        return "dingtalk-critical"
    elif severity == "warning":
        if team == "ai":
            return "feishu-ai"
        return "feishu-warning"
    return "webhook-default"


def _is_silenced(labels: dict[str, str]) -> bool:
    """检查告警是否被静默."""
    now = time.time()
    for silence in _silences:
        if silence.get("expires_at", 0) < now:
            continue  # 已过期的静默
        matchers = silence.get("matchers", {})
        match = True
        for k, v in matchers.items():
            if labels.get(k) != v:
                match = False
                break
        if match:
            return True
    return False


@router.get("/history", summary="Query alert history")
def get_history(limit: int = 50, _: str = Depends(require_login)):
    """查询最近 N 条告警记录 (按时间倒序)."""
    sorted_hist = sorted(_alert_history, key=lambda x: x["received_at"], reverse=True)
    return {"total": len(_alert_history), "items": sorted_hist[:limit]}


@router.post("/silence", summary="Add silence rule")
def add_silence(rule: dict, _: str = Depends(require_role("admin"))):
    """添加静默规则.

    body: {"matchers": {"alertname": "X", "team": "pay"}, "expires_at": 1234567890, "comment": "..."}
    """
    if "matchers" not in rule or "expires_at" not in rule:
        raise HTTPException(status_code=400, detail="missing matchers or expires_at")
    if rule["expires_at"] < time.time():
        raise HTTPException(status_code=400, detail="expires_at must be in future")
    _silences.append(rule)
    return {"id": len(_silences) - 1, "rule": rule}


@router.get("/silence", summary="List silence rules")
def list_silences(_: str = Depends(require_login)):
    """列出所有静默规则 (按时间排序)."""
    now = time.time()
    active = [s for s in _silences if s.get("expires_at", 0) > now]
    return {"active": len(active), "rules": active}


@router.delete("/silence/{silence_id}", summary="Remove silence rule")
def remove_silence(silence_id: int, _: str = Depends(require_role("admin"))):
    """删除静默规则."""
    if 0 <= silence_id < len(_silences):
        removed = _silences.pop(silence_id)
        return {"removed": removed}
    raise HTTPException(status_code=404, detail="silence not found")


@router.get("/health", summary="Webhook health check")
def health():
    """健康检查端点."""
    return {"status": "ok", "history_size": len(_alert_history), "active_silences": len(_silences)}


# 导出供测试使用
def _reset_state_for_tests():
    """测试用: 重置全局状态."""
    global _alert_history, _silences
    _alert_history = []
    _silences = []
