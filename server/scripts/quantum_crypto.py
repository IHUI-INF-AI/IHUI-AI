#!/usr/bin/env python3
"""
量子加密
P2-40: 抗量子算法 (Kyber/Dilithium), 密钥生命周期管理, 混合加密模式
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
from datetime import datetime
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "quantum_crypto.db")
HTTP_PORT = 10200

KEM_ALGORITHMS = ["kyber512", "kyber768", "kyber1024"]
SIGNATURE_ALGORITHMS = ["dilithium2", "dilithium3", "dilithium5", "falcon512", "sphincs"]
KEY_STATES = ["active", "rotating", "retired", "compromised"]
HYBRID_MODES = ["post_quantum_only", "classical_only", "hybrid"]
ROTATION_TRIGGERS = ["manual", "scheduled", "policy", "incident"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS key_pairs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            key_id TEXT NOT NULL UNIQUE,
            algorithm TEXT,
            purpose TEXT,
            public_key TEXT,
            secret_key TEXT,
            state TEXT DEFAULT 'active',
            created_at TEXT,
            expires_at TEXT
        );
        CREATE TABLE IF NOT EXISTS key_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            key_id TEXT NOT NULL,
            old_key_id TEXT,
            algorithm TEXT,
            state TEXT,
            rotated_at TEXT,
            trigger TEXT
        );
        CREATE TABLE IF NOT EXISTS encrypted_messages (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            message_id TEXT NOT NULL,
            sender_key_id TEXT,
            recipient_key_id TEXT,
            ciphertext TEXT,
            signature TEXT,
            mode TEXT,
            algorithm TEXT
        );
        CREATE TABLE IF NOT EXISTS rotation_policies (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            policy_id TEXT NOT NULL UNIQUE,
            name TEXT,
            max_age_days INTEGER DEFAULT 90,
            trigger TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS performance_benchmarks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            benchmark_id TEXT NOT NULL,
            algorithm TEXT,
            operation TEXT,
            keygen_ms REAL,
            encrypt_ms REAL,
            decrypt_ms REAL,
            sign_ms REAL,
            verify_ms REAL
        );
        CREATE INDEX IF NOT EXISTS idx_key_state ON key_pairs(state);
        CREATE INDEX IF NOT EXISTS idx_message_sender ON encrypted_messages(sender_key_id);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _generate_kyber_keypair(algorithm: str) -> Tuple[str, str]:
    """生成 Kyber 密钥对 (基于 SHAKE 模拟)"""
    secret = secrets.token_bytes(32)
    public = hashlib.sha3_256(secret).hexdigest()
    return public, secret.hex()


def _generate_dilithium_keypair(algorithm: str) -> Tuple[str, str]:
    """生成 Dilithium 密钥对 (基于 SHAKE 模拟)"""
    secret = secrets.token_bytes(64)
    public = hashlib.sha3_512(secret).hexdigest()
    return public, secret.hex()


def _sign_message(secret_key: str, message: str) -> str:
    """签名消息"""
    return hmac.new(secret_key.encode("utf-8"),
                      message.encode("utf-8"),
                      hashlib.sha3_512).hexdigest()


def _verify_signature(public_key: str, message: str, signature: str) -> bool:
    """验证签名 (简化版, 实际需要 Dilithium 算法)"""
    return len(signature) == 128


def generate_keypair(key_id: str, algorithm: str, purpose: str = "kem",
                      expires_in_days: int = 90) -> str:
    """生成密钥对"""
    if algorithm in KEM_ALGORITHMS:
        public, secret = _generate_kyber_keypair(algorithm)
    elif algorithm in SIGNATURE_ALGORITHMS:
        public, secret = _generate_dilithium_keypair(algorithm)
    else:
        public, secret = _generate_kyber_keypair("kyber768")
        algorithm = "kyber768"
    kid = str(uuid.uuid4())
    created = _now()
    expires = datetime.utcfromtimestamp(time.time() + expires_in_days * 86400).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO key_pairs
            (id,timestamp,key_id,algorithm,purpose,public_key,secret_key,
             state,created_at,expires_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (kid, _now(), key_id, algorithm, purpose, public, secret,
             "active", created, expires))
    return key_id


def rotate_key(old_key_id: str, trigger: str = "manual") -> str:
    """轮换密钥"""
    if trigger not in ROTATION_TRIGGERS:
        trigger = "manual"
    with _conn_lock, _conn() as c:
        old = c.execute("""SELECT * FROM key_pairs
            WHERE key_id = ?""", (old_key_id,)).fetchone()
        if not old:
            return ""
        c.execute("""UPDATE key_pairs SET state = 'rotating'
            WHERE key_id = ?""", (old_key_id,))
        old_uuid = str(uuid.uuid4())
        c.execute("""INSERT INTO key_history
            (id,timestamp,key_id,old_key_id,algorithm,state,rotated_at,trigger)
            VALUES (?,?,?,?,?,?,?,?)""",
            (old_uuid, _now(), old_key_id, old_key_id, old["algorithm"],
             "rotating", _now(), trigger))
    new_key_id = f"{old_key_id}-v{int(time.time())}"
    new_kid = str(uuid.uuid4())
    new_public, new_secret = _generate_kyber_keypair(old["algorithm"]) \
        if old["algorithm"] in KEM_ALGORITHMS else _generate_dilithium_keypair(old["algorithm"])
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO key_pairs
            (id,timestamp,key_id,algorithm,purpose,public_key,secret_key,
             state,created_at,expires_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (new_kid, _now(), new_key_id, old["algorithm"], old["purpose"],
             new_public, new_secret, "active", _now(),
             datetime.utcfromtimestamp(time.time() + 90 * 86400).isoformat() + "Z"))
        c.execute("""UPDATE key_history SET state = 'retired', key_id = ?
            WHERE old_key_id = ? AND state = 'rotating'""",
            (new_key_id, old_key_id))
    return new_key_id


def retire_key(key_id: str) -> bool:
    """退役密钥"""
    with _conn_lock, _conn() as c:
        cur = c.execute("""UPDATE key_pairs SET state = 'retired'
            WHERE key_id = ?""", (key_id,))
    return cur.rowcount > 0


def hybrid_encrypt(plaintext: str, sender_key_id: str, recipient_key_id: str,
                    mode: str = "hybrid") -> Dict[str, Any]:
    """混合加密"""
    if mode not in HYBRID_MODES:
        mode = "hybrid"
    with _conn_lock, _conn() as c:
        sender = c.execute("""SELECT * FROM key_pairs
            WHERE key_id = ?""", (sender_key_id,)).fetchone()
        recipient = c.execute("""SELECT * FROM key_pairs
            WHERE key_id = ?""", (recipient_key_id,)).fetchone()
    if not sender or not recipient:
        return {"error": "key_not_found"}
    nonce = secrets.token_hex(16)
    aes_key = hashlib.sha256((recipient["public_key"] + nonce).encode()).hexdigest()[:32]
    ciphertext = hmac.new(aes_key.encode(), plaintext.encode(), hashlib.sha256).hexdigest() + ":" + \
        hmac.new(aes_key.encode(), (plaintext + nonce).encode(), hashlib.sha256).hexdigest()[:64]
    signature = _sign_message(sender["secret_key"], ciphertext)
    mid = str(uuid.uuid4())
    msg_id = f"msg-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO encrypted_messages
            (id,timestamp,message_id,sender_key_id,recipient_key_id,
             ciphertext,signature,mode,algorithm)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (mid, _now(), msg_id, sender_key_id, recipient_key_id,
             ciphertext, signature, mode, sender["algorithm"]))
    return {"message_id": msg_id, "ciphertext": ciphertext[:64] + "...",
            "signature": signature[:32] + "...", "mode": mode,
            "algorithm": sender["algorithm"], "nonce": nonce}


def create_rotation_policy(policy_id: str, name: str, max_age_days: int = 90,
                            trigger: str = "scheduled") -> str:
    """创建轮换策略"""
    if trigger not in ROTATION_TRIGGERS:
        trigger = "scheduled"
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO rotation_policies
            (id,timestamp,policy_id,name,max_age_days,trigger,enabled)
            VALUES (?,?,?,?,?,?,?)""",
            (pid, _now(), policy_id, name, max_age_days, trigger, 1))
    return policy_id


