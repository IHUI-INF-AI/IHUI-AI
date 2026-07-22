using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 3D 模型生成模块。
/// </summary>
/// <remarks>
/// 端点(1 个):
/// <list type="bullet">
///   <item>POST /v1/3d/generations</item>
/// </list>
/// </remarks>
public sealed class ThreeDApi
{
    private readonly BaseClient _client;

    internal ThreeDApi(BaseClient client) => _client = client;

    /// <summary>POST /v1/3d/generations(3D 模型生成)。</summary>
    /// <param name="req">请求体(prompt / model / format 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>生成结果(JsonElement,含 modelUrl / taskId)</returns>
    public Task<JsonElement?> GenerationsAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/3d/generations", req, cancellationToken);
}
