"""Bug-104: 大文件分片上传 / 断点续传 / 完整性校验.

设计:
  - 初始化上传会话: file_id, total_size, chunk_size, expected_hash (可选)
  - 上传分片: 顺序或乱序均可, 持久化到分片池
  - 完整性校验: 每分片 hash (md5) + 全文件 hash (sha256)
  - 合并分片: 验证完整性, 失败可重传
  - 状态机: INIT -> UPLOADING -> MERGING -> COMPLETED / FAILED
  - 断点续传: 报告已上传分片
"""

import hashlib
import io
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum

logger = logging.getLogger(__name__)


class UploadStatus(StrEnum):
    INIT = "init"
    UPLOADING = "uploading"
    MERGING = "merging"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


@dataclass
class ChunkInfo:
    index: int
    size: int
    md5: str
    received_at: float


@dataclass
class UploadSession:
    file_id: str
    file_name: str
    total_size: int
    chunk_size: int
    expected_sha256: str = ""
    status: UploadStatus = UploadStatus.INIT
    chunks: dict[int, ChunkInfo] = field(default_factory=dict)
    created_at: float = 0.0
    updated_at: float = 0.0
    merged_path: str = ""
    merged_sha256: str = ""
    error: str = ""

    def total_chunks(self) -> int:
        if self.chunk_size <= 0:
            return 0
        return (self.total_size + self.chunk_size - 1) // self.chunk_size

    def missing_chunks(self) -> list[int]:
        total = self.total_chunks()
        return [i for i in range(total) if i not in self.chunks]

    def to_dict(self) -> dict:
        d = {
            "file_id": self.file_id,
            "file_name": self.file_name,
            "total_size": self.total_size,
            "chunk_size": self.chunk_size,
            "expected_sha256": self.expected_sha256,
            "status": self.status.value,
            "chunks": {str(k): v.__dict__ for k, v in self.chunks.items()},
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "merged_path": self.merged_path,
            "merged_sha256": self.merged_sha256,
            "error": self.error,
        }
        return d


