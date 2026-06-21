#!/usr/bin/env python3
"""pgBouncer Prometheus exporter

从 pgBouncer 控制台抓取 SHOW STATS/SHOW POOLS/SHOW DATABASES 输出
转换为 Prometheus 文本格式暴露在 9127 端口
通过 prometheus.yml 抓取后由 Grafana zhs_pg_bouncer.json 展示

用法:
  python scripts/pgbouncer_exporter.py --once         # 抓取一次并输出
  python scripts/pgbouncer_exporter.py --serve 9127  # 启动 HTTP 服务
  python scripts/pgbouncer_exporter.py --check       # 健康检查
"""
import os
import sys
import json
import argparse
import socket
from pathlib import Path
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# pgBouncer 控制台连接配置
PGBOUNCER_HOST = os.environ.get("PGBOUNCER_HOST", "localhost")
PGBOUNCER_PORT = int(os.environ.get("PGBOUNCER_PORT", "6432"))
PGBOUNCER_USER = os.environ.get("PGBOUNCER_USER", "pgbouncer")
PGBOUNCER_PASSWORD = os.environ.get("PGBOUNCER_PASSWORD", "")
PGBOUNCER_DB = os.environ.get("PGBOUNCER_DB", "pgbouncer")


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def send_console_command(command: str) -> list[str]:
    """向 pgBouncer 控制台发送命令并接收响应行"""
    try:
        with socket.create_connection((PGBOUNCER_HOST, PGBOUNCER_PORT), timeout=5) as sock:
            # pgBouncer 控制台需要先发空行才能进入命令模式
            sock.sendall(b"\n")
            # 接收欢迎信息
            sock.settimeout(2)
            try:
                _ = sock.recv(4096)
            except socket.timeout:
                pass
            # 发送命令
            sock.sendall(f"{command}\n".encode("utf-8"))
            sock.settimeout(3)
            data = b""
            try:
                while True:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    data += chunk
            except socket.timeout:
                pass
            return data.decode("utf-8", errors="replace").splitlines()
    except (ConnectionRefusedError, socket.timeout, OSError) as e:
        log(f"⚠️  连接 pgBouncer 失败: {e}")
        return []


def parse_stats(lines: list[str]) -> dict:
    """解析 SHOW STATS 输出"""
    result = {
        "total_xact_count": 0,
        "total_query_count": 0,
        "total_received": 0,
        "total_sent": 0,
        "total_xact_time": 0,
        "total_query_time": 0,
        "total_wait_time": 0,
    }
    in_data = False
    for line in lines:
        if line.startswith("-"):
            in_data = True
            continue
        if not in_data:
            continue
        parts = line.split("|")
        if len(parts) < 2:
            continue
        key = parts[0].strip()
        if key == "total_xact_count":
            result["total_xact_count"] = int(parts[1].strip() or 0)
        elif key == "total_query_count":
            result["total_query_count"] = int(parts[1].strip() or 0)
        elif key == "total_received":
            result["total_received"] = int(parts[1].strip() or 0)
        elif key == "total_sent":
            result["total_sent"] = int(parts[1].strip() or 0)
        elif key == "total_xact_time":
            result["total_xact_time"] = int(parts[1].strip() or 0)
        elif key == "total_query_time":
            result["total_query_time"] = int(parts[1].strip() or 0)
        elif key == "total_wait_time":
            result["total_wait_time"] = int(parts[1].strip() or 0)
    return result


def parse_pools(lines: list[str]) -> list[dict]:
    """解析 SHOW POOLS 输出"""
    pools = []
    in_data = False
    for line in lines:
        if line.startswith("-"):
            in_data = True
            continue
        if not in_data:
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 8:
            continue
        try:
            pools.append({
                "database": parts[0],
                "user": parts[1],
                "cl_active": int(parts[2] or 0),
                "cl_waiting": int(parts[3] or 0),
                "sv_active": int(parts[4] or 0),
                "sv_idle": int(parts[5] or 0),
                "sv_used": int(parts[6] or 0),
                "pool_mode": parts[7] if len(parts) > 7 else "",
            })
        except (ValueError, IndexError):
            continue
    return pools


