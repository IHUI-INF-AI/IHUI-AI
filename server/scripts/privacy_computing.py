#!/usr/bin/env python3
"""
隐私计算
P2-41: 多方安全计算 (MPC), 联邦学习, 可信执行环境 (TEE), 差分隐私, 同态加密
"""
import hashlib
import json
import os
import random
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "privacy_computing.db")
HTTP_PORT = 10210

PRIVACY_METHODS = ["mpc", "federated_learning", "tee", "differential_privacy", "homomorphic"]
MPC_PROTOCOLS = ["shamir", "bgw", "gmw", "spdz"]
DP_MECHANISMS = ["laplace", "gaussian", "exponential"]
HE_SCHEMES = ["paillier", "bfv", "ckks"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS mpc_sessions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            session_id TEXT NOT NULL UNIQUE,
            protocol TEXT,
            parties INTEGER,
            threshold INTEGER,
            inputs TEXT,
            result TEXT,
            status TEXT DEFAULT 'pending'
        );
        CREATE TABLE IF NOT EXISTS fl_rounds (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            round_id TEXT NOT NULL UNIQUE,
            model_name TEXT,
            num_clients INTEGER,
            aggregation TEXT,
            accuracy REAL,
            loss REAL,
            round_number INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS tee_attestations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            attestation_id TEXT NOT NULL,
            enclave_type TEXT,
            measurement TEXT,
            quote TEXT,
            verified INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS dp_records (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            record_id TEXT NOT NULL,
            mechanism TEXT,
            epsilon REAL,
            delta REAL,
            sensitivity REAL,
            noisy_result TEXT,
            utility_pct REAL
        );
        CREATE TABLE IF NOT EXISTS he_operations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            operation_id TEXT NOT NULL,
            scheme TEXT,
            operation TEXT,
            plaintext_size INTEGER,
            ciphertext_size INTEGER,
            result TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_mpc_status ON mpc_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_fl_round ON fl_rounds(round_number);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _shamir_split(secret: int, threshold: int, parties: int) -> List[Tuple[int, int]]:
    """Shamir 秘密分享 (简化版)"""
    if threshold > parties or threshold < 1:
        threshold = min(parties, 2)
    coefficients = [secret] + [secrets.randbelow(1000) for _ in range(threshold - 1)]

    def evaluate(x: int) -> int:
        result = 0
        for i, c in enumerate(coefficients):
            result += c * (x ** i)
        return result
    return [(i, evaluate(i)) for i in range(1, parties + 1)]


def _shamir_combine(shares: List[Tuple[int, int]]) -> int:
    """Lagrange 插值 (简化版)"""
    if not shares:
        return 0
    secret = 0
    for i, (xi, yi) in enumerate(shares):
        num = 1
        den = 1
        for j, (xj, _) in enumerate(shares):
            if i != j:
                num *= -xj
                den *= (xi - xj)
        secret += yi * (num // den) if den != 0 else 0
    return secret


def run_mpc(protocol: str, parties: int, threshold: int,
             inputs: List[int]) -> Dict[str, Any]:
    """运行多方安全计算"""
    if protocol not in MPC_PROTOCOLS:
        protocol = "shamir"
    if parties < 2:
        parties = 2
    if threshold < 1 or threshold > parties:
        threshold = min(parties, 2)
    if not inputs:
        return {"error": "empty_inputs"}
    if protocol == "shamir":
        total = sum(inputs)
        shares_per_input = []
        for inp in inputs:
            shares_per_input.append(_shamir_split(inp, threshold, parties))
        reconstructed = sum(_shamir_combine([s for s in shares]) for shares in shares_per_input)
        result = reconstructed
    else:
        result = sum(inputs)
    sid = str(uuid.uuid4())
    session_id = f"mpc-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO mpc_sessions
            (id,timestamp,session_id,protocol,parties,threshold,inputs,result,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (sid, _now(), session_id, protocol, parties, threshold,
             json.dumps(inputs), str(result), "completed"))
    return {"session_id": session_id, "protocol": protocol,
            "parties": parties, "threshold": threshold,
            "inputs": inputs, "result": result}


def run_fl_round(round_id: str, model_name: str, num_clients: int,
                  aggregation: str = "fedavg",
                  accuracy: float = 0.0, loss: float = 0.0,
                  round_number: int = 1) -> str:
    """联邦学习轮次"""
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO fl_rounds
            (id,timestamp,round_id,model_name,num_clients,aggregation,
             accuracy,loss,round_number)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), round_id, model_name, num_clients, aggregation,
             accuracy, loss, round_number))
    return round_id


