using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 视频生成请求(POST /v1/videos/generations)。
/// </summary>
public class VideoGenerationsRequest
{
    /// <summary>模型 ID。</summary>
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>提示词。</summary>
    [JsonPropertyName("prompt")]
    public string? Prompt { get; set; }

    /// <summary>参考图。</summary>
    [JsonPropertyName("image")]
    public string? Image { get; set; }

    /// <summary>时长(秒)。</summary>
    [JsonPropertyName("duration")]
    public int? Duration { get; set; }

    /// <summary>尺寸。</summary>
    [JsonPropertyName("size")]
    public string? Size { get; set; }

    /// <summary>帧率。</summary>
    [JsonPropertyName("fps")]
    public int? Fps { get; set; }

    /// <summary>厂商。</summary>
    [JsonPropertyName("vendor")]
    public string? Vendor { get; set; }

    /// <summary>负面提示词。</summary>
    [JsonPropertyName("negativePrompt")]
    public string? NegativePrompt { get; set; }

    /// <summary>随机种子。</summary>
    [JsonPropertyName("seed")]
    public long? Seed { get; set; }

    /// <summary>风格。</summary>
    [JsonPropertyName("style")]
    public string? Style { get; set; }
}
