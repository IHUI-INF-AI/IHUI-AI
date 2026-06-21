"""建议 147 测试: alertmanager 端到端 e2e.

测试覆盖:
  - 真实 YAML 加载规则
  - in-process alertmanager 启动 / 停止
  - HTTP POST /api/v1/alerts 接 Prometheus alert
  - 抑制规则真生效 (走真 AlertInhibitor)
  - 转发到 webhook (mock)
  - active alerts 列表
  - 全链路: 告警 → alertmanager → 抑制 → webhook → push
  - 异常情况 (webhook 不可达, 告警 JSON 损坏)
  - 生产 yaml 与 app 端一致
"""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def zhs_rules_yaml():
    """指向生产 alertmanager.yml."""
    return Path(__file__).resolve().parent.parent / "docker" / "alertmanager" / "alertmanager.yml"


@pytest.fixture
def temp_rules_yaml(tmp_path):
    """临时 yaml (每测一个)."""
    content = """inhibit_rules:
  - source_match:
      alertname: 'X'
      severity: 'critical'
    target_match:
      alertname: 'Y'
    equal: ['service']
  - source_match:
      alertname: 'ZHS_Rollback'
      severity: 'critical'
    target_match:
      alertname: 'ZHS_Stuck'
    equal: ['service']
"""
    p = tmp_path / "test_alertmanager.yml"
    p.write_text(content, encoding="utf-8")
    return p


@pytest.fixture
def webhook_receiver():
    """起一个简单 HTTP server 接收 webhook POST."""
    received: list[list[dict]] = []
    received_lock = threading.Lock()
    server = None
    thread = None

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b"[]"
            try:
                alerts = json.loads(body.decode("utf-8"))
                if not isinstance(alerts, list):
                    alerts = [alerts]
            except Exception:
                alerts = []
            with received_lock:
                received.append(alerts)
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")

        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}", received
    server.shutdown()
    server.server_close()


# ---------------------------------------------------------------------------
# TestLoadInhibitionRules
# ---------------------------------------------------------------------------


class TestLoadInhibitionRules:
    """YAML 加载."""

    def test_load_temp_rules(self, temp_rules_yaml):
        from app.alertmanager_emulator import _load_inhibition_rules_from_yaml

        rules = _load_inhibition_rules_from_yaml(temp_rules_yaml)
        assert len(rules) == 2
        # rule 1: X critical → Y
        assert rules[0].source_matchers == {"alertname": "X", "severity": "critical"}
        assert rules[0].target_matchers == {"alertname": "Y"}
        assert rules[0].equal == ["service"]

    def test_load_production_yaml(self, zhs_rules_yaml):
        from app.alertmanager_emulator import _load_inhibition_rules_from_yaml

        rules = _load_inhibition_rules_from_yaml(zhs_rules_yaml)
        # 生产 yaml 6 条
        assert len(rules) == 6

    def test_load_missing_file(self, tmp_path):
        from app.alertmanager_emulator import _load_inhibition_rules_from_yaml

        with pytest.raises(FileNotFoundError):
            _load_inhibition_rules_from_yaml(tmp_path / "nope.yml")

    def test_load_empty_file(self, tmp_path):
        from app.alertmanager_emulator import _load_inhibition_rules_from_yaml

        p = tmp_path / "empty.yml"
        p.write_text("route:\n  receiver: 'x'\n", encoding="utf-8")
        rules = _load_inhibition_rules_from_yaml(p)
        assert rules == []


# ---------------------------------------------------------------------------
# TestAlertmanagerEmulatorLifecycle
# ---------------------------------------------------------------------------


