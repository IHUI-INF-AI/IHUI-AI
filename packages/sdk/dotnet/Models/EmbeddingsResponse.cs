using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// Embeddings 响应(POST /v1/embeddings)。
/// </summary>
public class EmbeddingsResponse
{
    /// <summary>对象类型(如 list)。</summary>
    [JsonPropertyName("object")]
    public string? Object { get; set; }

    /// <summary>embedding 列表。</summary>
    [JsonPropertyName("data")]
    public List<EmbeddingItem>? Data { get; set; }

    /// <summary>模型 ID。</summary>
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>token 用量。</summary>
    [JsonPropertyName("usage")]
    public EmbeddingsUsage? Usage { get; set; }
}

/// <summary>Embedding 数据项。</summary>
public class EmbeddingItem
{
    /// <summary>对象类型(如 embedding)。</summary>
    [JsonPropertyName("object")]
    public string? Object { get; set; }

    /// <summary>索引。</summary>
    [JsonPropertyName("index")]
    public int? Index { get; set; }

    /// <summary>向量。</summary>
    [JsonPropertyName("embedding")]
    public List<double>? Embedding { get; set; }
}

/// <summary>Embeddings token 用量。</summary>
public class EmbeddingsUsage
{
    /// <summary>输入 token 数。</summary>
    [JsonPropertyName("promptTokens")]
    public int? PromptTokens { get; set; }

    /// <summary>总 token 数。</summary>
    [JsonPropertyName("totalTokens")]
    public int? TotalTokens { get; set; }
}
