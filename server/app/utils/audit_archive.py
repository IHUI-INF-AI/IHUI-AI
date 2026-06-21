"""Bug-80: 审计链离线归档.

设计:
  - 审计链持续追加 (Bug-72), 长期会膨胀
  - 定期将老条目 (按 seq 区间或时间窗口) 归档到独立文件
  - 归档后主链只保留热数据 (近 N 天)
  - 归档文件以 hash chain 形式独立, 可独立校验
  - 提供 restore 机制 (合规审计时回放归档段)

使用:
    from app.utils.audit_archive import audit_archiver

    archived = audit_archiver.archive_range(start_seq=1, end_seq=1000, reason="monthly")
    entries = audit_archiver.read_archive("audit_archive_2026_06.jsonl")
    ok = audit_archiver.verify_archive("audit_archive_2026_06.jsonl")
"""

import gzip
import json
import logging
import os
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_ARCHIVE_DIR = os.environ.get("ZHS_AUDIT_DIR", "audit")
DEFAULT_KEEP_HOT = 5000


@dataclass
class ArchiveInfo:
    path: str
    start_seq: int
    end_seq: int
    entry_count: int
    created_at: float = field(default_factory=time.time)
    reason: str = ""
    first_hash: str = ""
    last_hash: str = ""
    size_bytes: int = 0
    compressed: bool = False

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "start_seq": self.start_seq,
            "end_seq": self.end_seq,
            "entry_count": self.entry_count,
            "created_at": round(self.created_at, 3),
            "reason": self.reason,
            "first_hash": self.first_hash,
            "last_hash": self.last_hash,
            "size_bytes": self.size_bytes,
            "compressed": self.compressed,
        }


