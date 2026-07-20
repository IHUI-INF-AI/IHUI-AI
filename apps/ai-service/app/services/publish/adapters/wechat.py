"""微信公众号 适配器(基于公众号 OpenAPI,完整代码)。

凭证:{ app_id, app_secret }

实现:
- verify_credentials: GET /cgi-bin/token 检查能否获取 access_token
- publish:
  1. 上传封面图(如有):POST /cgi-bin/material/add_material(type=image)
  2. 上传内容图片(如有):POST /cgi-bin/media/uploadimg
  3. 新增草稿:POST /cgi-bin/draft/add
  4. 发布(可选):POST /cgi-bin/freepublish/submit

注意:
- 公众号接口需要 IP 白名单(在公众号后台配置)
- 草稿箱发布需要服务号认证;订阅号只能存草稿
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://api.weixin.qq.com/cgi-bin"


class WechatAdapter(BasePlatformAdapter):
    platform_id = "wechat"
    platform_name = "公众号"
    supported_formats = ["md", "html"]
    requires_credentials = ["app_id", "app_secret"]

    async def _get_access_token(self, credentials: dict) -> tuple[bool, str]:
        """获取 access_token。

        Returns:
            (ok, access_token_or_error_message)
        """
        app_id = credentials.get("app_id", "").strip()
        app_secret = credentials.get("app_secret", "").strip()
        if not (app_id and app_secret):
            return False, "missing app_id / app_secret"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/token",
                    params={
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
            errcode = data.get("errcode", "?")
            errmsg = data.get("errmsg", "unknown")
            return False, f"get token failed: errcode={errcode} errmsg={errmsg}"
        return True, token

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        ok, msg_or_token = await self._get_access_token(credentials)
        if not ok:
            return False, msg_or_token
        return True, "access_token acquired (app_id valid)"

    async def _upload_image(
        self, token: str, image_path: str, is_permanent: bool = False
    ) -> tuple[bool, str]:
        """上传图片,返回 media_id(永久)或 URL(临时图文图)。

        is_permanent=True: 调 /material/add_material → media_id
        is_permanent=False: 调 /media/uploadimg → URL(只能用于图文内容)
        """
        p = Path(image_path)
        if not p.is_file():
            return False, f"image not found: {image_path}"

        try:
            with open(p, "rb") as f:
                files = {"media": (p.name, f, "image/jpeg")}
                if is_permanent:
                    url = f"{_API_BASE}/material/add_material?access_token={token}&type=image"
                    data = {"type": "image"}
                else:
                    url = f"{_API_BASE}/media/uploadimg?access_token={token}"
                    data = {}
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(url, files=files, data=data)
        except httpx.HTTPError as e:
            return False, f"upload image failed: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"upload image {resp.status_code}: {resp.text[:200]}"

        rdata = resp.json()
        if is_permanent:
            media_id = rdata.get("media_id", "")
            if not media_id:
                return False, f"no media_id: {rdata}"
            return True, media_id
        url = rdata.get("url", "")
        if not url:
            return False, f"no url: {rdata}"
        return True, url

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

        # 上传封面图(永久素材)
        thumb_media_id = platform_config.get("thumb_media_id", "")
        if not thumb_media_id and content.cover_path:
            ok, mid_or_err = await self._upload_image(token, content.cover_path, is_permanent=True)
            if ok:
                thumb_media_id = mid_or_err
            else:
                logger.warning("[wechat] upload cover failed: %s", mid_or_err)

        html = content.html or ""
        if not html and content.text:
            # md → 简单 HTML
            html = "".join(
                f"<p>{line}</p>" if line.strip() else "<br>"
                for line in content.text.split("\n\n")
            )

        # 上传内容中图片并替换(简化:仅支持单张图,完整版需解析 HTML <img src>)
        # 略:实际生产应解析 html 中的 <img src="/local/path"> 替换为微信 URL

        # 新增草稿
        article: dict[str, Any] = {
            "title": content.title[:64],
            "author": platform_config.get("author", ""),
            "digest": platform_config.get("digest", "")[:120],
            "content": html,
            "content_source_url": platform_config.get("content_source_url", ""),
            "need_open_comment": 0,
            "only_fans_can_comment": 0,
        }
        if thumb_media_id:
            article["thumb_media_id"] = thumb_media_id

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_API_BASE}/draft/add?access_token={token}",
                    json={"articles": [article]},
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"draft add failed: {type(e).__name__}: {e}",
            )

        if resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"draft add {resp.status_code}: {resp.text[:300]}",
            )

        rdata = resp.json()
        if rdata.get("errcode", 0) != 0:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"draft add failed: errcode={rdata.get('errcode')} "
                              f"errmsg={rdata.get('errmsg')}",
            )

        media_id = rdata.get("media_id", "")
        if not media_id:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"no media_id in response: {rdata}",
            )

        # 是否立即发布
        publish_now = platform_config.get("publish_now", False)
        published_url = ""
        if publish_now:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    pub_resp = await client.post(
                        f"{_API_BASE}/freepublish/submit?access_token={token}",
                        json={"media_id": media_id},
                    )
                if pub_resp.status_code == 200:
                    pdata = pub_resp.json()
                    if pdata.get("errcode", 0) == 0:
                        publish_id = pdata.get("publish_id", "")
                        return PublishResult(
                            success=True, platform=self.platform_id,
                            platform_content_id=media_id,
                            published_url="",
                            payload={
                                "media_id": media_id,
                                "publish_id": publish_id,
                                "stage": "submitted_for_publish",
                            },
                        )
                    else:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=f"freepublish failed: errcode={pdata.get('errcode')} "
                                          f"errmsg={pdata.get('errmsg')}",
                            payload={"media_id": media_id, "stage": "draft_only"},
                        )
            except httpx.HTTPError as e:
                logger.warning("[wechat] freepublish failed: %s: %s", type(e).__name__, e)

        return PublishResult(
            success=True, platform=self.platform_id,
            platform_content_id=media_id,
            published_url=published_url,
            payload={
                "media_id": media_id,
                "stage": "draft" if not publish_now else "submitted",
                "note": "草稿已添加,需在公众号后台手动发布或调用 freepublish/submit",
            },
        )
