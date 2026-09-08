# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Token6688(名创AI / TokenGo 聚合网关,https://k.token6688.com)全模态适配器。

单 key 全模态(OpenAI 兼容 Bearer 协议,实测网关为 TokenGo 系自研):
- 文本/多模态对话:POST /v1/chat/completions(继承 OpenAIProvider,零改动复用)
- 模型清单:GET /v1/models(继承,供 model_sync 自动同步入库)
- 图片生成:POST /v1/images/generations
- 语音合成 TTS:POST /v1/audio/speech(返回音频字节流)
- 语音识别 STT:POST /v1/audio/transcriptions(multipart)
- 向量嵌入:POST /v1/embeddings
- 视频生成:env 可配端点(默认 /v1/videos,兼容同步直返与 job 提交+轮询两种形态)

设计原则(2026-09-08 立,用户目标"一个 key 全模态调用到极致"):
- 网关文档站需登录,端点形态未 100% 校准前,所有差异点全部 env 可配,
  拿到 key 后无需改代码即可校准(TOKEN6688_VIDEO_ENDPOINT/MODEL/PAYLOAD 等)
- base_url 不含 /v1(与 OpenAIProvider 约定一致);用户误配 /v1 结尾时自动兼容
- 平台模型前缀 t6688/(如 t6688/gm-3.8-flash),_strip_prefix 去前缀后透传网关
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, AsyncIterator

import httpx

from .base_provider import ProviderError
from .openai_provider import OpenAIProvider
from ..core.llm_gateway import get_http_client

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://k.token6688.com"

# 视频任务轮询参数(默认 5s 间隔,最长 600s)
_VIDEO_POLL_INTERVAL_S = 5.0
_VIDEO_TERMINAL_OK = {"succeeded", "success", "completed", "complete", "done", "ok", "finished", "finish"}
_VIDEO_TERMINAL_FAIL = {"failed", "fail", "error", "cancelled", "canceled"}


def _env(name: str, default: str) -> str:
    v = os.environ.get(name, "").strip()
    return v or default


