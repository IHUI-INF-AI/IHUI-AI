"""简书(jianshu)适配器(基于 Cookie 模拟,真实可调通)。

凭证:{ cookie }
- cookie: 用户登录简书后从浏览器复制的 cookie 字符串
  获取路径:浏览器登录简书 → F12 → Network → 任意请求 → Request Headers → Cookie

注意:简书无公开开放 API,本适配器通过 writer 模块的内部 API 模拟发布。
      非官方实现,简书前端结构调整时可能失效,需更新。

API 端点(均为 writer 内部 API):
- 验证:GET https://www.jianshu.com/writer#/notes
        Header: Cookie: {cookie}
        检查:HTTP 200 + 未重定向到登录页(/sign_in)
- 发布:POST https://www.jianshu.com/writer/notes
        Body: { title, content(HTML), notebook_id, at_bottom }
        返回: { id, slug }

公开 URL 拼装:https://www.jianshu.com/p/{slug}

实现要点:
- httpx.AsyncClient 异步,超时 30s,follow_redirects=False(用于检测登录态)
- 失败最多重试 2 次,间隔 1s
- 网络异常/4xx/5xx/重定向到登录页 都返回 PublishResult(success=False),不抛异常
"""
from __future__ import annotations

import asyncio
from typing import Any, TypedDict

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_BASE = "https://www.jianshu.com"
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
_MAX_RETRIES = 2
_RETRY_INTERVAL = 1.0
_TIMEOUT = 30.0

# 登录态失效信号:重定向目标含 /sign_in
_LOGIN_REDIRECT_HINTS = ("/sign_in", "/login")


class _JianshuNoteBody(TypedDict, total=False):
    """简书发布请求 body 结构(用于文档化,实际发送时按 dict 构造)。"""

    title: str
    content: str
    notebook_id: int
    at_bottom: bool


