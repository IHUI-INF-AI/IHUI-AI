"""MinIO file storage utility.

自动降级: 当 MinIO 不可用时, 自动切换到本地文件存储 (local_uploads/),
无需手动启动 MinIO 服务, 项目即可正常运行.
"""

import io
import logging
import os
import uuid
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_client = None
_use_local = False
_LOCAL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "local_uploads")


def _try_connect_minio():
    """尝试连接 MinIO, 失败则降级到本地文件存储."""
    global _client, _use_local
    try:
        from minio import Minio

        _client = Minio(
            settings.MINIO_URL.replace("http://", "").replace("https://", ""),
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_URL.startswith("https"),
        )
        # 测试连接
        _client.list_buckets()
        logger.info("MinIO connected: %s", settings.MINIO_URL)
        _use_local = False
    except Exception as e:
        # 生产环境: MinIO 不可用则直接报错, 不允许降级
        if settings.ENV.lower() in ("production", "prod"):
            logger.error("MinIO is required in production but unavailable: %s", e)
            raise RuntimeError(f"MinIO connection failed: {e}") from e
        logger.warning("MinIO unavailable (%s), falling back to local storage", e)
        os.makedirs(_LOCAL_DIR, exist_ok=True)
        _use_local = True
        logger.info("Local file storage: %s", os.path.abspath(_LOCAL_DIR))


def get_minio_client():
    global _client
    if _client is None and not _use_local:
        _try_connect_minio()
    return _client


def ensure_bucket(bucket: str | None = None):
    if _use_local:
        return
    bucket = bucket or settings.MINIO_BUCKET
    client = get_minio_client()
    if client and not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def upload_file(
    file_data: bytes,
    file_name: str,
    content_type: str = "application/octet-stream",
    bucket: str | None = None,
) -> str:
    if _use_local:
        return _local_upload(file_data, file_name)
    bucket = bucket or settings.MINIO_BUCKET
    ensure_bucket(bucket)
    client = get_minio_client()
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    object_name = f"{uuid.uuid4().hex}.{ext}"
    data = io.BytesIO(file_data)
    client.put_object(bucket, object_name, data, len(file_data), content_type=content_type)
    url = f"{settings.MINIO_FILE_URL}/{bucket}/{object_name}"
    logger.info(f"Uploaded {file_name} -> {url}")
    return url


def _local_upload(file_data: bytes, file_name: str) -> str:
    """本地文件存储 fallback."""
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    saved_name = f"{uuid.uuid4().hex}.{ext}"
    saved_path = os.path.join(_LOCAL_DIR, saved_name)
    with open(saved_path, "wb") as f:
        f.write(file_data)
    url = f"/local_uploads/{saved_name}"
    logger.info(f"Local upload {file_name} -> {url}")
    return url


def upload_file_from_path(file_path: str, object_name: str | None = None, bucket: str | None = None) -> str:
    if _use_local:
        with open(file_path, "rb") as f:
            return _local_upload(f.read(), os.path.basename(file_path))
    bucket = bucket or settings.MINIO_BUCKET
    ensure_bucket(bucket)
    client = get_minio_client()
    if not object_name:
        object_name = f"{uuid.uuid4().hex}"
    client.fput_object(bucket, object_name, file_path)
    url = f"{settings.MINIO_FILE_URL}/{bucket}/{object_name}"
    return url


def delete_file(object_name: str, bucket: str | None = None) -> bool:
    if _use_local:
        path = os.path.join(_LOCAL_DIR, object_name)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
    bucket = bucket or settings.MINIO_BUCKET
    try:
        get_minio_client().remove_object(bucket, object_name)
        return True
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        return False


def get_file_url(object_name: str, bucket: str | None = None) -> str:
    if _use_local:
        return f"/local_uploads/{object_name}"
    bucket = bucket or settings.MINIO_BUCKET
    return f"{settings.MINIO_FILE_URL}/{bucket}/{object_name}"


async def upload_bytes(
    file_data: bytes,
    file_name: str,
    content_type: str = "application/octet-stream",
    bucket: str | None = None,
) -> str:
    """异步上传字节数据到 MinIO（MinIO SDK 是同步的，所以放线程池里跑）.

    供 suno_service、tts_stream 等模块使用。
    """
    import asyncio
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, lambda: upload_file(file_data, file_name, content_type, bucket)
    )


async def upload_from_url(
    url: str,
    file_name: Optional[str] = None,
    content_type: str = "application/octet-stream",
    bucket: str | None = None,
    timeout: float = 60.0,
) -> str:
    """异步下载远程文件并上传到 MinIO.

    Args:
        url: 远程文件 URL
        file_name: 指定文件名, 默认从 URL 提取
        content_type: 内容类型
        bucket: 存储桶
        timeout: 下载超时

    Returns:
        MinIO 上的可访问 URL
    """
    if not url:
        return ""
    if file_name is None:
        url_path = url.split("?")[0].split("/")[-1] or "file"
        file_name = url_path
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.content
            if not content_type or content_type == "application/octet-stream":
                ct = resp.headers.get("content-type", "").split(";")[0].strip()
                if ct:
                    content_type = ct
        return await upload_bytes(data, file_name, content_type, bucket)
    except Exception as e:
        logger.warning(f"upload_from_url 失败 ({url}): {e}")
        return url  # 降级返回原 URL

