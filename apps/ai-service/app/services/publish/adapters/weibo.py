"""微博 适配器(基于微博开放平台 OAuth2 API,完整代码)。

凭证:{ access_token, uid }

实现:
- verify_credentials: GET /2/account/get_uid.json 验证 token
- publish:
  - 图文:POST /2/statuses/upload_url_text.json(图 URL)/ POST /2/statuses/upload.json(图文件)
  - 视频:POST /2/statuses/upload_url_text.json(video_url)

注意:
- 微博开放平台接口需申请权限
- 文字微博 140 字,带图 140 字 + 9 图,视频 140 字描述
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://api.weibo.com"


class WeiboAdapter(BasePlatformAdapter):
    platform_id = "weibo"
    platform_name = "微博"
    supported_formats = ["md", "html", "image", "video"]
    requires_credentials = ["access_token", "uid"]

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        access_token = credentials.get("access_token", "").strip()
        if not access_token:
            return False, "missing access_token"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/2/account/get_uid.json",
                    params={"access_token": access_token},
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        try:
            data = resp.json()
        except Exception:
            return False, f"invalid json: {resp.text[:200]}"

        uid = data.get("uid")
        if not uid:
            return False, f"verify failed: {data}"

        # 取用户信息
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                u_resp = await client.get(
                    f"{_API_BASE}/2/users/show.json",
                    params={"access_token": access_token, "uid": uid},
                )
            if u_resp.status_code == 200:
                udata = u_resp.json()
                name = udata.get("screen_name") or udata.get("name") or "?"
                return True, f"connected as {name} (uid={uid})"
        except Exception:
            pass
        return True, f"connected (uid={uid})"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        access_token = credentials.get("access_token", "").strip()
        if not access_token:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing access_token",
            )

        # 微博内容(140 字)
        text = content.title or ""
        if content.text:
            text = (text + "\n" + content.text)[:140] if text else content.text[:140]
        elif not text:
            text = platform_config.get("text", "")[:140]
        if not text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing text content (140 chars required)",
            )

        # 选择接口
        fmt = content.format
        try:
            if fmt == "video":
                # 视频微博(通过 URL)
                video_url = content.file_path if str(content.file_path).startswith("http") else platform_config.get("video_url", "")
                if not video_url:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="video format requires file_path as URL or video_url in platform_config",
                    )
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{_API_BASE}/2/statuses/upload_url_text.json",
                        data={
                            "access_token": access_token,
                            "status": text,
                            "video_url": video_url,
                        },
                    )
            elif fmt == "image":
                # 图片微博(上传图片文件)
                if not content.file_path:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="image format requires file_path",
                    )
                p = Path(content.file_path)
                if not p.is_file():
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message=f"image not found: {content.file_path}",
                    )
                with open(p, "rb") as f:
                    files = {"pic": (p.name, f, "image/jpeg")}
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        # 上传图片到 Pic API
                        pic_resp = await client.post(
                            f"{_API_BASE}/2/statuses/uploadPic.json",
                            data={"access_token": access_token},
                            files=files,
                        )
                if pic_resp.status_code != 200:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message=f"upload pic {pic_resp.status_code}: {pic_resp.text[:300]}",
                    )
                pic_data = pic_resp.json()
                pic_id = pic_data.get("pic_id") or pic_data.get("pic", {}).get("pic_id", "")
                if not pic_id:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message=f"upload pic no pic_id: {pic_data}",
                    )
                # 发图文
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{_API_BASE}/2/statuses/upload_url_text.json",
                        data={
                            "access_token": access_token,
                            "status": text,
                            "pic_id": pic_id,
                        },
                    )
            else:
                # md/html → 纯文本
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{_API_BASE}/2/statuses/update.json",
                        data={
                            "access_token": access_token,
                            "status": text,
                        },
                    )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"http error: {type(e).__name__}: {e}",
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

        if "error" in rdata or "error_code" in rdata:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: error_code={rdata.get('error_code')} "
                              f"error={rdata.get('error')}",
            )

        weibo_id = rdata.get("id") or rdata.get("idstr") or ""
        weibo_mid = rdata.get("mid") or ""
        uid = (rdata.get("user") or {}).get("id") or credentials.get("uid", "")
        published_url = f"https://weibo.com/{uid}/{weibo_mid}" if uid and weibo_mid else ""

        return PublishResult(
            success=True, platform=self.platform_id,
            platform_content_id=str(weibo_id),
            published_url=published_url,
            payload={
                "weibo_id": weibo_id,
                "mid": weibo_mid,
                "format": fmt,
            },
        )
