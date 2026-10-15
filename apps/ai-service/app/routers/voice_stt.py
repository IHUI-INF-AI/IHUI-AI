# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Voice STT 路由 — 语音转文字(零成本本地推理版)。

POST /api/voice/stt 接收 multipart/form-data 音频文件,调用 faster-whisper 本地
CTranslate2 推理进行 STT 转写。完全免费、离线可用,不依赖任何付费 API。

2026-07-28 重构:从 litellm.atranscription(走 OpenAI Whisper 付费 API)迁移到
faster-whisper 本地推理(CTranslate2 后端,base 模型 74MB,首次下载后离线)。
- 用户硬约束:不想花一分钱
- 模型:size 默认 "small"(2026-08-31 从 base 升级,483MB,中文识别精度显著提升,
  CPU int8 下短语音推理约 2-5 秒仍可接受);可用环境变量 WHISPER_MODEL_SIZE 覆盖
- 模型缓存:首次使用自动下载到 ~/.cache/huggingface,之后永久离线
- 线程安全:全局单例 _whisper_model,首次请求懒加载

2026-10-15 修复(STT 一直是 stub、返回假文本的根因):
  旧实现**只有**"从 HuggingFace 下载到 ~/.cache/huggingface"这一条路,而生产
  ai-service 以 **LocalSystem** 账号跑(nssm IHUI-AI-SERVICE),它的 HOME 是
  `C:\\Windows\\System32\\config\\systemprofile`,与交互式用户不是同一个目录;再加
  本机到 huggingface.co 直连不通 ⇒ 两条路同时断,每次请求都抛异常 → 被 except 兜成
  `stub=True` 的假文本(界面上表现为"能录音、能返回,但永远是错的/空的")。
  新增 `WHISPER_MODEL_DIR`:指向**预先下好的本地模型目录**时直接加载,不再联网、
  不看 HOME。这是服务形态下唯一可靠的加载方式,也让"离线可用"真正成立。
