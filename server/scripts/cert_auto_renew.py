#!/usr/bin/env python3
"""证书自动续签 (Round 11 P1-16)

功能:
  - 证书到期检查 (剩余天数 <30 预警, <7 紧急)
  - 调用 cert-manager 自动续签
  - 多域名 SAN 证书支持
  - 续签失败告警
  - 续签历史记录
  - dry-run 模式
  - 强制续签接口

用法:
  python scripts/cert_auto_renew.py check
  python scripts/cert_auto_renew.py renew --name zhs-tls-prod
  python scripts/cert_auto_renew.py list
  python scripts/cert_auto_renew.py history
  python scripts/cert_auto_renew.py force --name zhs-tls-prod
  python scripts/cert_auto_renew.py serve --port 9500
"""
import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOGS_DIR = SERVER_DIR / "logs"
DB_PATH = LOGS_DIR / "cert_renewal.db"

DINGTALK_WEBHOOK = os.environ.get("DINGTALK_WEBHOOK", "")
KUBECTL_BIN = os.environ.get("KUBECTL_BIN", "kubectl")
CERT_MANAGER_NAMESPACE = os.environ.get("CERT_MANAGER_NAMESPACE", "cert-manager")

# 阈值
WARNING_DAYS = 30
CRITICAL_DAYS = 7


def log(msg: str) -> None:
    """输出日志"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def init_db() -> None:
    """初始化证书 DB"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS certificates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            cert_name TEXT NOT NULL,
            namespace TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            days_to_expiry INTEGER,
            old_expiry TEXT,
            new_expiry TEXT,
            detail TEXT
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_cert_name ON certificates(cert_name)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_cert_ts ON certificates(timestamp)
    """)
    conn.commit()
    conn.close()


def record_cert(
    cert_name: str,
    namespace: str,
    action: str,
    status: str,
    days_to_expiry: Optional[int] = None,
    old_expiry: Optional[str] = None,
    new_expiry: Optional[str] = None,
    detail: str = "",
) -> None:
    """记录证书操作"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO certificates
        (timestamp, cert_name, namespace, action, status, days_to_expiry, old_expiry, new_expiry, detail)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        cert_name, namespace, action, status,
        days_to_expiry, old_expiry, new_expiry, detail,
    ))
    conn.commit()
    conn.close()


def run_kubectl(args: list, timeout: int = 30) -> tuple[int, str, str]:
    """执行 kubectl"""
    cmd = [KUBECTL_BIN] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return 127, "", "kubectl 未安装"
    except subprocess.TimeoutExpired:
        return 124, "", f"命令超时 ({timeout}s)"
    except Exception as e:
        return 1, "", str(e)


def list_certificates() -> list[dict]:
    """列出所有证书"""
    rc, stdout, stderr = run_kubectl([
        "get", "certificates",
        "-A", "-o", "json",
    ])

    if rc != 0:
        log(f"⚠️ kubectl get certificates 失败: {stderr[:200]}")
        return []

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        return []

    certs = []
    now = datetime.now(timezone.utc)
    for item in data.get("items", []):
        spec = item.get("spec", {})
        status = item.get("status", {})
        meta = item.get("metadata", {})

        # 计算到期天数
        not_after = status.get("notAfter", "")
        days_to_expiry = None
        if not_after:
            try:
                expiry = datetime.fromisoformat(not_after.replace("Z", "+00:00"))
                days_to_expiry = (expiry - now).days
            except ValueError:
                pass

        if days_to_expiry is None:
            level = "unknown"
        elif days_to_expiry < 0:
            level = "expired"
        elif days_to_expiry < CRITICAL_DAYS:
            level = "critical"
        elif days_to_expiry < WARNING_DAYS:
            level = "warning"
        else:
            level = "ok"

        certs.append({
            "name": meta.get("name"),
            "namespace": meta.get("namespace"),
            "secret_name": spec.get("secretName"),
            "issuer": spec.get("issuerRef", {}).get("name"),
            "dns_names": spec.get("dnsNames", []),
            "not_after": not_after,
            "days_to_expiry": days_to_expiry,
            "renewal_time": status.get("renewalTime"),
            "alert_level": level,
            "status": status.get("conditions", [{}])[-1].get("type", "Unknown") if status.get("conditions") else "Unknown",
        })

    return certs


def check_certificates() -> dict:
    """检查所有证书"""
    certs = list_certificates()

    alerts = []
    for c in certs:
        if c["alert_level"] in ("warning", "critical", "expired"):
            alerts.append(c)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_certificates": len(certs),
        "alert_count": len(alerts),
        "alerts": alerts,
        "all_certificates": certs,
    }


