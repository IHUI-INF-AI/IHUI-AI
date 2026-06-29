"""Bug-62: 大文件上传断点续传.

协议:
  HEAD/GET  /upload/init?hash=xxx&filename=yyy&size=zzz
    → 返回 {upload_id, already_uploaded, chunk_size, total_chunks, status}
       - already_uploaded > 0: 客户端可断点续传
       - status="completed": 秒传 (hash 已存在)
  POST /upload/chunk?upload_id=xxx&offset=nn&index=k
    Body: 二进制 (建议 ChunkSize = 4MB)
    → 返回 {received, total_received, percent}
  POST /upload/finish?upload_id=xxx
    → 后端合并分片, 验证 hash, 触发业务回调
  GET /upload/status?upload_id=xxx
    → 返回当前上传状态

存储:
  - Redis Hash: zhs:upload:meta:<upload_id> → {hash, filename, size, chunks, status, created_at}
  - 本地 tmp dir: tmp_dir/<upload_id>/<index> (分片文件)
  - 完成后合并到 target_dir/<hash>.<ext>
"""

import hashlib
import json
import logging
import os
import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024  # 4MB
DEFAULT_TMP_DIR = os.environ.get("UPLOAD_TMP_DIR", "tmp_uploads")
DEFAULT_TARGET_DIR = os.environ.get("UPLOAD_TARGET_DIR", "uploads")
META_TTL_SEC = 7 * 24 * 3600  # 7 天


@dataclass
class UploadSession:
    upload_id: str
    file_hash: str
    filename: str
    size: int
    chunk_size: int
    total_chunks: int
    status: str = "uploading"  # uploading / completed / failed
    received_chunks: dict[int, int] = field(default_factory=dict)  # index -> bytes
    created_at: float = field(default_factory=time.time)
    completed_at: float | None = None
    final_path: str | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return {
            "upload_id": self.upload_id,
            "hash": self.file_hash,
            "filename": self.filename,
            "size": self.size,
            "chunk_size": self.chunk_size,
            "total_chunks": self.total_chunks,
            "status": self.status,
            "received_bytes": sum(self.received_chunks.values()),
            "received_chunks": sorted(self.received_chunks.keys()),
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "final_path": self.final_path,
            "error": self.error,
        }


# 进程内 fallback (Redis 不可用时)
_memory_store: dict[str, dict] = {}
_memory_lock = threading.Lock()


def _get_redis():
    try:
        from app.utils.redis_client import get_redis

        return get_redis()
    except Exception as e:
        logger.debug(f"upload_session redis unavailable: {e}")
        return None


def _meta_key(upload_id: str) -> str:
    return f"zhs:upload:meta:{upload_id}"


def _hash_key(file_hash: str) -> str:
    return f"zhs:upload:hash:{file_hash}"


def _memory_get(key: str) -> str | None:
    with _memory_lock:
        v = _memory_store.get(key)
        return v if isinstance(v, str) else None


def _memory_set(key: str, val: str, ex: int | None = None) -> None:
    with _memory_lock:
        _memory_store[key] = val  # type: ignore[assignment]


def _memory_delete(*keys: str) -> None:
    with _memory_lock:
        for k in keys:
            _memory_store.pop(k, None)


def _load_session(upload_id: str) -> UploadSession | None:
    r = _get_redis()
    raw: str | None = None
    if r is not None:
        try:
            raw = r.get(_meta_key(upload_id))
        except Exception as e:
            logger.debug(f"load_session({upload_id}) redis fail: {e}")
            raw = None
    if raw is None:
        raw = _memory_get(_meta_key(upload_id))
    if not raw:
        return None
    try:
        data = json.loads(raw)
        sess = UploadSession(
            upload_id=data["upload_id"],
            file_hash=data["file_hash"],
            filename=data["filename"],
            size=int(data["size"]),
            chunk_size=int(data["chunk_size"]),
            total_chunks=int(data["total_chunks"]),
            status=data.get("status", "uploading"),
            received_chunks={int(k): int(v) for k, v in data.get("received_chunks", {}).items()},
            created_at=float(data.get("created_at", 0)),
            completed_at=data.get("completed_at"),
            final_path=data.get("final_path"),
            error=data.get("error"),
        )
        return sess
    except Exception as e:
        logger.debug(f"load_session({upload_id}) parse fail: {e}")
        return None


