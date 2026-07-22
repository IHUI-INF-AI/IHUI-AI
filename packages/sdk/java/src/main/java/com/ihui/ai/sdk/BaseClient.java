package com.ihui.ai.sdk;

import com.fasterxml.jackson.databind.JsonNode;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * SDK 基础客户端 — 鉴权、重试、超时、错误处理。
 *
 * <p>封装:
 * <ul>
 *   <li>鉴权:自动注入 {@code Authorization: Bearer ${apiKey}},可选 {@code X-Api-Secret}</li>
 *   <li>重试:网络错误 + 5xx 自动重试(指数退避 500ms / 1000ms),429 不重试</li>
 *   <li>超时:默认 30s connect + 30s read,可配置;流式请求 read timeout 不生效</li>
 *   <li>错误处理:根据 HTTP 状态码自动抛对应子类异常</li>
 * </ul>
 *
 * <p>所有业务模块共享一个 BaseClient 实例。
 */
public class BaseClient {

    private static final Logger LOG = Logger.getLogger(BaseClient.class.getName());

    /** 重试退避延迟(毫秒),对应第 1 次 / 第 2 次重试。 */
    private static final long[] RETRY_DELAYS = {500L, 1000L};

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final String apiKey;
    private final String secret;
    private final String baseUrl;
    private final long timeoutMs;
    private final int maxRetries;
    private final OkHttpClient httpClient;
    private final OkHttpClient streamHttpClient;

    /**
     * 用 SdkConfig 构造 BaseClient。
     *
     * @param config SDK 配置
     */
    public BaseClient(SdkConfig config) {
        this.apiKey = config.getApiKey();
        this.secret = config.getSecret();
        this.baseUrl = config.getBaseUrl();
        this.timeoutMs = config.getTimeoutMs();
        this.maxRetries = config.getMaxRetries();

        Duration timeout = Duration.ofMillis(this.timeoutMs);
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(timeout)
                .readTimeout(timeout)
                .writeTimeout(timeout)
                .build();
        // 流式客户端:read timeout 设为 0(不超时)
        this.streamHttpClient = new OkHttpClient.Builder()
                .connectTimeout(timeout)
                .readTimeout(Duration.ZERO)
                .writeTimeout(timeout)
                .build();
    }

    /** @return 基础 URL(无尾部斜杠)。 */
    public String getBaseUrl() {
        return baseUrl;
    }

    /** @return API Key。 */
    public String getApiKey() {
        return apiKey;
    }

    // ------------------------------------------------------------------
    // 公开请求方法
    // ------------------------------------------------------------------

    /**
     * 发起 JSON 请求并解析响应为指定类型。
     *
     * <p>网络错误和 5xx 自动重试(指数退避 500ms / 1000ms),429 和 4xx 不重试。
     *
     * @param method HTTP 方法(GET/POST/PUT/DELETE)
     * @param path   路径(不含 /v1 前缀,如 /models)
     * @param body   请求体对象(将被 JSON 序列化);GET / DELETE 传 null
     * @param clazz  响应目标类型 Class
     * @param <T>    响应类型
     * @return 反序列化响应对象;空响应返回 null
     * @throws SdkException 请求失败
     */
    public <T> T request(String method, String path, Object body, Class<T> clazz) {
        String raw = requestRaw(method, path, body);
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        return JsonUtil.fromJson(raw, clazz);
    }

    /**
     * 发起 JSON 请求,返回原始响应字符串。
     *
     * @param method HTTP 方法
     * @param path   路径
     * @param body   请求体对象;无请求体传 null
     * @return 响应字符串;空响应返回 null
     * @throws SdkException 请求失败
     */
    public String requestRaw(String method, String path, Object body) {
        SdkException lastError = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                long delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
                sleep(delay);
            }

