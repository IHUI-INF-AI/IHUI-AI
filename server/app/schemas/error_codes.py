"""统一错误码标准.

设计原则:
  - HTTP 状态码与业务错误码分离: HTTP 表示传输层结果, 业务码表示业务层语义
  - 业务码用 6 位字符串: 2位模块 + 4位序列
  - 前端只需判断 code 是否为 "0" 即可识别成功

错误码分类:
  0       成功
  4xxxxx  客户端错误 (4xx HTTP)
  5xxxxx  服务端错误 (5xx HTTP)
  9xxxxx  业务特定错误 (任意 HTTP)
"""
import enum

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(enum.StrEnum):  # type: ignore[no-redef]
        __str__ = str.__str__


class ErrorCode(StrEnum):
    """统一错误码枚举 (str 子类, 可直接 JSON 序列化)."""

    # 通用成功
    SUCCESS = "0"

    # 4xxxxx 客户端错误
    BAD_REQUEST = "400000"          # 请求参数错误
    PARAM_MISSING = "400001"        # 缺少必填参数
    PARAM_INVALID = "400002"        # 参数格式无效
    UNAUTHORIZED = "401000"         # 未登录
    TOKEN_EXPIRED = "401001"        # Token 过期
    TOKEN_INVALID = "401002"        # Token 无效
    TOKEN_REVOKED = "401003"        # Token 已被撤销
    REFRESH_REPLAY = "401004"       # Refresh token 重放
    FORBIDDEN = "403000"            # 无权限
    PERMISSION_DENIED = "403001"    # 权限不足
    NOT_FOUND = "404000"            # 资源不存在
    METHOD_NOT_ALLOWED = "405000"   # 方法不允许
    CONFLICT = "409000"             # 资源冲突
    RATE_LIMIT = "429000"           # 限流
    CAPTCHA_INVALID = "400100"      # 验证码错误
    SMS_CODE_INVALID = "400101"     # 短信验证码错误
    PHONE_REGISTERED = "400102"     # 手机号已注册
    PASSWORD_WEAK = "400103"        # 密码强度不足
    EMAIL_CODE_INVALID = "400104"   # 邮箱验证码错误
    EMAIL_FORMAT_INVALID = "400105" # 邮箱格式无效
    EMAIL_NOT_CONFIGURED = "500104" # 邮件服务未配置

    # 5xxxxx 服务端错误
    INTERNAL_ERROR = "500000"       # 服务器内部错误
    SERVICE_UNAVAILABLE = "503000"  # 服务暂不可用
    DB_ERROR = "500001"             # 数据库错误
    CACHE_ERROR = "500002"          # 缓存错误
    EXTERNAL_API_ERROR = "500003"   # 外部 API 错误
    TIMEOUT = "504000"              # 超时

    # 9xxxxx 业务特定
    INSUFFICIENT_BALANCE = "900001" # 余额不足
    ORDER_NOT_FOUND = "900002"      # 订单不存在
    COURSE_NOT_PURCHASED = "900003" # 课程未购买


# HTTP 状态码映射 (用于 raise HTTPException 时使用)
HTTP_STATUS_MAP = {
    ErrorCode.SUCCESS: 200,
    ErrorCode.BAD_REQUEST: 400,
    ErrorCode.PARAM_MISSING: 400,
    ErrorCode.PARAM_INVALID: 400,
    ErrorCode.UNAUTHORIZED: 401,
    ErrorCode.TOKEN_EXPIRED: 401,
    ErrorCode.TOKEN_INVALID: 401,
    ErrorCode.TOKEN_REVOKED: 401,
    ErrorCode.REFRESH_REPLAY: 401,
    ErrorCode.FORBIDDEN: 403,
    ErrorCode.PERMISSION_DENIED: 403,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.METHOD_NOT_ALLOWED: 405,
    ErrorCode.CONFLICT: 409,
    ErrorCode.RATE_LIMIT: 429,
    ErrorCode.CAPTCHA_INVALID: 400,
    ErrorCode.SMS_CODE_INVALID: 400,
    ErrorCode.PHONE_REGISTERED: 400,
    ErrorCode.PASSWORD_WEAK: 400,
    ErrorCode.EMAIL_CODE_INVALID: 400,
    ErrorCode.EMAIL_FORMAT_INVALID: 400,
    ErrorCode.EMAIL_NOT_CONFIGURED: 500,
    ErrorCode.INTERNAL_ERROR: 500,
    ErrorCode.SERVICE_UNAVAILABLE: 503,
    ErrorCode.DB_ERROR: 500,
    ErrorCode.CACHE_ERROR: 500,
    ErrorCode.EXTERNAL_API_ERROR: 502,
    ErrorCode.TIMEOUT: 504,
    ErrorCode.INSUFFICIENT_BALANCE: 402,
    ErrorCode.ORDER_NOT_FOUND: 404,
    ErrorCode.COURSE_NOT_PURCHASED: 403,
}


def http_status_for(code: ErrorCode | str) -> int:
    """根据业务错误码返回对应的 HTTP 状态码."""
    if isinstance(code, str):
        try:
            code = ErrorCode(code)
        except ValueError:
            # 未知错误码: 4xxx -> 4xx, 5xxx -> 5xx, 9xxx -> 400
            if code.startswith("4"):
                return 400
            if code.startswith("5"):
                return 500
            return 400
    return HTTP_STATUS_MAP.get(code, 500)
