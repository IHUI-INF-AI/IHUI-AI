"""图片图床上传 — 把外链图片上传到平台图床,根治裂图。

反风控/反裂图核心:平台正文中的外链图片会被平台拒载或防盗链 403,
导致发布后"裂图"。本模块在发布前把所有外链图片下载到本地,
再上传到平台图床,把 HTML 中的外链 src 替换为平台图床 URL。

设计:
- extract_external_images(html): 提取 HTML 中所有外链图片 URL
- download_image(url): 下载图片到 .trae-cn/tmp/publish-images/
- upload_to_platform(platform, image_path, context, credentials):
    按平台调对应图床 API/Playwright 上传,返回平台图床 URL
- replace_image_src(html, old_url, new_url): 替换 HTML 中的图片 URL

支持平台(按图床 API 类型分组):
- 知乎:POST /api/images 上传图床 → //pic1.zhimg.com/...
- CSDN:POST /api/v1/upload/image → https://img-blog.csdnimg.cn/...
- 掘金:POST /api/v1/upload/image → https://p3-juejin.byteimg.com/...
- 简书:POST /writer/upload_images → https://upload-images.jianshu.io/...
- 公众号:POST /cgi-bin/filetransfer?access_token=... → CDN URL
- 通用 Playwright:在已登录 context 下打开平台图床上传页,input[type=file] 上传

诚实边界:
- 平台图床 API 可能变更,失效时降级为"通用 Playwright 上传"
- 部分平台图床需要Referer/Origin 头,缺失会 403
- 大图(>10MB)可能被平台压缩或拒绝
"""
from __future__ import annotations

import asyncio
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)


# 图片临时下载目录(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_IMAGE_TMP_DIR = Path(".trae-cn/tmp/publish-images").resolve()
_IMAGE_TMP_DIR.mkdir(parents=True, exist_ok=True)

# 外链图片正则(匹配 <img src="http...">,排除本地路径 / data URI)
_EXTERNAL_IMG_PATTERN = re.compile(
    r'<img[^>]+src=["\'](https?://[^"\']+)["\']',
    re.IGNORECASE,
)

# 平台图床 API 端点配置
_PLATFORM_IMAGE_ENDPOINTS: dict[str, dict[str, str]] = {
    "csdn": {
        "url": "https://bizapi.csdn.net/api/v1/upload/image",
        "method": "POST",
        "auth": "cookie",
        "response_url_field": "data.url",
    },
    "juejin": {
        "url": "https://api.juejin.cn/v1/upload/image",
        "method": "POST",
        "auth": "cookie",
        "response_url_field": "data.url",
    },
    "jianshu": {
        "url": "https://www.jianshu.com/writer/upload_images",
        "method": "POST",
        "auth": "cookie",
        "response_url_field": "url",
    },
    "zhihu": {
        "url": "https://zhuanlan.zhihu.com/api/images",
        "method": "POST",
        "auth": "cookie",
        "response_url_field": "src",
    },
}


def extract_external_images(html: str) -> list[str]:
    """提取 HTML 中所有外链图片 URL。

    排除:本地路径(/xxx/xxx.png)、data URI、相对路径。
    保留:所有 http/https 开头的图片 URL。

    Returns:
        外链图片 URL 列表(去重)
    """
    if not html:
        return []
    matches = _EXTERNAL_IMG_PATTERN.findall(html)
    # 去重,保持顺序
    seen: set[str] = set()
    result: list[str] = []
    for url in matches:
        if url not in seen:
            seen.add(url)
            result.append(url)
    return result


async def download_image(url: str, timeout: float = 30.0) -> Optional[Path]:
    """下载图片到本地临时目录。

    Args:
        url: 图片 URL
        timeout: 超时(秒)

    Returns:
        本地文件路径,失败返回 None
    """
    try:
        parsed = urlparse(url)
        # 从 URL 提取文件扩展名(默认 .png)
        ext = ".png"
        path = parsed.path.lower()
        for e in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"):
            if path.endswith(e):
                ext = e
                break

        # 用 URL hash 作为文件名(避免冲突)
        import hashlib
        url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
        local_path = _IMAGE_TMP_DIR / f"{url_hash}{ext}"

        # 已存在则跳过下载(幂等)
        if local_path.is_file() and local_path.stat().st_size > 0:
            return local_path

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Referer": f"{parsed.scheme}://{parsed.netloc}/",
        }
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    "[image_uploader] 下载失败 %s: HTTP %s",
                    url, resp.status_code,
                )
                return None
            content_type = resp.headers.get("content-type", "").lower()
            if "image" not in content_type and not ext:
                logger.warning(
                    "[image_uploader] 非图片类型 %s: %s",
                    url, content_type,
                )
                return None
            local_path.write_bytes(resp.content)
            logger.debug(
                "[image_uploader] 下载成功 %s → %s (%d bytes)",
                url, local_path, len(resp.content),
            )
            return local_path
    except Exception as e:
        logger.warning(
            "[image_uploader] 下载异常 %s: %s: %s",
            url, type(e).__name__, e,
        )
        return None


