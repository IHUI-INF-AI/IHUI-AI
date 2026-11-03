# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""免费语音通道 provider(edge-tts,零 key 零成本)—— TOKEN6688 付费语音链路的免费替代。

背景(2026-09-24):TOKEN6688_API_KEY 因费用原因不配置,owner 指令"找免费的配上"。
本模块把原本内联在 routers/voice_tts.py 的 edge-tts 实现抽成独立 provider,
与 Token6688Provider.tts() 同构(返回 (音频字节, content_type)),供:
- routers/voice_tts.py:engine 默认值经 VOICE_PROVIDER 环境变量切换(edge-tts/token6688)
- scripts/e2e_token6688.py --free:免费模式端到端验收(生成/取消),无需任何 key

依赖策略:仅 edge_tts + 标准库,**不 import app 兄弟模块**(base_provider →
llm_gateway 是重链:litellm/fastapi 等)。这样 e2e --free 可在任意只装了
edge-tts 的隔离 Python 环境直接单文件加载本模块跑通。
异常类 VoiceProviderError 带 status_code,语义与 base_provider.ProviderError 兼容。

能力边界(免费可行性结论):
- TTS 合成     ✅ edge-tts(微软 Edge 免费语音服务,流式可被 asyncio 取消)
- 声音列表     ✅ edge_tts.list_voices()(400+ 声音,本模块过滤中/英/日常用)
- 生成取消     ✅ 合成是 asyncio 流式任务,task.cancel() 即断(无计费无残留)
- 声纹克隆     ❌ 无免费云 API(GPT-SoVITS/OpenVoice 需本地 GPU 部署,重运维,
                 见 e2e --free 的 SKIP 报告与 owner 决策建议)

环境变量:
    VOICE_PROVIDER=edge-tts   默认语音通道(免费);=token6688 时路由默认走付费网关
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

PROVIDER_CODE = "free-voice"
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"  # 晓晓(女,中文默认)
MAX_TEXT_CHARS = 2000  # 单次合成长度上限(与 /voice/tts 防滥用上限一致)

# 常用声音白名单(edge-tts 官方 voices 子集,防滥用任意 voice 参数;与 voice_tts.py 同源)
VOICE_WHITELIST: set[str] = {
    # 中文
    "zh-CN-XiaoxiaoNeural",  # 晓晓(女,默认)
    "zh-CN-YunxiNeural",     # 云希(男)
    "zh-CN-YunyangNeural",   # 云扬(新闻男)
    "zh-CN-liaoning-XiaobeiNeural",  # 辽宁小北(东北话)
    "zh-CN-shaanxi-XiaoniNeural",    # 陕西小妮
    "zh-TW-HsiaoChenNeural",  # 台湾晓臻
    "zh-HK-HiuMaanNeural",    # 香港晓曼
    # 英文
    "en-US-AriaNeural",
    "en-US-GuyNeural",
    "en-GB-SoniaNeural",
    # 日/韩
    "ja-JP-NanamiNeural",
    "ko-KR-SunHiNeural",
}


class VoiceProviderError(Exception):
    """免费语音通道异常(语义兼容 base_provider.ProviderError:带 status_code)。"""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def _env_voice_provider() -> str:
    """读取 VOICE_PROVIDER 环境变量并归一为规范名(未配/未知回退免费通道)。"""
    raw = os.environ.get("VOICE_PROVIDER", "").strip().lower()
    if raw in ("token6688", "t6688"):
        return "token6688"
    return "edge-tts"  # 空/edge/edge-tts/edgetts/未知值 → 一律免费通道(fail-safe)


def current_provider_code() -> str:
    """当前默认语音通道规范名(VOICE_PROVIDER 环境开关的唯一读取口)。"""
    return _env_voice_provider()


