"""思否 SegmentFault 适配器(基于 HTTP API,不涉风控)。

凭证:{ access_token } 或 { cookie }(二选一)
- access_token: OAuth2 访问令牌(官方开放 API,需应用审核)
- cookie: 登录后的 Cookie 字符串(走站内 web 接口,通用性强)

API 文档:https://segmentfault.com/docs/api
- verify(OAuth2): GET https://api.segmentfault.com/api/user/me
- verify(cookie): GET https://segmentfault.com/api/user/me
- publish(OAuth2): POST https://api.segmentfault.com/articles
- publish(cookie): POST https://segmentfault.com/api/articles?event=articleSubmit

实现策略:优先使用 access_token(OAuth2);未提供时回退到 cookie(web 内部接口)。
两种模式均返回统一 PublishResult。
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
_OAUTH_BASE = "https://api.segmentfault.com"
_WEB_BASE = "https://segmentfault.com"


class SegmentfaultAdapter(BasePlatformAdapter):
    """思否适配器:OAuth2 优先,cookie 回退。"""

    platform_id = "segmentfault"
    platform_name = "思否"
    supported_formats = ["md", "html"]
    requires_credentials = ["access_token"]
    needs_browser = False

    def _oauth_headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _cookie_headers(self, cookie: str) -> dict[str, str]:
        return {
            "Cookie": cookie,
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"{_WEB_BASE}/user",
        }

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        access_token = credentials.get("access_token", "").strip()
        cookie = credentials.get("cookie", "").strip()
        if access_token:
            return await self._verify_oauth(access_token)
        if cookie:
            return await self._verify_cookie(cookie)
        return False, "missing access_token or cookie"

    async def _verify_oauth(self, token: str) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{_OAUTH_BASE}/api/user/me",
                    headers=self._oauth_headers(token),
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"
        if resp.status_code == 200:
            data = resp.json() if resp.content else {}
            name = data.get("name") or data.get("username") or "unknown"
            return True, f"connected as {name} (oauth)"
        if resp.status_code == 401:
            return False, "access_token expired or invalid (401)"
        return False, f"verify failed: HTTP {resp.status_code} - {resp.text[:200]}"

    async def _verify_cookie(self, cookie: str) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{_WEB_BASE}/api/user/me",
                    headers=self._cookie_headers(cookie),
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"
        if resp.status_code == 200:
            try:
                data = resp.json() if resp.content else {}
            except Exception:
                data = {}
            name = data.get("name") or data.get("username") or "unknown"
            return True, f"connected as {name} (cookie)"
        if resp.status_code in (401, 403):
            return False, "cookie expired or invalid"
        return False, f"verify failed: HTTP {resp.status_code} - {resp.text[:200]}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        access_token = credentials.get("access_token", "").strip()
        cookie = credentials.get("cookie", "").strip()
        body_text = content.text or content.html or ""
        if not body_text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="empty content (no text/html)",
            )
        tags_raw = platform_config.get("tags") or []
        if isinstance(tags_raw, list):
            tags = ",".join(str(t) for t in tags_raw)
        else:
            tags = str(tags_raw)
        category = str(platform_config.get("category") or platform_config.get("category_id") or "")

        if access_token:
            return await self._publish_oauth(content.title, body_text, tags, category, access_token)
        if cookie:
            return await self._publish_cookie(content.title, body_text, tags, category, cookie)
        return PublishResult(
            success=False, platform=self.platform_id,
            error_message="missing access_token or cookie",
        )

    async def _publish_oauth(
        self, title: str, text: str, tags: str, category: str, token: str
    ) -> PublishResult:
        payload: dict[str, Any] = {
            "title": title,
            "text": text,
            "tags": tags,
        }
        if category:
            payload["category"] = category
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_OAUTH_BASE}/articles",
                    headers=self._oauth_headers(token),
                    json=payload,
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"http error: {type(e).__name__}: {e}",
            )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
        return self._parse_publish_response(resp, mode="oauth")

    async def _publish_cookie(
        self, title: str, text: str, tags: str, category: str, cookie: str
    ) -> PublishResult:
        form = {
            "title": title,
            "text": text,
            "tags": tags,
            "event": "articleSubmit",
        }
        if category:
            form["category"] = category
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_WEB_BASE}/api/articles",
                    headers=self._cookie_headers(cookie),
                    data=form,
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"http error: {type(e).__name__}: {e}",
            )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
        return self._parse_publish_response(resp, mode="cookie")

    def _parse_publish_response(self, resp: httpx.Response, mode: str) -> PublishResult:
        if resp.status_code not in (200, 201):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"API {resp.status_code}: {resp.text[:500]}",
            )
        try:
            data = resp.json() if resp.content else {}
        except Exception as e:
            logger.warning("segmentfault.publish 响应 JSON 解析失败: %s", e, exc_info=True)
            data = {}
        # SegmentFault 响应可能为 {id, url, ...} 或 {data: {...}} 或 {article: {...}}
        article = data if isinstance(data, dict) else {}
        if isinstance(data.get("data"), dict):
            article = data["data"]
        elif isinstance(data.get("article"), dict):
            article = data["article"]
        post_id = str(article.get("id") or article.get("articleId") or "")
        published_url = article.get("url") or article.get("webUrl") or ""
        if not published_url and post_id:
            published_url = f"{_WEB_BASE}/a/{post_id}"
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=post_id,
            payload={"mode": mode, "post_id": post_id},
        )