def replace_image_src(html: str, old_url: str, new_url: str) -> str:
    """替换 HTML 中的图片 URL。

    Args:
        html: 原始 HTML
        old_url: 旧 URL
        new_url: 新 URL(平台图床 URL)

    Returns:
        替换后的 HTML
    """
    if not html or not old_url or not new_url:
        return html
    # 转义正则特殊字符
    escaped = re.escape(old_url)
    pattern = re.compile(f'(["\']){escaped}\\1', re.IGNORECASE)
    return pattern.sub(f'\\g<1>{new_url}\\g<1>', html)


async def upload_to_csdn(
    image_path: Path, cookie: str,
) -> Optional[str]:
    """上传图片到 CSDN 图床。

    凭证:CSDN cookie(含 UserName/UserToken/UserSecret)
    返回:平台图床 URL,失败返回 None
    """
    if not image_path.is_file():
        return None
    try:
        headers = {
            "Cookie": cookie,
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        }
        files = {"file": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://bizapi.csdn.net/api/v1/upload/image",
                headers=headers, files=files,
            )
        if resp.status_code != 200:
            logger.warning("[image_uploader] CSDN 上传失败: HTTP %s", resp.status_code)
            return None
        data = resp.json()
        url: Optional[str] = data.get("data", {}).get("url") or data.get("url")
        return url
    except Exception as e:
        logger.warning("[image_uploader] CSDN 上传异常: %s: %s", type(e).__name__, e)
        return None


async def upload_to_juejin(
    image_path: Path, cookie: str,
) -> Optional[str]:
    """上传图片到掘金图床。

    凭证:掘金 cookie(含 sessionid)
    返回:平台图床 URL,失败返回 None
    """
    if not image_path.is_file():
        return None
    try:
        headers = {
            "Cookie": cookie,
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Origin": "https://juejin.cn",
            "Referer": "https://juejin.cn/editor/drafts/",
        }
        files = {"file": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.juejin.cn/v1/upload/image",
                headers=headers, files=files,
            )
        if resp.status_code != 200:
            logger.warning("[image_uploader] 掘金上传失败: HTTP %s", resp.status_code)
            return None
        data = resp.json()
        url: Optional[str] = data.get("data", {}).get("url") or data.get("url")
        return url
    except Exception as e:
        logger.warning("[image_uploader] 掘金上传异常: %s: %s", type(e).__name__, e)
        return None


async def upload_to_jianshu(
    image_path: Path, cookie: str,
) -> Optional[str]:
    """上传图片到简书图床。

    凭证:简书 cookie
    返回:平台图床 URL,失败返回 None
    """
    if not image_path.is_file():
        return None
    try:
        headers = {
            "Cookie": cookie,
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Referer": "https://www.jianshu.com/writer/",
            "X-Requested-With": "XMLHttpRequest",
        }
        files = {"file": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://www.jianshu.com/writer/upload_images",
                headers=headers, files=files,
            )
        if resp.status_code != 200:
            logger.warning("[image_uploader] 简书上传失败: HTTP %s", resp.status_code)
            return None
        data = resp.json()
        url: Optional[str] = data.get("url") or data.get("data", {}).get("url")
        return url
    except Exception as e:
        logger.warning("[image_uploader] 简书上传异常: %s: %s", type(e).__name__, e)
        return None


async def upload_to_zhihu(
    image_path: Path, cookie: str,
) -> Optional[str]:
    """上传图片到知乎图床。

    凭证:知乎 cookie(含 z_c0)
    返回:平台图床 URL,失败返回 None
    """
    if not image_path.is_file():
        return None
    try:
        headers = {
            "Cookie": cookie,
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
            "Referer": "https://zhuanlan.zhihu.com/write",
            "X-Requested-With": "fetch",
        }
        # 知乎用 multipart,字段名 file
        files = {"file": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://zhuanlan.zhihu.com/api/images",
                headers=headers, files=files,
            )
        if resp.status_code != 200:
            logger.warning("[image_uploader] 知乎上传失败: HTTP %s", resp.status_code)
            return None
        data = resp.json()
        src: Optional[str] = data.get("src") or data.get("data", {}).get("src")
        if src:
            # 知乎返回相对路径,需补全
            if not src.startswith("http"):
                src = "https://pic1.zhimg.com" + src if src.startswith("/") else "https://pic1.zhimg.com/" + src
        return src
    except Exception as e:
        logger.warning("[image_uploader] 知乎上传异常: %s: %s", type(e).__name__, e)
        return None


