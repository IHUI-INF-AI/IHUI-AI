"""博客园 cnblogs 适配器(基于 HTTP API,真实可调通,不涉风控)。

凭证:{ access_token }
- access_token: OAuth2 访问令牌,在 https://oauth.cnblogs.com 申请

API 文档:https://api.cnblogs.com/help
- verify: GET https://api.cnblogs.com/api/users/current 获取当前登录用户
- publish: POST https://api.cnblogs.com/api/posts 创建文章

实现策略:
- 使用 Bearer Token 鉴权(OAuth2 access_token)。
- publish 时根据 content.format 判断 Markdown / HTML,设置 isMarkdown 标志。
- categoryIds 需通过 GET /api/categories 查询站点分类后填入
  platform_config["category_ids"](列表 int);tags 接受 list 或逗号分隔字符串。
- 失败不抛异常,统一返回 PublishResult(success=False, error_message=...)。
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://api.cnblogs.com"
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


class CnblogsAdapter(BasePlatformAdapter):
    """博客园适配器:走官方 OAuth2 REST API,无需浏览器。"""

    platform_id = "cnblogs"
    platform_name = "博客园"
    supported_formats = ["md", "html"]
    requires_credentials = ["access_token"]
    needs_browser = False

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        token = credentials.get("access_token", "").strip()
        if not token:
            return False, "missing access_token"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/api/users/current",
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
            name = data.get("DisplayName") or data.get("BlogApp") or "unknown"
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

        # 根据 format 选择 Markdown / HTML 内容
        if content.format == "md":
            is_markdown = True
            body_text = content.text or ""
        else:
            is_markdown = False
            body_text = content.html or content.text or ""
        if not body_text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="empty content (no text/html)",
            )

        # categoryIds: list[int] via platform_config
        category_ids = platform_config.get("category_ids") or []
        if not isinstance(category_ids, list):
            category_ids = [category_ids]

        # tags: 博客园接受逗号分隔字符串
        tags_raw = platform_config.get("tags") or []
        if isinstance(tags_raw, list):
            tags = ",".join(str(t) for t in tags_raw)
        else:
            tags = str(tags_raw)

        is_published = bool(platform_config.get("is_published", True))

        payload: dict[str, Any] = {
            "title": content.title,
            "body": body_text,
            "categoryIds": category_ids,
            "tags": tags,
            "isPublished": is_published,
            "isMarkdown": is_markdown,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_API_BASE}/api/posts",
                    headers=self._headers(token),
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

        if resp.status_code not in (200, 201):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"API {resp.status_code}: {resp.text[:500]}",
            )

        try:
            data = resp.json() if resp.content else {}
        except Exception as e:
            logger.warning("cnblogs.publish 响应 JSON 解析失败: %s", e, exc_info=True)
            data = {}
        post_id = str(data.get("Id") or data.get("id") or "")
        published_url = data.get("Url") or data.get("url") or ""
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=post_id,
            payload={
                "post_id": post_id,
                "is_published": is_published,
                "is_markdown": is_markdown,
            },
        )
