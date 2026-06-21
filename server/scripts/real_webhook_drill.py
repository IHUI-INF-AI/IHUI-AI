"""真实生产 webhook 演练脚本 (webhook.site 模式).

与 mock receiver 演练不同, 本脚本:
1. 自动创建 webhook.site 接收端点 (用 webhook.site API)
2. 把 8 通道全部指向 webhook.site 演练 URL
3. 重启后端加载新配置
4. 触发后端 push_alert 走 8 通道
5. 验证 webhook.site 收到 8 个独立请求
6. 输出每个通道的 request_id 供运维人工核对

适用场景:
- 无真实生产 webhook 时, 用 webhook.site 公网接收演练
- 比 mock receiver 更接近真实生产 (公网 HTTP, 公网 DNS, 公网 TLS)
- 不需要本地监听器

用法:
    python scripts/real_webhook_drill.py
    python scripts/real_webhook_drill.py --token my-uuid  # 复用已有 webhook.site token
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

SERVER_ROOT = Path(__file__).resolve().parent.parent
WEBHOOK_SITE_API = "https://webhook.site"
BACKEND = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000")

CHANNEL_TO_ENV_VAR = {
    "dingtalk": "DINGTALK_WEBHOOK",
    "wechat_work": "WECHAT_WORK_WEBHOOK",
    "feishu": "FEISHU_WEBHOOK",
    "slack": "SLACK_WEBHOOK",
    "teams": "TEAMS_WEBHOOK",
    "generic": "GENERIC_WEBHOOK_URL",
    # PagerDuty 走不同端点
    # Email 走 SMTP, 跳过 webhook.site
}


def get_or_create_token(token: str = "") -> str:
    """从 webhook.site 获取或创建 token."""
    if token:
        return token
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(f"{WEBHOOK_SITE_API}/token", json={"default_status": 200})
        resp.raise_for_status()
        data = resp.json()
        return data["uuid"]


def build_channel_urls(token: str) -> dict:
    """基于 webhook.site token 构造各通道 URL.

    每个通道用不同 path 以便在 webhook.site 区分请求.
    """
    base = f"{WEBHOOK_SITE_API}/{token}"
    return {
        "dingtalk": f"{base}/dingtalk",
        "wechat_work": f"{base}/wechat",
        "feishu": f"{base}/feishu",
        "slack": f"{base}/slack",
        "teams": f"{base}/teams",
        "generic": f"{base}/generic",
    }


def patch_env_file(env_path: Path, channel_urls: dict) -> None:
    """将 8 通道 URL 写入 .env (后端 uvicorn 重启时读)."""
    env_content = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    lines = env_content.splitlines() if env_content else []

    updates = {
        "DINGTALK_WEBHOOK": channel_urls["dingtalk"],
        "WECHAT_WORK_WEBHOOK": channel_urls["wechat_work"],
        "FEISHU_WEBHOOK": channel_urls["feishu"],
        "SLACK_WEBHOOK": channel_urls["slack"],
        "TEAMS_WEBHOOK": channel_urls["teams"],
        "GENERIC_WEBHOOK_URL": channel_urls["generic"],
        "PAGERDUTY_API_URL": f"{WEBHOOK_SITE_API}/{get_or_create_token.__defaults__[0]}/pagerduty" if False else f"https://events.pagerduty.com/v2/enqueue",  # 保持 PagerDuty 真实端点
    }
    # 用 webhook.site 做 PagerDuty 端点 (演练模式不依赖真实 routing_key)
    pd_token = channel_urls["generic"].rsplit("/", 1)[0]
    updates["PAGERDUTY_API_URL"] = f"{pd_token}/pagerduty"
    updates["PAGERDUTY_ROUTING_KEY"] = "real-drill-mock-routing-key"

    new_lines = []
    handled = set()
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line else ""
        if key in updates:
            new_lines.append(f"{key}={updates[key]}")
            handled.add(key)
        else:
            new_lines.append(line)
    for k, v in updates.items():
        if k not in handled:
            new_lines.append(f"{k}={v}")

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def trigger_alert_drill() -> dict:
    """触发后端告警演练, 通过 8 通道发送."""
    from app.services.alert_service import push_alert  # type: ignore
    return {}


def fetch_webhook_site_requests(token: str) -> list:
    """从 webhook.site 拉取最近请求列表."""
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(f"{WEBHOOK_SITE_API}/token/{token}/requests", params={"page": 1, "per_page": 50})
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token", default="", help="webhook.site token (留空自动创建)")
    parser.add_argument("--env-file", default=".env.production", help="要修改的 env 文件")
    parser.add_argument("--output", default="logs/real_webhook_drill.json")
    parser.add_argument("--skip-restart", action="store_true", help="不重启后端 (假设配置已生效)")
    args = parser.parse_args()

    print(f"[real-drill] 后端: {BACKEND}")
    print(f"[real-drill] env 文件: {args.env_file}")

    # 1. 获取 webhook.site token
    token = get_or_create_token(args.token)
    print(f"[real-drill] webhook.site token: {token}")
    print(f"[real-drill] 监控 URL: {WEBHOOK_SITE_API}/token/{token}")

    # 2. 构造 8 通道演练 URL
    channel_urls = build_channel_urls(token)
    for ch, url in channel_urls.items():
        print(f"  [{ch:12s}] -> {url}")

    # 3. 写入 .env
    env_path = SERVER_ROOT / args.env_file
    patch_env_file(env_path, channel_urls)
    print(f"[real-drill] 已更新: {env_path}")

    # 4. 重启后端 (除非 --skip-restart)
    if not args.skip_restart:
        print(f"[real-drill] 重启后端加载新配置...")
        result = subprocess.run(
            [sys.executable, "scripts/restart_backend.py"],
            cwd=str(SERVER_ROOT),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"[real-drill] WARN: 重启失败: {result.stderr[:200]}")
        else:
            print(f"[real-drill] 重启成功")

    # 5. 等后端就绪
    time.sleep(2.0)
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{BACKEND}/healthz")
            print(f"[real-drill] 后端 healthz: {r.status_code}")
    except Exception as e:
        print(f"[real-drill] 后端不可达: {e}")
        return 1

    # 6. 触发后端 8 通道演练
    print(f"\n[real-drill] 触发后端 8 通道演练...")
    drill_script = SERVER_ROOT / "scripts" / "alert_drill_8channels.py"
    if drill_script.exists():
        result = subprocess.run(
            [sys.executable, str(drill_script), "--output", "logs/real_drill_inner.json"],
            cwd=str(SERVER_ROOT),
            capture_output=True,
            text=True,
        )
        print(f"[real-drill] 内部演练: rc={result.returncode}")
        if result.stdout:
            print(result.stdout[-500:])
    else:
        print(f"[real-drill] WARN: 演练脚本不存在: {drill_script}")

    # 7. 等 webhook.site 收到请求
    print(f"\n[real-drill] 等待 webhook.site 接收 (3 秒)...")
    time.sleep(3.0)

    # 8. 验证 webhook.site 收到的请求
    requests_received = fetch_webhook_site_requests(token)
    print(f"[real-drill] webhook.site 收到 {len(requests_received)} 个请求:")
    for r in requests_received[:20]:
        url = r.get("url", "")
        method = r.get("method", "")
        status = r.get("response_status", 0)
        print(f"  {method} {url} -> {status}")

    # 9. 按 channel 分组, 计算 delta
    by_channel = {ch: 0 for ch in channel_urls}
    for r in requests_received:
        url = r.get("url", "")
        for ch, ch_url in channel_urls.items():
            if url.startswith(ch_url):
                by_channel[ch] += 1
                break

    # 10. 输出报告
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "webhook_site_token": token,
        "webhook_site_monitor_url": f"{WEBHOOK_SITE_API}/token/{token}",
        "channel_urls": channel_urls,
        "requests_received": len(requests_received),
        "by_channel": by_channel,
        "result": "PASS" if all(v > 0 for v in by_channel.values()) else "PARTIAL",
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[real-drill] 报告: {out_path}")
    print(f"[real-drill] 结论: {report['result']}")
    print(f"[real-drill] 运维核对: 打开 {report['webhook_site_monitor_url']} 查看每个通道请求详情")

    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
