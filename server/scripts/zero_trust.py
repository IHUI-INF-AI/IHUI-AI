#!/usr/bin/env python3
"""
P0-45 零信任安全
mTLS + SPIFFE/SPIRE + 持续验证
"""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "zero_trust.db")
HTTP_PORT = 10250

TRUST_LEVELS = ["untrusted", "low", "medium", "high", "critical"]
SPIFFE_ID_TYPES = ["spiffe://", "spire-agent", "workload", "service"]
ACCESS_DECISIONS = ["allow", "deny", "challenge", "step_up"]
VERIFICATION_TYPES = ["identity", "device", "location", "behavior", "risk_score"]
POLICY_EFFECTS = ["allow", "deny"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS identities (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            spiffe_id TEXT NOT NULL UNIQUE,
            workload_type TEXT,
            trust_level TEXT DEFAULT 'medium',
            public_key_fingerprint TEXT,
            ttl_seconds INTEGER DEFAULT 3600,
            expires_at TEXT,
            revoked INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS policies (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            policy_name TEXT NOT NULL UNIQUE,
            spiffe_pattern TEXT NOT NULL,
            resource TEXT NOT NULL,
            action TEXT NOT NULL,
            effect TEXT NOT NULL,
            conditions TEXT
        );
        CREATE TABLE IF NOT EXISTS access_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            spiffe_id TEXT NOT NULL,
            resource TEXT NOT NULL,
            action TEXT,
            decision TEXT NOT NULL,
            trust_level TEXT,
            risk_score REAL,
            verification_types TEXT,
            source_ip TEXT
        );
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            device_id TEXT NOT NULL UNIQUE,
            device_type TEXT,
            fingerprint TEXT,
            trusted INTEGER DEFAULT 0,
            last_seen TEXT
        );
        CREATE TABLE IF NOT EXISTS verification_results (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            spiffe_id TEXT NOT NULL,
            verification_type TEXT NOT NULL,
            passed INTEGER DEFAULT 0,
            score REAL DEFAULT 0,
            details TEXT
        );
        CREATE TABLE IF NOT EXISTS rotation_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            spiffe_id TEXT NOT NULL,
            old_fingerprint TEXT,
            new_fingerprint TEXT,
            reason TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_logs_spiffe ON access_logs(spiffe_id);
    """)
    conn.close()


_conn_lock = threading.Lock()
_db_ready = False


def _ensure_db() -> None:
    global _db_ready
    if not _db_ready:
        _init_db()
        _db_ready = True


@contextmanager
def _conn():
    _ensure_db()
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def _fingerprint(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:32]


def issue_identity(spiffe_id: str, workload_type: str = "service",
                    trust_level: str = "medium", ttl_seconds: int = 3600) -> str:
    """签发 SPIFFE 身份"""
    if trust_level not in TRUST_LEVELS:
        trust_level = "medium"
    if not spiffe_id.startswith("spiffe://"):
        spiffe_id = "spiffe://default/" + spiffe_id
    expires = (datetime.now(timezone.utc).timestamp() + ttl_seconds)
    expires_str = datetime.fromtimestamp(expires, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    key_bytes = secrets.token_bytes(32)
    fp = _fingerprint(key_bytes)
    iid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO identities
            (id,timestamp,spiffe_id,workload_type,trust_level,public_key_fingerprint,ttl_seconds,expires_at,revoked)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (iid, _now(), spiffe_id, workload_type, trust_level, fp, ttl_seconds, expires_str, 0))
    return iid


def revoke_identity(spiffe_id: str, reason: str = "") -> bool:
    """撤销身份"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE identities SET revoked=1 WHERE spiffe_id=?""", (spiffe_id,))
        rows = c.execute("""SELECT public_key_fingerprint FROM identities WHERE spiffe_id=?""",
                          (spiffe_id,)).fetchone()
    if rows:
        hid = str(uuid.uuid4())
        with _conn_lock, _conn() as c:
            c.execute("""INSERT INTO rotation_history
                (id,timestamp,spiffe_id,old_fingerprint,new_fingerprint,reason)
                VALUES (?,?,?,?,?,?)""",
                (hid, _now(), spiffe_id, rows["public_key_fingerprint"], "", reason or "revoked"))
        return True
    return False


