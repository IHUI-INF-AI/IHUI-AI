package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;

import java.util.Map;

/**
 * 3D 模型生成模块。
 *
 * <p>端点(1 个):
 * <ul>
 *   <li>POST /v1/3d/generations</li>
 * </ul>
 */
public final class ThreeDApi {

    private final BaseClient client;

    /**
     * 构造 ThreeDApi。
     *
     * @param client 底层 BaseClient
     */
    public ThreeDApi(BaseClient client) {
        this.client = client;
    }

    /**
     * POST /v1/3d/generations(3D 模型生成)。
     *
     * @param req 请求体(prompt / model / format 等)
     * @return 生成结果(JsonNode,含 modelUrl / taskId)
     */
    public JsonNode generations(Map<String, Object> req) {
        return client.request("POST", "/3d/generations", req, JsonNode.class);
    }
}
