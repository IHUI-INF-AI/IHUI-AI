# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""音视频 → 文本（复用本仓既有的本地 STT，不新起一套模型）。

对照程序 SAG Wiki 能把会议录音/视频也纳入检索；本仓此前 ``extract_text`` 对
``.mp3/.mp4`` 一律返回 ``unsupported``，等于把一整类"公司知识"关在门外。

**零重复实现**：转写直接复用 ``app/routers/voice_stt.py`` 里已经存在的
faster-whisper 单例与 ``_transcribe_sync``（同一个模型、同一份
``WHISPER_MODEL_DIR`` 配置），不在这里再加载一次模型 —— 两份模型实例会
把内存翻倍，且必然在不同时间点漂移成两个版本。

诚实边界（全部体现在返回值里，不做美化）：
- 没装 ``faster-whisper`` → ``missing-dep:faster-whisper``
- 装了但模型加载不出来（离线且没配 ``WHISPER_MODEL_DIR``、磁盘没缓存）→
  ``asr-unavailable:<异常类型>``
- 转写结果为空（纯静音/纯音乐）→ ``empty``
- 视频只取**音轨**；画面里的字属于 OCR 的活，不在这里假装能读

返回三态与 ``extract_text`` 其它分支一致：``(text|None, parser, reason)``。
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

#: 音频 + 视频（视频按音轨转写）。这些后缀**不进** ``DEFAULT_INCLUDE``：
#: 转写是秒级 CPU 活，默认扫描不该悄悄变慢；要收就显式 ``include=[".mp3"]``。
MEDIA_SUFFIXES: frozenset[str] = frozenset(
    {
        ".mp3",
        ".wav",
        ".m4a",
        ".flac",
        ".ogg",
        ".opus",
        ".aac",
        ".wma",
        ".amr",
        ".mp4",
        ".mkv",
        ".mov",
        ".webm",
        ".avi",
        ".flv",
        ".wmv",
    }
)

#: 超过这个体积不走 STT：whisper 的耗时与时长线性相关，而扫描是同步的，
#: 一个 2 小时的视频会把整轮扫描卡死。超限如实报 ``too-large-for-asr``。
MAX_MEDIA_BYTES = 512 * 1024 * 1024


def _load_engine() -> tuple[Any | None, str]:
    """返回 ``(model, reason)``；复用 voice_stt 的单例，不重复加载。"""
    try:
        from ...routers.voice_stt import _get_whisper_model  # noqa: PLC0415 - 惰性导入
    except Exception as exc:  # noqa: BLE001 - 路由层导入失败也要给具名原因
        return None, f"missing-dep:faster-whisper({type(exc).__name__})"
    try:
        return _get_whisper_model(), ""
    except Exception as exc:  # noqa: BLE001 - 模型加载失败是环境问题，不是崩溃
        logger.info("STT 模型不可用: %s", exc)
        return None, f"asr-unavailable:{type(exc).__name__}"


def transcribe_media(path: str) -> tuple[str | None, str, str]:
    """把音/视频转成文本 → ``(text, "faster-whisper", "")``。

    ``language`` 传 ``None`` 让 whisper 自己判语言：中文会议夹英文术语很常见，
    硬钉 ``zh`` 会把英文段转成音译。
    """
    suffix = os.path.splitext(path)[1].lower()
    if suffix not in MEDIA_SUFFIXES:
        return None, "none", f"unsupported:{suffix or '<noext>'}"
    try:
        size = os.path.getsize(path)
    except OSError as exc:
        return None, "none", f"io-error:{type(exc).__name__}"
    if size > MAX_MEDIA_BYTES:
        return None, "none", f"too-large-for-asr:{size}"

    model, reason = _load_engine()
    if model is None:
        return None, "none", reason
    try:
        from ...routers.voice_stt import _transcribe_sync  # noqa: PLC0415 - 惰性导入
    except Exception as exc:  # noqa: BLE001
        return None, "none", f"missing-dep:faster-whisper({type(exc).__name__})"
    try:
        text = _transcribe_sync(model, path, None)
    except Exception as exc:  # noqa: BLE001 - 单个坏文件不许打断整轮扫描
        return None, "none", f"asr-failed:{type(exc).__name__}"
    return (text, "faster-whisper", "") if text.strip() else (None, "none", "empty")


def asr_available() -> dict[str, Any]:
    """探测状态（给 ``/status`` 用）：不加载模型，只看依赖与配置。"""
    try:
        import faster_whisper  # noqa: F401, PLC0415 - 仅探测存在性

        installed = True
    except Exception:  # noqa: BLE001
        installed = False
    return {
        "engine": "faster-whisper",
        "installed": installed,
        "model_dir": os.environ.get("WHISPER_MODEL_DIR", "").strip(),
        "max_bytes": MAX_MEDIA_BYTES,
        "suffixes": sorted(MEDIA_SUFFIXES),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