"""

import asyncio
import contextlib
import logging
import os
import tempfile
from threading import Lock
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# STT 模型尺寸(环境变量可覆盖;small=483MB 中文精度优先,base=74MB 内存受限时回退)
_WHISPER_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small")

# 本地模型目录(2026-10-15 新增,服务形态下的**首选**加载方式,见模块 docstring)。
# 指向一个已下好的 CTranslate2 模型目录(含 config.json + model.bin)时直接加载,
# 不联网、不依赖 HOME/用户缓存。为空则回落旧的"按尺寸名从 HF 下载"逻辑。
_WHISPER_MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR", "").strip()

# STT 默认模型名(用于响应字段,标识用的引擎)
_DEFAULT_STT_MODEL = f"whisper-{_WHISPER_SIZE}-local"

# faster-whisper 模型单例(懒加载,线程安全)
# 首次请求时下载/加载模型(默认 small 483MB,CPU int8 推理)
_whisper_model: Any = None
_whisper_model_lock = Lock()


class STTResponse(BaseModel):
    """STT 转写响应。"""

    text: str
    stub: bool
    model: str


def _get_whisper_model() -> Any:
    """懒加载 faster-whisper 模型单例(线程安全)。

    默认 small 模型(483MB,中文精度优先)+ int8 量化(CPU 友好,零 GPU 依赖),
    可用环境变量 WHISPER_MODEL_SIZE 覆盖(如内存受限时设为 "base")。

    加载来源二选一(优先级从高到低):
      1. `WHISPER_MODEL_DIR`(推荐、服务形态必配):已下好的本地模型目录,
         直接加载 —— 不联网、不读 HOME 缓存。目录不在位则**报错**,不静默回退。
      2. 按 `WHISPER_MODEL_SIZE` 从 HuggingFace 下载到 ~/.cache/huggingface,
         之后永久离线(仅交互式用户可用;LocalSystem 服务账号下该缓存不可达)。

    Returns:
        faster_whisper.WhisperModel 实例。

    Raises:
        ImportError: faster-whisper 未安装。
        RuntimeError: 模型加载失败。
    """
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    with _whisper_model_lock:
        # 双重检查锁,避免多请求时重复加载
        if _whisper_model is not None:
            return _whisper_model

        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise ImportError(
                "faster-whisper 未安装,无法进行本地 STT 转写。"
                "请运行:pip install faster-whisper"
            ) from e

        model_ref = _WHISPER_SIZE
        if _WHISPER_MODEL_DIR:
            # 显式指定了本地目录:**不静默回退**。配了却不生效最阴——它会在界面上
            # 表现成"录音正常、返回正常、内容永远是假的",排查成本极高。目录不在位
            # 就明说,让运维一眼看到,而不是悄悄走回那条必然失败的联网下载路。
            if not os.path.isdir(_WHISPER_MODEL_DIR):
                raise RuntimeError(
                    f"WHISPER_MODEL_DIR={_WHISPER_MODEL_DIR!r} 不存在(或不是目录)。"
                    "服务以 LocalSystem 运行时 HOME 缓存不可达,故不回退联网下载 —— "
                    "请把模型目录放到位后重启服务。"
                )
            model_ref = _WHISPER_MODEL_DIR
            logger.info("从本地目录加载 faster-whisper 模型(离线): %s", model_ref)
        else:
            logger.info("加载 faster-whisper %s 模型(int8,CPU 推理,首次会下载)...", _WHISPER_SIZE)

        _whisper_model = WhisperModel(
            model_ref,
            device="cpu",
            compute_type="int8",
        )
        logger.info("faster-whisper 模型加载完成: %s", model_ref)
        return _whisper_model


def _transcribe_sync(model: Any, tmp_path: str, language: str | None) -> str:
    """同步执行 faster-whisper 转写(供 asyncio.to_thread 调用,避免阻塞事件循环)。"""
    # segments 是生成器,segments_iter + info
    # language=None 让模型自动检测;传 language 则强制语言
    segments, _info = model.transcribe(
        tmp_path,
        language=language,
        vad_filter=True,  # 过滤静音段,提升速度
    )
    # 拼接所有段文本
    return "".join(segment.text for segment in segments).strip()


@router.post("/voice/stt", response_model=STTResponse)
async def voice_stt(
    file: UploadFile = File(..., description="音频文件(wav/mp3/m4a/webm 等)"),
    language: str | None = Form(None, description="语言提示(如 zh/en/ja,可选)"),
) -> STTResponse:
    """接收音频文件并用 faster-whisper 本地转写为文本。

    完全免费 + 离线可用:
      - faster-whisper 基于 CTranslate2,本地 CPU 推理
      - base 模型 74MB,首次下载后永久离线
      - 无需任何 API key,零成本

    Args:
        file: 音频文件(wav/mp3/m4a/webm 等 faster-whisper 支持的格式,内部用 ffmpeg 解码)。
        language: ISO 639-1 语言代码(如 zh/en/ja),可选,提高识别准确率。

    Returns:
        STTResponse: { text, stub, model }
    """
    # 读取上传的音频字节
    audio_bytes = await file.read()
    if not audio_bytes:
        return STTResponse(text="", stub=True, model=_DEFAULT_STT_MODEL)

    # 本地 faster-whisper 推理
    suffix = _get_suffix(file.filename or "audio.wav")
    # Windows 上 NamedTemporaryFile 默认独占打开,faster-whisper 内部 ffmpeg/av
    # 无法重新打开文件读取。改用 mkstemp:返回 fd + path,先 close fd 释放锁,
    # 让 faster-whisper 自由读取,转写完手动删除。
    tmp_fd: int = -1
    tmp_path: str = ""
    try:
        # P1 修复(2026-08-06): 模型加载/转写均为阻塞 CPU 操作,
        # 用 asyncio.to_thread 包装,避免阻塞事件循环导致服务整体卡顿。
        model = await asyncio.to_thread(_get_whisper_model)

        tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        # 写入音频字节后立即关闭 fd,释放 Windows 文件锁
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(audio_bytes)
            f.flush()
        tmp_fd = -1  # 已关闭,避免 finally 重复 close

        text = await asyncio.to_thread(_transcribe_sync, model, tmp_path, language)

        return STTResponse(
            text=text,
            stub=False,
            model=_DEFAULT_STT_MODEL,
        )
    except ImportError as e:
        logger.warning("faster-whisper 未安装: %s", e)
        return STTResponse(
            text="[stub] faster-whisper 未安装,无法进行本地 STT 转写。请运行:pip install faster-whisper",
            stub=True,
            model=_DEFAULT_STT_MODEL,
        )
    except Exception as e:
        logger.warning("STT 本地转写失败: %s", e)
        # 失败时返回空文本 + stub 标记(避免 CLI 端崩溃)
        safe_msg = str(e)
        # 敏感信息脱敏(虽然本地推理不太可能含敏感信息,防御性处理)
        for key_field in ("api_key", "apikey", "authorization"):
            if key_field in safe_msg.lower():
                safe_msg = f"STT 调用失败(含敏感信息已脱敏): {type(e).__name__}"
                break
        return STTResponse(
            text=f"[STT 失败] {safe_msg}",
            stub=True,
            model=_DEFAULT_STT_MODEL,
        )
    finally:
        # 清理临时文件(fd 若未关闭也一并 close,再 unlink 文件)
        if tmp_fd >= 0:
            with contextlib.suppress(OSError):
                os.close(tmp_fd)
        if tmp_path:
            with contextlib.suppress(OSError):
                os.unlink(tmp_path)


def _get_suffix(filename: str) -> str:
    """从文件名提取扩展名(含 .),默认 .wav。"""
    if "." in filename:
        ext = filename.rsplit(".", 1)[1].lower()
        # 只允许字母数字(防止路径注入)
        if ext.isalnum() and len(ext) <= 6:
            return f".{ext}"
    return ".wav"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
