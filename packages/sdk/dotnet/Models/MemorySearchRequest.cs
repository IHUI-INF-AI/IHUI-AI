using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 记忆搜索请求(POST /v1/memory/search)。
/// </summary>
public class MemorySearchRequest
{
    /// <summary>查询文本。</summary>
    [JsonPropertyName("query")]
    public string? Query { get; set; }

    /// <summary>返回前 K 条。</summary>
    [JsonPropertyName("topK")]
    public int? TopK { get; set; }

    /// <summary>相似度阈值。</summary>
    [JsonPropertyName("threshold")]
    public double? Threshold { get; set; }

    /// <summary>记忆类型。</summary>
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    /// <summary>过滤条件。</summary>
    [JsonPropertyName("filter")]
    public Dictionary<string, object?>? Filter { get; set; }
}
