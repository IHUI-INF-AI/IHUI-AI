"""钉钉 webhook 本地模拟器 (Phase 8 建议 2).

在没有真实钉钉群机器人的情况下, 启动一个本地 HTTP 服务器, 接收 alertmanager 转发的
钉钉 webhook 通知, 并把消息打印到 stdout + 写入 logs/dingtalk_simulator.log.

用法:
    # 启动模拟器 (默认 127.0.0.1:9999)
    python scripts/ops/dingtalk_webhook_simulator.py

    # 然后在 alertmanager.yml 临时改 url 为 http://127.0.0.1:9999/robot/send
    # 或在 .env.production 设 ZHS_MONITOR_DINGTALK_WEBHOOK=http://127.0.0.1:9999/robot/send

    # 模拟器会显示每条推送的消息, 包括:
    #   - 触发时间
    #   - alertname
    #   - severity
    #   - summary / description
    #   - 标签 (closure=phase8 等)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

LOG_FILE = ROOT / "logs" / "dingtalk_simulator.log"

# Windows PowerShell 默认 cp936 会把 stdout 的中文打成 ?, 这里强制 utf-8
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def write_log(payload: str) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{now_iso()}] {payload}\n")


class DingTalkHandler(BaseHTTPRequestHandler):
    """模拟钉钉群机器人 webhook 接收端点."""

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {"raw": raw}

        # Alertmanager 钉钉 plugin 格式: { "msgtype": "markdown", "markdown": {...} }
        # 也支持 alertmanager webhook 透传格式: { "alerts": [...] }
        msg = self._format_message(data)

        # 写到日志 + stdout
        write_log(msg)
        print(msg, flush=True)

        # 返回 200 (钉钉机器人期望 200 才认为成功)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"errcode":0,"errmsg":"ok"}')

    def do_GET(self) -> None:
        # 健康检查
        if self.path == "/healthz":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"dingtalk-simulator-ok")
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        # 抑制默认 access log, 避免刷屏
        pass

    def _format_message(self, data: dict) -> str:
        ts = now_iso()
        # 解析 alerts
        alerts = data.get("alerts") or []
        if alerts:
            lines = [f"\n{'='*70}", f"[{ts}] 收到告警 {len(alerts)} 条", f"{'='*70}"]
            for a in alerts:
                labels = a.get("labels", {})
                annotations = a.get("annotations", {})
                status = a.get("status", "?")
                lines.append(
                    f"  [{status.upper()}] {labels.get('alertname', '?')}\n"
                    f"    severity:    {labels.get('severity', '?')}\n"
                    f"    service:     {labels.get('service', '?')}\n"
                    f"    closure:     {labels.get('closure', '-')}\n"
                    f"    table_name:  {labels.get('table_name', '-')}\n"
                    f"    summary:     {annotations.get('summary', '-')}\n"
                    f"    description: {annotations.get('description', '-')}\n"
                    f"    runbook:     {annotations.get('runbook', '-')}\n"
                )
            return "\n".join(lines)
        # 钉钉 markdown / text
        if "markdown" in data:
            return f"\n[{ts}] MARKDOWN:\n{data['markdown'].get('text', data)}"
        if "text" in data:
            return f"\n[{ts}] TEXT:\n{data['text'].get('content', data)}"
        return f"\n[{ts}] RAW:\n{json.dumps(data, ensure_ascii=False, indent=2)}"


def main() -> int:
    parser = argparse.ArgumentParser(description="钉钉 webhook 模拟器")
    parser.add_argument("--host", default="127.0.0.1", help="监听 host")
    parser.add_argument("--port", type=int, default=9999, help="监听 port")
    args = parser.parse_args()

    print(f"[init] 钉钉模拟器启动: http://{args.host}:{args.port}/robot/send")
    print(f"[init] 日志: {LOG_FILE}")
    print(f"[init] 健康检查: http://{args.host}:{args.port}/healthz")
    print("[init] 把 .env.production 的 ZHS_MONITOR_DINGTALK_WEBHOOK 改为:")
    print(f"        ZHS_MONITOR_DINGTALK_WEBHOOK=http://{args.host}:{args.port}/robot/send")
    print("[init] 按 Ctrl+C 停止")
    print(f"{'='*70}\n")

    server = ThreadingHTTPServer((args.host, args.port), DingTalkHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[stop] 收到 Ctrl+C, 停止")
        server.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
