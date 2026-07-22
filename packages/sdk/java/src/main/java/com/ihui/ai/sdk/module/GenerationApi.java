package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;

import java.util.Map;

/**
 * 生成队列模块 — 入队 / 状态查询 / 取消。
 *
 * <p>端点(3 个):
 * <ul>
 *   <li>POST /v1/generation/enqueue</li>
 *   <li>GET  /v1/generation/status/:id</li>
 *   <li>POST /v1/generation/cancel/:id</li>
 * </ul>
 */
public final class GenerationApi {

    private final BaseClient client;

    /**
     * 构造 GenerationApi。
     *
     * @param client 底层 BaseClient
     */
    public GenerationApi(BaseClient client) {
        this.client = client;
    }

    /**
     * POST /v1/generation/enqueue(入队生成任务)。
     *
     * @param req 请求体(type / params 等)
     * @return 入队结果(JsonNode,含 jobId / status)
     */
    public JsonNode enqueue(Map<String, Object> req) {
        return client.request("POST", "/generation/enqueue", req, JsonNode.class);
    }

    /**
     * GET /v1/generation/status/:id(查询生成状态)。
     *
     * @param jobId 任务 ID
     * @return 任务状态(JsonNode)
     */
    public JsonNode getStatus(String jobId) {
        return client.request("GET", "/generation/status/" + BaseClient.encode(jobId),
                null, JsonNode.class);
    }

    /**
     * POST /v1/generation/cancel/:id(取消生成任务)。
     *
     * @param jobId 任务 ID
     * @return 取消结果(JsonNode,含 jobId / status)
     */
    public JsonNode cancel(String jobId) {
        return client.request("POST", "/generation/cancel/" + BaseClient.encode(jobId),
                null, JsonNode.class);
    }
}
