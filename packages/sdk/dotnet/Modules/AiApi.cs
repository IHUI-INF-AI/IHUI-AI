using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// AI 核心模块 — chat / embeddings / vision / moa / models / userModels。
/// </summary>
/// <remarks>
/// 端点(13 个):
/// <list type="bullet">
///   <item>POST /v1/chat/completions(非流式 + 流式)</item>
///   <item>POST /v1/embeddings</item>
///   <item>POST /v1/chat/vision</item>
///   <item>POST /v1/chat/moa</item>
///   <item>GET  /v1/models</item>
///   <item>GET  /v1/models/:id</item>
///   <item>GET  /v1/vendors/:vendor/models</item>
///   <item>GET  /v1/moa-presets</item>
///   <item>POST /v1/moa-presets</item>
///   <item>GET/POST/PUT/DELETE /v1/user/models</item>
/// </list>
/// </remarks>
public sealed class AiApi
{
    private readonly BaseClient _client;

    internal AiApi(BaseClient client) => _client = client;

    /// <summary>POST /v1/chat/completions(非流式)。</summary>
    /// <param name="req">Chat 请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>Chat 响应</returns>
    public Task<ChatCompletionResponse?> CompletionsAsync(ChatCompletionRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<ChatCompletionResponse>("POST", "/chat/completions", req, cancellationToken);

    /// <summary>
    /// POST /v1/chat/completions(stream:true)→ SSE 流式响应。
    /// </summary>
    /// <param name="req">Chat 请求(stream 字段会被自动设为 true)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>IAsyncEnumerable,逐 chunk yield JsonElement</returns>
    public IAsyncEnumerable<JsonElement> ChatCompletionsStreamAsync(ChatCompletionRequest req, CancellationToken cancellationToken = default)
    {
        req.Stream = true;
        return _client.RequestStreamAsync("POST", "/chat/completions", req, cancellationToken);
    }

    /// <summary>POST /v1/embeddings。</summary>
    /// <param name="req">Embeddings 请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>Embeddings 响应</returns>
    public Task<EmbeddingsResponse?> EmbeddingsAsync(EmbeddingsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<EmbeddingsResponse>("POST", "/embeddings", req, cancellationToken);

    /// <summary>POST /v1/chat/vision(视觉理解)。</summary>
    /// <param name="req">请求体(model / messages / image 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>响应(JsonElement)</returns>
    public Task<JsonElement?> ChatVisionAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/chat/vision", req, cancellationToken);

    /// <summary>POST /v1/chat/moa(Mixture of Agents)。</summary>
    /// <param name="req">请求体</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>响应(JsonElement)</returns>
    public Task<JsonElement?> ChatMoaAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/chat/moa", req, cancellationToken);

    /// <summary>GET /v1/models(模型列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>模型列表响应</returns>
    public Task<ModelsResponse?> ListModelsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<ModelsResponse>("GET", "/models", null, cancellationToken);

    /// <summary>GET /v1/models/:id(模型详情)。</summary>
    /// <param name="id">模型 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>模型详情(JsonElement)</returns>
    public Task<JsonElement?> GetModelAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/models/" + BaseClient.Encode(id), null, cancellationToken);

    /// <summary>GET /v1/vendors/:vendor/models(厂商模型列表)。</summary>
    /// <param name="vendor">厂商标识</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>厂商模型列表(JsonElement)</returns>
    public Task<JsonElement?> ListVendorModelsAsync(string vendor, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/vendors/" + BaseClient.Encode(vendor) + "/models", null, cancellationToken);

    /// <summary>GET /v1/moa-presets(MoA 预设列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>MoA 预设列表(JsonElement)</returns>
    public Task<JsonElement?> ListMoaPresetsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/moa-presets", null, cancellationToken);

    /// <summary>POST /v1/moa-presets(创建 MoA 预设)。</summary>
    /// <param name="req">请求体</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>创建结果(JsonElement)</returns>
    public Task<JsonElement?> CreateMoaPresetAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/moa-presets", req, cancellationToken);

    /// <summary>GET /v1/user/models(用户自定义模型列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>用户模型列表(JsonElement)</returns>
    public Task<JsonElement?> ListUserModelsAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/user/models", null, cancellationToken);

    /// <summary>POST /v1/user/models(创建用户自定义模型)。</summary>
    /// <param name="req">请求体</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>创建结果(JsonElement)</returns>
    public Task<JsonElement?> CreateUserModelAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/user/models", req, cancellationToken);

    /// <summary>PUT /v1/user/models/:id(更新用户自定义模型)。</summary>
    /// <param name="id">模型 ID</param>
    /// <param name="req">请求体</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>更新结果(JsonElement)</returns>
    public Task<JsonElement?> UpdateUserModelAsync(string id, object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("PUT", "/user/models/" + BaseClient.Encode(id), req, cancellationToken);

    /// <summary>DELETE /v1/user/models/:id(删除用户自定义模型)。</summary>
    /// <param name="id">模型 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    public Task DeleteUserModelAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestRawAsync("DELETE", "/user/models/" + BaseClient.Encode(id), null, cancellationToken)!;
}
