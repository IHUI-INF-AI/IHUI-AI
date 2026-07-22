using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 分片上传初始化请求(POST /v1/files/upload-init)。
/// </summary>
public class UploadInitRequest
{
    /// <summary>文件名。</summary>
    [JsonPropertyName("filename")]
    public string? Filename { get; set; }

    /// <summary>文件大小(字节)。</summary>
    [JsonPropertyName("size")]
    public long? Size { get; set; }

    /// <summary>MIME 类型。</summary>
    [JsonPropertyName("mimeType")]
    public string? MimeType { get; set; }

    /// <summary>总分片数。</summary>
    [JsonPropertyName("totalChunks")]
    public int? TotalChunks { get; set; }

    /// <summary>项目 ID。</summary>
    [JsonPropertyName("projectId")]
    public string? ProjectId { get; set; }
}
