"""8 通道告警真实环境演练脚本.

目的:
- 验证 prod/staging 环境的告警通道实际可达
- 输出每个通道的: 配置状态 / HTTP 状态码 / 响应内容 / 延迟
- 生成 JSON 报告便于自动化追踪

8 通道:
1. dingtalk     (钉钉 webhook + secret)
2. wechat_work  (企业微信 webhook)
3. feishu       (飞书 webhook)
4. email        (SMTP)
5. pagerduty    (Events API v2)
6. slack        (Incoming Webhook)
7. teams        (Microsoft Teams MessageCard)
8. generic      (Generic HTTP webhook)

用法:
    python scripts/alert_drill_8channels.py                    # 全通道演练
    python scripts/alert_drill_8channels.py --dry-run          # 只读配置, 不发请求
    python scripts/alert_drill_8channels.py --channel dingtalk # 单通道演练
    python scripts/alert_drill_8channels.py --output drill.json

退出码:
    0: 所有配置通道通过
    1: 至少一个配置通道失败
    2: 没有配置任何通道 (演练无效)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# 把项目根加进 sys.path 以便导入 app.*
SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))

# noqa: E402 必须在 sys.path 修改后导入
from app.config import settings  # noqa: E402
from app.services.alert_service import push_alert  # noqa: E402


CHANNEL_LABELS = {
    "dingtalk": "钉钉 (DingTalk)",
    "wechat_work": "企业微信 (WeChat Work)",
    "feishu": "飞书 (Feishu)",
    "email": "邮件 (Email/SMTP)",
    "pagerduty": "PagerDuty Events API v2",
    "slack": "Slack Incoming Webhook",
    "teams": "Microsoft Teams MessageCard",
    "generic": "Generic HTTP Webhook",
}

# push_alert 返回的 result key 映射 (与 channel 名可能不同, e.g. wechat_work -> wechat)
CHANNEL_TO_RESULT_KEY = {
    "dingtalk": "dingtalk",
    "wechat_work": "wechat",
    "feishu": "feishu",
    "email": "email",
    "pagerduty": "pagerduty",
    "slack": "slack",
    "teams": "teams",
    "generic": "generic",
}


def _channel_configured(channel: str) -> bool:
    """检查通道是否已配置 (即不是空字符串)."""
    cfg = {
        "dingtalk": bool(settings.DINGTALK_WEBHOOK and settings.DINGTALK_SECRET),
        "wechat_work": bool(settings.WECHAT_WORK_WEBHOOK),
        "feishu": bool(settings.FEISHU_WEBHOOK),
        "email": bool(settings.SMTP_HOST and settings.SMTP_USER and settings.ALERT_EMAIL_TO),
        "pagerduty": bool(settings.PAGERDUTY_ROUTING_KEY),
        "slack": bool(settings.SLACK_WEBHOOK),
        "teams": bool(settings.TEAMS_WEBHOOK),
        "generic": bool(settings.GENERIC_WEBHOOK_URL),
    }
    return cfg.get(channel, False)


def _all_channels() -> list[str]:
    return list(CHANNEL_LABELS.keys())


async def _drill_one(channel: str, dry_run: bool) -> dict:
    """对单个通道执行演练, 返回结果 dict."""
    label = CHANNEL_LABELS[channel]
    configured = _channel_configured(channel)
    if not configured:
        return {
            "channel": channel,
            "label": label,
            "configured": False,
            "skipped": True,
            "skip_reason": "通道未配置 (环境变量为空)",
        }
    if dry_run:
        return {
            "channel": channel,
            "label": label,
            "configured": True,
            "dry_run": True,
            "skipped": False,
        }

    t0 = time.time()
    try:
        result = await push_alert(
            title=f"[DRILL] 8通道告警演练 - {label}",
            message=f"这是来自 alert_drill_8channels.py 的测试告警, 通道={channel}, "
                    f"时间={datetime.now(timezone.utc).isoformat()}",
            severity="warning",
        )
        elapsed = round(time.time() - t0, 3)
        result_key = CHANNEL_TO_RESULT_KEY.get(channel, channel)
        ok = result.get(result_key, False)
        return {
            "channel": channel,
            "label": label,
            "configured": True,
            "skipped": False,
            "success": bool(ok),
            "elapsed_sec": elapsed,
            "all_channels_result": result,
        }
    except Exception as e:
        elapsed = round(time.time() - t0, 3)
        return {
            "channel": channel,
            "label": label,
            "configured": True,
            "skipped": False,
            "success": False,
            "elapsed_sec": elapsed,
            "error": f"{type(e).__name__}: {e}",
        }


async def drill(channels: list[str], dry_run: bool) -> list[dict]:
    results: list[dict] = []
    # 串行执行, 避免多通道并发干扰
    for ch in channels:
        r = await _drill_one(ch, dry_run)
        results.append(r)
        status = "OK" if r.get("success") else (
            "SKIP" if r.get("skipped") else "FAIL"
        )
        print(f"  [{status:4s}] {r['label']:35s}", end="")
        if r.get("elapsed_sec") is not None:
            print(f"  {r['elapsed_sec']:.2f}s", end="")
        if r.get("error"):
            print(f"  {r['error'][:80]}")
        elif r.get("skip_reason"):
            print(f"  {r['skip_reason']}")
        elif r.get("dry_run"):
            print("  (dry-run)")
        else:
            print()
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="8 通道告警真实环境演练")
    parser.add_argument("--dry-run", action="store_true",
                        help="只检查配置, 不发真实请求")
    parser.add_argument("--channel", choices=_all_channels(),
                        help="只演练指定通道, 默认全部")
    parser.add_argument("--output", default="",
                        help="输出 JSON 报告到指定文件")
    args = parser.parse_args()

    channels = [args.channel] if args.channel else _all_channels()
    print(f"[drill] 模式: {'dry-run' if args.dry_run else 'live'}")
    print(f"[drill] 通道: {channels}")
    print(f"[drill] ENV: {os.getenv('ENV', 'dev')}")
    print()

    results = asyncio.run(drill(channels, args.dry_run))

    # 汇总
    total = len(results)
    skipped = sum(1 for r in results if r.get("skipped"))
    passed = sum(1 for r in results if r.get("success"))
    failed = sum(1 for r in results
                 if r.get("configured") and not r.get("skipped") and not r.get("success"))
    print()
    print(f"[drill] 汇总: total={total} passed={passed} failed={failed} skipped={skipped}")

    # JSON 报告
    report = {
        "tool": "alert_drill_8channels",
        "ts": datetime.now(timezone.utc).isoformat(),
        "env": os.getenv("ENV", "dev"),
        "mode": "dry-run" if args.dry_run else "live",
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
        },
        "results": results,
    }
    if args.output:
        out = Path(args.output)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[drill] 报告: {out.absolute()}")

    # 退出码
    if configured_count := sum(1 for r in results if r.get("configured")):
        if failed == 0:
            return 0
        return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
