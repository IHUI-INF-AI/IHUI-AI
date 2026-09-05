# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Jimeng(字节即梦/火山引擎)适配器 — 真实 API 实现(2026-09-05 起,替换 503 stub)。

双模式,按可用凭据自动选择:
- Ark 模式(方舟,优先):Bearer ARK_API_KEY(或 api_key 直接传方舟 key),
  OpenAI 风格端点 {base}/api/v3:
    图像 POST /images/generations(doubao-seedream-*,同步,直接返回 data[].url)
    视频 POST /contents/generations/tasks(doubao-seedance-*,建任务)→ GET ?id= 轮询
- V4 模式:火山引擎视觉服务 visual.volcengineapi.com,HMAC-SHA256 V4 签名
  (凭据 "AK:SK" 或 ARK_ACCESS_KEY + ARK_SECRET_KEY):
    图像 Action=CVProcess(req_key=high_aes_general_v21,同步返回 image_urls)
    视频 Action=CVSync2AsyncSubmitTask(req_key=video_generation)→
         CVSync2AsyncGetResult 轮询至 done/failed
- chat:不支持(即梦无对话 API),显式报错而非 503"待接入"
环境变量:ARK_API_KEY / ARK_ACCESS_KEY / ARK_SECRET_KEY / ARK_REGION(cn-north-1)、
ARK_API_BASE(默认 https://ark.cn-beijing.volces.com)、
JIMENG_API_BASE(默认 https://visual.volcengineapi.com)、
JIMENG_IMAGE_REQ_KEY(默认 high_aes_general_v21)、
ARK_IMAGE_MODEL(默认 doubao-seedream-4-0)、ARK_VIDEO_MODEL(默认 doubao-seedance-1-0-pro)
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import quote

import httpx

from ..core.llm_gateway import get_http_client
from .base_provider import BaseProvider, ProviderError

_ARK_DEFAULT_BASE = "https://ark.cn-beijing.volces.com"
_VISUAL_DEFAULT_BASE = "https://visual.volcengineapi.com"
_V4_VERSION = "2022-08-31"


def _uri_encode(value: str) -> str:
    """RFC3986 URI 编码(仅保留非保留字符)。"""
    return quote(str(value), safe="-_.~")


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def volcano_v4_signature(
    ak: str,
    sk: str,
    *,
    method: str,
    host: str,
    path: str,
    query: dict[str, str],
    body: bytes,
    now: datetime | None = None,
    region: str = "cn-north-1",
    service: str = "cv",
) -> dict[str, str]:
    """火山引擎 V4 请求签名(HMAC-SHA256 派生链),返回完整请求头。

    签名链: kDate=HMAC(SK,date) → kRegion=HMAC(kDate,region) →
            kService=HMAC(kRegion,service) → kSigning=HMAC(kService,"request")
    """
    x_date = (now or datetime.now(UTC)).strftime("%Y%m%dT%H%M%SZ")
    short_date = x_date[:8]
    payload_hash = _sha256_hex(body)
    signed_headers = "content-type;host;x-content-sha256;x-date"
    canonical_headers = (
        f"content-type:application/json\nhost:{host}\n"
        f"x-content-sha256:{payload_hash}\nx-date:{x_date}\n"
    )
    canonical_query = "&".join(
        f"{_uri_encode(k)}={_uri_encode(v)}" for k, v in sorted(query.items())
    )
    canonical_request = "\n".join(
        [
            method.upper(),
            path or "/",
            canonical_query,
            canonical_headers,
            signed_headers,
            payload_hash,
        ]
    )
    scope = f"{short_date}/{region}/{service}/request"
    string_to_sign = "\n".join(
        ["HMAC-SHA256", x_date, scope, _sha256_hex(canonical_request.encode("utf-8"))]
    )
    k_date = _hmac_sha256(sk.encode("utf-8"), short_date)
    k_region = _hmac_sha256(k_date, region)
    k_service = _hmac_sha256(k_region, service)
    k_signing = _hmac_sha256(k_service, "request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-Date": x_date,
        "X-Content-Sha256": payload_hash,
        "Authorization": (
            f"HMAC-SHA256 Credential={ak}/{scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        ),
    }


class JimengProvider(BaseProvider):
    """字节即梦适配器:Ark(方舟)或视觉服务 V4 签名,图像/视频真实生成。"""

    def __init__(self, api_key: str | None, api_base: str | None = None, timeout: float = 120.0):
        # 凭据解析:api_key 含 ":" 视为 "AK:SK"(V4 模式),否则视为方舟 key(Ark 模式)
        if api_key and ":" in api_key:
            self._ak, _, self._sk = api_key.partition(":")
            self._ak, self._sk = self._ak.strip(), self._sk.strip()
            self._ark_key = ""
        else:
            self._ark_key = (api_key or "").strip() or os.environ.get("ARK_API_KEY", "").strip()
            self._ak = os.environ.get("ARK_ACCESS_KEY", "").strip()
            self._sk = os.environ.get("ARK_SECRET_KEY", "").strip()
        if self._ark_key:
            self.mode = "ark"
            base = api_base or os.environ.get("ARK_API_BASE") or _ARK_DEFAULT_BASE
        elif self._ak and self._sk:
            self.mode = "v4"
            base = api_base or os.environ.get("JIMENG_API_BASE") or _VISUAL_DEFAULT_BASE
        else:
            self.mode = "none"
            base = api_base or os.environ.get("JIMENG_API_BASE") or _VISUAL_DEFAULT_BASE
        super().__init__(api_key or "", base, timeout)
        self.base_url = base.rstrip("/")
        self._host = self.base_url.split("://", 1)[-1]

    @property
    def configured(self) -> bool:
        return self.mode in ("ark", "v4")

    def _require_configured(self) -> None:
        if not self.configured:
            raise ProviderError(
                "Jimeng 未配置:需 ARK_API_KEY(方舟模式)或 "
                "ARK_ACCESS_KEY + ARK_SECRET_KEY(视觉服务 V4 模式)",
                503,
            )

    # ------------------------------------------------------------------
    # 通用请求
    # ------------------------------------------------------------------
    async def _post_ark(self, url: str, body: dict[str, Any]) -> dict[str, Any]:
        """方舟 Bearer 请求。"""
        try:
            resp = await get_http_client().request(
                "POST", url,
                headers={"Content-Type": "application/json",
                         "Authorization": f"Bearer {self._ark_key}"},
                json=body, timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Jimeng(Ark) 网络异常: {e}") from e
        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(
                f"Jimeng(Ark) 响应非合法 JSON: {resp.status_code} {resp.text[:300]!r}",
                resp.status_code,
            ) from e
        if resp.status_code >= 400:
            err = data.get("error", {}) if isinstance(data, dict) else {}
            raise ProviderError(
                f"Jimeng(Ark) 调用失败: {resp.status_code} "
                f"{err.get('message', str(data)[:300])}",
                resp.status_code,
            )
        return cast(dict[str, Any], data)

    async def _v4_post(self, action: str, body: dict[str, Any]) -> dict[str, Any]:
        """视觉服务 V4 签名 POST(签名覆盖精确请求字节)。"""
        body_bytes = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        query = {"Action": action, "Version": _V4_VERSION}
        headers = volcano_v4_signature(
            self._ak, self._sk, method="POST", host=self._host, path="/",
            query=query, body=body_bytes,
            region=os.environ.get("ARK_REGION", "cn-north-1"),
        )
        try:
            resp = await get_http_client().post(
                self.base_url, params=query, content=body_bytes,
                headers=headers, timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Jimeng(V4) 网络异常: {e}") from e
        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(
                f"Jimeng(V4) 响应非合法 JSON: {resp.status_code} {resp.text[:300]!r}",
                resp.status_code,
            ) from e
        # 视觉服务:HTTP 200 但 body.code != 10000 表示业务错误
        code = data.get("code")
        if resp.status_code >= 400 or (code is not None and code not in (0, 10000)):
            raise ProviderError(
                f"Jimeng(V4) 调用失败(code={code}): {str(data.get('message', data))[:300]}",
                resp.status_code if resp.status_code >= 400 else 502,
            )
        inner = data.get("data")
        return inner if isinstance(inner, dict) else {}

    # ------------------------------------------------------------------
    # chat(不支持)
    # ------------------------------------------------------------------
    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise ProviderError("Jimeng 仅支持图像/视频生成,chat 接口不可用", 400)

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        raise ProviderError("Jimeng 仅支持图像/视频生成,chat 接口不可用", 400)
        yield {}  # pragma: no cover

    # ------------------------------------------------------------------
    # 图像生成
    # ------------------------------------------------------------------
    async def generate_image(
        self,
        prompt: str,
        model: str,
        *,
        size: str = "1024x1024",
        **kwargs: Any,
    ) -> dict[str, Any]:
        self._require_configured()
        if self.mode == "ark":
            return await self._ark_image(prompt, model, size, **kwargs)
        return await self._v4_image(prompt, model, size, **kwargs)

    async def _ark_image(self, prompt: str, model: str, size: str, **kwargs: Any) -> dict[str, Any]:
        used = (model or "").removeprefix("jimeng-")
        if not used or "seedream" not in used:
            used = os.environ.get("ARK_IMAGE_MODEL", "doubao-seedream-4-0")
        body: dict[str, Any] = {
            "model": used,
            "prompt": prompt,
            "size": size,
            "response_format": "url",
        }
        watermark = kwargs.get("watermark")
        if watermark is False:
            body["watermark"] = False
        data = await self._post_ark(f"{self.base_url}/api/v3/images/generations", body)
        items = [
            {"url": d.get("url", "")}
            for d in (data.get("data") or [])
            if isinstance(d, dict) and d.get("url")
        ]
        if not items:
            raise ProviderError(f"Jimeng(Ark) 图像响应缺少图片 URL: {str(data)[:200]}", 502)
        return {"provider": "jimeng", "model": used, "data": items}

    async def _v4_image(self, prompt: str, model: str, size: str, **kwargs: Any) -> dict[str, Any]:
        req_key = (model or "").removeprefix("jimeng-") or os.environ.get(
            "JIMENG_IMAGE_REQ_KEY", "high_aes_general_v21"
        )
        try:
            w, _, h = size.lower().partition("x")
            width, height = int(w), int(h)
        except ValueError:
            width = height = 1024
        body: dict[str, Any] = {
            "req_key": req_key,
            "prompt": prompt,
            "width": width,
            "height": height,
            "return_url": True,
            "logo_info": {"add_logo": False},
        }
        neg = kwargs.get("negative_prompt")
        if neg:
            body["negative_prompt"] = neg
        seed = kwargs.get("seed")
        if isinstance(seed, int):
            body["seed"] = seed
        data = await self._v4_post("CVProcess", body)
        urls = self._extract_image_urls(data)
        if not urls:
            raise ProviderError(f"Jimeng(V4) 图像响应缺少图片 URL: {str(data)[:200]}", 502)
        return {"provider": "jimeng", "model": req_key, "data": [{"url": u} for u in urls]}

    @staticmethod
    def _extract_image_urls(data: dict[str, Any]) -> list[str]:
        """兼容三种返回形态: image_urls / resp_data(JSON 字符串)/ binary_data_base64。"""
        urls: list[Any] = data.get("image_urls") or []
        if not urls:
            rd = data.get("resp_data")
            if isinstance(rd, str):
                try:
                    rd = json.loads(rd)
                except ValueError:
                    rd = {}
            if isinstance(rd, dict):
                urls = rd.get("image_urls") or []
        if not urls:
            b64s = data.get("binary_data_base64") or []
            urls = [f"data:image/png;base64,{b}" for b in b64s if b]
        return [u for u in urls if isinstance(u, str) and u]

    # ------------------------------------------------------------------
    # 视频生成(异步任务 + 轮询)
    # ------------------------------------------------------------------
    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        self._require_configured()
        if self.mode == "ark":
            return await self._ark_video(prompt, model, duration, **kwargs)
        return await self._v4_video(prompt, model, duration, **kwargs)

    async def _ark_video(
        self, prompt: str, model: str, duration: int, **kwargs: Any
    ) -> dict[str, Any]:
        used = (model or "").removeprefix("jimeng-")
        if not used or "seedance" not in used:
            used = os.environ.get("ARK_VIDEO_MODEL", "doubao-seedance-1-0-pro")
        text = f"{prompt} --dur {int(duration)}"
        ratio = kwargs.get("aspect_ratio")
        if ratio:
            text += f" --rt {ratio}"
        image = kwargs.get("image")
        content: list[dict[str, Any]] = [{"type": "text", "text": text}]
        if image:
            content.append({"type": "image_url", "image_url": {"url": image}})
        data = await self._post_ark(
            f"{self.base_url}/api/v3/contents/generations/tasks",
            {"model": used, "content": content},
        )
        task_id = data.get("id")
        if not task_id:
            raise ProviderError(f"Jimeng(Ark) 视频任务缺少 id: {str(data)[:200]}", 502)
        result = await self._poll_task(
            fetch=lambda: self._get_ark_task(task_id),
            status_of=lambda d: str(d.get("status", "")),
            done={"succeeded"},
            failed={"failed", "cancelled", "expired"},
            label=f"Ark 视频 {task_id}",
        )
        video_url = (result.get("content") or {}).get("video_url", "")
        if not video_url:
            raise ProviderError(f"Jimeng(Ark) 任务 {task_id} 无视频 URL", 502)
        return {
            "provider": "jimeng",
            "model": used,
            "task_id": task_id,
            "video_url": video_url,
        }

    async def _get_ark_task(self, task_id: str) -> dict[str, Any]:
        try:
            resp = await get_http_client().get(
                f"{self.base_url}/api/v3/contents/generations/tasks",
                params={"id": task_id},
                headers={"Authorization": f"Bearer {self._ark_key}"},
                timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Jimeng(Ark) 任务查询网络异常: {e}") from e
        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(
                f"Jimeng(Ark) 任务响应非合法 JSON: {resp.status_code}", resp.status_code
            ) from e
        if resp.status_code >= 400:
            raise ProviderError(
                f"Jimeng(Ark) 任务查询失败: {resp.status_code} {str(data)[:300]}",
                resp.status_code,
            )
        return cast(dict[str, Any], data)

    async def _v4_video(
        self, prompt: str, model: str, duration: int, **kwargs: Any
    ) -> dict[str, Any]:
        req_key = (model or "").removeprefix("jimeng-") or "video_generation"
        body: dict[str, Any] = {
            "req_key": req_key,
            "prompt": prompt,
            "duration": int(duration),
        }
        image = kwargs.get("image")
        if image:
            body["image_url"] = image
        data = await self._v4_post("CVSync2AsyncSubmitTask", body)
        task_id = data.get("task_id")
        if not task_id:
            raise ProviderError(f"Jimeng(V4) 视频任务缺少 task_id: {str(data)[:200]}", 502)

        async def fetch() -> dict[str, Any]:
            return await self._v4_post(
                "CVSync2AsyncGetResult", {"req_key": req_key, "task_id": task_id}
            )

        result = await self._poll_task(
            fetch=fetch,
            status_of=lambda d: str(d.get("status", "")),
            done={"done"},
            failed={"failed", "expired", "not_found"},
            label=f"V4 视频 {task_id}",
        )
        video_url = self._extract_video_url(result)
        if not video_url:
            raise ProviderError(f"Jimeng(V4) 任务 {task_id} 无视频 URL", 502)
        return {
            "provider": "jimeng",
            "model": req_key,
            "task_id": task_id,
            "video_url": video_url,
        }

    @staticmethod
    def _extract_video_url(data: dict[str, Any]) -> str:
        """兼容三种返回形态: video_url / video_urls / resp_data(JSON 字符串)。"""
        url = data.get("video_url")
        if isinstance(url, str) and url:
            return url
        urls = data.get("video_urls") or []
        if urls and isinstance(urls[0], dict):
            return str(urls[0].get("video_url") or urls[0].get("url") or "")
        if urls and isinstance(urls[0], str):
            return urls[0]
        rd = data.get("resp_data")
        if isinstance(rd, str):
            try:
                rd = json.loads(rd)
            except ValueError:
                rd = {}
        if isinstance(rd, dict):
            return str(rd.get("video_url") or "")
        return ""

    # ------------------------------------------------------------------
    # 通用任务轮询(指数退避 5s → 10s 封顶,最长 10 分钟)
    # ------------------------------------------------------------------
    async def _poll_task(
        self,
        *,
        fetch: Any,
        status_of: Any,
        done: set[str],
        failed: set[str],
        label: str,
        interval: float = 5.0,
        max_wait: float = 600.0,
    ) -> dict[str, Any]:
        deadline = time.monotonic() + max_wait
        delay = interval
        while True:
            data = await fetch()
            status = status_of(data).lower()
            if status in done:
                return cast(dict[str, Any], data)
            if status in failed:
                raise ProviderError(f"Jimeng {label} 任务失败(status={status})", 502)
            if time.monotonic() >= deadline:
                raise ProviderError(
                    f"Jimeng {label} 轮询超时({int(max_wait)}s,最后状态={status})", 504
                )
            await asyncio.sleep(delay)
            delay = min(delay * 2, 10.0)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
