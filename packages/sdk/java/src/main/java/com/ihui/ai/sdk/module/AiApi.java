package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.StreamResponse;
import com.ihui.ai.sdk.model.ChatCompletionRequest;
import com.ihui.ai.sdk.model.ChatCompletionResponse;
import com.ihui.ai.sdk.model.EmbeddingsRequest;
import com.ihui.ai.sdk.model.EmbeddingsResponse;
import com.ihui.ai.sdk.model.ModelsResponse;

import java.util.Map;

/**
 * AI 核心模块 — chat / embeddings / vision / moa / models / userModels。
 *
 * <p>端点(13 个):
 * <ul>
 *   <li>POST /v1/chat/completions(非流式 + 流式)</li>
 *   <li>POST /v1/embeddings</li>
 *   <li>POST /v1/chat/vision</li>
 *   <li>POST /v1/chat/moa</li>
 *   <li>GET  /v1/models</li>
 *   <li>GET  /v1/models/:id</li>
 *   <li>GET  /v1/vendors/:vendor/models</li>
 *   <li>GET  /v1/moa-presets</li>
 *   <li>POST /v1/moa-presets</li>
 *   <li>GET/POST/PUT/DELETE /v1/user/models</li>
 * </ul>
 */
public final class AiApi {

    private final BaseClient client;

    /**
     * 构造 AiApi。
     *
     * @param client 底层 BaseClient
     */
    public AiApi(BaseClient client) {
        this.client = client;
    }

    /**
     * POST /v1/chat/completions(非流式)。
     *
     * @param req Chat 请求
     * @return Chat 响应
     */
    public ChatCompletionResponse completions(ChatCompletionRequest req) {
        return client.request("POST", "/chat/completions", req, ChatCompletionResponse.class);
    }

    /**
     * POST /v1/chat/completions(stream:true)→ SSE 流式响应。
     *
     * <p>用法:
     * <pre>
     * try (StreamResponse stream = client.ai.completionsStream(req)) {
     *     while (stream.hasNext()) {
     *         JsonNode chunk = stream.next();
     *         String delta = chunk.path("choices").path(0).path("delta").path("content").asText("");
     *         System.out.print(delta);
     *     }
     * }
     * </pre>
     *
     * @param req Chat 请求(stream 字段会被自动设为 true)
     * @return StreamResponse(必须用 try-with-resources 关闭)
     */
    public StreamResponse completionsStream(ChatCompletionRequest req) {
        req.setStream(true);
        return client.requestStream("POST", "/chat/completions", req);
    }

    /**
     * POST /v1/embeddings。
     *
     * @param req Embeddings 请求
     * @return Embeddings 响应
     */
    public EmbeddingsResponse embeddings(EmbeddingsRequest req) {
        return client.request("POST", "/embeddings", req, EmbeddingsResponse.class);
    }

    /**
     * POST /v1/chat/vision(视觉理解)。
     *
     * @param req 请求体(model / messages / image 等)
     * @return 响应(JsonNode)
     */
    public JsonNode chatVision(Map<String, Object> req) {
        return client.request("POST", "/chat/vision", req, JsonNode.class);
    }

    /**
     * POST /v1/chat/moa(Mixture of Agents)。
     *
     * @param req 请求体
     * @return 响应(JsonNode)
     */
    public JsonNode chatMoa(Map<String, Object> req) {
        return client.request("POST", "/chat/moa", req, JsonNode.class);
    }

    /**
     * GET /v1/models(模型列表)。
     *
     * @return 模型列表响应
     */
    public ModelsResponse listModels() {
        return client.request("GET", "/models", null, ModelsResponse.class);
    }

    /**
     * GET /v1/models/:id(模型详情)。
     *
     * @param id 模型 ID
     * @return 模型详情(JsonNode)
     */
    public JsonNode getModel(String id) {
        return client.request("GET", "/models/" + BaseClient.encode(id), null, JsonNode.class);
    }

    /**
     * GET /v1/vendors/:vendor/models(厂商模型列表)。
     *
     * @param vendor 厂商标识
     * @return 厂商模型列表(JsonNode)
     */
    public JsonNode listVendorModels(String vendor) {
        return client.request("GET", "/vendors/" + BaseClient.encode(vendor) + "/models",
                null, JsonNode.class);
    }

    /**
     * GET /v1/moa-presets(MoA 预设列表)。
     *
     * @return MoA 预设列表(JsonNode)
     */
    public JsonNode listMoaPresets() {
        return client.request("GET", "/moa-presets", null, JsonNode.class);
    }

    /**
     * POST /v1/moa-presets(创建 MoA 预设)。
     *
     * @param req 请求体
     * @return 创建结果(JsonNode)
     */
    public JsonNode createMoaPreset(Map<String, Object> req) {
        return client.request("POST", "/moa-presets", req, JsonNode.class);
    }

    /**
     * GET /v1/user/models(用户自定义模型列表)。
     *
     * @return 用户模型列表(JsonNode)
     */
    public JsonNode listUserModels() {
        return client.request("GET", "/user/models", null, JsonNode.class);
    }

    /**
     * POST /v1/user/models(创建用户自定义模型)。
     *
     * @param req 请求体
     * @return 创建结果(JsonNode)
     */
    public JsonNode createUserModel(Map<String, Object> req) {
        return client.request("POST", "/user/models", req, JsonNode.class);
    }

    /**
     * PUT /v1/user/models/:id(更新用户自定义模型)。
     *
     * @param id  模型 ID
     * @param req 请求体
     * @return 更新结果(JsonNode)
     */
    public JsonNode updateUserModel(String id, Map<String, Object> req) {
        return client.request("PUT", "/user/models/" + BaseClient.encode(id), req, JsonNode.class);
    }

    /**
     * DELETE /v1/user/models/:id(删除用户自定义模型)。
     *
     * @param id 模型 ID
     */
    public void deleteUserModel(String id) {
        client.requestRaw("DELETE", "/user/models/" + BaseClient.encode(id), null);
    }
}
