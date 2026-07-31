"""开源中国 OSChina 适配器(基于 HTTP API,真实可调通,不涉风控)。

凭证:{ access_token }
- access_token: OAuth2 访问令牌,在 https://www.oschina.net/openapi 申请

API 文档:https://www.oschina.net/openapi
- verify: GET https://www.oschina.net/action/api/user 获取当前用户
- publish: POST https://www.oschina.net/action/api/article_post 发布文章

实现策略:
- 使用 Bearer Token 鉴权(OAuth2 access_token)。
- OSChina OpenAPI 历史上以表单参数为主,故 publish 用 form-urlencoded 提交,
  Accept: application/json 请求 JSON 响应。
- content 优先用 HTML(oschina 接受 HTML 正文),无 HTML 时回退到 text。
- catalog(分类 ID)与 tags(逗号分隔)通过 platform_config 传入。
- 失败不抛异常,统一返回 PublishResult(success=False, error_message=...)。
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://www.oschina.net/action/api"
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


class OschinaAdapter(BasePlatformAdapter):
    """开源中国适配器:走官方 OAuth2 OpenAPI,无需浏览器。"""

    platform_id = "oschina"
    platform_name = "开源中国"
    supported_formats = ["md", "html"]
    requires_credentials = ["access_token"]
    needs_browser = False

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
        }

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        token = credentials.get("access_token", "").strip()
        if not token:
            return False, "missing access_token"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/user",
                    headers=self._headers(token),
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
            name = (
                data.get("name")
                or data.get("nick")
                or data.get("username")
                or "unknown"
            )
            return True, f"connected as {name}"
        if resp.status_code == 401:
            return False, "access_token expired or invalid (401)"
        return False, f"verify failed: HTTP {resp.status_code} - {resp.text[:200]}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        token = credentials.get("access_token", "").strip()
        if not token:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing access_token",
            )

        # oschina 接受 HTML 正文,优先 html,回退 text
        body_text = content.html or content.text or ""
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
        catalog = str(
            platform_config.get("catalog") or platform_config.get("category_id") or ""
        )

        form: dict[str, str] = {
            "title": content.title,
            "content": body_text,
            "tags": tags,
        }
        if catalog:
            form["catalog"] = catalog

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_API_BASE}/article_post",
                    headers=self._headers(token),
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

        if resp.status_code not in (200, 201):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"API {resp.status_code}: {resp.text[:500]}",
            )

        try:
            data = resp.json() if resp.content else {}
        except Exception as e:
            logger.warning("oschina.publish 响应 JSON 解析失败: %s", e, exc_info=True)
            data = {}
        article: dict[str, Any] = data if isinstance(data, dict) else {}
        post_id = str(article.get("id") or article.get("articleId") or "")
        published_url = article.get("url") or article.get("href") or ""
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=post_id,
            payload={"post_id": post_id, "catalog": catalog, "tags": tags},
        )