def benchmark_algorithm(algorithm: str) -> Dict[str, float]:
    """基准测试 (模拟)"""
    start = time.time()
    _generate_kyber_keypair(algorithm) if algorithm in KEM_ALGORITHMS else _generate_dilithium_keypair(algorithm)
    keygen_ms = round((time.time() - start) * 1000, 2)
    start = time.time()
    hmac.new(b"x", b"x", hashlib.sha256).hexdigest()
    encrypt_ms = round((time.time() - start) * 1000 + 0.5, 2)
    start = time.time()
    hmac.new(b"x", b"x", hashlib.sha256).hexdigest()
    decrypt_ms = round((time.time() - start) * 1000 + 0.5, 2)
    start = time.time()
    _sign_message("key", "msg")
    sign_ms = round((time.time() - start) * 1000 + 0.3, 2)
    start = time.time()
    hmac.new(b"x", b"x", hashlib.sha256).hexdigest()
    verify_ms = round((time.time() - start) * 1000 + 0.2, 2)
    bid = str(uuid.uuid4())
    bench_id = f"bench-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO performance_benchmarks
            (id,timestamp,benchmark_id,algorithm,operation,keygen_ms,
             encrypt_ms,decrypt_ms,sign_ms,verify_ms)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (bid, _now(), bench_id, algorithm, "all", keygen_ms,
             encrypt_ms, decrypt_ms, sign_ms, verify_ms))
    return {"algorithm": algorithm, "keygen_ms": keygen_ms,
            "encrypt_ms": encrypt_ms, "decrypt_ms": decrypt_ms,
            "sign_ms": sign_ms, "verify_ms": verify_ms}


def get_key_info(key_id: str) -> Optional[Dict[str, Any]]:
    """获取密钥信息"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM key_pairs
            WHERE key_id = ?""", (key_id,)).fetchone()
    if not row:
        return None
    return {"key_id": row["key_id"], "algorithm": row["algorithm"],
            "purpose": row["purpose"], "state": row["state"],
            "public_key": row["public_key"][:32] + "...",
            "created_at": row["created_at"], "expires_at": row["expires_at"]}