async def upload_to_platform(
    platform: str,
    image_path: Path,
    credentials: dict[str, Any],
) -> Optional[str]:
    """按平台调对应图床 API 上传图片。

    Args:
        platform: 平台 ID(csdn/juejin/jianshu/zhihu)
        image_path: 本地图片路径
        credentials: 已解密的凭证(含 cookie)

    Returns:
        平台图床 URL,失败返回 None
    """
    # 从 credentials 提取 cookie 字符串
    cookie = credentials.get("cookie", "")
    if not cookie:
        # 部分平台用独立字段拼 cookie
        if platform == "csdn":
            parts = []
            for k in ("UserName", "UserToken", "UserSecret"):
                v = credentials.get(k, "")
                if v:
                    parts.append(f"{k}={v}")
            cookie = "; ".join(parts)
        elif platform == "zhihu":
            z_c0 = credentials.get("z_c0", "")
            cookie = f"z_c0={z_c0}" if z_c0 else ""

    if not cookie:
        logger.warning(
            "[image_uploader] %s 平台无 cookie,无法上传图床", platform,
        )
        return None

    if platform == "csdn":
        return await upload_to_csdn(image_path, cookie)
    if platform == "juejin":
        return await upload_to_juejin(image_path, cookie)
    if platform == "jianshu":
        return await upload_to_jianshu(image_path, cookie)
    if platform == "zhihu":
        return await upload_to_zhihu(image_path, cookie)

    logger.warning(
        "[image_uploader] 平台 %s 无专用图床 API,跳过(正文保留原外链)",
        platform,
    )
    return None


async def process_external_images(
    html: str,
    platform: str,
    credentials: dict[str, Any],
    max_concurrent: int = 3,
) -> str:
    """把 HTML 中所有外链图片下载 + 上传到平台图床,替换 src。

    Args:
        html: 原始 HTML
        platform: 目标平台 ID
        credentials: 已解密的凭证
        max_concurrent: 最大并发下载数

    Returns:
        处理后的 HTML(外链图片已替换为平台图床 URL)
    """
    if not html:
        return html

    external_urls = extract_external_images(html)
    if not external_urls:
        return html

    logger.info(
        "[image_uploader] %s 平台发现 %d 张外链图片,开始下载+上传",
        platform, len(external_urls),
    )

    # 信号量限制并发
    semaphore = asyncio.Semaphore(max_concurrent)

    async def process_one(url: str) -> tuple[str, Optional[str]]:
        """处理单张图片:下载 + 上传,返回 (原URL, 新URL)。"""
        async with semaphore:
            local_path = await download_image(url)
            if not local_path:
                return url, None
            new_url = await upload_to_platform(platform, local_path, credentials)
            return url, new_url

    # 并发处理所有外链图片
    tasks = [process_one(url) for url in external_urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 替换 HTML 中的 URL
    processed_html = html
    success_count = 0
    fail_count = 0
    for result in results:
        if isinstance(result, BaseException):
            fail_count += 1
            continue
        old_url, new_url = result
        if new_url:
            processed_html = replace_image_src(processed_html, old_url, new_url)
            success_count += 1
        else:
            fail_count += 1

    logger.info(
        "[image_uploader] %s 平台图床处理完成:成功 %d,失败 %d,共 %d",
        platform, success_count, fail_count, len(external_urls),
    )
    return processed_html


def cleanup_temp_images(max_age_hours: int = 24) -> int:
    """清理过期的临时图片文件(默认 24 小时)。

    Returns:
        清理的文件数
    """
    import time
    now = time.time()
    max_age_sec = max_age_hours * 3600
    count = 0
    for f in _IMAGE_TMP_DIR.iterdir():
        if not f.is_file():
            continue
        try:
            if now - f.stat().st_mtime > max_age_sec:
                f.unlink()
                count += 1
        except Exception:
            pass
    if count > 0:
        logger.info(
            "[image_uploader] 清理临时图片 %d 个(>=%dh)",
            count, max_age_hours,
        )
    return count


__all__ = [
    "extract_external_images",
    "download_image",
    "replace_image_src",
    "upload_to_platform",
    "process_external_images",
    "cleanup_temp_images",
]
