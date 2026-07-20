"""B站 适配器(基于 Cookie + Web API,完整代码)。

凭证:{ sessdata, bili_jct, dedeuserid }

实现:
- verify_credentials: GET /x/web-interface/nav 检查登录状态
- publish: 视频上传 → 三步流程:
  1. POST /preupload 获取上传凭证(upload token, endpoint, biz_id)
  2. PUT/POST 上传视频文件分片到 B站 OSS(此处简化:直接 PUT 完整文件)
  3. POST /x/web-interface/v1/draft/add 提交元数据(title/desc/tid/cover/tag)

注意:
- B站 Web API 非官方公开接口,可能随平台变更失效
- 视频审核通常需要 1-2 小时
- tid(分区 ID)需根据视频类型选择,默认 122(野生技术协会)
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://api.bilibili.com"


class BilibiliAdapter(BasePlatformAdapter):
    platform_id = "bilibili"
    platform_name = "B站"
    supported_formats = ["video"]
    requires_credentials = ["sessdata", "bili_jct", "dedeuserid"]

    def _cookies(self, credentials: dict) -> dict[str, str]:
        return {
            "SESSDATA": credentials.get("sessdata", ""),
            "bili_jct": credentials.get("bili_jct", ""),
            "DedeUserID": credentials.get("dedeuserid", ""),
        }

    def _headers(self, credentials: dict) -> dict[str, str]:
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://member.bilibili.com",
            "Origin": "https://member.bilibili.com",
        }

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        sessdata = credentials.get("sessdata", "").strip()
        if not sessdata:
            return False, "missing sessdata cookie"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/x/web-interface/nav",
                    cookies=self._cookies(credentials),
                    headers=self._headers(credentials),
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        try:
            data = resp.json()
        except Exception:
            return False, f"invalid json response: {resp.text[:200]}"

        if data.get("code") != 0:
            return False, f"not logged in: code={data.get('code')} msg={data.get('message')}"

        uinfo = data.get("data") or {}
        uname = uinfo.get("uname") or "?"
        uid = uinfo.get("mid") or "?"
        vip = uinfo.get("vipStatus", 0)
        return True, f"connected as {uname} (uid={uid}, vip={vip})"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        if content.format != "video":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"B站 only supports video format, got {content.format}",
            )
        if not content.file_path:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing file_path (video file required)",
            )

        video_path = Path(content.file_path)
        if not video_path.is_file():
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"video file not found: {content.file_path}",
            )
        file_size = video_path.stat().st_size
        if file_size == 0:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="video file is empty",
            )

        # Step 1: /preupload 获取上传凭证
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_API_BASE}/preupload",
                    data={
                        "name": video_path.name,
                        "size": file_size,
                        "r": "upos",
                        "profile": "ugcfx/bup",
                        "ssl": 0,
                        "version": "2.14.0",
                        "build": 2140000,
                        "upcdn": "bda2",
                        "probe_version": 20221109,
                    },
                    cookies=self._cookies(credentials),
                    headers=self._headers(credentials),
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"preupload failed: {type(e).__name__}: {e}",
            )

        if resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"preupload {resp.status_code}: {resp.text[:300]}",
            )

        try:
            pre_data = resp.json()
        except Exception:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"preupload invalid json: {resp.text[:300]}",
            )

        upos_uri = pre_data.get("upos_uri", "")
        biz_id = pre_data.get("biz_id", "")
        auth = pre_data.get("auth", "")
        endpoint = pre_data.get("endpoint", "https://upos-sz-upcdnbda2.bilivideo.com")
        chunk_size = pre_data.get("chunk_size", 4 * 1024 * 1024)

        if not upos_uri:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"preupload missing upos_uri: {pre_data}",
            )

        # Step 2: 初始化分片上传
        upos_path = upos_uri.replace("upos://", "")
        upload_url = f"{endpoint}/{upos_path}"
        n_chunks = (file_size + chunk_size - 1) // chunk_size

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                init_resp = await client.post(
                    f"{upload_url}?uploads&output=json",
                    headers={
                        "X-Upos-Auth": auth,
                        "Content-Type": "application/octet-stream",
                    },
                    data=b"",
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"init upload failed: {type(e).__name__}: {e}",
            )

        if init_resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"init upload {init_resp.status_code}: {init_resp.text[:300]}",
            )

        # Step 3: 分片上传(简化:每个分片顺序 PUT)
        upload_id = ""
        try:
            upload_id = init_resp.json().get("upload_id", "")
        except Exception:
            pass

        try:
            with open(video_path, "rb") as f:
                for i in range(n_chunks):
                    chunk = f.read(chunk_size)
                    async with httpx.AsyncClient(timeout=300.0) as client:
                        part_resp = await client.put(
                            f"{upload_url}",
                            params={
                                "partNumber": i + 1,
                                "uploadId": upload_id,
                                "chunk": i,
                                "chunks": n_chunks,
                                "size": len(chunk),
                                "start": i * chunk_size,
                                "end": i * chunk_size + len(chunk),
                                "total": file_size,
                            },
                            headers={
                                "X-Upos-Auth": auth,
                                "Content-Type": "application/octet-stream",
                            },
                            content=chunk,
                        )
                    if part_resp.status_code != 200:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=f"chunk {i+1}/{n_chunks} upload failed: "
                                          f"{part_resp.status_code} {part_resp.text[:200]}",
                        )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"upload chunks failed: {type(e).__name__}: {e}",
            )

        # Step 4: 合并分片 + 提交草稿
        title = (content.title or "Untitled")[:80]
        desc = (platform_config.get("desc", "") or content.text or "")[:2000]
        tid = int(platform_config.get("tid", 122))  # 默认野生技术协会
        tag = platform_config.get("tag", "")
        cover = content.cover_path or ""

        # 视频文件名(用于最终元数据)
        filename = f"{upos_path.split('/')[-1]}.{video_path.suffix.lstrip('.')}"

        submit_data = {
            "copyright": platform_config.get("copyright", 1),  # 1=自制 2=转载
            "videos": [{
                "filename": filename,
                "title": title,
                "desc": desc,
                "cid": biz_id,
                "page": 1,
            }],
            "source": platform_config.get("source", ""),
            "tid": tid,
            "cover": cover,
            "title": title,
            "tag": tag,
            "desc_format_id": 0,
            "desc": desc,
            "dynamic": platform_config.get("dynamic", ""),
            "subtitle": {"open": 0, "lan": ""},
            "csrf": credentials.get("bili_jct", ""),
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                submit_resp = await client.post(
                    f"{_API_BASE}/x/web-interface/v1/draft/add",
                    data=submit_data,
                    cookies=self._cookies(credentials),
                    headers=self._headers(credentials),
                )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"submit draft failed: {type(e).__name__}: {e}",
            )

        if submit_resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"submit {submit_resp.status_code}: {submit_resp.text[:300]}",
            )

        try:
            sdata = submit_resp.json()
        except Exception:
            sdata = {}

        if sdata.get("code") != 0:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"submit failed: code={sdata.get('code')} msg={sdata.get('message')}",
            )

        avid = (sdata.get("data") or {}).get("aid") or ""
        bvid = (sdata.get("data") or {}).get("bvid") or ""
        published_url = f"https://www.bilibili.com/video/{bvid}" if bvid else ""

        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=str(avid),
            payload={
                "aid": avid,
                "bvid": bvid,
                "biz_id": biz_id,
                "file_size": file_size,
                "is_draft": True,
                "note": "B站 视频提交后进入审核,1-2 小时后可见",
            },
        )
