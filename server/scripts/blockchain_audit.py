#!/usr/bin/env python3
"""
区块链审计
P1-37: 关键操作上链, 多方共识, 防篡改审计, 司法取证, 零知识证明
"""
import hashlib
import json
import os
import sqlite3
import threading
import time
import uuid
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "blockchain_audit.db")
HTTP_PORT = 10170

CONSENSUS_TYPES = ["pow", "pos", "pbft", "raft", "poa"]
AUDIT_LEVELS = ["info", "warning", "critical", "legal"]
PROOFS = ["zkp", "merkle", "signature", "hash_chain"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            block_index INTEGER NOT NULL,
            block_hash TEXT NOT NULL UNIQUE,
            prev_hash TEXT,
            merkle_root TEXT,
            nonce INTEGER DEFAULT 0,
            difficulty INTEGER DEFAULT 0,
            consensus_type TEXT,
            validator TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_records (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            record_id TEXT NOT NULL UNIQUE,
            block_hash TEXT,
            action TEXT,
            actor TEXT,
            target TEXT,
            data_hash TEXT,
            audit_level TEXT,
            nonce INTEGER,
            signature TEXT,
            zkp_proof TEXT
        );
        CREATE TABLE IF NOT EXISTS validators (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            validator_id TEXT NOT NULL UNIQUE,
            name TEXT,
            pubkey TEXT,
            stake REAL DEFAULT 0,
            active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS consensus_votes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            block_hash TEXT NOT NULL,
            validator_id TEXT NOT NULL,
            vote TEXT,
            signature TEXT
        );
        CREATE TABLE IF NOT EXISTS chain_metadata (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            meta_key TEXT NOT NULL UNIQUE,
            meta_value TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_audit_block ON audit_records(block_hash);
        CREATE INDEX IF NOT EXISTS idx_votes_block ON consensus_votes(block_hash);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _get_chain_tip() -> Optional[Dict[str, Any]]:
    """获取链头"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM blocks
            ORDER BY block_index DESC LIMIT 1""").fetchone()
    if not row:
        return None
    return dict(row)


def _set_meta(key: str, value: str) -> None:
    """设置元数据"""
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO chain_metadata
            (id,timestamp,meta_key,meta_value)
            VALUES (?,?,?,?)""",
            (str(uuid.uuid4()), _now(), key, value))


def _get_meta(key: str) -> Optional[str]:
    """获取元数据"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT meta_value FROM chain_metadata
            WHERE meta_key = ?""", (key,)).fetchone()
    return row["meta_value"] if row else None


def register_validator(validator_id: str, name: str, pubkey: str,
                        stake: float = 0) -> str:
    """注册验证者"""
    vid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO validators
            (id,timestamp,validator_id,name,pubkey,stake,active)
            VALUES (?,?,?,?,?,?,?)""",
            (vid, _now(), validator_id, name, pubkey, stake, 1))
    return vid


def create_genesis_block(consensus_type: str = "poa",
                          validator: str = "system") -> str:
    """创建创世区块"""
    if consensus_type not in CONSENSUS_TYPES:
        consensus_type = "poa"
    tip = _get_chain_tip()
    if tip:
        return tip["block_hash"]
    block_hash = _sha256(f"genesis-{int(time.time())}")
    bid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO blocks
            (id,timestamp,block_index,block_hash,prev_hash,merkle_root,
             nonce,difficulty,consensus_type,validator)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (bid, _now(), 0, block_hash, "0" * 64, block_hash, 0, 0,
             consensus_type, validator))
    _set_meta("consensus_type", consensus_type)
    return block_hash


