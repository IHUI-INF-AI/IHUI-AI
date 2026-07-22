package com.ihui.ai.sdk;

/**
 * 5xx 服务端错误异常。
 */
public class ServerException extends SdkException {

    private static final long serialVersionUID = 1L;

    /**
     * 构造 ServerException。
     *
     * @param status  HTTP 状态码(应为 5xx)
     * @param code    错误码
     * @param message 错误消息
     * @param details 错误详情
     */
    public ServerException(int status, String code, String message, Object details) {
        super(status, code, message, details);
    }
}
