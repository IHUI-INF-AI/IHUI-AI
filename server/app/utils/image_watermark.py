"""图片水印工具.

迁移自 ZHS_Server_java/core/utils/ImageWatermarkUtil.java.
使用 Pillow 实现图片水印添加.
"""

import io
import os

from loguru import logger

try:
    from PIL import Image, ImageDraw, ImageFont
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False
    Image = ImageDraw = ImageFont = None


def add_text_watermark(
    image_path: str,
    text: str,
    output_path: str | None = None,
    font_size: int = 24,
    color: tuple[int, int, int] = (255, 255, 255),
    opacity: int = 128,
    position: str = "bottom-right",
) -> bytes | None:
    """给图片添加文字水印.

    Args:
        image_path: 输入图片路径
        text: 水印文字
        output_path: 输出路径,None 时返回 bytes
        font_size: 字体大小
        color: 文字颜色 RGB
        opacity: 透明度 0-255
        position: 位置 top-left/top-right/bottom-left/bottom-right/center

    Returns:
        成功返回图片字节,失败返回 None
    """
    if not _HAS_PIL:
        logger.warning("Pillow 未安装, 无法添加图片水印")
        return None
    try:
        img = Image.open(image_path).convert("RGBA")
        watermark_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(watermark_layer)
        try:
            font_paths = [
                "C:/Windows/Fonts/msyh.ttc",
                "C:/Windows/Fonts/simhei.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            ]
            font = None
            for fp in font_paths:
                if os.path.exists(fp):
                    font = ImageFont.truetype(fp, font_size)
                    break
            if font is None:
                font = ImageFont.load_default()
        except Exception:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        margin = 10
        if position == "top-left":
            x, y = margin, margin
        elif position == "top-right":
            x, y = img.width - text_w - margin, margin
        elif position == "bottom-left":
            x, y = margin, img.height - text_h - margin
        elif position == "center":
            x, y = (img.width - text_w) // 2, (img.height - text_h) // 2
        else:
            x, y = img.width - text_w - margin, img.height - text_h - margin
        draw.text((x, y), text, font=font, fill=(*color, opacity))
        combined = Image.alpha_composite(img, watermark_layer)
        buf = io.BytesIO()
        combined.convert("RGB").save(buf, format="JPEG", quality=90)
        data = buf.getvalue()
        if output_path:
            with open(output_path, "wb") as f:
                f.write(data)
        return data
    except Exception as e:
        logger.error(f"添加图片水印失败: {e}")
        return None


def add_image_watermark(
    base_path: str,
    logo_path: str,
    output_path: str | None = None,
    position: str = "bottom-right",
    scale: float = 0.15,
    opacity: int = 128,
) -> bytes | None:
    """给图片添加图片水印(logo)."""
    if not _HAS_PIL:
        logger.warning("Pillow 未安装, 无法添加图片水印")
        return None
    try:
        base = Image.open(base_path).convert("RGBA")
        logo = Image.open(logo_path).convert("RGBA")
        w, h = int(base.width * scale), int(base.height * scale)
        logo = logo.resize((w, h), Image.LANCZOS)
        alpha = logo.split()[3]
        alpha = alpha.point(lambda p: int(p * opacity / 255))
        logo.putalpha(alpha)
        margin = 10
        if position == "top-left":
            x, y = margin, margin
        elif position == "top-right":
            x, y = base.width - w - margin, margin
        elif position == "bottom-left":
            x, y = margin, base.height - h - margin
        elif position == "center":
            x, y = (base.width - w) // 2, (base.height - h) // 2
        else:
            x, y = base.width - w - margin, base.height - h - margin
        base.paste(logo, (x, y), logo)
        buf = io.BytesIO()
        base.convert("RGB").save(buf, format="JPEG", quality=90)
        data = buf.getvalue()
        if output_path:
            with open(output_path, "wb") as f:
                f.write(data)
        return data
    except Exception as e:
        logger.error(f"添加图片 logo 水印失败: {e}")
        return None