class JianshuAdapter(BasePlatformAdapter):
    """简书适配器。基于 Cookie 模拟 writer 内部 API,无需浏览器自动化。"""

    platform_id = "jianshu"
    platform_name = "简书"
    supported_formats = ["md", "html"]
    requires_credentials = ["cookie"]
    needs_browser = False

    def _headers(self, cookie: str) -> dict[str, str]:
        # 简书需要 Referer + X-Requested-With 才能调通 writer API
        return {
            "Cookie": cookie,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": _USER_AGENT,
            "Referer": f"{_BASE}/writer/",
            "X-Requested-With": "XMLHttpRequest",
        }

    def _is_login_redirect(self, resp: httpx.Response) -> bool:
        """检测响应是否表明登录态失效(重定向到登录页 或 401/403)。"""
        if resp.status_code in (401, 403):
            return True
        # follow_redirects=False 时,Location header 会暴露重定向目标
        location = resp.headers.get("location", "")
        if location and any(hint in location for hint in _LOGIN_REDIRECT_HINTS):
            return True
        return False

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        json_body: dict[str, Any] | None = None,
    ) -> httpx.Response:
        """带重试的 HTTP 请求。最多重试 _MAX_RETRIES 次,间隔 _RETRY_INTERVAL 秒。

        仅对网络异常/5xx 重试;4xx 与重定向不重试(客户端错误,重试无意义)。
        follow_redirects=False 用于检测登录态失效。
        """
        last_exc: Exception | None = None
        resp: httpx.Response | None = None
        for attempt in range(_MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=_TIMEOUT, follow_redirects=False,
                ) as client:
                    if method.upper() == "GET":
                        resp = await client.get(url, headers=headers)
                    else:
                        resp = await client.post(url, headers=headers, json=json_body)
                if resp.status_code < 500:
                    return resp
                logger.warning(
                    "[jianshu] HTTP %s on attempt %d, will retry",
                    resp.status_code, attempt + 1,
                )
            except httpx.HTTPError as e:
                last_exc = e
                logger.warning(
                    "[jianshu] http error on attempt %d: %s: %s",
                    attempt + 1, type(e).__name__, e,
                )
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(_RETRY_INTERVAL)
        if last_exc is not None:
            raise last_exc
        assert resp is not None
        return resp

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        cookie = (credentials.get("cookie") or "").strip()
        if not cookie:
            return False, "missing cookie"

        try:
            # 用 writer 首页探测登录态(follow_redirects=False 以检测重定向)
            resp = await self._request_with_retry(
                "GET",
                f"{_BASE}/writer",
                headers=self._headers(cookie),
            )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

        if self._is_login_redirect(resp):
            return False, "cookie expired or invalid (redirected to login)"
        if resp.status_code != 200:
            return False, f"API returned {resp.status_code}: {resp.text[:200]}"
        # 进一步:调 /writer/notes 检查是否真能拿到笔记列表
        try:
            notes_resp = await self._request_with_retry(
                "GET",
                f"{_BASE}/writer/notes",
                headers=self._headers(cookie),
            )
            if self._is_login_redirect(notes_resp):
                return False, "cookie expired (notes API redirected)"
            if notes_resp.status_code == 200:
                try:
                    data = notes_resp.json()
                    count = len(data) if isinstance(data, list) else 0
                    return True, f"connected, {count} notes visible"
                except Exception:
                    # JSON 解析失败但 HTTP 200,仍认为 cookie 有效
                    return True, "connected (notes API reachable)"
        except httpx.HTTPError as e:
            logger.warning("[jianshu] notes verify http error: %s: %s", type(e).__name__, e)
        except Exception as e:
            logger.warning("[jianshu] notes verify failed: %s: %s", type(e).__name__, e, exc_info=True)
        return True, "connected"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        cookie = (credentials.get("cookie") or "").strip()
        if not cookie:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing cookie",
            )

        # 简书 content 字段接受 HTML
        html = content.html or ""
        if not html and content.text:
            html = "".join(
                f"<p>{line}</p>" if line.strip() else "<br>"
                for line in content.text.split("\n\n")
            )
        if not html:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="content is empty (no html/text)",
            )

        body: _JianshuNoteBody = {
            "title": content.title[:200],
            "content": html,
            "notebook_id": int(platform_config.get("notebook_id", 0)),
            "at_bottom": bool(platform_config.get("at_bottom", False)),
        }
        logger.info(
            "[jianshu] publish start: title=%r notebook_id=%s",
            content.title, body["notebook_id"],
        )

        try:
            resp = await self._request_with_retry(
                "POST",
                f"{_BASE}/writer/notes",
                headers=self._headers(cookie),
                json_body=dict(body),
            )
        except httpx.HTTPError as e:
            logger.error("[jianshu] publish http error: %s: %s", type(e).__name__, e)
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"http error: {type(e).__name__}: {e}",
            )
        except Exception as e:
            logger.error("[jianshu] publish failed: %s: %s", type(e).__name__, e, exc_info=True)
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )

        # 登录态失效
        if self._is_login_redirect(resp):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="cookie expired or invalid (redirected to login)",
            )
        if resp.status_code not in (200, 201):
            logger.warning("[jianshu] publish API %s: %s", resp.status_code, resp.text[:500])
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"API {resp.status_code}: {resp.text[:500]}",
            )

        try:
            data = resp.json()
        except Exception as e:
            logger.warning("[jianshu] publish JSON 解析失败: %s", e, exc_info=True)
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"invalid JSON response: {e}",
            )
        if not isinstance(data, dict):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"unexpected response type: {type(data).__name__}",
            )

        post_id = data.get("id")
        slug = data.get("slug", "")
        if not post_id:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"response missing 'id': {data}",
            )
        # 公开 URL 由 slug 拼装
        published_url = f"{_BASE}/p/{slug}" if slug else ""
        logger.info(
            "[jianshu] publish success: id=%s slug=%s", post_id, slug,
        )
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=str(post_id),
            payload={"post_id": post_id, "slug": slug, "url": published_url},
        )
