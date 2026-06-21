"""Alertmanager 通知链路演练 (建议 100) 单元测试.

覆盖:
  - argparse 参数解析 (--alertname / --severity / --status)
  - _build_alertmanager_body 构造标准格式 JSON
  - webhook POST 200 + received / pushed 计数
  - firing 告警应被 pushed (mock 推送)
  - resolved 告警不应被 pushed
  - alerts history 写入正确 (title / severity)
  - 演练失败时 main_async 返回 1
  - 演练成功时 main_async 返回 0
"""

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import drill_alert_webhook as drill  # noqa: E402

# ---------------------------------------------------------------------------
# argparse
# ---------------------------------------------------------------------------


def test_argparse_defaults():
    """默认参数应为 ZHSSlowSQLWithTrace / critical / firing."""
    test_args = ["drill_alert_webhook.py"]
    with patch.object(sys, "argv", test_args):
        args = drill._build_argparse() if hasattr(drill, "_build_argparse") else None
    # main() 用 argparse, 这里直接调 main 取 args
    # 但 main 是 async, 测的方式: 模拟 main() 调用的参数
    pass


def test_argparse_via_main(monkeypatch):
    """main() 默认参数解析."""
    monkeypatch.setattr(sys, "argv", ["drill_alert_webhook.py"])
    with patch.object(drill, "main_async", return_value=0) as mock_async:
        rc = drill.main()
    assert rc == 0
    args_passed = mock_async.call_args[0][0]
    assert args_passed.alertname == "ZHSSlowSQLWithTrace"
    assert args_passed.severity == "critical"
    assert args_passed.status == "firing"


def test_argparse_custom_args(monkeypatch):
    """main() 自定义参数."""
    test_args = [
        "drill_alert_webhook.py",
        "--alertname",
        "ZHSHighErrorRate",
        "--severity",
        "warning",
        "--status",
        "resolved",
    ]
    monkeypatch.setattr(sys, "argv", test_args)
    with patch.object(drill, "main_async", return_value=0) as mock_async:
        rc = drill.main()
    assert rc == 0
    args_passed = mock_async.call_args[0][0]
    assert args_passed.alertname == "ZHSHighErrorRate"
    assert args_passed.severity == "warning"
    assert args_passed.status == "resolved"


# ---------------------------------------------------------------------------
# _build_alertmanager_body
# ---------------------------------------------------------------------------


def test_build_alertmanager_body_firing():
    body = drill._build_alertmanager_body("ZHSFoo", "critical", "firing")
    assert body["status"] == "firing"
    assert len(body["alerts"]) == 1
    alert = body["alerts"][0]
    assert alert["status"] == "firing"
    assert alert["labels"]["alertname"] == "ZHSFoo"
    assert alert["labels"]["severity"] == "critical"
    assert alert["labels"]["service"] == "zhs-platform"
    assert alert["annotations"]["summary"] == "ZHSFoo 触发演练"
    assert alert["endsAt"] == "0001-01-01T00:00:00Z"
    assert "startsAt" in alert


def test_build_alertmanager_body_resolved():
    body = drill._build_alertmanager_body("ZHSBar", "warning", "resolved")
    alert = body["alerts"][0]
    assert alert["status"] == "resolved"
    assert alert["endsAt"] != "0001-01-01T00:00:00Z", "resolved 告警应设实际 endsAt"


def test_build_alertmanager_body_receiver_changes_with_severity():
    """critical 用 zhs-critical, 其它用 zhs-default."""
    body_crit = drill._build_alertmanager_body("X", "critical")
    body_warn = drill._build_alertmanager_body("X", "warning")
    assert body_crit["receiver"] == "zhs-critical"
    assert body_warn["receiver"] == "zhs-default"


# ---------------------------------------------------------------------------
# 演练 main_async 端到端 (mock 推送 + webhook + history)
# ---------------------------------------------------------------------------


def test_main_async_firing_returns_zero(monkeypatch):
    """firing 演练: 推送 + history 写入, 应返回 0."""
    args = drill.argparse.Namespace(alertname="ZHSDrillFiring", severity="critical", status="firing")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 0, f"演练应 PASS, 实际 rc={rc}"


