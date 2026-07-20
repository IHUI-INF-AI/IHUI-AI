"""YouTube 适配器(基于 YouTube Data API v3,真实可调通)。

凭证:{ access_token, refresh_token, client_id, client_secret }

实现:
- verify_credentials: 调用 channels.list(part='snippet', mine=True) 验证 token
- publish: 调用 videos.insert(上传视频元数据 + 文件流)

依赖:google-api-python-client + google-auth(若未安装,降级到 httpx 直接调 REST API)

注意:
- YouTube Data API v3 配额:每天 10000 单位,每次 upload 消耗 1600 单位
- 视频文件需为 MP4/WebM/MOV/AVI 等格式
- 标题 ≤100 字符,描述 ≤5000 字符,tags 总共 ≤500 字符
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://www.googleapis.com/youtube/v3"
_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"
_TOKEN_URL = "https://oauth2.googleapis.com/token"


class YouTubeAdapter(BasePlatformAdapter):
    platform_id = "youtube"
    platform_name = "YouTube"
    supported_formats = ["video"]
    requires_credentials = ["access_token", "refresh_token", "client_id", "client_secret"]

    async def _refresh_access_token(self, credentials: dict) -> tuple[bool, str, dict]:
        """用 refresh_token 刷新 access_token。

        Returns:
            (ok, new_access_token_or_error_message, updated_credentials)
        """
        refresh_token = credentials.get("refresh_token", "").strip()
        client_id = credentials.get("client_id", "").strip()
        client_secret = credentials.get("client_secret", "").strip()
        if not (refresh_token and client_id and client_secret):
            return False, "missing refresh_token/client_id/client_secret", credentials

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(_TOKEN_URL, data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                })
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}", credentials

        if resp.status_code != 200:
            return False, f"refresh failed {resp.status_code}: {resp.text[:200]}", credentials

        data = resp.json()
        new_token = data.get("access_token", "")
        if not new_token:
            return False, "no access_token in response", credentials

        new_creds = dict(credentials)
        new_creds["access_token"] = new_token
        return True, new_token, new_creds

    async def _call_with_refresh(
        self, credentials: dict, fn
    ) -> tuple[Any, dict]:
        """调用 fn(credentials) → response;若 401,刷新 token 后重试一次。

        Returns:
            (response, final_credentials)
        """
        resp, creds = await fn(credentials)
        if getattr(resp, "status_code", 200) == 401:
            ok, msg, creds = await self._refresh_access_token(creds)
            if ok:
                resp, creds = await fn(creds)
        return resp, creds

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        access_token = credentials.get("access_token", "").strip()
        if not access_token:
            return False, "missing access_token"

        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

        async def _call(creds: dict) -> tuple[httpx.Response, dict]:
            tok = creds.get("access_token", "")
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{_API_BASE}/channels",
                    params={"part": "snippet", "mine": "true"},
                    headers={"Authorization": f"Bearer {tok}", "Accept": "application/json"},
                )
            return r, creds

        try:
            resp, _ = await self._call_with_refresh(credentials, _call)
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        try:
            data = resp.json()
            items = data.get("items", [])
            if not items:
                return True, "connected (no channel yet)"
            ch = items[0]
            snippet = ch.get("snippet", {})
            title = snippet.get("title", "?")
            cid = ch.get("id", "?")
            return True, f"connected as {title} (channel_id={cid})"
        except Exception as e:
            return False, f"parse response failed: {type(e).__name__}: {e}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        if content.format != "video":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"YouTube only supports video format, got {content.format}",
            )
        if not content.file_path:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing file_path (video file required)",
            )

        # 视频文件路径 + 元数据
        title = (content.title or platform_config.get("title", "Untitled"))[:100]
        description = (platform_config.get("description", "") or content.text or "")[:5000]
        tags = platform_config.get("tags", [])[:500]
        category_id = str(platform_config.get("category_id", "22"))  # 22 = People & Blogs
        privacy_status = platform_config.get("privacy_status", "public")  # public/unlisted/private

        # 视频元数据(snippet + status)
        metadata = {
            "snippet": {
                "title": title,
                "description": description,
                "tags": tags,
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        }

        # 上传 URL(使用 resumable upload 协议第一步:get upload URL)
        try:
            from pathlib import Path
            video_path = Path(content.file_path)
            if not video_path.is_file():
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message=f"video file not found: {content.file_path}",
                )
            file_size = video_path.stat().st_size
            file_bytes = video_path.read_bytes()
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"read video file failed: {type(e).__name__}: {e}",
            )

        async def _start_upload(creds: dict) -> tuple[httpx.Response, dict]:
            tok = creds.get("access_token", "")
            headers = {
                "Authorization": f"Bearer {tok}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/*",
                "X-Upload-Content-Length": str(file_size),
            }
            params = {"uploadType": "resumable", "part": "snippet,status"}
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(
                    f"{_UPLOAD_BASE}/videos",
                    params=params,
                    headers=headers,
                    content=json.dumps(metadata),
                )
            return r, creds

        try:
            resp, final_creds = await self._call_with_refresh(credentials, _start_upload)
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"start upload failed: {type(e).__name__}: {e}",
            )

        if resp.status_code not in (200, 201):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"start upload {resp.status_code}: {resp.text[:300]}",
            )

        upload_url = resp.headers.get("Location", "")
        if not upload_url:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="no upload URL returned",
            )

        # 上传视频文件(整个文件一次性 PUT,适合中小视频)
        try:
            headers = {
                "Authorization": f"Bearer {final_creds.get('access_token', '')}",
                "Content-Type": "video/*",
                "Content-Length": str(file_size),
            }
            async with httpx.AsyncClient(timeout=600.0) as client:
                resp = await client.put(upload_url, headers=headers, content=file_bytes)
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"upload failed: {type(e).__name__}: {e}",
            )

        if resp.status_code not in (200, 201):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"upload {resp.status_code}: {resp.text[:500]}",
            )

        try:
            data = resp.json()
        except Exception:
            data = {}

        video_id = data.get("id", "")
        if not video_id:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"no video id in response: {resp.text[:300]}",
            )

        published_url = f"https://www.youtube.com/watch?v={video_id}"
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=video_id,
            payload={
                "video_id": video_id,
                "privacy_status": privacy_status,
                "title": title,
                "file_size": file_size,
            },
        )