class ChunkedUploadManager:
    """分片上传管理器."""

    def __init__(self, storage_dir: str = "", session_ttl_sec: float = 3600.0):
        self._lock = threading.Lock()
        self._sessions: dict[str, UploadSession] = {}
        self._chunks_data: dict[str, dict[int, bytes]] = {}
        self._storage_dir = storage_dir
        self._ttl = session_ttl_sec
        self._last_gc = time.time()
        if storage_dir and not os.path.exists(storage_dir):
            try:
                os.makedirs(storage_dir, exist_ok=True)
            except OSError:
                logger.warning("Caught unexpected exception")

    def _now(self) -> float:
        return time.time()

    def _maybe_gc(self) -> None:
        now = self._now()
        if now - self._last_gc < 60.0:
            return
        self._last_gc = now
        expired: list[str] = []
        with self._lock:
            for fid, s in self._sessions.items():
                if now - s.updated_at > self._ttl:
                    s.status = UploadStatus.EXPIRED
                    expired.append(fid)
        for fid in expired:
            self.cleanup(fid)

    def init_session(
        self,
        file_id: str,
        file_name: str,
        total_size: int,
        chunk_size: int,
        expected_sha256: str = "",
    ) -> UploadSession:
        with self._lock:
            s = UploadSession(
                file_id=file_id,
                file_name=file_name,
                total_size=total_size,
                chunk_size=chunk_size,
                expected_sha256=expected_sha256,
                status=UploadStatus.UPLOADING,
                created_at=self._now(),
                updated_at=self._now(),
            )
            self._sessions[file_id] = s
            self._chunks_data[file_id] = {}
            return s

    def get_session(self, file_id: str) -> UploadSession | None:
        with self._lock:
            s = self._sessions.get(file_id)
            return s

    def get_resume_info(self, file_id: str) -> dict[str, object]:
        """断点续传信息: 已上传分片列表 + 缺失分片."""
        s = self.get_session(file_id)
        if s is None:
            return {"exists": False}
        with self._lock:
            received = sorted(self._chunks_data.get(file_id, {}).keys())
        return {
            "exists": True,
            "status": s.status.value,
            "received": received,
            "missing": s.missing_chunks(),
            "total_chunks": s.total_chunks(),
            "total_size": s.total_size,
            "chunk_size": s.chunk_size,
        }

    def upload_chunk(
        self,
        file_id: str,
        index: int,
        data: bytes,
        expected_md5: str = "",
    ) -> dict[str, object]:
        """上传一个分片."""
        self._maybe_gc()
        md5 = hashlib.md5(data).hexdigest()
        if expected_md5 and md5 != expected_md5:
            return {"ok": False, "error": "md5_mismatch", "computed": md5}
        with self._lock:
            s = self._sessions.get(file_id)
            if s is None:
                return {"ok": False, "error": "session_not_found"}
            if s.status not in (UploadStatus.UPLOADING,):
                return {"ok": False, "error": f"bad_status_{s.status.value}"}
            chunks = self._chunks_data.setdefault(file_id, {})
            chunks[index] = data
            s.chunks[index] = ChunkInfo(index=index, size=len(data), md5=md5, received_at=self._now())
            s.updated_at = self._now()
            return {
                "ok": True,
                "received": len(chunks),
                "total": s.total_chunks(),
                "missing": s.missing_chunks(),
            }

    def merge(
        self,
        file_id: str,
        expected_md5_per_chunk: dict[int, str] | None = None,
    ) -> dict[str, object]:
        """合并所有分片到最终文件, 校验完整性."""
        with self._lock:
            s = self._sessions.get(file_id)
            if s is None:
                return {"ok": False, "error": "session_not_found"}
            missing = s.missing_chunks()
            if missing:
                return {"ok": False, "error": "missing_chunks", "missing": missing}
            chunks = self._chunks_data.get(file_id, {})
            s.status = UploadStatus.MERGING
            s.updated_at = self._now()
            # 二次校验
            if expected_md5_per_chunk:
                for idx, info in s.chunks.items():
                    exp = expected_md5_per_chunk.get(idx)
                    if exp and exp != info.md5:
                        s.status = UploadStatus.FAILED
                        s.error = f"chunk_{idx}_md5_mismatch"
                        return {"ok": False, "error": s.error}
        # 合并 (锁外)
        try:
            h = hashlib.sha256()
            buf = io.BytesIO()
            for i in range(s.total_chunks()):
                data = chunks.get(i)
                if data is None:
                    s.status = UploadStatus.FAILED
                    s.error = f"chunk_{i}_missing_in_merge"
                    return {"ok": False, "error": s.error}
                buf.write(data)
                h.update(data)
            sha = h.hexdigest()
            out_path = ""
            if self._storage_dir:
                out_path = os.path.join(self._storage_dir, f"{file_id}_{s.file_name}")
                try:
                    with open(out_path, "wb") as f:
                        f.write(buf.getvalue())
                except OSError as e:
                    s.status = UploadStatus.FAILED
                    s.error = f"write_failed: {e}"
                    return {"ok": False, "error": s.error}
            else:
                out_path = f"in_mem://{file_id}_{s.file_name}"
            with self._lock:
                s.merged_path = out_path
                s.merged_sha256 = sha
                if s.expected_sha256 and sha != s.expected_sha256:
                    s.status = UploadStatus.FAILED
                    s.error = "final_sha256_mismatch"
                    return {
                        "ok": False,
                        "error": s.error,
                        "expected": s.expected_sha256,
                        "actual": sha,
                    }
                s.status = UploadStatus.COMPLETED
                s.updated_at = self._now()
            return {
                "ok": True,
                "path": out_path,
                "sha256": sha,
                "size": s.total_size,
            }
        except Exception as e:
            with self._lock:
                s.status = UploadStatus.FAILED
                s.error = f"{type(e).__name__}: {e}"
            return {"ok": False, "error": s.error}

    def cleanup(self, file_id: str) -> bool:
        with self._lock:
            s = self._sessions.pop(file_id, None)
            self._chunks_data.pop(file_id, None)
        if s is not None and s.merged_path and os.path.isfile(s.merged_path):
            try:
                os.remove(s.merged_path)
            except OSError:
                logger.warning("Caught unexpected exception")
        return s is not None

    def list_sessions(self) -> list[str]:
        with self._lock:
            return list(self._sessions.keys())

    def stats(self) -> dict:
        with self._lock:
            return {
                "session_count": len(self._sessions),
                "total_chunks_in_mem": sum(len(v) for v in self._chunks_data.values()),
                "by_status": {
                    st.value: sum(1 for s in self._sessions.values() if s.status == st) for st in UploadStatus
                },
            }

    def set_ttl(self, sec: float) -> None:
        with self._lock:
            self._ttl = max(0.0, sec)


# 全局单例
chunked_upload = ChunkedUploadManager()
