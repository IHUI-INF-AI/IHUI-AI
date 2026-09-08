# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Token6688(名创AI / TokenGo 聚合网关,https://k.token6688.com)全模态适配器。

单 key 全模态(OpenAI 兼容 Bearer 协议,平台自描述文档 /v1/skills/guide 2026-07-11 版校准):
- 文本/多模态对话:POST /v1/chat/completions(继承 OpenAIProvider,零改动复用;
  网关把 reasoning_content 归一到 delta.reasoning_content,深度思考模型务必 stream)
- 模型清单:GET /v1/skills/models(**免鉴权**,112 模型含 display_name/capabilities/
  api_endpoint;重写 list_models 映射成 OpenAI 风格供 model_sync 免 key 同步)
- 图片生成-同步:POST /v1/images/generations(⚠ 官方实测 40-50s 出图,200 不等于成功,
  必须检查 body.error;整链超时需 >60s)
- 图片生成-真异步:POST /api/v1/model-runtime/invoke(TOKEN6688_IMAGE_ASYNC=1 启用,
  立即返 task_id → 轮询 GET /api/v1/model-runtime/tasks/{id},status completed/failed,
  产物在 result_url;经 CDN/反代场景官方推荐)
- 视频生成:POST /v1/videos/generations(**扁平形状**,参数放顶层;与 media/generate 的
  params 信封不可互换,发错形状网关会静默摊平落默认值)。轮询 GET /v1/tasks/{task_id}
  直到 is_final=true,产物读 output_url。官方耗时:视频中位 4~40 分钟 p90 55~75 分钟,
  轮询总时长默认 3600s。task_id 幂等:client_request_id 防网络超时重复扣费。
- TTS:POST /v1/audio/speech(OpenAI 官方同构:model/voice∈{alloy,echo,fable,onyx,
  nova,shimmer}/speed/response_format∈{mp3,opus,aac,flac,wav,pcm};声纹库见
  list_voices/upload_voice)
- 音乐生成:POST /v1/audio/generations(Suno,扁平形状:model=music/prompt/mode/
  lyrics/style/title/vocal_gender/version)→ task 轮询 output_url
- 文件上传:POST /v1/files(multipart 字段 file,≤50MB)→ 公网 URL(24h 有效)
- 余额:GET /v1/skills/balance(balance/available_balance/frozen 为 "$49.96" 格式字符串)
- 声纹库:GET /v1/audio/voices 列表 / POST /v1/audio/voices 上传参考音频(异步)

平台模型 ID 实测(2026-09-08 /v1/skills/models 共 112 个):
- chat 43 个:gpt-5.4 / claude-opus-5 / gemini-3.8-flash / glm-5.3 / deepseek-v4-flash /
  kimi-k3 / qwen3.8-max / grok-4.6 等,统一 /v1/chat/completions
- 视频:seedance-2-5 / wan-3-0 / veo-3.1 / kling-v3 / sora-2 / pixverse-c1 / minimax-h3 等
- 图片:gpt-image-2 / gemini-3-pro-image / doubao-seedream-5-0-pro / qwen-image-3.0 等
- 音频:tts-1 / tts-1-hd / gemini-3.1-flash-tts / speech-2.8 / voice-clone / music(Suno)

所有差异点 env 可配(拿到 key 后零代码校准):
TOKEN6688_BASE_URL / TOKEN6688_VIDEO_ENDPOINT / TOKEN6688_VIDEO_POLL_PATH /
TOKEN6688_VIDEO_MODEL / TOKEN6688_VIDEO_TIMEOUT / TOKEN6688_VIDEO_PAYLOAD /
TOKEN6688_IMAGE_MODEL / TOKEN6688_IMAGE_ASYNC / TOKEN6688_TTS_MODEL /
TOKEN6688_TTS_PAYLOAD / TOKEN6688_STT_MODEL / TOKEN6688_EMBEDDING_MODEL
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from typing import Any, AsyncIterator

import httpx

from .base_provider import ProviderError
from .openai_provider import OpenAIProvider
from ..core.llm_gateway import get_http_client

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://k.token6688.com"

# 官方指南:建议 3s 轮询;视频 p90 55~75 分钟 → 总时长默认 3600s
_VIDEO_POLL_INTERVAL_S = 3.0
# /v1/tasks 终态:is_final=true + state(success/failed);status 为 pending/processing/completed/failed
_TASK_OK_STATES = {"success", "completed", "succeeded", "complete", "done", "ok"}
_TASK_FAIL_STATES = {"failed", "fail", "error", "cancelled", "canceled"}


