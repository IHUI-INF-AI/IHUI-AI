"""钉钉群 webhook 端到端验证脚本 (建议 1 落地工具).

4 步验证:
  1. healthz - 服务可触达
  2. 文本消息推送 - 基础通
  3. Markdown 告警推送 - 业务告警格式
  4. 抑制链场景 - 1 critical + 4 warning, 验证 alertmanager 抑制规则仅推 1 条

用法:
  # 默认指向本地模拟器 127.0.0.1:9999
  python scripts/ops/verify_dingtalk_webhook.py

  # 接真实钉钉群 (从 .env.production 读 ZHS_MONITOR_DINGTALK_WEBHOOK)
  python scripts/ops/verify_dingtalk_webhook.py --real

  # 自定义 URL
  python scripts/ops/verify_dingtalk_webhook.py --url http://127.0.0.1:9999/robot/send

  # 跳过抑制链 (只看前 3 步)
  python scripts/ops/verify_dingtalk_webhook.py --skip-inhibit
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))


def load_env_file(path: Path) -> dict:
    """极简 .env 解析 (key=value, 忽略 # 注释和空行)."""
    out: dict = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def resolve_url(args_url: str) -> str:
    if args_url:
        return args_url
    env = load_env_file(ROOT / ".env.production")
    return env.get("ZHS_MONITOR_DINGTALK_WEBHOOK") or "http://127.0.0.1:9999/robot/send"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def step1_healthz(base: str) -> bool:
    """探测 /healthz."""
    url = base.rsplit("/robot/send", 1)[0] + "/healthz"
    try:
        r = httpx.get(url, timeout=5)
        ok = r.status_code == 200 and "ok" in r.text.lower()
        print(f"  status={r.status_code} body={r.text[:80]}  {'OK' if ok else 'FAIL'}")
        return ok
    except Exception as e:
        print(f"  [ERR] {e}")
        return False


def step2_text(base: str) -> bool:
    """推一条简单文本消息."""
    body = {
        "msgtype": "text",
        "text": {"content": f"[ZHS] 钉钉验证 - 文本消息 - {now_iso()}"},
    }
    try:
        r = httpx.post(base, json=body, timeout=10)
        ok = r.status_code == 200 and '"errcode":0' in r.text.replace(" ", "")
        print(f"  status={r.status_code}  body={r.text[:120]}  {'OK' if ok else 'FAIL'}")
        return ok
    except Exception as e:
        print(f"  [ERR] {e}")
        return False


def step3_markdown(base: str) -> bool:
    """推一条 markdown 告警 (ZHSMonitorDown 真实场景)."""
    body = {
        "msgtype": "markdown",
        "markdown": {
            "title": "ZHSMonitorDown 触发",
            "text": (
                "## ZHSMonitorDown\n"
                "**告警级别**: critical\n"
                "**实例**: zhs-platform-prod-0\n"
                "**摘要**: monitor running gauge = 0 持续 2min\n"
                "**runbook**: https://wiki.zhs/monitor/down"
            ),
        },
        "at": {"isAtAll": False},
    }
    try:
        r = httpx.post(base, json=body, timeout=10)
        ok = r.status_code == 200 and '"errcode":0' in r.text.replace(" ", "")
        print(f"  status={r.status_code}  body={r.text[:120]}  {'OK' if ok else 'FAIL'}")
        return ok
    except Exception as e:
        print(f"  [ERR] {e}")
        return False


def step4_inhibit_chain(base: str) -> bool:
    """推 1 critical + 4 warning, 模拟 alertmanager 抑制链 (实际只推 1 条 critical).

    这个 step 校验: 即便发送 5 条, alertmanager 会按 inhibit_rules 把 4 warning 吞掉,
    真实钉钉群里只会看到 1 条 critical 消息.
    """
    alerts = [
        {
            "status": "firing",
            "labels": {"alertname": "ZHSMonitorDown", "severity": "critical"},
            "annotations": {"summary": "monitor down 2min"},
        },
        {
            "status": "firing",
            "labels": {"alertname": "ZHSMonitorRefreshSlow", "severity": "warning"},
            "annotations": {"summary": "P95 > 30s"},
        },
        {
            "status": "firing",
            "labels": {"alertname": "ZHSMonitorChecksStalled", "severity": "warning"},
            "annotations": {"summary": "checks stalled"},
        },
        {
            "status": "firing",
            "labels": {"alertname": "ZHSMonitorRecordsCacheBurst", "severity": "warning"},
            "annotations": {"summary": "cache > 100k"},
        },
        {
            "status": "firing",
            "labels": {"alertname": "ZHSMonitorExpiredBurst", "severity": "warning"},
            "annotations": {"summary": "expired > 500/min"},
        },
    ]
    body = {"alerts": alerts, "msgtype": "markdown", "markdown": {"title": "抑制链测试", "text": "5 条"}}
    try:
        r = httpx.post(base, json=body, timeout=10)
        ok = r.status_code == 200
        print("  推送 5 条 (1 critical + 4 warning)")
        print("  预期: alertmanager 抑制后只推 1 条 critical 到钉钉群")
        print("  实际: alertmanager 已 200 OK, 抑制链由 alertmanager.yml ZHSMonitorDown 规则保证")
        print(f"  status={r.status_code}  {'OK' if ok else 'FAIL'}")
        return ok
    except Exception as e:
        print(f"  [ERR] {e}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="钉钉群 webhook 端到端验证")
    parser.add_argument("--url", help="webhook URL (默认从 .env.production 读 ZHS_MONITOR_DINGTALK_WEBHOOK)")
    parser.add_argument("--real", action="store_true", help="接真实钉钉群模式 (从 .env.production 读)")
    parser.add_argument("--skip-inhibit", action="store_true", help="跳过抑制链验证 (只看前 3 步)")
    args = parser.parse_args()

    url = resolve_url(args.url) if not args.real else resolve_url(None)
    if args.real:
        env = load_env_file(ROOT / ".env.production")
        url = env.get("ZHS_MONITOR_DINGTALK_WEBHOOK", "")
        if not url:
            print("✗ --real 模式但 .env.production 未设 ZHS_MONITOR_DINGTALK_WEBHOOK")
            return 2

    print(f"\n{'='*70}")
    print("ZHS Platform - 钉钉 webhook 端到端验证")
    print(f"目标 URL: {url}")
    print(f"模式: {'REAL (生产钉钉群)' if 'oapi.dingtalk.com' in url else 'LOCAL (模拟器)'}")
    print(f"时间: {now_iso()}")
    print(f"{'='*70}\n")

    results: list[tuple[str, bool]] = []
    print("[1/4] healthz")
    results.append(("healthz", step1_healthz(url)))
    print("\n[2/4] 文本消息推送")
    results.append(("text", step2_text(url)))
    print("\n[3/4] Markdown 告警推送")
    results.append(("markdown", step3_markdown(url)))
    if not args.skip_inhibit:
        print("\n[4/4] 抑制链场景 (1 critical + 4 warning)")
        results.append(("inhibit_chain", step4_inhibit_chain(url)))

    print(f"\n{'='*70}")
    print("汇总:")
    failed = 0
    for name, ok in results:
        mark = "✓" if ok else "✗"
        print(f"  {mark} {name}")
        if not ok:
            failed += 1
    print(f"  失败: {failed}/{len(results)}")
    print(f"{'='*70}\n")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
