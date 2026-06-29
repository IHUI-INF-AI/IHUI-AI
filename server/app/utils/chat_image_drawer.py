"""聊天对话图片绘制工具.

迁移自 ZHS_Server_java/core/utils/ChatImageDrawer.java 系列.
使用 Pillow 实现对话图片生成.
"""

import io
import os

from loguru import logger

try:
    from PIL import Image, ImageDraw, ImageFont
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False
    Image = ImageDraw = ImageFont = None  # type: ignore[assignment]


def _load_font(size: int = 18):
    """加载系统字体."""
    if not _HAS_PIL:
        return None
    candidates = [
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for fp in candidates:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _wrap_text(text: str, font, max_width: int) -> list[str]:
    """按最大像素宽度换行."""
    if not _HAS_PIL or not text:
        return [text] if text else [""]
    lines = []
    for raw_line in text.split("\n"):
        if not raw_line:
            lines.append("")
            continue
        current = ""
        for ch in raw_line:
            test = current + ch
            try:
                bbox = font.getbbox(test)
                w = bbox[2] - bbox[0]
            except Exception:
                w = len(test) * 12
            if w > max_width and current:
                lines.append(current)
                current = ch
            else:
                current = test
        if current:
            lines.append(current)
    return lines


def draw_chat_bubble(
    avatar: Image.Image | None,
    text: str,
    role: str = "user",
    max_width: int = 600,
    padding: int = 12,
    bg_color: tuple[int, int, int] | None = None,
    text_color: tuple[int, int, int] = (0, 0, 0),
    avatar_size: int = 48,
    font_size: int = 18,
) -> Image.Image | None:
    """绘制单个聊天气泡.

    Args:
        avatar: 头像图片
        text: 文本内容
        role: user/assistant
        max_width: 气泡最大宽度
        padding: 内边距
        bg_color: 气泡背景色
        text_color: 文字颜色
        avatar_size: 头像大小
        font_size: 字体大小

    Returns:
        渲染好的 Image
    """
    if not _HAS_PIL:
        logger.warning("Pillow 未安装, 无法绘制聊天气泡")
        return None
    if bg_color is None:
        bg_color = (220, 248, 198) if role == "user" else (255, 255, 255)
    font = _load_font(font_size)
    text_max_w = max_width - 2 * padding
    lines = _wrap_text(text, font, text_max_w)
    line_heights = []
    for ln in lines:
        try:
            bbox = font.getbbox(ln)
            line_heights.append(bbox[3] - bbox[1] + 4)
        except Exception:
            line_heights.append(22)
    text_w = min(text_max_w, max([font.getbbox(ln)[2] - font.getbbox(ln)[0] for ln in lines] + [0])) if lines else 0
    text_h = sum(line_heights)
    bubble_w = text_w + 2 * padding
    bubble_h = text_h + 2 * padding
    if avatar is not None:
        try:
            avatar = avatar.resize((avatar_size, avatar_size), Image.LANCZOS)  # type: ignore[attr-defined]
        except Exception:
            avatar = None
    has_avatar = avatar is not None
    canvas_w = bubble_w + (avatar_size + 10 if has_avatar else 0) + 20
    canvas_h = max(bubble_h, avatar_size) + 20
    img = Image.new("RGB", (canvas_w, canvas_h), (245, 245, 245))
    draw = ImageDraw.Draw(img)
    if has_avatar:
        if role == "user":
            avatar_x = canvas_w - avatar_size - 10
            text_x = 10
        else:
            avatar_x = 10
            text_x = avatar_size + 20
        img.paste(avatar, (avatar_x, 10))  # type: ignore[arg-type]
        bubble_x = text_x - 5
    else:
        bubble_x = 10
    bubble_y = 10
    draw.rounded_rectangle(
        (bubble_x, bubble_y, bubble_x + bubble_w, bubble_y + bubble_h),
        radius=10, fill=bg_color,
    )
    text_y = bubble_y + padding
    for ln, lh in zip(lines, line_heights):
        draw.text((bubble_x + padding, text_y), ln, font=font, fill=text_color)
        text_y += lh
    return img


def draw_chat_conversation(
    messages: list[dict],
    title: str | None = None,
    output_path: str | None = None,
    width: int = 800,
    padding: int = 20,
) -> bytes | None:
    """绘制完整对话图片.

    Args:
        messages: [{"role": "user"/"assistant", "content": str, "avatar": Image|None}, ...]
        title: 标题
        output_path: 输出路径, None 时返回 bytes
        width: 画布宽度

    Returns:
        成功返回图片字节, 失败返回 None
    """
    if not _HAS_PIL:
        logger.warning("Pillow 未安装, 无法绘制对话图片")
        return None
    rendered = []
    title_img_height = 60 if title else 0
    for msg in messages:
        bubble = draw_chat_bubble(
            avatar=msg.get("avatar"),
            text=msg.get("content", ""),
            role=msg.get("role", "user"),
            max_width=int(width * 0.75),
        )
        if bubble:
            rendered.append(bubble)
    if not rendered:
        return None
    total_h = sum(img.height for img in rendered) + len(rendered) * padding + title_img_height
    canvas = Image.new("RGB", (width, total_h), (245, 245, 245))
    draw = ImageDraw.Draw(canvas)
    y = padding
    if title:
        title_font = _load_font(22)
        try:
            bbox = title_font.getbbox(title)
            title_w = bbox[2] - bbox[0]
        except Exception:
            title_w = len(title) * 22
        draw.text(((width - title_w) // 2, y), title, font=title_font, fill=(0, 0, 0))
        y += title_img_height
    for img in rendered:
        x = (width - img.width) // 2
        canvas.paste(img, (x, y))
        y += img.height + padding
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    data = buf.getvalue()
    if output_path:
        with open(output_path, "wb") as f:
            f.write(data)
    return data
