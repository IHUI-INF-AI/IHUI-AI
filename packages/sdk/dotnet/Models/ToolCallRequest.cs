using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// MCP 工具调用请求(POST /v1/tools/call)。
/// </summary>
public class ToolCallRequest
{
    /// <summary>工具名称。</summary>
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    /// <summary>工具参数。</summary>
    [JsonPropertyName("arguments")]
    public Dictionary<string, object?>? Arguments { get; set; }

    /// <summary>MCP server 名称。</summary>
    [JsonPropertyName("server")]
    public string? Server { get; set; }
}