def renew_certificate(cert_name: str, namespace: str, force: bool = False, dry_run: bool = False) -> dict:
    """续签单个证书"""
    log(f"[renew] {namespace}/{cert_name} - force={force}, dry_run={dry_run}")

    if dry_run:
        record_cert(cert_name, namespace, "renew", "dry_run", None, None, None, "dry_run")
        return {"status": "dry_run", "cert_name": cert_name, "namespace": namespace}

    # 获取当前过期时间
    rc, stdout, stderr = run_kubectl([
        "get", "certificate", cert_name,
        "-n", namespace, "-o", "jsonpath={.status.notAfter}",
    ])
    old_expiry = stdout.strip() if rc == 0 else None

    # 强制续签: 添加 cert-manager.io/force-renewal annotation
    if force:
        current_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        rc, stdout, stderr = run_kubectl([
            "annotate", "certificate", cert_name,
            "-n", namespace,
            f"cert-manager.io/force-renewal={current_ts}",
            "--overwrite",
        ])
        if rc != 0:
            record_cert(cert_name, namespace, "force_renew", "failed", None, old_expiry, None, stderr[:500])
            send_dingtalk_alert(cert_name, namespace, "renew_failed", stderr[:500])
            return {"status": "error", "detail": stderr[:500]}
        log(f"  ✅ 已添加 force-renewal annotation")

    # 等待最多 120 秒让 cert-manager 处理
    log(f"  等待 cert-manager 处理...")
    start = time.time()
    new_expiry = None
    while time.time() - start < 120:
        time.sleep(10)
        rc, stdout, _ = run_kubectl([
            "get", "certificate", cert_name,
            "-n", namespace, "-o", "jsonpath={.status.notAfter}",
        ])
        if rc == 0 and stdout.strip() and stdout.strip() != old_expiry:
            new_expiry = stdout.strip()
            break

    if new_expiry:
        try:
            expiry = datetime.fromisoformat(new_expiry.replace("Z", "+00:00"))
            days = (expiry - datetime.now(timezone.utc)).days
        except ValueError:
            days = None
        record_cert(cert_name, namespace, "renew", "success", days, old_expiry, new_expiry)
        log(f"  ✅ 续签成功: 新到期 {new_expiry} (剩余 {days} 天)")
        return {
            "status": "success",
            "cert_name": cert_name,
            "namespace": namespace,
            "old_expiry": old_expiry,
            "new_expiry": new_expiry,
            "days_to_expiry": days,
        }

    record_cert(cert_name, namespace, "renew", "failed", None, old_expiry, None, "续签超时")
    send_dingtalk_alert(cert_name, namespace, "renew_timeout", "续签超时 120s")
    return {"status": "failed", "cert_name": cert_name, "namespace": namespace, "detail": "续签超时"}


def auto_renew_all() -> dict:
    """自动续签所有需要续签的证书"""
    certs = list_certificates()
    results = []

    for c in certs:
        if c["alert_level"] in ("warning", "critical", "expired"):
            result = renew_certificate(c["name"], c["namespace"])
            results.append(result)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checked": len(certs),
        "renewed": len(results),
        "results": results,
    }


def get_history(limit: int = 20) -> dict:
    """续签历史"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM certificates ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return {
        "limit": limit,
        "count": len(rows),
        "records": rows,
    }


def send_dingtalk_alert(cert_name: str, namespace: str, event: str, message: str) -> None:
    """发送钉钉告警"""
    if not DINGTALK_WEBHOOK:
        return
    try:
        text = f"❌ 证书续签失败\n证书: {namespace}/{cert_name}\n事件: {event}\n详情: {message}"
        payload = json.dumps({"msgtype": "text", "text": {"content": text}}).encode("utf-8")
        req = urllib.request.Request(DINGTALK_WEBHOOK, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            log(f"钉钉通知已发送 (status={resp.status})")
    except Exception as e:
        log(f"⚠️ 钉钉通知失败: {e}")


def cmd_check(args) -> int:
    """检查所有证书"""
    result = check_certificates()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["alert_count"] > 0 else 0


def cmd_renew(args) -> int:
    """续签证书"""
    result = renew_certificate(args.name, args.namespace, force=args.force, dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") in ("success", "dry_run") else 1


def cmd_list(args) -> int:
    """列出所有证书"""
    certs = list_certificates()
    print(json.dumps({
        "total": len(certs),
        "certificates": certs,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_auto_renew(args) -> int:
    """自动续签"""
    result = auto_renew_all()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_history(args) -> int:
    """续签历史"""
    result = get_history(limit=args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_serve(args) -> int:
    """HTTP 服务"""
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/healthz":
                self._json(200, {"status": "ok", "service": "cert-auto-renew"})
            elif self.path == "/check":
                self._json(200, check_certificates())
            elif self.path == "/list":
                self._json(200, {"certificates": list_certificates()})
            elif self.path == "/history":
                self._json(200, get_history())
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self):
            if self.path == "/auto-renew":
                self._json(200, auto_renew_all())
            elif self.path.startswith("/renew/"):
                parts = self.path.split("/")
                if len(parts) >= 4:
                    namespace, name = parts[2], parts[3]
                    self._json(200, renew_certificate(name, namespace, force=True))
                else:
                    self._json(400, {"error": "参数不足"})
            else:
                self._json(404, {"error": "not found"})

        def _json(self, code: int, data):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    log(f"cert-auto-renew HTTP 服务已启动: 0.0.0.0:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="证书自动续签")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("check", help="检查所有证书")
    sub.add_parser("list", help="列出所有证书")
    sub.add_parser("auto-renew", help="自动续签所有到期证书")

    rn_p = sub.add_parser("renew", help="续签指定证书")
    rn_p.add_argument("--name", required=True)
    rn_p.add_argument("--namespace", required=True)
    rn_p.add_argument("--force", action="store_true")
    rn_p.add_argument("--dry-run", action="store_true")

    hist_p = sub.add_parser("history", help="续签历史")
    hist_p.add_argument("--limit", type=int, default=20)

    sv_p = sub.add_parser("serve", help="HTTP 服务")
    sv_p.add_argument("--port", type=int, default=9500)

    args = parser.parse_args()

    if args.command == "check":
        return cmd_check(args)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "renew":
        return cmd_renew(args)
    if args.command == "auto-renew":
        return cmd_auto_renew(args)
    if args.command == "history":
        return cmd_history(args)
    if args.command == "serve":
        return cmd_serve(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
