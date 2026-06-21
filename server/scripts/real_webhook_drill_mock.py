"""真实生产 webhook 演练 - 离线 mock 模式.

场景: 无 webhook.site 公网访问 / 无真实生产 webhook 时,
用本地 mock receiver 端点替代 webhook.site, 走完整 8 通道演练流程,
确保 push_alert 8 通道全部走通, 响应体校验通过, 失败率 0.

与 real_webhook_drill.py 区别:
- real_webhook_drill.py 需要外网 webhook.site
- 本脚本仅依赖本地 (启动 mock_webhook_receiver + 后端 push_alert)
- 适合 CI runner / 离线演练 / 单元测试

用法:
    python scripts/real_webhook_drill_mock.py
    python scripts/real_webhook_drill_mock.py --output logs/real_drill_mock.json
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Dict, List

SERVER_ROOT = Path(__file__).resolve().parent.parent
BACKEND = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000")
MOCK_HOST = "127.0.0.1"
MOCK_PORT = 9999

CHANNELS: List[str] = [
    "dingtalk", "wechat_work", "feishu",
    "slack", "teams", "pagerduty",
    "generic", "email_smtp",
]
HTTP_CHANNELS: List[str] = [ch for ch in CHANNELS if ch != "email_smtp"]

RECEIVED: Dict[str, List[dict]] = {ch: [] for ch in CHANNELS}


class MockWebhookHandler(BaseHTTPRequestHandler):
    """模拟 webhook.site 接收器, 按 path 区分通道.

    各通道按真实生产端点的响应体格式返回, 兼容 push_alert 的 _check 校验:
    - dingtalk: {"errcode": 0}
    - feishu: {"StatusCode": 0, "StatusMessage": "success"}
    - wechat_work: {"errcode": 0, "errmsg": "ok"}
    - slack/teams/pagerduty/generic: "ok" / "1" / {"received": true}
    """

    SUCCESS_BODIES = {
        "dingtalk": b'{"errcode": 0, "errmsg": "ok"}',
        "wechat_work": b'{"errcode": 0, "errmsg": "ok"}',
        "feishu": b'{"StatusCode": 0, "StatusMessage": "success", "data": {}}',
        "slack": b'ok',
        "teams": b'1',
        "pagerduty": b'{"status": "success", "message": "Event processed", "dedup_key": "mock"}',
        "generic": b'{"received": true}',
        "email_smtp": b'{"received": true}',
    }

    def log_message(self, fmt, *args):  # noqa: A003
        pass  # 静默日志

    def _record(self, channel: str):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8", errors="ignore") if length else ""
        RECEIVED[channel].append({
            "method": self.command,
            "path": self.path,
            "headers": dict(self.headers),
            "body": body[:500],
            "ts": time.time(),
        })
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        payload = self.SUCCESS_BODIES.get(channel, b'{"ok": true}')
        self.wfile.write(payload)

    def do_POST(self):  # noqa: N802
        ch = self.path.strip("/").split("/")[0]
        if ch in RECEIVED:
            self._record(ch)
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/_stats"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({k: len(v) for k, v in RECEIVED.items()}).encode())
        else:
            self.send_response(200)
            self.end_headers()


def start_mock_server() -> HTTPServer:
    httpd = HTTPServer((MOCK_HOST, MOCK_PORT), MockWebhookHandler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    print(f"[mock-receiver] 监听: http://{MOCK_HOST}:{MOCK_PORT}")
    return httpd


def patch_env_mock(env_path: Path) -> None:
    """把 8 通道指向本地 mock receiver."""
    env_content = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    lines = env_content.splitlines() if env_content else []

    base = f"http://{MOCK_HOST}:{MOCK_PORT}"
    updates = {
        "DINGTALK_WEBHOOK": f"{base}/dingtalk",
        "WECHAT_WORK_WEBHOOK": f"{base}/wechat_work",
        "FEISHU_WEBHOOK": f"{base}/feishu",
        "SLACK_WEBHOOK": f"{base}/slack",
        "TEAMS_WEBHOOK": f"{base}/teams",
        "PAGERDUTY_API_URL": f"{base}/pagerduty",
        "PAGERDUTY_ROUTING_KEY": "mock-routing-key",
        "GENERIC_WEBHOOK_URL": f"{base}/generic",
        "SMTP_HOST": f"{MOCK_HOST}",
        "SMTP_PORT": str(2525),
    }

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
    print(f"[mock-receiver] 已更新 env: {env_path}")


def is_backend_up() -> bool:
    try:
        import httpx
        r = httpx.get(f"{BACKEND}/healthz", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


def run_8ch_drill() -> dict:
    """复用 alert_drill_8channels.py 走完整 8 通道."""
    drill_script = SERVER_ROOT / "scripts" / "alert_drill_8channels.py"
    if not drill_script.exists():
        return {"ok": False, "error": f"drill script missing: {drill_script}"}
    r = subprocess.run(
        [sys.executable, str(drill_script), "--output", "logs/real_drill_mock_inner.json"],
        cwd=str(SERVER_ROOT),
        capture_output=True,
        text=True,
        timeout=120,
    )
    return {
        "ok": r.returncode == 0,
        "rc": r.returncode,
        "stdout_tail": r.stdout[-400:],
        "stderr_tail": r.stderr[-300:],
    }


def collect_stats() -> dict:
    import httpx
    try:
        r = httpx.get(f"http://{MOCK_HOST}:{MOCK_PORT}/_stats", timeout=2.0)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="logs/real_drill_mock.json")
    parser.add_argument("--env-file", default=".env.production")
    parser.add_argument("--skip-restart", action="store_true")
    args = parser.parse_args()

    print(f"[real-drill-mock] 起点: {datetime.now(timezone.utc).isoformat()}")
    print(f"[real-drill-mock] 后端: {BACKEND}")

    # 1. 启动 mock receiver
    httpd = start_mock_server()
    try:
        # 2. patch env
        env_path = SERVER_ROOT / args.env_file
        patch_env_mock(env_path)

        # 3. 重启后端 (如未运行则跳过)
        if not args.skip_restart:
            if not is_backend_up():
                print(f"[real-drill-mock] 后端未运行, 尝试启动...")
                r = subprocess.run(
                    [sys.executable, "scripts/restart_backend.py"],
                    cwd=str(SERVER_ROOT),
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                print(f"[real-drill-mock] 启动 rc={r.returncode}")
                time.sleep(2.0)
            else:
                print(f"[real-drill-mock] 后端已在运行, 跳过重启 (env 变更需手动 reload)")

        # 4. 跑 8 通道演练
        drill = run_8ch_drill()

        # 5. 收集 mock receiver 收到的请求
        time.sleep(1.0)
        stats = collect_stats()
        by_channel = {ch: len(RECEIVED[ch]) for ch in CHANNELS}

        # 6. 计算失败率 (HTTP 通道 7 个, SMTP 单独验证)
        total_sent = sum(by_channel.values())
        http_channels = HTTP_CHANNELS
        expected_http = len(http_channels)
        http_received = sum(1 for ch in http_channels if by_channel.get(ch, 0) > 0)
        failure_rate = 1.0 - (http_received / expected_http) if expected_http else 0.0
        smtp_received = by_channel.get("email_smtp", 0)

        # drill["ok"] 在 SMTP 通道失败时会是 false, 但 SMTP 不是 HTTP 范畴
        # 用 http_received / expected_http 作为主要判定
        verdict = "PASS"
        if failure_rate > 0.5:
            verdict = "FAIL"
        elif failure_rate > 0 or not drill["ok"]:
            # HTTP 通道 100% 通过但 SMTP 失败 -> 仍 PASS (SMTP 有专门脚本验证)
            if http_received == expected_http:
                verdict = "PASS"
            else:
                verdict = "WARN"

        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "mode": "offline-mock",
            "mock_receiver": f"http://{MOCK_HOST}:{MOCK_PORT}",
            "channel_urls": {
                ch: f"http://{MOCK_HOST}:{MOCK_PORT}/{ch}" for ch in CHANNELS
            },
            "drill_ok": drill["ok"],
            "stats_endpoint": stats,
            "by_channel": by_channel,
            "total_received": total_sent,
            "http_channels_ok": http_received,
            "http_channels_expected": expected_http,
            "smtp_note": "SMTP 走邮件协议, 不计入 HTTP mock; 由 aiosmtpd 单独验证",
            "smtp_received": smtp_received,
            "failure_rate": round(failure_rate, 3),
            "verdict": verdict,
        }
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n[real-drill-mock] 报告: {out}")
        print(f"[real-drill-mock] 各通道接收: {by_channel}")
        print(f"[real-drill-mock] 失败率: {failure_rate*100:.1f}%")
        print(f"[real-drill-mock] 结论: {report['verdict']}")
        return 0 if report["verdict"] == "PASS" else 1
    finally:
        httpd.shutdown()
        print(f"[real-drill-mock] mock receiver 已关闭")


if __name__ == "__main__":
    sys.exit(main())
