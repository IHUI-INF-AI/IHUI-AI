using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// Chat Completions 响应(POST /v1/chat/completions)。
/// </summary>
/// <remarks>OpenAI 兼容响应格式。</remarks>
public class ChatCompletionResponse
{
    /// <summary>响应 ID。</summary>
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    /// <summary>对象类型(如 chat.completion)。</summary>
    [JsonPropertyName("object")]
    public string? Object { get; set; }

    /// <summary>创建时间戳。</summary>
    [JsonPropertyName("created")]
    public long? Created { get; set; }

    /// <summary>模型 ID。</summary>
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>选择项列表。</summary>
    [JsonPropertyName("choices")]
    public List<Choice>? Choices { get; set; }

    /// <summary>token 用量。</summary>
    [JsonPropertyName("usage")]
    public Usage? Usage { get; set; }

    /// <summary>第一个 choice 的消息内容,无则返回空串。</summary>
    public string GetContent()
    {
        if (Choices is null || Choices.Count == 0) return "";
        return Choices[0].Message?.Content ?? "";
    }
}

/// <summary>Choice 选择项。</summary>
public class Choice
{
    /// <summary>索引。</summary>
    [JsonPropertyName("index")]
    public int? Index { get; set; }

    /// <summary>消息。</summary>
    [JsonPropertyName("message")]
    public ResponseMessage? Message { get; set; }

    /// <summary>结束原因。</summary>
    [JsonPropertyName("finishReason")]
    public string? FinishReason { get; set; }
}

/// <summary>响应消息。</summary>
public class ResponseMessage
{
    /// <summary>角色。</summary>
    [JsonPropertyName("role")]
    public string? Role { get; set; }

    /// <summary>内容。</summary>
    [JsonPropertyName("content")]
    public string? Content { get; set; }
}

/// <summary>Token 用量。</summary>
public class Usage
{
    /// <summary>输入 token 数。</summary>
    [JsonPropertyName("promptTokens")]
    public int? PromptTokens { get; set; }

    /// <summary>输出 token 数。</summary>
    [JsonPropertyName("completionTokens")]
    public int? CompletionTokens { get; set; }

    /// <summary>总 token 数。</summary>
    [JsonPropertyName("totalTokens")]
    public int? TotalTokens { get; set; }
}
