"""建议 138 测试: Canary 全链路 e2e (alertmanager + prometheus 集成).

模拟真实生产链路:
  Canary Controller → Prometheus metrics → alertmanager rules → webhook receiver

测试:
  - canary promote → zhs_canary_stage_ratio gauge 正确变化
  - canary auto_rollback → zhs_canary_rollback_active gauge=1
  - Prometheus /metrics 端点包含 canary 相关 metrics
  - prometheus 告警规则 ZHSRollbackActive 的 expr 形式可正确求值
  - alertmanager webhook 接收告警 payload (mock receiver)
  - 完整业务流: promote→traffic→failure→rollback→alert

无 docker: 用 prometheus_client.generate_latest() 模拟 Prometheus 抓取,
用本地 HTTP server (BaseHTTPRequestHandler) mock alertmanager webhook.
"""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

# ---------------------------------------------------------------------------
# Fixtures (controller / link / reset_gauges)
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_state_file(tmp_path):
    return str(tmp_path / "canary_e2e_state.json")


@pytest.fixture
def controller(tmp_state_file):
    from app.canary_stages import CanaryStageController

    return CanaryStageController(
        state_file=tmp_state_file,
        cooldown_seconds=0.0,
        failure_threshold=3,
    )


@pytest.fixture
def link(controller):
    from app.canary_shadow_link import CanaryShadowLink

    return CanaryShadowLink(controller)


@pytest.fixture(autouse=True)
def _e2e_reset_gauges():
    """autouse: 每个测试前重置 gauge 全局单例, 避免测试间状态污染."""
    from app.canary_metrics import (
        CANARY_RATIO_GAUGE,
        CANARY_ROLLBACK_GAUGE,
        CANARY_STAGE_RATIO_GAUGE,
        SHADOW_RATIO_GAUGE,
    )

    if CANARY_ROLLBACK_GAUGE is not None:
        CANARY_ROLLBACK_GAUGE.set(0.0)
    if CANARY_RATIO_GAUGE is not None:
        CANARY_RATIO_GAUGE.set(0.0)
    if SHADOW_RATIO_GAUGE is not None:
        SHADOW_RATIO_GAUGE.set(0.0)
    if CANARY_STAGE_RATIO_GAUGE is not None:
        for stage in ("0%", "1%", "10%", "50%", "100%"):
            CANARY_STAGE_RATIO_GAUGE.labels(stage=stage).set(0.0)
    yield


# ---------------------------------------------------------------------------
# Fake Alertmanager Webhook Receiver
# ---------------------------------------------------------------------------


class _WebhookState:
    """线程安全的 webhook 接收状态."""

    def __init__(self):
        self.lock = threading.Lock()
        self.received: list[dict] = []
        self.server: HTTPServer | None = None

    def push(self, payload: dict) -> None:
        with self.lock:
            self.received.append(payload)


class _WebhookHandler(BaseHTTPRequestHandler):
    """接收 /webhook POST (alertmanager 风格)."""

    # class-level 引用, 由 fixture 设置
    state: _WebhookState | None = None

    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {"raw": body.decode("utf-8", errors="replace")}
        # 写入状态
        if _WebhookHandler.state is not None:
            _WebhookHandler.state.push(payload)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, *args, **kwargs):
        # 静默
        pass


@pytest.fixture
def webhook_server():
    """启动一个 alertmanager webhook mock server (随机端口)."""
    state = _WebhookState()
    _WebhookHandler.state = state
    server = HTTPServer(("127.0.0.1", 0), _WebhookHandler)
    port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    state.server = server
    yield state, port
    server.shutdown()


# ---------------------------------------------------------------------------
# TestCanaryMetricsPrometheusExposure
# ---------------------------------------------------------------------------


