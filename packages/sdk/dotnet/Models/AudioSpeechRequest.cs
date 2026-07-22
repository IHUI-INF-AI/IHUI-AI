using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 语音合成请求(POST /v1/audio/speech)。
/// </summary>
public class AudioSpeechRequest
{
    /// <summary>模型 ID。</summary>
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>输入文本。</summary>
    [JsonPropertyName("input")]
    public string? Input { get; set; }

    /// <summary>音色。</summary>
    [JsonPropertyName("voice")]
    public string? Voice { get; set; }

    /// <summary>响应格式(mp3/wav 等)。</summary>
    [JsonPropertyName("responseFormat")]
    public string? ResponseFormat { get; set; }

    /// <summary>语速。</summary>
    [JsonPropertyName("speed")]
    public double? Speed { get; set; }

    /// <summary>厂商。</summary>
    [JsonPropertyName("vendor")]
    public string? Vendor { get; set; }

    /// <summary>风格。</summary>
    [JsonPropertyName("style")]
    public string? Style { get; set; }

    /// <summary>采样率。</summary>
    [JsonPropertyName("sampleRate")]
    public int? SampleRate { get; set; }
}
