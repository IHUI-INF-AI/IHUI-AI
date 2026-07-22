package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;

import java.util.Map;

/**
 * 消息模块 — 发布 / 订阅 / 取消订阅 / 状态查询。
 *
 * <p>端点(4 个):
 * <ul>
 *   <li>POST   /v1/messages(发布消息)</li>
 *   <li>POST   /v1/messages/subscribe(订阅频道)</li>
 *   <li>DELETE /v1/messages/subscribe/:id(取消订阅)</li>
 *   <li>GET    /v1/messages/:id/status(消息状态)</li>
 * </ul>
 */
public final class MessagesApi {

    private final BaseClient client;

    /**
     * 构造 MessagesApi。
     *
     * @param client 底层 BaseClient
     */
    public MessagesApi(BaseClient client) {
        this.client = client;
    }

    /**
     * POST /v1/messages(发布消息)。
     *
     * @param req 请求体(channel / content 等)
     * @return 发布结果(JsonNode,含 messageId)
     */
    public JsonNode publish(Map<String, Object> req) {
        return client.request("POST", "/messages", req, JsonNode.class);
    }

    /**
     * POST /v1/messages/subscribe(订阅频道)。
     *
     * @param req 请求体(channel / webhook 等)
     * @return 订阅结果(JsonNode,含 subscriptionId)
     */
    public JsonNode subscribe(Map<String, Object> req) {
        return client.request("POST", "/messages/subscribe", req, JsonNode.class);
    }

    /**
     * DELETE /v1/messages/subscribe/:id(取消订阅)。
     *
     * @param subscriptionId 订阅 ID
     * @return 取消结果(JsonNode,含 subscriptionId / status)
     */
    public JsonNode unsubscribe(String subscriptionId) {
        return client.request("DELETE",
                "/messages/subscribe/" + BaseClient.encode(subscriptionId),
                null, JsonNode.class);
    }

    /**
     * GET /v1/messages/:id/status(消息状态)。
     *
     * @param messageId 消息 ID
     * @return 消息状态(JsonNode)
     */
    public JsonNode getStatus(String messageId) {
        return client.request("GET", "/messages/" + BaseClient.encode(messageId) + "/status",
                null, JsonNode.class);
    }
}
