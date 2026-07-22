using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 模型列表响应(GET /v1/models)。
/// </summary>
public class ModelsResponse
{
    /// <summary>对象类型。</summary>
    [JsonPropertyName("object")]
    public string? Object { get; set; }

    /// <summary>模型列表。</summary>
    [JsonPropertyName("data")]
    public List<ModelInfo>? Data { get; set; }
}

/// <summary>模型信息。</summary>
public class ModelInfo
{
    /// <summary>模型 ID。</summary>
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    /// <summary>对象类型。</summary>
    [JsonPropertyName("object")]
    public string? Object { get; set; }

    /// <summary>创建时间戳。</summary>
    [JsonPropertyName("created")]
    public long? Created { get; set; }

    /// <summary>所有者。</summary>
    [JsonPropertyName("ownedBy")]
    public string? OwnedBy { get; set; }

    /// <summary>厂商。</summary>
    [JsonPropertyName("vendor")]
    public string? Vendor { get; set; }

    /// <summary>上下文窗口。</summary>
    [JsonPropertyName("contextWindow")]
    public int? ContextWindow { get; set; }
}
