package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.VideoGenerationsRequest;

import java.util.Map;

/**
 * 视频模块 — 生成 / 任务查询 / 编排。
 *
 * <p>端点(3 个):
 * <ul>
 *   <li>POST /v1/videos/generations</li>
 *   <li>GET  /v1/videos/tasks/:id</li>
 *   <li>POST /v1/videos/compose</li>
 * </ul>
 */
public final class VideosApi {

    private final BaseClient client;

    /**
     * 构造 VideosApi。
     *
     * @param client 底层 BaseClient
     */
    public VideosApi(BaseClient client) {
        this.client = client;
    }

    /**
     * POST /v1/videos/generations(视频生成,异步任务)。
     *
     * @param req 视频生成请求
     * @return 生成任务(JsonNode,含 taskId / status)
     */
    public JsonNode generations(VideoGenerationsRequest req) {
        return client.request("POST", "/videos/generations", req, JsonNode.class);
    }

    /**
     * GET /v1/videos/tasks/:id(查询视频任务状态)。
     *
     * @param taskId 任务 ID
     * @return 任务状态(JsonNode)
     */
    public JsonNode getTask(String taskId) {
        return client.request("GET", "/videos/tasks/" + BaseClient.encode(taskId),
                null, JsonNode.class);
    }

    /**
     * POST /v1/videos/compose(视频编排)。
     *
     * @param req 编排请求(clips / transitions 等)
     * @return 编排结果(JsonNode)
     */
    public JsonNode compose(Map<String, Object> req) {
        return client.request("POST", "/videos/compose", req, JsonNode.class);
    }
}
