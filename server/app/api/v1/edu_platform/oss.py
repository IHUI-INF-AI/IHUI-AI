"""文件上传模块路由 - 迁移自旧 Java Spring Boot oss-service (2026-07-05).

包含: 文件上传/删除/转Base64.
文件保存到本地 uploads 目录, 返回可访问 URL.
"""
import base64
import os
import uuid

from fastapi import APIRouter, File, Query, UploadFile
from loguru import logger

from app.schemas.common import error, success

router = APIRouter()

# 上传文件根目录 (相对于 server 工作目录)
UPLOAD_ROOT = os.path.join(os.getcwd(), "uploads", "edu_platform")
# 允许的文件扩展名
ALLOWED_EXTENSIONS = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"},
    "video": {".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv"},
    "doc": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md"},
    "audio": {".mp3", ".wav", ".aac", ".flac", ".ogg"},
}
# 文件大小限制 (字节)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _ensure_dir(path: str) -> None:
    """确保目录存在."""
    os.makedirs(path, exist_ok=True)


def _get_file_ext(filename: str) -> str:
    """获取文件扩展名(小写)."""
    return os.path.splitext(filename)[1].lower()


def _validate_file_type(filename: str, file_type: str) -> bool:
    """校验文件类型."""
    ext = _get_file_ext(filename)
    allowed = ALLOWED_EXTENSIONS.get(file_type, set())
    if not allowed:
        return True
    return ext in allowed


@router.post("/auth-api/{service}/{module}/{fileType}", summary="上传文件")
async def upload_file(
    service: str,
    module: str,
    fileType: str,
    file: UploadFile = File(..., description="文件"),
):
    try:
        if not file or not file.filename:
            return error("文件不能为空", "400")

        if not _validate_file_type(file.filename, fileType):
            return error(f"不支持的文件类型: {fileType}", "400")

        ext = _get_file_ext(file.filename)
        new_filename = f"{uuid.uuid4().hex}{ext}"
        save_dir = os.path.join(UPLOAD_ROOT, service, module, fileType)
        _ensure_dir(save_dir)
        save_path = os.path.join(save_dir, new_filename)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            return error(f"文件大小超过限制({MAX_FILE_SIZE // 1024 // 1024}MB)", "400")

        with open(save_path, "wb") as f:
            f.write(content)

        # 返回相对路径作为 URL
        relative_url = f"/uploads/edu_platform/{service}/{module}/{fileType}/{new_filename}"
        logger.info(f"[edu oss] file uploaded: {relative_url}")
        return success(
            {
                "url": relative_url,
                "filename": file.filename,
                "size": len(content),
                "fileType": fileType,
                "service": service,
                "module": module,
            }
        )
    except Exception as e:
        logger.error(f"[edu oss] upload file error: {e}")
        return error(str(e))


@router.delete("/file", summary="删除文件")
async def delete_file(url: str = Query(..., description="文件URL路径")):
    try:
        if not url:
            return error("文件URL不能为空", "400")
        # 安全检查: 只允许删除 uploads/edu_platform 下的文件
        if ".." in url or "edu_platform" not in url:
            return error("非法文件路径", "400")
        # 将 URL 路径转换为本地文件路径
        if url.startswith("/uploads/"):
            file_path = os.path.join(os.getcwd(), url.lstrip("/").replace("/", os.sep))
        else:
            file_path = os.path.join(UPLOAD_ROOT, os.path.basename(url))

        if not os.path.exists(file_path):
            return error("文件不存在", "404")

        os.remove(file_path)
        logger.info(f"[edu oss] file deleted: {url}")
        return success({"url": url, "deleted": True})
    except Exception as e:
        logger.error(f"[edu oss] delete file error: {e}")
        return error(str(e))


@router.get("/to-base64", summary="转Base64")
async def to_base64(url: str = Query(..., description="文件URL路径")):
    try:
        if not url:
            return error("文件URL不能为空", "400")
        if ".." in url:
            return error("非法文件路径", "400")

        if url.startswith("/uploads/"):
            file_path = os.path.join(os.getcwd(), url.lstrip("/").replace("/", os.sep))
        else:
            file_path = os.path.join(UPLOAD_ROOT, os.path.basename(url))

        if not os.path.exists(file_path):
            return error("文件不存在", "404")

        with open(file_path, "rb") as f:
            content = f.read()

        ext = _get_file_ext(file_path)
        mime_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
            ".svg": "image/svg+xml",
            ".pdf": "application/pdf",
            ".mp4": "video/mp4",
            ".mp3": "audio/mpeg",
            ".txt": "text/plain",
            ".json": "application/json",
        }
        mime_type = mime_map.get(ext, "application/octet-stream")
        b64 = base64.b64encode(content).decode("utf-8")
        data_uri = f"data:{mime_type};base64,{b64}"

        return success(
            {
                "base64": data_uri,
                "size": len(content),
                "mime_type": mime_type,
            }
        )
    except Exception as e:
        logger.error(f"[edu oss] to base64 error: {e}")
        return error(str(e))
