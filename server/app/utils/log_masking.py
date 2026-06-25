"""日志敏感信息脱敏工具.

提供统一脱敏函数 _mask_sensitive(value, kind=None), 用于在日志输出前
对手机号/验证码/密码/token 等敏感信息做脱敏处理, 避免明文 PII 落盘.

支持的 kind:
  - phone:    保留前 3 后 4, 中间 4 位用 * 替换 (138****1234)
  - code/otp: 全部用 * 替换 (******)
  - password: 全部替换为 [REDACTED]
  - token:    保留前 4 后 4, 中间用 * 替换 (abcd****wxyz)
  - None/其他: 用正则替换 phone/code/otp/password/token 关键字后的值

仅用于日志输出, 不影响业务逻辑.
"""

import re
from typing import Any, Optional

# 手机号正则 (中国大陆 11 位)
_PHONE_RE = re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)")

# 通用敏感字段正则: 匹配 key=value 或 key: value 形式
_SENSITIVE_KV_RE = re.compile(
    r"(?i)(?P<key>(?:phone|mobile|code|otp|password|passwd|pwd|token|access_token|refresh_token))"
    r"\s*[:=]\s*['\"]?(?P<val>[^&\s,'\"]+)['\"]?"
)


def _mask_phone_value(value: str) -> str:
    """脱敏手机号: 138****1234. 用于日志输出, 避免明文 PII."""
    if not value:
        return "***"
    s = str(value)
    if len(s) < 7:
        return "***"
    return f"{s[:3]}****{s[-4:]}"


def _mask_code_value(value: str) -> str:
    """脱敏验证码/OTP: 全部用 * 替换, 长度保留."""
    if not value:
        return "***"
    s = str(value)
    return "*" * len(s)


def _mask_password_value(value: str) -> str:
    """脱敏密码: 全部替换为 [REDACTED]."""
    if not value:
        return "[REDACTED]"
    return "[REDACTED]"


def _mask_token_value(value: str) -> str:
    """脱敏 token: 保留前 4 后 4, 中间用 * 替换 (abcd****wxyz)."""
    if not value:
        return "***"
    s = str(value)
    if len(s) <= 8:
        # 短 token 全部用 * 替换, 避免泄露
        return "*" * len(s)
    return f"{s[:4]}****{s[-4:]}"


# kind -> 处理函数
_MASKERS = {
    "phone": _mask_phone_value,
    "mobile": _mask_phone_value,
    "code": _mask_code_value,
    "otp": _mask_code_value,
    "password": _mask_password_value,
    "passwd": _mask_password_value,
    "pwd": _mask_password_value,
    "token": _mask_token_value,
    "access_token": _mask_token_value,
    "refresh_token": _mask_token_value,
}


def _mask_sensitive(value: Any, kind: Optional[str] = None) -> Any:
    """对敏感值做脱敏, 用于日志输出.

    Args:
        value: 要脱敏的值 (str/int/None 等).
        kind: 脱敏类型, 支持 phone/code/otp/password/token 等.
            None 时按通用规则对字符串做正则替换.

    Returns:
        脱敏后的字符串; 输入为 None 时返回 None (保持原样便于日志显示).
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        value = str(value)

    if not isinstance(value, str):
        # 非字符串类型 (dict/list 等) 不在此处处理, 直接返回让上层处理
        return value

    if kind:
        kind_lower = kind.lower()
        masker = _MASKERS.get(kind_lower)
        if masker:
            return masker(value)
        # 未知 kind, 退回到通用正则替换
        return _mask_generic(value)

    return _mask_generic(value)


def _mask_generic(text: str) -> str:
    """对字符串做通用脱敏: 替换 phone/code/otp/password/token 关键字后的值."""
    if not text:
        return text

    def _sub_kv(m: "re.Match[str]") -> str:
        key = m.group("key").lower()
        val = m.group("val")
        masked = _mask_sensitive(val, key)
        return f"{m.group('key')}={masked}"

    text = _SENSITIVE_KV_RE.sub(_sub_kv, text)
    # 单独出现的手机号也做脱敏
    text = _PHONE_RE.sub(lambda m: _mask_phone_value(m.group(1)), text)
    return text


__all__ = ["_mask_sensitive", "_mask_phone_value", "_mask_code_value", "_mask_password_value", "_mask_token_value"]