            try {
                Request.Builder rb = new Request.Builder()
                        .url(buildUrl(path))
                        .headers(buildHeaders());

                RequestBody requestBody = null;
                if (body != null) {
                    String json = JsonUtil.toJson(body);
                    requestBody = RequestBody.create(json, JSON);
                }
                rb.method(method.toUpperCase(), requestBody);

                try (Response resp = httpClient.newCall(rb.build()).execute()) {
                    String text = resp.body() != null ? resp.body().string() : "";
                    if (resp.isSuccessful()) {
                        return text;
                    }
                    lastError = parseError(resp.code(), text);
                    // 429 和 4xx 不重试
                    if (resp.code() == 429 || resp.code() < 500) {
                        break;
                    }
                    // 5xx 继续重试
                }
            } catch (SdkException e) {
                lastError = e;
                break;
            } catch (IOException e) {
                lastError = new SdkException(0, "network_error",
                        "Network error: " + e.getMessage(), null);
                // 网络错误继续重试
            }
        }

        throw lastError != null ? lastError
                : new SdkException(500, "unknown_error", "Unknown error", null);
    }

    /**
     * 发起 multipart/form-data 上传请求。
     *
     * @param path        路径
     * @param requestBody OkHttp RequestBody(由调用方构造,如 MultipartBody)
     * @param clazz       响应目标类型
     * @param <T>         响应类型
     * @return 反序列化响应对象
     * @throws SdkException 请求失败
     */
    public <T> T requestMultipart(String path, RequestBody requestBody, Class<T> clazz) {
        SdkException lastError = null;
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                long delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
                sleep(delay);
            }
            try {
                Request.Builder rb = new Request.Builder()
                        .url(buildUrl(path))
                        .addHeader("Authorization", "Bearer " + apiKey);
                if (secret != null) {
                    rb.addHeader("X-Api-Secret", secret);
                }
                rb.post(requestBody);

                try (Response resp = httpClient.newCall(rb.build()).execute()) {
                    String text = resp.body() != null ? resp.body().string() : "";
                    if (resp.isSuccessful()) {
                        return text.isEmpty() ? null : JsonUtil.fromJson(text, clazz);
                    }
                    lastError = parseError(resp.code(), text);
                    if (resp.code() == 429 || resp.code() < 500) {
                        break;
                    }
                }
            } catch (SdkException e) {
                lastError = e;
                break;
            } catch (IOException e) {
                lastError = new SdkException(0, "network_error",
                        "Network error: " + e.getMessage(), null);
            }
        }
        throw lastError != null ? lastError
                : new SdkException(500, "unknown_error", "Unknown error", null);
    }

    /**
     * 发起流式请求,返回 StreamResponse(SSE 解析迭代器)。
     *
     * <p>流式请求不超时、不重试(无法安全回放流)。
     *
     * @param method HTTP 方法(通常为 POST)
     * @param path   路径
     * @param body   请求体对象;无请求体传 null
     * @return StreamResponse 实例(用 try-with-resources 关闭)
     * @throws SdkException 请求失败
     */
    public StreamResponse requestStream(String method, String path, Object body) {
        try {
            Request.Builder rb = new Request.Builder()
                    .url(buildUrl(path))
                    .headers(buildHeaders());

            RequestBody requestBody = null;
            if (body != null) {
                String json = JsonUtil.toJson(body);
                requestBody = RequestBody.create(json, JSON);
            }
            rb.method(method.toUpperCase(), requestBody);

            Response response = streamHttpClient.newCall(rb.build()).execute();
            if (!response.isSuccessful()) {
                String text = response.body() != null ? response.body().string() : "";
                SdkException err = parseError(response.code(), text);
                response.close();
                throw err;
            }
            ResponseBody responseBody = response.body();
            if (responseBody == null) {
                response.close();
                throw new SdkException(500, "no_stream_body", "Response body is null", null);
            }
            return new StreamResponse(response);
        } catch (SdkException e) {
            throw e;
        } catch (IOException e) {
            throw new SdkException(0, "network_error",
                    "Network error: " + e.getMessage(), null);
        }
    }

    /**
     * 发起二进制下载请求,返回原始字节数组。
     *
     * @param path 路径
     * @return 字节数组
     * @throws SdkException 请求失败
     */
    public byte[] requestBytes(String path) {
        try {
            Request request = new Request.Builder()
                    .url(buildUrl(path))
                    .headers(buildHeaders())
                    .get()
                    .build();
            try (Response resp = httpClient.newCall(request).execute()) {
                if (!resp.isSuccessful()) {
                    String text = resp.body() != null ? resp.body().string() : "";
                    throw parseError(resp.code(), text);
                }
                return resp.body() != null ? resp.body().bytes() : new byte[0];
            }
        } catch (SdkException e) {
            throw e;
        } catch (IOException e) {
            throw new SdkException(0, "network_error",
                    "Network error: " + e.getMessage(), null);
        }
    }

    // ------------------------------------------------------------------
    // 内部工具
    // ------------------------------------------------------------------

    private okhttp3.Headers buildHeaders() {
        okhttp3.Headers.Builder hb = new okhttp3.Headers.Builder()
                .add("Authorization", "Bearer " + apiKey)
                .add("Content-Type", "application/json");
        if (secret != null) {
            hb.add("X-Api-Secret", secret);
        }
        return hb.build();
    }

    private String buildUrl(String path) {
        String p = path.startsWith("/") ? path : "/" + path;
        return baseUrl + "/v1" + p;
    }

    private SdkException parseError(int status, String body) {
        String code = "http_" + status;
        String message = "HTTP " + status;
        Object details = null;

        if (body != null && !body.isEmpty()) {
            try {
                JsonNode root = JsonUtil.MAPPER.readTree(body);
                if (root != null && root.isObject()) {
                    JsonNode err = root.path("error");
                    JsonNode codeNode = !err.isMissingNode() && err.isObject()
                            ? err.path("code") : root.path("code");
                    if (!codeNode.isMissingNode() && codeNode.isTextual()) {
                        code = codeNode.asText();
                    }
                    JsonNode msgNode = !err.isMissingNode() && err.isObject()
                            ? err.path("message") : root.path("message");
                    if (!msgNode.isMissingNode() && msgNode.isTextual()) {
                        message = msgNode.asText();
                    }
                    JsonNode detNode = !err.isMissingNode() && err.isObject()
                            ? err.path("details") : root.path("details");
                    if (!detNode.isMissingNode()) {
                        details = JsonUtil.toMap(detNode);
                    }
                }
            } catch (IOException e) {
                LOG.log(Level.FINE, "Failed to parse error body", e);
            }
        }

        return SdkException.fromStatus(status, code, message, details);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * 对路径段进行 URL 编码。
     *
     * @param segment 路径段
     * @return 编码后的字符串
     */
    public static String encode(String segment) {
        return URLEncoder.encode(segment, StandardCharsets.UTF_8);
    }

    /**
     * 将 Map 作为查询参数附加到 path 之后。
     *
     * @param path 路径
     * @param params 查询参数
     * @return 拼接后的路径
     */
    public static String withQuery(String path, Map<String, ?> params) {
        if (params == null || params.isEmpty()) {
            return path;
        }
        StringBuilder sb = new StringBuilder(path);
        sb.append(path.contains("?") ? "&" : "?");
        boolean first = true;
        for (Map.Entry<String, ?> e : params.entrySet()) {
            if (e.getValue() == null) {
                continue;
            }
            if (!first) {
                sb.append("&");
            }
            first = false;
            sb.append(URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8))
                    .append("=")
                    .append(URLEncoder.encode(String.valueOf(e.getValue()),
                            StandardCharsets.UTF_8));
        }
        return sb.toString();
    }

    /**
     * 读取响应体的 BufferedReader(用于流式行解析,内部使用)。
     *
     * @param response OkHttp Response(必须已 successful)
     * @return BufferedReader
     * @throws IOException 读取失败
     */
    static BufferedReader newReader(Response response) throws IOException {
        ResponseBody body = response.body();
        if (body == null) {
            throw new IOException("Response body is null");
        }
        return new BufferedReader(new InputStreamReader(body.byteStream(),
                StandardCharsets.UTF_8));
    }
}