def _env(name: str, default: str) -> str:
    v = os.environ.get(name, "").strip()
    return v or default


class Token6688Provider(OpenAIProvider):
    """Token6688 聚合网关适配器:单 key 覆盖 chat/vision/image/tts/stt/music/video。"""

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
    # 模型清单(免鉴权 /v1/skills/models,112 模型;映射 OpenAI 风格供 model_sync)
    # ------------------------------------------------------------------
    async def list_models(self) -> list[dict[str, Any]]:
        try:
            data = await self._request("GET", f"{self._api_base_v1()}/skills/models", headers=self._headers())
        except ProviderError:
            # skills/models 不可用时降级 GT 标准 /v1/models
            return await super().list_models()
        items = data.get("models") or []
        return [
            {
                "id": it.get("name") or it.get("id"),
                "display_name": it.get("display_name"),
                "api_endpoint": it.get("api_endpoint"),
                "capabilities": it.get("capabilities"),
                "owned_by": self.provider_code,
            }
            for it in items
            if isinstance(it, dict) and (it.get("name") or it.get("id"))
        ]

    # ------------------------------------------------------------------
    # 图片生成(同步 OpenAI Images 协议 / 可选真异步 model-runtime)
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
        """图片生成,返回 {provider, model, images: [{url}|{b64_json}], raw}。

        默认走同步 /v1/images/generations(OpenAI 兼容,官方实测 40-50s)。
        TOKEN6688_IMAGE_ASYNC=1 时走 POST /api/v1/model-runtime/invoke 真异步
        (立即返 task_id,轮询 /api/v1/model-runtime/tasks/{id},官方推荐抗超时)。
        """
        used_model = model or _env("TOKEN6688_IMAGE_MODEL", "gpt-image-2")
        if _env("TOKEN6688_IMAGE_ASYNC", "0") in ("1", "true", "True"):
            return await self._generate_image_async(prompt, used_model, **kwargs)
        payload: dict[str, Any] = {"model": used_model, "prompt": prompt, "size": size, "n": n}
        payload.update(kwargs)
        data = await self._request(
            "POST", f"{self._api_base_v1()}/images/generations", headers=self._headers(), json=payload,
        )
        # ⚠ 官方指南:同步端点 40s 后发保活字节,HTTP 200 已固定 → 必须检查 body.error
        err = data.get("error")
        if err:
            raise ProviderError(
                f"Token6688 图片生成失败(200+error): {err.get('message') or err}", 502,
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

    async def _generate_image_async(self, prompt: str, model: str, **kwargs: Any) -> dict[str, Any]:
        """真异步图片:model-runtime/invoke(信封形状)→ 轮询 model-runtime/tasks。"""
        params: dict[str, Any] = {
            "mode": kwargs.get("mode", "text-to-image"),
            "count": kwargs.get("n", 1),
            "output_format": kwargs.get("output_format", "jpeg"),
            "quality": kwargs.get("quality", "auto"),
            "resolution": kwargs.get("resolution", "1K"),
            "prompt": prompt,
        }
        if kwargs.get("aspect_ratio"):
            params["aspect_ratio"] = kwargs["aspect_ratio"]
        if kwargs.get("images"):
            params["images"] = kwargs["images"]
        body = {"modality": "image", "model_id": model, "operation": "generate", "params": params}
        data = await self._request(
            "POST", f"{self.base_url.rstrip('/')}/api/v1/model-runtime/invoke",
            headers=self._headers(), json=body,
        )
        task_id = data.get("task_id") or data.get("id") or ""
        if not task_id:
            raise ProviderError(f"Token6688 model-runtime/invoke 无 task_id: {str(data)[:200]}", 502)
        poll_url = f"{self.base_url.rstrip('/')}/api/v1/model-runtime/tasks/{task_id}"
        result = await self._poll_task(poll_url)
        url = result.get("result_url") or self._extract_media_url(result)
        if not url:
            raise ProviderError(f"Token6688 图片任务 {task_id} 完成但无 result_url: {str(result)[:300]}", 502)
        return {
            "provider": self.provider_code, "model": model,
            "images": [{"url": url}], "task_id": task_id, "raw": result,
        }

    # ------------------------------------------------------------------
    # TTS(OpenAI audio/speech 官方同构;voice∈{alloy,echo,fable,onyx,nova,shimmer})
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
        """语音合成,返回 (音频字节, content_type)。payload 差异可经 TOKEN6688_TTS_PAYLOAD 合并。"""
        used_model = model or _env("TOKEN6688_TTS_MODEL", "tts-1-hd")
        payload: dict[str, Any] = {
            "model": used_model,
            "input": text,
            "voice": voice,
            "speed": speed,
            "response_format": response_format,
        }
        extra = os.environ.get("TOKEN6688_TTS_PAYLOAD", "").strip()
        if extra:
            try:
                merged = json.loads(extra)
                if isinstance(merged, dict):
                    payload.update(merged)
            except json.JSONDecodeError:
                logger.warning("TOKEN6688_TTS_PAYLOAD 非合法 JSON,忽略: %r", extra[:100])
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
            body = resp.text[:300] if len(resp.content) < 10000 else "<large>"
            raise ProviderError(
                f"Token6688 TTS 调用失败: {resp.status_code} {content_type} {body!r}", resp.status_code,
            )
        return resp.content, content_type or f"audio/{response_format}"

    async def list_voices(self) -> list[dict[str, Any]]:
        """获取我的声纹列表(GET /v1/audio/voices)。"""
        data = await self._request("GET", f"{self._api_base_v1()}/audio/voices", headers=self._headers())
        return data.get("data") or data.get("voices") or []

    async def upload_voice(self, audio_bytes: bytes, filename: str = "ref.wav") -> dict[str, Any]:
        """上传参考音频到声纹库(POST /v1/audio/voices,异步任务,轮询至终态)。"""
        try:
            client = get_http_client()
            resp = await client.post(
                f"{self._api_base_v1()}/audio/voices",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": (filename, audio_bytes)},
                timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Token6688 声纹上传网络异常: {e}") from e
        if resp.status_code >= 400:
            raise ProviderError(f"Token6688 声纹上传失败: {resp.status_code} {resp.text[:300]}", resp.status_code)
        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(f"Token6688 声纹上传响应非 JSON: {resp.text[:200]!r}", 502) from e
        task_id = data.get("task_id") or data.get("id") or ""
        if task_id:
            result = await self._poll_task(f"{self._api_base_v1()}/tasks/{task_id}")
            return {"voice": result, "raw": data}
        return data

    # ------------------------------------------------------------------
    # STT(网关接口总览无 transcriptions 端点;保留 OpenAI 兼容透传备用)
    # ------------------------------------------------------------------
    async def stt(
        self,
        audio_bytes: bytes,
        filename: str = "audio.mp3",
        *,
        model: str | None = None,
        language: str | None = None,
    ) -> dict[str, Any]:
        """语音转文字。⚠ 平台接口总览暂无此端点,默认会 404;保留供上游开通后零改动使用。"""
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
    # Embeddings(接口总览未提供;保留 OpenAI 兼容透传备用)
    # ------------------------------------------------------------------
    async def embeddings(
        self, input_text: str | list[str], *, model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        """向量嵌入。⚠ 平台接口总览暂无此端点,默认会 404;保留备用。"""
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
    # 音乐生成(Suno;POST /v1/audio/generations 扁平形状 → task 轮询)
    # ------------------------------------------------------------------
    async def generate_music(
        self,
        prompt: str,
        *,
        model: str = "music",
        mode: str = "song",
        lyrics: str | None = None,
        style: str | None = None,
        title: str | None = None,
        vocal_gender: str | None = None,
        version: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """音乐生成(Suno 风格扁平形状),返回 {provider, model, task_id, audio_url}。"""
        body: dict[str, Any] = {"model": model, "prompt": prompt, "mode": mode, "operation": "generate"}
        for k, v in (("lyrics", lyrics), ("style", style), ("title", title),
                     ("vocal_gender", vocal_gender), ("version", version)):
            if v:
                body[k] = v
        body.update(kwargs)
        data = await self._request(
            "POST", f"{self._api_base_v1()}/audio/generations", headers=self._headers(), json=body,
        )
        task_id = self._extract_task_id(data)
        if not task_id:
            raise ProviderError(f"Token6688 音乐响应无 task_id: {str(data)[:300]}", 502)
        result = await self._poll_task(f"{self._api_base_v1()}/tasks/{task_id}")
        audio_url = result.get("output_url") or self._extract_media_url(result)
        if not audio_url:
            raise ProviderError(f"Token6688 音乐任务 {task_id} 完成但无 output_url: {str(result)[:300]}", 502)
        return {"provider": self.provider_code, "model": model, "task_id": task_id, "audio_url": audio_url}

    # ------------------------------------------------------------------
    # 文件上传(POST /v1/files multipart,≤50MB,返回 24h 有效公网 URL)
    # ------------------------------------------------------------------
    async def upload_file(
        self, file_bytes: bytes, filename: str, *, purpose: str | None = None
    ) -> str:
        """上传本地文件换公网 URL(多模态输入只收 URL;本地文件先走此接口)。"""
        data: dict[str, Any] = {}
        if purpose:
            data["purpose"] = purpose
        try:
            client = get_http_client()
            resp = await client.post(
                f"{self._api_base_v1()}/files",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": (filename, file_bytes)},
                data=data,
                timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Token6688 文件上传网络异常: {e}") from e
        if resp.status_code >= 400:
            raise ProviderError(f"Token6688 文件上传失败: {resp.status_code} {resp.text[:300]}", resp.status_code)
        try:
            body = resp.json()
        except ValueError as e:
            raise ProviderError(f"Token6688 文件上传响应非 JSON: {resp.text[:200]!r}", 502) from e
        url = body.get("url") or (body.get("data") or {}).get("url") if isinstance(body, dict) else None
        if not url:
            raise ProviderError(f"Token6688 文件上传无 url: {str(body)[:200]}", 502)
        return url

    # ------------------------------------------------------------------
    # 余额(GET /v1/skills/balance;返回值为 "$49.96" 格式字符串)
    # ------------------------------------------------------------------
    async def get_balance(self) -> dict[str, Any]:
        """查询账户余额。返回 {balance, available_balance, frozen}(去 $ 转数值)。"""
        data = await self._request("GET", f"{self._api_base_v1()}/skills/balance", headers=self._headers())

        def _num(v: Any) -> float | None:
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str) and v.startswith("$"):
                try:
                    return float(v[1:])
                except ValueError:
                    return None
            return None

        return {
            "balance": _num(data.get("balance")),
            "available_balance": _num(data.get("available_balance")),
            "frozen": _num(data.get("frozen")),
            "raw": data,
        }

    # ------------------------------------------------------------------
    # 视频生成(POST /v1/videos/generations 扁平形状 → GET /v1/tasks/{id} 轮询)
    # ------------------------------------------------------------------
    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """视频生成。传 kwargs.image(公网 URL)自动切 first-frame 图生模式。

        官方校准(2026-09-08 /v1/skills/guide v2026-07-11):
        - 扁平形状:参数放顶层,严禁 {"params": {...}} 信封(发错形状网关静默摊平落默认值)
        - prompt 必填(纯图生也必须写提示词,否则上游按内容异常拒绝)
        - 轮询 GET /v1/tasks/{task_id} 直到 is_final=true;产物读 output_url
        - 参考素材必须公网直链(本地文件先 upload_file)
        - client_request_id 幂等:网络超时重试不重复扣费
        """
        used_model = model or _env("TOKEN6688_VIDEO_MODEL", "seedance-2-5")
        endpoint = _env("TOKEN6688_VIDEO_ENDPOINT", "/v1/videos/generations")
        if not endpoint.startswith("/"):
            endpoint = f"/{endpoint}"
        submit_url = f"{self._api_base_v1()}{endpoint[len('/v1'):]}" if endpoint.startswith("/v1") \
            else f"{self.base_url.rstrip('/')}{endpoint}"
        image = kwargs.get("image")
        body: dict[str, Any] = {
            "model": used_model,
            "prompt": prompt,  # 官方:视频生成 prompt 必填
            "mode": kwargs.get("mode") or ("first-frame" if image else "text-to-video"),
            "duration": str(duration),  # param_schema duration 为字符串枚举("4".."30"),数字/字符串均可
            "client_request_id": uuid.uuid4().hex,  # 官方强烈建议:幂等防重复扣费
        }
        if image:
            # 参考图/首帧:扁平端点用 images 数组(单图即首帧)
            body["images"] = [image] if isinstance(image, str) else list(image)
        for k in ("aspect_ratio", "resolution", "count", "callback_url", "callback_secret"):
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
        # 形态 A:同步直返(响应里直接有媒体 URL)
        sync_url = self._extract_media_url(data)
        task_id = self._extract_task_id(data)
        if sync_url:
            return {
                "provider": self.provider_code,
                "model": used_model,
                "task_id": task_id or "",
                "video_url": sync_url,
                "duration": duration,
            }
        # 形态 B:job 提交 + 轮询(GET /v1/tasks/{task_id},官方默认)
        if not task_id:
            raise ProviderError(
                f"Token6688 视频响应无视频 URL 也无 task_id: {str(data)[:300]}", 502,
            )
        poll_path = _env("TOKEN6688_VIDEO_POLL_PATH", "/v1/tasks/{task_id}")
        poll_url = f"{self._api_base_v1()}{poll_path[len('/v1'):] if poll_path.startswith('/v1') else poll_path}"
        poll_url = poll_url.replace("{task_id}", task_id)
        result = await self._poll_task(poll_url)
        video_url = result.get("output_url") or self._extract_media_url(result)
        if not video_url:
            raise ProviderError(f"Token6688 视频任务 {task_id} 完成但无 output_url: {str(result)[:300]}", 502)
        return {
            "provider": self.provider_code,
            "model": used_model,
            "task_id": task_id,
            "video_url": video_url,
            "duration": duration,
        }

    # ------------------------------------------------------------------
    # 通用任务轮询(/v1/tasks 与 /api/v1/model-runtime/tasks 共用)
    # 官方:视频 p90 55~75 分钟,轮询总时长默认 3600s,间隔 3s(官方建议)起步封顶 10s
    # ------------------------------------------------------------------
    async def _poll_task(
        self, poll_url: str, *, interval: float = _VIDEO_POLL_INTERVAL_S, max_wait: float | None = None,
    ) -> dict[str, Any]:
        if max_wait is None:
            max_wait = float(_env("TOKEN6688_VIDEO_TIMEOUT", "3600"))
        deadline = time.monotonic() + max_wait
        delay = interval
        while True:
            data = await self._request("GET", poll_url, headers=self._headers())
            is_final = bool(data.get("is_final"))
            status = str(data.get("status") or data.get("task_status") or data.get("state") or "").lower()
            state = str(data.get("state") or "").lower()
            has_url = bool(
                data.get("output_url") or data.get("result_url") or self._extract_media_url(data)
            )
            ok = (is_final and state in _TASK_OK_STATES) or status in _TASK_OK_STATES or has_url
            if ok:
                return data
            if (is_final and state in _TASK_FAIL_STATES) or status in _TASK_FAIL_STATES:
                msg = str(data.get("error") or data.get("error_message") or data.get("message") or data)[:300]
                raise ProviderError(f"Token6688 任务失败(status={status or state}): {msg}", 502)
            if time.monotonic() > deadline:
                raise ProviderError(
                    f"Token6688 任务轮询超时({max_wait:.0f}s, status={status or 'unknown'}): {poll_url}", 504,
                )
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 10.0)

    @staticmethod
    def _extract_task_id(data: dict[str, Any]) -> str:
        """从响应提取任务 id(兼容 task_id/id/taskId/job_id/jobId)。"""
        for key in ("task_id", "id", "taskId", "job_id", "jobId"):
            v = data.get(key)
            if isinstance(v, (str, int)) and str(v):
                return str(v)
        for wrapper in ("data", "result", "output"):
            inner = data.get(wrapper)
            if isinstance(inner, dict):
                got = Token6688Provider._extract_task_id(inner)
                if got:
                    return got
        return ""

    @staticmethod
    def _extract_media_url(data: Any, depth: int = 0) -> str:
        """递归提取媒体 URL(深度限 4;output_url/result_url/images[].url/videos[].url 等)。"""
        if depth > 4:
            return ""
        if isinstance(data, dict):
            for key in ("output_url", "result_url", "video_url", "audio_url", "url"):
                value = data.get(key)
                if isinstance(value, str) and value.startswith(("http://", "https://")):
                    return value
            for value in data.values():
                got = Token6688Provider._extract_media_url(value, depth + 1)
                if got:
                    return got
        elif isinstance(data, list):
            for item in data:
                got = Token6688Provider._extract_media_url(item, depth + 1)
                if got:
                    return got
        return ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍
