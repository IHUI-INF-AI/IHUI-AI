using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// Agent 执行请求(POST /v1/agents/execute / execute/stream / decompose)。
/// </summary>
public class AgentExecuteRequest
{
    /// <summary>Agent ID。</summary>
    [JsonPropertyName("agentId")]
    public string? AgentId { get; set; }

    /// <summary>输入文本。</summary>
    [JsonPropertyName("input")]
    public string? Input { get; set; }

    /// <summary>消息列表。</summary>
    [JsonPropertyName("messages")]
    public List<Dictionary<string, object?>>? Messages { get; set; }

    /// <summary>会话 ID。</summary>
    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }

    /// <summary>是否流式。</summary>
    [JsonPropertyName("stream")]
    public bool? Stream { get; set; }

    /// <summary>上下文。</summary>
    [JsonPropertyName("context")]
    public Dictionary<string, object?>? Context { get; set; }

    /// <summary>最大步数。</summary>
    [JsonPropertyName("maxSteps")]
    public int? MaxSteps { get; set; }

    /// <summary>创建 Builder。</summary>
    /// <returns>新的 Builder 实例</returns>
    public static Builder CreateBuilder() => new();

    /// <summary>AgentExecuteRequest builder。</summary>
    public sealed class Builder
    {
        private readonly AgentExecuteRequest _req = new();

        internal Builder() { }

        /// <param name="agentId">Agent ID</param>
        public Builder WithAgentId(string agentId) { _req.AgentId = agentId; return this; }

        /// <param name="input">输入文本</param>
        public Builder WithInput(string input) { _req.Input = input; return this; }

        /// <param name="sessionId">会话 ID</param>
        public Builder WithSessionId(string sessionId) { _req.SessionId = sessionId; return this; }

        /// <param name="stream">是否流式</param>
        public Builder WithStream(bool stream) { _req.Stream = stream; return this; }

        /// <param name="maxSteps">最大步数</param>
        public Builder WithMaxSteps(int maxSteps) { _req.MaxSteps = maxSteps; return this; }

        /// <returns>构建好的请求</returns>
        public AgentExecuteRequest Build() => _req;
    }
}
