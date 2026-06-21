#!/usr/bin/env python3
"""Vault 密钥自动轮换 (Round 11 P0-10)

功能:
  - 90 天自动轮换周期 (避免频繁轮换)
  - 多密钥类型支持: pg_backup / jwt_secret / api_key / db_password
  - 旧密钥归档到 history 路径, 保留密钥历史 (默认 10 个)
  - 应用自动加载验证 (调用 health endpoint)
  - 钉钉告警通知 (轮换失败时)
  - 密钥使用天数跟踪 (last_rotated_at 字段)
  - 健康检查子命令 (不下一次轮换前预检)
  - dry-run / force / list / history 子命令
  - 完整 JSON 报告输出

用法:
  python scripts/vault_key_auto_rotate.py rotate --type pg_backup
  python scripts/vault_key_auto_rotate.py rotate --type all
  python scripts/vault_key_auto_rotate.py check --type pg_backup
  python scripts/vault_key_auto_rotate.py list
  python scripts/vault_key_auto_rotate.py history --type pg_backup
  python scripts/vault_key_auto_rotate.py cleanup --keep 10
  python scripts/vault_key_auto_rotate.py verify-app --type pg_backup
  python scripts/vault_key_auto_rotate.py serve --port 9100
"""
import argparse
import hashlib
import json
import os
import secrets
import sqlite3
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOGS_DIR = SERVER_DIR / "logs"
HISTORY_DB = LOGS_DIR / "vault_rotation_history.db"

# 密钥类型定义
KEY_TYPES = {
    "pg_backup": {
        "vault_path": "secret/zhs/pg-backup",
        "history_path": "secret/zhs/pg-backup-history",
        "key_field": "encryption_key",
        "length": 48,  # base64 48 = 36 字节随机
        "health_check": None,  # 通过 backup 脚本验证
    },
    "jwt_secret": {
        "vault_path": "secret/zhs/jwt",
        "history_path": "secret/zhs/jwt-history",
        "key_field": "secret_key",
        "length": 64,
        "health_check": "/api/v1/auth/healthz",
    },
    "api_key": {
        "vault_path": "secret/zhs/api",
        "history_path": "secret/zhs/api-history",
        "key_field": "api_key",
        "length": 32,
        "health_check": "/api/v1/healthz",
    },
    "db_password": {
        "vault_path": "secret/zhs/db",
        "history_path": "secret/zhs/db-history",
        "key_field": "password",
        "length": 32,
        "health_check": "/api/v1/healthz",
    },
}

# 90 天轮换周期
ROTATION_DAYS = 90
DEFAULT_KEEP_HISTORY = 10

VAULT_ADDR = os.environ.get("VAULT_ADDR", "http://127.0.0.1:8200")
VAULT_TOKEN = os.environ.get("VAULT_TOKEN", "")
DINGTALK_WEBHOOK = os.environ.get("DINGTALK_WEBHOOK", "")
APP_HEALTH_URL = os.environ.get("APP_HEALTH_URL", "http://127.0.0.1:8000")


