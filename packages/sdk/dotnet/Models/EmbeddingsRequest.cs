using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// Embeddings 请求(POST /v1/embeddings)。
/// </summary>
public class EmbeddingsRequest
{
    /// <summary>模型 ID。</summary>
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>输入(String 或 List&lt;String&gt;)。</summary>
    [JsonPropertyName("input")]
    public object? Input { get; set; }

    /// <summary>厂商。</summary>
    [JsonPropertyName("vendor")]
    public string? Vendor { get; set; }

    /// <summary>编码格式。</summary>
    [JsonPropertyName("encodingFormat")]
    public string? EncodingFormat { get; set; }

    /// <summary>维度。</summary>
    [JsonPropertyName("dimensions")]
    public int? Dimensions { get; set; }

    /// <summary>用户标识。</summary>
    [JsonPropertyName("user")]
    public string? User { get; set; }

    /// <summary>便捷构造(单条输入)。</summary>
    /// <param name="model">模型 ID</param>
    /// <param name="input">输入文本</param>
    public EmbeddingsRequest(string? model, string input)
    {
        Model = model;
        Input = input;
    }

    /// <summary>便捷构造(批量输入)。</summary>
    /// <param name="model">模型 ID</param>
    /// <param name="input">输入文本列表</param>
    public EmbeddingsRequest(string? model, List<string> input)
    {
        Model = model;
        Input = input;
    }

    /// <summary>默认构造。</summary>
    public EmbeddingsRequest() { }
}