def _save_session(sess: UploadSession) -> None:
    r = _get_redis()
    data = {
        "upload_id": sess.upload_id,
        "file_hash": sess.file_hash,
        "filename": sess.filename,
        "size": sess.size,
        "chunk_size": sess.chunk_size,
        "total_chunks": sess.total_chunks,
        "status": sess.status,
        "received_chunks": {str(k): v for k, v in sess.received_chunks.items()},
        "created_at": sess.created_at,
        "completed_at": sess.completed_at,
        "final_path": sess.final_path,
        "error": sess.error,
    }
    payload = json.dumps(data, ensure_ascii=False)
    if r is not None:
        try:
            key = _meta_key(sess.upload_id)
            r.set(key, payload, ex=META_TTL_SEC)
            # hash 反向索引 (用于秒传)
            r.set(_hash_key(sess.file_hash), sess.upload_id, ex=META_TTL_SEC)
        except Exception as e:
            logger.debug(f"save_session({sess.upload_id}) redis fail: {e}")
    # 内存兜底 (始终写)
    _memory_set(_meta_key(sess.upload_id), payload)
    _memory_set(_hash_key(sess.file_hash), sess.upload_id)


# ---------------------------------------------------------------------------
# 初始化
# ---------------------------------------------------------------------------


def init_upload(
    file_hash: str,
    filename: str,
    size: int,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> dict:
    """初始化 / 恢复上传会话.

    Returns:
        dict: {upload_id, already_uploaded, chunk_size, total_chunks, status, fast_upload}
    """
    # 1) 查 hash: 已存在 → 秒传
    r = _get_redis()
    existing_id: str | None = None
    if r is not None:
        try:
            existing_id = r.get(_hash_key(file_hash))
        except Exception as e:
            logger.debug(f"init_upload hash check redis fail: {e}")
    if existing_id is None:
        existing_id = _memory_get(_hash_key(file_hash))
    if existing_id:
        existing = _load_session(existing_id)
        if existing and existing.status == "completed" and existing.final_path and os.path.exists(existing.final_path):
            # 检查文件是否还在
            return {
                "upload_id": existing.upload_id,
                "already_uploaded": existing.size,
                "chunk_size": existing.chunk_size,
                "total_chunks": existing.total_chunks,
                "status": "completed",
                "fast_upload": True,
                "final_path": existing.final_path,
            }
    # 2) 新建会话
    upload_id = uuid.uuid4().hex
    total_chunks = max(1, (size + chunk_size - 1) // chunk_size)
    sess = UploadSession(
        upload_id=upload_id,
        file_hash=file_hash,
        filename=filename,
        size=size,
        chunk_size=chunk_size,
        total_chunks=total_chunks,
    )
    os.makedirs(os.path.join(DEFAULT_TMP_DIR, upload_id), exist_ok=True)
    _save_session(sess)
    return {
        "upload_id": upload_id,
        "already_uploaded": 0,
        "chunk_size": chunk_size,
        "total_chunks": total_chunks,
        "status": "uploading",
        "fast_upload": False,
    }


# ---------------------------------------------------------------------------
# 接收分片
# ---------------------------------------------------------------------------


def save_chunk(
    upload_id: str,
    index: int,
    data: bytes,
) -> dict:
    """保存一个分片到磁盘 + 更新元数据.

    Returns:
        dict: {received, total_received, percent, missing_chunks}
    """
    sess = _load_session(upload_id)
    if sess is None:
        return {"error": "upload_not_found"}
    if sess.status == "completed":
        return {
            "received": 0,
            "total_received": sess.size,
            "percent": 100,
            "status": "completed",
        }
    if index < 0 or index >= sess.total_chunks:
        return {"error": f"invalid_chunk_index:{index}"}
    # 写文件
    chunk_path = os.path.join(DEFAULT_TMP_DIR, upload_id, f"{index:06d}.part")
    try:
        with open(chunk_path, "wb") as f:
            f.write(data)
    except Exception as e:
        return {"error": f"write_fail:{e}"}
    # 更新元数据
    sess.received_chunks[index] = len(data)
    _save_session(sess)
    total_received = sum(sess.received_chunks.values())
    missing = [i for i in range(sess.total_chunks) if i not in sess.received_chunks]
    return {
        "received": len(data),
        "total_received": total_received,
        "percent": round(total_received / max(1, sess.size) * 100, 2),
        "missing_chunks": missing[:50],
    }


# ---------------------------------------------------------------------------
# 完成合并
# ---------------------------------------------------------------------------


def finish_upload(
    upload_id: str,
    expected_hash: str | None = None,
    target_dir: str | None = None,
) -> dict:
    """合并分片到目标路径, 校验 hash.

    Returns:
        dict: {status, final_path, hash, size}
    """
    sess = _load_session(upload_id)
    if sess is None:
        return {"error": "upload_not_found"}
    if sess.status == "completed" and sess.final_path:
        return {
            "status": "completed",
            "final_path": sess.final_path,
            "hash": sess.file_hash,
            "size": sess.size,
        }
    # 检查完整性
    if len(sess.received_chunks) < sess.total_chunks:
        missing = [i for i in range(sess.total_chunks) if i not in sess.received_chunks]
        return {
            "error": "chunks_missing",
            "missing_chunks": missing,
            "received": len(sess.received_chunks),
            "total": sess.total_chunks,
        }
    # 合并
    target_dir = target_dir or DEFAULT_TARGET_DIR
    ext = os.path.splitext(sess.filename)[1]
    final_name = f"{sess.file_hash}{ext}"
    final_path = os.path.join(target_dir, final_name)
    os.makedirs(target_dir, exist_ok=True)
    sha = hashlib.sha256()
    try:
        with open(final_path, "wb") as out:
            for i in range(sess.total_chunks):
                chunk_path = os.path.join(DEFAULT_TMP_DIR, upload_id, f"{i:06d}.part")
                with open(chunk_path, "rb") as f:
                    while True:
                        buf = f.read(64 * 1024)
                        if not buf:
                            break
                        out.write(buf)
                        sha.update(buf)
        actual_hash = sha.hexdigest()
        if expected_hash and actual_hash != expected_hash:
            sess.status = "failed"
            sess.error = f"hash_mismatch:expected={expected_hash[:12]}_actual={actual_hash[:12]}"
            _save_session(sess)
            # 删除错误文件
            try:
                os.remove(final_path)
            except Exception:
                logger.warning("Caught unexpected exception")
            return {"error": sess.error, "expected": expected_hash, "actual": actual_hash}
        sess.status = "completed"
        sess.completed_at = time.time()
        sess.final_path = final_path
        sess.size = os.path.getsize(final_path)
        _save_session(sess)
        # 清理分片
        try:
            shutil.rmtree(os.path.join(DEFAULT_TMP_DIR, upload_id))
        except Exception:
            logger.warning("Caught unexpected exception")
        return {
            "status": "completed",
            "final_path": final_path,
            "hash": actual_hash,
            "size": sess.size,
        }
    except Exception as e:
        sess.status = "failed"
        sess.error = f"merge_fail:{e}"
        _save_session(sess)
        return {"error": sess.error}


# ---------------------------------------------------------------------------
# 状态 / 取消
# ---------------------------------------------------------------------------


def get_status(upload_id: str) -> dict | None:
    sess = _load_session(upload_id)
    if sess is None:
        return None
    return sess.to_dict()


def cancel_upload(upload_id: str) -> bool:
    """取消上传, 清理分片."""
    sess = _load_session(upload_id)
    if sess is None:
        return False
    try:
        shutil.rmtree(os.path.join(DEFAULT_TMP_DIR, upload_id), ignore_errors=True)
    except Exception:
        logger.warning("Caught unexpected exception")
    r = _get_redis()
    if r is not None:
        try:
            r.delete(_meta_key(upload_id))
        except Exception:
            logger.warning("Caught unexpected exception")
    _memory_delete(_meta_key(upload_id))
    return True


# ---------------------------------------------------------------------------
# Hash 工具
# ---------------------------------------------------------------------------


def compute_hash(data: bytes, algo: str = "sha256") -> str:
    if algo == "md5":
        return hashlib.md5(data).hexdigest()
    return hashlib.sha256(data).hexdigest()


async def compute_hash_streaming(
    source: Any,
    chunk_size: int = 64 * 1024,
    algo: str = "sha256",
) -> str:
    """对异步流 (UploadFile.read) 计算 hash.

    Args:
        source: 有 async read(chunk_size) 的对象
    """
    h = hashlib.new(algo)
    while True:
        buf = await source.read(chunk_size)
        if not buf:
            break
        h.update(buf)
    return h.hexdigest()