def test_main_async_resolved_returns_zero(monkeypatch):
    """resolved 演练: 推送 (实际不推) + history 写入, 应返回 0."""
    args = drill.argparse.Namespace(alertname="ZHSDrillResolved", severity="warning", status="resolved")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 0, f"演练应 PASS, 实际 rc={rc}"


def test_main_async_returns_one_when_webhook_fails(monkeypatch):
    """webhook 响应非 200 时应返回 1."""

    # mock _post_webhook 返回 (500, {...})
    async def fake_post(body):
        return 500, {"code": "500", "msg": "boom"}

    monkeypatch.setattr(drill, "_post_webhook", fake_post)
    args = drill.argparse.Namespace(alertname="ZHSBoom", severity="critical", status="firing")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 1, f"webhook 失败应 FAIL, 实际 rc={rc}"


def test_main_async_returns_one_when_pushed_zero_for_firing(monkeypatch):
    """firing 告警但 pushed=0 应返回 1 (链路异常)."""

    async def fake_post(body):
        return 200, {"code": "200", "data": {"received": 1, "pushed": 0}}

    monkeypatch.setattr(drill, "_post_webhook", fake_post)
    args = drill.argparse.Namespace(alertname="ZHSZeroPush", severity="critical", status="firing")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 1, f"firing 但 pushed=0 应 FAIL, 实际 rc={rc}"


def test_main_async_returns_one_when_history_missing(monkeypatch):
    """history 中找不到对应 alertname 应返回 1."""

    # 先 fire 一个, 然后 history 已被改写为 []
    async def fake_post(body):
        return 200, {"code": "200", "data": {"received": 1, "pushed": 1}}

    async def fake_history():
        return []

    monkeypatch.setattr(drill, "_post_webhook", fake_post)
    monkeypatch.setattr(drill, "_fetch_alert_history", fake_history)
    args = drill.argparse.Namespace(alertname="ZHSGhost", severity="critical", status="firing")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 1, f"history 缺记录应 FAIL, 实际 rc={rc}"


def test_main_async_returns_one_when_severity_mismatch(monkeypatch):
    """history 里的 severity 与请求不一致应返回 1."""

    async def fake_post(body):
        return 200, {"code": "200", "data": {"received": 1, "pushed": 1}}

    async def fake_history():
        return [
            {
                "title": "ZHSDrillSev 触发演练",
                "severity": "info",  # 期望 critical
            }
        ]

    monkeypatch.setattr(drill, "_post_webhook", fake_post)
    monkeypatch.setattr(drill, "_fetch_alert_history", fake_history)
    args = drill.argparse.Namespace(alertname="ZHSDrillSev", severity="critical", status="firing")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 1, f"severity 不匹配应 FAIL, 实际 rc={rc}"


def test_main_async_resolved_pushed_zero_required(monkeypatch):
    """resolved 告警不应被 push (pushed=0 才是对的)."""

    async def fake_post(body):
        return 200, {"code": "200", "data": {"received": 1, "pushed": 0}}

    async def fake_history():
        return [{"title": "ZHSResolved 触发演练", "severity": "warning"}]

    monkeypatch.setattr(drill, "_post_webhook", fake_post)
    monkeypatch.setattr(drill, "_fetch_alert_history", fake_history)
    args = drill.argparse.Namespace(alertname="ZHSResolved", severity="warning", status="resolved")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 0, f"resolved + pushed=0 应 PASS, 实际 rc={rc}"


def test_main_async_resolved_with_pushed_returns_one(monkeypatch):
    """resolved 告警被 push 了 (pushed=1) 是异常, 应返回 1."""

    async def fake_post(body):
        return 200, {"code": "200", "data": {"received": 1, "pushed": 1}}

    monkeypatch.setattr(drill, "_post_webhook", fake_post)
    args = drill.argparse.Namespace(alertname="ZHSResolvedBad", severity="warning", status="resolved")
    rc = asyncio.run(drill.main_async(args))
    assert rc == 1, f"resolved 被 push 应 FAIL, 实际 rc={rc}"
