"""对象存储抽象层 -- 支持阿里云 OSS / AWS S3 / 本地回退.

约定:
  - upload_bytes(key, data) -> bool
  - presigned_url(key, expires) -> str | None
  - exists(key) -> bool
  - delete(key) -> bool
"""

import os
from pathlib import Path

from app.config import settings


class BaseStorage:
    """存储基类."""

    def upload_bytes(self, key: str, data: bytes) -> bool: ...
    def presigned_url(self, key: str, expires: int = 3600) -> str | None: ...
    def exists(self, key: str) -> bool: ...
    def delete(self, key: str) -> bool: ...


class LocalStorage(BaseStorage):
    """本地磁盘回退 -- 适合开发 / 单机部署."""

    def __init__(self, base_dir: str):
        self.base = Path(base_dir)
        self.base.mkdir(parents=True, exist_ok=True)

    def _abs(self, key: str) -> Path:
        # 防止路径穿越: 拒绝 ".."
        if ".." in key or key.startswith("/"):
            raise ValueError(f"非法 key: {key}")
        return self.base / key

    def upload_bytes(self, key: str, data: bytes) -> bool:
        try:
            p = self._abs(key)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
            return True
        except Exception:
            return False

    def presigned_url(self, key: str, expires: int = 3600) -> str | None:
        # 本地没有签名, 直接返回相对于 STATIC 的路径
        return f"/static/storage/{key}"

    def exists(self, key: str) -> bool:
        return self._abs(key).exists()

    def delete(self, key: str) -> bool:
        try:
            self._abs(key).unlink(missing_ok=True)
            return True
        except Exception:
            return False


class AliyunOssStorage(BaseStorage):
    """阿里云 OSS -- 通过 oss2 SDK."""

    def __init__(self, endpoint: str, access_key_id: str, access_key_secret: str, bucket: str):
        try:
            import oss2

            self._oss2 = oss2
            self.auth = oss2.Auth(access_key_id, access_key_secret)
            self.bucket = oss2.Bucket(self.auth, endpoint, bucket)
        except ImportError:
            raise ImportError("请先 pip install oss2") from None

    def upload_bytes(self, key: str, data: bytes) -> bool:
        try:
            self.bucket.put_object(key, data)
            return True
        except Exception:
            return False

    def presigned_url(self, key: str, expires: int = 3600) -> str | None:
        try:
            return self.bucket.sign_url("GET", key, expires)
        except Exception:
            return None

    def exists(self, key: str) -> bool:
        try:
            return self.bucket.object_exists(key)
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        try:
            self.bucket.delete_object(key)
            return True
        except Exception:
            return False


class AwsS3Storage(BaseStorage):
    """AWS S3 -- 通过 boto3."""

    def __init__(self, endpoint: str, access_key_id: str, access_key_secret: str, bucket: str):
        try:
            import boto3

            self.s3 = boto3.client(
                "s3",
                endpoint_url=f"https://{endpoint}" if not endpoint.startswith("http") else endpoint,
                aws_access_key_id=access_key_id,
                aws_secret_access_key=access_key_secret,
            )
            self.bucket = bucket
        except ImportError:
            raise ImportError("请先 pip install boto3") from None

    def upload_bytes(self, key: str, data: bytes) -> bool:
        try:
            self.s3.put_object(Bucket=self.bucket, Key=key, Body=data)
            return True
        except Exception:
            return False

    def presigned_url(self, key: str, expires: int = 3600) -> str | None:
        try:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires,
            )
        except Exception:
            return None

    def exists(self, key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


# ---------- 单例工厂 ----------
_storage: BaseStorage | None = None


def get_storage() -> BaseStorage:
    """根据环境变量自动选择存储后端."""
    global _storage
    if _storage is not None:
        return _storage
    backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if backend == "aliyun" and settings.OSS_ACCESS_KEY_ID and settings.OSS_BUCKET:
        _storage = AliyunOssStorage(
            endpoint=settings.OSS_ENDPOINT,
            access_key_id=settings.OSS_ACCESS_KEY_ID,
            access_key_secret=settings.OSS_ACCESS_KEY_SECRET,
            bucket=settings.OSS_BUCKET,
        )
    elif backend == "s3" and settings.OSS_ACCESS_KEY_ID and settings.OSS_BUCKET:
        _storage = AwsS3Storage(
            endpoint=settings.OSS_ENDPOINT,
            access_key_id=settings.OSS_ACCESS_KEY_ID,
            access_key_secret=settings.OSS_ACCESS_KEY_SECRET,
            bucket=settings.OSS_BUCKET,
        )
    else:
        # 默认: 本地回退 (使用 VIDEO_ROOT 目录, 但归到 storage 子目录)
        storage_dir = Path(settings.VIDEO_ROOT) / "storage" if settings.VIDEO_ROOT else Path("./storage")
        _storage = LocalStorage(str(storage_dir))
    return _storage


def reset_storage() -> None:
    """测试用: 重新选择存储后端."""
    global _storage
    _storage = None
