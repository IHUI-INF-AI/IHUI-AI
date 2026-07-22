using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 知识库搜索请求(POST /v1/knowledge/search)。
/// </summary>
public class KnowledgeSearchRequest
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

    /// <summary>过滤条件。</summary>
    [JsonPropertyName("filter")]
    public Dictionary<string, object?>? Filter { get; set; }

    /// <summary>文档 ID 列表。</summary>
    [JsonPropertyName("documentIds")]
    public List<string>? DocumentIds { get; set; }

    /// <summary>是否启用重排序。</summary>
    [JsonPropertyName("rerank")]
    public bool? Rerank { get; set; }
}
