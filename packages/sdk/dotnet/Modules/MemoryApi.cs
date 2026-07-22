using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 记忆模块 — 保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。
/// </summary>
/// <remarks>
/// 端点(8 个):
/// <list type="bullet">
///   <item>POST   /v1/memory(保存记忆)</item>
///   <item>GET    /v1/memory(召回记忆)</item>
///   <item>POST   /v1/memory/search(语义搜索)</item>
///   <item>POST   /v1/memory/dream(Dream 梦境系统)</item>
///   <item>DELETE /v1/memory(遗忘记忆)</item>
///   <item>GET    /v1/memory/working(工作记忆)</item>
///   <item>GET    /v1/memory/episodic(情景记忆)</item>
///   <item>GET    /v1/memory/procedural(程序记忆)</item>
/// </list>
/// </remarks>
public sealed class MemoryApi
{
    private readonly BaseClient _client;

    internal MemoryApi(BaseClient client) => _client = client;

    /// <summary>POST /v1/memory(保存记忆)。</summary>
    /// <param name="req">请求体(content / type / metadata 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>保存结果(JsonElement,含 memoryId / status)</returns>
    public Task<JsonElement?> SaveAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/memory", req, cancellationToken);

    /// <summary>GET /v1/memory(召回记忆)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>记忆列表(JsonElement)</returns>
    public Task<JsonElement?> RecallAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/memory", null, cancellationToken);

    /// <summary>POST /v1/memory/search(语义搜索)。</summary>
    /// <param name="req">搜索请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>搜索结果(JsonElement)</returns>
    public Task<JsonElement?> SearchAsync(MemorySearchRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/memory/search", req, cancellationToken);

    /// <summary>POST /v1/memory/dream(Dream 梦境系统)。</summary>
    /// <param name="req">请求体(可为空对象)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>Dream 结果(JsonElement)</returns>
    public Task<JsonElement?> DreamAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/memory/dream", req, cancellationToken);

    /// <summary>DELETE /v1/memory(遗忘记忆)。</summary>
    /// <param name="req">请求体(memoryId)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>遗忘结果(JsonElement,含 memoryId / status)</returns>
    public Task<JsonElement?> ForgetAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("DELETE", "/memory", req, cancellationToken);

    /// <summary>GET /v1/memory/working(工作记忆)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>工作记忆(JsonElement)</returns>
    public Task<JsonElement?> WorkingAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/memory/working", null, cancellationToken);

    /// <summary>GET /v1/memory/episodic(情景记忆)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>情景记忆(JsonElement)</returns>
    public Task<JsonElement?> EpisodicAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/memory/episodic", null, cancellationToken);

    /// <summary>GET /v1/memory/procedural(程序记忆)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>程序记忆(JsonElement)</returns>
    public Task<JsonElement?> ProceduralAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/memory/procedural", null, cancellationToken);
}