class Token6688Provider(OpenAIProvider):
    """Token6688 聚合网关适配器:单 key 覆盖 chat/vision/image/tts/stt/embeddings/video。"""

    provider_code = "token6688"

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 120.0):
        super().__init__(api_key, api_base or _env("TOKEN6688_BASE_URL", DEFAULT_BASE_URL), timeout)

    # ------------------------------------------------------------------
    # URL 构造
    # ------------------------------------------------------------------
    def _api_base_v1(self) -> str:
        """返回以 /v1 结尾的 base(用户误配 /v1 结尾时自动兼容,不重复拼接)。"""
        base = self.base_url.rstrip("/")
        return base if base.endswith("/v1") else f"{base}/v1"

    @property
    def configured(self) -> bool:
        """key 是否已配置(video_generation 编排用)。"""
        return bool(self.api_key)

    # ------------------------------------------------------------------
    # 图片生成(OpenAI images/generations 协议)
    # ------------------------------------------------------------------
    async def generate_image(
        self,
        prompt: str,
        *,
        model: str | None = None,
        size: str = "1024x1024",
        n: int = 1,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """图片生成,返回 {provider, model, images: [{url}|{b64_json}], raw}。"""
        used_model = model or _env("TOKEN6688_IMAGE_MODEL", "gpt-image-1")
        payload: dict[str, Any] = {"model": used_model, "prompt": prompt, "size": size, "n": n}
        payload.update(kwargs)
        data = await self._request(
            "POST", f"{self._api_base_v1()}/images/generations", headers=self._headers(), json=payload,
        )
        items = data.get("data") or []
        images: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("b64_json"):
                images.append({"b64_json": item["b64_json"]})
            elif item.get("url"):
                images.append({"url": item["url"]})
        if not images:
            raise ProviderError(f"Token6688 图片响应无 url/b64_json: {str(data)[:200]}", 502)
        return {"provider": self.provider_code, "model": used_model, "images": images, "raw": data}

    # ------------------------------------------------------------------
    # TTS(OpenAI audio/speech 协议,返回音频字节)
    # ------------------------------------------------------------------
    async def tts(
        self,
        text: str,
        *,
        model: str | None = None,
        voice: str = "alloy",
        speed: float = 1.0,
        response_format: str = "mp3",
    ) -> tuple[bytes, str]:
        """语音合成,返回 (音频字节, content_type)。"""
        used_model = model or _env("TOKEN6688_TTS_MODEL", "tts-1")
        payload = {
            "model": used_model,
            "input": text,
            "voice": voice,
            "speed": speed,
            "response_format": response_format,
        }
        try:
            client = get_http_client()
            resp = await client.post(
                f"{self._api_base_v1()}/audio/speech",
                headers=self._headers(), json=payload, timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Token6688 TTS 网络异常: {e}") from e
        content_type = resp.headers.get("content-type", "")
        if resp.status_code >= 400 or "audio" not in content_type.lower():
            body = resp.text[:300] if resp.status_code < 500 or len(resp.content) < 10000 else "<large>"
            raise ProviderError(
                f"Token6688 TTS 调用失败: {resp.status_code} {content_type} {body!r}", resp.status_code,
            )
        return resp.content, content_type or f"audio/{response_format}"

    # ------------------------------------------------------------------
    # STT(OpenAI audio/transcriptions 协议,multipart 上传)
    # ------------------------------------------------------------------
    async def stt(
        self,
        audio_bytes: bytes,
        filename: str = "audio.mp3",
        *,
        model: str | None = None,
        language: str | None = None,
    ) -> dict[str, Any]:
        """语音转文字,返回 {"text": ..., "model": ...}。"""
        used_model = model or _env("TOKEN6688_STT_MODEL", "whisper-1")
        data: dict[str, Any] = {"model": used_model}
        if language:
            data["language"] = language
        try:
            client = get_http_client()
            resp = await client.post(
                f"{self._api_base_v1()}/audio/transcriptions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": (filename, audio_bytes)},
                data=data,
                timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Token6688 STT 网络异常: {e}") from e
        if resp.status_code >= 400:
            raise ProviderError(f"Token6688 STT 调用失败: {resp.status_code} {resp.text[:300]}", resp.status_code)
        try:
            body = resp.json()
        except ValueError as e:
            raise ProviderError(f"Token6688 STT 响应非 JSON: {resp.text[:200]!r}", 502) from e
        return {"text": body.get("text", ""), "model": used_model, "raw": body}

    # ------------------------------------------------------------------
    # Embeddings
    # ------------------------------------------------------------------
    async def embeddings(
        self, input_text: str | list[str], *, model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        """向量嵌入,返回 {model, embeddings: [[float,...],...], raw}。"""
        used_model = model or _env("TOKEN6688_EMBEDDING_MODEL", "text-embedding-3-small")
        payload: dict[str, Any] = {"model": used_model, "input": input_text}
        payload.update(kwargs)
        data = await self._request(
            "POST", f"{self._api_base_v1()}/embeddings", headers=self._headers(), json=payload,
        )
        vectors: list[list[float]] = []
        for item in data.get("data") or []:
            if isinstance(item, dict) and item.get("embedding"):
                vectors.append(item["embedding"])
        return {"model": used_model, "embeddings": vectors, "raw": data}

    # ------------------------------------------------------------------
    # 视频生成(端点形态 env 可配:同步直返 / job 提交+轮询)
    # ------------------------------------------------------------------
    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """视频生成。传 kwargs.image(URL 或 base64)走图生视频。

        端点策略(env 可配,拿到 key 后实测校准):
        - TOKEN6688_VIDEO_ENDPOINT:提交端点路径,默认 /v1/videos
        - TOKEN6688_VIDEO_MODEL:默认模型,默认 pixverse-c1
        - TOKEN6688_VIDEO_PAYLOAD:额外 JSON 字段合并进提交体(校准期零代码改动)
        响应策略:提交响应里直接能抽到视频 URL → 同步直返;否则视为 job,
        GET {endpoint}/{task_id} 轮询至终态。
        """
        used_model = model or _env("TOKEN6688_VIDEO_MODEL", "pixverse-c1")
        endpoint = _env("TOKEN6688_VIDEO_ENDPOINT", "/v1/videos")
        if not endpoint.startswith("/"):
            endpoint = f"/{endpoint}"
        submit_url = f"{self._api_base_v1()}{endpoint[len('/v1'):]}" if endpoint.startswith("/v1") \
            else f"{self.base_url.rstrip('/')}{endpoint}"
        body: dict[str, Any] = {
            "model": used_model,
            "prompt": prompt,
            "duration": duration,
            "seconds": str(duration),
        }
        image = kwargs.get("image")
        if image:
            body["image"] = image
        for k in ("negative_prompt", "aspect_ratio", "resolution", "quality"):
            v = kwargs.get(k)
            if v is not None:
                body[k] = v
        # env JSON 合并(校准期免改代码)
        extra = os.environ.get("TOKEN6688_VIDEO_PAYLOAD", "").strip()
        if extra:
            try:
                merged = json.loads(extra)
                if isinstance(merged, dict):
                    body.update(merged)
            except json.JSONDecodeError:
                logger.warning("TOKEN6688_VIDEO_PAYLOAD 非合法 JSON,忽略: %r", extra[:100])

        data = await self._request("POST", submit_url, headers=self._headers(), json=body)
        # 形态 A:同步直返(响应里直接有视频 URL)
        sync_url = self._extract_video_url(data)
        task_id = self._extract_task_id(data)
        if sync_url:
            return {
                "provider": self.provider_code,
                "model": used_model,
                "task_id": task_id or "",
                "video_url": sync_url,
                "duration": duration,
            }
        # 形态 B:job 提交 + 轮询
        if not task_id:
            raise ProviderError(
                f"Token6688 视频响应无视频 URL 也无 task_id: {str(data)[:300]}", 502,
            )
        poll_url = f"{submit_url.rstrip('/')}/{task_id}"
        result = await self._poll_video(poll_url)
        video_url = self._extract_video_url(result)
        if not video_url:
            raise ProviderError(f"Token6688 视频任务 {task_id} 完成但无视频 URL: {str(result)[:300]}", 502)
        return {
            "provider": self.provider_code,
            "model": used_model,
            "task_id": task_id,
            "video_url": video_url,
            "duration": duration,
        }

    async def _poll_video(
        self, poll_url: str, *, interval: float = _VIDEO_POLL_INTERVAL_S, max_wait: float | None = None,
    ) -> dict[str, Any]:
        """轮询视频任务至终态(指数间隔 5s→10s 封顶)。"""
        if max_wait is None:
            max_wait = float(_env("TOKEN6688_VIDEO_TIMEOUT", "600"))
        deadline = time.monotonic() + max_wait
        delay = interval
        while True:
            data = await self._request("GET", poll_url, headers=self._headers())
            status = str(
                data.get("status") or data.get("task_status") or data.get("state") or ""
            ).lower()
            if status in _VIDEO_TERMINAL_OK or self._extract_video_url(data):
                return data
            if status in _VIDEO_TERMINAL_FAIL:
                msg = str(data.get("error") or data.get("message") or data)[:300]
                raise ProviderError(f"Token6688 视频任务失败(status={status}): {msg}", 502)
            if time.monotonic() > deadline:
                raise ProviderError(
                    f"Token6688 视频任务轮询超时({max_wait:.0f}s, status={status or 'unknown'})", 504,
                )
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 10.0)

    @staticmethod
    def _extract_task_id(data: dict[str, Any]) -> str:
        """从响应提取任务 id(兼容 id/task_id/taskId/job_id/jobId)。"""
        for key in ("task_id", "taskId", "job_id", "jobId", "id"):
            v = data.get(key)
            if isinstance(v, (str, int)) and str(v):
                return str(v)
        # data/output 包一层的情况
        for wrapper in ("data", "result", "output"):
            inner = data.get(wrapper)
            if isinstance(inner, dict):
                got = Token6688Provider._extract_task_id(inner)
                if got:
                    return got
        return ""

    @staticmethod
    def _extract_video_url(data: Any, depth: int = 0) -> str:
        """递归提取视频 URL(深度限 4,键名含 url/video 且值为 http 字符串)。"""
        if depth > 4:
            return ""
        if isinstance(data, dict):
            for key, value in data.items():
                k = str(key).lower()
                if isinstance(value, str) and value.startswith(("http://", "https://")) and (
                    "url" in k or k in ("video", "output", "file", "download")
                ):
                    return value
            for value in data.values():
                got = Token6688Provider._extract_video_url(value, depth + 1)
                if got:
                    return got
        elif isinstance(data, list):
            for item in data:
                got = Token6688Provider._extract_video_url(item, depth + 1)
                if got:
                    return got
        return ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍
