"""
Symmetric encryption utility for sensitive fields (e.g. API Keys).

Uses Fernet (AES-128-CBC + HMAC-SHA256) from the ``cryptography`` package.
The encryption key is read from ``settings.ENCRYPTION_KEY`` (Fernet-compatible
base64 url-safe 32-byte key). If missing in dev, a random key is generated
on the fly (data will not survive restart — dev only).
"""

from __future__ import annotations

import base64
import os
import re
from functools import lru_cache
from typing import Optional

from loguru import logger

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:  # pragma: no cover
    Fernet = None  # type: ignore[misc, assignment]
    InvalidToken = Exception  # type: ignore[misc, assignment]


# Patterns that should be masked in logs / error details
_SENSITIVE_PATTERNS = [
    # API keys: sk-xxx, sk_xxx, Bearer xxx
    re.compile(r"(sk-|sk_)[A-Za-z0-9\-_]{8,}", re.IGNORECASE),
    re.compile(r"(Bearer\s+)[A-Za-z0-9\-_.=]+", re.IGNORECASE),
    # Generic key=xxx patterns
    re.compile(r"(api[_-]?key[=:]\s*)[^\s&\"]+", re.IGNORECASE),
]


@lru_cache(maxsize=1)
def _get_fernet() -> Optional[Fernet]:
    """Return a cached Fernet instance, or None if cryptography is unavailable."""
    if Fernet is None:
        logger.warning("cryptography package not installed — encryption disabled")
        return None

    from app.config import settings

    raw_key = getattr(settings, "ENCRYPTION_KEY", "") or ""
    if not raw_key:
        # Dev fallback: generate ephemeral key (won't survive restart)
        raw_key = Fernet.generate_key().decode()
        logger.warning(
            "ENCRYPTION_KEY not set — using ephemeral random key. "
            "Encrypted data will NOT survive restart. Set ENCRYPTION_KEY in production."
        )

    try:
        return Fernet(raw_key.encode() if isinstance(raw_key, str) else raw_key)
    except Exception as exc:
        logger.error(f"Invalid ENCRYPTION_KEY format, encryption disabled: {exc}")
        return None


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string, returns base64 ciphertext string.

    Returns empty string if plaintext is empty.
    Returns plaintext as-is (with a prefix marker) if encryption is unavailable,
    so the column is still usable in dev without cryptography.
    """
    if not plaintext:
        return ""
    f = _get_fernet()
    if f is None:
        # Dev fallback — NOT secure, only for local testing
        return f"plain:{plaintext}"
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a ciphertext string produced by :func:`encrypt_value`.

    Returns empty string if ciphertext is empty.
    Returns the original plaintext if the value was stored with ``plain:`` prefix
    (dev fallback). Returns empty string on decryption failure.
    """
    if not ciphertext:
        return ""
    if ciphertext.startswith("plain:"):
        return ciphertext[6:]
    f = _get_fernet()
    if f is None:
        return ""
    try:
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception) as exc:
        logger.error(f"Decryption failed: {exc}")
        return ""


def mask_api_key(api_key: str) -> str:
    """Mask an API key for safe display, keeping only last 4 chars.

    Examples:
        sk-abcdef123456 → sk-****3456
        short           → ****
        (empty)         → (empty)
    """
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    # Keep prefix (e.g. "sk-") + mask + last 4
    prefix_match = re.match(r"^([a-zA-Z]+[-_]?)", api_key)
    prefix = prefix_match.group(1) if prefix_match else ""
    return f"{prefix}****{api_key[-4:]}"


def mask_sensitive_text(text: str, max_length: int = 500) -> str:
    """Mask sensitive patterns in a text string (for logs / error details).

    Also truncates to ``max_length`` characters.
    """
    if not text:
        return ""
    masked = text
    for pattern in _SENSITIVE_PATTERNS:
        masked = pattern.sub(
            lambda m: m.group(1) + "****" if m.lastindex else "****",
            masked,
        )
    if len(masked) > max_length:
        masked = masked[:max_length] + "...(truncated)"
    return masked
