package com.ihui.ai.sdk;

/**
 * 401 未授权异常 — API Key 无效或缺失。
 */
public class AuthenticationException extends SdkException {

    private static final long serialVersionUID = 1L;

    /**
     * 构造 AuthenticationException。
     *
     * @param status  HTTP 状态码(应为 401)
     * @param code    错误码
     * @param message 错误消息
     * @param details 错误详情
     */
    public AuthenticationException(int status, String code, String message, Object details) {
        super(status, code, message, details);
    }
}
