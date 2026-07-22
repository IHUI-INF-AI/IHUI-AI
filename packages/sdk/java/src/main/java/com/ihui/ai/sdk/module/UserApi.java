package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.UsageResponse;
import com.ihui.ai.sdk.model.WorkflowRequest;

/**
 * 用户 / 工作区 / 工作流 / 统计模块。
 *
 * <p>端点(9 个):
 * <ul>
 *   <li>GET  /v1/me(当前用户 + 配额)</li>
 *   <li>GET  /v1/projects(项目列表)</li>
 *   <li>GET  /v1/projects/:id/files(项目文件)</li>
 *   <li>GET  /v1/workflows/:id(工作流详情)</li>
 *   <li>POST /v1/workflows/instances(运行工作流)</li>
 *   <li>POST /v1/workflows/coze/run(Coze 工作流)</li>
 *   <li>POST /v1/workflows/n8n/run(n8n 工作流)</li>
 *   <li>GET  /v1/usage(用量统计)</li>
 *   <li>GET  /v1/usage/:vendor(厂商用量)</li>
 * </ul>
 */
public final class UserApi {

    private final BaseClient client;

    /**
     * 构造 UserApi。
     *
     * @param client 底层 BaseClient
     */
    public UserApi(BaseClient client) {
        this.client = client;
    }

    /**
     * GET /v1/me(当前用户信息 + 配额)。
     *
     * @return 用户信息(JsonNode)
     */
    public JsonNode me() {
        return client.request("GET", "/me", null, JsonNode.class);
    }

    /**
     * GET /v1/projects(项目列表)。
     *
     * @return 项目列表(JsonNode)
     */
    public JsonNode listProjects() {
        return client.request("GET", "/projects", null, JsonNode.class);
    }

    /**
     * GET /v1/projects/:id/files(项目文件列表)。
     *
     * @param projectId 项目 ID
     * @return 文件列表(JsonNode)
     */
    public JsonNode listProjectFiles(String projectId) {
        return client.request("GET", "/projects/" + BaseClient.encode(projectId) + "/files",
                null, JsonNode.class);
    }

    /**
     * GET /v1/workflows/:id(工作流详情)。
     *
     * @param id 工作流 ID
     * @return 工作流详情(JsonNode)
     */
    public JsonNode getWorkflow(String id) {
        return client.request("GET", "/workflows/" + BaseClient.encode(id),
                null, JsonNode.class);
    }

    /**
     * POST /v1/workflows/instances(运行工作流)。
     *
     * @param req 工作流运行请求
     * @return 运行结果(JsonNode)
     */
    public JsonNode runWorkflow(WorkflowRequest req) {
        return client.request("POST", "/workflows/instances", req, JsonNode.class);
    }

    /**
     * POST /v1/workflows/coze/run(Coze 工作流)。
     *
     * @param req 工作流运行请求
     * @return 运行结果(JsonNode,透传上游 Coze 响应)
     */
    public JsonNode runCozeWorkflow(WorkflowRequest req) {
        return client.request("POST", "/workflows/coze/run", req, JsonNode.class);
    }

    /**
     * POST /v1/workflows/n8n/run(n8n 工作流)。
     *
     * @param req 工作流运行请求
     * @return 运行结果(JsonNode,透传上游 n8n 响应)
     */
    public JsonNode runN8nWorkflow(WorkflowRequest req) {
        return client.request("POST", "/workflows/n8n/run", req, JsonNode.class);
    }

    /**
     * GET /v1/usage(用量统计)。
     *
     * @return 用量统计
     */
    public UsageResponse getUsage() {
        return client.request("GET", "/usage", null, UsageResponse.class);
    }

    /**
     * GET /v1/usage/:vendor(厂商用量)。
     *
     * @param vendor 厂商标识
     * @return 厂商用量(JsonNode)
     */
    public JsonNode getVendorUsage(String vendor) {
        return client.request("GET", "/usage/" + BaseClient.encode(vendor),
                null, JsonNode.class);
    }
}
