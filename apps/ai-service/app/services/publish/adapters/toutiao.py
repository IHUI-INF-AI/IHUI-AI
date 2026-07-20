"""头条号 适配器(基于头条号开放平台 OpenAPI,完整代码)。

凭证:{ app_id, app_secret }

实现:
- verify_credentials: GET /api/getTokenInfo 检查 access_token
- publish: POST /api/digg/article 发布图文文章

注意:
- 头条号开放平台 API 需要申请权限
- 文章审核通常 30 分钟内
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://open.snssdk.com"
_TOKEN_URL = "https://open.snssdk.com/oauth2/access_token"


class ToutiaoAdapter(BasePlatformAdapter):
    platform_id = "toutiao"
    platform_name = "头条号"
    supported_formats = ["md", "html"]
    requires_credentials = ["app_id", "app_secret"]

    async def _get_access_token(self, credentials: dict) -> tuple[bool, str]:
        """头条号 client_credentials 模式获取 access_token。"""
        app_id = credentials.get("app_id", "").strip()
        app_secret = credentials.get("app_secret", "").strip()
        if not (app_id and app_secret):
            return False, "missing app_id / app_secret"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    _TOKEN_URL,
                    data={
                        "grant_type": "client_credential",
                        "appid": app_id,
                        "secret": app_secret,
                    },
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        data = resp.json()
        token = data.get("access_token")
        if not token:
            return False, f"no access_token: {data}"
        return True, token

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        ok, msg_or_token = await self._get_access_token(credentials)
        if not ok:
            return False, msg_or_token
        token = msg_or_token

        # 调 getTokenInfo 验证
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/api/getTokenInfo",
                    params={"access_token": token},
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        try:
            data = resp.json()
        except Exception:
            return False, f"invalid json: {resp.text[:200]}"

        if data.get("message") != "success":
            return False, f"verify failed: {data}"
        expires = data.get("data", {}).get("expires_in", "?")
        return True, f"connected (token expires in {expires}s)"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        ok, msg_or_token = await self._get_access_token(credentials)
        if not ok:
            return PublishResult(
                success=False, platform=self.platform_id, error_message=msg_or_token,
            )
        token = msg_or_token

        # 头条文章接口要求 content 为 HTML
        html = content.html or ""
        if not html and content.text:
            html = "".join(
                f"<p>{line}</p>" if line.strip() else "<br>"
                for line in content.text.split("\n\n")
            )

        body: dict[str, Any] = {
            "title": content.title[:30],  # 头条标题上限 30 字
            "content": html,
            "cover_image": platform_config.get("cover_image", ""),  # 单图 URL
            "cover_images": platform_config.get("cover_images", []),  # 多图 URL list(≤3)
            "abstract": platform_config.get("abstract", "")[:100],
        }

        # 头条号支持 save(草稿)/ publish(直接发布)2 种
        publish_type = platform_config.get("publish_type", "save")
        url = f"{_API_BASE}/api/digg/article?type={publish_type}&access_token={token}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, data=body)
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )

        if resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"API {resp.status_code}: {resp.text[:300]}",
            )

        try:
            rdata = resp.json()
        except Exception:
            rdata = {}

        if rdata.get("message") != "success":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {rdata}",
            )

        article_id = (rdata.get("data") or {}).get("article_id", "")
        return PublishResult(
            success=True, platform=self.platform_id,
            platform_content_id=str(article_id),
            published_url="",
            payload={
                "article_id": article_id,
                "publish_type": publish_type,
                "note": "文章已提交,审核通过后可在头条号后台查看",
            },
        )
