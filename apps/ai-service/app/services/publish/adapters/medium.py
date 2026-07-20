"""Medium 适配器(基于 REST API,真实可调通)。

凭证:{ integration_token, publication_id(可选) }

API 文档:https://github.com/Medium/medium-api-docs
- verify: GET /v1/me
- publish: POST /v1/posts(用户 token)/ POST /v1/publications/{pubId}/posts(出版物 token)

注意:Medium 已于 2021 年关闭新 Integration Token 申请,但已存在的 token 仍可使用。
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://api.medium.com/v1"


class MediumAdapter(BasePlatformAdapter):
    platform_id = "medium"
    platform_name = "Medium"
    supported_formats = ["md", "html"]
    requires_credentials = ["integration_token"]

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Accept-Charset": "utf-8",
        }

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        token = credentials.get("integration_token", "").strip()
        if not token:
            return False, "missing integration_token"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(f"{_API_BASE}/me", headers=self._headers(token))
            if resp.status_code != 200:
                return False, f"API returned {resp.status_code}: {resp.text[:200]}"
            data = resp.json()
            user = data.get("data") or {}
            name = user.get("name") or user.get("username") or "?"
            uid = user.get("id") or "?"
            return True, f"connected as {name} (id={uid})"
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        token = credentials.get("integration_token", "").strip()
        publication_id = (credentials.get("publication_id") or "").strip()
        if not token:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing integration_token",
            )

        # Medium 只接受 HTML 内容
        html = content.html or ""
        if not html and content.text:
            # md → 简单换行转换
            html = "".join(
                f"<p>{line}</p>" if line.strip() else "<br>"
                for line in content.text.split("\n\n")
            )

        # 先获取用户 id(若没有 publication_id,需用 user id 作为 author)
        author_id = platform_config.get("author_id", "")
        if not author_id:
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.get(f"{_API_BASE}/me", headers=self._headers(token))
                if resp.status_code == 200:
                    author_id = (resp.json().get("data") or {}).get("id", "")
            except Exception as e:
                logger.warning("[medium] get user id failed: %s: %s", type(e).__name__, e)
            if not author_id:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message="failed to resolve author_id",
                )

        body: dict[str, Any] = {
            "title": content.title[:200],  # Medium 标题上限
            "contentFormat": "html",
            "content": html,
            "tags": platform_config.get("tags", [])[:5],  # 最多 5 个标签
            "publishStatus": platform_config.get("publish_status", "public"),
            # public / draft / unlisted
        }
        if content.cover_path:
            # Medium 不直接支持上传封面,可通过 content 顶部 <img> 实现
            body["content"] = f'<img src="{content.cover_path}"/><br/>' + html

        # 选择 endpoint:publication 优先,否则用户文章
        if publication_id:
            url = f"{_API_BASE}/publications/{publication_id}/posts"
        else:
            url = f"{_API_BASE}/users/{author_id}/posts"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, headers=self._headers(token), json=body)
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"http error: {type(e).__name__}: {e}",
            )

        if resp.status_code not in (200, 201):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"API {resp.status_code}: {resp.text[:500]}",
            )

        try:
            data = resp.json().get("data") or {}
        except Exception:
            data = {}
        post_id = data.get("id", "")
        published_url = data.get("url", "")
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=post_id,
            payload={
                "post_id": post_id,
                "publish_status": body["publishStatus"],
                "publication_id": publication_id or None,
            },
        )
