"""快手 适配器(基于快手开放平台 OpenAPI,完整代码)。

凭证:{ access_token, app_id, app_secret }

实现:
- verify_credentials: GET /openapi/user_info 验证 access_token
- publish:
  1. 上传视频:POST /openapi/photo/upload_video
  2. 发布视频:POST /openapi/photo/publish

注意:
- 快手开放平台需企业认证 + 视频发布权限申请
- 视频审核通常 1-2 小时
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://open.kuaishou.com"


class KuaishouAdapter(BasePlatformAdapter):
    platform_id = "kuaishou"
    platform_name = "快手"
    supported_formats = ["video"]
    requires_credentials = ["access_token", "app_id", "app_secret"]

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        access_token = credentials.get("access_token", "").strip()
        app_id = credentials.get("app_id", "").strip()
        if not (access_token and app_id):
            return False, "missing access_token / app_id"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/openapi/user_info",
                    params={"access_token": access_token, "app_id": app_id},
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        try:
            data = resp.json()
        except Exception:
            return False, f"invalid json: {resp.text[:200]}"

        if data.get("result") != 1:
            return False, f"verify failed: result={data.get('result')} msg={data.get('error_msg')}"

        uinfo = data.get("user_info", {})
        name = uinfo.get("name") or uinfo.get("kwai_id") or "?"
        return True, f"connected as {name}"

    async def _upload_video(self, token: str, app_id: str, open_id: str, video_path: str) -> tuple[bool, str, dict]:
        """上传视频,返回 (ok, video_id_or_error, payload)。"""
        p = Path(video_path)
        if not p.is_file():
            return False, f"video not found: {video_path}", {}
        file_size = p.stat().st_size

        # 上传视频(快手 OpenAPI 单步上传)
        try:
            with open(p, "rb") as f:
                files = {"file": (p.name, f, "video/mp4")}
                async with httpx.AsyncClient(timeout=600.0) as client:
                    resp = await client.post(
                        f"{_API_BASE}/openapi/photo/upload_video",
                        params={
                            "access_token": token,
                            "app_id": app_id,
                            "open_id": open_id,
                        },
                        files=files,
                        data={
                            "file_size": file_size,
                            "file_name": p.name,
                        },
                    )
        except httpx.HTTPError as e:
            return False, f"upload failed: {type(e).__name__}: {e}", {}

        if resp.status_code != 200:
            return False, f"upload {resp.status_code}: {resp.text[:300]}", {}

        try:
            rdata = resp.json()
        except Exception:
            rdata = {}

        if rdata.get("result") != 1:
            return False, f"upload failed: {rdata}", {}

        video_id = (rdata.get("video_info") or {}).get("video_id", "")
        if not video_id:
            return False, f"no video_id: {rdata}", {}
        return True, video_id, {"file_size": file_size, "video_id": video_id}

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        if content.format != "video":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"快手 only supports video format, got {content.format}",
            )
        if not content.file_path:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing file_path (video file required)",
            )

        token = credentials.get("access_token", "")
        app_id = credentials.get("app_id", "")
        open_id = platform_config.get("open_id", credentials.get("open_id", ""))
        if not open_id:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing open_id (required for publish, set in platform_config or credentials)",
            )

        # 上传视频
        ok, vid_or_err, upload_payload = await self._upload_video(token, app_id, open_id, content.file_path)
        if not ok:
            return PublishResult(
                success=False, platform=self.platform_id, error_message=vid_or_err,
            )
        video_id = vid_or_err

        # 发布视频
        body: dict[str, Any] = {
            "access_token": token,
            "app_id": app_id,
            "open_id": open_id,
            "photo_type": "video",
            "video_id": video_id,
            "caption": (content.title + " " + (platform_config.get("caption", "") or content.text or ""))[:200],
            "cover_url": content.cover_path or platform_config.get("cover_url", ""),
            "thumbnail_url": platform_config.get("thumbnail_url", ""),
            "page_info": {},
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_API_BASE}/openapi/photo/publish",
                    json=body,
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )

        if resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish {resp.status_code}: {resp.text[:300]}",
            )

        try:
            rdata = resp.json()
        except Exception:
            rdata = {}

        if rdata.get("result") != 1:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {rdata}",
                payload=upload_payload,
            )

        photo_id = (rdata.get("photo_info") or {}).get("photo_id", "")
        published_url = (rdata.get("photo_info") or {}).get("share_url", "")
        return PublishResult(
            success=True, platform=self.platform_id,
            platform_content_id=str(photo_id),
            published_url=published_url,
            payload={
                "photo_id": photo_id,
                "video_id": video_id,
                "note": "视频已提交,审核通过后可见",
                **upload_payload,
            },
        )
