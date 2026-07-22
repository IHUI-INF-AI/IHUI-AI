package com.ihui.ai.sdk;

/**
 * 429 配额超限异常 — 请求频率或 token 配额用尽。
 */
public class QuotaExceededException extends SdkException {

    private static final long serialVersionUID = 1L;

    /**
     * 构造 QuotaExceededException。
     *
     * @param status  HTTP 状态码(应为 429)
     * @param code    错误码
     * @param message 错误消息
     * @param details 错误详情
     */
    public QuotaExceededException(int status, String code, String message, Object details) {
        super(status, code, message, details);
    }
}
