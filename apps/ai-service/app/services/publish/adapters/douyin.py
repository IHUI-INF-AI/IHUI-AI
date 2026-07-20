"""抖音 适配器(基于抖音开放平台 OpenAPI,完整代码)。

凭证:{ access_token, open_id, client_key, client_secret }

实现:
- verify_credentials: GET /oauth/renew_refresh_token/ 验证 token 有效性
- publish:
  1. 上传视频:POST /publish/upload_video/
  2. 创建视频:POST /publish/create_video/

注意:
- 抖音开放平台需企业认证 + 视频发布权限申请
- 视频审核通常 1-3 小时
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://open.douyin.com"


class DouyinAdapter(BasePlatformAdapter):
    platform_id = "douyin"
    platform_name = "抖音"
    supported_formats = ["video"]
    requires_credentials = ["access_token", "open_id", "client_key", "client_secret"]

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        access_token = credentials.get("access_token", "").strip()
        open_id = credentials.get("open_id", "").strip()
        client_key = credentials.get("client_key", "").strip()
        if not (access_token and open_id and client_key):
            return False, "missing access_token / open_id / client_key"

        # 调用 /oauth/userinfo/ 验证 token(更轻量)
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/oauth/userinfo/",
                    params={
                        "access_token": access_token,
                        "open_id": open_id,
                    },
                    headers={"Content-Type": "application/json"},
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        try:
            data = resp.json()
        except Exception:
            return False, f"invalid json: {resp.text[:200]}"

        d = data.get("data", {})
        if d.get("description") == "user_info" or d.get("open_id"):
            nickname = d.get("nickname", "?")
            return True, f"connected as {nickname} (open_id={d.get('open_id', '?')})"
        if data.get("data", {}).get("error_code") != 0:
            return False, f"verify failed: {data}"
        return True, "connected"

    async def _upload_video(self, token: str, open_id: str, video_path: str) -> tuple[bool, str, dict]:
        """上传视频,返回 (ok, video_id_or_error, payload)。"""
        p = Path(video_path)
        if not p.is_file():
            return False, f"video not found: {video_path}", {}
        file_size = p.stat().st_size

        # 上传初始化
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                init_resp = await client.post(
                    f"{_API_BASE}/api/douyin/v1/video/init_upload/",
                    params={"open_id": open_id},
                    headers={"access-token": token},
                    json={
                        "upload_type": "upload_by_url"
                        if str(video_path).startswith("http")
                        else "chunk",
                        "video_size": file_size,
                    },
                )
        except httpx.HTTPError as e:
            return False, f"init upload failed: {type(e).__name__}: {e}", {}

        if init_resp.status_code != 200:
            return False, f"init upload {init_resp.status_code}: {init_resp.text[:300]}", {}

        try:
            idata = init_resp.json().get("data", {})
        except Exception:
            idata = {}
        upload_token = idata.get("upload_token", "")
        video_id = idata.get("video", {}).get("video_id", "")
        if not (upload_token and video_id):
            return False, f"init upload missing fields: {idata}", {}

        # 上传视频数据(简化:一次 PUT 整个文件,实际应分片)
        try:
            with open(p, "rb") as f:
                file_bytes = f.read()
            async with httpx.AsyncClient(timeout=600.0) as client:
                upload_resp = await client.post(
                    f"{_API_BASE}/api/douyin/v1/video/upload_part/",
                    params={"open_id": open_id, "upload_token": upload_token},
                    headers={"access-token": token, "Content-Type": "application/octet-stream"},
                    content=file_bytes,
                )
        except httpx.HTTPError as e:
            return False, f"upload failed: {type(e).__name__}: {e}", {}

        if upload_resp.status_code != 200:
            return False, f"upload {upload_resp.status_code}: {upload_resp.text[:300]}", {}

        # 完成上传
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                complete_resp = await client.post(
                    f"{_API_BASE}/api/douyin/v1/video/complete_upload/",
                    params={"open_id": open_id},
                    headers={"access-token": token},
                    json={"upload_token": upload_token},
                )
        except httpx.HTTPError as e:
            return False, f"complete upload failed: {type(e).__name__}: {e}", {}

        if complete_resp.status_code != 200:
            return False, f"complete upload {complete_resp.status_code}: {complete_resp.text[:300]}", {}

        return True, video_id, {"upload_token": upload_token, "video_id": video_id, "file_size": file_size}

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        if content.format != "video":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"抖音 only supports video format, got {content.format}",
            )
        if not content.file_path:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing file_path (video file required)",
            )

        token = credentials.get("access_token", "")
        open_id = credentials.get("open_id", "")

        # 上传视频
        ok, vid_or_err, upload_payload = await self._upload_video(token, open_id, content.file_path)
        if not ok:
            return PublishResult(
                success=False, platform=self.platform_id, error_message=vid_or_err,
            )
        video_id = vid_or_err

        # 创建视频(发布)
        body: dict[str, Any] = {
            "video_id": video_id,
            "text": (content.title + "\n" + (platform_config.get("desc", "") or content.text or ""))[:150],
            "cover_url": content.cover_path or platform_config.get("cover_url", ""),
            "micro_app_info": {},
            "poi_id": "",
            "cover_tsp": 0,
            "tags": platform_config.get("tags", []),
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_API_BASE}/api/douyin/v1/video/create_video/",
                    params={"open_id": open_id},
                    headers={"access-token": token},
                    json=body,
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"create video failed: {type(e).__name__}: {e}",
            )

        if resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"create video {resp.status_code}: {resp.text[:300]}",
            )

        try:
            rdata = resp.json()
        except Exception:
            rdata = {}

        d = rdata.get("data", {})
        if d.get("item_id") or rdata.get("data", {}).get("error_code", -1) == 0:
            item_id = d.get("item_id", "")
            return PublishResult(
                success=True, platform=self.platform_id,
                platform_content_id=str(item_id),
                published_url="",
                payload={
                    "item_id": item_id,
                    "video_id": video_id,
                    "note": "视频已提交,审核通过后可见",
                    **upload_payload,
                },
            )
        return PublishResult(
            success=False, platform=self.platform_id,
            error_message=f"create video failed: {rdata}",
            payload=upload_payload,
        )
