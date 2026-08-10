package com.ihui.ai.sdk;

import com.fasterxml.jackson.databind.JsonNode;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * SDK 基础客户端 — 鉴权、重试、超时、错误处理。
 *
 * <p>封装：
 * <ul>
 *   <li>鉴权：自动注入 {@code Authorization: Bearer ${apiKey}}，可选 {@code X-Api-Secret}</li>
 *   <li>重试：网络错误 + 5xx 自动重试（指数退避 500ms / 1000ms），429 不重试</li>
 *   <li>超时：默认 30s connect + 30s read，可配置；流式请求 read timeout 不生效</li>
 *   <li>错误处理：根据 HTTP 状态码自动抛对应子类异常</li>
 * </ul>
 *
 * <p>所有业务模块共享一个 BaseClient 实例。
 */
public class BaseClient {

    private static final Logger LOG = Logger.getLogger(BaseClient.class.getName());

    /** 重试退避延迟（毫秒），对应第 1 次 / 第 2 次重试。 */
    private static final long[] RETRY_DELAYS = {500L, 1000L};

    private static final String CONTENT_TYPE_JSON = "application/json; charset=utf-8";

    private final String apiKey;
    private final String secret;
    private final String baseUrl;
    private final long timeoutMs;
    private final int maxRetries;
    private final HttpClient httpClient;
    private final HttpClient streamHttpClient;

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
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .build();
        // 流式客户端：read timeout 设为无限
        this.streamHttpClient = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .build();
    }

    /** @return 基础 URL（无尾部斜杠）。 */
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
     * @param method HTTP 方法（GET/POST/PUT/DELETE）
     * @param path   路径（不含 /v1 前缀，如 /models）
     * @param body   请求体对象（将被 JSON 序列化）；GET / DELETE 传 null
     * @param clazz  响应目标类型 Class
     * @param <T>    响应类型
     * @return 反序列化响应对象；空响应返回 null
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
     * 发起 JSON 请求，返回原始响应字符串。
     *
     * @param method HTTP 方法
     * @param path   路径
     * @param body   请求体对象；无请求体传 null
     * @return 响应字符串；空响应返回 null
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
                HttpRequest.Builder rb = HttpRequest.newBuilder()
                        .uri(URI.create(buildUrl(path)))
                        .timeout(Duration.ofMillis(timeoutMs))
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", CONTENT_TYPE_JSON);
                if (secret != null) {
                    rb.header("X-Api-Secret", secret);
                }

                String json = null;
                if (body != null) {
                    json = JsonUtil.toJson(body);
                }

                HttpRequest.BodyPublisher bodyPublisher = json != null
                        ? HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8)
                        : HttpRequest.BodyPublishers.noBody();
                rb.method(method.toUpperCase(), bodyPublisher);

                HttpResponse<String> resp = httpClient.send(rb.build(),
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                int statusCode = resp.statusCode();
                String text = resp.body();

                if (statusCode < 400) {
                    return text;
                }

                lastError = parseError(statusCode, text);
                // 429 和 4xx 不重试
                if (statusCode == 429 || statusCode < 500) {
                    break;
                }
                // 5xx 继续重试
            } catch (SdkException e) {
                lastError = e;
                break;
            } catch (IOException e) {
                lastError = new SdkException(0, "network_error",
                        "Network error: " + e.getMessage(), null);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                lastError = new SdkException(0, "interrupted",
                        "Request interrupted", null);
                break;
            }
        }

        throw lastError != null ? lastError
                : new SdkException(500, "unknown_error", "Unknown error", null);
    }

    /**
     * 发起 multipart/form-data 上传请求。
     *
     * @param path  路径
     * @param parts multipart 各字段（名称 -> 内容）
     * @param files multipart 文件字段（名称 -> (文件名, 字节数组)）
     * @param clazz 响应目标类型
     * @param <T>   响应类型
     * @return 反序列化响应对象
     * @throws SdkException 请求失败
     */
    public <T> T requestMultipart(String path, Map<String, String> parts,
                                  Map<String, FilePart> files, Class<T> clazz) {
        SdkException lastError = null;
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                long delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
                sleep(delay);
            }
            try {
                String boundary = extractBoundary();
                byte[] multipartBody = buildMultipartBody(parts, files, boundary);
                String contentType = "multipart/form-data; boundary=" + boundary;

                HttpRequest.Builder builder = HttpRequest.newBuilder()
                        .uri(URI.create(buildUrl(path)))
                        .timeout(Duration.ofMillis(timeoutMs))
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", contentType)
                        .method("POST", HttpRequest.BodyPublishers.ofByteArray(multipartBody));
                if (secret != null) {
                    builder.header("X-Api-Secret", secret);
                }
                HttpRequest request = builder.build();

                HttpResponse<String> resp = httpClient.send(request,
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                int statusCode = resp.statusCode();
                String text = resp.body();
                if (statusCode < 400) {
                    return text.isEmpty() ? null : JsonUtil.fromJson(text, clazz);
                }
                lastError = parseError(statusCode, text);
                if (statusCode == 429 || statusCode < 500) {
                    break;
                }
            } catch (SdkException e) {
                lastError = e;
                break;
            } catch (IOException e) {
                lastError = new SdkException(0, "network_error",
                        "Network error: " + e.getMessage(), null);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                lastError = new SdkException(0, "interrupted",
                        "Request interrupted", null);
                break;
            }
        }
        throw lastError != null ? lastError
                : new SdkException(500, "unknown_error", "Unknown error", null);
    }

    /**
     * 发起流式请求，返回 StreamResponse（SSE 解析迭代器）。
     *
     * <p>流式请求不超时、不重试（无法安全回放流）。
     *
     * @param method HTTP 方法（通常为 POST）
     * @param path   路径
     * @param body   请求体对象；无请求体传 null
     * @return StreamResponse 实例（用 try-with-resources 关闭）
     * @throws SdkException 请求失败
     */
    public StreamResponse requestStream(String method, String path, Object body) {
        try {
            HttpRequest.Builder rb = HttpRequest.newBuilder()
                    .uri(URI.create(buildUrl(path)))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", CONTENT_TYPE_JSON)
                    .header("Accept", "text/event-stream");
            if (secret != null) {
                rb.header("X-Api-Secret", secret);
            }

            HttpRequest.BodyPublisher bodyPublisher = HttpRequest.BodyPublishers.noBody();
            if (body != null) {
                String json = JsonUtil.toJson(body);
                bodyPublisher = HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8);
            }
            rb.method(method.toUpperCase(), bodyPublisher);

            HttpResponse<InputStream> response = streamHttpClient.send(rb.build(),
                    HttpResponse.BodyHandlers.ofInputStream());
            int statusCode = response.statusCode();
            if (statusCode >= 400) {
                String text;
                try (InputStream is = response.body()) {
                    text = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                }
                throw parseError(statusCode, text);
            }
            return new StreamResponse(response);
        } catch (SdkException e) {
            throw e;
        } catch (IOException e) {
            throw new SdkException(0, "network_error",
                    "Network error: " + e.getMessage(), null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SdkException(0, "interrupted",
                    "Request interrupted", null);
        }
    }

    /**
     * 发起二进制下载请求，返回原始字节数组。
     *
     * @param path 路径
     * @return 字节数组
     * @throws SdkException 请求失败
     */
    public byte[] requestBytes(String path) {
        try {
            HttpRequest.Builder rb = HttpRequest.newBuilder()
                    .uri(URI.create(buildUrl(path)))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("Authorization", "Bearer " + apiKey);
            if (secret != null) {
                rb.header("X-Api-Secret", secret);
            }
            rb.GET();

            HttpResponse<byte[]> resp = httpClient.send(rb.build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            int statusCode = resp.statusCode();
            if (statusCode >= 400) {
                String text = new String(resp.body(), StandardCharsets.UTF_8);
                throw parseError(statusCode, text);
            }
            return resp.body();
        } catch (SdkException e) {
            throw e;
        } catch (IOException e) {
            throw new SdkException(0, "network_error",
                    "Network error: " + e.getMessage(), null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SdkException(0, "interrupted",
                    "Request interrupted", null);
        }
    }

    // ------------------------------------------------------------------
    // 内部工具
    // ------------------------------------------------------------------

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
     * @param path   路径
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
     * 读取响应体的 InputStream（用于流式行解析）。
     *
     * @param response HttpResponse（必须已 successful）
     * @return InputStream
     */
    static InputStream getInputStream(HttpResponse<InputStream> response) {
        return response.body();
    }

    // ------------------------------------------------------------------
    // Multipart 工具
    // ------------------------------------------------------------------

    /** 文件分片信息。 */
    public static final class FilePart {
        private final String filename;
        private final byte[] data;
        private final String mimeType;

        /**
         * 构造 FilePart。
         *
         * @param filename 文件名
         * @param data     文件字节
         * @param mimeType MIME 类型，为 null 则使用 application/octet-stream
         */
        public FilePart(String filename, byte[] data, String mimeType) {
            this.filename = filename;
            this.data = data;
            this.mimeType = mimeType != null ? mimeType : "application/octet-stream";
        }

        /** @return 文件名。 */
        public String getFilename() {
            return filename;
        }

        /** @return 文件字节。 */
        public byte[] getData() {
            return data;
        }

        /** @return MIME 类型。 */
        public String getMimeType() {
            return mimeType;
        }
    }

    private static String extractBoundary() {
        return "----IhuiSdkJava" + UUID.randomUUID().toString().replace("-", "");
    }

    private static byte[] buildMultipartBody(Map<String, String> parts, Map<String, FilePart> files,
                                              String boundary) throws IOException {
        ByteArrayOutputStream os = new ByteArrayOutputStream();
        byte[] boundaryBytes = ("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] endBoundaryBytes = ("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);

        if (parts != null) {
            for (Map.Entry<String, String> entry : parts.entrySet()) {
                os.write(boundaryBytes);
                writePart(os, entry.getKey(), entry.getValue());
            }
        }

        if (files != null) {
            for (Map.Entry<String, FilePart> entry : files.entrySet()) {
                os.write(boundaryBytes);
                writeFilePart(os, entry.getKey(), entry.getValue());
            }
        }

        os.write(endBoundaryBytes);
        return os.toByteArray();
    }

    private static void writePart(ByteArrayOutputStream os, String name, String value)
            throws IOException {
        byte[] header = ("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n")
                .getBytes(StandardCharsets.UTF_8);
        os.write(header);
        os.write(value.getBytes(StandardCharsets.UTF_8));
        os.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private static void writeFilePart(ByteArrayOutputStream os, String name, FilePart file)
            throws IOException {
        byte[] header = ("Content-Disposition: form-data; name=\"" + name
                + "\"; filename=\"" + file.getFilename() + "\"\r\n"
                + "Content-Type: " + file.getMimeType() + "\r\n\r\n")
                .getBytes(StandardCharsets.UTF_8);
        os.write(header);
        os.write(file.getData());
        os.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }
}