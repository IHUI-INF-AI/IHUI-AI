using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 生成队列模块 — 入队 / 状态查询 / 取消。
/// </summary>
/// <remarks>
/// 端点(3 个):
/// <list type="bullet">
///   <item>POST /v1/generation/enqueue</item>
///   <item>GET  /v1/generation/status/:id</item>
///   <item>POST /v1/generation/cancel/:id</item>
/// </list>
/// </remarks>
public sealed class GenerationApi
{
    private readonly BaseClient _client;

    internal GenerationApi(BaseClient client) => _client = client;

    /// <summary>POST /v1/generation/enqueue(入队生成任务)。</summary>
    /// <param name="req">请求体(type / params 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>入队结果(JsonElement,含 jobId / status)</returns>
    public Task<JsonElement?> EnqueueAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/generation/enqueue", req, cancellationToken);

    /// <summary>GET /v1/generation/status/:id(查询生成状态)。</summary>
    /// <param name="jobId">任务 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>任务状态(JsonElement)</returns>
    public Task<JsonElement?> GetStatusAsync(string jobId, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/generation/status/" + BaseClient.Encode(jobId), null, cancellationToken);

    /// <summary>POST /v1/generation/cancel/:id(取消生成任务)。</summary>
    /// <param name="jobId">任务 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>取消结果(JsonElement,含 jobId / status)</returns>
    public Task<JsonElement?> CancelAsync(string jobId, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/generation/cancel/" + BaseClient.Encode(jobId), null, cancellationToken);
}
