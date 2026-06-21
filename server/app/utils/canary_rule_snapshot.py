"""Bug-106: 灰度规则快照 (Canary Rule Snapshot).

设计:
  - 规则内存态: name / match_expr / ratio / allowlist / blocklist / phase
  - 定期 dump 到 JSON 文件 (快照)
  - 启动时从快照恢复, 防止重启丢规则
  - 版本号 + 校验和, 检测损坏
  - 写时锁 / 读时无锁快照
"""

import hashlib
import json
import logging
import os
import threading
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from enum import StrEnum

logger = logging.getLogger(__name__)


class CanaryPhase(StrEnum):
    OFF = "off"
    OBSERVE = "observe"
    CANARY = "canary"
    ROLLBACK = "rollback"
    FULL = "full"


@dataclass
class CanaryRule:
    name: str
    match_expr: str  # 简单 key=value 或正则
    ratio: float = 0.0  # 灰度比例 0~1
    allowlist: list[str] = field(default_factory=list)
    blocklist: list[str] = field(default_factory=list)
    phase: str = CanaryPhase.OBSERVE.value
    version: int = 0
    updated_at: float = 0.0
    updated_by: str = ""
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "CanaryRule":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class SnapshotRecord:
    ts: float
    version: int
    rule_count: int
    checksum: str
    path: str


