using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// Agent 执行响应(POST /v1/agents/execute)。
/// </summary>
public class AgentExecuteResponse
{
    /// <summary>任务 ID。</summary>
    [JsonPropertyName("taskId")]
    public string? TaskId { get; set; }

    /// <summary>会话 ID。</summary>
    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }

    /// <summary>状态。</summary>
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    /// <summary>输出。</summary>
    [JsonPropertyName("output")]
    public string? Output { get; set; }

    /// <summary>步骤列表。</summary>
    [JsonPropertyName("steps")]
    public List<Dictionary<string, object?>>? Steps { get; set; }

    /// <summary>用量。</summary>
    [JsonPropertyName("usage")]
    public Dictionary<string, object?>? Usage { get; set; }

    /// <summary>错误信息。</summary>
    [JsonPropertyName("error")]
    public string? Error { get; set; }
}
