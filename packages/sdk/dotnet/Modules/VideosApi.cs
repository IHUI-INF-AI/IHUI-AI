using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 视频模块 — 生成 / 任务查询 / 编排。
/// </summary>
/// <remarks>
/// 端点(3 个):
/// <list type="bullet">
///   <item>POST /v1/videos/generations</item>
///   <item>GET  /v1/videos/tasks/:id</item>
///   <item>POST /v1/videos/compose</item>
/// </list>
/// </remarks>
public sealed class VideosApi
{
    private readonly BaseClient _client;

    internal VideosApi(BaseClient client) => _client = client;

    /// <summary>POST /v1/videos/generations(视频生成,异步任务)。</summary>
    /// <param name="req">视频生成请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>生成任务(JsonElement,含 taskId / status)</returns>
    public Task<JsonElement?> GenerationsAsync(VideoGenerationsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/videos/generations", req, cancellationToken);

    /// <summary>GET /v1/videos/tasks/:id(查询视频任务状态)。</summary>
    /// <param name="taskId">任务 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>任务状态(JsonElement)</returns>
    public Task<JsonElement?> GetTaskAsync(string taskId, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/videos/tasks/" + BaseClient.Encode(taskId), null, cancellationToken);

    /// <summary>POST /v1/videos/compose(视频编排)。</summary>
    /// <param name="req">编排请求(clips / transitions 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>编排结果(JsonElement)</returns>
    public Task<JsonElement?> ComposeAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/videos/compose", req, cancellationToken);
}