def create_policy(policy_name: str, spiffe_pattern: str, resource: str,
                   action: str, effect: str = "allow",
                   conditions: Optional[Dict] = None) -> str:
    """创建访问策略"""
    if effect not in POLICY_EFFECTS:
        effect = "allow"
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO policies
            (id,timestamp,policy_name,spiffe_pattern,resource,action,effect,conditions)
            VALUES (?,?,?,?,?,?,?,?)""",
            (pid, _now(), policy_name, spiffe_pattern, resource, action, effect,
             json.dumps(conditions or {}, ensure_ascii=False)))
    return pid


def evaluate_access(spiffe_id: str, resource: str, action: str = "read",
                     source_ip: str = "127.0.0.1",
                     verifications: Optional[List[str]] = None) -> Dict:
    """评估访问请求"""
    verifications = verifications or []
    with _conn_lock, _conn() as c:
        identity = c.execute("""SELECT * FROM identities WHERE spiffe_id=?""",
                              (spiffe_id,)).fetchone()
        policies = c.execute("""SELECT * FROM policies""").fetchall()
    risk_score = 0
    if not identity or identity["revoked"]:
        decision = "deny"
        trust = "untrusted"
        reason = "身份无效或已撤销"
    else:
        trust = identity["trust_level"]
        if not verifications:
            risk_score += 30
        if "identity" not in verifications:
            risk_score += 20
        if "device" not in verifications:
            risk_score += 15
        if risk_score >= 50:
            decision = "step_up"
        else:
            decision = "allow"
            for p in policies:
                if p["effect"] == "deny" and resource == p["resource"]:
                    decision = "deny"
                    break
        reason = f"trust={trust}, risk={risk_score}"
    lid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO access_logs
            (id,timestamp,spiffe_id,resource,action,decision,trust_level,risk_score,verification_types,source_ip)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (lid, _now(), spiffe_id, resource, action, decision, trust,
             risk_score, json.dumps(verifications, ensure_ascii=False), source_ip))
    return {"decision": decision, "trust_level": trust, "risk_score": risk_score, "reason": reason}


def register_device(device_id: str, device_type: str = "laptop",
                     fingerprint: str = "") -> str:
    """注册设备"""
    did = str(uuid.uuid4())
    if not fingerprint:
        fingerprint = _fingerprint(device_id.encode())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO devices
            (id,timestamp,device_id,device_type,fingerprint,trusted,last_seen)
            VALUES (?,?,?,?,?,?,?)""",
            (did, _now(), device_id, device_type, fingerprint, 1, _now()))
    return did


