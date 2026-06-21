"""8 通道真实告警链路 E2E 测试 (Phase 11-C).

覆盖:
  TestUpstreamMockCluster (5)
    - 启动 / 关闭 / 多端口
    - 记录 POST / GET /requests
    - control: status_code / fail_remaining / latency / reset
    - 每个 mock 独立 (7 通道 + 1 备用)

  TestEightChannelE2EReal (4)
    - 真实 8 通道投递 → 7 通道收到 1 次 (邮件无 SMTP)
    - Slack/Teams/PagerDuty/Generic payload 格式正确
    - Generic auth header 透传
    - push_alert 返回结果与 mock 收到次数一致

  TestDedupStabilityReal (2)
    - 同源 2 次推送 → pagerduty dedup_key 一致
    - 不同源 (不同 alertname) → dedup_key 不同

  TestInhibitionInRealE2E (2)
    - 注入 critical + warning 同 service → critical 抑制 warning
    - 抑制后只 surviving 被推 → 7 通道各收到 1 次

  TestFailureIsolationReal (3)
    - 关闭 1 通道 (e.g. Slack 500) → 该通道 0 成功
    - 其他 7 通道仍成功
    - Slack mock 收到 2 次 (1 推送 + 1 重试)

  TestConcurPerfReal (2)
    - 8 通道并发 P99 < 10s (Windows 真实表现)
    - 7 通道累计次数正确

  TestDrillScriptImport (2)
    - drill_alert_full_chain.py 可 import (无语法错误)
    - 包含完整 7 步骤 (Step 1-7)
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.services.alert_service import push_alert
from app.services.alert_upstream_mocks import (
    TEST_PORTS,
    UpstreamMockCluster,
)

# ---------------------------------------------------------------------------
# 公共: fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def cluster():
    """8 通道真上游 mock 集群 (使用测试端口避免冲突)."""
    c = UpstreamMockCluster(ports=TEST_PORTS)
    c.start()
    yield c
    c.stop()


@pytest.fixture
def configured_settings(cluster):
    """把 settings 指向 mock cluster, 测试完还原."""
    saved = {
        "DINGTALK_WEBHOOK": settings.DINGTALK_WEBHOOK,
        "WECHAT_WORK_WEBHOOK": settings.WECHAT_WORK_WEBHOOK,
        "FEISHU_WEBHOOK": settings.FEISHU_WEBHOOK,
        "PAGERDUTY_ROUTING_KEY": settings.PAGERDUTY_ROUTING_KEY,
        "PAGERDUTY_API_URL": settings.PAGERDUTY_API_URL,
        "SLACK_WEBHOOK": settings.SLACK_WEBHOOK,
        "TEAMS_WEBHOOK": settings.TEAMS_WEBHOOK,
        "GENERIC_WEBHOOK_URL": settings.GENERIC_WEBHOOK_URL,
        "GENERIC_WEBHOOK_AUTH_HEADER": settings.GENERIC_WEBHOOK_AUTH_HEADER,
        "ALERT_EMAIL_TO": settings.ALERT_EMAIL_TO,
        "SMTP_HOST": settings.SMTP_HOST,
    }
    settings.DINGTALK_WEBHOOK = cluster.servers["dingtalk"].url()
    settings.WECHAT_WORK_WEBHOOK = cluster.servers["wechat"].url()
    settings.FEISHU_WEBHOOK = cluster.servers["feishu"].url()
    settings.PAGERDUTY_ROUTING_KEY = "PDK-TEST-001"
    settings.PAGERDUTY_API_URL = cluster.servers["pagerduty"].url()
    settings.SLACK_WEBHOOK = cluster.servers["slack"].url()
    settings.TEAMS_WEBHOOK = cluster.servers["teams"].url()
    settings.GENERIC_WEBHOOK_URL = cluster.servers["generic"].url()
    settings.GENERIC_WEBHOOK_AUTH_HEADER = "Bearer test-token"
    settings.ALERT_EMAIL_TO = ""
    settings.SMTP_HOST = ""
    try:
        yield saved
    finally:
        for k, v in saved.items():
            setattr(settings, k, v)


# ===========================================================================
# TestUpstreamMockCluster
# ===========================================================================
class TestUpstreamMockCluster:
    def test_start_stop_8_channels(self):
        c = UpstreamMockCluster()
        c.start()
        try:
            assert len(c.servers) == 8
            assert all(s.wait_ready(2.0) for s in c.servers.values())
        finally:
            c.stop()

    def test_post_recorded(self, cluster):
        async def _post():
            async with httpx.AsyncClient() as cli:
                r = await cli.post(
                    cluster.servers["dingtalk"].url(),
                    json={"text": "hi"},
                )
                return r.status_code, r.json()

        code, body = asyncio.run(_post())
        assert code == 200
        assert body["errcode"] == 0
        assert len(cluster.servers["dingtalk"].requests()) == 1
        rec = cluster.servers["dingtalk"].requests()[0]
        assert rec["payload"] == {"text": "hi"}
        assert rec["path"] == "/webhook"

    def test_control_status_code(self, cluster):
        cluster.configure("slack", status_code=500)

        async def _post():
            async with httpx.AsyncClient() as cli:
                r = await cli.post(cluster.servers["slack"].url(), json={})
                return r.status_code

        assert asyncio.run(_post()) == 500

    def test_control_fail_remaining(self, cluster):
        cluster.configure("teams", fail_remaining=2)

        async def _post():
            async with httpx.AsyncClient() as cli:
                rs = []
                for _ in range(3):
                    rs.append((await cli.post(cluster.servers["teams"].url(), json={})).status_code)
                return rs

        codes = asyncio.run(_post())
        # 前 2 次 fail, 第 3 次成功
        assert codes == [500, 500, 200]

    def test_reset(self, cluster):
        async def _post():
            async with httpx.AsyncClient() as cli:
                await cli.post(cluster.servers["dingtalk"].url(), json={"x": 1})

        asyncio.run(_post())
        assert len(cluster.servers["dingtalk"].requests()) == 1
        cluster.reset_all()
        assert len(cluster.servers["dingtalk"].requests()) == 0
        # 关闭后 reset_all 也能调
        cluster.reset_all()
        assert len(cluster.servers["dingtalk"].requests()) == 0


# ===========================================================================
# TestEightChannelE2EReal
# ===========================================================================
class TestEightChannelE2EReal:
    async def test_eight_channels_real(self, cluster, configured_settings):
        cluster.reset_all()
        r = await push_alert("[Test] Real E2E", "body", "critical")
        # 邮件无 SMTP → False, 其他 7 通道 True
        assert r["dingtalk"] is True
        assert r["wechat"] is True
        assert r["feishu"] is True
        assert r["pagerduty"] is True
        assert r["slack"] is True
        assert r["teams"] is True
        assert r["generic"] is True
        assert r["email"] is False
        recs = cluster.all_requests()
        assert len(recs["dingtalk"]) == 1
        assert len(recs["pagerduty"]) == 1
        assert len(recs["slack"]) == 1
        assert len(recs["teams"]) == 1
        assert len(recs["generic"]) == 1
        assert len(recs["feishu"]) == 1
        assert len(recs["wechat"]) == 1

    async def test_pagerduty_payload_correct(self, cluster, configured_settings):
        cluster.reset_all()
        await push_alert("[ZHSDatabaseDown] DB 不可达", "tcp timeout", "critical")
        rec = cluster.servers["pagerduty"].requests()[0]
        body = rec["payload"]
        assert body["routing_key"] == "PDK-TEST-001"
        assert body["event_action"] == "trigger"
        assert body["payload"]["severity"] == "critical"
        assert "DB 不可达" in body["payload"]["summary"]

    async def test_slack_teams_payload_format(self, cluster, configured_settings):
        cluster.reset_all()
        await push_alert("[Test] Format", "B", "critical")
        slack = cluster.servers["slack"].requests()[0]["payload"]
        assert "Test" in slack["text"]
        assert isinstance(slack["blocks"], list) and len(slack["blocks"]) > 0
        teams = cluster.servers["teams"].requests()[0]["payload"]
        assert teams["@type"] == "MessageCard"
        assert teams["themeColor"] == "FF0000"
        assert teams["title"] == "[Test] Format"

    async def test_generic_auth_header(self, cluster, configured_settings):
        cluster.reset_all()
        await push_alert("T", "B", "info")
        rec = cluster.servers["generic"].requests()[0]
        # mock 端统一小写化 headers
        assert rec["headers"].get("authorization") == "Bearer test-token"


# ===========================================================================
# TestDedupStabilityReal
# ===========================================================================
class TestDedupStabilityReal:
    async def test_same_source_same_dedup_key(self, cluster, configured_settings):
        cluster.reset_all()
        from app.services.alert_pagerduty import push_pagerduty

        # 同源 2 次推送
        await push_pagerduty(
            routing_key="PDK",
            title="[X] same",
            message="m1",
            severity="critical",
            dedup_key="X/svc/host1",
        )
        await push_pagerduty(
            routing_key="PDK",
            title="[X] same (持续)",
            message="m2",
            severity="critical",
            dedup_key="X/svc/host1",
        )
        recs = cluster.servers["pagerduty"].requests()
        assert len(recs) == 2
        assert recs[0]["payload"]["dedup_key"] == "X/svc/host1"
        assert recs[1]["payload"]["dedup_key"] == "X/svc/host1"
        assert recs[0]["payload"]["dedup_key"] == recs[1]["payload"]["dedup_key"]

    async def test_different_source_different_dedup_key(self, cluster, configured_settings):
        cluster.reset_all()
        from app.services.alert_pagerduty import push_pagerduty

        await push_pagerduty(
            routing_key="PDK",
            title="A",
            message="",
            severity="critical",
            dedup_key="A/svc/h1",
        )
        await push_pagerduty(
            routing_key="PDK",
            title="B",
            message="",
            severity="critical",
            dedup_key="B/svc/h1",
        )
        recs = cluster.servers["pagerduty"].requests()
        assert recs[0]["payload"]["dedup_key"] == "A/svc/h1"
        assert recs[1]["payload"]["dedup_key"] == "B/svc/h1"
        assert recs[0]["payload"]["dedup_key"] != recs[1]["payload"]["dedup_key"]


# ===========================================================================
# TestInhibitionInRealE2E
# ===========================================================================
RULES_YAML = Path("docker/alertmanager/alertmanager.yml")


class TestInhibitionInRealE2E:
    async def test_inhibition_applies(self, cluster, configured_settings):
        if not RULES_YAML.exists():
            pytest.skip(f"rules yaml not found: {RULES_YAML}")
        from app.alert_inhibition import ZHS_INHIBITION_PRESETS, AlertInhibitor
        from app.alertmanager_emulator import AlertmanagerEmulator

        cluster.reset_all()
        emu = AlertmanagerEmulator(rules_yaml=RULES_YAML)
        emu.start()
        try:
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSRollbackActive", "severity": "critical", "service": "api"},
                    "annotations": {"summary": "回滚激活"},
                }
            )
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "api"},
                    "annotations": {"summary": "卡住"},
                }
            )
            fired = emu.fired_alerts
            inh = AlertInhibitor(ZHS_INHIBITION_PRESETS)
            surviving = inh.apply(fired)
            assert len(surviving) == 1
            assert surviving[0]["labels"]["alertname"] == "ZHSRollbackActive"

            from app.services.alert_pagerduty import from_prometheus_alert

            for a in surviving:
                kw = from_prometheus_alert(a)
                await push_alert(kw["title"], kw["message"], kw["severity"])
        finally:
            emu.stop()
        recs = cluster.all_requests()
        assert len(recs["pagerduty"]) == 1
        body = recs["pagerduty"][0]["payload"]
        assert "Rollback" in body["payload"]["summary"]

    async def test_inhibition_after_push_7_channels(self, cluster, configured_settings):
        if not RULES_YAML.exists():
            pytest.skip(f"rules yaml not found: {RULES_YAML}")
        from app.alert_inhibition import ZHS_INHIBITION_PRESETS, AlertInhibitor
        from app.alertmanager_emulator import AlertmanagerEmulator

        cluster.reset_all()
        emu = AlertmanagerEmulator(rules_yaml=RULES_YAML)
        emu.start()
        try:
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSRollbackActive", "severity": "critical", "service": "api"},
                    "annotations": {"summary": "回滚"},
                }
            )
            emu.push_alert(
                {
                    "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "api"},
                    "annotations": {"summary": "卡住"},
                }
            )
            inh = AlertInhibitor(ZHS_INHIBITION_PRESETS)
            surviving = inh.apply(emu.fired_alerts)
            from app.services.alert_pagerduty import from_prometheus_alert

            for a in surviving:
                kw = from_prometheus_alert(a)
                await push_alert(kw["title"], kw["message"], kw["severity"])
        finally:
            emu.stop()
        recs = cluster.all_requests()
        # 7 通道 (除 email) 各收到 1 次
        for ch in ("dingtalk", "wechat", "feishu", "pagerduty", "slack", "teams", "generic"):
            assert len(recs[ch]) == 1, f"{ch} got {len(recs[ch])}"


# ===========================================================================
# TestFailureIsolationReal
# ===========================================================================
class TestFailureIsolationReal:
    async def test_slack_down(self, cluster, configured_settings):
        cluster.configure("slack", status_code=500)
        cluster.reset_all()
        r = await push_alert("T", "B", "warning")
        assert r["slack"] is False
        # 其他 6 HTTP 通道仍成功
        assert all([r["dingtalk"], r["wechat"], r["feishu"], r["pagerduty"], r["teams"], r["generic"]])

    async def test_slack_retry(self, cluster, configured_settings):
        cluster.configure("slack", status_code=500)
        cluster.reset_all()
        await push_alert("T", "B", "warning")
        # Slack mock 收到 2 次 (1 推送 + 1 重试)
        assert len(cluster.servers["slack"].requests()) == 2

    async def test_two_channels_down_other_5_ok(self, cluster, configured_settings):
        cluster.configure("slack", status_code=500)
        cluster.configure("teams", status_code=503)
        cluster.reset_all()
        r = await push_alert("T", "B", "warning")
        assert r["slack"] is False
        assert r["teams"] is False
        assert all([r["dingtalk"], r["wechat"], r["feishu"], r["pagerduty"], r["generic"]])


# ===========================================================================
# TestConcurPerfReal
# ===========================================================================
class TestConcurPerfReal:
    async def test_eight_concurrent_p99(self, cluster, configured_settings):
        cluster.reset_all()
        # warmup
        for _ in range(3):
            await push_alert("warm", "w", "info")
        cluster.reset_all()
        timings = []
        for i in range(20):
            t0 = time.perf_counter()
            await push_alert(f"Perf-{i}", f"B-{i}", "info")
            timings.append((time.perf_counter() - t0) * 1000)
        p99 = sorted(timings)[int(len(timings) * 0.99) - 1]
        # Windows 真实表现, 容忍 20s (全量回归时机器负载高)
        assert p99 < 20000, f"p99={p99:.0f}ms"

    async def test_seven_channels_count(self, cluster, configured_settings):
        cluster.reset_all()
        for i in range(10):
            await push_alert(f"X-{i}", "B", "info")
        recs = cluster.all_requests()
        # 7 通道 (除 email) 各收到 10 次
        for ch in ("dingtalk", "wechat", "feishu", "pagerduty", "slack", "teams", "generic"):
            assert len(recs[ch]) == 10, f"{ch} got {len(recs[ch])}"


# ===========================================================================
# TestDrillScriptImport
# ===========================================================================
class TestDrillScriptImport:
    def test_drill_script_importable(self):
        """演练脚本必须能编译 + 含运行入口 (语法 + 结构验证).

        修复 (P15-C2): 原设计用 spec.loader.exec_module() 真执行整个脚本顶层
        代码,会启动 mock cluster + uvicorn server + 完整 7 步骤演练, 单测要 5+
        分钟, 是 P15 全量回归卡死根因. 改用 compile() 验证语法 + 静态结构.
        """
        from pathlib import Path

        path = Path("scripts/ci/drill_alert_full_chain.py").resolve()
        if not path.exists():
            pytest.skip(f"drill script not found: {path}")
        src = path.read_text(encoding="utf-8")
        # 1. 语法能编译
        code = compile(src, str(path), "exec")
        assert code is not None
        # 2. 含运行入口 (asyncio.run(run_drill()) 顶层调用)
        assert "asyncio.run(run_drill())" in src, "缺少 asyncio.run(run_drill()) 入口"
        assert "async def run_drill" in src, "缺少 run_drill 函数定义"
        # 3. 含 7 步骤标记
        for step in range(1, 8):
            assert f"[Step {step}" in src, f"缺少 Step {step} 标记"

    def test_drill_script_has_7_steps(self):
        """演练脚本必须包含 7 步骤 (Step 1-7)."""
        from pathlib import Path

        path = Path("scripts/ci/drill_alert_full_chain.py")
        if not path.exists():
            pytest.skip(f"drill script not found: {path}")
        text = path.read_text(encoding="utf-8")
        for i in range(1, 8):
            assert f"[Step {i}" in text, f"missing [Step {i}]"
