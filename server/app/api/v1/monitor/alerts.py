"""告警管理端点 -- 测试推送 / 接收 Alertmanager webhook."""

import hashlib
import hmac
import os
import threading

from fastapi import APIRouter, Depends, HTTPException, Request

from app.alert_inhibition import get_default_inhibitor
from app.schemas.common import success
from app.security import require_login
from app.services.alert_service import (
    format_prometheus_alert,
    push_alert,
)
from app.utils.datetime_helper import utcnow

router = APIRouter()


@router.post("/test", summary="测试告警推送(手工触发)")
async def test_alert(
    title: str = "测试告警",
    message: str = "ZHS Platform 告警通道测试",
    severity: str = "info",
    user_uuid: str = Depends(require_login),
):
    """向所有已配置渠道发一条测试消息."""
    result = await push_alert(title, message, severity)
    return success({"channels": result, "any_success": any(result.values())})


@router.post("/webhook", summary="Alertmanager webhook 接收")
async def alertmanager_webhook(request: Request, dry_run: bool = False):
    """接收 Alertmanager 的告警,转推到钉钉/微信/飞书.

    Alertmanager webhook 格式:
    {
      "version": "4",
      "status": "firing",
      "alerts": [
        {"status": "firing", "labels": {...}, "annotations": {...}}
      ]
    }

    建议 100 改进: resolved 告警也写入 _ALERT_HISTORY (恢复也是重要事件),
    但不再推送 (避免打扰); 严重度变化 (critical → warning) 也走一次 push.

    建议 141: 在 push 前应用 alertmanager inhibition 抑制规则,
    避免 critical 类告警触发时, 关联 warning 告警一起骚扰.

    建议 146: dry_run=true 时只统计会抑制哪些, 不真推. 通过查询参数 ?dry_run=true 开启.
    """
    # 2026-06-25 安全加固: 验证 Alertmanager webhook 签名 (HMAC-SHA256),
    # 防止未授权请求伪造告警, 避免钉钉/微信/飞书被骚扰或恶意告警注入.
    # 配置方式: 环境变量 ALERTMANAGER_WEBHOOK_SECRET 与 Alertmanager
    #   `http_config.bearer_token` 或 `sign` 中间件共享同一密钥.
    raw_body = await request.body()
    secret = os.environ.get("ALERTMANAGER_WEBHOOK_SECRET", "")
    if secret:
        # 从 header 中提取签名, 兼容多种命名 (签名 vs bearer vs custom header)
        sig_header = (
            request.headers.get("X-Alertmanager-Signature", "")
            or request.headers.get("X-Hub-Signature-256", "")
            or request.headers.get("X-Webhook-Signature", "")
        )
        if sig_header:
            expected = "sha256=" + hmac.new(
                secret.encode("utf-8"), raw_body, hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected, sig_header):
                raise HTTPException(status_code=401, detail="Invalid signature")
        else:
            # 配置了 secret 但没带签名, 拒绝 (除非 dry_run 是内网测试)
            if not dry_run:
                raise HTTPException(status_code=401, detail="Missing signature")
    # 解析 payload (签名通过后)
    import json as _json

    try:
        body = _json.loads(raw_body)
    except _json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}") from e
    raw_alerts = body.get("alerts", [])
    firing = [a for a in raw_alerts if a.get("status") == "firing"]
    # 建议 141: 抑制过滤
    inhibitor = get_default_inhibitor()
    # 建议 146: dry_run 预测
    if dry_run:
        # 不真抑制, 仍把"会被抑制"的告警列出来
        suppressed_pairs = inhibitor.would_suppress_with_reason(firing)
        surviving = list(firing)  # 全部返回
        return success(
            {
                "received": len(raw_alerts),
                "firing": len(firing),
                "pushed": 0,
                "suppressed": len(suppressed_pairs),
                "dry_run": True,
                "suppressed_alerts": [
                    {
                        "alertname": a.get("labels", {}).get("alertname"),
                        "severity": a.get("labels", {}).get("severity"),
                        "service": a.get("labels", {}).get("service"),
                        "inhibited_by_rule": rn,
                    }
                    for a, rn in suppressed_pairs
                ],
            }
        )
    surviving = inhibitor.apply(firing)
    pushed = 0
    for alert in surviving:
        title, message = format_prometheus_alert(alert)
        severity = alert.get("labels", {}).get("severity", "warning")
        await push_alert(title, message, severity)
        pushed += 1
        record_alert(title, message, severity)
    # firing / resolved 都写 history (建议 100)
    for alert in raw_alerts:
        title, message = format_prometheus_alert(alert)
        severity = alert.get("labels", {}).get("severity", "warning")
        record_alert(title, message, severity)
    return success(
        {
            "received": len(raw_alerts),
            "firing": len(firing),
            "pushed": pushed,
            "suppressed": len(firing) - pushed,
            "dry_run": False,
        }
    )


@router.get("/history", summary="最近告警历史(内存中)")
async def alert_history(user_uuid: str = Depends(require_login)):
    """返回最近 50 条告警记录(简易版)."""

    history = list_recent_alerts()
    return success({"count": len(history), "items": history})


# ---------------------------------------------------------------------------
# 简易内存告警历史
# ---------------------------------------------------------------------------
_ALERT_HISTORY: list = []
_HISTORY_MAX = 200
_history_lock = threading.Lock()


def list_recent_alerts() -> list:
    with _history_lock:
        return list(_ALERT_HISTORY[-50:])


def record_alert(title: str, message: str, severity: str = "warning") -> None:
    with _history_lock:
        _ALERT_HISTORY.append(
            {
                "title": title,
                "message": message,
                "severity": severity,
                "ts": utcnow().isoformat() + "Z",
            }
        )
        if len(_ALERT_HISTORY) > _HISTORY_MAX:
            del _ALERT_HISTORY[: len(_ALERT_HISTORY) - _HISTORY_MAX]
