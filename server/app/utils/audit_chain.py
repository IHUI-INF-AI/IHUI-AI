"""Bug-72: 关键操作审计日志不可篡改 (hash 链).

设计:
  - 每条审计记录 = {ts, user, action, payload, prev_hash, hash}
  - hash = sha256(prev_hash + json(entry_without_hash))
  - 验证: 顺序读所有记录, 验证 prev_hash 与上一条 hash 一致
  - 存储: 文件追加 (append-only) + 可选 Redis
  - 提供 verify_chain() 校验整链

使用:
    from app.utils.audit_chain import audit_chain

    audit_chain.append("user.login", user="u_001", ip="1.2.3.4")
    audit_chain.append("payment.created", user="u_001", amount=99.9, order_no="x")
    ok = audit_chain.verify_chain()  # True 表示链完整
"""

import hashlib
import json
import logging
import os
import threading
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

DEFAULT_AUDIT_FILE = os.environ.get("AUDIT_CHAIN_FILE", "audit_chain.jsonl")
GENESIS_HASH = "0" * 64
DEFAULT_LIMIT_PER_FILE = 50_000  # 单文件最大记录数, 触发轮转


@dataclass
class AuditEntry:
    seq: int
    ts: float
    action: str
    user: str
    payload: dict
    prev_hash: str
    hash: str = ""

    def to_dict(self) -> dict:
        return {
            "seq": self.seq,
            "ts": self.ts,
            "action": self.action,
            "user": self.user,
            "payload": self.payload,
            "prev_hash": self.prev_hash,
            "hash": self.hash,
        }

    @staticmethod
    def from_dict(d: dict) -> "AuditEntry":
        return AuditEntry(
            seq=int(d["seq"]),
            ts=float(d["ts"]),
            action=str(d["action"]),
            user=str(d.get("user", "")),
            payload=d.get("payload", {}),
            prev_hash=str(d.get("prev_hash", GENESIS_HASH)),
            hash=str(d.get("hash", "")),
        )


class AuditChain:
    """不可篡改审计 hash 链."""

    def __init__(self, file_path: str = DEFAULT_AUDIT_FILE):
        self.file_path = file_path
        self._lock = threading.Lock()
        self._last_hash = GENESIS_HASH
        self._last_seq = 0
        self._rotate_idx = 0
        self._verify_cache: bool | None = None
        self._verify_cache_ts: float = 0.0
        self._init_from_file()

    def _init_from_file(self) -> None:
        if not os.path.exists(self.file_path):
            return
        try:
            # 倒着读最后 50 行找最后 hash
            with open(self.file_path, "rb") as f:
                f.seek(0, 2)
                size = f.tell()
                if size == 0:
                    return
                f.seek(max(0, size - 64 * 1024))
                data = f.read().decode("utf-8", errors="ignore")
            lines = [l for l in data.splitlines() if l.strip()]
            for line in lines[-50:]:
                try:
                    d = json.loads(line)
                    self._last_hash = d.get("hash", self._last_hash)
                    self._last_seq = max(self._last_seq, int(d.get("seq", 0)))
                except Exception:
                    continue
        except Exception as e:
            logger.debug(f"audit init from file fail: {e}")

    @staticmethod
    def _compute_hash(prev_hash: str, entry_dict: dict) -> str:
        """entry_dict 不含 hash 字段."""
        # 规范化: 排序 key, ensure_ascii=False
        canonical = json.dumps(entry_dict, sort_keys=True, ensure_ascii=False, separators=("", ":"))
        h = hashlib.sha256()
        h.update(prev_hash.encode("utf-8"))
        h.update(canonical.encode("utf-8"))
        return h.hexdigest()

    def append(self, action: str, user: str = "", **payload) -> AuditEntry:
        """追加一条审计记录, 返回 entry."""
        with self._lock:
            self._last_seq += 1
            entry = AuditEntry(
                seq=self._last_seq,
                ts=time.time(),
                action=action,
                user=user,
                payload=dict(payload),
                prev_hash=self._last_hash,
            )
            # 计算 hash
            entry_dict = entry.to_dict()
            entry_dict.pop("hash", None)
            entry.hash = self._compute_hash(entry.prev_hash, entry_dict)
            self._last_hash = entry.hash
            # 写文件 (append-only)
            try:
                os.makedirs(os.path.dirname(self.file_path) or ".", exist_ok=True)
                with open(self.file_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
            except Exception as e:
                logger.warning(f"audit_chain append fail: {e}")
            self._invalidate_verify()
            return entry

    def _invalidate_verify(self) -> None:
        self._verify_cache = None

    def _read_all(self) -> list[AuditEntry]:
        out: list[AuditEntry] = []
        if not os.path.exists(self.file_path):
            return out
        try:
            with open(self.file_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        d = json.loads(line)
                        out.append(AuditEntry.from_dict(d))
                    except Exception:
                        continue
        except Exception as e:
            logger.warning(f"audit_chain read fail: {e}")
        return out

    def verify_chain(self) -> bool:
        """校验整链. 返回 True 表示完整未篡改."""
        with self._lock:
            # 缓存 5s
            if self._verify_cache is not None and time.time() - self._verify_cache_ts < 5.0:
                return self._verify_cache
        entries = self._read_all()
        if not entries:
            self._verify_cache = True
            self._verify_cache_ts = time.time()
            return True
        prev_hash = GENESIS_HASH
        for e in entries:
            d = e.to_dict()
            d.pop("hash", None)
            expected = self._compute_hash(prev_hash, d)
            if e.prev_hash != prev_hash or e.hash != expected:
                self._verify_cache = False
                self._verify_cache_ts = time.time()
                return False
            prev_hash = e.hash
        self._verify_cache = True
        self._verify_cache_ts = time.time()
        return True

    def find_by_action(self, action: str, limit: int = 100) -> list[AuditEntry]:
        return [e for e in self._read_all() if e.action == action][-limit:]

    def find_by_user(self, user: str, limit: int = 100) -> list[AuditEntry]:
        return [e for e in self._read_all() if e.user == user][-limit:]

    def stats(self) -> dict:
        entries = self._read_all()
        actions: dict[str, int] = {}
        for e in entries:
            actions[e.action] = actions.get(e.action, 0) + 1
        return {
            "total": len(entries),
            "last_seq": self._last_seq,
            "last_hash": self._last_hash[:16] + "...",
            "actions": actions,
            "verify_ok": self.verify_chain(),
            "file": self.file_path,
        }

    def last_n(self, n: int = 10) -> list[dict]:
        entries = self._read_all()
        return [e.to_dict() for e in entries[-n:]]


# 全局单例
audit_chain = AuditChain()
