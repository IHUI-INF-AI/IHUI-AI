using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 用量统计响应(GET /v1/usage / usage/:vendor)。
/// </summary>
public class UsageResponse
{
    /// <summary>总请求数。</summary>
    [JsonPropertyName("totalRequests")]
    public long? TotalRequests { get; set; }

    /// <summary>总 token 数。</summary>
    [JsonPropertyName("totalTokens")]
    public long? TotalTokens { get; set; }

    /// <summary>总成本。</summary>
    [JsonPropertyName("totalCost")]
    public double? TotalCost { get; set; }

    /// <summary>周期。</summary>
    [JsonPropertyName("period")]
    public string? Period { get; set; }

    /// <summary>按厂商统计。</summary>
    [JsonPropertyName("byVendor")]
    public Dictionary<string, object?>? ByVendor { get; set; }

    /// <summary>按模型统计。</summary>
    [JsonPropertyName("byModel")]
    public Dictionary<string, object?>? ByModel { get; set; }

    /// <summary>按日统计。</summary>
    [JsonPropertyName("daily")]
    public List<Dictionary<string, object?>>? Daily { get; set; }
}
