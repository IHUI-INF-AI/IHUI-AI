"""Captcha utility -- generates and verifies image captchas using Pillow + Redis.

Usage::

    from app.utils.captcha_util import generate_captcha, verify_captcha

    img_base64, captcha_key = generate_captcha()
    # Send captcha_key + img_base64 to the client.
    # Client submits captcha_key + user_input_code.
    ok = verify_captcha(captcha_key, user_input_code)
"""

import io
import logging
import random
import uuid

from PIL import Image, ImageDraw, ImageFont

from app.utils.redis_util import delete_key, get_key, set_key

logger = logging.getLogger(__name__)

# Captcha storage key prefix and TTL (seconds)
_CAPTCHA_PREFIX = "captcha:"
_CAPTCHA_TTL = 300  # 5 minutes

# Image dimensions
_IMG_WIDTH = 120
_IMG_HEIGHT = 40

# Characters to use (avoid ambiguous: 0/O, 1/l/I)
_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def _random_color(low: int = 0, high: int = 255) -> tuple:
    """Return a random (R, G, B) tuple."""
    return (random.randint(low, high), random.randint(low, high), random.randint(low, high))


def generate_captcha(length: int = 4) -> tuple:
    """Generate an image captcha.

    Args:
        length: Number of characters in the captcha code (default 4).

    Returns:
        A tuple ``(image_base64_str, captcha_key)`` where:
        - ``image_base64_str`` is a ``data:image/png;base64,...`` string
          ready to be embedded in an ``<img>`` tag.
        - ``captcha_key`` is a UUID used to look up the answer in Redis.
    """
    # Generate random code
    code = "".join(random.choices(_CHARS, k=length))

    # Create image
    image = Image.new("RGB", (_IMG_WIDTH, _IMG_HEIGHT), (255, 255, 255))
    draw = ImageDraw.Draw(image)

    # Try to load a font; fall back to default if not available
    try:
        font = ImageFont.truetype("arial.ttf", 28)
    except OSError:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        except OSError:
            font = ImageFont.load_default()  # type: ignore[assignment]

    # Draw each character at a random position/angle
    for i, char in enumerate(code):
        x_offset = 10 + i * 25 + random.randint(-3, 3)
        y_offset = random.randint(2, 10)
        draw.text((x_offset, y_offset), char, font=font, fill=_random_color(0, 150))

    # Add noise: random dots
    for _ in range(200):
        x = random.randint(0, _IMG_WIDTH - 1)
        y = random.randint(0, _IMG_HEIGHT - 1)
        draw.point((x, y), fill=_random_color(60, 200))

    # Add noise: random lines
    for _ in range(4):
        x1 = random.randint(0, _IMG_WIDTH)
        y1 = random.randint(0, _IMG_HEIGHT)
        x2 = random.randint(0, _IMG_WIDTH)
        y2 = random.randint(0, _IMG_HEIGHT)
        draw.line([(x1, y1), (x2, y2)], fill=_random_color(100, 200), width=1)

    # Encode to base64 PNG
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    import base64

    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    # Store in Redis
    captcha_key = uuid.uuid4().hex
    redis_key = f"{_CAPTCHA_PREFIX}{captcha_key}"
    set_key(redis_key, code, ex=_CAPTCHA_TTL)

    return f"data:image/png;base64,{img_base64}", captcha_key


def verify_captcha(captcha_key: str, code: str) -> bool:
    """Verify a captcha submission.

    The stored code is deleted after a single verification attempt (success
    or failure) to prevent replay attacks.

    Args:
        captcha_key: The key returned by :func:`generate_captcha`.
        code: The user-supplied captcha text.

    Returns:
        ``True`` if the code matches, ``False`` otherwise.
    """
    if not captcha_key or not code:
        return False

    redis_key = f"{_CAPTCHA_PREFIX}{captcha_key}"
    try:
        stored = get_key(redis_key)
    except Exception as e:
        logger.warning(f"Captcha redis get failed: {e}")
        stored = None

    # Always delete after attempt
    try:
        delete_key(redis_key)
    except Exception as e:
        logger.warning(f"Captcha redis delete failed: {e}")

    if stored is None:
        return False

    # Case-insensitive comparison
    return stored.lower() == code.strip().lower()
