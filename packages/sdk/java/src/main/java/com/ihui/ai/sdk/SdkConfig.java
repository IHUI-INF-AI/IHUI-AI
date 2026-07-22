package com.ihui.ai.sdk;

import java.time.Duration;
import java.util.Objects;

/**
 * SDK 配置(不可变,builder 模式构建)。
 *
 * <p>配置项:
 * <ul>
 *   <li>{@code apiKey} — 必需,API Key(格式 ihui_xxx)</li>
 *   <li>{@code secret} — 可选,API Secret(创建/轮换时返回)</li>
 *   <li>{@code baseUrl} — 基础 URL,默认 http://localhost:8802</li>
 *   <li>{@code timeout} — 请求超时,默认 30s;流式请求不超时</li>
 *   <li>{@code maxRetries} — 最大重试次数,默认 2;网络错误和 5xx 自动重试,429 不重试</li>
 * </ul>
 */
public final class SdkConfig {

    /** 默认基础 URL。 */
    public static final String DEFAULT_BASE_URL = "http://localhost:8802";

    /** 默认超时(毫秒)。 */
    public static final long DEFAULT_TIMEOUT_MS = 30_000L;

    /** 默认最大重试次数。 */
    public static final int DEFAULT_MAX_RETRIES = 2;

    private final String apiKey;
    private final String secret;
    private final String baseUrl;
    private final long timeoutMs;
    private final int maxRetries;

    private SdkConfig(Builder b) {
        this.apiKey = Objects.requireNonNull(b.apiKey, "apiKey is required");
        this.secret = b.secret;
        this.baseUrl = normalizeBaseUrl(b.baseUrl == null ? DEFAULT_BASE_URL : b.baseUrl);
        this.timeoutMs = b.timeoutMs == null ? DEFAULT_TIMEOUT_MS : b.timeoutMs;
        this.maxRetries = b.maxRetries == null ? DEFAULT_MAX_RETRIES : b.maxRetries;
    }

    private static String normalizeBaseUrl(String url) {
        return url.replaceAll("/+$", "");
    }

    /** @return API Key。 */
    public String getApiKey() {
        return apiKey;
    }

    /** @return API Secret,可能为 null。 */
    public String getSecret() {
        return secret;
    }

    /** @return 基础 URL(无尾部斜杠)。 */
    public String getBaseUrl() {
        return baseUrl;
    }

    /** @return 请求超时(毫秒)。 */
    public long getTimeoutMs() {
        return timeoutMs;
    }

    /** @return 最大重试次数。 */
    public int getMaxRetries() {
        return maxRetries;
    }

    /**
     * 创建 Builder。
     *
     * @return 新的 Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /** SDK 配置 builder。 */
    public static final class Builder {

        private String apiKey;
        private String secret;
        private String baseUrl;
        private Long timeoutMs;
        private Integer maxRetries;

        private Builder() {
        }

        /**
         * 设置 API Key(必需)。
         *
         * @param apiKey API Key(格式 ihui_xxx)
         * @return 当前 builder
         */
        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        /**
         * 设置 API Secret(可选)。
         *
         * @param secret API Secret
         * @return 当前 builder
         */
        public Builder secret(String secret) {
            this.secret = secret;
            return this;
        }

        /**
         * 设置基础 URL。
         *
         * @param baseUrl 基础 URL(默认 http://localhost:8802)
         * @return 当前 builder
         */
        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        /**
         * 设置请求超时。
         *
         * @param timeout 超时时长(默认 30s)
         * @return 当前 builder
         */
        public Builder timeout(Duration timeout) {
            this.timeoutMs = timeout == null ? null : timeout.toMillis();
            return this;
        }

        /**
         * 设置请求超时(毫秒)。
         *
         * @param timeoutMs 超时毫秒(默认 30000)
         * @return 当前 builder
         */
        public Builder timeoutMillis(long timeoutMs) {
            this.timeoutMs = timeoutMs;
            return this;
        }

        /**
         * 设置最大重试次数。
         *
         * @param maxRetries 最大重试次数(默认 2)
         * @return 当前 builder
         */
        public Builder maxRetries(int maxRetries) {
            this.maxRetries = maxRetries;
            return this;
        }

        /**
         * 构建 SdkConfig。
         *
         * @return 不可变的 SdkConfig 实例
         */
        public SdkConfig build() {
            return new SdkConfig(this);
        }
    }
}
