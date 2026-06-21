"""PagerDuty Events API v2 适配器测试 (Phase 10-C).

覆盖:
  TestSeverityMap (4)
    - critical / error / warning / info 直接映射
    - firing (业务) → error (PD)
    - resolved (业务) → info (PD)
    - 未知 / 空 → warning (默认)

  TestDedupKey (3)
    - 完整路径: alertname + service + instance
    - 只 alertname
    - 全空 → "zhs/unknown"

  TestFromPrometheusAlert (4)
    - 完整 alert → 完整 kwargs
    - firing → event_action=trigger
    - resolved → event_action=resolve
    - 无 service 时 source 用 "zhs-platform"

  TestBuildEvent (3)
    - 必填字段: routing_key / event_action / dedup_key / payload.{summary,source,severity}
    - 自动生成 timestamp
    - 可选字段: component / group / class / custom_details

  TestPushPagerDuty (8)
    - 成功推送: 200/202 + status:success
    - 路由失败: status:invalid + 4xx
    - 5xx 重试一次后成功
    - 网络异常 → False
    - 路由键为空 → 跳过
    - api_url 为空 → 跳过
    - 业务 severity 正确转 PD severity
    - 自定义 api_url 覆盖

  TestSignature (6)
    - 校验合法 v1 签名
    - 拒绝错误 secret
    - 拒绝空 body
    - 拒绝空 header
    - 拒绝空 secret
    - 多版本头: "v1=a v1=b" 任一匹配即通过

  TestSignWebhookBody (2)
    - 生成 v1=<base64> 格式
    - sign 后能被 verify 验证通过 (自洽)

  TestE2E (2)
    - Prometheus alert → push_pagerduty 完整链路
    - 多告警并发: 不同 dedup_key 各自投递一次
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json

import respx
from httpx import Response

from app.services.alert_pagerduty import (
    _build_event,
    _map_severity,
    from_prometheus_alert,
    make_dedup_key,
    push_pagerduty,
    sign_pagerduty_webhook_body,
    verify_pagerduty_webhook_signature,
)


# ===========================================================================
# TestSeverityMap
# ===========================================================================
class TestSeverityMap:
    def test_critical(self):
        assert _map_severity("critical") == "critical"

    def test_error(self):
        assert _map_severity("error") == "error"

    def test_warning(self):
        assert _map_severity("warning") == "warning"

    def test_info(self):
        assert _map_severity("info") == "info"

    def test_firing_maps_to_error(self):
        assert _map_severity("firing") == "error"

    def test_resolved_maps_to_info(self):
        assert _map_severity("resolved") == "info"

    def test_unknown_defaults_to_warning(self):
        assert _map_severity("nonsense") == "warning"

    def test_empty_defaults_to_warning(self):
        assert _map_severity("") == "warning"


# ===========================================================================
# TestDedupKey
# ===========================================================================
class TestDedupKey:
    def test_full_path(self):
        assert make_dedup_key("ZHSDB", "auth", "host1") == "ZHSDB/auth/host1"

    def test_alertname_only(self):
        assert make_dedup_key("ZHSDB") == "ZHSDB"

    def test_all_empty(self):
        assert make_dedup_key("") == "zhs/unknown"

    def test_skip_empty_parts(self):
        assert make_dedup_key("X", "", "h") == "X/h"
        assert make_dedup_key("X", "s", "") == "X/s"


# ===========================================================================
# TestFromPrometheusAlert
# ===========================================================================
class TestFromPrometheusAlert:
    def test_full_alert(self):
        a = {
            "status": "firing",
            "labels": {
                "alertname": "ZHSDatabaseDown",
                "severity": "critical",
                "service": "auth",
                "instance": "db-1",
                "component": "postgresql",
                "class": "outage",
            },
            "annotations": {
                "summary": "DB 不可达",
                "description": "tcp 5432 超时 3 次",
            },
        }
        kw = from_prometheus_alert(a)
        assert kw["title"] == "[ZHSDatabaseDown] DB 不可达"
        assert kw["message"] == "tcp 5432 超时 3 次"
        assert kw["severity"] == "critical"
        assert kw["dedup_key"] == "ZHSDatabaseDown/auth/db-1"
        assert kw["source"] == "zhs-platform:auth"
        assert kw["component"] == "postgresql"
        assert kw["group"] == "auth"
        assert kw["cls"] == "outage"
        assert kw["event_action"] == "trigger"
        # custom_details
        cd = kw["custom_details"]
        assert cd["alertname"] == "ZHSDatabaseDown"
        assert cd["service"] == "auth"
        assert cd["instance"] == "db-1"
        assert cd["status"] == "firing"

    def test_firing_to_trigger(self):
        a = {"labels": {"alertname": "X"}, "annotations": {}, "status": "firing"}
        assert from_prometheus_alert(a)["event_action"] == "trigger"

    def test_resolved_to_resolve(self):
        a = {"labels": {"alertname": "X"}, "annotations": {}, "status": "resolved"}
        kw = from_prometheus_alert(a)
        assert kw["event_action"] == "resolve"
        # severity 映射: resolved → info
        assert kw["severity"] == "info"

    def test_no_service_uses_default_source(self):
        a = {"labels": {"alertname": "X"}, "annotations": {}, "status": "firing"}
        assert from_prometheus_alert(a)["source"] == "zhs-platform"
        assert from_prometheus_alert(a)["group"] is None

    def test_missing_annotations(self):
        a = {"labels": {"alertname": "Z"}}
        kw = from_prometheus_alert(a)
        assert kw["title"] == "[Z] Z"  # summary 缺省 = alertname
        assert kw["message"] == ""


# ===========================================================================
# TestBuildEvent
# ===========================================================================
class TestBuildEvent:
    def test_required_fields(self):
        ev = _build_event(
            routing_key="RK",
            event_action="trigger",
            dedup_key="K",
            summary="S",
            source="src",
            severity="critical",
        )
        assert ev["routing_key"] == "RK"
        assert ev["event_action"] == "trigger"
        assert ev["dedup_key"] == "K"
        assert ev["payload"]["summary"] == "S"
        assert ev["payload"]["source"] == "src"
        assert ev["payload"]["severity"] == "critical"
        assert "timestamp" in ev["payload"]

    def test_optional_fields(self):
        ev = _build_event(
            routing_key="RK",
            event_action="trigger",
            dedup_key="K",
            summary="S",
            source="src",
            severity="warning",
            component="db",
            group="prod",
            cls="deploy",
            custom_details={"a": 1},
        )
        assert ev["payload"]["component"] == "db"
        assert ev["payload"]["group"] == "prod"
        assert ev["payload"]["class"] == "deploy"
        assert ev["payload"]["custom_details"] == {"a": 1}

    def test_severity_mapped(self):
        ev = _build_event(
            routing_key="RK",
            event_action="trigger",
            dedup_key="K",
            summary="S",
            source="src",
            severity="firing",
        )
        assert ev["payload"]["severity"] == "error"


# ===========================================================================
# TestPushPagerDuty
# ===========================================================================
PD_URL = "https://events.pagerduty.com/v2/enqueue"


class TestPushPagerDuty:
    @respx.mock
    async def test_success(self):
        route = respx.post(PD_URL).mock(
            return_value=Response(202, json={"status": "success", "message": "Event processed"})
        )
        ok = await push_pagerduty(
            routing_key="RK",
            title="T",
            message="M",
            severity="warning",
        )
        assert ok is True
        assert route.call_count == 1
        b = json.loads(route.calls[0].request.content)
        assert b["routing_key"] == "RK"
        assert b["event_action"] == "trigger"
        assert b["payload"]["severity"] == "warning"
        assert b["payload"]["summary"] == "T"

    @respx.mock
    async def test_invalid_routing_key(self):
        respx.post(PD_URL).mock(
            return_value=Response(400, json={"status": "invalid event", "message": "routing_key is invalid"})
        )
        ok = await push_pagerduty(routing_key="BAD", title="T", message="M")
        assert ok is False

    @respx.mock
    async def test_5xx_retry_then_success(self):
        route = respx.post(PD_URL).mock(
            side_effect=[
                Response(500, json={"status": "server error"}),
                Response(202, json={"status": "success"}),
            ]
        )
        ok = await push_pagerduty(routing_key="RK", title="T", message="M")
        assert ok is True
        assert route.call_count == 2

    @respx.mock
    async def test_network_error(self):
        respx.post(PD_URL).mock(side_effect=Exception("connection refused"))
        ok = await push_pagerduty(routing_key="RK", title="T", message="M")
        assert ok is False

    async def test_empty_routing_key_skips(self):
        ok = await push_pagerduty(routing_key="", title="T", message="M")
        assert ok is False

    async def test_custom_api_url(self):
        custom = "https://custom.pd.example/v2/enqueue"
        with respx.mock:
            route = respx.post(custom).mock(return_value=Response(202, json={"status": "success"}))
            ok = await push_pagerduty(
                routing_key="RK",
                title="T",
                message="M",
                api_url=custom,
            )
            assert ok is True
            assert route.call_count == 1

    @respx.mock
    async def test_business_severity_to_pd(self):
        """业务 severity=firing 应映射成 PD severity=error."""
        route = respx.post(PD_URL).mock(return_value=Response(202, json={"status": "success"}))
        await push_pagerduty(routing_key="RK", title="T", message="M", severity="firing")
        b = json.loads(route.calls[0].request.content)
        assert b["payload"]["severity"] == "error"

    @respx.mock
    async def test_resolve_event(self):
        route = respx.post(PD_URL).mock(return_value=Response(202, json={"status": "success"}))
        ok = await push_pagerduty(
            routing_key="RK",
            title="T",
            message="M",
            event_action="resolve",
        )
        assert ok is True
        b = json.loads(route.calls[0].request.content)
        assert b["event_action"] == "resolve"


# ===========================================================================
# TestSignature
# ===========================================================================
class TestSignature:
    def test_valid_v1(self):
        body = b'{"event":"test"}'
        secret = "SECRET123"
        sig = sign_pagerduty_webhook_body(body, secret)
        assert verify_pagerduty_webhook_signature(body, sig, secret) is True

    def test_wrong_secret_rejected(self):
        body = b'{"x":1}'
        sig = sign_pagerduty_webhook_body(body, "RIGHT")
        assert verify_pagerduty_webhook_signature(body, sig, "WRONG") is False

    def test_empty_body_rejected(self):
        sig = "v1=abc"
        assert verify_pagerduty_webhook_signature(b"", sig, "S") is False

    def test_empty_header_rejected(self):
        assert verify_pagerduty_webhook_signature(b"x", "", "S") is False

    def test_empty_secret_rejected(self):
        assert verify_pagerduty_webhook_signature(b"x", "v1=abc", "") is False

    def test_multi_version_header(self):
        body = b'{"k":"v"}'
        secret = "S"
        real = sign_pagerduty_webhook_body(body, secret)
        # 加一个无效的 v1 在前面, 真实的在后面
        fake_v1 = "v1=" + base64.b64encode(b"\x00" * 32).decode()
        header = f"{fake_v1} {real}"
        assert verify_pagerduty_webhook_signature(body, header, secret) is True


# ===========================================================================
# TestSignWebhookBody
# ===========================================================================
class TestSignWebhookBody:
    def test_format_v1_base64(self):
        body = b"hello"
        sig = sign_pagerduty_webhook_body(body, "S")
        assert sig.startswith("v1=")
        # 验证 base64 可解码且为 32 字节 (SHA256)
        b = base64.b64decode(sig.split("=", 1)[1])
        assert len(b) == 32

    def test_self_consistent(self):
        body = b"test payload"
        secret = "shared"
        sig = sign_pagerduty_webhook_body(body, secret)
        assert verify_pagerduty_webhook_signature(body, sig, secret) is True
        # 与 hmac 直接计算一致
        expected = hmac.new(secret.encode(), body, hashlib.sha256).digest()
        assert base64.b64encode(expected).decode() == sig.split("=", 1)[1]


# ===========================================================================
# TestE2E
# ===========================================================================
class TestE2E:
    @respx.mock
    async def test_prometheus_alert_to_pagerduty(self):
        """完整链路: Alertmanager alert → PagerDuty events/v2."""
        route = respx.post(PD_URL).mock(
            return_value=Response(202, json={"status": "success", "dedup_key": "X/auth/db-1"})
        )
        alert = {
            "status": "firing",
            "labels": {
                "alertname": "ZHSDatabaseDown",
                "severity": "critical",
                "service": "auth",
                "instance": "db-1",
            },
            "annotations": {
                "summary": "DB 不可达",
                "description": "tcp 5432 timeout 3 times",
            },
        }
        kw = from_prometheus_alert(alert)
        ok = await push_pagerduty(**kw, routing_key="RK")
        assert ok is True
        b = json.loads(route.calls[0].request.content)
        # 业务字段完整透传
        assert b["dedup_key"] == "ZHSDatabaseDown/auth/db-1"
        assert b["payload"]["summary"] == "[ZHSDatabaseDown] DB 不可达"
        assert b["payload"]["source"] == "zhs-platform:auth"
        assert b["payload"]["group"] == "auth"
        assert b["payload"]["severity"] == "critical"
        assert b["payload"]["custom_details"]["alertname"] == "ZHSDatabaseDown"

    @respx.mock
    async def test_concurrent_multi_alerts(self):
        """多个不同告警并发推 PagerDuty, 各自独立一次投递."""
        # 同一 URL, 用 side_effect 记录多次调用
        route = respx.post(PD_URL).mock(return_value=Response(202, json={"status": "success"}))
        alerts = [
            from_prometheus_alert(
                {
                    "status": "firing",
                    "labels": {"alertname": "A", "service": "s1", "instance": "i1"},
                    "annotations": {"summary": "S1"},
                }
            ),
            from_prometheus_alert(
                {
                    "status": "firing",
                    "labels": {"alertname": "B", "service": "s2", "instance": "i2"},
                    "annotations": {"summary": "S2"},
                }
            ),
            from_prometheus_alert(
                {
                    "status": "firing",
                    "labels": {"alertname": "C", "service": "s3", "instance": "i3"},
                    "annotations": {"summary": "S3"},
                }
            ),
        ]
        results = await asyncio.gather(*(push_pagerduty(**a, routing_key="RK") for a in alerts))
        assert results == [True, True, True]
        assert route.call_count == 3
        # 每个 dedup_key 唯一
        seen = set()
        for call in route.calls:
            b = json.loads(call.request.content)
            assert b["dedup_key"] not in seen
            seen.add(b["dedup_key"])
        assert len(seen) == 3
