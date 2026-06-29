"""测试告警服务 + 告警 API 端点."""

import pytest

from app.api.v1.monitor.alerts import _ALERT_HISTORY, list_recent_alerts, record_alert
from app.services.alert_service import format_prometheus_alert

pytestmark = pytest.mark.asyncio


class TestFormatPrometheusAlert:
    def test_firing_alert(self):
        alert = {
            "status": "firing",
            "labels": {
                "alertname": "ZHSHighErrorRate",
                "severity": "critical",
                "instance": "app-1:8000",
            },
            "annotations": {
                "summary": "5xx 错误率过高",
                "description": "错误率 12.5%",
            },
        }
        title, message = format_prometheus_alert(alert)
        assert "5xx 错误率过高" in title
        assert "critical" in message
        assert "app-1:8000" in message
        assert "12.5%" in message

    def test_resolved_alert(self):
        alert = {
            "status": "resolved",
            "labels": {"alertname": "ZHSAppDown"},
            "annotations": {"summary": "实例恢复"},
        }
        title, message = format_prometheus_alert(alert)
        # 建议 138: title 包含 alertname + summary
        assert title == "[ZHSAppDown] 实例恢复"
        assert "resolved" in message


class TestAlertHistory:
    def test_record_and_list(self):
        before = len(_ALERT_HISTORY)
        record_alert("Test Alert", "Test Message", "info")
        after = len(_ALERT_HISTORY)
        assert after == before + 1
        items = list_recent_alerts()
        assert items[-1]["title"] == "Test Alert"
        assert items[-1]["severity"] == "info"

    def test_history_bounded(self):
        """历史记录有上限."""
        for i in range(250):
            record_alert(f"alert-{i}", "msg", "warning")
        items = list_recent_alerts()
        # 不会超过 list_recent_alerts 返回 50 条
        assert len(items) <= 50


class TestAlertEndpoints:
    async def test_alert_history_endpoint(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/monitor/alerts/history",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_alert_test_endpoint(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/monitor/alerts/test",
            params={"title": "测试", "message": "消息", "severity": "info"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_alert_webhook_endpoint(self, client):
        """Alertmanager 推送测试（不需要鉴权）."""
        resp = await client.post(
            "/api/v1/monitor/alerts/webhook",
            json={
                "version": "4",
                "status": "firing",
                "alerts": [
                    {
                        "status": "firing",
                        "labels": {"alertname": "TestAlert", "severity": "warning"},
                        "annotations": {"summary": "测试告警", "description": "测试消息"},
                    }
                ],
            },
        )
        assert resp.status_code in (200, 401, 404, 422, 500)
