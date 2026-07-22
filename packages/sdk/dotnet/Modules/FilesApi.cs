using System.Net.Http.Headers;
using System.Text.Json;

namespace Ihui.AI;

/// <summary>
/// 文件模块 — 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。
/// </summary>
/// <remarks>
/// 端点(9 个):
/// <list type="bullet">
///   <item>GET  /v1/files(文件列表)</item>
///   <item>POST /v1/files(上传文件,multipart/form-data)</item>
///   <item>GET  /v1/files/:id(文件详情)</item>
///   <item>DELETE /v1/files/:id(删除文件)</item>
///   <item>GET  /v1/files/:id/content(文件内容,二进制流)</item>
///   <item>GET  /v1/files/:id/versions(文件版本)</item>
///   <item>POST /v1/files/upload-init(分片上传初始化)</item>
///   <item>POST /v1/files/upload-chunk(上传分片)</item>
///   <item>POST /v1/files/upload-complete(完成上传)</item>
/// </list>
/// </remarks>
public sealed class FilesApi
{
    private readonly BaseClient _client;

    internal FilesApi(BaseClient client) => _client = client;

    /// <summary>GET /v1/files(文件列表)。</summary>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>文件列表(JsonElement)</returns>
    public Task<JsonElement?> ListAsync(CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/files", null, cancellationToken);

    /// <summary>POST /v1/files(上传文件流,multipart/form-data)。</summary>
    /// <param name="stream">文件流</param>
    /// <param name="filename">文件名</param>
    /// <param name="mimeType">MIME 类型(可选,默认 application/octet-stream)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>上传结果(JsonElement,含 fileId / filename / bytes)</returns>
    public Task<JsonElement?> UploadAsync(Stream stream, string filename, string? mimeType = null, CancellationToken cancellationToken = default)
    {
        var content = new MultipartFormDataContent();
        var byteContent = new StreamContent(stream);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue(mimeType ?? "application/octet-stream");
        content.Add(byteContent, "file", filename);
        return _client.RequestMultipartAsync<JsonElement>("/files", content, cancellationToken)!;
    }

    /// <summary>POST /v1/files(上传字节数组,multipart/form-data)。</summary>
    /// <param name="data">文件字节</param>
    /// <param name="filename">文件名</param>
    /// <param name="mimeType">MIME 类型(可选)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>上传结果(JsonElement)</returns>
    public Task<JsonElement?> UploadAsync(byte[] data, string filename, string? mimeType = null, CancellationToken cancellationToken = default)
    {
        var content = new MultipartFormDataContent();
        var byteContent = new ByteArrayContent(data);
        byteContent.Headers.ContentType = new MediaTypeHeaderValue(mimeType ?? "application/octet-stream");
        content.Add(byteContent, "file", filename);
        return _client.RequestMultipartAsync<JsonElement>("/files", content, cancellationToken)!;
    }

    /// <summary>GET /v1/files/:id(文件详情)。</summary>
    /// <param name="id">文件 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>文件详情(JsonElement)</returns>
    public Task<JsonElement?> GetAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/files/" + BaseClient.Encode(id), null, cancellationToken);

    /// <summary>DELETE /v1/files/:id(删除文件)。</summary>
    /// <param name="id">文件 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    public Task DeleteAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestRawAsync("DELETE", "/files/" + BaseClient.Encode(id), null, cancellationToken)!;

    /// <summary>GET /v1/files/:id/content(文件内容,返回二进制字节)。</summary>
    /// <param name="id">文件 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>文件内容字节</returns>
    public Task<byte[]> GetContentAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestBytesAsync("/files/" + BaseClient.Encode(id) + "/content", cancellationToken);

    /// <summary>GET /v1/files/:id/versions(文件版本列表)。</summary>
    /// <param name="id">文件 ID</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>版本列表(JsonElement)</returns>
    public Task<JsonElement?> GetVersionsAsync(string id, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("GET", "/files/" + BaseClient.Encode(id) + "/versions", null, cancellationToken);

    /// <summary>POST /v1/files/upload-init(分片上传初始化)。</summary>
    /// <param name="req">初始化请求</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>初始化结果(JsonElement,含 uploadId / chunkSize)</returns>
    public Task<JsonElement?> UploadInitAsync(UploadInitRequest req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/files/upload-init", req, cancellationToken);

    /// <summary>POST /v1/files/upload-chunk(上传分片,multipart)。</summary>
    /// <param name="uploadId">上传 ID(来自 upload-init)</param>
    /// <param name="index">分片索引(0-based)</param>
    /// <param name="chunkData">分片字节</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>上传结果(JsonElement)</returns>
    public Task<JsonElement?> UploadChunkAsync(string uploadId, int index, byte[] chunkData, CancellationToken cancellationToken = default)
    {
        var content = new MultipartFormDataContent();
        content.Add(new StringContent(uploadId), "uploadId");
        content.Add(new StringContent(index.ToString()), "index");
        var chunkContent = new ByteArrayContent(chunkData);
        chunkContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        content.Add(chunkContent, "chunk", "chunk-" + index);
        return _client.RequestMultipartAsync<JsonElement>("/files/upload-chunk", content, cancellationToken)!;
    }

    /// <summary>POST /v1/files/upload-complete(完成分片上传)。</summary>
    /// <param name="req">请求体(uploadId 等)</param>
    /// <param name="cancellationToken">取消令牌</param>
    /// <returns>完成结果(JsonElement,含 fileId / status)</returns>
    public Task<JsonElement?> UploadCompleteAsync(object req, CancellationToken cancellationToken = default)
        => _client.RequestAsync<JsonElement>("POST", "/files/upload-complete", req, cancellationToken);
}
