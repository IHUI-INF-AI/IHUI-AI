using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 工作流运行请求(POST /v1/workflows/instances / coze/run / n8n/run)。
/// </summary>
public class WorkflowRequest
{
    /// <summary>工作流 ID。</summary>
    [JsonPropertyName("workflowId")]
    public string? WorkflowId { get; set; }

    /// <summary>输入参数。</summary>
    [JsonPropertyName("input")]
    public Dictionary<string, object?>? Input { get; set; }

    /// <summary>是否异步。</summary>
    [JsonPropertyName("async")]
    public bool? Async { get; set; }

    /// <summary>webhook 回调地址。</summary>
    [JsonPropertyName("webhookUrl")]
    public string? WebhookUrl { get; set; }

    /// <summary>超时(秒)。</summary>
    [JsonPropertyName("timeout")]
    public int? Timeout { get; set; }
}
