"""错误码国际化 (i18n) 模块.

支持 zh-CN / en-US 两种语言.
按 Accept-Language header 自动选择.

用法:
    from app.schemas.i18n import t

    msg = t(ErrorCode.TOKEN_EXPIRED, lang="zh-CN")
    # => "Token 已过期"
    msg = t(ErrorCode.TOKEN_EXPIRED, lang="en-US")
    # => "Token has expired"
"""


from app.schemas.error_codes import ErrorCode

# ---------------------------------------------------------------------------
# 错误码翻译表
# ---------------------------------------------------------------------------

_MESSAGES_ZH: dict[str, str] = {
    ErrorCode.SUCCESS.value: "成功",
    ErrorCode.BAD_REQUEST.value: "请求参数错误",
    ErrorCode.PARAM_MISSING.value: "缺少必填参数",
    ErrorCode.PARAM_INVALID.value: "请求参数验证失败",
    ErrorCode.UNAUTHORIZED.value: "未登录或登录已失效",
    ErrorCode.TOKEN_EXPIRED.value: "Token 已过期, 请重新登录",
    ErrorCode.TOKEN_INVALID.value: "Token 无效",
    ErrorCode.TOKEN_REVOKED.value: "Token 已被撤销",
    ErrorCode.REFRESH_REPLAY.value: "Refresh Token 重放被拒绝, 请重新登录",
    ErrorCode.FORBIDDEN.value: "无权限访问",
    ErrorCode.PERMISSION_DENIED.value: "权限不足",
    ErrorCode.NOT_FOUND.value: "资源不存在",
    ErrorCode.METHOD_NOT_ALLOWED.value: "请求方法不被允许",
    ErrorCode.CONFLICT.value: "资源冲突",
    ErrorCode.RATE_LIMIT.value: "请求过于频繁, 请稍后重试",
    ErrorCode.CAPTCHA_INVALID.value: "验证码错误",
    ErrorCode.SMS_CODE_INVALID.value: "短信验证码错误",
    ErrorCode.PHONE_REGISTERED.value: "手机号已注册",
    ErrorCode.PASSWORD_WEAK.value: "密码强度不足",
    ErrorCode.INTERNAL_ERROR.value: "服务器内部错误, 请稍后重试",
    ErrorCode.SERVICE_UNAVAILABLE.value: "服务暂不可用",
    ErrorCode.DB_ERROR.value: "数据库操作失败",
    ErrorCode.CACHE_ERROR.value: "缓存操作失败",
    ErrorCode.EXTERNAL_API_ERROR.value: "外部 API 调用失败",
    ErrorCode.TIMEOUT.value: "请求超时",
    ErrorCode.INSUFFICIENT_BALANCE.value: "余额不足",
    ErrorCode.ORDER_NOT_FOUND.value: "订单不存在",
    ErrorCode.COURSE_NOT_PURCHASED.value: "课程未购买",
}

_MESSAGES_EN: dict[str, str] = {
    ErrorCode.SUCCESS.value: "Success",
    ErrorCode.BAD_REQUEST.value: "Bad request",
    ErrorCode.PARAM_MISSING.value: "Required parameter missing",
    ErrorCode.PARAM_INVALID.value: "Parameter validation failed",
    ErrorCode.UNAUTHORIZED.value: "Authentication required",
    ErrorCode.TOKEN_EXPIRED.value: "Token has expired, please log in again",
    ErrorCode.TOKEN_INVALID.value: "Invalid token",
    ErrorCode.TOKEN_REVOKED.value: "Token has been revoked",
    ErrorCode.REFRESH_REPLAY.value: "Refresh token replay detected, please log in again",
    ErrorCode.FORBIDDEN.value: "Forbidden",
    ErrorCode.PERMISSION_DENIED.value: "Permission denied",
    ErrorCode.NOT_FOUND.value: "Resource not found",
    ErrorCode.METHOD_NOT_ALLOWED.value: "Method not allowed",
    ErrorCode.CONFLICT.value: "Resource conflict",
    ErrorCode.RATE_LIMIT.value: "Too many requests, please try again later",
    ErrorCode.CAPTCHA_INVALID.value: "Invalid captcha",
    ErrorCode.SMS_CODE_INVALID.value: "Invalid SMS code",
    ErrorCode.PHONE_REGISTERED.value: "Phone number already registered",
    ErrorCode.PASSWORD_WEAK.value: "Password is too weak",
    ErrorCode.INTERNAL_ERROR.value: "Internal server error, please try again later",
    ErrorCode.SERVICE_UNAVAILABLE.value: "Service unavailable",
    ErrorCode.DB_ERROR.value: "Database operation failed",
    ErrorCode.CACHE_ERROR.value: "Cache operation failed",
    ErrorCode.EXTERNAL_API_ERROR.value: "External API call failed",
    ErrorCode.TIMEOUT.value: "Request timeout",
    ErrorCode.INSUFFICIENT_BALANCE.value: "Insufficient balance",
    ErrorCode.ORDER_NOT_FOUND.value: "Order not found",
    ErrorCode.COURSE_NOT_PURCHASED.value: "Course not purchased",
}

_DEFAULT = "zh-CN"
_MESSAGES = {"zh-CN": _MESSAGES_ZH, "en-US": _MESSAGES_EN}


def normalize_lang(lang: str | None) -> str:
    """规范化语言代码 -> zh-CN / en-US.

    zh, zh_CN, zh_cn, zh-CN -> zh-CN
    en, en_US, en-us -> en-US
    其他 -> 默认 zh-CN
    """
    if not lang:
        return _DEFAULT
    lang = lang.strip().lower().replace("_", "-")
    if lang.startswith("zh"):
        return "zh-CN"
    if lang.startswith("en"):
        return "en-US"
    return _DEFAULT


def t(code: str | ErrorCode, lang: str | None = None) -> str:
    """翻译错误码为对应语言的消息.

    Args:
        code: 错误码 (ErrorCode 枚举或字符串)
        lang: 语言代码 (zh-CN/en-US), None 时使用默认

    Returns:
        本地化错误消息字符串. 如果 code 不在翻译表中, 返回 code 本身.
    """
    code_value = code.value if isinstance(code, ErrorCode) else str(code)
    lang_key = normalize_lang(lang)
    messages = _MESSAGES.get(lang_key, _MESSAGES_ZH)
    return messages.get(code_value, code_value)


def get_message_for_header(
    code: str | ErrorCode,
    accept_language: str | None,
) -> str:
    """从 Accept-Language header 取消息."""
    return t(code, accept_language)
