using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 图像生成请求(POST /v1/images/generations)。
/// </summary>
/// <remarks>其他图像端点(edits / inpaint / style-transfer / virtual-try-on / background)复用此结构。</remarks>
public class ImageGenerationsRequest
{
    /// <summary>模型 ID。</summary>
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>提示词。</summary>
    [JsonPropertyName("prompt")]
    public string? Prompt { get; set; }

    /// <summary>生成数量。</summary>
    [JsonPropertyName("n")]
    public int? N { get; set; }

    /// <summary>尺寸。</summary>
    [JsonPropertyName("size")]
    public string? Size { get; set; }

    /// <summary>质量。</summary>
    [JsonPropertyName("quality")]
    public string? Quality { get; set; }

    /// <summary>风格。</summary>
    [JsonPropertyName("style")]
    public string? Style { get; set; }

    /// <summary>响应格式。</summary>
    [JsonPropertyName("responseFormat")]
    public string? ResponseFormat { get; set; }

    /// <summary>厂商。</summary>
    [JsonPropertyName("vendor")]
    public string? Vendor { get; set; }

    /// <summary>原图(base64 或 URL)。</summary>
    [JsonPropertyName("image")]
    public string? Image { get; set; }

    /// <summary>蒙版(base64 或 URL)。</summary>
    [JsonPropertyName("mask")]
    public string? Mask { get; set; }

    /// <summary>负面提示词。</summary>
    [JsonPropertyName("negativePrompt")]
    public string? NegativePrompt { get; set; }

    /// <summary>随机种子。</summary>
    [JsonPropertyName("seed")]
    public long? Seed { get; set; }
}
