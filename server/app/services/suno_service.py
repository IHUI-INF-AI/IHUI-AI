"""Suno 音乐生成服务.

迁移自 ZHS_Server_java/mcp/service/impl/SunoServiceImpl.java.
支持 5 种类型(0-4)的生成、拼接、扩展、上传.
"""

from typing import Any

import httpx
from loguru import logger


class SunoService:
    """Suno 音乐生成服务."""

    SUNO_TYPES = {
        0: "generate",
        1: "upload_extend",
        2: "concat",
        3: "upload",
        4: "extend",
    }
    DEFAULT_TIMEOUT = 300.0

    def __init__(self, api_key: str = "", base_url: str = "https://api.suno.ai/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    async def _upload_to_storage(self, url: str) -> str:
        """将远程音频/视频/图片 URL 转存到 MinIO 并返回内部 URL."""
        if not url:
            return ""
        try:
            from app.utils.minio_util import upload_from_url
            return await upload_from_url(url) if hasattr(upload_from_url, "__call__") else url
        except Exception as e:
            logger.warning(f"Suno URL 转存失败, 沿用原 URL: {e}")
            return url

    async def submit(self, suno_type: int, payload: dict[str, Any]) -> dict[str, Any]:
        """根据 type 提交任务.

        type:
            0 - generate (文本生成)
            1 - upload_extend (上传+扩展)
            2 - concat (拼接)
            3 - upload (上传)
            4 - extend (扩展)
        """
        if suno_type not in self.SUNO_TYPES:
            return {"code": 400, "data": None, "message": f"未知类型: {suno_type}"}
        endpoint = f"{self.base_url}/{self.SUNO_TYPES[suno_type]}"
        try:
            async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
                r = await client.post(endpoint, headers=self._headers(), json=payload)
                return r.json()
        except Exception as e:
            logger.error(f"Suno submit 失败: {e}")
            return {"code": 500, "data": None, "message": str(e)}

    async def generate(
        self,
        prompt: str,
        tags: str = "",
        title: str = "",
        instrumental: bool = False,
    ) -> dict[str, Any]:
        """文本生成音乐 (type 0)."""
        payload = {
            "prompt": prompt,
            "tags": tags,
            "title": title,
            "make_instrumental": instrumental,
        }
        return await self.submit(0, payload)

    async def extend(
        self,
        audio_id: str,
        prompt: str = "",
        continue_at: float = 0,
    ) -> dict[str, Any]:
        """扩展音频 (type 4)."""
        return await self.submit(4, {
            "audio_id": audio_id,
            "prompt": prompt,
            "continue_at": continue_at,
        })

    async def upload(self, audio_url: str) -> dict[str, Any]:
        """上传音频 (type 3)."""
        internal_url = await self._upload_to_storage(audio_url)
        return await self.submit(3, {"audio_url": internal_url})

    async def concat(self, audio_ids: list[str]) -> dict[str, Any]:
        """拼接音频 (type 2)."""
        return await self.submit(2, {"audio_ids": audio_ids})

    async def upload_extend(
        self,
        audio_url: str,
        prompt: str = "",
        continue_at: float = 0,
    ) -> dict[str, Any]:
        """上传+扩展 (type 1)."""
        internal_url = await self._upload_to_storage(audio_url)
        return await self.submit(1, {
            "audio_url": internal_url,
            "prompt": prompt,
            "continue_at": continue_at,
        })


_service: SunoService | None = None


def get_suno_service() -> SunoService:
    global _service
    if _service is None:
        from app.config import settings
        _service = SunoService(
            api_key=getattr(settings, "SUNO_API_KEY", ""),
            base_url=getattr(settings, "SUNO_BASE_URL", "https://api.suno.ai/v1"),
        )
    return _service
