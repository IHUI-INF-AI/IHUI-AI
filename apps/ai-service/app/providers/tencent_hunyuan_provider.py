# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tencent Hunyuan(腾讯混元)适配器(通过 LiteLLM 网关调用)。

api_base: https://hunyuan.tencentcloudapi.com
model 前缀: hunyuan-* (hunyuan-pro / hunyuan-standard / hunyuan-lite)
协议: 通过 LiteLLM 网关调用(litellm.acompletion(model="hunyuan/..."))
注: 腾讯自有协议(TC3-HMAC-SHA256 签名)复杂,直接复用 LiteLLM 内置的 hunyuan 适配。
    LiteLLM 未安装或调用失败时降级为 503。
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
from collections.abc import AsyncIterator
from typing import Any

from ..core.llm_gateway import get_http_client
from .base_provider import BaseProvider, ProviderError

logger = logging.getLogger(__name__)

_HUNYUAN_VIDEO_BASE = "https://hunyuan.tencentcloudapi.com"
_HUNYUAN_VIDEO_VERSION = "2023-04-01"


def _htc3_signer(
    secret_id: str,
    secret_key: str,
    *,
    action: str,
    service: str,
    host: str,
    payload: dict[str, Any],
    version: str,
) -> dict[str, str]:
    """Tencent Cloud TC3-HMAC-SHA256 请求签名,返回完整请求头。"""
    timestamp = int(time.time())
    date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    hashed_payload = hashlib.sha256(body).hexdigest()

    canonical_headers = (
        f"content-type:application/json; charset=utf-8\nhost:{host}\n"
        f"x-tc-action:{action.lower()}\n"
    )
    signed_headers = "content-type;host;x-tc-action"
    canonical_request = "\n".join(
        ["POST", "/", "", canonical_headers, signed_headers, hashed_payload]
    )

    credential_scope = f"{date}/{service}/tc3_request"
    string_to_sign = "\n".join(
        [
            "TC3-HMAC-SHA256",
            str(timestamp),
            credential_scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )

    def _hmac(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _hmac(secret_key.encode("utf-8"), date)
    secret_service = _hmac(secret_date, service)
    secret_signing = _hmac(secret_service, "tc3_request")
    signature = hmac.new(
        secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    return {
        "Content-Type": "application/json; charset=utf-8",
        "Host": host,
        "X-TC-Action": action,
        "X-TC-Version": version,
        "X-TC-Timestamp": str(timestamp),
        "Authorization": (
            f"TC3-HMAC-SHA256 Credential={secret_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        ),
    }


class TencentHunyuanProvider(BaseProvider):
    """腾讯混元适配器:通过 LiteLLM 网关调用,LiteLLM 不可用时降级 503。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        base = api_base or "https://hunyuan.tencentcloudapi.com"
        super().__init__(api_key, base, timeout)
        self.base_url = base.rstrip("/")
        sid, sk = self._resolve_credentials(api_key)
        self._secret_id = sid
        self._secret_key = sk

    @staticmethod
    def _resolve_credentials(api_key: str) -> tuple[str, str]:
        if api_key and ":" in api_key:
            sid, _, sk = api_key.partition(":")
            if sid and sk:
                return sid.strip(), sk.strip()
        return (
            os.environ.get("TENCENT_SECRET_ID", "").strip(),
            os.environ.get("TENCENT_SECRET_KEY", "").strip(),
        )

    def _litellm_model(self, model: str) -> str:
        """将 hunyuan-pro 转为 LiteLLM 格式 tencent/hunyuan-pro。"""
        return f"tencent/{self._strip_prefix(model)}"

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        try:
            import litellm
        except ImportError:
            # P1 修复(2026-08-06): 统一抛 ProviderError,避免 HTTPException 绕过
            # llm_gateway 的 fallback 链(只有 ProviderError 会被捕获并降级 LiteLLM)。
            raise ProviderError(
                "Tencent Hunyuan 暂不可用:LiteLLM 未安装,无法调用混元模型", 503
            )

        call_kwargs: dict[str, Any] = {
            "model": self._litellm_model(model),
            "messages": messages,
            "api_key": self.api_key,
        }
        if tools:
            call_kwargs["tools"] = tools
        call_kwargs.update(kwargs)

        try:
            response = await litellm.acompletion(**call_kwargs)
            usage = response.usage
            usage_dict: dict[str, Any] = {}
            if usage is not None:
                usage_dict = (
                    usage.model_dump() if hasattr(usage, "model_dump") else dict(usage)
                )
            result: dict[str, Any] = {
                "content": response.choices[0].message.content,
                "model": response.model or model,
                "usage": usage_dict,
                "stub": False,
            }
            raw_tool_calls = getattr(response.choices[0].message, "tool_calls", None)
            if raw_tool_calls:
                result["tool_calls"] = [
                    {
                        "id": getattr(tc, "id", ""),
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "",
                        },
                    }
                    for tc in raw_tool_calls
                ]
            return result
        except Exception as e:
            logger.warning("Tencent Hunyuan LiteLLM 调用失败: %s", e)
            # P1 修复(2026-08-06): 统一抛 ProviderError,纳入 fallback 链
            raise ProviderError(
                f"Tencent Hunyuan 暂不可用:LiteLLM 调用失败 - {type(e).__name__}", 503
            ) from e

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        try:
            import litellm
        except ImportError:
            # P1 修复(2026-08-06): 统一抛 ProviderError
            raise ProviderError(
                "Tencent Hunyuan 暂不可用:LiteLLM 未安装,无法调用混元模型", 503
            )
            yield {}  # pragma: no cover

        call_kwargs: dict[str, Any] = {
            "model": self._litellm_model(model),
            "messages": messages,
            "api_key": self.api_key,
            "stream": True,
            "stream_usage": True,
        }
        if tools:
            call_kwargs["tools"] = tools
        call_kwargs.update(kwargs)

        try:
            response = await litellm.acompletion(**call_kwargs)
            final_model = model
            final_usage: dict[str, Any] = {}
            async for chunk in response:
                if hasattr(chunk, "choices") and chunk.choices:
                    delta = chunk.choices[0].delta
                    token = getattr(delta, "content", None)
                    if token:
                        yield {"type": "chunk", "content": token}
                if hasattr(chunk, "usage") and chunk.usage:
                    try:
                        final_usage = (
                            chunk.usage.model_dump()
                            if hasattr(chunk.usage, "model_dump")
                            else dict(chunk.usage)
                        )
                    except Exception as exc:
                        logger.debug("hunyuan usage 解析失败,本轮 usage 丢失: %s", exc)
                if hasattr(chunk, "model") and chunk.model:
                    final_model = chunk.model
            yield {
                "type": "done",
                "model": final_model,
                "usage": final_usage,
                "stub": False,
            }
        except Exception as e:
            logger.warning("Tencent Hunyuan LiteLLM 流式调用失败: %s", e)
            yield {
                "type": "error",
                "message": f"Tencent Hunyuan 暂不可用:LiteLLM 流式调用失败 - {type(e).__name__}",
            }

    # ------------------------------------------------------------------
    # 视频生成(腾讯混元 image-to-video,TC3-HMAC-SHA256 签名)
    # ------------------------------------------------------------------
    @property
    def configured(self) -> bool:
        return bool(self._secret_id and self._secret_key)

    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """腾讯混元视频:图像生成视频(先传首帧图 image,+ prompt)。

        与可灵/即梦/万相的 text2video 不同,混元视频为 image-to-video,需先有首帧
        图片 URL。若未传 image,抛错提示改用 text2video 厂商。
        fallback:缺首帧图时直接抛错,由编排层降级到其他已配置厂商。
        """
        if not self.configured:
            raise ProviderError(
                "腾讯混元未配置:TENCENT_SECRET_ID + TENCENT_SECRET_KEY 缺失", 503
            )
        image = kwargs.get("image")
        if not image:
            raise ProviderError(
                "腾讯混元为图像生视频,需提供首帧图 image(kwargs.image);"
                "纯文本出片请用可灵/即梦/通义万相",
                400,
            )
        payload: dict[str, Any] = {
            "Prompt": prompt,
            "ImageUrl": image,
        }
        client = get_http_client()
        resp = await client.post(
            f"{self.base_url}/",
            headers=_htc3_signer(
                self._secret_id,
                self._secret_key,
                action="SubmitHunyuanImageToVideoJob",
                service="hunyuan",
                host="hunyuan.tencentcloudapi.com",
                payload=payload,
                version=_HUNYUAN_VIDEO_VERSION,
            ),
            json=payload,
            timeout=30.0,
        )
        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(
                f"腾讯混元提交视频响应非 JSON: {resp.status_code} {resp.text[:200]!r}",
                resp.status_code,
            ) from e
        if resp.status_code >= 400:
            raise ProviderError(
                f"腾讯混元提交视频失败: {resp.status_code} {str(data)[:300]}",
                resp.status_code,
            )
        task_id = str(data.get("TaskId") or "")
        if not task_id:
            raise ProviderError(
                f"腾讯混元提交视频缺少 TaskId: {str(data)[:200]}", 502
            )
        # 轮询查询任务至成功(video_url)/失败
        await asyncio.sleep(5)
        while True:
            qresp = await client.post(
                f"{self.base_url}/",
                headers=_htc3_signer(
                    self._secret_id,
                    self._secret_key,
                    action="QueryHunyuanImageToVideoJob",
                    service="hunyuan",
                    host="hunyuan.tencentcloudapi.com",
                    payload={"TaskId": task_id},
                    version=_HUNYUAN_VIDEO_VERSION,
                ),
                json={"TaskId": task_id},
                timeout=30.0,
            )
            try:
                qdata = qresp.json()
            except ValueError as e:
                raise ProviderError(
                    f"腾讯混元查询视频响应非 JSON: {qresp.status_code}", qresp.status_code
                ) from e
            if qresp.status_code >= 400:
                raise ProviderError(
                    f"腾讯混元查询视频失败: {qresp.status_code} {str(qdata)[:300]}",
                    qresp.status_code,
                )
            video_url = str(qdata.get("VideoUrl") or "")
            if video_url:
                return {
                    "provider": "hunyuan",
                    "model": model or "hunyuan-video",
                    "task_id": task_id,
                    "video_url": video_url,
                }
            error_code = qdata.get("ErrorCode")
            if error_code not in (None, "", 0):
                raise ProviderError(
                    f"腾讯混元视频任务失败(ErrorCode={error_code}): "
                    f"{str(qdata.get('ErrorMessage', qdata))[:300]}",
                    502,
                )
            await asyncio.sleep(10)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
