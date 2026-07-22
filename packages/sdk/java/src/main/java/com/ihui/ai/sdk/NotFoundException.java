package com.ihui.ai.sdk;

/**
 * 404 资源不存在异常。
 */
public class NotFoundException extends SdkException {

    private static final long serialVersionUID = 1L;

    /**
     * 构造 NotFoundException。
     *
     * @param status  HTTP 状态码(应为 404)
     * @param code    错误码
     * @param message 错误消息
     * @param details 错误详情
     */
    public NotFoundException(int status, String code, String message, Object details) {
        super(status, code, message, details);
    }
}
