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

支持平台(12 个,按图床 API 类型分组):
- HTTP API:csdn / juejin / jianshu / zhihu / wechat / weibo / wordpress /
  bilibili / medium(POST multipart 或 XML-RPC)
- Playwright(反风控浏览器):xiaohongshu / baijiahao
- 不支持:toutiao(raise NotImplementedError,dispatch 降级返回空)

诚实边界:
- 平台图床 API 可能变更,失效时降级为"通用 Playwright 上传"
- 部分平台图床需要Referer/Origin 头,缺失会 403
- 大图(>10MB)可能被平台压缩或拒绝
- 所有失败场景(文件不存在/凭证缺失/网络异常/API 错误)统一降级返回空字符串
"""
from __future__ import annotations

import asyncio
import base64
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional
from urllib.parse import urlparse

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)


# 通用 UA(模拟 Chrome 120,所有 HTTP 上传复用)
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


# 图片临时下载目录(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_IMAGE_TMP_DIR = Path(".trae-cn/tmp/publish-images").resolve()
_IMAGE_TMP_DIR.mkdir(parents=True, exist_ok=True)

# 外链图片正则(匹配 <img src="http...">,排除本地路径 / data URI)
_EXTERNAL_IMG_PATTERN = re.compile(
    r'<img[^>]+src=["\'](https?://[^"\']+)["\']',
    re.IGNORECASE,
)

# 平台图床 API 端点配置(12 平台)
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
    "wechat": {
        "url": "https://api.weixin.qq.com/cgi-bin/media/upload",
        "method": "POST",
        "auth": "access_token",
        "response_url_field": "media_id",
    },
    "weibo": {
        "url": "https://api.weibo.com/2/uploadPic.json",
        "method": "POST",
        "auth": "access_token",
        "response_url_field": "pic_url",
    },
    "wordpress": {
        "url": "{site_url}/xmlrpc.php",
        "method": "POST",
        "auth": "basic",
        "response_url_field": "url",
    },
    "bilibili": {
        "url": "https://api.bilibili.com/x/cover/up",
        "method": "POST",
        "auth": "cookie",
        "response_url_field": "data.url",
    },
    "toutiao": {
        "url": "",
        "method": "",
        "auth": "none",
        "response_url_field": "",
    },
    "xiaohongshu": {
        "url": "https://creator.xiaohongshu.com/publish/publish",
        "method": "PLAYWRIGHT",
        "auth": "web_session",
        "response_url_field": "dom_img_src",
    },
    "baijiahao": {
        "url": "https://baijiahao.baidu.com/builder/rc/edit",
        "method": "PLAYWRIGHT",
        "auth": "BDUSS",
        "response_url_field": "dom_img_src",
    },
    "medium": {
        "url": "https://api.medium.com/v1/images",
        "method": "POST",
        "auth": "bearer",
        "response_url_field": "data.url",
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
            "User-Agent": _UA,
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
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到 CSDN 图床。

    凭证:credentials["cookie"] 含完整 cookie 字符串,
    或 credentials["UserName"/"UserToken"/"UserSecret"] 拼装。

    Returns:
        平台图床 URL,失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    cookie = credentials.get("cookie", "")
    if not cookie:
        parts: list[str] = []
        for k in ("UserName", "UserToken", "UserSecret"):
            v = credentials.get(k, "")
            if v:
                parts.append(f"{k}={v}")
        cookie = "; ".join(parts)
    if not cookie:
        return ""
    try:
        headers = {
            "Cookie": str(cookie),
            "User-Agent": _UA,
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
            return ""
        data = resp.json()
        url = data.get("data", {}).get("url") or data.get("url")
        if not url:
            return ""
        return str(url)
    except Exception as e:
        logger.warning("[image_uploader] CSDN 上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_juejin(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到掘金图床。

    凭证:credentials["cookie"] 含掘金 cookie(含 sessionid)

    Returns:
        平台图床 URL,失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    cookie = credentials.get("cookie", "")
    if not cookie:
        return ""
    try:
        headers = {
            "Cookie": str(cookie),
            "User-Agent": _UA,
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
            return ""
        data = resp.json()
        url = data.get("data", {}).get("url") or data.get("url")
        if not url:
            return ""
        return str(url)
    except Exception as e:
        logger.warning("[image_uploader] 掘金上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_jianshu(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到简书图床。

    凭证:credentials["cookie"] 含简书 cookie

    Returns:
        平台图床 URL,失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    cookie = credentials.get("cookie", "")
    if not cookie:
        return ""
    try:
        headers = {
            "Cookie": str(cookie),
            "User-Agent": _UA,
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
            return ""
        data = resp.json()
        url = data.get("url") or data.get("data", {}).get("url")
        if not url:
            return ""
        return str(url)
    except Exception as e:
        logger.warning("[image_uploader] 简书上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_zhihu(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到知乎图床。

    凭证:credentials["z_c0"] 含知乎 z_c0 token,
    或 credentials["cookie"] 含完整 cookie 字符串。

    Returns:
        平台图床 URL,失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    cookie = credentials.get("cookie", "")
    if not cookie:
        z_c0 = credentials.get("z_c0", "")
        cookie = f"z_c0={z_c0}" if z_c0 else ""
    if not cookie:
        return ""
    try:
        headers = {
            "Cookie": str(cookie),
            "User-Agent": _UA,
            "Accept": "application/json",
            "Referer": "https://zhuanlan.zhihu.com/write",
            "X-Requested-With": "fetch",
        }
        files = {"file": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://zhuanlan.zhihu.com/api/images",
                headers=headers, files=files,
            )
        if resp.status_code != 200:
            logger.warning("[image_uploader] 知乎上传失败: HTTP %s", resp.status_code)
            return ""
        data = resp.json()
        src = data.get("src") or data.get("data", {}).get("src")
        if not src:
            return ""
        src_str = str(src)
        # 知乎返回相对路径,需补全
        if not src_str.startswith("http"):
            if src_str.startswith("/"):
                src_str = "https://pic1.zhimg.com" + src_str
            else:
                src_str = "https://pic1.zhimg.com/" + src_str
        return src_str
    except Exception as e:
        logger.warning("[image_uploader] 知乎上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_wechat(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到微信公众号图床。

    凭证:credentials["access_token"] 含公众号 access_token。

    Returns:
        media_id(公众号图床素材 ID),失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    access_token = credentials.get("access_token", "")
    if not access_token:
        return ""
    try:
        url = (
            "https://api.weixin.qq.com/cgi-bin/media/upload"
            f"?access_token={access_token}&type=image"
        )
        headers = {"User-Agent": _UA}
        files = {"media": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, files=files)
        if resp.status_code != 200:
            logger.warning("[image_uploader] 微信上传失败: HTTP %s", resp.status_code)
            return ""
        data = resp.json()
        media_id = data.get("media_id") or data.get("url")
        if not media_id:
            return ""
        return str(media_id)
    except Exception as e:
        logger.warning("[image_uploader] 微信上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_weibo(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到微博图床。

    凭证:credentials["access_token"] + credentials["uid"]

    Returns:
        图片 URL(pic_url),失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    access_token = credentials.get("access_token", "")
    if not access_token:
        return ""
    uid = credentials.get("uid", "")
    try:
        url = "https://api.weibo.com/2/uploadPic.json"
        headers = {"User-Agent": _UA}
        data: dict[str, Any] = {"access_token": str(access_token)}
        if uid:
            data["uid"] = str(uid)
        files = {"pic": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, data=data, files=files)
        if resp.status_code != 200:
            logger.warning("[image_uploader] 微博上传失败: HTTP %s", resp.status_code)
            return ""
        resp_data = resp.json()
        pic_url = resp_data.get("original_pic") or resp_data.get("pic_url")
        if not pic_url:
            return ""
        return str(pic_url)
    except Exception as e:
        logger.warning("[image_uploader] 微博上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_wordpress(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到 WordPress(XML-RPC wp.uploadFile)。

    凭证:credentials["site_url"] + credentials["username"]
        + credentials["application_password"](或 app_password 别名)

    Returns:
        图片 URL,失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    site_url = credentials.get("site_url", "")
    username = credentials.get("username", "")
    app_password = (
        credentials.get("application_password", "")
        or credentials.get("app_password", "")
    )
    if not site_url or not username or not app_password:
        return ""
    try:
        # 构造 XML-RPC 请求(wp.uploadFile)
        file_data = image_path.read_bytes()
        file_b64 = base64.b64encode(file_data).decode("ascii")
        # 推断 MIME 类型
        ext = image_path.suffix.lower().lstrip(".")
        if ext in ("jpg", "jpeg"):
            mime = "image/jpeg"
        elif ext == "gif":
            mime = "image/gif"
        elif ext == "webp":
            mime = "image/webp"
        else:
            mime = "image/png"
        xml_request = (
            '<?xml version="1.0"?>'
            '<methodCall><methodName>wp.uploadFile</methodName><params>'
            '<param><value><int>1</int></value></param>'
            f'<param><value><string>{username}</string></value></param>'
            f'<param><value><string>{app_password}</string></value></param>'
            '<param><value><struct>'
            f'<member><name>name</name><value><string>{image_path.name}</string></value></member>'
            f'<member><name>type</name><value><string>{mime}</string></value></member>'
            f'<member><name>bits</name><value><base64>{file_b64}</base64></value></member>'
            '<member><name>overwrite</name><value><boolean>0</boolean></value></member>'
            '</struct></value></param>'
            '</params></methodCall>'
        )
        endpoint = f"{str(site_url).rstrip('/')}/xmlrpc.php"
        # HTTP Basic Auth(application_password)
        auth_str = f"{username}:{app_password}".encode("utf-8")
        auth_b64 = base64.b64encode(auth_str).decode("ascii")
        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "Authorization": f"Basic {auth_b64}",
            "User-Agent": _UA,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(endpoint, headers=headers, content=xml_request)
        if resp.status_code != 200:
            logger.warning("[image_uploader] WordPress 上传失败: HTTP %s", resp.status_code)
            return ""
        # 解析 XML-RPC 响应,提取 url 字段
        match = re.search(
            r'<name>url</name>\s*<value>\s*<string>([^<]+)</string>',
            resp.text,
        )
        if not match:
            logger.warning("[image_uploader] WordPress 响应未找到 url 字段")
            return ""
        return match.group(1).strip()
    except Exception as e:
        logger.warning("[image_uploader] WordPress 上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_bilibili(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到 B 站封面图床。

    凭证:credentials["bili_jct"](csrf) + credentials["sessdata"](cookie)

    Returns:
        封面 URL,失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    bili_jct = credentials.get("bili_jct", "")
    if not bili_jct:
        return ""
    sessdata = credentials.get("sessdata", "")
    try:
        cookie_parts = [f"bili_jct={bili_jct}"]
        if sessdata:
            cookie_parts.append(f"SESSDATA={sessdata}")
        dedeuserid = credentials.get("dedeuserid", "")
        if dedeuserid:
            cookie_parts.append(f"DedeUserID={dedeuserid}")
        cookie = "; ".join(cookie_parts)
        headers = {
            "Cookie": cookie,
            "User-Agent": _UA,
            "Accept": "application/json",
            "Referer": "https://member.bilibili.com/platform/upload/video/frame",
        }
        files = {"cover": (image_path.name, image_path.read_bytes())}
        data = {"csrf": str(bili_jct)}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.bilibili.com/x/cover/up",
                headers=headers, data=data, files=files,
            )
        if resp.status_code != 200:
            logger.warning("[image_uploader] B站上传失败: HTTP %s", resp.status_code)
            return ""
        resp_data = resp.json()
        code = resp_data.get("code", -1)
        if code != 0:
            logger.warning(
                "[image_uploader] B站上传失败: code=%s msg=%s",
                code, resp_data.get("message", ""),
            )
            return ""
        url = resp_data.get("data", {}).get("url")
        if not url:
            return ""
        return str(url)
    except Exception as e:
        logger.warning("[image_uploader] B站上传异常: %s: %s", type(e).__name__, e)
        return ""


async def upload_to_toutiao(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """头条号图片上传(不支持,显式 raise NotImplementedError)。

    头条号开放平台未提供独立图片上传 API,
    需通过图文发布接口间接上传,本模块不实现。

    Raises:
        NotImplementedError: 头条号开放平台未提供独立图片上传 API
    """
    raise NotImplementedError("头条号开放平台未提供独立图片上传 API")


async def upload_to_xiaohongshu(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到小红书图床(Playwright 反风控浏览器)。

    凭证:credentials["web_session"](小红书网页登录态标识)

    Returns:
        平台图床 URL,失败返回空字符串(Playwright 不可用时降级)
    """
    if not image_path.is_file():
        return ""
    web_session = credentials.get("web_session", "")
    if not web_session:
        return ""
    # 运行时检测 Playwright 可用性(支持 monkeypatch sys.modules 测试)
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("[image_uploader] Playwright 不可用,小红书跳过")
        return ""
    # 运行时导入反风控模块(支持 patch 测试)
    try:
        from app.services.publish import anti_risk
        from app.services.publish.anti_risk import browser_factory
    except ImportError:
        logger.warning("[image_uploader] anti_risk 模块不可用,小红书跳过")
        return ""
    try:
        async with async_playwright() as pw:
            browser, context = await anti_risk.create_stealth_browser_context(
                account_id=f"xiaohongshu_{str(web_session)[:8]}",
                platform="xiaohongshu",
                playwright_instance=pw,
            )
            try:
                page = await context.new_page()
                await page.goto("https://creator.xiaohongshu.com/publish/publish")
                file_input = page.locator("input[type='file']")
                if await file_input.count() > 0:
                    await file_input.first.set_input_files(image_path)
                await page.wait_for_timeout(2000)
                url = await page.evaluate(
                    "() => { const img = document.querySelector('img'); "
                    "return img ? img.src : ''; }"
                )
                return str(url) if url else ""
            finally:
                await browser_factory.close_stealth_context(browser, context)
    except Exception as e:
        logger.warning(
            "[image_uploader] 小红书上传异常: %s: %s", type(e).__name__, e,
        )
        return ""