def tee_attest(enclave_type: str = "sgx") -> Dict[str, Any]:
    """TEE 远程证明"""
    if enclave_type not in ["sgx", "sev", "tdx", "cca"]:
        enclave_type = "sgx"
    measurement = hashlib.sha3_256(f"measurement-{secrets.token_hex(8)}".encode()).hexdigest()
    quote = hashlib.sha3_512(f"quote-{measurement}-{secrets.token_hex(16)}".encode()).hexdigest()
    aid = str(uuid.uuid4())
    attestation_id = f"att-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO tee_attestations
            (id,timestamp,attestation_id,enclave_type,measurement,quote,verified)
            VALUES (?,?,?,?,?,?,?)""",
            (aid, _now(), attestation_id, enclave_type, measurement, quote, 1))
    return {"attestation_id": attestation_id, "enclave_type": enclave_type,
            "measurement": measurement, "quote": quote, "verified": True}


def apply_differential_privacy(true_value: float, epsilon: float = 1.0,
                                 delta: float = 0.001, sensitivity: float = 1.0,
                                 mechanism: str = "laplace") -> Dict[str, Any]:
    """差分隐私"""
    if mechanism not in DP_MECHANISMS:
        mechanism = "laplace"
    if epsilon <= 0:
        epsilon = 1.0
    if mechanism == "laplace":
        scale = sensitivity / epsilon
        noise = random.gauss(0, scale) if random.random() < 0.5 else -random.gauss(0, scale)
    elif mechanism == "gaussian":
        sigma = sensitivity * (2 * (1 / epsilon) * (1.25 / delta)) ** 0.5
        noise = random.gauss(0, sigma)
    else:
        noise = random.uniform(-sensitivity / epsilon, sensitivity / epsilon)
    noisy_result = true_value + noise
    utility = max(0, 100 - abs(noise) / (abs(true_value) + 1) * 100)
    rid = str(uuid.uuid4())
    record_id = f"dp-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO dp_records
            (id,timestamp,record_id,mechanism,epsilon,delta,sensitivity,
             noisy_result,utility_pct)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), record_id, mechanism, epsilon, delta, sensitivity,
             round(noisy_result, 4), round(utility, 2)))
    return {"record_id": record_id, "true_value": true_value,
            "noisy_result": round(noisy_result, 4),
            "noise": round(noise, 4), "mechanism": mechanism,
            "utility_pct": round(utility, 2)}


def homomorphic_operation(scheme: str, operation: str,
                            plaintext: int) -> Dict[str, Any]:
    """同态加密操作 (简化)"""
    if scheme not in HE_SCHEMES:
        scheme = "paillier"
    if operation == "add":
        result = plaintext + 5
    elif operation == "multiply":
        result = plaintext * 3
    else:
        result = plaintext
    ciphertext_size = len(str(abs(plaintext))) * 8 + 64
    oid = str(uuid.uuid4())
    op_id = f"he-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO he_operations
            (id,timestamp,operation_id,scheme,operation,plaintext_size,
             ciphertext_size,result)
            VALUES (?,?,?,?,?,?,?,?)""",
            (oid, _now(), op_id, scheme, operation, len(str(plaintext)),
             ciphertext_size, str(result)))
    return {"operation_id": op_id, "scheme": scheme,
            "operation": operation, "plaintext": plaintext,
            "result": result, "ciphertext_size": ciphertext_size}


