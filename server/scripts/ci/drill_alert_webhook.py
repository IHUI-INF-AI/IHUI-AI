"""Alertmanager 通知链路演练 (建议 100).

模拟 alertmanager → 平台 webhook → push_alert (mock 真实推送) → 内存历史 整条链路,
确认告警从"指标触发"到"消息落地 + 历史记录"全链路通畅.

不在 CI 走真实钉钉/飞书 (需要 webhook URL), 改为:
  - mock 掉 push_dingtalk / push_wechat / push_feishu / send_email (返回 True)
  - 真实跑 webhook 端点 + record_alert
  - 验证 alerts history 含新条目, title/message 解析正确

CI 用法:
    python scripts/ci/drill_alert_webhook.py

本地手动:
    python scripts/ci/drill_alert_webhook.py --severity critical --alertname ZHSSlowSQLWithTrace
"""

import argparse
import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# 工具: 构造 alertmanager 标准格式 JSON
# ---------------------------------------------------------------------------


def _build_alertmanager_body(alertname: str, severity: str, status: str = "firing") -> dict:
    """构造 alertmanager webhook 标准 body.

    参考: https://prometheus.io/docs/alerting/latest/configuration/#webhook_config
    """
    return {
        "version": "4",
        "groupKey": f'{{alertname="{alertname}"}}',
        "status": status,
        "receiver": "zhs-critical" if severity == "critical" else "zhs-default",
        "alerts": [
            {
                "status": status,
                "labels": {
                    "alertname": alertname,
                    "severity": severity,
                    "service": "zhs-platform",
                    "instance": "zhs-platform-7d4b-abc12",
                },
                "annotations": {
                    "summary": f"{alertname} 触发演练",
                    "description": f"演练注入的测试告警, alertname={alertname}, severity={severity}",
                },
                "startsAt": "2026-06-13T08:00:00Z",
                "endsAt": "2026-06-13T08:05:00Z" if status == "resolved" else "0001-01-01T00:00:00Z",
            }
        ],
    }


# ---------------------------------------------------------------------------
# Step 1: 启动 FastAPI + 注入 push_* mock
# ---------------------------------------------------------------------------


async def _post_webhook(body: dict) -> tuple:
    """POST body 到 /api/v1/monitor/alerts/webhook, 返回 (status_code, resp_json)."""
    import httpx

    from app.main import create_app

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=10.0) as ac:
        r = await ac.post("/api/v1/monitor/alerts/webhook", json=body)
        return r.status_code, (
            r.json() if r.headers.get("content-type", "").startswith("application/json") else {"text": r.text}
        )


async def _fetch_alert_history() -> list:
    """GET /api/v1/monitor/alerts/history, 返回 history 列表.

    /history 端点 require_login, 演练时 mock 掉 require_login 让它能直接拿到 history.
    """
    # 直接读 _ALERT_HISTORY 内部状态, 避免走 HTTP + auth
    from app.api.v1.monitor.alerts import list_recent_alerts

    return list_recent_alerts()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main_async(args) -> int:
    print("=" * 60)
    print("Alertmanager 通知链路演练 (建议 100)")
    print("=" * 60)
    print(f"配置: alertname={args.alertname} severity={args.severity} status={args.status}")

    # 1) 构造 alertmanager body
    body = _build_alertmanager_body(args.alertname, args.severity, args.status)
    print("\n[Step 1] 构造 alertmanager webhook body...")
    print(f"  -> alerts={len(body['alerts'])} status={body['status']}")

    # 2) Mock 所有 push_* 渠道, 避免真实网络请求
    print("\n[Step 2] Mock 推送渠道 (避免真实网络)...")
    with (
        patch("app.services.alert_service.push_dingtalk", return_value=True),
        patch("app.services.alert_service.push_wechat_work", return_value=True),
        patch("app.services.alert_service.push_feishu", return_value=True),
        patch("app.services.alert_service.send_email", return_value=True),
        patch("app.services.alert_service.settings") as mock_settings,
    ):
        # 让 settings 让所有渠道都"已配置" → push_alert 会真正尝试推
        mock_settings.DINGTALK_WEBHOOK = "https://mock.dingtalk/robot"
        mock_settings.WECHAT_WORK_WEBHOOK = "https://mock.wechat/robot"
        mock_settings.FEISHU_WEBHOOK = "https://mock.feishu/robot"
        mock_settings.ALERT_EMAIL_TO = "ops@aizhs.top"
        mock_settings.SMTP_HOST = "mock.smtp"
        # 真实 push_dingtalk/push_wechat_work/push_feishu/send_email 也得 patch
        # (因为 alert_service 内部 import + 调用, 而不是从 app.services.alert_service 拿)
        from app.services import alert_service as _as

        with (
            patch.object(_as, "push_dingtalk", return_value=True),
            patch.object(_as, "push_wechat_work", return_value=True),
            patch.object(_as, "push_feishu", return_value=True),
            patch.object(_as, "send_email", return_value=True),
        ):
            # 3) POST webhook
            print("\n[Step 3] POST /api/v1/monitor/alerts/webhook ...")
            status_code, resp = await _post_webhook(body)
            print(f"  -> HTTP {status_code}: {resp}")
            if status_code != 200:
                print("  -> ❌ webhook 响应非 200")
                return 1

            received = resp.get("data", {}).get("received", 0)
            pushed = resp.get("data", {}).get("pushed", 0)
            if args.status == "firing" and pushed < 1:
                print(f"  -> ❌ firing 告警应被 pushed, 实际 pushed={pushed}")
                return 1
            if args.status == "resolved" and pushed != 0:
                print(f"  -> ❌ resolved 告警不应被 pushed, 实际 pushed={pushed}")
                return 1
            print(f"  -> ✅ webhook 收到 {received} 个告警, pushed {pushed} 个")

            # 4) 验证 alert history
            print("\n[Step 4] GET /api/v1/monitor/alerts/history ...")
            history = await _fetch_alert_history()
            print(f"  -> history 现有 {len(history)} 条记录")
            # 找最近一条 title 含 alertname 的记录
            matched = [h for h in history if args.alertname in (h.get("title") or "")]
            if not matched:
                print(f"  -> ❌ history 中找不到 alertname={args.alertname} 的记录")
                return 1
            latest = matched[-1]
            print(f"  -> ✅ history 含最新记录: title={latest.get('title')!r} severity={latest.get('severity')!r}")
            if latest.get("severity") != args.severity:
                print(f"  -> ❌ severity 不匹配, 期望 {args.severity}, 实际 {latest.get('severity')}")
                return 1

    print("\n" + "=" * 60)
    print("✅ PASS: Alertmanager 通知链路演练通过")
    print("=" * 60)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Alertmanager 通知链路演练 (建议 100)")
    p.add_argument("--alertname", default="ZHSSlowSQLWithTrace", help="告警名 (默认 ZHSSlowSQLWithTrace)")
    p.add_argument("--severity", default="critical", choices=["critical", "warning", "info"], help="严重度")
    p.add_argument("--status", default="firing", choices=["firing", "resolved"], help="告警状态")
    args = p.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
