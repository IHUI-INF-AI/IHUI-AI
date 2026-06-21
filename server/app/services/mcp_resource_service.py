"""MCP 资源服务(视频转音频、视频帧提取).

迁移自 ZHS_Server_java/mcp/service/McpResourceService.java 及 VideoFrameMinioUploader.java.
使用 ffmpeg-python / subprocess 实现视频处理.
"""

import os
import subprocess
from typing import Any

from loguru import logger


def _check_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5, check=True)
        return True
    except Exception:
        return False


def video_to_audio(
    input_path: str,
    output_path: str | None = None,
    audio_format: str = "mp3",
    audio_bitrate: str = "192k",
) -> str | None:
    """视频转音频.

    Args:
        input_path: 输入视频路径
        output_path: 输出音频路径, None 时基于输入生成
        audio_format: 音频格式 mp3/aac/wav
        audio_bitrate: 音频比特率

    Returns:
        成功返回输出路径, 失败返回 None
    """
    if not os.path.exists(input_path):
        logger.error(f"输入视频不存在: {input_path}")
        return None
    if output_path is None:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}.{audio_format}"
    if not _check_ffmpeg():
        logger.error("ffmpeg 未安装")
        return None
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vn", "-acodec", "libmp3lame" if audio_format == "mp3" else "aac",
        "-ab", audio_bitrate,
        output_path,
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=600, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        logger.error(f"视频转音频失败: {e.stderr}")
        return None
    except Exception as e:
        logger.error(f"视频转音频异常: {e}")
        return None


def extract_video_frames(
    input_path: str,
    output_dir: str,
    frame_rate: float = 1.0,
    image_format: str = "jpg",
    max_frames: int = 30,
) -> list[str]:
    """提取视频帧.

    Args:
        input_path: 输入视频路径
        output_dir: 输出目录
        frame_rate: 每秒帧数
        image_format: 图片格式 jpg/png
        max_frames: 最大帧数

    Returns:
        提取的帧文件路径列表
    """
    if not os.path.exists(input_path):
        logger.error(f"输入视频不存在: {input_path}")
        return []
    os.makedirs(output_dir, exist_ok=True)
    if not _check_ffmpeg():
        logger.error("ffmpeg 未安装")
        return []
    output_pattern = os.path.join(output_dir, f"frame_%04d.{image_format}")
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"fps={frame_rate}",
        "-frames:v", str(max_frames),
        output_pattern,
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=600, check=True)
        result = []
        for f in sorted(os.listdir(output_dir)):
            if f.startswith("frame_") and f.endswith(f".{image_format}"):
                result.append(os.path.join(output_dir, f))
        return result
    except subprocess.CalledProcessError as e:
        logger.error(f"视频帧提取失败: {e.stderr}")
        return []
    except Exception as e:
        logger.error(f"视频帧提取异常: {e}")
        return []


def get_video_info(input_path: str) -> dict[str, Any]:
    """获取视频元信息(时长、分辨率、编码等)."""
    if not os.path.exists(input_path):
        return {}
    if not _check_ffmpeg():
        return {}
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", input_path],
            capture_output=True, text=True, timeout=30, check=True,
        )
        import json
        return json.loads(result.stdout)
    except Exception as e:
        logger.error(f"获取视频信息失败: {e}")
        return {}
