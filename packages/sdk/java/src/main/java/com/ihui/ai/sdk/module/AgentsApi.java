package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.StreamResponse;
import com.ihui.ai.sdk.model.AgentExecuteRequest;
import com.ihui.ai.sdk.model.AgentExecuteResponse;

import java.util.Map;

/**
 * Agent 模块 — 列表 / 调用 / 高级执行 / Pipeline / 并行 / 任务分解。
 *
 * <p>端点(12 个):
 * <ul>
 *   <li>GET  /v1/agents</li>
 *   <li>GET  /v1/agents/:id</li>
 *   <li>POST /v1/agents/:id/call</li>
 *   <li>POST /v1/agents/execute(高级执行)</li>
 *   <li>POST /v1/agents/execute/stream(SSE 流式执行)</li>
 *   <li>GET  /v1/agents/tasks/:id/status</li>
 *   <li>POST /v1/agents/tasks/:id/cancel</li>
 *   <li>GET  /v1/agents/sessions</li>
 *   <li>DELETE /v1/agents/sessions/:id</li>
 *   <li>POST /v1/agents/pipeline</li>
 *   <li>POST /v1/agents/parallel</li>
 *   <li>POST /v1/agents/decompose</li>
 * </ul>
 */
public final class AgentsApi {

    private final BaseClient client;

    /**
     * 构造 AgentsApi。
     *
     * @param client 底层 BaseClient
     */
    public AgentsApi(BaseClient client) {
        this.client = client;
    }

    /**
     * GET /v1/agents(Agent 列表)。
     *
     * @return Agent 列表(JsonNode)
     */
    public JsonNode list() {
        return client.request("GET", "/agents", null, JsonNode.class);
    }

    /**
     * GET /v1/agents/:id(Agent 详情)。
     *
     * @param id Agent ID
     * @return Agent 详情(JsonNode)
     */
    public JsonNode get(String id) {
        return client.request("GET", "/agents/" + BaseClient.encode(id), null, JsonNode.class);
    }

    /**
     * POST /v1/agents/:id/call(调用 Agent)。
     *
     * @param id  Agent ID
     * @param req 请求体(input / context 等)
     * @return 调用结果(JsonNode)
     */
    public JsonNode call(String id, Map<String, Object> req) {
        return client.request("POST", "/agents/" + BaseClient.encode(id) + "/call",
                req, JsonNode.class);
    }

    /**
     * POST /v1/agents/execute(高级执行,支持 PermissionGuard)。
     *
     * @param req Agent 执行请求
     * @return Agent 执行响应
     */
    public AgentExecuteResponse execute(AgentExecuteRequest req) {
        return client.request("POST", "/agents/execute", req, AgentExecuteResponse.class);
    }

    /**
     * POST /v1/agents/execute/stream(SSE 流式执行)。
     *
     * <p>用法:
     * <pre>
     * try (StreamResponse stream = client.agents.executeStream(req)) {
     *     while (stream.hasNext()) {
     *         JsonNode event = stream.next();
     *         // 处理事件
     *     }
     * }
     * </pre>
     *
     * @param req Agent 执行请求
     * @return StreamResponse(必须用 try-with-resources 关闭)
     */
    public StreamResponse executeStream(AgentExecuteRequest req) {
        return client.requestStream("POST", "/agents/execute/stream", req);
    }

    /**
     * GET /v1/agents/tasks/:id/status(任务状态)。
     *
     * @param taskId 任务 ID
     * @return 任务状态(JsonNode)
     */
    public JsonNode getTaskStatus(String taskId) {
        return client.request("GET", "/agents/tasks/" + BaseClient.encode(taskId) + "/status",
                null, JsonNode.class);
    }

    /**
     * POST /v1/agents/tasks/:id/cancel(取消任务)。
     *
     * @param taskId 任务 ID
     */
    public void cancelTask(String taskId) {
        client.requestRaw("POST", "/agents/tasks/" + BaseClient.encode(taskId) + "/cancel", null);
    }

    /**
     * GET /v1/agents/sessions(会话列表)。
     *
     * @return 会话列表(JsonNode)
     */
    public JsonNode listSessions() {
        return client.request("GET", "/agents/sessions", null, JsonNode.class);
    }

    /**
     * DELETE /v1/agents/sessions/:id(删除会话)。
     *
     * @param id 会话 ID
     */
    public void deleteSession(String id) {
        client.requestRaw("DELETE", "/agents/sessions/" + BaseClient.encode(id), null);
    }

    /**
     * POST /v1/agents/pipeline(Pipeline 编排)。
     *
     * @param req 请求体
     * @return Pipeline 执行结果(JsonNode)
     */
    public JsonNode pipeline(Map<String, Object> req) {
        return client.request("POST", "/agents/pipeline", req, JsonNode.class);
    }

    /**
     * POST /v1/agents/parallel(并行执行)。
     *
     * @param req 请求体
     * @return 并行执行结果(JsonNode)
     */
    public JsonNode parallel(Map<String, Object> req) {
        return client.request("POST", "/agents/parallel", req, JsonNode.class);
    }

    /**
     * POST /v1/agents/decompose(任务分解)。
     *
     * @param req Agent 执行请求
     * @return 任务分解结果(JsonNode,含 taskId / subtasks)
     */
    public JsonNode decompose(AgentExecuteRequest req) {
        return client.request("POST", "/agents/decompose", req, JsonNode.class);
    }
}
