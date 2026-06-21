"""本地 8 通道 webhook receiver — 模拟真实告警通道的 HTTP 端点.

监听 8 个端口 (每个通道一个):
- 7001: dingtalk       (钉钉 webhook)
- 7002: wechat_work    (企业微信)
- 7003: feishu         (飞书)
- 7004: pagerduty      (Events API v2)
- 7005: slack          (Incoming Webhook)
- 7006: teams          (MessageCard)
- 7007: generic        (Generic HTTP)
- 7025: email SMTP mock (SMTP server)

记录所有收到的 POST 到 logs/, 打印到 stdout.

用法:
    python scripts/mock_webhook_receiver.py            # 默认监听所有 8 通道
    python scripts/mock_webhook_receiver.py --port 7001 # 只监听 1 个
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent / "logs" / "mock_webhook"
LOG_DIR.mkdir(parents=True, exist_ok=True)


CHANNEL_ENDPOINTS = {
    7001: ("dingtalk", "/dingtalk"),
    7002: ("wechat_work", "/wechat"),
    7003: ("feishu", "/feishu"),
    7004: ("pagerduty", "/pagerduty"),
    7005: ("slack", "/slack"),
    7006: ("teams", "/teams"),
    7007: ("generic", "/generic"),
}


def _log(channel: str, port: int, path: str, body: dict | str) -> None:
    """统一记录到 stdout + JSONL 文件."""
    ts = datetime.now(timezone.utc).isoformat()
    if isinstance(body, (dict, list)):
        body_str = json.dumps(body, ensure_ascii=False)
    else:
        body_str = str(body)[:500]
    line = f"[{ts}] {channel:12s} :{port}{path}  {body_str}"
    print(line, flush=True)
    log_file = LOG_DIR / f"{channel}.jsonl"
    with log_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": ts,
            "channel": channel,
            "port": port,
            "path": path,
            "body": body,
        }, ensure_ascii=False) + "\n")


class _Handler(BaseHTTPRequestHandler):
    channel_name: str = "unknown"
    port: int = 0

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""
        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            body = raw.decode("utf-8", errors="replace")
        _log(self.channel_name, self.port, self.path, body)
        # 各通道返回不同响应体, 模拟真实端点
        if self.channel_name == "dingtalk":
            resp_bytes = json.dumps({"errcode": 0, "errmsg": "ok"}).encode("utf-8")
            ctype = "application/json"
        elif self.channel_name == "wechat_work":
            resp_bytes = json.dumps({"errcode": 0, "errmsg": "ok", "type": "text"}).encode("utf-8")
            ctype = "application/json"
        elif self.channel_name == "feishu":
            # 飞书真实响应使用 StatusCode 字段, 不是 code
            resp_bytes = json.dumps({"StatusCode": 0, "StatusMessage": "success", "Extra": None, "Data": {}}).encode("utf-8")
            ctype = "application/json"
        elif self.channel_name == "pagerduty":
            resp_bytes = json.dumps({"status": "success", "message": "Event processed", "dedup_key": "drill-key"}).encode("utf-8")
            ctype = "application/json"
        elif self.channel_name == "slack":
            # Slack 真实响应是纯文本 "ok", 不是 JSON
            resp_bytes = b"ok"
            ctype = "text/plain"
        elif self.channel_name == "teams":
            # Teams 真实响应是纯文本 "1"
            resp_bytes = b"1"
            ctype = "text/plain"
        else:
            resp_bytes = json.dumps({"received": True}).encode("utf-8")
            ctype = "application/json"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(resp_bytes)))
        self.end_headers()
        self.wfile.write(resp_bytes)

    def do_GET(self):  # noqa: N802
        # health check
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(f"mock receiver: {self.channel_name}".encode())

    def log_message(self, fmt, *args):  # noqa: A003
        return  # 用 _log 代替


def _make_handler(channel: str, port: int):
    class _BoundHandler(_Handler):
        pass
    _BoundHandler.channel_name = channel
    _BoundHandler.port = port
    return _BoundHandler


def _start_one(port: int, channel: str) -> ThreadingHTTPServer:
    handler = _make_handler(channel, port)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True, name=f"mock-{channel}")
    t.start()
    print(f"[mock] {channel:12s} 监听 :{port}", flush=True)
    return httpd


class _MockSMTPServerProtocol(asyncio.Protocol):
    """极简 SMTP mock: 响应 EHLO/MAIL FROM/RCPT TO/DATA/QUIT, 不实际投递."""
    def __init__(self):
        self.transport = None
        self.buffer = b""
        self.in_data = False
        self.mail_from = None
        self.rcpt_to: list[str] = []

    def connection_made(self, transport):
        self.transport = transport
        self.transport.write(b"220 mock-smtp ready\r\n")

    def data_received(self, data: bytes):
        self.buffer += data
        # SMTP 是行协议, 一行一处理 (除了 DATA 模式)
        while True:
            if self.in_data:
                # DATA 模式: 找 \r\n.\r\n 结束
                idx = self.buffer.find(b"\r\n.\r\n")
                if idx < 0:
                    return
                payload = self.buffer[:idx].decode("utf-8", errors="replace")
                self.buffer = self.buffer[idx + 5:]
                self.in_data = False
                self._record_message(payload)
                self.transport.write(b"250 OK: queued\r\n")
                continue
            # 普通模式: 一行一命令
            idx = self.buffer.find(b"\r\n")
            if idx < 0:
                return
            line = self.buffer[:idx].decode("utf-8", errors="replace").strip()
            self.buffer = self.buffer[idx + 2:]
            if not line:
                continue
            self._handle_command(line)

    def _handle_command(self, line: str) -> None:
        cmd = line.split(" ", 1)[0].upper()
        if cmd in ("HELO", "EHLO"):
            self.transport.write(b"250-mock-smtp\r\n250 OK\r\n")
        elif cmd == "MAIL":
            self.mail_from = line
            self.transport.write(b"250 OK\r\n")
        elif cmd == "RCPT":
            self.rcpt_to.append(line)
            self.transport.write(b"250 OK\r\n")
        elif cmd == "DATA":
            self.in_data = True
            self.transport.write(b"354 Start mail input\r\n")
        elif cmd == "RSET":
            self.mail_from = None
            self.rcpt_to = []
            self.transport.write(b"250 OK\r\n")
        elif cmd in ("NOOP",):
            self.transport.write(b"250 OK\r\n")
        elif cmd == "QUIT":
            self.transport.write(b"221 Bye\r\n")
            self.transport.close()
        elif cmd == "AUTH":
            # 不做真实认证, 直接 OK (mock 环境)
            self.transport.write(b"235 OK\r\n")
        else:
            self.transport.write(b"250 OK\r\n")

    def _record_message(self, payload: str) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        line = f"[{ts}] email         :7025  from={self.mail_from} to={self.rcpt_to} body[:500]={payload[:500]}"
        print(line, flush=True)
        log_file = LOG_DIR / "email.jsonl"
        with log_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps({
                "ts": ts, "channel": "email", "port": 7025,
                "from": self.mail_from, "to": self.rcpt_to,
                "data": payload,
            }, ensure_ascii=False) + "\n")
        self.mail_from = None
        self.rcpt_to = []

    def eof_received(self):
        return False


async def _start_smtp_async(port: int = 7025) -> None:
    loop = asyncio.get_running_loop()
    server = await loop.create_server(_MockSMTPServerProtocol, "127.0.0.1", port)
    print(f"[mock] email         监听 :{port} (SMTP async)", flush=True)
    async with server:
        await server.serve_forever()


def _start_smtp(port: int = 7025) -> None:
    def _runner():
        asyncio.run(_start_smtp_async(port))
    t = threading.Thread(target=_runner, daemon=True, name="mock-smtp")
    t.start()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=0,
                        help="只启动指定端口 (0=全部 8 个)")
    parser.add_argument("--no-smtp", action="store_true",
                        help="不启动 SMTP mock")
    args = parser.parse_args()

    print(f"[mock] 日志目录: {LOG_DIR}")
    servers = []
    if args.port:
        if args.port == 7025:
            if not args.no_smtp:
                _start_smtp(args.port)
        else:
            channel, _ = CHANNEL_ENDPOINTS.get(args.port, ("custom", "/"))
            servers.append(_start_one(args.port, channel))
    else:
        for port, (channel, _path) in CHANNEL_ENDPOINTS.items():
            servers.append(_start_one(port, channel))
        if not args.no_smtp:
            _start_smtp(7025)

    print("[mock] 全部启动, Ctrl+C 退出")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[mock] 退出")
        for s in servers:
            s.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
