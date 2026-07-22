package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.KnowledgeSearchRequest;

import java.util.List;
import java.util.Map;

/**
 * 知识库 / RAG / 知识图谱模块。
 *
 * <p>端点(13 个):
 * <ul>
 *   <li>GET    /v1/knowledge/health</li>
 *   <li>GET    /v1/knowledge/documents</li>
 *   <li>POST   /v1/knowledge/documents</li>
 *   <li>GET    /v1/knowledge/documents/:id</li>
 *   <li>GET    /v1/knowledge/documents/:id/chunks</li>
 *   <li>DELETE /v1/knowledge/documents/:id</li>
 *   <li>POST   /v1/knowledge/search</li>
 *   <li>POST   /v1/knowledge/rag-context</li>
 *   <li>POST   /v1/knowledge-graph/extract</li>
 *   <li>POST   /v1/knowledge-graph/build</li>
 *   <li>GET    /v1/knowledge-graph/data</li>
 *   <li>DELETE /v1/knowledge-graph/data</li>
 *   <li>POST   /v1/knowledge/documents/batch-delete</li>
 * </ul>
 */
public final class KnowledgeApi {

    private final BaseClient client;

    /**
     * 构造 KnowledgeApi。
     *
     * @param client 底层 BaseClient
     */
    public KnowledgeApi(BaseClient client) {
        this.client = client;
    }

    /**
     * GET /v1/knowledge/health(健康检查)。
     *
     * @return 健康状态(JsonNode,含 status / documents / chunks)
     */
    public JsonNode health() {
        return client.request("GET", "/knowledge/health", null, JsonNode.class);
    }

    /**
     * GET /v1/knowledge/documents(文档列表)。
     *
     * @return 文档列表(JsonNode)
     */
    public JsonNode listDocuments() {
        return client.request("GET", "/knowledge/documents", null, JsonNode.class);
    }

    /**
     * POST /v1/knowledge/documents(文档入库)。
     *
     * @param req 请求体(title / content / source 等)
     * @return 入库结果(JsonNode)
     */
    public JsonNode ingestDocument(Map<String, Object> req) {
        return client.request("POST", "/knowledge/documents", req, JsonNode.class);
    }

    /**
     * GET /v1/knowledge/documents/:id(文档详情)。
     *
     * @param id 文档 ID
     * @return 文档详情(JsonNode)
     */
    public JsonNode getDocument(String id) {
        return client.request("GET", "/knowledge/documents/" + BaseClient.encode(id),
                null, JsonNode.class);
    }

    /**
     * GET /v1/knowledge/documents/:id/chunks(文档分块)。
     *
     * @param id 文档 ID
     * @return 分块列表(JsonNode)
     */
    public JsonNode getDocumentChunks(String id) {
        return client.request("GET",
                "/knowledge/documents/" + BaseClient.encode(id) + "/chunks",
                null, JsonNode.class);
    }

    /**
     * DELETE /v1/knowledge/documents/:id(删除文档)。
     *
     * @param id 文档 ID
     */
    public void deleteDocument(String id) {
        client.requestRaw("DELETE", "/knowledge/documents/" + BaseClient.encode(id), null);
    }

    /**
     * POST /v1/knowledge/search(语义搜索)。
     *
     * @param req 搜索请求
     * @return 搜索结果(JsonNode,含 data 数组)
     */
    public JsonNode search(KnowledgeSearchRequest req) {
        return client.request("POST", "/knowledge/search", req, JsonNode.class);
    }

    /**
     * POST /v1/knowledge/rag-context(RAG 上下文检索)。
     *
     * @param req 请求体(query / topK 等)
     * @return RAG 上下文(JsonNode)
     */
    public JsonNode ragContext(Map<String, Object> req) {
        return client.request("POST", "/knowledge/rag-context", req, JsonNode.class);
    }

    /**
     * POST /v1/knowledge-graph/extract(知识图谱抽取)。
     *
     * @param req 请求体(text / documentId 等)
     * @return 抽取结果(JsonNode)
     */
    public JsonNode extractGraph(Map<String, Object> req) {
        return client.request("POST", "/knowledge-graph/extract", req, JsonNode.class);
    }

    /**
     * POST /v1/knowledge-graph/build(知识图谱构建)。
     *
     * @param req 请求体(source / sourceType 等)
     * @return 构建结果(JsonNode)
     */
    public JsonNode buildGraph(Map<String, Object> req) {
        return client.request("POST", "/knowledge-graph/build", req, JsonNode.class);
    }

    /**
     * GET /v1/knowledge-graph/data(知识图谱数据)。
     *
     * @return 图谱数据(JsonNode,含 nodes / edges)
     */
    public JsonNode getGraphData() {
        return client.request("GET", "/knowledge-graph/data", null, JsonNode.class);
    }

    /**
     * DELETE /v1/knowledge-graph/data(清空知识图谱)。
     */
    public void clearGraph() {
        client.requestRaw("DELETE", "/knowledge-graph/data", null);
    }

    /**
     * POST /v1/knowledge/documents/batch-delete(批量删除)。
     *
     * @param documentIds 文档 ID 列表
     * @return 删除结果(JsonNode,含 deleted 计数)
     */
    public JsonNode batchDeleteDocuments(List<String> documentIds) {
        return client.request("POST", "/knowledge/documents/batch-delete",
                java.util.Collections.singletonMap("documentIds", documentIds), JsonNode.class);
    }
}