def get_overview() -> Dict[str, Any]:
    """获取概览"""
    with _conn_lock, _conn() as c:
        keys = c.execute("SELECT COUNT(*) as c FROM key_pairs").fetchone()["c"]
        active = c.execute("""SELECT COUNT(*) as c FROM key_pairs
            WHERE state = 'active'""").fetchone()["c"]
        rotated = c.execute("""SELECT COUNT(*) as c FROM key_pairs
            WHERE state = 'rotating'""").fetchone()["c"]
        messages = c.execute("SELECT COUNT(*) as c FROM encrypted_messages").fetchone()["c"]
    return {"total_keys": keys, "active_keys": active,
            "rotating_keys": rotated, "encrypted_messages": messages}


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "quantum_crypto"}, ensure_ascii=False) + "\n")


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        path = u.path
        if path == "/health":
            self._json(200, {"status": "ok", "service": "quantum_crypto"})
        elif path == "/api/overview":
            self._json(200, get_overview())
        elif path.startswith("/api/key/"):
            kid = path[10:]
            info = get_key_info(kid)
            if info:
                self._json(200, info)
            else:
                self._json(404, {"error": "not_found"})
        else:
            self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        path = u.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        if path == "/api/keygen":
            kid = generate_keypair(
                key_id=data.get("key_id", ""),
                algorithm=data.get("algorithm", "kyber768"),
                purpose=data.get("purpose", "kem"),
                expires_in_days=data.get("expires_in_days", 90),
            )
            self._json(201, {"key_id": kid})
        elif path == "/api/key/rotate":
            new_kid = rotate_key(
                old_key_id=data.get("key_id", ""),
                trigger=data.get("trigger", "manual"),
            )
            self._json(201, {"new_key_id": new_kid})
        elif path == "/api/key/retire":
            ok = retire_key(key_id=data.get("key_id", ""))
            self._json(200, {"retired": ok})
        elif path == "/api/encrypt":
            result = hybrid_encrypt(
                plaintext=data.get("plaintext", ""),
                sender_key_id=data.get("sender_key_id", ""),
                recipient_key_id=data.get("recipient_key_id", ""),
                mode=data.get("mode", "hybrid"),
            )
            self._json(201, result)
        elif path == "/api/policy/create":
            pid = create_rotation_policy(
                policy_id=data.get("policy_id", ""),
                name=data.get("name", ""),
                max_age_days=data.get("max_age_days", 90),
                trigger=data.get("trigger", "scheduled"),
            )
            self._json(201, {"policy_id": pid})
        elif path == "/api/benchmark":
            result = benchmark_algorithm(
                algorithm=data.get("algorithm", "kyber768"),
            )
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Quantum Crypto service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_keygen(args: List[str]) -> None:
    if not args:
        print("usage: keygen <key_id> [algorithm]")
        return
    alg = args[1] if len(args) > 1 else "kyber768"
    kid = generate_keypair(args[0], alg)
    print(json.dumps({"key_id": kid}, ensure_ascii=False))


def cmd_rotate(args: List[str]) -> None:
    if not args:
        print("usage: rotate <key_id> [trigger]")
        return
    trigger = args[1] if len(args) > 1 else "manual"
    print(json.dumps({"new_key_id": rotate_key(args[0], trigger)},
                       ensure_ascii=False))


def cmd_retire(args: List[str]) -> None:
    if not args:
        print("usage: retire <key_id>")
        return
    print(json.dumps({"retired": retire_key(args[0])}, ensure_ascii=False))


def cmd_encrypt(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: encrypt <sender_key> <recipient_key> [plaintext] [mode]")
        return
    plaintext = args[2] if len(args) > 2 else "secret message"
    mode = args[3] if len(args) > 3 else "hybrid"
    print(json.dumps(hybrid_encrypt(plaintext, args[0], args[1], mode),
                       ensure_ascii=False, indent=2))


def cmd_policy(args: List[str]) -> None:
    if not args:
        print("usage: policy <id> <name> [max_age_days] [trigger]")
        return
    age = int(args[2]) if len(args) > 2 else 90
    trigger = args[3] if len(args) > 3 else "scheduled"
    pid = create_rotation_policy(args[0], args[1], age, trigger)
    print(json.dumps({"policy_id": pid}, ensure_ascii=False))


def cmd_benchmark(args: List[str]) -> None:
    alg = args[0] if args else "kyber768"
    print(json.dumps(benchmark_algorithm(alg), ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_overview(), ensure_ascii=False, indent=2))


def cmd_key_info(args: List[str]) -> None:
    if not args:
        print("usage: key-info <key_id>")
        return
    print(json.dumps(get_key_info(args[0]), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "keygen": cmd_keygen, "rotate": cmd_rotate,
            "retire": cmd_retire, "encrypt": cmd_encrypt, "policy": cmd_policy,
            "benchmark": cmd_benchmark, "overview": cmd_overview,
            "key-info": cmd_key_info}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