def record_verification(spiffe_id: str, verification_type: str,
                          passed: bool, score: float = 100.0,
                          details: Optional[Dict] = None) -> str:
    """记录验证结果"""
    if verification_type not in VERIFICATION_TYPES:
        verification_type = "identity"
    vid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO verification_results
            (id,timestamp,spiffe_id,verification_type,passed,score,details)
            VALUES (?,?,?,?,?,?,?)""",
            (vid, _now(), spiffe_id, verification_type, 1 if passed else 0, score,
             json.dumps(details or {}, ensure_ascii=False)))
    return vid


def rotate_key(spiffe_id: str, reason: str = "scheduled") -> str:
    """轮换密钥"""
    new_bytes = secrets.token_bytes(32)
    new_fp = _fingerprint(new_bytes)
    with _conn_lock, _conn() as c:
        old = c.execute("""SELECT public_key_fingerprint FROM identities WHERE spiffe_id=?""",
                         (spiffe_id,)).fetchone()
        old_fp = old["public_key_fingerprint"] if old else ""
        c.execute("""UPDATE identities SET public_key_fingerprint=? WHERE spiffe_id=?""",
                   (new_fp, spiffe_id))
        hid = str(uuid.uuid4())
        c.execute("""INSERT INTO rotation_history
            (id,timestamp,spiffe_id,old_fingerprint,new_fingerprint,reason)
            VALUES (?,?,?,?,?,?)""",
            (hid, _now(), spiffe_id, old_fp, new_fp, reason))
    return hid


def get_security_report() -> Dict:
    """安全报告"""
    with _conn_lock, _conn() as c:
        total_id = c.execute("""SELECT COUNT(*) as c FROM identities""").fetchone()["c"]
        revoked = c.execute("""SELECT COUNT(*) as c FROM identities WHERE revoked=1""").fetchone()["c"]
        total_logs = c.execute("""SELECT COUNT(*) as c FROM access_logs""").fetchone()["c"]
        denied = c.execute("""SELECT COUNT(*) as c FROM access_logs WHERE decision='deny'""").fetchone()["c"]
        step_up = c.execute("""SELECT COUNT(*) as c FROM access_logs WHERE decision='step_up'""").fetchone()["c"]
        policies = c.execute("""SELECT COUNT(*) as c FROM policies""").fetchone()["c"]
        devices = c.execute("""SELECT COUNT(*) as c FROM devices""").fetchone()["c"]
    return {
        "total_identities": total_id,
        "revoked_identities": revoked,
        "total_access_logs": total_logs,
        "denied_count": denied,
        "step_up_count": step_up,
        "total_policies": policies,
        "total_devices": devices,
    }


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, code: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        if u.path == "/api/health":
            self._send(200, {"status": "ok", "port": HTTP_PORT})
        elif u.path == "/api/report":
            self._send(200, get_security_report())
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {}
        if u.path == "/api/identity":
            iid = issue_identity(
                data.get("spiffe_id", "spiffe://default/svc"),
                data.get("workload_type", "service"),
                data.get("trust_level", "medium"),
                data.get("ttl_seconds", 3600),
            )
            self._send(200, {"identity_id": iid})
        elif u.path == "/api/revoke":
            ok = revoke_identity(data.get("spiffe_id", ""), data.get("reason", ""))
            self._send(200, {"revoked": ok})
        elif u.path == "/api/policy":
            pid = create_policy(
                data.get("policy_name", "default"),
                data.get("spiffe_pattern", "*"),
                data.get("resource", "*"),
                data.get("action", "read"),
                data.get("effect", "allow"),
                data.get("conditions"),
            )
            self._send(200, {"policy_id": pid})
        elif u.path == "/api/evaluate":
            result = evaluate_access(
                data.get("spiffe_id", "spiffe://default/svc"),
                data.get("resource", "/api/data"),
                data.get("action", "read"),
                data.get("source_ip", "127.0.0.1"),
                data.get("verifications"),
            )
            self._send(200, result)
        elif u.path == "/api/device":
            did = register_device(
                data.get("device_id", "dev-" + uuid.uuid4().hex[:6]),
                data.get("device_type", "laptop"),
                data.get("fingerprint", ""),
            )
            self._send(200, {"device_id": did})
        elif u.path == "/api/verification":
            vid = record_verification(
                data.get("spiffe_id", "spiffe://default/svc"),
                data.get("verification_type", "identity"),
                data.get("passed", True),
                data.get("score", 100.0),
                data.get("details"),
            )
            self._send(200, {"verification_id": vid})
        elif u.path == "/api/rotate":
            hid = rotate_key(data.get("spiffe_id", ""), data.get("reason", "scheduled"))
            self._send(200, {"history_id": hid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("127.0.0.1", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P0-45 零信任安全")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"零信任 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_security_report(), ensure_ascii=False, indent=2))