class TestAlertmanagerEmulatorLifecycle:
    """模拟器启动 / 停止."""

    def test_start_stop(self, temp_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        url = emu.start()
        assert url.startswith("http://")
        assert emu._port > 0  # 自动分配
        emu.stop()
        assert emu._server is None

    def test_double_start_returns_same(self, temp_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        u1 = emu.start()
        u2 = emu.start()
        assert u1 == u2
        emu.stop()

    def test_health_endpoint(self, temp_rules_yaml):
        import urllib.request

        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            resp = urllib.request.urlopen(f"{emu.base_url}/health", timeout=3)
            assert resp.status == 200
            body = json.loads(resp.read().decode())
            assert body["status"] == "ok"
        finally:
            emu.stop()

    def test_unknown_endpoint_404(self, temp_rules_yaml):
        import urllib.error
        import urllib.request

        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            try:
                urllib.request.urlopen(f"{emu.base_url}/nope", timeout=3)
                assert False, "应 404"
            except urllib.error.HTTPError as e:
                assert e.code == 404
        finally:
            emu.stop()


# ---------------------------------------------------------------------------
# TestPushAlertInProcess
# ---------------------------------------------------------------------------


class TestPushAlertInProcess:
    """in-process 推送 (不走 HTTP, 走 push_alert 方法)."""

    def test_push_single(self, temp_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            emu.push_alert(
                {
                    "labels": {"alertname": "A", "severity": "info", "service": "api"},
                }
            )
            active = emu.get_active_alerts()
            assert len(active) == 1
            assert len(emu.fired_alerts) == 1
        finally:
            emu.stop()

    def test_push_inhibited_not_fired(self, temp_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            # X critical (source)
            emu.push_alert(
                {
                    "labels": {"alertname": "X", "severity": "critical", "service": "api"},
                }
            )
            assert len(emu.fired_alerts) == 1
            # Y warning (被抑制)
            emu.push_alert(
                {
                    "labels": {"alertname": "Y", "severity": "warning", "service": "api"},
                }
            )
            # fired 仍 1, 因为 Y 被抑制
            assert len(emu.fired_alerts) == 1
            # 但 active 是 2
            assert len(emu.get_active_alerts()) == 2
        finally:
            emu.stop()

    def test_clear_fired(self, temp_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            emu.push_alert({"labels": {"alertname": "A"}})
            assert len(emu.fired_alerts) == 1
            emu.clear_fired()
            assert len(emu.fired_alerts) == 0
            assert len(emu.get_active_alerts()) == 0
        finally:
            emu.stop()


# ---------------------------------------------------------------------------
# TestHTTPAlertReceive
# ---------------------------------------------------------------------------


class TestHTTPAlertReceive:
    """走真 HTTP API."""

    def test_http_post_alert(self, temp_rules_yaml):
        import urllib.request

        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            body = json.dumps(
                [
                    {
                        "labels": {"alertname": "Plain", "severity": "info", "service": "api"},
                    }
                ]
            ).encode()
            req = urllib.request.Request(
                f"{emu.base_url}/api/v1/alerts",
                data=body,
                headers={"Content-Type": "application/json"},
            )
            resp = urllib.request.urlopen(req, timeout=3)
            data = json.loads(resp.read().decode())
            assert data["status"] == "success"
            assert data["received"] == 1
            assert data["forwarded"] == 0  # 无 webhook
        finally:
            emu.stop()

    def test_http_post_with_inhibition(self, temp_rules_yaml):
        import urllib.request

        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            # 先推 X critical
            body = json.dumps(
                [
                    {
                        "labels": {"alertname": "X", "severity": "critical", "service": "api"},
                    }
                ]
            ).encode()
            urllib.request.urlopen(
                urllib.request.Request(
                    f"{emu.base_url}/api/v1/alerts",
                    data=body,
                    headers={"Content-Type": "application/json"},
                ),
                timeout=3,
            ).read()
            # 再推 Y warning (应被抑制)
            body = json.dumps(
                [
                    {
                        "labels": {"alertname": "Y", "severity": "warning", "service": "api"},
                    }
                ]
            ).encode()
            data = json.loads(
                urllib.request.urlopen(
                    urllib.request.Request(
                        f"{emu.base_url}/api/v1/alerts",
                        data=body,
                        headers={"Content-Type": "application/json"},
                    ),
                    timeout=3,
                )
                .read()
                .decode()
            )
            # Y 被抑制, after_inhibition 应 = 0 (X 已存在, Y 被 X 抑制)
            assert data["received"] == 1
            assert data["after_inhibition"] == 0
        finally:
            emu.stop()

    def test_http_get_active_alerts(self, temp_rules_yaml):
        import urllib.request

        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            emu.push_alert({"labels": {"alertname": "A", "service": "api"}})
            emu.push_alert({"labels": {"alertname": "B", "service": "api"}})
            resp = urllib.request.urlopen(f"{emu.base_url}/api/v1/alerts", timeout=3)
            data = json.loads(resp.read().decode())
            assert data["status"] == "success"
            assert len(data["data"]) == 2
        finally:
            emu.stop()


# ---------------------------------------------------------------------------
# TestWebhookForwarding
# ---------------------------------------------------------------------------


class TestWebhookForwarding:
    """抑制后转发到 webhook."""

    def test_forward_to_webhook(self, temp_rules_yaml, webhook_receiver):
        from app.alertmanager_emulator import AlertmanagerEmulator

        webhook_url, received = webhook_receiver
        emu = AlertmanagerEmulator(temp_rules_yaml, webhook_url=webhook_url, port=0)
        emu.start()
        try:
            # 不被抑制的告警 → 应转发
            emu.push_alert(
                {
                    "labels": {"alertname": "Plain", "severity": "info", "service": "api"},
                }
            )
            time.sleep(0.2)
            assert len(received) == 1
            # 检查内容
            alerts_in_webhook = received[0]
            assert len(alerts_in_webhook) == 1
            assert alerts_in_webhook[0]["labels"]["alertname"] == "Plain"
        finally:
            emu.stop()

    def test_inhibited_not_forwarded(self, temp_rules_yaml, webhook_receiver):
        from app.alertmanager_emulator import AlertmanagerEmulator

        webhook_url, received = webhook_receiver
        emu = AlertmanagerEmulator(temp_rules_yaml, webhook_url=webhook_url, port=0)
        emu.start()
        try:
            # X critical (source) → 转发
            emu.push_alert(
                {
                    "labels": {"alertname": "X", "severity": "critical", "service": "api"},
                }
            )
            # Y warning (被抑制) → 不转发
            emu.push_alert(
                {
                    "labels": {"alertname": "Y", "severity": "warning", "service": "api"},
                }
            )
            time.sleep(0.2)
            # 只收到 1 条 (X)
            assert len(received) == 1
            assert len(received[0]) == 1
            assert received[0][0]["labels"]["alertname"] == "X"
        finally:
            emu.stop()

    def test_unreachable_webhook_does_not_crash(self, temp_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(
            temp_rules_yaml,
            webhook_url="http://127.0.0.1:1/dead",  # 不可达
            port=0,
        )
        emu.start()
        try:
            # 应不抛错
            emu.push_alert({"labels": {"alertname": "A"}})
            # fired 仍记录 (in-process)
            assert len(emu.fired_alerts) == 1
        finally:
            emu.stop()


# ---------------------------------------------------------------------------
# TestProductionYamlIntegration
# ---------------------------------------------------------------------------


class TestProductionYamlIntegration:
    """生产 yaml 端到端集成."""

    def test_production_rollback_inhibits_stage(self, zhs_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(zhs_rules_yaml, port=0)
        emu.start()
        try:
            # ZHSRollbackActive critical
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSRollbackActive", "severity": "critical", "service": "canary"},
                }
            )
            # ZHSCanaryStageStuck warning (应被抑制)
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "canary"},
                }
            )
            # fired 应只有 1 条 (rollback)
            assert len(emu.fired_alerts) == 1
            assert emu.fired_alerts[0]["labels"]["alertname"] == "ZHSRollbackActive"
        finally:
            emu.stop()

    def test_production_db_down_inhibits_db_warnings(self, zhs_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(zhs_rules_yaml, port=0)
        emu.start()
        try:
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSDatabaseDown", "severity": "critical", "service": "db"},
                }
            )
            emu.push_alert(
                {
                    "labels": {"alertname": "DB_SlowQuery", "severity": "warning", "service": "db"},
                }
            )
            assert len(emu.fired_alerts) == 1
        finally:
            emu.stop()

    def test_production_different_service_not_inhibited(self, zhs_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(zhs_rules_yaml, port=0)
        emu.start()
        try:
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSRollbackActive", "severity": "critical", "service": "canary"},
                }
            )
            # 不同 service 不被抑制
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "other"},
                }
            )
            assert len(emu.fired_alerts) == 2
        finally:
            emu.stop()


