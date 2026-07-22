package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.MemorySearchRequest;

import java.util.Map;

/**
 * 记忆模块 — 保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。
 *
 * <p>端点(8 个):
 * <ul>
 *   <li>POST   /v1/memory(保存记忆)</li>
 *   <li>GET    /v1/memory(召回记忆)</li>
 *   <li>POST   /v1/memory/search(语义搜索)</li>
 *   <li>POST   /v1/memory/dream(Dream 梦境系统)</li>
 *   <li>DELETE /v1/memory(遗忘记忆)</li>
 *   <li>GET    /v1/memory/working(工作记忆)</li>
 *   <li>GET    /v1/memory/episodic(情景记忆)</li>
 *   <li>GET    /v1/memory/procedural(程序记忆)</li>
 * </ul>
 */
public final class MemoryApi {

    private final BaseClient client;

    /**
     * 构造 MemoryApi。
     *
     * @param client 底层 BaseClient
     */
    public MemoryApi(BaseClient client) {
        this.client = client;
    }

    /**
     * POST /v1/memory(保存记忆)。
     *
     * @param req 请求体(content / type / metadata 等)
     * @return 保存结果(JsonNode,含 memoryId / status)
     */
    public JsonNode save(Map<String, Object> req) {
        return client.request("POST", "/memory", req, JsonNode.class);
    }

    /**
     * GET /v1/memory(召回记忆)。
     *
     * @return 记忆列表(JsonNode)
     */
    public JsonNode recall() {
        return client.request("GET", "/memory", null, JsonNode.class);
    }

    /**
     * POST /v1/memory/search(语义搜索)。
     *
     * @param req 搜索请求
     * @return 搜索结果(JsonNode)
     */
    public JsonNode search(MemorySearchRequest req) {
        return client.request("POST", "/memory/search", req, JsonNode.class);
    }

    /**
     * POST /v1/memory/dream(Dream 梦境系统)。
     *
     * @param req 请求体(可为空 Map)
     * @return Dream 结果(JsonNode)
     */
    public JsonNode dream(Map<String, Object> req) {
        return client.request("POST", "/memory/dream", req, JsonNode.class);
    }

    /**
     * DELETE /v1/memory(遗忘记忆)。
     *
     * @param req 请求体(memoryId)
     * @return 遗忘结果(JsonNode,含 memoryId / status)
     */
    public JsonNode forget(Map<String, Object> req) {
        return client.request("DELETE", "/memory", req, JsonNode.class);
    }

    /**
     * GET /v1/memory/working(工作记忆)。
     *
     * @return 工作记忆(JsonNode)
     */
    public JsonNode working() {
        return client.request("GET", "/memory/working", null, JsonNode.class);
    }

    /**
     * GET /v1/memory/episodic(情景记忆)。
     *
     * @return 情景记忆(JsonNode)
     */
    public JsonNode episodic() {
        return client.request("GET", "/memory/episodic", null, JsonNode.class);
    }

    /**
     * GET /v1/memory/procedural(程序记忆)。
     *
     * @return 程序记忆(JsonNode)
     */
    public JsonNode procedural() {
        return client.request("GET", "/memory/procedural", null, JsonNode.class);
    }
}
