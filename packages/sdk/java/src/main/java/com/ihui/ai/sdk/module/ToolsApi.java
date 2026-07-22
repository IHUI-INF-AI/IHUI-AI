package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.ToolCallRequest;

import java.util.Map;

/**
 * MCP 工具 / 技能 / 人格 / 代码搜索 / 截图模块。
 *
 * <p>端点(16 个):
 * <ul>
 *   <li>GET  /v1/tools</li>
 *   <li>POST /v1/tools/call</li>
 *   <li>GET  /v1/resources</li>
 *   <li>GET  /v1/resources/:uri</li>
 *   <li>GET  /v1/prompts</li>
 *   <li>POST /v1/prompts/invoke</li>
 *   <li>GET  /v1/skills</li>
 *   <li>GET  /v1/slash-commands</li>
 *   <li>POST /v1/slash-commands</li>
 *   <li>POST /v1/sampling</li>
 *   <li>GET  /v1/personas</li>
 *   <li>GET  /v1/personas/:name</li>
 *   <li>POST /v1/tools/search-codebase</li>
 *   <li>POST /v1/tools/search-web</li>
 *   <li>POST /v1/tools/analyze-code</li>
 *   <li>POST /v1/screenshot</li>
 * </ul>
 */
public final class ToolsApi {

    private final BaseClient client;

    /**
     * 构造 ToolsApi。
     *
     * @param client 底层 BaseClient
     */
    public ToolsApi(BaseClient client) {
        this.client = client;
    }

    /**
     * GET /v1/tools(MCP 工具列表)。
     *
     * @return 工具列表(JsonNode)
     */
    public JsonNode list() {
        return client.request("GET", "/tools", null, JsonNode.class);
    }

    /**
     * POST /v1/tools/call(调用 MCP 工具)。
     *
     * @param req 工具调用请求
     * @return 调用结果(JsonNode)
     */
    public JsonNode call(ToolCallRequest req) {
        return client.request("POST", "/tools/call", req, JsonNode.class);
    }

    /**
     * GET /v1/resources(MCP 资源列表)。
     *
     * @return 资源列表(JsonNode)
     */
    public JsonNode listResources() {
        return client.request("GET", "/resources", null, JsonNode.class);
    }

    /**
     * GET /v1/resources/:uri(资源详情)。
     *
     * @param uri 资源 URI
     * @return 资源详情(JsonNode)
     */
    public JsonNode getResource(String uri) {
        return client.request("GET", "/resources/" + BaseClient.encode(uri),
                null, JsonNode.class);
    }

    /**
     * GET /v1/prompts(MCP 提示词列表)。
     *
     * @return 提示词列表(JsonNode)
     */
    public JsonNode listPrompts() {
        return client.request("GET", "/prompts", null, JsonNode.class);
    }

    /**
     * POST /v1/prompts/invoke(调用提示词)。
     *
     * @param req 请求体(name / arguments 等)
     * @return 调用结果(JsonNode)
     */
    public JsonNode invokePrompt(Map<String, Object> req) {
        return client.request("POST", "/prompts/invoke", req, JsonNode.class);
    }

    /**
     * GET /v1/skills(技能列表)。
     *
     * @return 技能列表(JsonNode)
     */
    public JsonNode listSkills() {
        return client.request("GET", "/skills", null, JsonNode.class);
    }

    /**
     * GET /v1/slash-commands(slash 命令列表)。
     *
     * @return 命令列表(JsonNode)
     */
    public JsonNode listSlashCommands() {
        return client.request("GET", "/slash-commands", null, JsonNode.class);
    }

    /**
     * POST /v1/slash-commands(调用 slash 命令)。
     *
     * @param req 请求体(command / args)
     * @return 调用结果(JsonNode)
     */
    public JsonNode invokeSlashCommand(Map<String, Object> req) {
        return client.request("POST", "/slash-commands", req, JsonNode.class);
    }

    /**
     * POST /v1/sampling(模型采样)。
     *
     * @param req 请求体(messages / model 等)
     * @return 采样结果(JsonNode)
     */
    public JsonNode sampling(Map<String, Object> req) {
        return client.request("POST", "/sampling", req, JsonNode.class);
    }

    /**
     * GET /v1/personas(人格列表)。
     *
     * @return 人格列表(JsonNode)
     */
    public JsonNode listPersonas() {
        return client.request("GET", "/personas", null, JsonNode.class);
    }

    /**
     * GET /v1/personas/:name(人格详情)。
     *
     * @param name 人格名称
     * @return 人格详情(JsonNode)
     */
    public JsonNode getPersona(String name) {
        return client.request("GET", "/personas/" + BaseClient.encode(name),
                null, JsonNode.class);
    }

    /**
     * POST /v1/tools/search-codebase(代码库搜索)。
     *
     * @param req 请求体(query / filePattern 等)
     * @return 搜索结果(JsonNode)
     */
    public JsonNode searchCodebase(Map<String, Object> req) {
        return client.request("POST", "/tools/search-codebase", req, JsonNode.class);
    }

    /**
     * POST /v1/tools/search-web(网页搜索)。
     *
     * @param req 请求体(query / count 等)
     * @return 搜索结果(JsonNode)
     */
    public JsonNode searchWeb(Map<String, Object> req) {
        return client.request("POST", "/tools/search-web", req, JsonNode.class);
    }

    /**
     * POST /v1/tools/analyze-code(代码分析)。
     *
     * @param req 请求体(code / language / analysis 等)
     * @return 分析结果(JsonNode)
     */
    public JsonNode analyzeCode(Map<String, Object> req) {
        return client.request("POST", "/tools/analyze-code", req, JsonNode.class);
    }

    /**
     * POST /v1/screenshot(网页截图)。
     *
     * @param req 请求体(url / width / height 等)
     * @return 截图结果(JsonNode,含 imageUrl)
     */
    public JsonNode screenshot(Map<String, Object> req) {
        return client.request("POST", "/screenshot", req, JsonNode.class);
    }
}
