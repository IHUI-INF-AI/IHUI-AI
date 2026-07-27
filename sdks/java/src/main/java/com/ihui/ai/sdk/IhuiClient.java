package com.ihui.ai.sdk;

// IHUI-AI Java SDK(骨架,后续真发布时填实现)
// OpenAI 兼容:POST /api/chat/completions + GET /api/models
// 使用 JDK 17+ 内置 java.net.http.HttpClient + Jackson(JSON)

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/** HTTP 4xx/5xx 异常,含 statusCode 与 body。 */
public class IhuiException extends RuntimeException {
    private final int statusCode;
    private final String body;

    public IhuiException(int statusCode, String body) {
        super("IHUI API 错误 [" + statusCode + "]: " + body);
        this.statusCode = statusCode;
        this.body = body;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getBody() {
        return body;
    }
}

/** 单条对话消息。 */
record Message(String role, String content) {}

/** 对话补全请求(OpenAI 兼容)。 */
record ChatCompletionRequest(
        String model,
        List<Message> messages,
        Double temperature,
        Integer maxTokens,
        Boolean stream) {}

/** 对话补全响应。 */
record ChatCompletionResponse(
        String id,
        String object,
        long created,
        String model,
        List<Choice> choices,
        Usage usage) {
    record Choice(int index, Message message, String finishReason) {}
    record Usage(int promptTokens, int completionTokens, int totalTokens) {}
}

/** 单个模型信息。 */
record ModelInfo(String id, String object, long created, String ownedBy) {}

/** 模型列表响应。 */
record ModelsListResponse(String object, List<ModelInfo> data) {}

/**
 * IHUI-AI 客户端,内部封装 HttpClient,统一加 Authorization + 错误抛出。
 * 用法:IhuiClient client = new IhuiClient("https://api.ihui.ai", "your-api-key");
 */
public class IhuiClient {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);

    private final String apiBase;
    private final String apiKey;
    private final HttpClient http;

    public IhuiClient(String apiBase, String apiKey) {
        this.apiBase = apiBase.endsWith("/") ? apiBase.substring(0, apiBase.length() - 1) : apiBase;
        this.apiKey = apiKey;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /** 统一请求封装:4xx/5xx 抛 IhuiException。 */
    private String request(String path, String method, Object body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(apiBase + path))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey);
        if (body != null) {
            String json = MAPPER.writeValueAsString(body);
            builder.method(method, HttpRequest.BodyPublishers.ofString(json));
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }
        HttpResponse<String> resp = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() >= 400) {
            throw new IhuiException(resp.statusCode(), resp.body());
        }
        return resp.body();
    }

    /** POST /api/chat/completions — 创建对话补全(OpenAI 兼容)。 */
    public ChatCompletionResponse chatCompletionsCreate(ChatCompletionRequest body) throws Exception {
        String json = request("/api/chat/completions", "POST", body);
        return MAPPER.readValue(json, ChatCompletionResponse.class);
    }

    /** GET /api/models — 模型列表。 */
    public ModelsListResponse modelsList() throws Exception {
        String json = request("/api/models", "GET", null);
        return MAPPER.readValue(json, ModelsListResponse.class);
    }
}
