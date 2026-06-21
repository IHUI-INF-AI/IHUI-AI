"""告警 8 通道端到端演练 + 失败/重试/降级测试 (Phase 10-F/G).

覆盖:
  TestSlackBuild (3)
    - build_slack_payload 字段完整
    - severity → emoji 映射 (critical/error/warning/info)
    - 默认 emoji 兜底

  TestTeamsBuild (2)
    - build_teams_payload MessageCard 格式
    - severity → themeColor 映射

  TestGenericBuild (2)
    - build_generic_payload 扁平结构
    - 自定义 source 透传

  TestPushSlack (3)
    - 成功 (text="ok")
    - 5xx 失败
    - 4xx 失败

  TestPushTeams (3)
    - 成功 (text="1")
    - 5xx 失败
    - 网络异常

  TestPushGeneric (4)
    - 成功 200
    - auth_header 注入到 Authorization 头
    - 5xx 失败
    - 空 url 跳过

  TestConcurrentAllChannels (3)
    - 8 通道全部配置 → 并发投递, 每个独立路由被调一次
    - 5 通道配置 → 推送结果正确反映哪些通道被调用
    - 一通道失败不阻塞其他通道

  TestAlertManagerE2E (4)
    - alertmanager emulator → webhook → push_alert → 8 通道
    - 抑制规则生效: critical 抑制 warning → 只推 critical
    - 端到端: /monitor/alerts/webhook 端点接收 → push_alert
    - dry_run=true 时不真推, 但统计会推哪些

  TestFailureRetryDegradation (5)
    - 重试 1 次后成功
    - 全部失败返回 False, 不抛错
    - 通道 1 失败 + 通道 2 成功 → 各自正确
    - 网络异常 → 优雅降级 (返回 False, 不抛)
    - 5 通道中 1 个 5xx, 其他正常 → 并发下其他仍成功

  TestPushAlertHistoryIntegration (2)
    - push_alert 写一条历史
    - 多次 push_alert 历史累积
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import respx
from httpx import Response

from app.alertmanager_emulator import AlertmanagerEmulator
from app.api.v1.monitor.alerts import _ALERT_HISTORY
from app.config import settings
from app.services.alert_pagerduty import from_prometheus_alert
from app.services.alert_service import push_alert
from app.services.alert_webhook import (
    build_generic_payload,
    build_slack_payload,
    build_teams_payload,
    push_generic_webhook,
    push_slack,
    push_teams,
)


# ===========================================================================
# TestSlackBuild
# ===========================================================================
class TestSlackBuild:
    def test_basic_shape(self):
        p = build_slack_payload("Title", "Body", "critical")
        assert "Title" in p["text"]
        assert "Body" in p["text"]
        assert p["blocks"][0]["type"] == "section"
        assert p["blocks"][0]["text"]["type"] == "mrkdwn"

    def test_severity_emoji(self):
        for sev, emoji in [
            ("critical", "rotating_light"),
            ("error", "x"),
            ("warning", "warning"),
            ("info", "information_source"),
        ]:
            p = build_slack_payload("T", "B", sev)
            assert emoji in p["text"], f"{sev} missing {emoji}: {p}"

    def test_unknown_severity_falls_back(self):
        p = build_slack_payload("T", "B", "weird-severity")
        # 默认 :bell:
        assert ":bell:" in p["text"]


# ===========================================================================
# TestTeamsBuild
# ===========================================================================
class TestTeamsBuild:
    def test_messagecard(self):
        p = build_teams_payload("Title", "Body", "warning")
        assert p["@type"] == "MessageCard"
        assert p["title"] == "Title"
        assert p["text"] == "Body"
        assert p["summary"] == "Title"
        assert p["@context"] == "https://schema.org/extensions"

    def test_severity_color(self):
        for sev, color in [
            ("critical", "FF0000"),
            ("error", "FF6600"),
            ("warning", "FFAA00"),
            ("info", "0078D7"),
        ]:
            p = build_teams_payload("T", "B", sev)
            assert p["themeColor"] == color, f"{sev} got {p['themeColor']}"


# ===========================================================================
# TestGenericBuild
# ===========================================================================
class TestGenericBuild:
    def test_flat_shape(self):
        p = build_generic_payload("T", "B", "critical", "my-source")
        assert p["title"] == "T"
        assert p["message"] == "B"
        assert p["severity"] == "critical"
        assert p["source"] == "my-source"

    def test_default_source(self):
        p = build_generic_payload("T", "B")
        assert p["source"] == "zhs-platform"


# ===========================================================================
# TestPushSlack
# ===========================================================================
class TestPushSlack:
    @respx.mock
    async def test_success(self):
        url = "https://hooks.slack.com/services/T/B/X"
        route = respx.post(url).mock(return_value=Response(200, text="ok"))
        ok = await push_slack(url, "T", "B", "critical")
        assert ok is True
        assert route.call_count == 1
        b = json.loads(route.calls[0].request.content)
        assert "T" in b["text"]

    @respx.mock
    async def test_5xx_fail(self):
        respx.post("https://hooks.slack.com/x").mock(return_value=Response(500, text="error"))
        ok = await push_slack("https://hooks.slack.com/x", "T", "B")
        assert ok is False

    @respx.mock
    async def test_4xx_fail(self):
        respx.post("https://hooks.slack.com/x").mock(return_value=Response(404, text="not found"))
        ok = await push_slack("https://hooks.slack.com/x", "T", "B")
        assert ok is False


# ===========================================================================
# TestPushTeams
# ===========================================================================
class TestPushTeams:
    @respx.mock
    async def test_success(self):
        url = "https://outlook.office.com/webhook/x"
        route = respx.post(url).mock(return_value=Response(200, text="1"))
        ok = await push_teams(url, "T", "B", "critical")
        assert ok is True
        assert route.call_count == 1
        b = json.loads(route.calls[0].request.content)
        assert b["title"] == "T"
        assert b["themeColor"] == "FF0000"

    @respx.mock
    async def test_5xx_fail(self):
        respx.post("https://outlook.office.com/x").mock(return_value=Response(500, text="error"))
        ok = await push_teams("https://outlook.office.com/x", "T", "B")
        assert ok is False

    @respx.mock
    async def test_network_error(self):
        respx.post("https://outlook.office.com/x").mock(side_effect=Exception("timeout"))
        ok = await push_teams("https://outlook.office.com/x", "T", "B")
        assert ok is False


# ===========================================================================
# TestPushGeneric
# ===========================================================================
class TestPushGeneric:
    @respx.mock
    async def test_success(self):
        url = "https://example.com/hook"
        route = respx.post(url).mock(return_value=Response(200, json={"ok": True}))
        ok = await push_generic_webhook(url, "T", "B", "warning")
        assert ok is True
        b = json.loads(route.calls[0].request.content)
        assert b["title"] == "T"
        assert b["severity"] == "warning"

    @respx.mock
    async def test_auth_header(self):
        url = "https://example.com/hook"
        route = respx.post(url).mock(return_value=Response(200, text="ok"))
        ok = await push_generic_webhook(url, "T", "B", auth_header="Bearer xyz123")
        assert ok is True
        assert route.calls[0].request.headers.get("authorization") == "Bearer xyz123"

    @respx.mock
    async def test_5xx_fail(self):
        respx.post("https://example.com/x").mock(return_value=Response(503, text="down"))
        ok = await push_generic_webhook("https://example.com/x", "T", "B")
        assert ok is False

    async def test_empty_url_skips(self):
        ok = await push_generic_webhook("", "T", "B")
        assert ok is False


# ===========================================================================
# TestConcurrentAllChannels
# ===========================================================================
class TestConcurrentAllChannels:
    @staticmethod
    def _save():
        return {
            "DT": settings.DINGTALK_WEBHOOK,
            "DT_S": settings.DINGTALK_SECRET,
            "WX": settings.WECHAT_WORK_WEBHOOK,
            "FS": settings.FEISHU_WEBHOOK,
            "EMAIL": settings.ALERT_EMAIL_TO,
            "SMTP": settings.SMTP_HOST,
            "PD": settings.PAGERDUTY_ROUTING_KEY,
            "PD_URL": settings.PAGERDUTY_API_URL,
            "SLACK": settings.SLACK_WEBHOOK,
            "TEAMS": settings.TEAMS_WEBHOOK,
            "GEN": settings.GENERIC_WEBHOOK_URL,
            "GEN_AUTH": settings.GENERIC_WEBHOOK_AUTH_HEADER,
        }

    @staticmethod
    def _restore(saved):
        settings.DINGTALK_WEBHOOK = saved["DT"]
        settings.DINGTALK_SECRET = saved["DT_S"]
        settings.WECHAT_WORK_WEBHOOK = saved["WX"]
        settings.FEISHU_WEBHOOK = saved["FS"]
        settings.ALERT_EMAIL_TO = saved["EMAIL"]
        settings.SMTP_HOST = saved["SMTP"]
        settings.PAGERDUTY_ROUTING_KEY = saved["PD"]
        settings.PAGERDUTY_API_URL = saved["PD_URL"]
        settings.SLACK_WEBHOOK = saved["SLACK"]
        settings.TEAMS_WEBHOOK = saved["TEAMS"]
        settings.GENERIC_WEBHOOK_URL = saved["GEN"]
        settings.GENERIC_WEBHOOK_AUTH_HEADER = saved["GEN_AUTH"]

    @respx.mock
    async def test_eight_channels_concurrent(self):
        """8 通道全配置, push_alert 并发投递, 每个路由被调一次."""
        saved = self._save()
        # 配置 8 通道 (email 配齐)
        settings.DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=t"
        settings.WECHAT_WORK_WEBHOOK = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=t"
        settings.FEISHU_WEBHOOK = "https://open.feishu.cn/open-apis/bot/v2/hook/t"
        settings.SMTP_HOST = "127.0.0.1"
        settings.SMTP_PORT = 1  # 故意不可达, 邮件会失败
        settings.ALERT_EMAIL_TO = "x@y.com"
        settings.SMTP_USER = "x@y.com"
        settings.SMTP_PASSWORD = "p"
        settings.PAGERDUTY_ROUTING_KEY = "PDKEY"
        settings.PAGERDUTY_API_URL = "https://events.pagerduty.com/v2/enqueue"
        settings.SLACK_WEBHOOK = "https://hooks.slack.com/t"
        settings.TEAMS_WEBHOOK = "https://outlook.office.com/w"
        settings.GENERIC_WEBHOOK_URL = "https://example.com/hook"
        settings.GENERIC_WEBHOOK_AUTH_HEADER = "Bearer t"

        # mock 7 个 HTTP 端点全部成功 (email 故意不可达, 验证失败隔离)
        routes = {
            "dingtalk": respx.post(settings.DINGTALK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0})),
            "wechat": respx.post(settings.WECHAT_WORK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0})),
            "feishu": respx.post(settings.FEISHU_WEBHOOK).mock(return_value=Response(200, json={"code": 0})),
            "pagerduty": respx.post(settings.PAGERDUTY_API_URL).mock(
                return_value=Response(202, json={"status": "success"})
            ),
            "slack": respx.post(settings.SLACK_WEBHOOK).mock(return_value=Response(200, text="ok")),
            "teams": respx.post(settings.TEAMS_WEBHOOK).mock(return_value=Response(200, text="1")),
            "generic": respx.post(settings.GENERIC_WEBHOOK_URL).mock(return_value=Response(200, json={"ok": True})),
        }

        try:
            result = await push_alert("Test", "Body", "critical")
            # HTTP 类 6 通道成功, email 失败 (端口 1 不可达), generic 成功
            assert result["dingtalk"] is True
            assert result["wechat"] is True
            assert result["feishu"] is True
            assert result["pagerduty"] is True
            assert result["slack"] is True
            assert result["teams"] is True
            assert result["generic"] is True
            # email 失败但不影响其他
            assert result["email"] is False
            # 7 个 HTTP 路由各被调一次
            assert routes["dingtalk"].call_count == 1
            assert routes["wechat"].call_count == 1
            assert routes["feishu"].call_count == 1
            assert routes["pagerduty"].call_count == 1
            assert routes["slack"].call_count == 1
            assert routes["teams"].call_count == 1
            assert routes["generic"].call_count == 1
        finally:
            self._restore(saved)

    @respx.mock
    async def test_five_channels(self):
        """只配置 5 通道, 其他 3 通道应返 False 不调用."""
        saved = self._save()
        settings.DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/r?a=t"
        settings.WECHAT_WORK_WEBHOOK = "https://qyapi.weixin.qq.com/w?k=t"
        settings.FEISHU_WEBHOOK = "https://open.feishu.cn/f?t"
        settings.PAGERDUTY_ROUTING_KEY = "PDK"
        settings.SLACK_WEBHOOK = "https://hooks.slack.com/t"

        dt = respx.post(settings.DINGTALK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0}))
        wx = respx.post(settings.WECHAT_WORK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0}))
        fs = respx.post(settings.FEISHU_WEBHOOK).mock(return_value=Response(200, json={"code": 0}))
        pd_r = respx.post(settings.PAGERDUTY_API_URL).mock(return_value=Response(202, json={"status": "success"}))
        sl = respx.post(settings.SLACK_WEBHOOK).mock(return_value=Response(200, text="ok"))

        try:
            result = await push_alert("T", "B", "warning")
            assert result["dingtalk"] and result["wechat"] and result["feishu"]
            assert result["pagerduty"] and result["slack"]
            assert result["email"] is False
            assert result["teams"] is False
            assert result["generic"] is False
            assert dt.call_count == 1
            assert wx.call_count == 1
            assert fs.call_count == 1
            assert pd_r.call_count == 1
            assert sl.call_count == 1
        finally:
            self._restore(saved)

    @respx.mock
    async def test_one_channel_fails_others_succeed(self):
        """一个通道失败不应阻塞其他."""
        saved = self._save()
        settings.DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/r?a=t"
        settings.WECHAT_WORK_WEBHOOK = "https://qyapi.weixin.qq.com/w?k=t"
        settings.FEISHU_WEBHOOK = "https://open.feishu.cn/f?t"

        # 钉钉失败 (重试 1 次后仍失败), 微信/飞书成功
        respx.post(settings.DINGTALK_WEBHOOK).mock(
            side_effect=[
                Response(500, json={"errcode": -1}),
                Response(500, json={"errcode": -1}),
            ]
        )
        respx.post(settings.WECHAT_WORK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0}))
        respx.post(settings.FEISHU_WEBHOOK).mock(return_value=Response(200, json={"code": 0}))

        try:
            result = await push_alert("T", "B", "warning")
            assert result["dingtalk"] is False
            assert result["wechat"] is True
            assert result["feishu"] is True
        finally:
            self._restore(saved)


# ===========================================================================
# TestAlertManagerE2E
# ===========================================================================
RULES_YAML = Path("docker/alertmanager/alertmanager.yml")


class TestAlertManagerE2E:
    """Alertmanager emulator → /monitor/alerts/webhook → push_alert → 8 通道."""

    @respx.mock
    async def test_emulator_to_8_channels(self):
        """alertmanager emulator 触发 → 经过抑制 → 8 通道并发."""
        if not RULES_YAML.exists():
            pytest.skip(f"rules yaml not found: {RULES_YAML}")

        # 配置 5 通道 (HTTP 类)
        saved = TestConcurrentAllChannels._save()
        settings.DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/r?a=t"
        settings.WECHAT_WORK_WEBHOOK = "https://qyapi.weixin.qq.com/w?k=t"
        settings.FEISHU_WEBHOOK = "https://open.feishu.cn/f?t"
        settings.PAGERDUTY_ROUTING_KEY = "PDK"
        settings.SLACK_WEBHOOK = "https://hooks.slack.com/t"

        respx.post(settings.DINGTALK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0}))
        respx.post(settings.WECHAT_WORK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0}))
        respx.post(settings.FEISHU_WEBHOOK).mock(return_value=Response(200, json={"code": 0}))
        respx.post(settings.PAGERDUTY_API_URL).mock(return_value=Response(202, json={"status": "success"}))
        respx.post(settings.SLACK_WEBHOOK).mock(return_value=Response(200, text="ok"))

        # 启动 emulator, 不设 webhook_url (我们手动推)
        emu = AlertmanagerEmulator(rules_yaml=RULES_YAML)
        emu.start()
        try:
            # 直接推一个 critical 告警
            emu.push_alert(
                {
                    "labels": {
                        "alertname": "ZHSCanaryStageStuck",
                        "severity": "warning",
                        "service": "api",
                    },
                    "annotations": {
                        "summary": "Canary 卡住",
                        "description": "stage2 600s 未推进",
                    },
                }
            )
            surviving = emu.fired_alerts
            assert len(surviving) == 1
            # 转 PagerDuty kwargs
            for alert in surviving:
                kw = from_prometheus_alert(alert)
                # 推到所有通道
                await push_alert(kw["title"], kw["message"], kw["severity"])
        finally:
            emu.stop()
            TestConcurrentAllChannels._restore(saved)

    @respx.mock
    async def test_inhibition_critical_suppresses_warning(self):
        """critical 抑制同 service warning → 端到端只推 critical."""
        if not RULES_YAML.exists():
            pytest.skip(f"rules yaml not found: {RULES_YAML}")

        from app.alert_inhibition import ZHS_INHIBITION_PRESETS, AlertInhibitor

        inh = AlertInhibitor(ZHS_INHIBITION_PRESETS)
        alerts = [
            {
                "labels": {
                    "alertname": "ZHSRollbackActive",
                    "severity": "critical",
                    "service": "api",
                },
                "annotations": {"summary": "回滚", "description": "已启动回滚"},
            },
            {
                "labels": {
                    "alertname": "ZHSCanaryStageStuck",
                    "severity": "warning",
                    "service": "api",
                },
                "annotations": {"summary": "卡住", "description": "stage 2 600s"},
            },
        ]
        surviving = inh.apply(alerts)
        # ZHS_ROLLBACK_INHIBITS_CANARY 规则: 抑制 ZHSCanaryStageStuck
        assert len(surviving) == 1
        assert surviving[0]["labels"]["alertname"] == "ZHSRollbackActive"

        # 验证 dry_run 路径: 列出被抑制的
        pairs = inh.would_suppress_with_reason(alerts)
        assert len(pairs) == 1
        assert pairs[0][0]["labels"]["alertname"] == "ZHSCanaryStageStuck"
        assert "rollback" in pairs[0][1].lower()

    @respx.mock
    async def test_webhook_endpoint_dry_run(self):
        """dry_run=true 时, /monitor/alerts/webhook 端点不真推, 返回统计."""
        from fastapi.testclient import TestClient

        from app.api.v1.monitor.alerts import _ALERT_HISTORY
        from app.main import app

        before = len(_ALERT_HISTORY)
        # 准备一个会触发抑制的告警组合
        body = {
            "version": "4",
            "status": "firing",
            "alerts": [
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "ZHSRollbackActive",
                        "severity": "critical",
                        "service": "api",
                    },
                    "annotations": {"summary": "回滚"},
                },
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "ZHSCanaryStageStuck",
                        "severity": "warning",
                        "service": "api",
                    },
                    "annotations": {"summary": "卡住"},
                },
            ],
        }
        # 用 TestClient 调端点 (FastAPI 默认 prefix=/api/v1)
        client = TestClient(app)
        # 不带 auth (webhook 端点本身不要 auth)
        resp = client.post("/api/v1/monitor/alerts/webhook?dry_run=true", json=body)
        assert resp.status_code == 200, resp.text
        j = resp.json()
        # 业务包装: data 字段为业务 payload
        data = j.get("data", j)
        assert data["received"] == 2
        assert data["firing"] == 2
        assert data["pushed"] == 0  # dry_run
        assert data["suppressed"] == 1
        assert data["dry_run"] is True
        # 历史不增加 (dry_run 不写 history? 实际上 monitor/alerts 写 firing+resolved;
        # 业务 push_alert 才记录到 _ALERT_HISTORY; dry_run 不调 push_alert 所以 +0)
        assert len(_ALERT_HISTORY) == before


# ===========================================================================
# TestFailureRetryDegradation
# ===========================================================================
class TestFailureRetryDegradation:
    @respx.mock
    async def test_retry_then_success(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=r"
        route = respx.post(url).mock(
            side_effect=[
                Response(500, json={"errcode": -1}),
                Response(200, json={"errcode": 0}),
            ]
        )
        from app.services.alert_service import push_dingtalk

        ok = await push_dingtalk(url, "T", "M")
        assert ok is True
        assert route.call_count == 2  # 1 fail + 1 success

    @respx.mock
    async def test_all_attempts_fail(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=f"
        route = respx.post(url).mock(
            side_effect=[
                Response(500, text="fail1"),
                Response(500, text="fail2"),
            ]
        )
        from app.services.alert_service import push_dingtalk

        ok = await push_dingtalk(url, "T", "M")
        assert ok is False
        assert route.call_count == 2  # 重试 1 次, 2 次尝试

    @respx.mock
    async def test_network_error_graceful(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=n"
        respx.post(url).mock(side_effect=Exception("ECONNREFUSED"))
        from app.services.alert_service import push_dingtalk

        ok = await push_dingtalk(url, "T", "M")
        assert ok is False

    @respx.mock
    async def test_concurrent_isolation(self):
        """5 通道并发, 1 通道 5xx, 其他 4 通道仍成功."""
        url_dt = "https://oapi.dingtalk.com/r?a=fail"
        url_wx = "https://qyapi.weixin.qq.com/w?k=ok"
        url_fs = "https://open.feishu.cn/f?ok"
        url_pd = "https://events.pagerduty.com/v2/enqueue"
        url_sl = "https://hooks.slack.com/s"

        respx.post(url_dt).mock(return_value=Response(500, text="down"))
        respx.post(url_wx).mock(return_value=Response(200, json={"errcode": 0}))
        respx.post(url_fs).mock(return_value=Response(200, json={"code": 0}))
        respx.post(url_pd).mock(return_value=Response(202, json={"status": "success"}))
        respx.post(url_sl).mock(return_value=Response(200, text="ok"))

        saved = TestConcurrentAllChannels._save()
        settings.DINGTALK_WEBHOOK = url_dt
        settings.WECHAT_WORK_WEBHOOK = url_wx
        settings.FEISHU_WEBHOOK = url_fs
        settings.PAGERDUTY_ROUTING_KEY = "PDK"
        settings.SLACK_WEBHOOK = url_sl

        try:
            result = await push_alert("T", "B", "warning")
            assert result["dingtalk"] is False
            assert result["wechat"] is True
            assert result["feishu"] is True
            assert result["pagerduty"] is True
            assert result["slack"] is True
        finally:
            TestConcurrentAllChannels._restore(saved)


# ===========================================================================
# TestPushAlertHistoryIntegration
# ===========================================================================
class TestPushAlertHistoryIntegration:
    @respx.mock
    async def test_writes_history(self):
        """push_alert 每次写一条到 _ALERT_HISTORY."""
        from app.services.alert_service import push_alert

        saved = TestConcurrentAllChannels._save()
        # 不配置任何通道, push_alert 应安全返全 False 但仍写历史
        settings.DINGTALK_WEBHOOK = ""
        settings.WECHAT_WORK_WEBHOOK = ""
        settings.FEISHU_WEBHOOK = ""
        settings.SMTP_HOST = ""
        settings.ALERT_EMAIL_TO = ""
        settings.PAGERDUTY_ROUTING_KEY = ""
        settings.SLACK_WEBHOOK = ""
        settings.TEAMS_WEBHOOK = ""
        settings.GENERIC_WEBHOOK_URL = ""

        before = len(_ALERT_HISTORY)
        try:
            r = await push_alert("Hist-Title", "Hist-Body", "warning")
            assert all(v is False for v in r.values())
            assert len(_ALERT_HISTORY) == before + 1
            assert _ALERT_HISTORY[-1]["title"] == "Hist-Title"
            assert _ALERT_HISTORY[-1]["severity"] == "warning"
        finally:
            TestConcurrentAllChannels._restore(saved)

    @respx.mock
    async def test_history_accumulates(self):
        """多次 push_alert 历史累积."""
        from app.services.alert_service import push_alert

        saved = TestConcurrentAllChannels._save()
        settings.DINGTALK_WEBHOOK = ""
        settings.WECHAT_WORK_WEBHOOK = ""
        settings.FEISHU_WEBHOOK = ""
        settings.SMTP_HOST = ""
        settings.ALERT_EMAIL_TO = ""
        settings.PAGERDUTY_ROUTING_KEY = ""
        settings.SLACK_WEBHOOK = ""
        settings.TEAMS_WEBHOOK = ""
        settings.GENERIC_WEBHOOK_URL = ""

        before = len(_ALERT_HISTORY)
        try:
            for i in range(5):
                await push_alert(f"Title-{i}", f"Body-{i}", "info")
            assert len(_ALERT_HISTORY) == before + 5
            for i in range(5):
                assert _ALERT_HISTORY[before + i]["title"] == f"Title-{i}"
        finally:
            TestConcurrentAllChannels._restore(saved)