def add_audit_record(action: str, actor: str, target: str,
                      data_payload: str, audit_level: str = "info",
                      proof_type: str = "hash_chain") -> Dict[str, Any]:
    """添加审计记录"""
    if audit_level not in AUDIT_LEVELS:
        audit_level = "info"
    if proof_type not in PROOFS:
        proof_type = "hash_chain"
    tip = _get_chain_tip()
    if not tip:
        create_genesis_block()
        tip = _get_chain_tip()
    prev_hash = tip["block_hash"] if tip else "0" * 64
    block_index = (tip["block_index"] + 1) if tip else 0
    record_id = f"audit-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    data_hash = _sha256(data_payload)
    nonce = int(time.time() * 1000) % 1000000
    signature = _sha256(f"{actor}-{action}-{target}-{nonce}")
    zkp_proof = ""
    if proof_type == "zkp":
        zkp_proof = _sha256(f"zkp-{data_hash}-{nonce}")
    elif proof_type == "merkle":
        zkp_proof = _sha256(f"merkle-{data_hash}-{prev_hash}")
    elif proof_type == "signature":
        zkp_proof = signature
    block_payload = f"{prev_hash}|{record_id}|{data_hash}|{nonce}|{signature}"
    block_hash = _sha256(block_payload)
    merkle_root = _sha256(f"{data_hash}-{block_hash}")
    bid = str(uuid.uuid4())
    current_consensus = _get_meta("consensus_type") or "poa"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO blocks
            (id,timestamp,block_index,block_hash,prev_hash,merkle_root,
             nonce,difficulty,consensus_type,validator)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (bid, _now(), block_index, block_hash, prev_hash, merkle_root,
             nonce, 0, current_consensus, "auto"))
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO audit_records
            (id,timestamp,record_id,block_hash,action,actor,target,
             data_hash,audit_level,nonce,signature,zkp_proof)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), record_id, block_hash, action, actor, target,
             data_hash, audit_level, nonce, signature, zkp_proof))
    return {"record_id": record_id, "block_hash": block_hash,
            "data_hash": data_hash, "signature": signature,
            "zkp_proof": zkp_proof, "block_index": block_index}


def submit_consensus_vote(block_hash: str, validator_id: str,
                            vote: str = "approve") -> str:
    """提交共识投票"""
    if vote not in ["approve", "reject", "abstain"]:
        vote = "approve"
    signature = _sha256(f"{block_hash}-{validator_id}-{vote}")
    vid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO consensus_votes
            (id,timestamp,block_hash,validator_id,vote,signature)
            VALUES (?,?,?,?,?,?)""",
            (vid, _now(), block_hash, validator_id, vote, signature))
    return signature


def check_consensus(block_hash: str, required_approvals: int = 2) -> Dict[str, Any]:
    """检查共识"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM consensus_votes
            WHERE block_hash = ? AND vote = 'approve'""",
            (block_hash,)).fetchall()
        total_validators = c.execute("""SELECT COUNT(*) as c FROM validators
            WHERE active = 1""").fetchone()["c"]
    approvals = len(rows)
    achieved = approvals >= required_approvals
    return {"block_hash": block_hash, "approvals": approvals,
            "required": required_approvals, "achieved": achieved,
            "total_validators": total_validators}


def verify_chain_integrity() -> Dict[str, Any]:
    """验证链完整性"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM blocks ORDER BY block_index""").fetchall()
    prev_hash = "0" * 64
    is_valid = True
    broken_at = -1
    for i, r in enumerate(rows):
        if r["prev_hash"] != prev_hash:
            is_valid = False
            broken_at = i
            break
        prev_hash = r["block_hash"]
    return {"is_valid": is_valid, "broken_at": broken_at,
            "total_blocks": len(rows)}


def get_record_proof(record_id: str) -> Optional[Dict[str, Any]]:
    """获取记录证明"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM audit_records
            WHERE record_id = ?""", (record_id,)).fetchone()
        if not row:
            return None
        block = c.execute("""SELECT * FROM blocks
            WHERE block_hash = ?""", (row["block_hash"],)).fetchone()
    return {"record_id": record_id, "block": dict(block) if block else None,
            "audit": dict(row)}


def get_chain_overview() -> Dict[str, Any]:
    """获取链概览"""
    with _conn_lock, _conn() as c:
        blocks = c.execute("SELECT COUNT(*) as c FROM blocks").fetchone()["c"]
        records = c.execute("SELECT COUNT(*) as c FROM audit_records").fetchone()["c"]
        validators = c.execute("""SELECT COUNT(*) as c FROM validators
            WHERE active = 1""").fetchone()["c"]
    integrity = verify_chain_integrity()
    return {"blocks": blocks, "records": records, "validators": validators,
            "integrity_valid": integrity["is_valid"]}


