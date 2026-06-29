# File download/upload utilities ported from P3 token_utils.py
import mimetypes
from pathlib import Path

import httpx
from loguru import logger

from app.config import settings

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB limit


async def download_file_from_url(url: str) -> bytes | None:
    try:
        logger.info("Downloading file: " + url)
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}
        timeout = httpx.Timeout(60.0)
        async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        content_length = len(resp.content)
        if content_length > MAX_FILE_SIZE:
            logger.warning("File too large: " + str(content_length) + " bytes, max: " + str(MAX_FILE_SIZE))
            return None
        logger.info("Download OK: " + str(content_length) + " bytes")
        return resp.content
    except httpx.TimeoutException:
        logger.error("Download timeout: " + url)
        return None
    except httpx.HTTPStatusError as e:
        logger.error("Download HTTP error: " + str(e.response.status_code) + " - " + url)
        return None
    except Exception as e:
        logger.error("Download failed: " + str(e) + " - " + url)
        return None


async def upload_file_to_server(file_content_or_url, filename: str) -> str | None:
    if isinstance(file_content_or_url, str) and file_content_or_url.startswith(("http://", "https://")):
        return await _upload_from_network_url(file_content_or_url)
    else:
        return await _upload_from_file_content(file_content_or_url, filename)


async def _upload_from_network_url(url: str) -> str | None:
    try:
        logger.info("Saving file from network URL: " + url)
        network_url = settings.FILE_UPLOAD_NETWORK_URL
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(network_url, json={"filePath": url}, headers={"Content-Type": "application/json"})
        if resp.status_code == 200:
            result = resp.json()
            if str(result.get("code")) == "200" and result.get("data"):
                data = result["data"]
                file_url = data if isinstance(data, str) else data.get("url", "")
                logger.info("Network file saved: " + url + " -> " + file_url)
                return file_url
        logger.error("Network upload failed: " + str(resp.status_code))
        return None
    except Exception as e:
        logger.error("Network upload error: " + str(e))
        return None


async def _upload_from_file_content(file_content: bytes, filename: str) -> str | None:
    try:
        logger.info("Uploading file: " + filename)
        upload_url = settings.FILE_UPLOAD_URL
        content_type, _ = mimetypes.guess_type(filename)
        if not content_type:
            ext = Path(filename).suffix.lower()
            type_map = {
                ".obj": "application/octet-stream",
                ".glb": "model/gltf-binary",
                ".stl": "application/octet-stream",
                ".mp4": "video/mp4",
                ".zip": "application/zip",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
            }
            content_type = type_map.get(ext, "application/octet-stream")
        timeout = httpx.Timeout(60.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                upload_url,
                files={"file": (filename, file_content, content_type)},
                headers={"User-Agent": "CozeAgent/1.0"},
            )
        if resp.status_code == 200:
            result = resp.json()
            if str(result.get("code")) == "200" and result.get("data"):
                data = result["data"]
                file_url = data if isinstance(data, str) else data.get("url", "")
                logger.info("Upload OK: " + filename + " -> " + file_url)
                return file_url
        logger.error("Upload failed: " + str(resp.status_code))
        return None
    except Exception as e:
        logger.error("Upload error: " + str(e))
        return None
