package com.ihui.ai.sdk;

/**
 * 403 禁止访问异常 — API Key 权限不足。
 */
public class PermissionException extends SdkException {

    private static final long serialVersionUID = 1L;

    /**
     * 构造 PermissionException。
     *
     * @param status  HTTP 状态码(应为 403)
     * @param code    错误码
     * @param message 错误消息
     * @param details 错误详情
     */
    public PermissionException(int status, String code, String message, Object details) {
        super(status, code, message, details);
    }
}