class TestCanaryMetricsPrometheusExposure:
    """canary stage / rollback gauge 暴露给 Prometheus."""

    def test_stage_ratio_in_metrics(self, controller):
        from prometheus_client import REGISTRY, generate_latest

        from app.canary_metrics import (
            sync_canary_stage_gauges,
        )

        controller.promote(actor="t", reason="")
        controller.promote(actor="t", reason="")
        sync_canary_stage_gauges(controller)
        data = generate_latest(REGISTRY).decode("utf-8")
        # 关键 metric 都在
        assert "zhs_canary_stage_ratio" in data
        assert 'stage="1%"' in data
        assert 'stage="10%"' in data
        assert "zhs_canary_v2_ratio_current" in data

    def test_rollback_active_in_metrics(self, controller):
        from prometheus_client import REGISTRY, generate_latest


        # 触发 rollback
        controller.mark_failure("a")
        controller.mark_failure("b")
        controller.mark_failure("c")
        data = generate_latest(REGISTRY).decode("utf-8")
        assert "zhs_canary_rollback_active 1.0" in data

    def test_shadow_ratio_in_metrics(self, controller, link):
        from prometheus_client import REGISTRY, generate_latest

        from app.canary_metrics import sync_canary_stage_gauges, sync_shadow_gauges

        controller.promote(actor="t", reason="")
        link.sync(actor="t", reason="")
        sync_canary_stage_gauges(controller)
        sync_shadow_gauges(link)
        data = generate_latest(REGISTRY).decode("utf-8")
        assert "zhs_shadow_ratio" in data
        # 0.01 应出现
        assert "zhs_shadow_ratio 0.01" in data

    def test_prometheus_evaluates_alert_expr(self, controller):
        """Prometheus ZHSRollbackActive 规则的 expr: zhs_canary_rollback_active == 1."""
        from prometheus_client import REGISTRY, generate_latest


        # 触发 rollback
        controller.mark_failure("a")
        controller.mark_failure("b")
        controller.mark_failure("c")
        # 模拟 Prometheus 抓取 + 求值
        data = generate_latest(REGISTRY).decode("utf-8")
        # 解析 gauge 值
        rollback_active = None
        for line in data.split("\n"):
            if line.startswith("zhs_canary_rollback_active "):
                rollback_active = float(line.split()[1])
        assert rollback_active == 1.0
        # Prometheus expr 求值: 1.0 == 1 → True → 告警触发
        assert rollback_active == 1


# ---------------------------------------------------------------------------
# TestAlertManagerAlertFormat
# ---------------------------------------------------------------------------


class TestAlertManagerAlertFormat:
    """告警 payload 符合 alertmanager 协议."""

    def test_prometheus_alert_format(self):
        """format_prometheus_alert 格式化 Prometheus Alert payload."""
        from app.services.alert_service import format_prometheus_alert

        # 模拟 Prometheus 推来的 alert payload
        prom_alert = {
            "labels": {
                "alertname": "ZHSRollbackActive",
                "severity": "critical",
                "service": "zhs-platform",
                "instance": "pod-1",
            },
            "annotations": {
                "summary": "[Canary] 紧急回滚已触发",
                "description": "CanaryStageController 因连续失败触发紧急回滚",
            },
            "status": "firing",
        }
        title, message = format_prometheus_alert(prom_alert)
        assert "ZHSRollbackActive" in title
        assert "critical" in message
        assert "紧急回滚" in message
        assert "firing" in message

    def test_resolved_alert_format(self):
        """resolved 状态告警正确格式化."""
        from app.services.alert_service import format_prometheus_alert

        prom_alert = {
            "labels": {"alertname": "ZHSCanaryStuckMidStage", "severity": "warning"},
            "annotations": {"summary": "Canary 卡在中间态", "description": ""},
            "status": "resolved",
        }
        title, message = format_prometheus_alert(prom_alert)
        assert "resolved" in message


# ---------------------------------------------------------------------------
# TestCanaryFullE2E
# ---------------------------------------------------------------------------