class FreeVoiceProvider:
    """免费语音 provider(edge-tts):TTS 合成 / 声音列表 / 取消,零 key 零成本。"""

    provider_code = PROVIDER_CODE

    async def tts(
        self,
        text: str,
        *,
        voice: str = DEFAULT_VOICE,
        rate: str = "+0%",
        response_format: str = "mp3",  # 兼容 Token6688Provider.tts 签名;edge-tts 恒 mp3
    ) -> tuple[bytes, str]:
        """语音合成,返回 (音频字节, content_type)。流式聚合,可被 asyncio 取消。

        与 Token6688Provider.tts() 同构,VOICE_PROVIDER=edge-tts 时路由层可直接
        替换调用方而无需改签名。voice 须在白名单内(防滥用)。
        """
        text = (text or "").strip()
        if not text:
            raise VoiceProviderError("text 不能为空", 400)
        if len(text) > MAX_TEXT_CHARS:
            raise VoiceProviderError(f"text 超长({len(text)}>{MAX_TEXT_CHARS} 字符)", 400)
        if voice not in VOICE_WHITELIST:
            raise VoiceProviderError(
                f"voice 不在白名单: {voice}(常用声音见 VOICE_WHITELIST)", 400,
            )
        if not (rate.startswith(("+", "-")) and rate.endswith("%")):
            rate = "+0%"
        # 函数内 import:支持测试 monkeypatch sys.modules["edge_tts"] 替换
        try:
            import edge_tts
        except ImportError as e:
            raise VoiceProviderError(
                "edge-tts 未安装,免费 TTS 不可用。请安装:pip install edge-tts", 503,
            ) from e
        try:
            communicate = edge_tts.Communicate(text, voice=voice, rate=rate)
            chunks: list[bytes] = []
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio":
                    chunks.append(chunk["data"])
        except asyncio.CancelledError:
            raise  # 生成取消:调用方 task.cancel() 直达此处,无计费无残留
        except Exception as e:
            logger.warning("免费 TTS 合成失败(edge-tts): %s", e)
            raise VoiceProviderError(
                f"免费 TTS 暂不可用(edge-tts 服务不可达),请稍后重试: {e}", 503,
            ) from None
        if not chunks:
            raise VoiceProviderError("edge-tts 未返回音频数据", 502)
        return b"".join(chunks), "audio/mpeg"

    async def list_voices(self) -> list[dict[str, Any]]:
        """可用声音列表(edge_tts.list_voices(),过滤中/英/日常用并归一结构)。

        返回 [{id, display_name, gender, locale}],与声纹库无关(见 upload_voice)。
        """
        try:
            import edge_tts
        except ImportError as e:
            raise VoiceProviderError(
                "edge-tts 未安装,免费通道不可用。请安装:pip install edge-tts", 503,
            ) from e
        try:
            voices = await edge_tts.list_voices()
        except Exception as e:
            raise VoiceProviderError(f"edge-tts 声音列表拉取失败: {e}", 503) from None
        out: list[dict[str, Any]] = []
        for v in voices or []:
            if not isinstance(v, dict) or not v.get("ShortName"):
                continue
            locale = str(v.get("Locale") or "")
            if not locale.startswith(("zh-", "en-", "ja-", "ko-")):
                continue
            out.append({
                "id": v["ShortName"],
                "display_name": v.get("FriendlyName") or v["ShortName"],
                "gender": (v.get("Gender") or "").capitalize() or None,
                "locale": locale,
            })
        return out

    async def cancel_task(self, task_id: str) -> dict[str, Any]:
        """取消在途任务。

        免费通道 TTS 为同步直出(单请求内流式完成),无跨请求的异步任务表;
        "取消"语义 = 调用方对合成 asyncio.Task 执行 task.cancel()(见 e2e --free
        的取消步骤)。对任意 task_id 如实返回 unsupported,不伪装成功。
        """
        return {
            "ok": False,
            "status": "unsupported",
            "error": "免费通道(edge-tts)为同步直出,无在途异步任务;取消=对合成 task.cancel()",
        }

    async def upload_voice(self, audio_bytes: bytes, filename: str = "ref.wav") -> dict[str, Any]:
        """声纹克隆:免费通道不支持(501 Not Implemented)。

        免费可行性结论:主流免费云 API 无声纹克隆能力;开源自方案
        (GPT-SoVITS / OpenVoice / CosyVoice)需本地 GPU + 模型权重 + 常驻服务,
        属重运维投入,是否部署由 owner 决策(见 e2e --free 声纹段 SKIP 报告)。
        声纹克隆需求请走 VOICE_PROVIDER=token6688 付费通道(upload_voice)。
        """
        raise VoiceProviderError(
            "免费通道(edge-tts)不支持声纹克隆:无免费云 API 可用;开源自托管"
            "(GPT-SoVITS/OpenVoice/CosyVoice)需本地 GPU 常驻服务,属重运维投入,"
            "待 owner 决策。声纹克隆请切 VOICE_PROVIDER=token6688 付费通道。",
            501,
        )
