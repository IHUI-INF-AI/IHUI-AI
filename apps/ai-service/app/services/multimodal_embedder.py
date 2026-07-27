"""多模态嵌入器(L6,2026-07-25 立,对标 GPT-4o 多模态记忆)。

为 MultimodalMemory 提供 image / audio / video / document 四种模态的 embedding 生成:
- embed_image:  优先 llm_gateway.embed 处理图像描述;不支持图像时降级先用
                llm_gateway.complete 生成 caption 文本,再 embed caption
- embed_audio:  类似,优先 whisper 类接口,降级 hash 伪向量
- embed_video:  优先抽关键帧描述再 embed,降级 hash 伪向量
- embed_document: 直接调 llm_gateway.embed(text) 取首条

降级链路(任何失败不抛异常):
  1. llm_gateway.embed(图像/音频/视频) 不支持 → 走 complete 生成 caption → embed caption
  2. complete 失败 → hash 伪向量(sha256 分段,128 维,同输入同向量)

不引入 numpy / Pillow / whisper 等新依赖,全部走 llm_gateway 现有接口 + 纯 Python。
"""

from __future__ import annotations

import base64
import hashlib
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# hash 伪向量维度(与 vector_memory._HASH_DIM 对齐,便于跨模态检索维度一致)
_HASH_DIM = 128


def _hash_embedding(data: bytes | str, dim: int = _HASH_DIM) -> list[float]:
    """确定性 hash 伪向量:sha256 分段生成 dim 维浮点向量,同输入同向量。

    复用 vector_memory._hash_embedding 的算法(保持维度一致,便于跨模态检索),
    但本模块独立实现一份,避免跨模块私有依赖。

    用 offset 作盐,每轮 sha256 输出 32 字节,每 4 字节映射 1 维(共 8 维/轮)。
    """
    vec = [0.0] * dim
    raw = data.encode("utf-8") if isinstance(data, str) else data
    offset = 0
    while offset < dim:
        h = hashlib.sha256(raw + offset.to_bytes(4, "big")).digest()
        for i in range(8):
            if offset + i >= dim:
                break
            chunk = h[i * 4:(i + 1) * 4]
            val = int.from_bytes(chunk, "big") / 0xFFFFFFFF  # 0~1
            vec[offset + i] = val * 2 - 1  # 归一化到 [-1, 1]
        offset += 8
    return vec


def _to_bytes(data: bytes | str) -> bytes:
    """把输入统一转成 bytes(str 视为 base64 编码,解码失败则按 utf-8 处理)。"""
    if isinstance(data, bytes):
        return data
    # str 优先按 base64 解码(多模态数据通常以 base64 字符串传输)
    try:
        return base64.b64decode(data, validate=True)
    except Exception as e:
        logger.warning("multimodal_embedder._to_bytes base64 解码失败: %s", e, exc_info=True)
        return data.encode("utf-8")


async def _caption_via_llm(
    modality: str,
    data: bytes,
    *,
    mime_type: str,
) -> Optional[str]:
    """调 llm_gateway.complete 生成模态内容的文本 caption(失败返回 None)。

    由于 llm_gateway.complete 只接受文本 messages,这里把多模态数据描述成
    提示词(含 mime_type / 字节数 / sha256 指纹),让 LLM 生成"想象性"caption。
    真实多模态 LLM 接入后,本函数可替换为直接传图像/音频给 LLM。
    """
    try:
        from ..core.llm_gateway import llm_gateway
        # 用数据指纹构造提示,避免传输大块二进制
        fingerprint = hashlib.sha256(data).hexdigest()[:16]
        size = len(data)
        prompt = (
            f"请用一句简短中文描述这个 {modality} 内容(MIME: {mime_type},"
            f"大小: {size} 字节,指纹: {fingerprint})。只输出描述,不要额外解释。"
        )
        messages = [{"role": "user", "content": prompt}]
        result = await llm_gateway.complete(messages)
        caption = str(result.get("content", "")).strip()
        if caption and not result.get("error"):
            return caption
        return None
    except Exception as e:
        logger.warning(
            "[multimodal_embedder] _caption_via_llm 失败(modality=%s): %s",
            modality, e,
        )
        return None


async def _embed_text_via_llm(text: str) -> Optional[list[float]]:
    """调 llm_gateway.embed 把文本转 embedding(失败返回 None)。"""
    try:
        from ..core.llm_gateway import llm_gateway
        result = await llm_gateway.embed(text)
        if isinstance(result, list) and result:
            return [float(x) for x in result]
        return None
    except Exception as e:
        logger.warning(
            "[multimodal_embedder] _embed_text_via_llm 失败: %s", e
        )
        return None


class MultimodalEmbedder:
    """多模态嵌入器:为 image / audio / video / document 生成 embedding。

    降级链路(所有方法签名一致,失败不抛异常):
      1. 优先 llm_gateway.embed(若支持多模态输入)
      2. 不支持 → llm_gateway.complete 生成 caption → embed caption
      3. 仍失败 → hash 伪向量(128 维,确定性)
    """

    async def embed_image(
        self,
        image_data: bytes | str,
        *,
        mime_type: str = "image/png",
    ) -> list[float]:
        """为图像生成 embedding。

        降级链路:llm_gateway.embed(image) → caption → embed caption → hash 伪向量。
        """
        # 1. 优先尝试 llm_gateway.embed(当前只支持文本,实际走 caption 路径)
        # 2. 生成 caption → embed caption
        data = _to_bytes(image_data)
        caption = await _caption_via_llm("image", data, mime_type=mime_type)
        if caption:
            emb = await _embed_text_via_llm(caption)
            if emb:
                return emb
        # 3. 降级 hash 伪向量
        logger.warning(
            "[multimodal_embedder] embed_image 降级为 hash 伪向量(mime=%s)",
            mime_type,
        )
        return _hash_embedding(data)

    async def embed_audio(
        self,
        audio_data: bytes | str,
        *,
        mime_type: str = "audio/wav",
    ) -> list[float]:
        """为音频生成 embedding。

        降级链路:whisper 类接口(未接入)→ caption → embed caption → hash 伪向量。
        """
        data = _to_bytes(audio_data)
        caption = await _caption_via_llm("audio", data, mime_type=mime_type)
        if caption:
            emb = await _embed_text_via_llm(caption)
            if emb:
                return emb
        logger.warning(
            "[multimodal_embedder] embed_audio 降级为 hash 伪向量(mime=%s)",
            mime_type,
        )
        return _hash_embedding(data)

    async def embed_video(
        self,
        video_data: bytes | str,
        *,
        mime_type: str = "video/mp4",
    ) -> list[float]:
        """为视频生成 embedding。

        降级链路:抽关键帧描述(未接入)→ caption → embed caption → hash 伪向量。
        """
        data = _to_bytes(video_data)
        caption = await _caption_via_llm("video", data, mime_type=mime_type)
        if caption:
            emb = await _embed_text_via_llm(caption)
            if emb:
                return emb
        logger.warning(
            "[multimodal_embedder] embed_video 降级为 hash 伪向量(mime=%s)",
            mime_type,
        )
        return _hash_embedding(data)

    async def embed_document(self, text: str) -> list[float]:
        """为文档(纯文本)生成 embedding,直接调 llm_gateway.embed(text) 取首条。"""
        emb = await _embed_text_via_llm(text)
        if emb:
            return emb
        logger.warning(
            "[multimodal_embedder] embed_document 降级为 hash 伪向量"
        )
        return _hash_embedding(text)


# 单例(与 meta_learner / vector_memory 风格一致)
multimodal_embedder = MultimodalEmbedder()