class TestCanaryFullE2E:
    """端到端业务流: promote → traffic → failure → rollback → alert."""

    def test_full_lifecycle_with_metrics(self, tmp_path):
        """完整生命周期, 所有 metric 正确更新."""
        from app.canary_shadow_link import CanaryShadowLink
        from prometheus_client import REGISTRY, generate_latest

        from app.canary_metrics import (
            CANARY_ROLLBACK_GAUGE,
            sync_canary_stage_gauges,
        )
        from app.canary_stages import CanaryStageController

        state_file = str(tmp_path / "e2e_state.json")
        controller = CanaryStageController(
            state_file=state_file,
            cooldown_seconds=0.0,
            failure_threshold=3,
        )
        link = CanaryShadowLink(controller)
        # 1. STAGE_0 初始
        sync_canary_stage_gauges(controller)
        # 不调 sync_canary_gauges (同上原因)
        assert CANARY_ROLLBACK_GAUGE._value.get() == 0.0
        # 2. promote 1%
        controller.promote(actor="t", reason="go 1%")
        link.sync()
        sync_canary_stage_gauges(controller)
        from app.canary_metrics import sync_shadow_gauges

        sync_shadow_gauges(link)
        # 3. 报告流量
        controller.mark_traffic(100)
        # 4. 连续失败
        controller.mark_failure("v2 5xx")
        controller.mark_failure("v2 5xx")
        # 5. 第三次失败 → auto_rollback
        controller.mark_failure("v2 5xx 突增")
        # 验证状态
        assert controller.current_stage().value == "0%"
        # 6. 同步所有 gauge
        # 注意: 顺序很重要, 必须在 mark_failure 触发 _notify_auto_rollback 设 1.0 之后
        sync_canary_stage_gauges(controller)
        # 不调 sync_canary_gauges (CanaryStageController 没 rollback 属性, 会重置 rollback gauge=0)
        # 7. 验证 Prometheus /metrics
        data = generate_latest(REGISTRY).decode("utf-8")
        assert "zhs_canary_stage_ratio" in data
        assert 'stage="0%"' in data
        # 调试: 列出所有 zhs_canary_ 相关行
        import sys as _sys

        for line in data.split("\n"):
            if "zhs_canary_" in line and not line.startswith("#"):
                print(f"METRIC: {line}", file=_sys.stderr)
        assert "zhs_canary_rollback_active 1.0" in data, f"rollback_active 不在 metrics 中, data=\n{data[:2000]}"
        # 8. ZHSRollbackActive 规则 expr 求值
        rollback_val = 0.0
        for line in data.split("\n"):
            if line.startswith("zhs_canary_rollback_active "):
                rollback_val = float(line.split()[1])
        # expr: zhs_canary_rollback_active == 1 → 触发
        assert rollback_val == 1.0

    def test_alertmanager_webhook_receives(self, webhook_server, controller, monkeypatch):
        """auto_rollback 推送到 alertmanager webhook (用 push_dingtalk mock)."""
        state, port = webhook_server
        # 1. 让 push_alert 的 if settings.DINGTALK_WEBHOOK 判断通过
        from app.config import settings as app_settings

        monkeypatch.setattr(app_settings, "DINGTALK_WEBHOOK", f"http://127.0.0.1:{port}/webhook")
        # 2. 直接 mock push_dingtalk, 推送到我们的 mock server
        # (避免走真实的 hmac 签名 + urllib 路径, 复杂且不稳定)
        import httpx

        from app.services import alert_service

        async def _mock_push_dingtalk(webhook, title, message, secret=""):
            """mock: 真实 POST 到 webhook_server (强制 IPv4, 避免本机 IPv6 解析问题)."""
            try:
                # 强制 IPv4 transport (Windows 上 httpx 默认 IPv6 解析 127.0.0.1 失败, 走 IPv4 server 收不到)
                transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
                async with httpx.AsyncClient(timeout=2.0, transport=transport) as c:
                    payload = {
                        "msgtype": "markdown",
                        "markdown": {
                            "title": title,
                            "text": f"### {title}\n\n{message}\n\n---\n[ZHS Platform 告警]",
                        },
                    }
                    resp = await c.post(webhook, json=payload)
                    return resp.status_code == 200
            except Exception:
                return False

        monkeypatch.setattr(alert_service, "push_dingtalk", _mock_push_dingtalk)
        # 触发 rollback
        controller.mark_failure("a")
        controller.mark_failure("b")
        controller.mark_failure("c")
        # 等 push 完成 (asyncio.run 同步推, 不需要等; 但 monkeypatch 可能异步生效, 多等一下)
        time.sleep(0.5)
        # 验证 webhook 收到
        with state.lock:
            received_count = len(state.received)
        assert received_count >= 1, f"webhook 没收到告警 (received={received_count})"
        # 验证 payload 包含关键信息
        with state.lock:
            payload = state.received[0]
        # DingTalk markdown 格式, 含 title + text
        content = ""
        if "markdown" in payload:
            md = payload["markdown"]
            content = md.get("text", "") + " " + md.get("title", "")
        elif "text" in payload:
            content = payload["text"].get("content", "")
        # 验证关键字段
        assert (
            "Canary" in content or "rollback" in content.lower() or "回滚" in content
        ), f"payload 不含关键字段, content={content!r}, full_payload={payload}"


