# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Sand.ai MAGI-2 适配器(2026-11-25 接入)。

协议:Sand.ai Ark 兼容层(与火山方舟 SDK 同构),一套 content[] 同时表达
文生、参考图/参考视频/参考音频、首帧/尾帧:

    POST {base}/compatible/ark/api/v3/contents/generations/tasks
    GET  {base}/compatible/ark/api/v3/contents/generations/tasks/{id}

与 kling/jimeng 的差异:
- 只有 1080p 一档,时长 4–30 整数秒,比例 21:9/16:9/4:3/1:1/3:4/9:16;
- 创建返回的 id 是 int64,Python 侧保持 int 再转十进制字符串(勿经 JS Number);
- 结果 video_url 有效 1 小时,轮询拿到后要尽快转存,不能长期存链接;
- 30 秒片子生成时间远超普通接口,故支持 wait=False 提交后交给
  video_generation._poll_pending 低频轮询,避免阻塞单 worker。

环境变量:MAGI2_API_KEY(兼容 SAND_API_KEY)、MAGI2_API_BASE
(默认 https://api.sand.ai)、MAGI2_MODEL(默认 magi-2)、
MAGI2_MAX_WAIT(阻塞模式轮询上限秒,默认 1800)。
"""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import AsyncIterator
from typing import Any

from .base_provider import BaseProvider, ProviderError

_DEFAULT_BASE = "https://api.sand.ai"
_TASKS_PATH = "/compatible/ark/api/v3/contents/generations/tasks"
_ASPECT_RATIOS = {"21:9", "16:9", "4:3", "1:1", "3:4", "9:16"}
_MAX_CONTENT = 21
_MAX_IMAGES = 10
_MAX_VIDEOS = 5
_MAX_AUDIOS = 5
_MIN_DURATION = 4
_MAX_DURATION = 30


class Magi2Provider(BaseProvider):
    """MAGI-2:文本/图像/视频/音频混合输入,4–30 秒 1080p 有声视频。"""

    def __init__(
        self,
        api_key: str | None = None,
        api_base: str | None = None,
        model: str | None = None,
        timeout: float = 60.0,
    ):
        base = (api_base or os.environ.get("MAGI2_API_BASE") or _DEFAULT_BASE).strip()
        key = (
            api_key
            or os.environ.get("MAGI2_API_KEY")
            or os.environ.get("SAND_API_KEY")
            or ""
        ).strip()
        super().__init__(key, base, timeout)
        self.base_url = base.rstrip("/")
        self.model = (model or os.environ.get("MAGI2_MODEL") or "magi-2").strip() or "magi-2"

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        if not self.configured:
            raise ProviderError(
                "MAGI-2 未配置:需 MAGI2_API_KEY(或 SAND_API_KEY)环境变量,"
                "并在 Sand.ai 控制台申请开通该模型",
                503,
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # chat 能力:无
    # ------------------------------------------------------------------
    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise ProviderError("MAGI-2 仅支持视频生成,chat 接口不可用", 400)

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        raise ProviderError("MAGI-2 仅支持视频生成,chat 接口不可用", 400)
        yield {}  # pragma: no cover

    # ------------------------------------------------------------------
    # 请求体组装
    # ------------------------------------------------------------------
    @staticmethod
    def _as_urls(value: Any) -> list[str]:
        """把 str / list[str] / None 归一成 URL 列表(空值直接丢弃)。"""
        if not value:
            return []
        if isinstance(value, str):
            return [value.strip()] if value.strip() else []
        if isinstance(value, (list, tuple)):
            return [str(v).strip() for v in value if str(v).strip()]
        return []

    def build_payload(
        self,
        prompt: str,
        *,
        model: str | None = None,
        duration: int = 10,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """组装 Ark content[];参数越界抛 ProviderError(400)而不是静默降级成别的东西。"""
        used_model = (model or self.model).strip() or "magi2"
        text = (prompt or "").strip()
        first = kwargs.get("first_frame") or kwargs.get("image")
        last = kwargs.get("last_frame")
        images = self._as_urls(kwargs.get("images"))
        videos = self._as_urls(kwargs.get("videos"))
        audios = self._as_urls(kwargs.get("audios"))

        if len(images) > _MAX_IMAGES:
            raise ProviderError(f"MAGI-2 参考图最多 {_MAX_IMAGES} 张,当前 {len(images)}", 400)
        if len(videos) > _MAX_VIDEOS:
            raise ProviderError(f"MAGI-2 参考视频最多 {_MAX_VIDEOS} 段,当前 {len(videos)}", 400)
        if len(audios) > _MAX_AUDIOS:
            raise ProviderError(f"MAGI-2 参考音频最多 {_MAX_AUDIOS} 段,当前 {len(audios)}", 400)
        if (first or last) and (images or videos or audios):
            raise ProviderError(
                "MAGI-2 首帧/尾帧模式不能同时混入参考图、参考视频或参考音频", 400
            )

        content: list[dict[str, Any]] = []
        if text:
            content.append({"type": "text", "text": text})
        if first:
            content.append(
                {"type": "image_url", "role": "first_frame", "image_url": {"url": str(first)}}
            )
        if last:
            content.append(
                {"type": "image_url", "role": "last_frame", "image_url": {"url": str(last)}}
            )
        content.extend(
            {"type": "image_url", "role": "reference_image", "image_url": {"url": url}}
            for url in images
        )
        content.extend(
            {"type": "video_url", "role": "reference_video", "video_url": {"url": url}}
            for url in videos
        )
        content.extend(
            {"type": "audio_url", "role": "reference_audio", "audio_url": {"url": url}}
            for url in audios
        )
        if not content:
            raise ProviderError("MAGI-2 需要 prompt 或至少一个参考素材", 400)
        if len(content) > _MAX_CONTENT:
            raise ProviderError(f"MAGI-2 content 最多 {_MAX_CONTENT} 项,当前 {len(content)}", 400)

        ratio = str(kwargs.get("aspect_ratio") or "").strip()
        if ratio not in _ASPECT_RATIOS:
            ratio = "16:9"
        try:
            seconds = int(duration)
        except (TypeError, ValueError):
            seconds = 10
        seconds = max(_MIN_DURATION, min(_MAX_DURATION, seconds))

        audio_opt = kwargs.get("generate_audio")
        payload: dict[str, Any] = {
            "model": used_model,
            "content": content,
            "duration": seconds,
            "ratio": ratio,
            "resolution": "1080p",
            "generate_audio": True if audio_opt is None else bool(audio_opt),
        }
        if kwargs.get("enhance_prompt") is not None:
            payload["enhance_prompt"] = bool(kwargs["enhance_prompt"])
        seed = kwargs.get("seed")
        if isinstance(seed, int) and not isinstance(seed, bool) and 0 <= seed <= 4294967295:
            payload["seed"] = seed
        return payload

    # ------------------------------------------------------------------
    # 视频生成
    # ------------------------------------------------------------------
    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 10,
        wait: bool = True,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """提交一个视频任务。

        wait=False:只提交,返回 task_id,由调用方低频轮询(长视频场景推荐);
        wait=True :阻塞轮询到终态(直连/即时调用场景)。
        """
        payload = self.build_payload(prompt, model=model, duration=duration, **kwargs)
        data = await self._request(
            "POST", f"{self.base_url}{_TASKS_PATH}", headers=self._headers(), json=payload
        )
        task_id = str(data.get("id") or "").strip()
        if not task_id:
            raise ProviderError(f"MAGI-2 响应缺少任务 id: {str(data)[:200]}", 502)

        used_model = str(payload["model"])
        base = {
            "provider": "magi2",
            "model": used_model,
            "task_id": task_id,
            "duration": payload["duration"],
        }
        if not wait:
            return {**base, "video_url": "", "status": str(data.get("status") or "queued")}
        return await self._poll(task_id, base)

    async def get_task_status(self, task_id: str) -> dict[str, Any]:
        """查询任务;返回统一 {ok, failed, status, video_url, error} 供 polling 层消费。"""
        try:
            data = await self._request(
                "GET", f"{self.base_url}{_TASKS_PATH}/{task_id}", headers=self._headers()
            )
        except ProviderError as exc:
            if exc.status_code == 404:
                return {"ok": False, "failed": True, "status": "not_found", "error": "任务不存在"}
            raise
        status = str(data.get("status") or "").lower()
        content = data.get("content") or {}
        video_url = str(content.get("video_url") or content.get("videoUrl") or "")
        if status == "succeeded":
            return {
                "ok": bool(video_url),
                "failed": False,
                "status": status,
                "video_url": video_url,
                "duration": data.get("duration"),
                "error": "" if video_url else "任务成功但没有 video_url",
            }
        if status in ("failed", "expired", "cancelled", "canceled"):
            err = data.get("error") or {}
            msg = str(err.get("message") or err.get("code") or f"MAGI-2 任务 {status}")
            return {"ok": False, "failed": True, "status": status, "error": msg}
        return {"ok": False, "failed": False, "status": status or "running", "video_url": ""}

    async def _poll(
        self,
        task_id: str,
        base: dict[str, Any],
        *,
        interval: float = 5.0,
        max_wait: float | None = None,
    ) -> dict[str, Any]:
        limit = max_wait if max_wait is not None else float(
            os.environ.get("MAGI2_MAX_WAIT", "1800")
        )
        deadline = time.monotonic() + limit
        delay = interval
        last_status = "queued"
        while True:
            st = await self.get_task_status(task_id)
            last_status = str(st.get("status") or last_status)
            if st.get("ok") and st.get("video_url"):
                return {**base, "video_url": st["video_url"], "status": "succeeded"}
            if st.get("failed"):
                raise ProviderError(f"MAGI-2 任务失败({last_status}): {st.get('error')}", 502)
            if time.monotonic() >= deadline:
                raise ProviderError(
                    f"MAGI-2 任务轮询超时({int(limit)}s,最后状态={last_status})", 504
                )
            await asyncio.sleep(delay)
            delay = min(delay * 2, 10.0)
