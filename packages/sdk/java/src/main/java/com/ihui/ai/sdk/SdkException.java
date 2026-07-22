package com.ihui.ai.sdk;

/**
 * SDK 异常基类,携带 HTTP 状态码 + 错误码 + 详情。
 *
 * <p>异常层级:
 * <pre>
 * SdkException                // 基类
 * ├── AuthenticationException // 401 未授权
 * ├── PermissionException     // 403 禁止访问
 * ├── NotFoundException       // 404 资源不存在
 * ├── QuotaExceededException  // 429 配额超限
 * └── ServerException         // 5xx 服务端错误
 * </pre>
 */
public class SdkException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** HTTP 状态码(网络错误为 0)。 */
    private final int status;

    /** 错误码字符串(如 auth_invalid_api_key),可能为 null。 */
    private final String code;

    /** 错误详情(来自响应体),可能为 null。 */
    private final transient Object details;

    /**
     * 构造 SDK 异常。
     *
     * @param status  HTTP 状态码
     * @param code    错误码
     * @param message 错误消息
     * @param details 错误详情
     */
    public SdkException(int status, String code, String message, Object details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    /**
     * 构造 SDK 异常(无详情)。
     *
     * @param status  HTTP 状态码
     * @param code    错误码
     * @param message 错误消息
     */
    public SdkException(int status, String code, String message) {
        this(status, code, message, null);
    }

    /** @return HTTP 状态码(网络错误为 0)。 */
    public int getStatus() {
        return status;
    }

    /** @return 错误码字符串,可能为 null。 */
    public String getCode() {
        return code;
    }

    /** @return 错误详情,可能为 null。 */
    public Object getDetails() {
        return details;
    }

    @Override
    public String toString() {
        return getClass().getSimpleName() + "{status=" + status
                + ", code='" + code + '\''
                + ", message='" + getMessage() + "'}";
    }

    /**
     * 根据 HTTP 状态码构造对应子类异常。
     *
     * @param status  HTTP 状态码
     * @param code    错误码
     * @param message 错误消息
     * @param details 错误详情
     * @return 对应的 SdkException 子类实例
     */
    public static SdkException fromStatus(int status, String code, String message, Object details) {
        if (status == 401) {
            return new AuthenticationException(status, code, message, details);
        }
        if (status == 403) {
            return new PermissionException(status, code, message, details);
        }
        if (status == 404) {
            return new NotFoundException(status, code, message, details);
        }
        if (status == 429) {
            return new QuotaExceededException(status, code, message, details);
        }
        if (status >= 500) {
            return new ServerException(status, code, message, details);
        }
        return new SdkException(status, code, message, details);
    }
}