# ---------------------------------------------------------------------------
# TestPrometheusRulesIntegration
# ---------------------------------------------------------------------------


class TestPrometheusRulesIntegration:
    """prometheus 告警规则在真实 metric 上求值."""

    def test_rollback_active_rule_fires(self, controller):
        """ZHSRollbackActive rule: zhs_canary_rollback_active == 1 → fires."""

        from app.canary_metrics import CANARY_ROLLBACK_GAUGE

        def _eval_rule(expr_fn, metric_value) -> bool:
            """简单求值: expr_fn(gauge_value) → bool."""
            return expr_fn(metric_value)

        # 初始: 0 → rule 不触发
        assert _eval_rule(lambda v: v == 1, CANARY_ROLLBACK_GAUGE._value.get()) is False
        # 触发 rollback → gauge=1 → rule 触发
        controller.mark_failure("a")
        controller.mark_failure("b")
        controller.mark_failure("c")
        assert _eval_rule(lambda v: v == 1, CANARY_ROLLBACK_GAUGE._value.get()) is True

    def test_stuck_mid_stage_rule_fires(self, controller):
        """ZHSCanaryStuckMidStage rule: stage!='0%' & ratio>0 & <1 → fires."""
        from app.canary_metrics import CANARY_STAGE_RATIO_GAUGE, sync_canary_stage_gauges

        # 推到 1%
        controller.promote(actor="t", reason="")
        # 同步 gauge
        sync_canary_stage_gauges(controller)
        stage_1pct = CANARY_STAGE_RATIO_GAUGE.labels(stage="1%")._value.get()
        # expr: stage != "0%" AND > 0 AND < 1
        assert stage_1pct == 0.01
        # 中间态比 0 大比 1 小
        triggered = (stage_1pct > 0) and (stage_1pct < 1)
        assert triggered is True

    def test_shadow_mismatch_rule_fires(self, controller, link):
        """ZHSShadowRatioMismatch rule: shadow > canary * 1.5 → fires."""
        from app.canary_metrics import (
            CANARY_STAGE_RATIO_GAUGE,
            SHADOW_RATIO_GAUGE,
            sync_canary_stage_gauges,
            sync_shadow_gauges,
        )

        # 构造 shadow 偏离 canary 的场景: 手动设高 shadow.ratio
        controller.promote(actor="t", reason="")
        link.sync()
        sync_canary_stage_gauges(controller)
        sync_shadow_gauges(link)
        # 假设 link 配错, shadow.ratio=0.5 而 canary 是 0.01
        link.shadow.ratio = 0.5
        sync_shadow_gauges(link)
        canary_total = sum(
            CANARY_STAGE_RATIO_GAUGE.labels(stage=s)._value.get() for s in ("0%", "1%", "10%", "50%", "100%")
        )
        shadow_val = SHADOW_RATIO_GAUGE._value.get()
        # expr: shadow > 0 AND shadow > canary * 1.5
        triggered = (shadow_val > 0) and (shadow_val > canary_total * 1.5)
        assert triggered is True