class AuditArchiver:
    """审计链归档器."""

    def __init__(self, archive_dir: str = DEFAULT_ARCHIVE_DIR, keep_hot: int = DEFAULT_KEEP_HOT):
        self._archive_dir = archive_dir
        self._keep_hot = keep_hot
        self._archives: dict[str, ArchiveInfo] = {}
        self._total_archived = 0
        self._total_archives = 0

    def _ensure_dir(self) -> None:
        os.makedirs(self._archive_dir, exist_ok=True)

    def _archive_filename(self, created_at: float, reason: str) -> str:
        ts = time.strftime("%Y%m%d_%H%M%S", time.localtime(created_at))
        safe_reason = "".join(c for c in reason if c.isalnum() or c in ("_", "-"))[:32]
        return f"audit_archive_{ts}_{safe_reason}.jsonl"

    def archive_range(
        self,
        entries: list[dict],
        start_seq: int,
        end_seq: int,
        reason: str = "manual",
        compress: bool = False,
    ) -> ArchiveInfo:
        """把 [start_seq, end_seq] 范围的 entries 归档到文件."""
        self._ensure_dir()
        now = time.time()
        path = os.path.join(self._archive_dir, self._archive_filename(now, reason))
        first_hash = entries[0]["hash"] if entries else ""
        last_hash = entries[-1]["hash"] if entries else ""

        # 写入 (按 hash chain 顺序)
        body = "\n".join(json.dumps(e, ensure_ascii=False, sort_keys=True) for e in entries)
        if compress:
            path = path + ".gz"
            with gzip.open(path, "wt", encoding="utf-8") as f:
                f.write(body)
        else:
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)

        size = os.path.getsize(path)
        info = ArchiveInfo(
            path=path,
            start_seq=start_seq,
            end_seq=end_seq,
            entry_count=len(entries),
            created_at=now,
            reason=reason,
            first_hash=first_hash,
            last_hash=last_hash,
            size_bytes=size,
            compressed=compress,
        )
        self._archives[path] = info
        self._total_archives += 1
        self._total_archived += len(entries)
        logger.info(f"audit_archive: archived {len(entries)} entries [{start_seq}-{end_seq}] to {path}")
        return info

    def archive_older_than(self, audit_chain, before_ts: float, reason: str = "age") -> ArchiveInfo:
        """把 audit_chain 中 ts < before_ts 的条目归档."""

        entries = []
        # 假设 audit_chain 提供 entries / _entries / 类似接口
        raw = getattr(audit_chain, "_entries", None) or getattr(audit_chain, "entries", None)
        if raw is None:
            raise ValueError("audit_chain must expose _entries or entries")
        for e in raw:
            ts = getattr(e, "ts", 0.0)
            if ts < before_ts:
                entries.append(e.to_dict() if hasattr(e, "to_dict") else dict(e.__dict__))
        if not entries:
            return ArchiveInfo(path="", start_seq=0, end_seq=0, entry_count=0, reason=reason)
        start = entries[0]["seq"]
        end = entries[-1]["seq"]
        info = self.archive_range(entries, start, end, reason=reason)
        # 归档后从主链中删除 (如果 chain 提供 drop 接口)
        drop_fn = getattr(audit_chain, "drop_before", None)
        if callable(drop_fn):
            try:
                drop_fn(before_ts)
            except Exception:
                logger.warning("Caught unexpected exception")
        return info

    def read_archive(self, path: str) -> list[dict]:
        if not os.path.isabs(path):
            path = os.path.join(self._archive_dir, path)
        if not os.path.exists(path):
            return []
        opener = gzip.open if path.endswith(".gz") else open
        out = []
        try:
            with opener(path, "rt", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        out.append(json.loads(line))
                    except Exception:
                        continue
        except Exception as e:
            logger.error(f"audit_archive: read {path} fail: {e!r}")
        return out

    def verify_archive(self, path: str) -> bool:
        """独立校验归档的 hash chain.

        重新计算每个 entry 的 hash 并与 entry["hash"] 字段比对,
        同时校验 prev_hash 链链接. 任何不一致都视为篡改.
        """
        import hashlib

        entries = self.read_archive(path)
        prev = "0" * 64
        for e in entries:
            expected_prev = e.get("prev_hash", "")
            if expected_prev != prev:
                logger.warning(f"audit_archive: {path} chain break at seq={e.get('seq')} prev_hash mismatch")
                return False
            # 重新计算 hash: sha256(prev_hash + canonical_json(entry_without_hash))
            payload = {k: v for k, v in e.items() if k not in ("hash", "prev_hash")}
            canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=("", ":"))
            h = hashlib.sha256()
            h.update(prev.encode("utf-8"))
            h.update(canonical.encode("utf-8"))
            expected_hash = h.hexdigest()
            if e.get("hash", "") != expected_hash:
                logger.warning(
                    f"audit_archive: {path} tamper at seq={e.get('seq')} "
                    f"expected={expected_hash} got={e.get('hash', '')}"
                )
                return False
            prev = e.get("hash", "")
        return True

    def list_archives(self) -> list[dict]:
        with_meta = [a.to_dict() for a in self._archives.values()]
        # 扫描磁盘上未在内存注册的
        if not os.path.isdir(self._archive_dir):
            return with_meta
        for f in sorted(os.listdir(self._archive_dir)):
            if not (f.startswith("audit_archive_") and f.endswith((".jsonl", ".jsonl.gz"))):
                continue
            full = os.path.join(self._archive_dir, f)
            if full in self._archives:
                continue
            self._archives[full] = ArchiveInfo(
                path=full,
                start_seq=0,
                end_seq=0,
                entry_count=0,
                reason="discovered",
                size_bytes=os.path.getsize(full),
                compressed=f.endswith(".gz"),
            )
            with_meta.append(self._archives[full].to_dict())
        return with_meta

    def delete_archive(self, path: str) -> bool:
        if not os.path.isabs(path):
            path = os.path.join(self._archive_dir, path)
        try:
            if os.path.exists(path):
                os.remove(path)
            self._archives.pop(path, None)
            return True
        except Exception as e:
            logger.error(f"audit_archive: delete {path} fail: {e!r}")
            return False

    def stats(self) -> dict:
        return {
            "archive_dir": self._archive_dir,
            "keep_hot": self._keep_hot,
            "total_archives": self._total_archives,
            "total_archived": self._total_archived,
            "in_memory_archives": len(self._archives),
        }


# 全局单例
audit_archiver = AuditArchiver()
