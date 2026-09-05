# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌‌​‌‌‌​‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‌
"""Kling(快手可灵)适配器 — 真实 API 实现(2026-09-05 起,替换 503 stub)。

协议:可灵开放平台自有协议(JWT HS256 鉴权,非 OpenAI 兼容)。
- 鉴权:HS256 JWT,header {alg:HS256,typ:JWT},payload {iss:AK,exp:+30min,nbf:-5s},
  Bearer 方式携带。凭据来源(优先级):
    1. api_key 参数,支持 "AK:SK" 冒号分隔格式
    2. KLING_ACCESS_KEY + KLING_SECRET_KEY 环境变量
- 图像:POST /v1/images/text2image(Kolors,同步返回 images,异常时兼容 task_id 轮询)
- 视频:POST /v1/videos/text2video(文生)或 /v1/videos/image2video(图生,传 image 参数)
        → {data:{task_id}} → GET /v1/videos/*/{task_id} 轮询至 succeed/failed
- chat:不支持(可灵无对话 API),显式报错而非 503"待接入"
环境变量:KLING_API_BASE(默认 https://api.klingai.com)、
KLING_IMAGE_MODEL(默认 kolors)、KLING_VIDEO_MODEL(默认 kling-v1)
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
from collections.abc import AsyncIterator
from typing import Any

from .base_provider import BaseProvider, ProviderError

_KLING_DEFAULT_BASE = "https://api.klingai.com"
_KLING_ASPECT_RATIOS = {"1:1", "16:9", "9:16", "4:3", "3:4", "21:10"}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def kling_jwt(ak: str, sk: str, *, now: int | None = None) -> str:
    """生成可灵开放平台 JWT(HS256,无 PyJWT 依赖)。

    签名算法与官方文档一致:base64url(header).base64url(payload).HMAC-SHA256。
    """
    header = {"alg": "HS256", "typ": "JWT"}
    ts = int(now if now is not None else time.time())
    payload = {"iss": ak, "exp": ts + 1800, "nbf": ts - 5}
    h = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h}.{p}".encode("ascii")
    sig = _b64url(hmac.new(sk.encode("utf-8"), signing_input, hashlib.sha256).digest())
    return f"{h}.{p}.{sig}"


class KlingProvider(BaseProvider):
    """快手可灵适配器:真实 JWT 鉴权 + 任务轮询。"""

    def __init__(self, api_key: str | None, api_base: str | None = None, timeout: float = 60.0):
        base = api_base or os.environ.get("KLING_API_BASE") or _KLING_DEFAULT_BASE
        super().__init__(api_key or "", base, timeout)
        self.base_url = base.rstrip("/")
        ak, sk = self._resolve_credentials(api_key)
        self._ak = ak
        self._sk = sk

    @staticmethod
    def _resolve_credentials(api_key: str | None) -> tuple[str, str]:
        """解析 AK/SK:api_key("AK:SK")优先,其次 KLING_ACCESS_KEY/KLING_SECRET_KEY。"""
        if api_key and ":" in api_key:
            ak, _, sk = api_key.partition(":")
            if ak and sk:
                return ak.strip(), sk.strip()
        return (
            os.environ.get("KLING_ACCESS_KEY", "").strip(),
            os.environ.get("KLING_SECRET_KEY", "").strip(),
        )

    @property
    def configured(self) -> bool:
        return bool(self._ak and self._sk)

    def _auth_headers(self) -> dict[str, str]:
        if not self.configured:
            raise ProviderError(
                "Kling 未配置:需 KLING_ACCESS_KEY + KLING_SECRET_KEY 环境变量,"
                '或 api_key 传 "AK:SK" 格式',
                503,
            )
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {kling_jwt(self._ak, self._sk)}",
        }

    def _check_code(self, data: dict[str, Any], url: str) -> dict[str, Any]:
        """可灵协议:HTTP 200 但 body.code != 0 表示业务错误。"""
        code = data.get("code")
        if code not in (None, 0):
            raise ProviderError(
                f"Kling 业务错误(code={code}): {str(data.get('message', data))[:300]}", 502
            )
        inner = data.get("data")
        return inner if isinstance(inner, dict) else {}

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise ProviderError("Kling 仅支持图像/视频生成,chat 接口不可用", 400)

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        raise ProviderError("Kling 仅支持图像/视频生成,chat 接口不可用", 400)
        yield {}  # pragma: no cover

    # ------------------------------------------------------------------
    # 图像生成(Kolors)
    # ------------------------------------------------------------------
    async def generate_image(
        self,
        prompt: str,
        model: str,
        *,
        size: str = "1024x1024",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Kolors 文生图。size 映射 aspect_ratio;支持 negative_prompt。"""
        used_model = (model if not model.startswith("kling-") else "") or os.environ.get(
            "KLING_IMAGE_MODEL", "kolors"
        )
        aspect = kwargs.get("aspect_ratio") or self._size_to_aspect(size)
        body: dict[str, Any] = {
            "model_name": used_model,
            "prompt": prompt,
            "aspect_ratio": aspect if aspect in _KLING_ASPECT_RATIOS else "1:1",
        }
        neg = kwargs.get("negative_prompt")
        if neg:
            body["negative_prompt"] = neg
        data = self._check_code(
            await self._request("POST", f"{self.base_url}/v1/images/text2image",
                                headers=self._auth_headers(), json=body),
            "text2image",
        )
        # 同步协议:直接返回 images;兼容异步协议:返回 task_id 时轮询
        images = data.get("images")
        if not images:
            task_id = data.get("task_id")
            if not task_id:
                raise ProviderError(f"Kling 图像响应缺少 images/task_id: {str(data)[:200]}", 502)
            data = await self._poll(f"{self.base_url}/v1/images/text2image/{task_id}")
            images = data.get("images") or []
        items = [{"url": img.get("url", "")} for img in images if isinstance(img, dict)]
        if not items:
            raise ProviderError("Kling 图像响应缺少可用的图片 URL", 502)
        return {"provider": "kling", "model": used_model, "data": items}

    @staticmethod
    def _size_to_aspect(size: str) -> str:
        """从 WxH 尺寸字符串映射最接近的 aspect_ratio。"""
        try:
            w, _, h = size.lower().partition("x")
            ratio = int(w) / int(h)
        except (ValueError, ZeroDivisionError):
            return "1:1"
        best, best_diff = "1:1", float("inf")
        for cand in _KLING_ASPECT_RATIOS:
            cw, _, ch = cand.partition(":")
            diff = abs(int(cw) / int(ch) - ratio)
            if diff < best_diff:
                best, best_diff = cand, diff
        return best

    # ------------------------------------------------------------------
    # 视频生成(text2video / image2video)
    # ------------------------------------------------------------------
    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """可灵视频生成。传 kwargs.image(URL 或 base64)走 image2video。"""
        used_model = model or os.environ.get("KLING_VIDEO_MODEL", "kling-v1")
        mode = kwargs.get("mode") or "std"
        if mode not in ("std", "pro"):
            mode = "std"
        body: dict[str, Any] = {
            "model_name": used_model,
            "prompt": prompt,
            "mode": mode,
            "duration": str(duration),
        }
        neg = kwargs.get("negative_prompt")
        if neg:
            body["negative_prompt"] = neg
        image = kwargs.get("image")
        if image:
            kind = "image2video"
            body["image"] = image
        else:
            kind = "text2video"
        cfg = kwargs.get("cfg_scale")
        if isinstance(cfg, (int, float)):
            body["cfg_scale"] = cfg
        data = self._check_code(
            await self._request("POST", f"{self.base_url}/v1/videos/{kind}",
                                headers=self._auth_headers(), json=body),
            kind,
        )
        task_id = data.get("task_id")
        if not task_id:
            raise ProviderError(f"Kling 视频响应缺少 task_id: {str(data)[:200]}", 502)
        result = await self._poll(f"{self.base_url}/v1/videos/{kind}/{task_id}")
        videos = (result.get("task_result") or {}).get("videos") or []
        if not videos:
            raise ProviderError(f"Kling 视频任务 {task_id} 无视频结果", 502)
        return {
            "provider": "kling",
            "model": used_model,
            "task_id": task_id,
            "video_url": videos[0].get("url", ""),
            "duration": videos[0].get("duration"),
        }

    # ------------------------------------------------------------------
    # 任务轮询
    # ------------------------------------------------------------------
    async def _poll(
        self, url: str, *, interval: float = 5.0, max_wait: float = 600.0
    ) -> dict[str, Any]:
        """轮询可灵任务状态直到 succeed/failed(指数间隔封顶 5s → 10s)。"""
        deadline = time.monotonic() + max_wait
        delay = interval
        while True:
            data = self._check_code(await self._request("GET", url, headers=self._auth_headers()),
                                    url)
            status = str(data.get("task_status", "")).lower()
            if status == "succeed":
                return data
            if status in ("failed", "cancelled"):
                msg = str(data.get("task_status_msg", data))[:300]
                raise ProviderError(f"Kling 任务失败(status={status}): {msg}", 502)
            if time.monotonic() >= deadline:
                raise ProviderError(f"Kling 任务轮询超时({int(max_wait)}s,最后状态={status})", 504)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 10.0)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌‌​‌‌‌​‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‌
