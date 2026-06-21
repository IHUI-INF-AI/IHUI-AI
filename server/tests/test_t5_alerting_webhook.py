"""T5 测试: Grafana 告警 webhook 端点.

覆盖:
1. webhook 接收基本告警 + 路由分发
2. severity/team 路由逻辑
3. 静默规则 (silence) 添加/查询/删除
4. 签名校验 (HMAC-SHA256)
5. 告警历史查询
6. 健康检查端点
7. 错误请求处理 (缺签名/坏 JSON)
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.alerting.webhook import router as webhook_router, _reset_state_for_tests


@pytest.fixture
def client():
    """构造独立的 FastAPI app + TestClient."""
    _reset_state_for_tests()
    app = FastAPI()
    app.include_router(webhook_router)
    return TestClient(app)


def _build_alert(alertname="TestAlert", severity="warning", team="default", status="firing", value="100"):
    """构造一个 Grafana 告警 payload."""
    return {
        "receiver": "zhs-webhook-default",
        "status": status,
        "alerts": [
            {
                "status": status,
                "labels": {
                    "alertname": alertname,
                    "severity": severity,
                    "team": team,
                },
                "annotations": {
                    "summary": f"{alertname} is {status}",
                    "description": f"Current value: {value}",
                },
                "value": value,
            }
        ],
        "groupLabels": {"alertname": alertname},
        "commonLabels": {"alertname": alertname, "severity": severity, "team": team},
        "commonAnnotations": {"summary": f"{alertname} is {status}"},
    }


def test_webhook_receives_basic_alert(client):
    """基本告警接收 + 路由."""
    payload = _build_alert("PaymentFailRate", severity="critical", team="pay")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["received"] == 1
    assert data["suppressed"] == 0
    detail = data["details"][0]
    assert detail["alertname"] == "PaymentFailRate"
    assert detail["severity"] == "critical"
    assert detail["team"] == "pay"
    assert detail["target"] == "dingtalk-pay"


def test_webhook_routes_warning_to_feishu(client):
    """Warning 级别路由到飞书."""
    payload = _build_alert("ChatLatencyHigh", severity="warning", team="ai")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    assert resp.status_code == 200
    detail = resp.json()["details"][0]
    assert detail["target"] == "feishu-ai"


def test_webhook_routes_critical_to_dingtalk(client):
    """Critical 级别路由到钉钉."""
    payload = _build_alert("DBDown", severity="critical", team="ops")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    assert resp.status_code == 200
    detail = resp.json()["details"][0]
    assert detail["target"] == "dingtalk-critical"


def test_webhook_routes_default_to_webhook(client):
    """未指定 severity → 走默认 webhook."""
    payload = _build_alert("UnknownAlert", severity="info", team="unknown")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    assert resp.status_code == 200
    detail = resp.json()["details"][0]
    assert detail["target"] == "webhook-default"


def test_webhook_signature_valid(client, monkeypatch):
    """配置 secret 后, 带正确签名的 webhook 通过."""
    secret = "test-secret-key"
    monkeypatch.setenv("GRAFANA_WEBHOOK_SECRET", secret)
    payload = _build_alert("TestSig")
    raw = json.dumps(payload).encode("utf-8")
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    resp = client.post(
        "/api/v1/alerting/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "X-Grafana-Webhook-Signature": sig},
    )
    assert resp.status_code == 200
    assert resp.json()["received"] == 1


def test_webhook_signature_invalid(client, monkeypatch):
    """配置 secret 后, 错误签名的 webhook 被拒绝."""
    secret = "test-secret-key"
    monkeypatch.setenv("GRAFANA_WEBHOOK_SECRET", secret)
    payload = _build_alert("TestBad")
    raw = json.dumps(payload).encode("utf-8")
    wrong_sig = "sha256=" + "a" * 64  # 错误签名

    resp = client.post(
        "/api/v1/alerting/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "X-Grafana-Webhook-Signature": wrong_sig},
    )
    assert resp.status_code == 401
    assert "Invalid signature" in resp.json()["detail"]


def test_webhook_signature_missing_rejected(client, monkeypatch):
    """配置 secret 但缺签名 → 401."""
    secret = "test-secret-key"
    monkeypatch.setenv("GRAFANA_WEBHOOK_SECRET", secret)
    payload = _build_alert("TestNoSig")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    assert resp.status_code == 401
    assert "Missing signature" in resp.json()["detail"]


def test_webhook_no_secret_accepts_all(client, monkeypatch):
    """未配置 secret → 接受所有 webhook (向后兼容)."""
    monkeypatch.delenv("GRAFANA_WEBHOOK_SECRET", raising=False)
    payload = _build_alert("NoSecret")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    assert resp.status_code == 200


def test_webhook_invalid_json(client):
    """坏 JSON → 400."""
    resp = client.post(
        "/api/v1/alerting/webhook",
        content=b"not a json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


def test_webhook_silence_rule_suppresses_alert(client):
    """静默规则抑制告警."""
    # 添加静默规则
    silence_rule = {
        "matchers": {"alertname": "SilencedAlert", "team": "pay"},
        "expires_at": time.time() + 3600,
        "comment": "Maintenance window",
    }
    resp = client.post("/api/v1/alerting/silence", json=silence_rule)
    assert resp.status_code == 200
    silence_id = resp.json()["id"]

    # 触发匹配的告警, 应被抑制
    payload = _build_alert("SilencedAlert", severity="critical", team="pay")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    data = resp.json()
    assert data["received"] == 0
    assert data["suppressed"] == 1
    assert data["details"][0]["reason"] == "silenced"

    # 删除静默规则
    resp = client.delete(f"/api/v1/alerting/silence/{silence_id}")
    assert resp.status_code == 200

    # 重新触发, 应被接收
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    data = resp.json()
    assert data["received"] == 1


def test_webhook_silence_partial_match_not_suppress(client):
    """静默规则部分匹配 → 不抑制."""
    silence_rule = {
        "matchers": {"alertname": "OnlyThis"},
        "expires_at": time.time() + 3600,
    }
    client.post("/api/v1/alerting/silence", json=silence_rule)

    # 不同 alertname 不应被抑制
    payload = _build_alert("OtherAlert", severity="critical", team="pay")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    data = resp.json()
    assert data["received"] == 1


def test_webhook_silence_expired(client):
    """过期的静默规则不抑制."""
    silence_rule = {
        "matchers": {"alertname": "Expired"},
        "expires_at": time.time() - 100,  # 已过期
    }
    resp = client.post("/api/v1/alerting/silence", json=silence_rule)
    # API 拒绝创建已过期的规则
    assert resp.status_code == 400


def test_webhook_history_query(client):
    """告警历史查询."""
    # 触发 3 条告警
    for i in range(3):
        payload = _build_alert(f"Alert{i}")
        client.post("/api/v1/alerting/webhook", json=payload)

    resp = client.get("/api/v1/alerting/history?limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    # 按时间倒序
    assert data["items"][0]["alertname"] == "Alert2"
    assert data["items"][1]["alertname"] == "Alert1"


def test_webhook_resolved_status(client):
    """resolved 状态的告警也能被接收."""
    payload = _build_alert("RecoveredAlert", status="resolved")
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    data = resp.json()
    assert data["received"] == 1
    assert data["details"][0]["status"] == "resolved"


def test_webhook_health(client):
    """健康检查端点."""
    resp = client.get("/api/v1/alerting/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "history_size" in data
    assert "active_silences" in data


def test_webhook_silence_list(client):
    """静默规则列表查询."""
    # 添加 2 条静默
    client.post(
        "/api/v1/alerting/silence",
        json={"matchers": {"a": "1"}, "expires_at": time.time() + 3600},
    )
    client.post(
        "/api/v1/alerting/silence",
        json={"matchers": {"b": "2"}, "expires_at": time.time() + 3600},
    )

    resp = client.get("/api/v1/alerting/silence")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active"] == 2
    assert len(data["rules"]) == 2


def test_webhook_multiple_alerts_in_one_payload(client):
    """一个 payload 多条告警."""
    payload = {
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {"alertname": "A1", "severity": "critical", "team": "pay"},
            },
            {
                "status": "firing",
                "labels": {"alertname": "A2", "severity": "warning", "team": "ai"},
            },
            {
                "status": "firing",
                "labels": {"alertname": "A3", "severity": "info", "team": "x"},
            },
        ],
    }
    resp = client.post("/api/v1/alerting/webhook", json=payload)
    data = resp.json()
    assert data["received"] == 3
    targets = {d["target"] for d in data["details"]}
    assert "dingtalk-pay" in targets
    assert "feishu-ai" in targets
    assert "webhook-default" in targets