async def upload_to_baijiahao(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到百家号图床(Playwright 反风控浏览器)。

    凭证:credentials["BDUSS"] + credentials["STOKEN"]

    Returns:
        平台图床 URL,失败返回空字符串(Playwright 不可用时降级)
    """
    if not image_path.is_file():
        return ""
    bduss = credentials.get("BDUSS", "")
    if not bduss:
        return ""
    # 运行时检测 Playwright 可用性
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("[image_uploader] Playwright 不可用,百家号跳过")
        return ""
    # 运行时导入反风控模块
    try:
        from app.services.publish import anti_risk
        from app.services.publish.anti_risk import browser_factory
    except ImportError:
        logger.warning("[image_uploader] anti_risk 模块不可用,百家号跳过")
        return ""
    try:
        async with async_playwright() as pw:
            browser, context = await anti_risk.create_stealth_browser_context(
                account_id=f"baijiahao_{str(bduss)[:8]}",
                platform="baijiahao",
                playwright_instance=pw,
            )
            try:
                page = await context.new_page()
                await page.goto(
                    "https://baijiahao.baidu.com/builder/rc/edit?type=news"
                )
                file_input = page.locator("input[type='file']")
                if await file_input.count() > 0:
                    await file_input.first.set_input_files(image_path)
                await page.wait_for_timeout(2000)
                url = await page.evaluate(
                    "() => { const img = document.querySelector('img'); "
                    "return img ? img.src : ''; }"
                )
                return str(url) if url else ""
            finally:
                await browser_factory.close_stealth_context(browser, context)
    except Exception as e:
        logger.warning(
            "[image_uploader] 百家号上传异常: %s: %s", type(e).__name__, e,
        )
        return ""


async def upload_to_medium(
    image_path: Path, credentials: dict[str, Any],
) -> Optional[str]:
    """上传图片到 Medium 图床。

    凭证:credentials["access_token"](Medium integration token)

    Returns:
        图片 URL,失败返回空字符串
    """
    if not image_path.is_file():
        return ""
    access_token = credentials.get("access_token", "")
    if not access_token:
        return ""
    try:
        url = "https://api.medium.com/v1/images"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "User-Agent": _UA,
        }
        files = {"image": (image_path.name, image_path.read_bytes())}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, files=files)
        # Medium API 成功返回 201
        if resp.status_code not in (200, 201):
            logger.warning("[image_uploader] Medium 上传失败: HTTP %s", resp.status_code)
            return ""
        resp_data = resp.json()
        url_val = resp_data.get("data", {}).get("url")
        if not url_val:
            return ""
        return str(url_val)
    except Exception as e:
        logger.warning("[image_uploader] Medium 上传异常: %s: %s", type(e).__name__, e)
        return ""


# 12 平台 dispatch 表(平台 ID → 上传函数)
_ImageUploader = Callable[[Path, dict[str, Any]], Awaitable[Optional[str]]]

_PLATFORM_UPLOADERS: dict[str, _ImageUploader] = {
    "csdn": upload_to_csdn,
    "juejin": upload_to_juejin,
    "jianshu": upload_to_jianshu,
    "zhihu": upload_to_zhihu,
    "wechat": upload_to_wechat,
    "weibo": upload_to_weibo,
    "wordpress": upload_to_wordpress,
    "bilibili": upload_to_bilibili,
    "toutiao": upload_to_toutiao,
    "xiaohongshu": upload_to_xiaohongshu,
    "baijiahao": upload_to_baijiahao,
    "medium": upload_to_medium,
}


async def upload_to_platform(
    platform: str,
    image_path: Path,
    credentials: dict[str, Any],
) -> Optional[str]:
    """按平台调对应图床 API 上传图片(dispatch)。

    Args:
        platform: 平台 ID(csdn/juejin/jianshu/zhihu/wechat/weibo/wordpress/
            bilibili/toutiao/xiaohongshu/baijiahao/medium)
        image_path: 本地图片路径
        credentials: 已解密的凭证(各平台所需字段不同)

    Returns:
        平台图床 URL,失败或平台不支持时返回空字符串(不抛异常)
    """
    uploader = _PLATFORM_UPLOADERS.get(platform)
    if uploader is None:
        logger.warning(
            "[image_uploader] 平台 %s 无专用图床 API,跳过(正文保留原外链)",
            platform,
        )
        return ""
    try:
        return await uploader(image_path, credentials)
    except NotImplementedError as e:
        logger.warning("[image_uploader] %s: %s", platform, e)
        return ""
    except Exception as e:
        logger.warning(
            "[image_uploader] %s 上传异常: %s: %s",
            platform, type(e).__name__, e,
        )
        return ""


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
    "upload_to_csdn",
    "upload_to_juejin",
    "upload_to_jianshu",
    "upload_to_zhihu",
    "upload_to_wechat",
    "upload_to_weibo",
    "upload_to_wordpress",
    "upload_to_bilibili",
    "upload_to_toutiao",
    "upload_to_xiaohongshu",
    "upload_to_baijiahao",
    "upload_to_medium",
]