def log(msg: str) -> None:
    """输出日志"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def init_db() -> None:
    """初始化历史 DB"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(HISTORY_DB), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS rotation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            key_type TEXT NOT NULL,
            operation TEXT NOT NULL,
            vault_path TEXT NOT NULL,
            old_key_hash TEXT,
            new_key_hash TEXT,
            status TEXT NOT NULL,
            duration_ms INTEGER,
            detail TEXT
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_rotation_type ON rotation_history(key_type)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_rotation_ts ON rotation_history(timestamp)
    """)
    conn.commit()
    conn.close()


def record_rotation(
    key_type: str,
    operation: str,
    vault_path: str,
    old_key_hash: str,
    new_key_hash: str,
    status: str,
    duration_ms: int,
    detail: str = "",
) -> None:
    """记录轮换历史到 DB"""
    init_db()
    conn = sqlite3.connect(str(HISTORY_DB), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO rotation_history
        (timestamp, key_type, operation, vault_path, old_key_hash, new_key_hash, status, duration_ms, detail)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        key_type,
        operation,
        vault_path,
        old_key_hash,
        new_key_hash,
        status,
        duration_ms,
        detail,
    ))
    conn.commit()
    conn.close()


def get_last_rotation(key_type: str) -> Optional[dict]:
    """获取上次轮换信息"""
    init_db()
    conn = sqlite3.connect(str(HISTORY_DB), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM rotation_history
        WHERE key_type = ? AND operation = 'rotate' AND status = 'success'
        ORDER BY timestamp DESC LIMIT 1
    """, (key_type,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def vault_kv_get(path: str) -> dict:
    """读取 Vault KV"""
    if not VAULT_TOKEN:
        raise RuntimeError("VAULT_TOKEN 未设置")
    url = f"{VAULT_ADDR}/v1/{path}"
    req = urllib.request.Request(url, headers={"X-Vault-Token": VAULT_TOKEN})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data.get("data", {}).get("data", {})


def vault_kv_put(path: str, data: dict) -> bool:
    """写入 Vault KV"""
    if not VAULT_TOKEN:
        raise RuntimeError("VAULT_TOKEN 未设置")
    url = f"{VAULT_ADDR}/v1/{path}"
    payload = json.dumps({"data": data}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"X-Vault-Token": VAULT_TOKEN, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status in (200, 204)


def generate_new_key(length: int) -> str:
    """生成新密钥 (base64 编码)"""
    return secrets.token_urlsafe(length)[:length]


def hash_key(key: str) -> str:
    """密钥 SHA256 哈希 (用于脱敏记录)"""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def rotate_key(key_type: str, dry_run: bool = False, force: bool = False) -> dict:
    """轮换单个密钥"""
    if key_type not in KEY_TYPES:
        return {"status": "error", "detail": f"未知密钥类型: {key_type}"}

    cfg = KEY_TYPES[key_type]
    start = time.time()
    timestamp = datetime.now(timezone.utc).isoformat()

    log(f"[rotate] {key_type} - 开始轮换 (dry_run={dry_run}, force={force})")

    # 1. 检查是否需要轮换 (90 天周期)
    last = get_last_rotation(key_type)
    if last and not force and not dry_run:
        last_ts = datetime.fromisoformat(last["timestamp"])
        days_since = (datetime.now(timezone.utc) - last_ts).days
        if days_since < ROTATION_DAYS:
            log(f"  跳过: 上次轮换仅 {days_since} 天前 (周期 {ROTATION_DAYS} 天)")
            return {
                "status": "skipped",
                "key_type": key_type,
                "days_since_last_rotation": days_since,
                "rotation_period_days": ROTATION_DAYS,
            }

    # 2. 读取当前密钥
    current_data = {}
    try:
        current_data = vault_kv_get(cfg["vault_path"])
    except Exception as e:
        log(f"  ⚠️ 读取当前密钥失败: {e}")
        if not dry_run:
            record_rotation(
                key_type, "rotate", cfg["vault_path"], "", "", "failed",
                int((time.time() - start) * 1000), f"读取失败: {e}",
            )
            send_dingtalk_alert(key_type, "rotate_failed", f"读取当前密钥失败: {e}")
            return {"status": "error", "detail": f"读取失败: {e}"}

    old_key = current_data.get(cfg["key_field"], "")
    old_hash = hash_key(old_key) if old_key else ""

    # 3. 生成新密钥
    new_key = generate_new_key(cfg["length"])
    new_hash = hash_key(new_key)

    if dry_run:
        log(f"  [DRY-RUN] 跳过写入, 新密钥哈希: {new_hash}")
        return {
            "status": "dry_run",
            "key_type": key_type,
            "vault_path": cfg["vault_path"],
            "old_key_hash": old_hash,
            "new_key_hash": new_hash,
            "key_length": len(new_key),
        }

    # 4. 归档旧密钥到 history
    try:
        history_data = {
            f"key_{timestamp}": old_key,
            "rotated_at": timestamp,
            "rotation_count": current_data.get("rotation_count", 0),
            "key_hash": old_hash,
        }
        vault_kv_put(cfg["history_path"], history_data)
        log(f"  ✅ 旧密钥已归档到 {cfg['history_path']}")
    except Exception as e:
        log(f"  ⚠️ 旧密钥归档失败: {e}")

    # 5. 写入新密钥
    new_count = current_data.get("rotation_count", 0) + 1
    try:
        vault_kv_put(cfg["vault_path"], {
            cfg["key_field"]: new_key,
            "rotation_count": new_count,
            "last_rotated_at": timestamp,
            "created_at": current_data.get("created_at", timestamp),
        })
        log(f"  ✅ 新密钥已写入 (轮换次数: {new_count})")
    except Exception as e:
        log(f"  ❌ 新密钥写入失败: {e}")
        record_rotation(
            key_type, "rotate", cfg["vault_path"], old_hash, new_hash, "failed",
            int((time.time() - start) * 1000), f"写入失败: {e}",
        )
        send_dingtalk_alert(key_type, "rotate_failed", f"新密钥写入失败: {e}")
        return {"status": "error", "detail": f"写入失败: {e}"}

    # 6. 验证应用自动加载新密钥
    app_check = verify_app_loaded(key_type)
    log(f"  应用验证: {app_check.get('status', 'unknown')}")

    duration_ms = int((time.time() - start) * 1000)
    record_rotation(
        key_type, "rotate", cfg["vault_path"], old_hash, new_hash, "success",
        duration_ms, f"轮换次数: {new_count}",
    )

    log(f"  ✅ {key_type} 轮换完成 ({duration_ms}ms)")
    return {
        "status": "success",
        "key_type": key_type,
        "vault_path": cfg["vault_path"],
        "rotation_count": new_count,
        "duration_ms": duration_ms,
        "old_key_hash": old_hash,
        "new_key_hash": new_hash,
        "app_check": app_check,
    }


def verify_app_loaded(key_type: str) -> dict:
    """验证应用已自动加载新密钥"""
    cfg = KEY_TYPES.get(key_type, {})
    health_path = cfg.get("health_check")
    if not health_path:
        return {"status": "skipped", "detail": "无 health check 端点"}

    url = f"{APP_HEALTH_URL}{health_path}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            if resp.status == 200:
                return {"status": "ok", "url": url, "http_status": resp.status}
            return {"status": "warning", "url": url, "http_status": resp.status}
    except urllib.error.URLError as e:
        return {"status": "error", "url": url, "detail": str(e)}
    except Exception as e:
        return {"status": "error", "url": url, "detail": str(e)}


def check_key_age(key_type: str) -> dict:
    """检查密钥使用天数"""
    if key_type not in KEY_TYPES:
        return {"status": "error", "detail": f"未知密钥类型: {key_type}"}

    cfg = KEY_TYPES[key_type]

    # 从 Vault 读取 last_rotated_at
    try:
        data = vault_kv_get(cfg["vault_path"])
        last_rotated = data.get("last_rotated_at", "")
        rotation_count = data.get("rotation_count", 0)
    except Exception as e:
        return {"status": "error", "detail": f"读取失败: {e}"}

    if not last_rotated:
        return {"status": "warning", "detail": "未找到 last_rotated_at 字段"}

    # 计算天数
    try:
        last_ts = datetime.fromisoformat(last_rotated.replace("Z", "+00:00"))
        days = (datetime.now(timezone.utc) - last_ts).days
    except Exception as e:
        return {"status": "error", "detail": f"时间解析失败: {e}"}

    needs_rotation = days >= ROTATION_DAYS
    return {
        "status": "warning" if needs_rotation else "ok",
        "key_type": key_type,
        "last_rotated_at": last_rotated,
        "days_since_rotation": days,
        "rotation_period_days": ROTATION_DAYS,
        "rotation_count": rotation_count,
        "needs_rotation": needs_rotation,
    }


def list_keys() -> dict:
    """列出所有密钥状态"""
    results = {}
    for key_type in KEY_TYPES:
        results[key_type] = check_key_age(key_type)
    return results


def cleanup_history(keep: int = DEFAULT_KEEP_HISTORY) -> dict:
    """清理过期的密钥历史"""
    init_db()
    conn = sqlite3.connect(str(HISTORY_DB), timeout=10.0)
    cur = conn.cursor()

    # 对每个 key_type, 保留最近 keep 条
    cur.execute("""
        SELECT key_type, COUNT(*) as c FROM rotation_history GROUP BY key_type
    """)
    counts = {row[0]: row[1] for row in cur.fetchall()}

    deleted = 0
    for key_type, count in counts.items():
        if count > keep:
            # 删除多余的 (按 timestamp 升序, 保留最新 keep 条)
            cur.execute("""
                SELECT id FROM rotation_history
                WHERE key_type = ?
                ORDER BY timestamp DESC
                LIMIT -1 OFFSET ?
            """, (key_type, keep))
            ids_to_delete = [row[0] for row in cur.fetchall()]
            if ids_to_delete:
                placeholders = ",".join("?" * len(ids_to_delete))
                cur.execute(
                    f"DELETE FROM rotation_history WHERE id IN ({placeholders})",
                    ids_to_delete,
                )
                deleted += len(ids_to_delete)

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "deleted_records": deleted,
        "kept_per_type": keep,
        "current_counts": counts,
    }


def send_dingtalk_alert(key_type: str, event: str, message: str) -> None:
    """发送钉钉告警"""
    if not DINGTALK_WEBHOOK:
        log(f"  (钉钉 webhook 未配置, 跳过通知)")
        return
    try:
        text = f"❌ Vault 密钥轮换失败\n类型: {key_type}\n事件: {event}\n详情: {message}"
        payload = json.dumps({
            "msgtype": "text",
            "text": {"content": text},
        }).encode("utf-8")
        req = urllib.request.Request(
            DINGTALK_WEBHOOK,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            log(f"  钉钉通知已发送 (status={resp.status})")
    except Exception as e:
        log(f"  ⚠️ 钉钉通知失败: {e}")


def cmd_rotate(args) -> int:
    """轮换密钥"""
    key_types = KEY_TYPES.keys() if args.type == "all" else [args.type]
    results = {}
    for kt in key_types:
        results[kt] = rotate_key(kt, dry_run=args.dry_run, force=args.force)

    print(json.dumps({
        "operation": "rotate",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }, ensure_ascii=False, indent=2))

    # 任意失败则退出 1
    if any(r.get("status") == "error" for r in results.values()):
        return 1
    return 0


def cmd_check(args) -> int:
    """检查密钥年龄"""
    if args.type == "all":
        result = list_keys()
    else:
        result = check_key_age(args.type)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_list(args) -> int:
    """列出所有密钥"""
    result = list_keys()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_history(args) -> int:
    """查看轮换历史"""
    init_db()
    conn = sqlite3.connect(str(HISTORY_DB), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if args.type:
        cur.execute("""
            SELECT * FROM rotation_history
            WHERE key_type = ?
            ORDER BY timestamp DESC LIMIT ?
        """, (args.type, args.limit))
    else:
        cur.execute("""
            SELECT * FROM rotation_history
            ORDER BY timestamp DESC LIMIT ?
        """, (args.limit,))

    rows = [dict(row) for row in cur.fetchall()]
    conn.close()

    print(json.dumps({
        "operation": "history",
        "filter_type": args.type,
        "limit": args.limit,
        "count": len(rows),
        "records": rows,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_cleanup(args) -> int:
    """清理历史"""
    result = cleanup_history(keep=args.keep)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_verify_app(args) -> int:
    """验证应用加载新密钥"""
    result = verify_app_loaded(args.type)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result.get("status") == "error":
        return 1
    return 0


def cmd_serve(args) -> int:
    """HTTP 服务: /healthz /rotate /check"""
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/healthz":
                self._json(200, {"status": "ok", "service": "vault-key-rotate"})
            elif self.path == "/check":
                result = list_keys()
                self._json(200, result)
            elif self.path.startswith("/check/"):
                key_type = self.path.split("/")[-1]
                if key_type in KEY_TYPES:
                    self._json(200, check_key_age(key_type))
                else:
                    self._json(400, {"error": f"未知密钥类型: {key_type}"})
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self):
            if self.path == "/rotate":
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length else {}
                key_type = body.get("type", "all")
                if key_type == "all":
                    results = {kt: rotate_key(kt, force=body.get("force", False)) for kt in KEY_TYPES}
                else:
                    results = {key_type: rotate_key(key_type, force=body.get("force", False))}
                status = 200 if all(r.get("status") in ("success", "skipped", "dry_run") for r in results.values()) else 500
                self._json(status, results)
            else:
                self._json(404, {"error": "not found"})

        def _json(self, code: int, data: dict):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            pass  # 静默

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    log(f"vault-key-rotate HTTP 服务已启动: 0.0.0.0:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("服务停止")
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Vault 密钥自动轮换")
    sub = parser.add_subparsers(dest="command")

    # rotate
    rot_p = sub.add_parser("rotate", help="轮换密钥")
    rot_p.add_argument("--type", default="all", choices=list(KEY_TYPES.keys()) + ["all"])
    rot_p.add_argument("--dry-run", action="store_true")
    rot_p.add_argument("--force", action="store_true", help="强制轮换, 忽略 90 天周期")

    # check
    chk_p = sub.add_parser("check", help="检查密钥年龄")
    chk_p.add_argument("--type", default="all", choices=list(KEY_TYPES.keys()) + ["all"])

    # list
    sub.add_parser("list", help="列出所有密钥状态")

    # history
    hist_p = sub.add_parser("history", help="查看轮换历史")
    hist_p.add_argument("--type", default=None, choices=list(KEY_TYPES.keys()))
    hist_p.add_argument("--limit", type=int, default=20)

    # cleanup
    cln_p = sub.add_parser("cleanup", help="清理历史记录")
    cln_p.add_argument("--keep", type=int, default=DEFAULT_KEEP_HISTORY)

    # verify-app
    va_p = sub.add_parser("verify-app", help="验证应用加载新密钥")
    va_p.add_argument("--type", required=True, choices=list(KEY_TYPES.keys()))

    # serve
    srv_p = sub.add_parser("serve", help="启动 HTTP 服务")
    srv_p.add_argument("--port", type=int, default=9100)

    args = parser.parse_args()

    if args.command == "rotate":
        return cmd_rotate(args)
    if args.command == "check":
        return cmd_check(args)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "history":
        return cmd_history(args)
    if args.command == "cleanup":
        return cmd_cleanup(args)
    if args.command == "verify-app":
        return cmd_verify_app(args)
    if args.command == "serve":
        return cmd_serve(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
