using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 知识库 / RAG / 知识图谱模块。
/// </summary>
/// <remarks>
/// 端点(13 个):
/// <list type="bullet">
///   <item>GET    /v1/knowledge/health</item>
///   <item>GET    /v1/knowledge/documents</item>
///   <item>POST   /v1/knowledge/documents</item>
///   <item>GET    /v1/knowledge/documents/:id</item>
///   <item>GET    /v1/knowledge/documents/:id/chunks</item>
///   <item>DELETE /v1/knowledge/documents/:id</item>
///   <item>POST   /v1/knowledge/search</item>
///   <item>POST   /v1/knowledge/rag-context</item>
///   <item>POST   /v1/knowledge/graph/extract</item>
///   <item>POST   /v1/knowledge/graph/build</item>
///   <item>GET    /v1/knowledge/graph/data</item>
///   <item>DELETE /v1/knowledge/graph/data</item>
///   <item>POST   /v1/knowledge/documents/batch-delete</item>
/// </list>
/// </remarks>
public sealed class KnowledgeApi
{
    private readonly BaseClient _client;

    internal KnowledgeApi(BaseClient client) => _client = client;

    /// <summary>GET /v1/knowledge/health(健康检查)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>健康状态(JsonElement,含 status / documents / chunks)</returns>
    public Task<JsonElement?> HealthAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/knowledge/health", null, cancellationToken);

    /// <summary>GET /v1/knowledge/documents(文档列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>文档列表(JsonElement)</returns>
    public Task<JsonElement?> ListDocumentsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/knowledge/documents", null, cancellationToken);

    /// <summary>POST /v1/knowledge/documents(文档入库)。</summary>
    /// <param name="req">请求体(title / content / source 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>入库结果(JsonElement)</returns>
    public Task<JsonElement?> IngestDocumentAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/knowledge/documents", req, cancellationToken);

    /// <summary>GET /v1/knowledge/documents/:id(文档详情)。</summary>
    /// <param name="id">文档 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>文档详情(JsonElement)</returns>
    public Task<JsonElement?> GetDocumentAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/knowledge/documents/" + BaseClient.Encode(id), null, cancellationToken);

    /// <summary>GET /v1/knowledge/documents/:id/chunks(文档分块)。</summary>
    /// <param name="id">文档 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>分块列表(JsonElement)</returns>
    public Task<JsonElement?> GetDocumentChunksAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/knowledge/documents/" + BaseClient.Encode(id) + "/chunks", null, cancellationToken);

    /// <summary>DELETE /v1/knowledge/documents/:id(删除文档)。</summary>
    /// <param name="id">文档 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    public Task DeleteDocumentAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestRawAsync("DELETE", "/knowledge/documents/" + BaseClient.Encode(id), null, cancellationToken)!;

    /// <summary>POST /v1/knowledge/search(语义搜索)。</summary>
    /// <param name="req">搜索请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>搜索结果(JsonElement,含 data 数组)</returns>
    public Task<JsonElement?> SearchAsync(KnowledgeSearchRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/knowledge/search", req, cancellationToken);

    /// <summary>POST /v1/knowledge/rag-context(RAG 上下文检索)。</summary>
    /// <param name="req">请求体(query / topK 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>RAG 上下文(JsonElement)</returns>
    public Task<JsonElement?> RagContextAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/knowledge/rag-context", req, cancellationToken);

    /// <summary>POST /v1/knowledge/graph/extract(知识图谱抽取)。</summary>
    /// <param name="req">请求体(text / documentId 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>抽取结果(JsonElement)</returns>
    public Task<JsonElement?> ExtractGraphAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/knowledge/graph/extract", req, cancellationToken);

    /// <summary>POST /v1/knowledge/graph/build(知识图谱构建)。</summary>
    /// <param name="req">请求体(source / sourceType 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>构建结果(JsonElement)</returns>
    public Task<JsonElement?> BuildGraphAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/knowledge/graph/build", req, cancellationToken);

    /// <summary>GET /v1/knowledge/graph/data(知识图谱数据)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>图谱数据(JsonElement,含 nodes / edges)</returns>
    public Task<JsonElement?> GetGraphDataAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/knowledge/graph/data", null, cancellationToken);

    /// <summary>DELETE /v1/knowledge/graph/data(清空知识图谱)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    public Task ClearGraphAsync(CancellationToken cancellationToken = default)
        => _client.RequestRawAsync("DELETE", "/knowledge/graph/data", null, cancellationToken)!;

    /// <summary>POST /v1/knowledge/documents/batch-delete(批量删除)。</summary>
    /// <param name="documentIds">文档 ID 列表</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>删除结果(JsonElement,含 deleted 计数)</returns>
    public Task<JsonElement?> BatchDeleteDocumentsAsync(List<string> documentIds, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/knowledge/documents/batch-delete",
            new { documentIds }, cancellationToken);
}
