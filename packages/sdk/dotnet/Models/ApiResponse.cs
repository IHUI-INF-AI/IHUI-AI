using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// 通用 API 响应包装(用于解析无强类型定义的端点响应)。
/// </summary>
/// <typeparam name="T">data 字段类型</typeparam>
/// <remarks>
/// 注意:/v1/* 端点直接返回 JSON data(无 {code, message, data} 包装),
/// 故本类仅用于解析简单响应,大部分响应建议用对应专属类型。
/// </remarks>
public class ApiResponse<T>
{
    /// <summary>业务码。</summary>
    [JsonPropertyName("code")]
    public int? Code { get; set; }

    /// <summary>消息。</summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    /// <summary>数据。</summary>
    [JsonPropertyName("data")]
    public T? Data { get; set; }
}
