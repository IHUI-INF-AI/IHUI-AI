using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 图像模块 — 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景生成。
/// </summary>
/// <remarks>
/// 端点(6 个):
/// <list type="bullet">
///   <item>POST /v1/images/generations</item>
///   <item>POST /v1/images/edits</item>
///   <item>POST /v1/images/inpaint</item>
///   <item>POST /v1/images/style-transfer</item>
///   <item>POST /v1/images/virtual-try-on</item>
///   <item>POST /v1/images/background</item>
/// </list>
/// 所有端点复用 <see cref="ImageGenerationsRequest"/> 作为请求体,响应均为 JsonElement(含 images 数组)。
/// </remarks>
public sealed class ImagesApi
{
    private readonly BaseClient _client;

    internal ImagesApi(BaseClient client) => _client = client;

    /// <summary>POST /v1/images/generations(文生图)。</summary>
    /// <param name="req">图像生成请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>生成结果(JsonElement,含 data 数组)</returns>
    public Task<JsonElement?> GenerationsAsync(ImageGenerationsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/images/generations", req, cancellationToken);

    /// <summary>POST /v1/images/edits(图片编辑)。</summary>
    /// <param name="req">图像编辑请求(需 image / prompt)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>编辑结果(JsonElement)</returns>
    public Task<JsonElement?> EditsAsync(ImageGenerationsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/images/edits", req, cancellationToken);

    /// <summary>POST /v1/images/inpaint(图片修复)。</summary>
    /// <param name="req">图像修复请求(需 image / mask / prompt)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>修复结果(JsonElement)</returns>
    public Task<JsonElement?> InpaintAsync(ImageGenerationsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/images/inpaint", req, cancellationToken);

    /// <summary>POST /v1/images/style-transfer(风格迁移)。</summary>
    /// <param name="req">风格迁移请求(需 image / style)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>迁移结果(JsonElement)</returns>
    public Task<JsonElement?> StyleTransferAsync(ImageGenerationsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/images/style-transfer", req, cancellationToken);

    /// <summary>POST /v1/images/virtual-try-on(虚拟试穿)。</summary>
    /// <param name="req">试穿请求(需 image / garment)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>试穿结果(JsonElement)</returns>
    public Task<JsonElement?> VirtualTryOnAsync(ImageGenerationsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/images/virtual-try-on", req, cancellationToken);

    /// <summary>POST /v1/images/background(背景生成)。</summary>
    /// <param name="req">背景生成请求(需 image / prompt)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>生成结果(JsonElement)</returns>
    public Task<JsonElement?> BackgroundAsync(ImageGenerationsRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/images/background", req, cancellationToken);
}
