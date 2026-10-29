# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agnes 视频适配器(聚合网关,OpenAI 兼容 `POST /v1/videos`)。

契约来源 = 本机 agnes-ai-cli 包内 `dist/video/{generateVideo,getVideo,normalizeVideoRequest}.js`
(与线上实测 400「prompt 不能为空」互证,端点确实存在):

- 提交:`POST {base}/videos`,body 只认 model / prompt / mode / size / image /
  seed / negative_prompt;成功返回含 `task_id`(或 `id`)与可选 `video_id`。
- 查询:`video_` 前缀走 `GET {origin}/agnesapi?video_id=`,否则走
  `GET {base}/videos/{task_id}`(CLI 的 legacy 兼容分支)。
- 终态视频地址按 metadata.url / video_url / url / output_url / result.video_url
  依次取第一个 http(s) 值。

与其它厂商一样是异步任务,本适配器阻塞轮询到终态(与 jimeng/kling 同档);
`insufficient_user_quota` 等业务错误原样上抛,由编排层降级到下一家。
"""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import AsyncIterator
from typing import Any, cast
from urllib.parse import urlsplit

import httpx

from ..core.llm_gateway import get_http_client
from .base_provider import BaseProvider, ProviderError

_DEFAULT_BASE = "https://api.agnes-ai.cn/v1"
_DEFAULT_MODEL = "agnes-video-2.5"
_DONE = {"completed", "succeeded", "success"}
_FAILED = {"failed", "cancelled", "canceled", "timeout", "timed_out"}


def _origin_of(base_url: str) -> str:
    """`https://host/v1` → `https://host`(video_id 查询挂在站点根上)。"""
    parts = urlsplit(base_url)
    if not parts.scheme or not parts.netloc:
        return base_url.rstrip("/")
    return f"{parts.scheme}://{parts.netloc}"


def _extract_video_url(record: dict[str, Any]) -> str:
    metadata = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
    result = record.get("result") if isinstance(record.get("result"), dict) else {}
    candidates = (
        metadata.get("url"),
        record.get("video_url"),
        record.get("url"),
        record.get("output_url"),
        result.get("video_url"),
    )
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.startswith(("http://", "https://")):
            return candidate
    return ""


class AgnesVideoProvider(BaseProvider):
    """Agnes 视频生成适配器(异步任务 + 阻塞轮询)。"""

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        timeout: float = 120.0,
        *,
        poll_interval: float = 5.0,
        poll_max_wait: float = 900.0,
    ):
        base = (api_base or os.environ.get("AGNES_API_BASE") or _DEFAULT_BASE).rstrip("/")
        super().__init__(api_key, base, timeout)
        self.base_url = base
        self.origin = _origin_of(base)
        self.poll_interval = poll_interval
        self.poll_max_wait = poll_max_wait

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self, *, json_body: bool = False) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

    # ------------------------------------------------------------------
    # chat:不支持(纯视频适配器)
    # ------------------------------------------------------------------
    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise ProviderError("Agnes 视频适配器仅支持视频生成,chat 请走 agnes 文本通道", 400)

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        raise ProviderError("Agnes 视频适配器仅支持视频生成,chat 请走 agnes 文本通道", 400)
        yield {}  # pragma: no cover

    # ------------------------------------------------------------------
    # 视频生成
    # ------------------------------------------------------------------
    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        if not self.configured:
            raise ProviderError(
                "Agnes 未配置:LLM_PROVIDERS.agnes.api_key 或 AGNES_API_KEY 缺失", 503
            )
        text = (prompt or "").strip()
        if not text:
            raise ProviderError("Agnes 视频生成缺 prompt", 400)

        used = (model or "").removeprefix("agnes/").strip() or _DEFAULT_MODEL
        image = kwargs.get("image")
        payload: dict[str, Any] = {
            "model": used if used.startswith("agnes-video") else _DEFAULT_MODEL,
            "prompt": text,
            "mode": "image" if image else "text",
            "size": str(kwargs.get("size") or "720P"),
        }
        if image:
            payload["image"] = image
        if isinstance(kwargs.get("seed"), int):
            payload["seed"] = kwargs["seed"]
        negative = kwargs.get("negative_prompt")
        if negative:
            payload["negative_prompt"] = negative

        submitted = await self._post_json(f"{self.base_url}/videos", payload)
        task_id = str(submitted.get("task_id") or submitted.get("id") or "").strip()
        video_id = str(submitted.get("video_id") or "").strip()
        if not task_id and not video_id:
            raise ProviderError(f"Agnes 视频提交未返回 task_id: {str(submitted)[:200]}", 502)
        if not video_id and task_id.startswith("video_"):
            video_id = task_id
        status = str(submitted.get("status") or "").lower()
        if status in _DONE:
            url = _extract_video_url(submitted)
            if url:
                return self._result(used, task_id or video_id, url, duration)

        record = await self._poll_until_done(task_id=task_id, video_id=video_id)
        video_url = _extract_video_url(record)
        if not video_url:
            raise ProviderError(
                f"Agnes 视频任务 {task_id or video_id} 已完成但缺视频地址: {str(record)[:200]}",
                502,
            )
        return self._result(used, task_id or video_id, video_url, duration)

    @staticmethod
    def _result(model: str, task_id: str, video_url: str, duration: int) -> dict[str, Any]:
        return {
            "provider": "agnes",
            "model": model,
            "task_id": task_id,
            "video_url": video_url,
            "duration": duration,
        }

    async def _poll_until_done(self, *, task_id: str, video_id: str) -> dict[str, Any]:
        """轮询到终态;failed 抛 502,超时抛 504(与 jimeng `_poll_task` 同语义)。"""
        deadline = time.monotonic() + self.poll_max_wait
        delay = self.poll_interval
        last_status = ""
        while True:
            record = await self.get_task_status(video_id=video_id, task_id=task_id)
            last_status = str(record.get("status") or "").lower()
            if last_status in _DONE:
                return record
            if last_status in _FAILED:
                error = record.get("error")
                detail = error if isinstance(error, str) else str(error or "")[:300]
                raise ProviderError(
                    f"Agnes 视频任务失败(status={last_status}): {detail or '上游未给原因'}",
                    502,
                )
            if time.monotonic() >= deadline:
                raise ProviderError(
                    f"Agnes 视频轮询超时({int(self.poll_max_wait)}s,最后状态={last_status or 'unknown'})",
                    504,
                )
            await asyncio.sleep(delay)
            delay = min(delay * 2, 10.0)

    async def get_task_status(self, *, video_id: str = "", task_id: str = "") -> dict[str, Any]:
        """查询任务状态。优先 video_id 端点(CLI 推荐的现行口径)。"""
        if video_id:
            url = f"{self.origin}/agnesapi?video_id={video_id}"
        elif task_id:
            url = f"{self.base_url}/videos/{task_id}"
        else:
            raise ProviderError("Agnes 任务查询缺 video_id 与 task_id", 400)
        return await self._request_json("GET", url)

    # ------------------------------------------------------------------
    # HTTP
    # ------------------------------------------------------------------
    async def _post_json(self, url: str, body: dict[str, Any]) -> dict[str, Any]:
        return await self._request_json("POST", url, body)

    async def _request_json(
        self, method: str, url: str, body: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        try:
            resp = await get_http_client().request(
                method,
                url,
                headers=self._headers(json_body=body is not None),
                json=body,
                timeout=self.timeout,
            )
        except httpx.HTTPError as e:
            raise ProviderError(f"Agnes 网络异常: {e}") from e
        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(
                f"Agnes 响应非合法 JSON: {resp.status_code} {resp.text[:300]!r}",
                resp.status_code if resp.status_code >= 400 else 502,
            ) from e
        if not isinstance(data, dict):
            raise ProviderError(
                f"Agnes 响应结构异常: {type(data).__name__}",
                resp.status_code if resp.status_code >= 400 else 502,
            )
        if resp.status_code >= 400:
            error = data.get("error") if isinstance(data.get("error"), dict) else {}
            message = str(error.get("message") or data.get("message") or data.get("code") or data)[
                :300
            ]
            raise ProviderError(f"Agnes 调用失败: {resp.status_code} {message}", resp.status_code)
        return cast(dict[str, Any], data)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