class CanaryRuleStore:
    """灰度规则内存态 + 快照持久化."""

    def __init__(self, snapshot_dir: str = "", snapshot_interval_sec: float = 60.0):
        self._lock = threading.Lock()
        self._rules: dict[str, CanaryRule] = {}
        self._snapshot_dir = snapshot_dir
        self._snapshot_interval = snapshot_interval_sec
        self._version: int = 0
        self._last_snapshot: SnapshotRecord | None = None
        self._history: deque[SnapshotRecord] = deque(maxlen=50)
        if snapshot_dir and not os.path.exists(snapshot_dir):
            try:
                os.makedirs(snapshot_dir, exist_ok=True)
            except OSError:
                logger.warning("Caught unexpected exception")
        # 启动恢复
        if snapshot_dir:
            self._load_latest()

    def _latest_snapshot_path(self) -> str:
        assert self._snapshot_dir
        return os.path.join(self._snapshot_dir, "canary_rules_latest.json")

    def _archive_path(self) -> str:
        assert self._snapshot_dir
        return os.path.join(self._snapshot_dir, f"canary_rules_{int(time.time())}.json")

    def _compute_checksum(self, rules: list[dict]) -> str:
        body = json.dumps(rules, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(body.encode("utf-8")).hexdigest()

    def _load_latest(self) -> int:
        p = self._latest_snapshot_path()
        if not os.path.exists(p):
            return 0
        try:
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
            rules = data.get("rules", [])
            for r in rules:
                rule = CanaryRule.from_dict(r)
                self._rules[rule.name] = rule
            self._version = int(data.get("version", 0))
            self._last_snapshot = SnapshotRecord(
                ts=float(data.get("ts", 0.0)),
                version=self._version,
                rule_count=len(rules),
                checksum=data.get("checksum", ""),
                path=p,
            )
            logger.info("canary_loaded: version=%d rules=%d", self._version, len(rules))
            return len(rules)
        except (OSError, ValueError, KeyError) as e:
            logger.warning("canary snapshot load failed: %s", e)
            return 0

    def upsert(
        self,
        name: str,
        match_expr: str,
        ratio: float = 0.0,
        allowlist: list[str] | None = None,
        blocklist: list[str] | None = None,
        phase: str = CanaryPhase.OBSERVE.value,
        updated_by: str = "system",
        note: str = "",
    ) -> CanaryRule:
        with self._lock:
            old = self._rules.get(name)
            new = CanaryRule(
                name=name,
                match_expr=match_expr,
                ratio=max(0.0, min(1.0, ratio)),
                allowlist=allowlist or [],
                blocklist=blocklist or [],
                phase=phase,
                version=(old.version + 1) if old else 1,
                updated_at=time.time(),
                updated_by=updated_by,
                note=note,
            )
            self._rules[name] = new
            self._version += 1
            return new

    def remove(self, name: str) -> bool:
        with self._lock:
            existed = self._rules.pop(name, None) is not None
            if existed:
                self._version += 1
            return existed

    def get(self, name: str) -> CanaryRule | None:
        with self._lock:
            return self._rules.get(name)

    def list_all(self) -> list[CanaryRule]:
        with self._lock:
            return list(self._rules.values())

    def match(self, key: str, value: str) -> CanaryRule | None:
        """简单匹配: name=value 或 value in allowlist."""
        with self._lock:
            rules = list(self._rules.values())
        for r in rules:
            if r.phase == CanaryPhase.OFF.value:
                continue
            if value in r.blocklist:
                continue
            if value in r.allowlist:
                return r
            # 简单 key=value 形式: match_expr = "tag=blue"
            if "=" in r.match_expr:
                k, v = r.match_expr.split("=", 1)
                if k.strip() == key and v.strip() == value:
                    return r
        return None

    def snapshot(self, archive: bool = False) -> SnapshotRecord | None:
        """写快照到磁盘."""
        if not self._snapshot_dir:
            return None
        with self._lock:
            rules = [r.to_dict() for r in self._rules.values()]
            ver = self._version
            ts = time.time()
        chk = self._compute_checksum(rules)
        data = {
            "ts": ts,
            "version": ver,
            "rule_count": len(rules),
            "checksum": chk,
            "rules": rules,
        }
        # 写到 latest (临时文件 + rename 防半截写)
        latest = self._latest_snapshot_path()
        tmp = latest + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, latest)
        except OSError as e:
            logger.warning("canary snapshot write failed: %s", e)
            return None
        if archive:
            ap = self._archive_path()
            try:
                with open(ap, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            except OSError:
                logger.warning("Caught unexpected exception")
        rec = SnapshotRecord(ts=ts, version=ver, rule_count=len(rules), checksum=chk, path=latest)
        with self._lock:
            self._last_snapshot = rec
            self._history.append(rec)
        return rec

    def verify(self) -> dict[str, object]:
        """校验最新快照的 checksum."""
        if not self._snapshot_dir:
            return {"ok": True, "reason": "no_snapshot_dir"}
        p = self._latest_snapshot_path()
        if not os.path.exists(p):
            return {"ok": True, "reason": "no_snapshot"}
        try:
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
            rules = data.get("rules", [])
            chk = self._compute_checksum(rules)
            ok = chk == data.get("checksum", "")
            return {
                "ok": ok,
                "expected": data.get("checksum", ""),
                "actual": chk,
                "rule_count": len(rules),
            }
        except (OSError, ValueError) as e:
            return {"ok": False, "error": str(e)}

    def get_last_snapshot(self) -> SnapshotRecord | None:
        with self._lock:
            return self._last_snapshot

    def get_history(self) -> list[SnapshotRecord]:
        with self._lock:
            return list(self._history)

    def set_ratio(self, name: str, ratio: float, updated_by: str = "system") -> bool:
        with self._lock:
            r = self._rules.get(name)
            if r is None:
                return False
            r.ratio = max(0.0, min(1.0, ratio))
            r.version += 1
            r.updated_at = time.time()
            r.updated_by = updated_by
            self._version += 1
        return True

    def set_phase(self, name: str, phase: str, updated_by: str = "system") -> bool:
        with self._lock:
            r = self._rules.get(name)
            if r is None:
                return False
            r.phase = phase
            r.version += 1
            r.updated_at = time.time()
            r.updated_by = updated_by
            self._version += 1
        return True

    def stats(self) -> dict:
        with self._lock:
            by_phase: dict[str, int] = {}
            for r in self._rules.values():
                by_phase[r.phase] = by_phase.get(r.phase, 0) + 1
            return {
                "rule_count": len(self._rules),
                "version": self._version,
                "by_phase": by_phase,
                "last_snapshot": (
                    {
                        "ts": self._last_snapshot.ts,
                        "version": self._last_snapshot.version,
                        "checksum": self._last_snapshot.checksum[:16] + "...",
                    }
                    if self._last_snapshot
                    else None
                ),
                "snapshot_dir": self._snapshot_dir,
            }

    def clear(self) -> None:
        with self._lock:
            self._rules.clear()
            self._version = 0
            self._last_snapshot = None
            self._history.clear()


# 全局单例
canary_store = CanaryRuleStore()
