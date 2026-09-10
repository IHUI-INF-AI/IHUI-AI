# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Alibaba DashScope(阿里云通义千问)适配器。

api_base: https://dashscope.aliyuncs.com/compatible-mode/v1
model 前缀: qwen-* (qwen-plus / qwen-turbo / qwen-max / qwen-long)
协议: OpenAI 兼容(DashScope 提供 OpenAI 兼容模式 endpoint)
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx

from ..core.llm_gateway import get_http_client
from .base_provider import ProviderError
from .openai_provider import OpenAIProvider

_DASHSCOPE_API_BASE = "https://dashscope.aliyuncs.com"
_WAN_DEFAULT_MODEL = "wan2.1-t2v-turbo"


class AlibabaDashscopeProvider(OpenAIProvider):
    """阿里云通义千问适配器:OpenAI 兼容协议,仅覆写 base_url 与 URL 构造。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        # api_base 已含 /compatible-mode/v1,不能再加 /v1
        base = api_base or "https://dashscope.aliyuncs.com/compatible-mode/v1"
        super().__init__(api_key, base, timeout)

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = self._build_payload(messages, model, tools=tools, stream=False, **kwargs)
        data = await self._request(
            "POST", f"{self.base_url}/chat/completions", headers=self._headers(), json=payload
        )
        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})
        result: dict[str, Any] = {
            "content": msg.get("content", ""),
            "model": data.get("model", model),
            "usage": data.get("usage", {}),
            "stub": False,
        }
        if msg.get("tool_calls"):
            result["tool_calls"] = msg["tool_calls"]
        return result

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        payload = self._build_payload(messages, model, tools=tools, stream=True, **kwargs)
        try:
            client = get_http_client()
            async with client.stream(
                "POST", f"{self.base_url}/chat/completions",
                headers=self._headers(), json=payload, timeout=self.timeout,
            ) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise ProviderError(
                        f"DashScope 流式调用失败: {resp.status_code} {body[:300]!r}",
                        resp.status_code,
                    )
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    chunk_str = line[6:]
                    if chunk_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(chunk_str)
                    except json.JSONDecodeError:
                        continue
                    # 2026-08-29 修复:流式 usage/结束帧 choices 可能为空数组,防御越界
                    choices = chunk.get("choices") or []
                    if choices:
                        choice = choices[0]
                        delta = choice.get("delta", {})
                        if delta.get("content"):
                            yield {"type": "chunk", "content": delta["content"]}
                        if delta.get("tool_calls"):
                            yield {"type": "tool_call", "tool_calls": delta["tool_calls"]}
                    if chunk.get("usage"):
                        yield {
                            "type": "done",
                            "model": chunk.get("model", model),
                            "usage": chunk["usage"],
                            "stub": False,
                        }
        except httpx.HTTPError as e:
            yield {"type": "error", "message": f"DashScope 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}

    # ------------------------------------------------------------------
    # 视频生成(通义万相 Wan text2video,DashScope 原生异步任务)
    # ------------------------------------------------------------------
    @property
    def configured(self) -> bool:
        return bool(os.environ.get("DASHSCOPE_API_KEY") or self.api_key)

    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        key = os.environ.get("DASHSCOPE_API_KEY") or self.api_key
        if not key:
            raise ProviderError("通义万相未配置:DASHSCOPE_API_KEY 缺失", 503)
        used = (model or "").removeprefix("wan-") or os.environ.get(
            "WAN_VIDEO_MODEL", _WAN_DEFAULT_MODEL
        )
        api_base = _DASHSCOPE_API_BASE
        size = kwargs.get("size") or "1280*720"
        body: dict[str, Any] = {
            "model": used,
            "input": {"prompt": prompt},
            "parameters": {"size": size, "duration": max(3, int(duration))},
        }
        submit = await self._request(
            "POST",
            f"{api_base}/api/v1/services/aigc/text2video/text-to-video-synthesis",
            headers={"Authorization": f"Bearer {key}", "X-DashScope-Async": "enable"},
            json=body,
        )
        task_id = (submit.get("output") or {}).get("task_id")
        if not task_id:
            raise ProviderError(
                f"通义万相提交任务缺少 task_id: {str(submit)[:200]}", 502
            )
        # 轮询任务至 SUCCEEDED/FAILED(指数间隔封顶 10s)
        interval = 5.0
        while True:
            await asyncio.sleep(interval)
            interval = min(interval * 1.5, 10.0)
            data = await self._request(
                "GET",
                f"{api_base}/api/v1/tasks/{task_id}",
                headers={"Authorization": f"Bearer {key}"},
            )
            status = str((data.get("output") or {}).get("task_status", "")).upper()
            if status in ("SUCCEEDED", "SUCCESS", "SUCCEED"):
                video_url = (data.get("output") or {}).get("video_url", "")
                if not video_url:
                    raise ProviderError(
                        f"通义万相任务 {task_id} 无 video_url: {str(data)[:200]}", 502
                    )
                return {
                    "provider": "wan",
                    "model": used,
                    "task_id": task_id,
                    "video_url": video_url,
                }
            if status in ("FAILED", "CANCELED", "CANCELLED"):
                msg = str((data.get("output") or {}).get("message", data))[:300]
                raise ProviderError(f"通义万相任务失败(status={status}): {msg}", 502)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
