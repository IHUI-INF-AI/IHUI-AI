"""视频水印工具.

迁移自 ZHS_Server_java/core/utils/VideoWatermarkUtil.java.
使用 ffmpeg 实现视频水印.
"""

import os
import subprocess

from loguru import logger


def add_text_watermark_video(
    input_path: str,
    text: str,
    output_path: str | None = None,
    font_size: int = 24,
    font_color: str = "white",
    position: str = "bottom-right",
) -> str | None:
    """给视频添加文字水印.

    Returns:
        成功返回输出路径, 失败返回 None
    """
    if not os.path.exists(input_path):
        logger.error(f"输入视频文件不存在: {input_path}")
        return None
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_watermark{ext}"
    if not _check_ffmpeg():
        logger.error("ffmpeg 未安装或不可用")
        return None
    pos_map = {
        "top-left": "10:10",
        "top-right": "main_w-text_w-10:10",
        "bottom-left": "10:main_h-text_h-10",
        "bottom-right": "main_w-text_w-10:main_h-text_h-10",
        "center": "(main_w-text_w)/2:(main_h-text_h)/2",
    }
    xy = pos_map.get(position, pos_map["bottom-right"])
    safe_text = text.replace(":", "\\:").replace("'", "\\'")
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"drawtext=text='{safe_text}':fontsize={font_size}:fontcolor={font_color}:x={xy.split(':')[0]}:y={xy.split(':')[1]}",
        "-c:a", "copy",
        output_path,
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        logger.error(f"视频水印失败: {e.stderr}")
        return None
    except Exception as e:
        logger.error(f"视频水印处理异常: {e}")
        return None


def add_image_watermark_video(
    input_path: str,
    logo_path: str,
    output_path: str | None = None,
    position: str = "bottom-right",
) -> str | None:
    """给视频添加图片水印(logo)."""
    if not os.path.exists(input_path):
        logger.error(f"输入视频文件不存在: {input_path}")
        return None
    if not os.path.exists(logo_path):
        logger.error(f"水印图片不存在: {logo_path}")
        return None
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_watermark{ext}"
    if not _check_ffmpeg():
        logger.error("ffmpeg 未安装或不可用")
        return None
    pos_map = {
        "top-left": "10:10",
        "top-right": "main_w-overlay_w-10:10",
        "bottom-left": "10:main_h-overlay_h-10",
        "bottom-right": "main_w-overlay_w-10:main_h-overlay_h-10",
    }
    xy = pos_map.get(position, pos_map["bottom-right"])
    cmd = [
        "ffmpeg", "-y", "-i", input_path, "-i", logo_path,
        "-filter_complex", f"overlay={xy}",
        "-c:a", "copy",
        output_path,
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        logger.error(f"视频 logo 水印失败: {e.stderr}")
        return None
    except Exception as e:
        logger.error(f"视频 logo 水印处理异常: {e}")
        return None


def _check_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5, check=True)
        return True
    except Exception:
        return False