# ---------------------------------------------------------------------------
# TestAlertPayloadStructure
# ---------------------------------------------------------------------------


class TestAlertPayloadStructure:
    """alertmanager 告警 payload 结构正确."""

    def test_payload_has_required_fields(self):
        """alertmanager PrometheusAlert 必含 labels / annotations / status."""
        from app.services.alert_service import format_prometheus_alert

        # 模拟 ZHSRollbackActive 触发的 alert
        alert = {
            "labels": {
                "alertname": "ZHSRollbackActive",
                "severity": "critical",
                "service": "zhs-platform",
            },
            "annotations": {
                "summary": "[Canary] 紧急回滚已触发",
                "description": "CanaryStageController 因连续失败触发紧急回滚",
            },
            "status": "firing",
            "startsAt": "2026-06-13T00:00:00Z",
            "endsAt": "0001-01-01T00:00:00Z",
        }
        title, message = format_prometheus_alert(alert)
        # title 应包含 alertname
        assert "ZHSRollbackActive" in title
        # message 应包含 severity + status
        assert "critical" in message
        assert "firing" in message
        # message 应包含 description
        assert "紧急回滚" in message

    def test_severity_levels(self):
        """不同 severity 都正确格式化."""
        from app.services.alert_service import format_prometheus_alert

        for severity in ("info", "warning", "critical"):
            alert = {
                "labels": {"alertname": "X", "severity": severity},
                "annotations": {"summary": "X", "description": ""},
                "status": "firing",
            }
            title, message = format_prometheus_alert(alert)
            assert severity in message


# ---------------------------------------------------------------------------
# TestFullLifecycleWithoutExternalDeps
# ---------------------------------------------------------------------------


class TestFullLifecycleWithoutExternalDeps:
    """不依赖真实 alertmanager / prometheus server 的端到端测试."""

    def test_promote_traffic_failure_rollback_state(self, tmp_path):
        """业务流: promote → traffic → failure → rollback, 状态机正确."""
        from app.canary_shadow_link import CanaryShadowLink

        from app.canary_metrics import (
            CANARY_ROLLBACK_GAUGE,
            sync_canary_stage_gauges,
            sync_shadow_gauges,
        )
        from app.canary_stages import CanaryStageController

        state_file = str(tmp_path / "lifecycle.json")
        controller = CanaryStageController(
            state_file=state_file,
            cooldown_seconds=0.0,
            failure_threshold=3,
        )
        link = CanaryShadowLink(controller)
        # 1. STAGE_0
        assert controller.current_stage().value == "0%"
        # 2. promote 1%
        ev = controller.promote(actor="admin", reason="go 1%")
        assert ev.event_type == "promote"
        assert ev.to_stage == "1%"
        # shadow 联动
        link.sync()
        assert link.shadow.ratio == 0.01
        # 3. 流量
        controller.mark_traffic(100)
        assert controller.state().total_traffic_in_stage == 100
        # 4. 失败累计
        controller.mark_failure("err 1")
        controller.mark_failure("err 2")
        # 5. 第三次失败 → 紧急回滚
        ev = controller.mark_failure("err 3")
        assert ev.event_type == "auto_rollback"
        assert ev.to_stage == "0%"
        # 6. 同步 metrics
        sync_canary_stage_gauges(controller)
        sync_shadow_gauges(link)
        # 不调 sync_canary_gauges
        # 7. 验证所有 gauge
        # rollback gauge 应该在 _notify_auto_rollback 触发时设 1.0
        # 提示: 这里的 autouse fixture 已把 gauge 设为 0.0, mark_failure 触发后应改回 1.0
        assert (
            CANARY_ROLLBACK_GAUGE._value.get() == 1.0
        ), f"rollback gauge 期望 1.0, 实际 {CANARY_ROLLBACK_GAUGE._value.get()}"
        # 8. controller 状态
        assert controller.state().failures_in_stage == 0  # 已重置
        assert controller.state().total_traffic_in_stage == 0  # 已重置