def parse_databases(lines: list[str]) -> list[dict]:
    """解析 SHOW DATABASES 输出"""
    dbs = []
    in_data = False
    for line in lines:
        if line.startswith("-"):
            in_data = True
            continue
        if not in_data:
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 8:
            continue
        try:
            dbs.append({
                "name": parts[0],
                "host": parts[1],
                "port": int(parts[2] or 0),
                "database": parts[3],
                "force_user": parts[4],
                "pool_size": int(parts[5] or 0),
                "reserve_pool": int(parts[6] or 0),
                "pool_mode": parts[7] if len(parts) > 7 else "",
            })
        except (ValueError, IndexError):
            continue
    return dbs


def collect_metrics() -> dict:
    """采集所有指标"""
    metrics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pgbouncer": {
            "host": PGBOUNCER_HOST,
            "port": PGBOUNCER_PORT,
        },
        "stats": parse_stats(send_console_command("SHOW STATS")),
        "pools": parse_pools(send_console_command("SHOW POOLS")),
        "databases": parse_databases(send_console_command("SHOW DATABASES")),
        "connection_ok": False,
    }
    metrics["connection_ok"] = bool(metrics["stats"] or metrics["pools"] or metrics["databases"])
    return metrics


def format_prometheus(metrics: dict) -> str:
    """转换为 Prometheus 文本格式"""
    lines = []
    lines.append("# HELP pgbouncer_up pgBouncer 连接状态")
    lines.append("# TYPE pgbouncer_up gauge")
    lines.append(f"pgbouncer_up {1 if metrics['connection_ok'] else 0}")

    stats = metrics.get("stats", {})
    for key, value in stats.items():
        lines.append(f"# HELP pgbouncer_{key} pgBouncer {key}")
        lines.append(f"# TYPE pgbouncer_{key} counter")
        lines.append(f"pgbouncer_{key} {value}")

    for pool in metrics.get("pools", []):
        db = pool["database"].replace('"', '\\"')
        user = pool["user"].replace('"', '\\"')
        for k, v in pool.items():
            if k in ("database", "user", "pool_mode"):
                continue
            lines.append(f'pgbouncer_pool_{k}{{database="{db}",user="{user}"}} {v}')

    return "\n".join(lines) + "\n"


def cmd_once(args) -> int:
    """抓取一次并输出"""
    metrics = collect_metrics()
    if args.format == "json":
        print(json.dumps(metrics, ensure_ascii=False, indent=2))
    else:
        print(format_prometheus(metrics))
    return 0 if metrics["connection_ok"] else 1


def cmd_serve(args) -> int:
    """启动 HTTP 服务"""
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/metrics":
                metrics = collect_metrics()
                body = format_prometheus(metrics).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; version=0.0.4")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/health":
                metrics = collect_metrics()
                status = 200 if metrics["connection_ok"] else 503
                self.send_response(status)
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}' if status == 200 else b'{"status":"down"}')
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):  # noqa
            pass

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    log(f"✅ pgBouncer exporter 监听 0.0.0.0:{args.port}")
    log(f"  - /metrics  Prometheus 文本格式")
    log(f"  - /health   健康检查")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("停止服务")
    return 0


def cmd_check(args) -> int:
    """健康检查"""
    metrics = collect_metrics()
    if metrics["connection_ok"]:
        log("✅ pgBouncer 连接正常")
        log(f"  - databases: {len(metrics['databases'])}")
        log(f"  - pools: {len(metrics['pools'])}")
        log(f"  - total_query_count: {metrics['stats'].get('total_query_count', 0)}")
        return 0
    log("❌ pgBouncer 连接失败")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="pgBouncer Prometheus exporter")
    sub = parser.add_subparsers(dest="command")
    once_p = sub.add_parser("once", help="抓取一次")
    once_p.add_argument("--format", choices=["prom", "json"], default="prom", help="输出格式")
    sub.add_parser("check", help="健康检查")
    serve_p = sub.add_parser("serve", help="启动 HTTP 服务")
    serve_p.add_argument("--port", type=int, default=9127, help="监听端口")
    args = parser.parse_args()

    if args.command == "serve":
        return cmd_serve(args)
    if args.command == "check":
        return cmd_check(args)
    return cmd_once(args)


if __name__ == "__main__":
    sys.exit(main())
