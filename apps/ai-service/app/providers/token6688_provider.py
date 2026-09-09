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
import base64
import copy
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

    # 官方音乐 operation 全 8 枚举(/v1/skills/models/music,2026-09-08 校准)
    _MUSIC_OPERATIONS = {
        "generate", "extend", "cover", "lyrics", "stems", "stems_all", "mp4", "concat",
    }

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
    # 请求头/请求封装增强(2026-09-08 文档全量校准)
    # ------------------------------------------------------------------
    _SCHEDULE_STRATEGIES = {"balanced", "cost_first", "reliability_first", "latency_first"}

    def _headers(self) -> dict[str, str]:
        """覆盖:支持请求级调度策略 X-Schedule-Strategy(TOKEN6688_SCHEDULE_STRATEGY)。

        官方:balanced(智能默认)/cost_first(价格优先)/reliability_first(稳定优先)/
        latency_first(速度优先);固定渠道是严格路由不自动切换,需要容灾用调度策略。
        """
        headers = super()._headers()
        strategy = _env("TOKEN6688_SCHEDULE_STRATEGY", "").strip()
        if strategy and strategy in self._SCHEDULE_STRATEGIES:
            headers["X-Schedule-Strategy"] = strategy
        return headers

    @staticmethod
    def _callback_fields() -> dict[str, str]:
        """官方 webhook 透传字段(env 可配,默认空 = 关闭)。

        TOKEN6688_CALLBACK_URL 配置后,media 类异步任务(视频/音乐/异步 TTS)终态时
        平台主动 POST 任务快照;TOKEN6688_CALLBACK_SECRET 用于 HMAC 验签。
        """
        url = _env("TOKEN6688_CALLBACK_URL", "").strip()
        if not url:
            return {}
        out = {"callback_url": url}
        secret = _env("TOKEN6688_CALLBACK_SECRET", "").strip()
        if secret:
            out["callback_secret"] = secret
        return out

    async def _request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: dict[str, Any] | None = None,
        _retried: bool = False,
    ) -> dict[str, Any]:
        """覆盖:429/5xx 按 Retry-After 退避重试 1 次 + error.code/error.type 细化。

        官方错误协议:{"error":{"code": "...", "message": "...", "type": "..."}}
        —— 业务/参数类在 error.code,鉴权/计费/内容审核类在 error.type;
        429 带 Retry-After 头(或响应体 retry_after 秒数);402=余额不足(整单预冻结)。
        """
        try:
            return await super()._request(method, url, headers=headers, json=json)
        except ProviderError as e:
            status = getattr(e, "status_code", None) or 0
            retriable = status == 429 or status >= 500
            if not retriable or _retried:
                raise self._enrich_error(e) from e
            # 退避:Retry-After 头取不到时按 429→5s / 5xx→3s
            delay = 5.0 if status == 429 else 3.0
            logger.warning("Token6688 %s 于 %s,%ss 后重试 1 次", status, url, delay)
            await asyncio.sleep(delay)
            return await self._request(method, url, headers=headers, json=json, _retried=True)

    @staticmethod
    def _enrich_error(e: ProviderError) -> ProviderError:
        """把官方 error.code/error.type 语义补进错误消息(402 余额/403 内容审核/429 限频)。"""
        text = str(e)
        if "insufficient_funds" in text or getattr(e, "status_code", 0) == 402:
            return ProviderError(
                f"Token6688 余额不足(insufficient_funds):异步任务按整单预冻结,请充值后重试。{text}", 402,
            )
        if "content_policy_violation" in text:
            return ProviderError(f"Token6688 内容被安全策略拦截:请调整提示词后重试。{text}", 403)
        if "rate_limit_error" in text:
            return ProviderError(f"Token6688 触发限频:请按 Retry-After 退避后重试。{text}", 429)
        return e

    # ------------------------------------------------------------------
    # 多模态输入归一化(官方:多模态输入只收 URL,本地/内联图片先经 /v1/files 换公网 URL)
    # ------------------------------------------------------------------
    async def _normalize_vision_inputs(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """把 messages 里 data: base64 图片 URI 换成 upload_file 公网 URL。

        token6688 网关多模态输入只接受公网 URL(vision_analyze 本地文件/base64
        场景直发 data URI 会被拒),在 provider 层统一归一化,所有对话调用方
        (complete/astream/vision_analyze/带图对话)零改动受益。上传失败时保留
        data URI 原样直发(上游若支持则不劣化)。返回深拷贝,不污染调用方消息。
        """
        has_data_uri = False
        for msg in messages:
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list):
                continue
            for part in content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    url = (part.get("image_url") or {}).get("url")
                    if isinstance(url, str) and url.startswith("data:") and ";base64," in url:
                        has_data_uri = True
                        break
            if has_data_uri:
                break
        if not has_data_uri:
            return messages

        messages = copy.deepcopy(messages)
        for msg in messages:
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list):
                continue
            for part in content:
                if not (isinstance(part, dict) and part.get("type") == "image_url"):
                    continue
                inner = part.get("image_url")
                if not isinstance(inner, dict):
                    continue
                url = inner.get("url")
                if not (isinstance(url, str) and url.startswith("data:") and ";base64," in url):
                    continue
                header, b64 = url.split(";base64,", 1)
                mime = header.split(":", 1)[-1].split(";", 1)[0] or "image/png"
                ext = (mime.split("/", 1)[-1].split("+", 1)[0] or "png")[:8]
                try:
                    raw = base64.b64decode(b64)
                    public_url = await self.upload_file(raw, f"vision-input.{ext}")
                except (ValueError, ProviderError) as e:
                    logger.warning("token6688 多模态图片转 URL 失败,保留 data URI 直发: %s", e)
                    continue
                inner["url"] = public_url
        return messages

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """非流式对话(先归一化多模态输入,再走 OpenAI 兼容协议)。"""
        messages = await self._normalize_vision_inputs(messages)
        return await super().complete(messages, model, tools=tools, **kwargs)

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式对话(先归一化多模态输入,再走 OpenAI 兼容流式协议)。"""
        messages = await self._normalize_vision_inputs(messages)
        async for event in super().astream(messages, model, tools=tools, **kwargs):
            yield event

    # ------------------------------------------------------------------
    # 模型清单(免鉴权 /v1/skills/models,112 模型;映射 OpenAI 风格供 model_sync)
    # 列表端点实测字段:name/display_name/type(chat|video|image|audio)/tags/
    # api_endpoint/api_format/supported_vendors/description_zh — type 即模态
    # 分组依据;单模型 pricing/param_schema 走 /v1/skills/models/{id}(见
    # get_model_info),跨渠道价走 /{id}/pricing。
    # ------------------------------------------------------------------
    async def list_models(self) -> list[dict[str, Any]]:
        try:
            data = await self._request("GET", f"{self._api_base_v1()}/skills/models", headers=self._headers())
        except ProviderError:
            # skills/models 不可用时降级 GT 标准 /v1/models
            return await super().list_models()
        items = data.get("models") or []
        out: list[dict[str, Any]] = []
        for it in items:
            if not (isinstance(it, dict) and (it.get("name") or it.get("id"))):
                continue
            out.append({
                "id": it.get("name") or it.get("id"),
                "display_name": it.get("display_name"),
                "api_endpoint": it.get("api_endpoint"),
                "capabilities": it.get("capabilities") or [],
                "owned_by": self.provider_code,
                # --- 目录加深字段(type=模态分组;tags 排序列表;官方直连标记) ---
                "modality": (it.get("type") or "").strip(),
                "tags": self._normalize_tags(it.get("tags")),
                "api_format": it.get("api_format") or "openai",
                "supported_vendors": self._normalize_tags(it.get("supported_vendors")),
                "description": it.get("description_zh") or it.get("description") or "",
            })
        return out

    @staticmethod
    def _normalize_tags(v: Any) -> list[str]:
        """官方列表端点的 tags/supported_vendors 可能是 list 也可能是 str 形如
        "['chat', ...]"(实测两种都出现)——统一成干净 list。"""
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("[") and s.endswith("]"):
                try:
                    import ast
                    parsed = ast.literal_eval(s)
                    if isinstance(parsed, (list, tuple)):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except (ValueError, SyntaxError):
                    pass
            return [t.strip() for t in s.split(",") if t.strip()] if s else []
        return []

    # ------------------------------------------------------------------
    # 图片生成(同步 OpenAI Images 协议 / 可选真异步 model-runtime)
    # 官方枚举(gpt-image-2 param_schema 实测 2026-09-08,全网关图片模型通用)
    # ------------------------------------------------------------------
    _IMAGE_ASPECT_RATIOS = {
        "1:1", "auto", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "21:9", "9:21",
    }  # 与 size(像素串,兼容老 API)二选一
    _IMAGE_MODES = {"text-to-image", "image-edit", "multi-reference"}
    _IMAGE_OUTPUT_FORMATS = {"png", "jpeg"}
    _IMAGE_QUALITIES = {"auto", "high", "medium", "low"}
    _IMAGE_RESOLUTIONS = {"1K", "2K", "4K"}  # 三档对全部比例可用
    _IMAGE_MAX_COUNT = 50
    _IMAGE_MAX_REF_IMAGES = 16  # 参考图 max_items,单张 max_bytes=25MiB

    async def generate_image(
        self,
        prompt: str,
        *,
        model: str | None = None,
        size: str | None = None,
        n: int = 1,
        aspect_ratio: str | None = None,
        count: int | None = None,
        mode: str | None = None,
        output_format: str | None = None,
        quality: str | None = None,
        resolution: str | None = None,
        images: list[str] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """图片生成,返回 {provider, model, images: [{url}|{b64_json}], raw}。

        官方参数一等公民(枚举已按 /v1/skills/models/gpt-image-2 校准):
        - aspect_ratio ∈ {1:1,auto,3:2,2:3,4:3,3:4,5:4,4:5,16:9,9:16,21:9,9:21}
          (与 size 二选一;官方规范形状是 aspect_ratio,size 为兼容老 API)
        - count 1~50(兼容老 API 的 n 自动映射);mode ∈ {text-to-image,image-edit,
          multi-reference};output_format ∈ {png,jpeg};quality ∈ {auto,high,medium,low};
          resolution ∈ {1K,2K,4K};images 参考图 ≤16 张(单张 ≤25MiB,公网 URL)
        默认走同步 /v1/images/generations(OpenAI 兼容,官方实测 40-50s)。
        TOKEN6688_IMAGE_ASYNC=1 时走 POST /api/v1/model-runtime/invoke 真异步
        (立即返 task_id,轮询 /api/v1/model-runtime/tasks/{id},官方推荐抗超时)。
        """
        used_model = model or _env("TOKEN6688_IMAGE_MODEL", "gpt-image-2")
        # --- 官方枚举校验(发请求前拦,错误信息带合法值) ---
        if aspect_ratio is not None and aspect_ratio not in self._IMAGE_ASPECT_RATIOS:
            raise ProviderError(
                f"Token6688 图片 aspect_ratio 非法: {aspect_ratio!r}(官方枚举: "
                + ",".join(sorted(self._IMAGE_ASPECT_RATIOS)) + ")", 400,
            )
        if mode is not None and mode not in self._IMAGE_MODES:
            raise ProviderError(
                f"Token6688 图片 mode 非法: {mode!r}(官方枚举: text-to-image/image-edit/multi-reference)", 400,
            )
        if output_format is not None and output_format not in self._IMAGE_OUTPUT_FORMATS:
            raise ProviderError(f"Token6688 图片 output_format 非法: {output_format!r}(官方: png/jpeg)", 400)
        if quality is not None and quality not in self._IMAGE_QUALITIES:
            raise ProviderError(f"Token6688 图片 quality 非法: {quality!r}(官方: auto/high/medium/low)", 400)
        if resolution is not None and resolution not in self._IMAGE_RESOLUTIONS:
            raise ProviderError(f"Token6688 图片 resolution 非法: {resolution!r}(官方: 1K/2K/4K)", 400)
        eff_count = count if count is not None else n
        if not 1 <= int(eff_count) <= self._IMAGE_MAX_COUNT:
            raise ProviderError(
                f"Token6688 图片 count 越界: {eff_count}(官方 1~{self._IMAGE_MAX_COUNT})", 400,
            )
        if images and len(images) > self._IMAGE_MAX_REF_IMAGES:
            raise ProviderError(
                f"Token6688 参考图最多 {self._IMAGE_MAX_REF_IMAGES} 张(官方 max_items;单张 ≤25MiB)", 400,
            )
        norm_kwargs = {
            **({"aspect_ratio": aspect_ratio} if aspect_ratio else {}),
            **({"mode": mode} if mode else {}),
            **({"output_format": output_format} if output_format else {}),
            **({"quality": quality} if quality else {}),
            **({"resolution": resolution} if resolution else {}),
            **({"images": images} if images else {}),
        }
        if _env("TOKEN6688_IMAGE_ASYNC", "0") in ("1", "true", "True"):
            return await self._generate_image_async(prompt, used_model, count=eff_count, **norm_kwargs)
        # 同步形状:官方规范参数 + 兼容字段(size/n 只在有值时发,避免覆盖规范参数)
        payload: dict[str, Any] = {"model": used_model, "prompt": prompt, "count": int(eff_count)}
        if size:
            payload["size"] = size
        else:
            payload["n"] = int(eff_count)  # 老兼容字段:同步端点未带 aspect_ratio 时用
        payload.update({k: v for k, v in kwargs.items() if k not in ("count", "n")})
        payload.update(norm_kwargs)
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

    async def images_edits(
        self,
        prompt: str,
        image_bytes: bytes,
        filename: str = "image.png",
        *,
        model: str | None = None,
        mask_bytes: bytes | None = None,
        mask_filename: str = "mask.png",
        n: int = 1,
        size: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """图片编辑(POST /v1/images/edits,multipart;OpenAI Images edits 同构)。

        官方网关已注册该端点(405 Only POST 实测;参数文档未详列,按 OpenAI 协议透传):
        - image 必传(待编辑图,png/jpeg/webp ≤25MiB;本地字节直接传)
        - mask 可选(透明区域=重绘区)
        - prompt/n/size 及 output_format/quality 等经 kwargs 透传
        响应形状与 generations 一致({data:[{url}|{b64_json}]}),同步 40-50s,
        200 仍需检查 body.error。
        """
        used_model = model or _env("TOKEN6688_IMAGE_MODEL", "gpt-image-2")
        if len(image_bytes) > 25 * 1024 * 1024:
            raise ProviderError(f"Token6688 待编辑图 {len(image_bytes) / 1048576:.1f}MiB 超 25MiB 上限", 400)
        data: dict[str, Any] = {"model": used_model, "prompt": prompt, "n": str(int(n))}
        if size:
            data["size"] = size
        for k, v in kwargs.items():
            if v is not None:
                data[k] = str(v) if isinstance(v, (int, float)) else v
        files: list[tuple[str, tuple[str, bytes]]] = [("image", (filename, image_bytes))]
        if mask_bytes:
            files.append(("mask", (mask_filename, mask_bytes)))
        try:
            client = get_http_client()
            resp = await client.post(
                f"{self._api_base_v1()}/images/edits",
                headers={"Authorization": f"Bearer {self.api_key}"},
                data=data, files=files, timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Token6688 图片编辑网络异常: {e}") from e
        if resp.status_code >= 400:
            raise ProviderError(
                f"Token6688 图片编辑失败: {resp.status_code} {resp.text[:300]}", resp.status_code,
            )
        try:
            body = resp.json()
        except ValueError as e:
            raise ProviderError(f"Token6688 图片编辑响应非 JSON: {resp.text[:200]!r}", 502) from e
        err = body.get("error")
        if err:
            raise ProviderError(f"Token6688 图片编辑失败(200+error): {err.get('message') or err}", 502)
        images: list[dict[str, Any]] = []
        for item in body.get("data") or []:
            if isinstance(item, dict):
                if item.get("b64_json"):
                    images.append({"b64_json": item["b64_json"]})
                elif item.get("url"):
                    images.append({"url": item["url"]})
        if not images:
            raise ProviderError(f"Token6688 图片编辑响应无 url/b64_json: {str(body)[:200]}", 502)
        return {"provider": self.provider_code, "model": used_model, "images": images, "raw": body}

    async def cancel_task(self, task_id: str) -> dict[str, Any]:
        """取消在途异步任务(DELETE /v1/tasks/{id} 优先,POST .../cancel 兜底)。

        ⚠ 官方文档未收录取消端点;实测 /v1/tasks/* 前缀需鉴权(无 key 探测 401),
        终态任务取消必然失败。返回 {ok, status, raw}:网络层失败(404/405/501)时
        ok=False 并如实带原因,不抛异常 —— 调用方据此决定提示文案。
        """
        base = f"{self._api_base_v1()}/tasks/{task_id}"
        last_err = ""
        for method, url in (("DELETE", base), ("POST", f"{base}/cancel")):
            try:
                data = await self._request(method, url, headers=self._headers(), json={})
                ok = not (isinstance(data, dict) and data.get("error"))
                return {"ok": ok, "status": (data or {}).get("status", ""), "raw": data}
            except ProviderError as e:
                last_err = str(e)
                status = getattr(e, "status_code", 0) or 0
                # 404=任务不存在(可能已终态);401/403=端点未开放;405/501=方法不支持 → 都换下一形态
                if status in (404,):
                    return {"ok": False, "status": "not_found", "error": last_err}
                continue
        return {"ok": False, "status": "unsupported", "error": last_err or "取消端点均不可用(官方未收录)"}

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
        """语音合成,返回 (音频字节, content_type)。payload 差异可经 TOKEN6688_TTS_PAYLOAD 合并。

        官方约束(/v1/skills/guide + tts-1-hd param_schema):speed ∈ 0.25~4.0;
        sync 端点 max_prompt_chars=4096(超长请用 tts_async,≤5000)。
        """
        if not 0.25 <= float(speed) <= 4.0:
            raise ProviderError(f"Token6688 TTS speed 越界: {speed}(官方 0.25~4.0)", 400)
        if len(text) > 4096:
            raise ProviderError(
                f"Token6688 同步 TTS 文本超长: {len(text)} > 4096 字符(官方 max_prompt_chars;"
                "长文本请改用 POST /voice/tts-async 异步端点)", 400,
            )
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
        """上传参考音频到声纹库(POST /v1/audio/voices,异步任务,轮询至终态)。

        官方硬限制:仅 multipart 本地文件;格式 MP3/M4A/WAV;时长 10~300 秒;
        严格 <20MiB(⚠ 与 /v1/files 的 50MB 上限不同)。克隆音色用法:
        speech.model=voice.model、speech.voice=voice.id(返回字段直取)。
        """
        ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
        if ext not in ("mp3", "m4a", "wav"):
            raise ProviderError(
                f"Token6688 声纹参考音频格式不支持: .{ext}(官方仅 MP3/M4A/WAV;时长 10~300s)", 400,
            )
        if len(audio_bytes) >= 20 * 1024 * 1024:
            raise ProviderError(
                f"Token6688 声纹参考音频 {len(audio_bytes) / 1048576:.1f}MiB 超官方 <20MiB 硬限制"
                "(裁剪至 10~300 秒干声后重试)", 400,
            )
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
        operation: str = "generate",
        negative_tags: str | None = None,
        clip_id: str | None = None,
        cover_clip_id: str | None = None,
        continue_clip_id: str | None = None,
        continue_at: float | None = None,
        wait: bool = True,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """音乐生成(Suno 风格扁平形状),返回 {provider, model, task_id, audio_url}。

        官方参数全景(/v1/skills/models/music 实测,2026-09-08 全 8 operation 校准):
        - mode ∈ {song(默认), instrumental};vocal_gender ∈ {auto, m, f}
        - operation 全 8 枚举:
            generate    新建曲(默认)
            extend      续写(必填 continue_clip_id;可选 continue_at 秒)
            cover       翻唱(必填 cover_clip_id)
            lyrics      仅写词不出曲(产物在响应文本,不轮询音频)
            stems       人声/伴奏 2 分轨(必填 clip_id)
            stems_all   全轨分离(必填 clip_id)
            mp4         渲染带封面 MP4(必填 clip_id,可选 cover_clip_id)
            concat      整曲拼接(必填 clip_id,多段用逗号/数组)
        - version ∈ {chirp-v5-5(最新), chirp-v5, chirp-v4-5+, ...};不传落平台默认
        - style/negative_tags(排除风格)/title/lyrics
        - ⚠ lyrics 操作无 task_id 不轮询;其余操作轮询 GET /v1/tasks/{task_id}
        wait=False 时提交后不轮询,立即返回 {status: "submitted", task_id, poll_url}
        (与 generate_video 同款防卡死模式;官方音乐生成耗时约 1~5 分钟)。
        """
        _OPS_REQUIRING_CLIP = {"stems", "stems_all", "mp4", "concat"}
        operation = (operation or "generate").strip()
        if operation not in self._MUSIC_OPERATIONS:
            raise ProviderError(
                f"Token6688 音乐 operation 非法: {operation!r}(官方枚举: "
                "generate/extend/cover/lyrics/stems/stems_all/mp4/concat)", 400,
            )
        if operation in _OPS_REQUIRING_CLIP and not clip_id:
            raise ProviderError(f"Token6688 operation={operation} 必填 clip_id(要操作的曲目 ID)", 400)
        if operation == "cover" and not cover_clip_id:
            raise ProviderError("Token6688 operation=cover 必填 cover_clip_id(被翻唱曲目 ID)", 400)
        if operation == "extend" and not continue_clip_id:
            raise ProviderError("Token6688 operation=extend 必填 continue_clip_id(被续写曲目 ID)", 400)

        body: dict[str, Any] = {
            "model": model, "prompt": prompt, "mode": mode, "operation": operation,
        }
        for k, v in (("lyrics", lyrics), ("style", style), ("title", title),
                     ("vocal_gender", vocal_gender), ("version", version),
                     ("negative_tags", negative_tags),
                     ("clip_id", clip_id), ("cover_clip_id", cover_clip_id),
                     ("continue_clip_id", continue_clip_id),
                     ("continue_at", continue_at)):
            if v is not None and v != "":
                body[k] = v
        body.update(kwargs)
        # 官方 webhook:配 TOKEN6688_CALLBACK_URL 后所有 media 类异步任务主动推终态
        body.update(self._callback_fields())
        data = await self._request(
            "POST", f"{self._api_base_v1()}/audio/generations", headers=self._headers(), json=body,
        )
        if operation == "lyrics":
            # 仅写词不出曲:无 task_id、无音频产物,词在响应体
            text = data.get("lyrics") or data.get("text") or data.get("content") or ""
            return {
                "provider": self.provider_code, "model": model, "operation": operation,
                "lyrics": text, "raw": data,
            }
        task_id = self._extract_task_id(data)
        if not task_id:
            raise ProviderError(f"Token6688 音乐响应无 task_id: {str(data)[:300]}", 502)
        poll_url = f"{self._api_base_v1()}/tasks/{task_id}"
        if not wait:
            return {
                "provider": self.provider_code,
                "model": model,
                "task_id": task_id,
                "status": "submitted",
                "poll_url": poll_url,
            }
        result = await self._poll_task(poll_url)
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
    # 模型发现与估价(2026-09-08 文档校准;/v1/logical-models 与单模型 pricing 免鉴权)
    # ------------------------------------------------------------------
    async def get_model_params(self, model: str) -> dict[str, Any]:
        """单模型功能与参数(GET /v1/skills/models/{model},免鉴权)。

        返回 params **数组**:可选值在 options[].value(发参数值,不是界面显示名),
        默认值标 options[].is_default —— 枚举参数发 value 才生效,发显示名会被
        当无效值忽略落默认档(官方"参数不生效"客诉)。
        """
        return await self._request(
            "GET", f"{self._api_base_v1()}/skills/models/{model}",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

    async def get_model_pricing(self, model: str) -> dict[str, Any]:
        """模型跨渠道价格(GET /v1/skills/models/{model}/pricing,免鉴权)。

        返回 channel_groups[]:含 base_price/billing_method(按秒/按次)/avg_response_seconds 等。
        """
        return await self._request(
            "GET", f"{self._api_base_v1()}/skills/models/{model}/pricing",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

    async def list_logical_models(self) -> list[dict[str, Any]]:
        """JSON-Schema 形态模型参数(GET /v1/logical-models,免鉴权)。

        param_schema 对象带 enum/default 与 max_bytes/max_items(参考素材上限机读,
        例 wan-3-0 视频 100MB、seedance-2-5-special 视频 200MB)。⚠ 与 skills/models
        的 params 数组字段形态不同,别混用。
        """
        data = await self._request(
            "GET", f"{self.base_url.rstrip('/')}/v1/logical-models",
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        return data.get("models") or []

    async def estimate_pricing(
        self, model: str, prompt: str, *, params: dict[str, Any] | None = None, **kwargs: Any,
    ) -> dict[str, Any]:
        """实时估价(POST /v1/pricing-estimate;参数与提交完全一致才准)。

        ⚠ 带参考视频必须传 video_total_duration_sec(各段时长之和,秒),否则估价
        不含参考视频费(官方真实客诉:估 4.5 实扣 7.3)。响应:
        effective_total_rmb(当前策略实付)/ max_effective_total_rmb(故障切备用渠道上限)/
        price_basis.output_rmb + reference_media_rmb。
        """
        body: dict[str, Any] = {"model": model, "prompt": prompt}
        if params:
            body["params"] = params  # 信封形状(与 media/generate 同)
        body.update(kwargs)
        return await self._request(
            "POST", f"{self._api_base_v1()}/pricing-estimate", headers=self._headers(), json=body,
        )

    async def batch_estimate(self, estimates: list[dict[str, Any]]) -> dict[str, Any]:
        """批量估价(POST /v1/pricing-estimate/batch,一次最多 100 个组合)。"""
        return await self._request(
            "POST", f"{self._api_base_v1()}/pricing-estimate/batch",
            headers=self._headers(), json={"estimates": estimates},
        )

    async def get_voice(self, voice_id: str) -> dict[str, Any]:
        """查询单一声纹(GET /v1/audio/voices/{voice_id})。"""
        return await self._request(
            "GET", f"{self._api_base_v1()}/audio/voices/{voice_id}", headers=self._headers(),
        )

    async def query_task_status_alt(self, task_id: str) -> dict[str, Any]:
        """任务状态速查(GET /v1/skills/task-status?task_id=,等价 /v1/tasks/{id})。

        ⚠ 此端点 status 是中文展示文案,state 是英文枚举 —— 与 /v1/tasks 相反。
        """
        return await self._request(
            "GET", f"{self._api_base_v1()}/skills/task-status?task_id={task_id}",
            headers=self._headers(),
        )

    async def media_generate(
        self, model: str, prompt: str, *, params: dict[str, Any] | None = None, **kwargs: Any,
    ) -> dict[str, Any]:
        """视频/音频统一异步入口(POST /v1/media/generate,params 信封形状)。

        与 /v1/videos/generations、/v1/audio/generations 能力等价但形状不同(信封)。
        ⚠ image 走本路径是**同步**的(内部转 images/generations 阻塞 40-50s),不返 task_id。
        返回 {provider, model, task_id?, status, media_url?}:提交即含 task_id(视频/音频)。
        """
        body: dict[str, Any] = {"model": model, "prompt": prompt, "params": params or {}}
        body.update(kwargs)
        data = await self._request(
            "POST", f"{self._api_base_v1()}/media/generate", headers=self._headers(), json=body,
        )
        err = data.get("error")
        if err:
            raise ProviderError(f"Token6688 media/generate 失败: {err.get('message') or err}", 502)
        task_id = self._extract_task_id(data)
        media_url = self._extract_media_url(data)
        if media_url and not task_id:
            return {"provider": self.provider_code, "model": model, "status": "completed", "media_url": media_url, "raw": data}
        if not task_id:
            raise ProviderError(f"Token6688 media/generate 无 task_id: {str(data)[:300]}", 502)
        return {
            "provider": self.provider_code, "model": model, "task_id": task_id,
            "status": "submitted", "poll_url": f"{self._api_base_v1()}/tasks/{task_id}", "raw": data,
        }

    async def tts_async(
        self,
        text: str,
        *,
        model: str | None = None,
        voice: str = "alloy",
        speed: float = 1.0,
        response_format: str = "mp3",
        wait: bool = True,
    ) -> dict[str, Any]:
        """声纹异步 TTS(POST /v1/audio/speech/async)→ task 轮询 → 公网语音 URL。

        与同步 /v1/audio/speech(返音频字节)不同:本端点立即返 task_id,产物是
        TokenGo CDN 公网 URL(适合长文本/免流量转发场景)。
        """
        used_model = model or _env("TOKEN6688_TTS_MODEL", "tts-1-hd")
        if not 0.25 <= float(speed) <= 4.0:
            raise ProviderError(f"Token6688 TTS speed 越界: {speed}(官方 0.25~4.0)", 400)
        payload: dict[str, Any] = {
            "model": used_model, "input": text, "voice": voice,
            "speed": speed, "response_format": response_format,
        }
        # 官方 webhook:异步 TTS 同属 media 任务,env 配置即透传
        payload.update(self._callback_fields())
        data = await self._request(
            "POST", f"{self._api_base_v1()}/audio/speech/async", headers=self._headers(), json=payload,
        )
        task_id = self._extract_task_id(data)
        if not task_id:
            raise ProviderError(f"Token6688 speech/async 无 task_id: {str(data)[:300]}", 502)
        poll_url = f"{self._api_base_v1()}/tasks/{task_id}"
        if not wait:
            return {
                "provider": self.provider_code, "model": used_model, "task_id": task_id,
                "status": "submitted", "poll_url": poll_url,
            }
        result = await self._poll_task(poll_url)
        audio_url = result.get("output_url") or self._extract_media_url(result)
        if not audio_url:
            raise ProviderError(f"Token6688 TTS 任务 {task_id} 完成但无 output_url: {str(result)[:300]}", 502)
        return {"provider": self.provider_code, "model": used_model, "task_id": task_id, "audio_url": audio_url}

    # ------------------------------------------------------------------
    # 视频生成(POST /v1/videos/generations 扁平形状 → GET /v1/tasks/{id} 轮询)
    # ------------------------------------------------------------------
    # 官方 mode 全 6 枚举(/v1/skills/guide v2026-07-11 + seedance-2-5 param_schema):
    #   text-to-video   纯文生视频,duration=成片时长
    #   first-frame     首帧图生视频(images=[首帧]),duration=成片时长
    #   first-last      首尾帧插值(images=[首帧,末帧]),duration=成片时长
    #   reference       参考视频生成(videos=[参考视频],迁移风格/主体),duration=成片时长
    #   edit            视频编辑(videos=[原视频]),输出时长跟随原视频 → duration 不发送
    #   extend          视频续写(videos=[原视频]),duration=成片总长(原片+续写)
    _VIDEO_MODES = {
        "text-to-video", "first-frame", "first-last", "reference", "edit", "extend",
    }
    _VIDEO_MAX_REFS = 10  # audios/videos 官方均 ≤10 段
    # 内部控制键(不透传网关);其余 kwargs 全量透传 → 官方后续新增参数零改动兼容
    _VIDEO_INTERNAL_KEYS = {"wait", "image", "max_wait", "poll_interval", "provider", "wait_s"}

    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        wait: bool = True,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """视频生成。传 kwargs.image(公网 URL)自动切 first-frame 图生模式。

        官方校准(2026-09-08 /v1/skills/guide v2026-07-11):
        - 扁平形状:参数放顶层,严禁 {"params": {...}} 信封(发错形状网关静默摊平落默认值)
        - prompt 必填(纯图生也必须写提示词,否则上游按内容异常拒绝)
        - 轮询 GET /v1/tasks/{task_id} 直到 is_final=true;产物读 output_url
        - 参考素材必须公网直链(本地文件先 upload_file):
            images  首帧/首尾帧(1~2 张);videos 参考视频(≤10 段,单条 1.8~30s,
                    合计≤30s,200MB);audios 参考音频(≤10 段,单段 2~30s,合计≤30s,50MB)
        - mode 全 6 枚举见 _VIDEO_MODES,逐 mode 时长语义不同(edit 不发 duration)
        - client_request_id 幂等:网络超时重试不重复扣费

        wait=True(默认)阻塞轮询至终态(官方 p90 55~75 分钟,仅后台 worker 用);
        wait=False 提交即返回 {status: "submitted", task_id, poll_url} —— MCP 对话
        工具用此模式,避免长任务拖垮工具调用(再经 get_task_status 查询)。
        """
        used_model = model or _env("TOKEN6688_VIDEO_MODEL", "seedance-2-5")
        endpoint = _env("TOKEN6688_VIDEO_ENDPOINT", "/v1/videos/generations")
        if not endpoint.startswith("/"):
            endpoint = f"/{endpoint}"
        submit_url = f"{self._api_base_v1()}{endpoint[len('/v1'):]}" if endpoint.startswith("/v1") \
            else f"{self.base_url.rstrip('/')}{endpoint}"

        # --- 参考素材归一化 + 官方上限校验(细致度:发请求前拦,省一次 502) ---
        image = kwargs.get("image")
        images = [image] if isinstance(image, str) else (list(image) if image else [])
        videos = kwargs.get("videos") or []
        if isinstance(videos, str):
            videos = [videos]
        audios = kwargs.get("audios") or []
        if isinstance(audios, str):
            audios = [audios]
        if len(videos) > self._VIDEO_MAX_REFS:
            raise ProviderError(
                f"Token6688 参考视频最多 {self._VIDEO_MAX_REFS} 段(官方:单条 1.8~30s、合计≤30s、200MB),收到 {len(videos)} 段", 400,
            )
        if len(audios) > self._VIDEO_MAX_REFS:
            raise ProviderError(
                f"Token6688 参考音频最多 {self._VIDEO_MAX_REFS} 段(官方:单段 2~30s、合计≤30s、50MB),收到 {len(audios)} 段", 400,
            )

        # --- mode 决策:显式 > 自动推断(2 图→first-last;有视频→reference;图→first-frame) ---
        mode = (kwargs.get("mode") or "").strip()
        if mode and mode not in self._VIDEO_MODES:
            raise ProviderError(
                f"Token6688 视频 mode 非法: {mode!r}(官方枚举: text-to-video/first-frame/"
                f"first-last/reference/edit/extend)", 400,
            )
        if not mode:
            if len(images) >= 2:
                mode = "first-last"
            elif videos:
                mode = "reference"
            elif images:
                mode = "first-frame"
            else:
                mode = "text-to-video"

        body: dict[str, Any] = {
            "model": used_model,
            "prompt": prompt,  # 官方:视频生成 prompt 必填
            "mode": mode,
            "client_request_id": uuid.uuid4().hex,  # 官方强烈建议:幂等防重复扣费
        }
        # edit 模式官方:输出时长跟随原视频,duration 参数失效 → 不发送
        if mode != "edit":
            body["duration"] = str(duration)  # param_schema duration 为字符串枚举("4".."30"),数字/字符串均可
        if images:
            body["images"] = images
        if videos:
            body["videos"] = videos
        if audios:
            body["audios"] = audios
        # 其余 kwargs 全量透传(aspect_ratio/resolution/count/camera 系列/官方新增参数…)
        for k, v in kwargs.items():
            if k in self._VIDEO_INTERNAL_KEYS or k in body or v is None:
                continue
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
        if not wait:
            # 提交即返回:调用方(MCP 工具/worker)稍后用 get_task_status 轮询
            return {
                "provider": self.provider_code,
                "model": used_model,
                "task_id": task_id,
                "status": "submitted",
                "poll_url": poll_url,
                "duration": duration,
            }
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
                # 官方失败分类:error_class ∈ content_blocked(审核未过,不计费)/
                # rate_limit / vendor_model_unavailable / generation_failed(预冻结自动解冻)
                err_class = str(data.get("error_class") or "").strip()
                msg = str(data.get("error") or data.get("error_message") or data.get("message") or data)[:300]
                hint = {
                    "content_blocked": "内容审核未通过(未计费),请调整提示词/素材后重试",
                    "rate_limit": "上游渠道限频,稍候重试",
                    "vendor_model_unavailable": "上游模型临时不可用,可换模型重试",
                    "generation_failed": "生成失败(预冻结金额已自动解冻),可直接重试",
                }.get(err_class, "")
                suffix = f" [{err_class}: {hint}]" if err_class else ""
                raise ProviderError(f"Token6688 任务失败(status={status or state}){suffix}: {msg}", 502)
            if time.monotonic() > deadline:
                raise ProviderError(
                    f"Token6688 任务轮询超时({max_wait:.0f}s, status={status or 'unknown'}): {poll_url}", 504,
                )
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 10.0)

    async def get_task_status(self, task_id: str) -> dict[str, Any]:
        """查询任务状态(单次,不轮询)—— MCP 对话工具"视频好了吗"查询模式。

        归一化返回 {status, is_final, ok, video_url, progress, raw}:
        - status: pending/processing/completed/failed(网关英文四值)
        - ok: 终态且成功;video_url: 成片直链(output_url/result_url 兼容)
        """
        data = await self._request(
            "GET", f"{self._api_base_v1()}/tasks/{task_id}", headers=self._headers(),
        )
        state = str(data.get("state") or "").lower()
        status = str(data.get("status") or data.get("task_status") or state or "").lower()
        is_final = bool(data.get("is_final")) or state in (_TASK_OK_STATES | _TASK_FAIL_STATES)
        video_url = data.get("output_url") or data.get("result_url") or self._extract_media_url(data) or ""
        ok = (is_final and state in _TASK_OK_STATES) or status in _TASK_OK_STATES or bool(video_url)
        failed = (is_final and state in _TASK_FAIL_STATES) or status in _TASK_FAIL_STATES
        return {
            "status": status or ("completed" if ok else ("failed" if failed else "processing")),
            "status_zh": data.get("status_zh"),  # 官方中文展示文案(/v1/tasks 响应含)
            "stage": data.get("stage"),  # downloading=产物转存 CDN 中,继续等(勿当终态)
            "is_final": is_final,
            "ok": ok,
            "failed": failed,
            "video_url": video_url,
            "progress": data.get("progress"),
            "error": str(data.get("error") or data.get("error_message") or "")[:300] or None,
            "error_class": data.get("error_class"),  # content_blocked/rate_limit/vendor_model_unavailable/generation_failed
            "actual_cost": data.get("actual_cost_micro_usd"),  # 实扣(微美元),失败不计费
            "raw": data,
        }

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