# ---------------------------------------------------------------------------
# TestEndToEndWithWebhookReceiver
# ---------------------------------------------------------------------------


class TestEndToEndWithWebhookReceiver:
    """全链路: alertmanager → 抑制 → 真 webhook receiver → push (mocked)."""

    def test_e2e_critical_then_warning_suppressed(self, zhs_rules_yaml, webhook_receiver, monkeypatch):
        from app.alertmanager_emulator import AlertmanagerEmulator

        webhook_url, received = webhook_receiver
        # mock push_alert 计数
        push_calls = []

        async def mock_push(*args, **kwargs):
            push_calls.append((args, kwargs))
            return {}

        # 注入到 alert_service 模块
        monkeypatch.setattr("app.services.alert_service.push_alert", mock_push)
        emu = AlertmanagerEmulator(zhs_rules_yaml, webhook_url=webhook_url, port=0)
        emu.start()
        try:
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSRollbackActive", "severity": "critical", "service": "canary"},
                }
            )
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "canary"},
                }
            )
            time.sleep(0.3)
            # webhook 收到 1 条 (rollback), warning 被抑制不发
            assert len(received) == 1
            assert received[0][0]["labels"]["alertname"] == "ZHSRollbackActive"
        finally:
            emu.stop()


# ---------------------------------------------------------------------------
# TestEdgeCases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """边界情况."""

    def test_bad_json_400(self, temp_rules_yaml):
        import urllib.error
        import urllib.request

        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            req = urllib.request.Request(
                f"{emu.base_url}/api/v1/alerts",
                data=b"not json",
                headers={"Content-Type": "application/json"},
            )
            try:
                urllib.request.urlopen(req, timeout=3)
                assert False, "应 400"
            except urllib.error.HTTPError as e:
                assert e.code == 400
        finally:
            emu.stop()

    def test_alert_without_labels(self, temp_rules_yaml):
        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            emu.push_alert({})  # 无 labels
            assert len(emu.get_active_alerts()) == 1
            assert len(emu.fired_alerts) == 1
        finally:
            emu.stop()

    def test_empty_post_body(self, temp_rules_yaml):
        import urllib.request

        from app.alertmanager_emulator import AlertmanagerEmulator

        emu = AlertmanagerEmulator(temp_rules_yaml, port=0)
        emu.start()
        try:
            body = json.dumps([]).encode()
            req = urllib.request.Request(
                f"{emu.base_url}/api/v1/alerts",
                data=body,
                headers={"Content-Type": "application/json"},
            )
            resp = urllib.request.urlopen(req, timeout=3)
            data = json.loads(resp.read().decode())
            assert data["status"] == "success"
            assert data["received"] == 0
        finally:
            emu.stop()
