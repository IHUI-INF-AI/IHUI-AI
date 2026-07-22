using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// Chat Completions 请求(POST /v1/chat/completions)。
/// </summary>
/// <remarks>OpenAI 兼容字段,字段名 camelCase。</remarks>
public class ChatCompletionRequest
{
    /// <summary>模型 ID。</summary>
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>消息列表。</summary>
    [JsonPropertyName("messages")]
    public List<Message>? Messages { get; set; }

    /// <summary>采样温度。</summary>
    [JsonPropertyName("temperature")]
    public double? Temperature { get; set; }

    /// <summary>最大 token 数。</summary>
    [JsonPropertyName("maxTokens")]
    public int? MaxTokens { get; set; }

    /// <summary>top-p 采样。</summary>
    [JsonPropertyName("topP")]
    public double? TopP { get; set; }

    /// <summary>是否流式。</summary>
    [JsonPropertyName("stream")]
    public bool? Stream { get; set; }

    /// <summary>厂商。</summary>
    [JsonPropertyName("vendor")]
    public string? Vendor { get; set; }

    /// <summary>用户标识。</summary>
    [JsonPropertyName("user")]
    public string? User { get; set; }

    /// <summary>
    /// 创建 Builder。
    /// </summary>
    /// <returns>新的 Builder 实例</returns>
    public static Builder CreateBuilder() => new();

    /// <summary>ChatCompletionRequest builder。</summary>
    public sealed class Builder
    {
        private readonly ChatCompletionRequest _req = new();

        internal Builder()
        {
            _req.Messages = new List<Message>();
        }

        /// <param name="model">模型 ID</param>
        public Builder WithModel(string model) { _req.Model = model; return this; }

        /// <param name="messages">消息列表</param>
        public Builder WithMessages(List<Message> messages) { _req.Messages = messages; return this; }

        /// <param name="role">角色(system/user/assistant)</param>
        /// <param name="content">内容</param>
        public Builder AddMessage(string role, string content)
        {
            _req.Messages!.Add(new Message(role, content));
            return this;
        }

        /// <param name="temperature">采样温度</param>
        public Builder WithTemperature(double temperature) { _req.Temperature = temperature; return this; }

        /// <param name="maxTokens">最大 token 数</param>
        public Builder WithMaxTokens(int maxTokens) { _req.MaxTokens = maxTokens; return this; }

        /// <param name="topP">top-p 采样</param>
        public Builder WithTopP(double topP) { _req.TopP = topP; return this; }

        /// <param name="vendor">厂商</param>
        public Builder WithVendor(string vendor) { _req.Vendor = vendor; return this; }

        /// <param name="user">用户标识</param>
        public Builder WithUser(string user) { _req.User = user; return this; }

        /// <returns>构建好的请求</returns>
        public ChatCompletionRequest Build() => _req;
    }
}

/// <summary>
/// Chat 消息(OpenAI 兼容)。
/// </summary>
/// <param name="Role">角色(system/user/assistant)</param>
/// <param name="Content">内容</param>
/// <param name="Name">名称(可选)</param>
public record Message(
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("content")] string? Content,
    [property: JsonPropertyName("name")] string? Name = null
)
{
    /// <summary>便捷构造(仅 role + content)。</summary>
    public Message(string role, string content) : this(role, content, null) { }
}
