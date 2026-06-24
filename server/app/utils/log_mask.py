"""日志敏感信息脱敏工具 - 修复 Bug-8 + Bug-8-续.

自动把 URL/字典/JSON 字符串中常见敏感字段值替换为 ***.
适配场景:
  - httpx response 完整 URL (含 ?secret=xxx)
  - 微信/支付宝回调 (含 appid/secret/signature)
  - 数据库连接串 (?password=xxx)
  - JWT 字符串直接打印

Bug-8-续: 提供 install() 全局接管 loguru sink, 任何 logger.info/exception
打印的字符串/字典都会自动脱敏.
"""

import re
import sys
from collections.abc import Iterable
from typing import Any

# 敏感字段名 (大小写不敏感)
SENSITIVE_KEYS = (
    "secret",
    "appsecret",
    "app_secret",
    "wx_mini_secret",
    "alipay_private_key",
    "alipay_public_key",
    "private_key",
    "password",
    "passwd",
    "pwd",
    "access_token",
    "refresh_token",
    "authorization",
    "bearer",
    "token",
    "client_secret",
    "api_key",
    "apikey",
    "signature",
    "sign",
    "code",  # 微信 jscode2session 的 code 也视为敏感
)

# URL query 中要脱敏的 key
_SENSITIVE_KEY_PATTERN = re.compile(
    r"(?P<key>(?:" + "|".join(re.escape(k) for k in SENSITIVE_KEYS) + r"))\s*=\s*" r"(?P<val>[^&\s]+)",
    re.IGNORECASE,
)

# 形如 Authorization: Bearer xxx 的脱敏
_BEARER_PATTERN = re.compile(r"(?P<key>Bearer)\s+(?P<val>[A-Za-z0-9._\-]+)", re.IGNORECASE)

# JWT 字符串 (xxx.yyy.zzz)
_JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+")

_MASK = "***"


def mask_url_secrets(text: str) -> str:
    """对字符串中 URL query 的敏感字段做脱敏."""
    if not text:
        return text

    def _sub(m: re.Match) -> str:
        return f"{m.group('key')}={_MASK}"

    text = _SENSITIVE_KEY_PATTERN.sub(_sub, text)
    text = _BEARER_PATTERN.sub(f"Bearer {_MASK}", text)
    # JWT 整段
    text = _JWT_PATTERN.sub(_MASK, text)
    return text


def mask_dict(obj: Any, _keys: Iterable[str] = SENSITIVE_KEYS) -> Any:
    """递归把 dict/list 中 SENSITIVE_KEYS 字段值脱敏."""
    if isinstance(obj, dict):
        return {k: (_MASK if k.lower() in _keys else mask_dict(v, _keys)) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [mask_dict(x, _keys) for x in obj]
    if isinstance(obj, str):
        return mask_url_secrets(obj)
    return obj


def safe_log(obj: Any) -> Any:
    """对要记录到日志的对象做脱敏, dict/list/str 都能处理."""
    if isinstance(obj, str):
        return mask_url_secrets(obj)
    return mask_dict(obj)


# ---------------------------------------------------------------------------
# Bug-8-续: 全局 loguru sink 接管
# ---------------------------------------------------------------------------


def _patch_record_extra(record) -> None:
    """对 loguru record['message'] 内的 dict / str 做脱敏."""
    msg = record.get("message")
    if msg is None:
        return
    # loguru 把 format 后的字符串放 message
    if isinstance(msg, str):
        record["message"] = mask_url_secrets(msg)
    else:
        record["message"] = safe_log(msg)


def install(extra_keys_to_mask: Iterable[str] = ()) -> None:
    """接管 loguru 默认 sink, 任何日志自动脱敏.

    建议在 create_app 启动早期调用一次.

    Args:
        extra_keys_to_mask: 额外需要脱敏的字段名, 会合并到 SENSITIVE_KEYS 后重新编译正则.
    """
    from loguru import logger

    # 合并额外脱敏 key, 重新编译 URL query 脱敏正则, 使 extra_keys_to_mask 实际生效.
    global _SENSITIVE_KEY_PATTERN
    keys = set(SENSITIVE_KEYS) | set(extra_keys_to_mask)
    _SENSITIVE_KEY_PATTERN = re.compile(
        r"(?P<key>(?:" + "|".join(re.escape(k) for k in keys) + r"))\s*=\s*" r"(?P<val>[^&\s]+)",
        re.IGNORECASE,
    )

    # 1. 添加脱敏 sink (stderr, 与默认行为一致)
    logger.add(
        sys.stderr,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
        level="INFO",
        filter=_patch_record_extra,
        enqueue=False,  # 测试时可关 enqueue
    )
    # 2. 替换默认 stderr handler (id=0), 让其也走脱敏
    try:
        logger.remove(0)
    except Exception as e:
        # 不用 loguru 记录: 此处脱敏 sink 已 add, loguru 日志会再次触发 _patch_record_extra,
        # remove 失败路径下可能递归. 改用标准 stderr 输出.
        print(f"log_mask.install: remove default handler failed: {e!r}", file=sys.stderr)