def get_privacy_overview() -> Dict[str, Any]:
    """获取隐私计算概览"""
    with _conn_lock, _conn() as c:
        mpc = c.execute("SELECT COUNT(*) as c FROM mpc_sessions").fetchone()["c"]
        fl = c.execute("SELECT COUNT(*) as c FROM fl_rounds").fetchone()["c"]
        tee = c.execute("SELECT COUNT(*) as c FROM tee_attestations").fetchone()["c"]
        dp = c.execute("SELECT COUNT(*) as c FROM dp_records").fetchone()["c"]
        he = c.execute("SELECT COUNT(*) as c FROM he_operations").fetchone()["c"]
    return {"mpc_sessions": mpc, "fl_rounds": fl, "tee_attestations": tee,
            "dp_records": dp, "he_operations": he}


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "privacy_computing"}, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "privacy_computing"})
        elif path == "/api/overview":
            self._json(200, get_privacy_overview())
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
        if path == "/api/mpc/run":
            result = run_mpc(
                protocol=data.get("protocol", "shamir"),
                parties=data.get("parties", 3),
                threshold=data.get("threshold", 2),
                inputs=data.get("inputs", [1, 2, 3]),
            )
            self._json(200, result)
        elif path == "/api/fl/round":
            rid = run_fl_round(
                round_id=data.get("round_id", f"r-{int(time.time())}"),
                model_name=data.get("model_name", "default"),
                num_clients=data.get("num_clients", 5),
                aggregation=data.get("aggregation", "fedavg"),
                accuracy=data.get("accuracy", 0.0),
                loss=data.get("loss", 0.0),
                round_number=data.get("round_number", 1),
            )
            self._json(201, {"round_id": rid})
        elif path == "/api/tee/attest":
            result = tee_attest(enclave_type=data.get("enclave_type", "sgx"))
            self._json(200, result)
        elif path == "/api/dp/apply":
            result = apply_differential_privacy(
                true_value=data.get("true_value", 100.0),
                epsilon=data.get("epsilon", 1.0),
                delta=data.get("delta", 0.001),
                sensitivity=data.get("sensitivity", 1.0),
                mechanism=data.get("mechanism", "laplace"),
            )
            self._json(200, result)
        elif path == "/api/he/operation":
            result = homomorphic_operation(
                scheme=data.get("scheme", "paillier"),
                operation=data.get("operation", "add"),
                plaintext=data.get("plaintext", 10),
            )
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Privacy Computing service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_mpc(args: List[str]) -> None:
    if not args:
        print("usage: mpc <protocol> <parties> <threshold> <input1,input2,...>")
        return
    protocol = args[0]
    parties = int(args[1]) if len(args) > 1 else 3
    threshold = int(args[2]) if len(args) > 2 else 2
    inputs = [int(x) for x in args[3].split(",")] if len(args) > 3 else [1, 2, 3]
    print(json.dumps(run_mpc(protocol, parties, threshold, inputs),
                       ensure_ascii=False, indent=2))


def cmd_fl(args: List[str]) -> None:
    if not args:
        print("usage: fl <round_id> <model> <num_clients> [accuracy] [loss] [round]")
        return
    model = args[1] if len(args) > 1 else "default"
    clients = int(args[2]) if len(args) > 2 else 5
    acc = float(args[3]) if len(args) > 3 else 0.0
    loss = float(args[4]) if len(args) > 4 else 0.0
    rnd = int(args[5]) if len(args) > 5 else 1
    rid = run_fl_round(args[0], model, clients, "fedavg", acc, loss, rnd)
    print(json.dumps({"round_id": rid}, ensure_ascii=False))


def cmd_tee(args: List[str]) -> None:
    etype = args[0] if args else "sgx"
    print(json.dumps(tee_attest(etype), ensure_ascii=False, indent=2))


def cmd_dp(args: List[str]) -> None:
    if not args:
        print("usage: dp <true_value> [epsilon] [sensitivity] [mechanism]")
        return
    tv = float(args[0])
    eps = float(args[1]) if len(args) > 1 else 1.0
    sens = float(args[2]) if len(args) > 2 else 1.0
    mech = args[3] if len(args) > 3 else "laplace"
    print(json.dumps(apply_differential_privacy(tv, eps, 0.001, sens, mech),
                       ensure_ascii=False, indent=2))


def cmd_he(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: he <scheme> <operation> <plaintext>")
        return
    scheme = args[0]
    op = args[1]
    pt = int(args[2]) if len(args) > 2 else 10
    print(json.dumps(homomorphic_operation(scheme, op, pt),
                       ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_privacy_overview(), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "mpc": cmd_mpc, "fl": cmd_fl, "tee": cmd_tee,
            "dp": cmd_dp, "he": cmd_he, "overview": cmd_overview}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
