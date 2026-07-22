using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ihui.AI;

/// <summary>
/// JSON 序列化反序列化工具(基于 System.Text.Json)。
/// </summary>
/// <remarks>
/// 单例模式,线程安全。配置:
/// <list type="bullet">
///   <item>序列化时忽略 null 字段</item>
///   <item>反序列化时忽略未知字段(大小写不敏感)</item>
///   <item>字段命名策略 camelCase(与 /v1/* 端点契约一致)</item>
/// </list>
/// </remarks>
public static class JsonUtil
{
    /// <summary>共享 JsonSerializerOptions(线程安全)。</summary>
    public static readonly JsonSerializerOptions Options = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    /// <summary>将对象序列化为 JSON 字符串。</summary>
    /// <param name="obj">待序列化对象</param>
    /// <returns>JSON 字符串</returns>
    /// <exception cref="SdkException">序列化失败</exception>
    public static string ToJson(object? obj)
    {
        if (obj is null) return "null";
        try
        {
            return JsonSerializer.Serialize(obj, Options);
        }
        catch (Exception e)
        {
            throw new SdkException(0, "json_serialize_error", "JSON serialize failed: " + e.Message, null);
        }
    }

    /// <summary>将 JSON 字符串反序列化为指定类型。</summary>
    /// <typeparam name="T">目标类型</typeparam>
    /// <param name="json">JSON 字符串</param>
    /// <returns>反序列化对象;输入为 null 或空串返回 default</returns>
    /// <exception cref="SdkException">反序列化失败</exception>
    public static T? FromJson<T>(string? json)
    {
        if (string.IsNullOrEmpty(json)) return default;
        try
        {
            return JsonSerializer.Deserialize<T>(json, Options);
        }
        catch (Exception e)
        {
            throw new SdkException(0, "json_parse_error", "JSON parse failed: " + e.Message, null);
        }
    }

    /// <summary>将 JSON 字符串解析为 JsonDocument。</summary>
    /// <param name="json">JSON 字符串</param>
    /// <returns>JsonDocument 实例</returns>
    public static JsonDocument ParseDocument(string json)
    {
        return JsonDocument.Parse(json);
    }

    /// <summary>将 JsonElement 转换为 .NET 对象(Dictionary / List / 基础类型)。</summary>
    /// <param name="element">JsonElement</param>
    /// <returns>对应的 .NET 对象</returns>
    public static object? ToObject(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => element.EnumerateObject()
                .ToDictionary(p => p.Name, p => ToObject(p.Value)),
            JsonValueKind.Array => element.EnumerateArray()
                .Select(ToObject)
                .ToList(),
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => element.GetRawText()
        };
    }
}