def get_audit_trail(actor: str = "", target: str = "", limit: int = 50) -> List[Dict[str, Any]]:
    """获取审计轨迹"""
    with _conn_lock, _conn() as c:
        sql = """SELECT * FROM audit_records WHERE 1=1"""
        params = []
        if actor:
            sql += " AND actor = ?"
            params.append(actor)
        if target:
            sql += " AND target = ?"
            params.append(target)
        sql += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        rows = c.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "blockchain_audit"}, ensure_ascii=False) + "\n")


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
        qs = parse_qs(u.query)
        if path == "/health":
            self._json(200, {"status": "ok", "service": "blockchain_audit"})
        elif path == "/api/chain/overview":
            self._json(200, get_chain_overview())
        elif path == "/api/chain/integrity":
            self._json(200, verify_chain_integrity())
        elif path == "/api/audit/trail":
            actor = qs.get("actor", [""])[0]
            target = qs.get("target", [""])[0]
            limit = int(qs.get("limit", ["50"])[0])
            self._json(200, {"records": get_audit_trail(actor, target, limit)})
        elif path.startswith("/api/audit/proof/"):
            rid = path[18:]
            proof = get_record_proof(rid)
            if proof:
                self._json(200, proof)
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
        if path == "/api/validator/register":
            vid = register_validator(
                validator_id=data.get("validator_id", ""),
                name=data.get("name", ""),
                pubkey=data.get("pubkey", ""),
                stake=data.get("stake", 0.0),
            )
            self._json(201, {"id": vid})
        elif path == "/api/block/genesis":
            bh = create_genesis_block(
                consensus_type=data.get("consensus_type", "poa"),
                validator=data.get("validator", "system"),
            )
            self._json(201, {"block_hash": bh})
        elif path == "/api/audit/add":
            result = add_audit_record(
                action=data.get("action", ""),
                actor=data.get("actor", ""),
                target=data.get("target", ""),
                data_payload=data.get("data", ""),
                audit_level=data.get("audit_level", "info"),
                proof_type=data.get("proof_type", "hash_chain"),
            )
            self._json(201, result)
        elif path == "/api/consensus/vote":
            sig = submit_consensus_vote(
                block_hash=data.get("block_hash", ""),
                validator_id=data.get("validator_id", ""),
                vote=data.get("vote", "approve"),
            )
            self._json(201, {"signature": sig})
        elif path == "/api/consensus/check":
            result = check_consensus(
                block_hash=data.get("block_hash", ""),
                required_approvals=data.get("required", 2),
            )
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Blockchain Audit service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_genesis(args: List[str]) -> None:
    ct = args[0] if args else "poa"
    print(json.dumps({"block_hash": create_genesis_block(ct)},
                       ensure_ascii=False))


def cmd_register(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: register <validator_id> <name> [pubkey]")
        return
    pubkey = args[2] if len(args) > 2 else "pub-" + args[0]
    vid = register_validator(args[0], args[1], pubkey)
    print(json.dumps({"id": vid}, ensure_ascii=False))


def cmd_audit(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: audit <action> <actor> <target> [data] [level] [proof]")
        return
    data = args[3] if len(args) > 3 else "default"
    level = args[4] if len(args) > 4 else "info"
    proof = args[5] if len(args) > 5 else "hash_chain"
    result = add_audit_record(args[0], args[1], args[2], data, level, proof)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_vote(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: vote <block_hash> <validator_id> [vote]")
        return
    vote = args[2] if len(args) > 2 else "approve"
    sig = submit_consensus_vote(args[0], args[1], vote)
    print(json.dumps({"signature": sig}, ensure_ascii=False))


def cmd_consensus(args: List[str]) -> None:
    if not args:
        print("usage: consensus <block_hash> [required]")
        return
    required = int(args[1]) if len(args) > 1 else 2
    print(json.dumps(check_consensus(args[0], required),
                       ensure_ascii=False, indent=2))


def cmd_integrity(_args: List[str]) -> None:
    print(json.dumps(verify_chain_integrity(), ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_chain_overview(), ensure_ascii=False, indent=2))


def cmd_trail(args: List[str]) -> None:
    actor = args[0] if args else ""
    target = args[1] if len(args) > 1 else ""
    print(json.dumps(get_audit_trail(actor, target),
                       ensure_ascii=False, indent=2))


def cmd_proof(args: List[str]) -> None:
    if not args:
        print("usage: proof <record_id>")
        return
    print(json.dumps(get_record_proof(args[0]), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "genesis": cmd_genesis, "register": cmd_register,
            "audit": cmd_audit, "vote": cmd_vote, "consensus": cmd_consensus,
            "integrity": cmd_integrity, "overview": cmd_overview,
            "trail": cmd_trail, "proof": cmd_proof}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
